class DeepSeekParser {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.deepseek.com/v1/chat/completions';
        this.maxTokens = 6000; // Safe limit to avoid timeouts
        this.chunkSize = 3000; // Characters per chunk (roughly 750 tokens) - smaller for more chunks
        this.overlapPercent = 0.10; // 10% overlap between chunks
        this.debugLog = [];
    }

    async parseMeetPDF(pdfText) {
        this.debugLog = []; // Reset debug log
        this.addDebugEntry('=== STARTING PDF PARSE ===', 'info');
        
        // Preprocess: Extract meet info and event pages separately
        const { meetContext, eventPages } = this.preprocessPDF(pdfText);
        
        // Split event pages into size-based chunks with 10% overlap
        const chunks = this.createSizeBasedChunks(eventPages);
        
        this.addDebugEntry(`Processing ${chunks.length} size-based chunks (${this.chunkSize} chars each with ${this.overlapPercent * 100}% overlap)...`, 'info');
        console.log(`Processing ${chunks.length} size-based chunks...`);
        
        let allEvents = [];
        let meetInfo = null;
        
        for (let i = 0; i < chunks.length; i++) {
            this.addDebugEntry(`\n--- Chunk ${i + 1}/${chunks.length} ---`, 'chunk');
            console.log(`Parsing chunk ${i + 1}/${chunks.length}...`);
            
            try {
                const prompt = this.buildSwimMeetPrompt(chunks[i], meetContext, i + 1, chunks.length);
                const response = await this.callDeepSeekAPI(prompt);
                
                if (!meetInfo && response.meetInfo) {
                    meetInfo = response.meetInfo;
                }
                
                if (response.events && response.events.length > 0) {
                    this.addDebugEntry(`Found ${response.events.length} events in chunk ${i + 1}`, 'success');
                    allEvents = this.mergeEvents(allEvents, response.events);
                } else {
                    this.addDebugEntry(`No events found in chunk ${i + 1}`, 'warning');
                }
            } catch (error) {
                this.addDebugEntry(`ERROR in chunk ${i + 1}: ${error.message}`, 'error');
                console.error(`Error in chunk ${i + 1}:`, error);
            }
            
            // Small delay to avoid rate limiting
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        this.addDebugEntry(`\n=== PARSE COMPLETE: ${allEvents.length} total events ===`, 'info');
        
        // Expose debug log to window for UI access
        window.parserDebugLog = this.debugLog;
        
        return {
            meetInfo: meetInfo || { name: "Swim Meet", date: null },
            events: allEvents
        };
    }

    addDebugEntry(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        this.debugLog.push({ timestamp, message, type });
    }

    preprocessPDF(pdfText) {
        // Split by pages
        const pages = pdfText.split(/PAGE \d+:/);
        
        let meetContext = [];
        let eventPages = [];
        
        for (let i = 0; i < pages.length; i++) {
            let page = pages[i].trim();
            if (!page) continue;
            
            const lowerPage = page.toLowerCase();
            
            // Check if page has event schedule content
            const hasEvents = /EVENT\s+#/i.test(page) || 
                            /^\s*\d+\s+.*?\d+\s*&/m.test(page);
            
            // Check if page has meet rules/info content
            const hasMeetInfo = /session/i.test(page) ||
                              /friday|saturday|sunday/i.test(page) ||
                              /max.*event/i.test(page) ||
                              /swimmer.*may.*enter/i.test(page) ||
                              /time standard/i.test(page) ||
                              /warm.*up/i.test(page) ||
                              /awards/i.test(page);
            
            // Skip only pure entry form pages
            const isEntryForm = /entry form/i.test(page) && 
                              /team name/i.test(page) &&
                              !hasMeetInfo;
            
            if (isEntryForm) {
                this.addDebugEntry(`Skipping page ${i + 1} (entry form)`, 'info');
                continue;
            }
            
            // Extract meet context from info pages
            if (hasMeetInfo && !hasEvents) {
                this.addDebugEntry(`Extracting meet context from page ${i + 1}`, 'info');
                meetContext.push(this.extractMeetContext(page));
                continue;
            }
            
            // Keep event pages
            if (hasEvents) {
                this.addDebugEntry(`Found event schedule on page ${i + 1}`, 'info');
                const cleaned = this.removeHeadersFooters(page);
                eventPages.push(`PAGE ${i + 1}:\n${cleaned}`);
            }
        }
        
        const contextSummary = meetContext.join('\n\n');
        this.addDebugEntry(`Meet Context: ${contextSummary.length} chars`, 'info');
        this.addDebugEntry(`Event Pages: ${eventPages.length} pages kept from ${pages.length} total`, 'info');
        
        return {
            meetContext: contextSummary,
            eventPages: eventPages.join('\n\n')
        };
    }

    extractMeetContext(pageText) {
        const lines = pageText.split('\n');
        let context = [];
        
        for (let line of lines) {
            const lower = line.toLowerCase().trim();
            
            // Extract session timing
            if (/friday|saturday|sunday/.test(lower) && /\d{1,2}:\d{2}/.test(line)) {
                context.push(line.trim());
            }
            
            // Extract swimmer limits
            if (/swimmer.*may.*enter/i.test(lower) || /max.*event/i.test(lower)) {
                context.push(line.trim());
            }
            
            // Extract time standards
            if (/time standard/i.test(lower) && /^\d+:/.test(line)) {
                context.push(line.trim());
            }
            
            // Extract session info
            if (/session \d+/i.test(lower)) {
                context.push(line.trim());
            }
            
            // Extract age group rules
            if (/age group/i.test(lower) && /\d+/.test(line)) {
                context.push(line.trim());
            }
        }
        
        return context.join('\n');
    }

    removeHeadersFooters(pageText) {
        const lines = pageText.split('\n');
        let cleaned = [];
        
        for (let line of lines) {
            const lower = line.toLowerCase().trim();
            
            // Skip common header/footer patterns
            if (lower.match(/^page \d+( of \d+)?$/)) continue;
            if (lower.match(/^\d+$/)) continue; // Just page numbers
            if (lower.match(/^(meet|event) (name|title):?$/)) continue;
            if (line.trim().length < 3) continue; // Very short lines
            
            cleaned.push(line);
        }
        
        return cleaned.join('\n');
    }

    createSizeBasedChunks(pdfText) {
        const chunks = [];
        const overlapSize = Math.floor(this.chunkSize * this.overlapPercent);
        const stepSize = this.chunkSize - overlapSize;
        
        let position = 0;
        let chunkNum = 0;
        
        while (position < pdfText.length) {
            const chunkEnd = Math.min(position + this.chunkSize, pdfText.length);
            const chunk = pdfText.substring(position, chunkEnd);
            
            if (chunk.trim().length > 0) {
                chunks.push(chunk);
                chunkNum++;
            }
            
            // Move forward by stepSize to create 10% overlap
            position += stepSize;
            
            // Break if we've reached the end
            if (chunkEnd >= pdfText.length) {
                break;
            }
        }
        
        this.addDebugEntry(`Created ${chunks.length} chunks from ${pdfText.length} characters (chunk size: ${this.chunkSize}, overlap: ${overlapSize} chars)`, 'info');
        return chunks;
    }

    buildSwimMeetPrompt(eventText, meetContext, chunkNum, totalChunks) {
        return {
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: `You are a swim meet expert that extracts structured event data from PDF meet sheets.

CRITICAL FLORIDA SWIMMING NOTATION RULES:
- Gender: "7" or "Girls" or "Women" = "F"
- Gender: "8" or "Boys" or "Men" = "M"
- Gender: No specification = "Mixed"
- Age Groups: "10&Under", "11-12", "13-14", "Open", etc.
- "8&9" = Ages 8 AND 9 together
- Sessions: Group by day/session based on PDF structure

MEET CONTEXT (Rules and Session Info):
${meetContext || 'No additional context available'}

CHUNKING NOTE: You are processing chunk ${chunkNum} of ${totalChunks}. Extract ALL events you see, even if they seem partial or incomplete. Duplicate event numbers across chunks will be merged later.

CRITICAL: If this chunk has NO complete events (just headers, partial data, or page breaks), return {"meetInfo": null, "events": []}. Do not attempt to create events from insufficient data.

OUTPUT FORMAT: Return ONLY valid JSON, no markdown, no explanations, no apologies. Must be parseable by JSON.parse().`
                },
                {
                    role: "user",
                    content: `Parse this swim meet schedule into JSON format:

PDF TEXT (Chunk ${chunkNum}/${totalChunks}):
${eventText}

REQUIRED JSON STRUCTURE:
{
  "meetInfo": {
    "name": "extracted meet name",
    "date": "YYYY-MM-DD if found"
  },
  "events": [
    {
      "eventNumber": 1,
      "day": "Friday/Saturday/Sunday",
      "session": "Session 1/2/3",
      "description": "complete event description",
      "ageGroup": "exact age group text",
      "eventGender": "F/M/Mixed",
      "timeStandardA": "time or null",
      "timeStandardB": "time or null",
      "notes": "Florida notation details"
    }
  ]
}`
                }
            ],
            temperature: 0.1,
            max_tokens: this.maxTokens,
            response_format: { type: "json_object" }
        };
    }

    async callDeepSeekAPI(prompt) {
        const response = await fetch(this.baseURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(prompt)
        });

        if (!response.ok) {
            const errorText = await response.text();
            this.addDebugEntry(`API Error: ${response.status} - ${errorText}`, 'error');
            throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const content = result.choices[0]?.message?.content;
        
        if (!content) {
            this.addDebugEntry(`No content in API response`, 'error');
            throw new Error('No content in API response');
        }

        // Log response size
        this.addDebugEntry(`Received response: ${content.length} chars`, 'info');

        try {
            // With response_format json_object, DeepSeek should return clean JSON
            const parsed = JSON.parse(content);
            this.addDebugEntry(`✅ Successfully parsed JSON with ${parsed.events?.length || 0} events`, 'success');
            return parsed;
        } catch (parseError) {
            this.addDebugEntry(`❌ Parse failed: ${parseError.message}`, 'error');
            this.addDebugEntry(`Response content: ${content.substring(0, 500)}...`, 'error');
            
            // Return empty result instead of throwing - let other chunks succeed
            return {
                meetInfo: null,
                events: []
            };
        }
    }

    mergeEvents(existingEvents, newEvents) {
        // Create a map of existing events by event number
        const eventMap = new Map();
        
        for (const event of existingEvents) {
            eventMap.set(event.eventNumber, event);
        }
        
        // Add or update with new events
        for (const event of newEvents) {
            if (!eventMap.has(event.eventNumber)) {
                eventMap.set(event.eventNumber, event);
            } else {
                // If event exists, keep the one with more complete data
                const existing = eventMap.get(event.eventNumber);
                const existingLength = JSON.stringify(existing).length;
                const newLength = JSON.stringify(event).length;
                
                if (newLength > existingLength) {
                    eventMap.set(event.eventNumber, event);
                }
            }
        }
        
        // Convert back to sorted array
        return Array.from(eventMap.values()).sort((a, b) => a.eventNumber - b.eventNumber);
    }

    validateAndParseResponse(response) {
        if (!response.events || !Array.isArray(response.events)) {
            this.addDebugEntry('Response missing events array', 'warning');
            return { events: [], meetInfo: response.meetInfo || null };
        }

        return response;
    }
}
