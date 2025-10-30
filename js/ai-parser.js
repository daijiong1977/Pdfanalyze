class DeepSeekParser {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.deepseek.com/v1/chat/completions';
        this.chunkSize = 2000; // Smaller chunks = fewer events per response
        this.overlapPercent = 0; // No overlap - pages are clean
        this.maxTokens = 6000; // Account limit - do not increase
        this.debugLog = [];
    }

    async parseMeetPDF(pdfText) {
        this.debugLog = []; // Reset debug log
        this.addDebugEntry('=== STARTING PDF PARSE ===', 'info');
        
        // Preprocess: Extract meet name, entry limit, and keep only event pages
        const { meetName, entryLimit, eventPages } = this.preprocessPDF(pdfText);
        
        this.addDebugEntry(`📋 Meet: ${meetName}`, 'info');
        
        if (!eventPages || eventPages.trim().length === 0) {
            throw new Error('No event pages found in PDF');
        }
        
        // Split event pages into size-based chunks (no overlap)
        const chunks = this.createSizeBasedChunks(eventPages);
        
        this.addDebugEntry(`Processing ${chunks.length} chunks...`, 'info');
        
        let allEvents = [];
        
        for (let i = 0; i < chunks.length; i++) {
            this.addDebugEntry(`\n--- Chunk ${i + 1}/${chunks.length} ---`, 'chunk');
            
            try {
                const prompt = this.buildSwimMeetPrompt(chunks[i], entryLimit, i + 1, chunks.length);
                const response = await this.callDeepSeekAPI(prompt);
                
                if (response.events && response.events.length > 0) {
                    this.addDebugEntry(`✅ Found ${response.events.length} events in chunk ${i + 1}`, 'success');
                    allEvents = this.mergeEvents(allEvents, response.events);
                } else {
                    this.addDebugEntry(`⚠️ No events found in chunk ${i + 1}`, 'warning');
                }
            } catch (error) {
                this.addDebugEntry(`❌ ERROR in chunk ${i + 1}: ${error.message}`, 'error');
            }
            
            // Small delay to avoid rate limiting
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        this.addDebugEntry(`\n=== PARSE COMPLETE: ${allEvents.length} total events ===`, 'success');
        
        // Expose debug log to window for UI access
        window.parserDebugLog = this.debugLog;
        
        // Extract maxEventsPerDay from entry limit if available
        let maxEventsPerDay = null;
        if (entryLimit) {
            const match = entryLimit.match(/(\d+)\s*events?\s*per\s*day/i);
            if (match) {
                maxEventsPerDay = parseInt(match[1]);
            }
        }
        
        return {
            meetInfo: { 
                name: meetName,
                maxEventsPerDay: maxEventsPerDay,
                entryLimit: entryLimit
            },
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
        
        let meetName = '';
        let entryLimit = '';
        let eventPages = [];
        
        // Extract meet name from first page (usually first 1-3 lines)
        if (pages.length > 0 && pages[0].trim()) {
            const firstPage = pages[0].trim();
            const lines = firstPage.split('\n').filter(line => line.trim().length > 0);
            
            // Meet name is usually the first line or first few lines combined
            // Look for lines before "Entry Limit" or other metadata
            for (let i = 0; i < Math.min(3, lines.length); i++) {
                const line = lines[i].trim();
                
                // Skip if it's just a date or page number
                if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)) continue;
                if (/^page\s+\d+/i.test(line)) continue;
                if (line.length < 5) continue;
                
                // Stop if we hit metadata
                if (/entry limit|session|friday|saturday|sunday/i.test(line)) break;
                
                meetName = meetName ? meetName + ' ' + line : line;
            }
            
            if (meetName) {
                this.addDebugEntry(`📋 Meet Name: ${meetName}`, 'info');
            }
        }
        
        for (let i = 0; i < pages.length; i++) {
            let page = pages[i].trim();
            if (!page) continue;
            
            // Check if page has event schedule content
            const hasEvents = /EVENT\s+#/i.test(page) || 
                            /^\s*\d+\s+.*?\d+\s*&/m.test(page);
            
            // Extract entry limit from any page (usually first page)
            if (!entryLimit && /Entry Limit/i.test(page)) {
                const limitText = this.extractEntryLimit(page);
                if (limitText) {
                    entryLimit = limitText;
                }
            }
            
            // Only keep pages with events - discard all other pages
            if (hasEvents) {
                this.addDebugEntry(`✅ Page ${i + 1}: Has events (keeping)`, 'info');
                const cleaned = this.removeHeadersFooters(page);
                eventPages.push(cleaned);
            } else {
                this.addDebugEntry(`❌ Page ${i + 1}: No events (discarding)`, 'info');
            }
        }
        
        this.addDebugEntry(`📊 Kept ${eventPages.length} event pages from ${pages.length} total pages`, 'info');
        if (entryLimit) {
            this.addDebugEntry(`📋 Entry Limit: ${entryLimit}`, 'info');
        }
        
        return {
            meetName: meetName || 'Swim Meet',
            entryLimit: entryLimit,
            eventPages: eventPages.join('\n\n')
        };
    }

    extractEntryLimit(pageText) {
        // Find "Entry Limit:" or "Entry Limit" and extract the sentence
        const entryLimitMatch = pageText.match(/Entry Limit[:\s]+([^\n\.]+)/i);
        if (entryLimitMatch) {
            return entryLimitMatch[1].trim();
        }
        
        return '';
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
        let position = 0;
        
        while (position < pdfText.length) {
            const chunkEnd = Math.min(position + this.chunkSize, pdfText.length);
            const chunk = pdfText.substring(position, chunkEnd);
            
            if (chunk.trim().length > 0) {
                chunks.push(chunk);
            }
            
            // Move forward by full chunkSize (no overlap)
            position = chunkEnd;
            
            // Break if we've reached the end
            if (chunkEnd >= pdfText.length) {
                break;
            }
        }
        
        this.addDebugEntry(`📦 Created ${chunks.length} chunks (${this.chunkSize} chars each, no overlap)`, 'info');
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

DAY AND SESSION EXTRACTION (CRITICAL):
- ALWAYS look at the table headers for day/session information
- Headers like "Saturday PM" or "Friday AM" or "Session 2" apply to ALL events in that section
- If you see a day/time header (Friday/Saturday/Sunday AM/PM), apply it to ALL events below until you see a new header
- NEVER leave day or session fields empty - use the most recent header information
- Format: "day" = "Friday"/"Saturday"/"Sunday", "session" = "AM"/"PM" OR "Session 1"/"Session 2"/"Session 3"
- Accept EITHER format: "AM/PM" or "Session X" - use whatever is in the PDF
- If no session is specified but you have a day, use the day and set session to "AM" by default

SIDE-BY-SIDE FORMAT HANDLING:
- PDFs may have columns like: "Girls Event # | Event | Boys Event #"
- IMPORTANT: Create TWO separate events when you see this format:
  * One for Girls (eventGender: "F") with the left event number
  * One for Boys (eventGender: "M") with the right event number
- Both events share the same description but have different numbers and genders
- Example: "39 | 10 & Under 100 IM | 40" creates:
  * Event 39: 10 & Under 100 IM, Gender F
  * Event 40: 10 & Under 100 IM, Gender M

ENTRY LIMIT: ${meetContext || 'Not specified'}

CHUNKING NOTE: You are processing chunk ${chunkNum} of ${totalChunks}. Extract ALL events you see. Duplicate event numbers across chunks will be merged later.

OUTPUT FORMAT: Return ONLY valid JSON, no markdown fences, no code blocks, no explanations. The response must start with { and end with }. Must be directly parseable by JSON.parse().`
                },
                {
                    role: "user",
                    content: `Parse this swim meet schedule into JSON format:

PDF TEXT (Chunk ${chunkNum}/${totalChunks}):
${eventText}

REQUIRED JSON FORMAT - Return exactly this structure:
{
  "events": [
  "events": [
    {
      "eventNumber": 1,
      "day": "Friday",
      "session": "AM",
      "description": "8 & Under 25 Free",
      "ageGroup": "8 & Under",
      "eventGender": "F",
      "timeStandardA": null,
      "timeStandardB": null,
      "notes": "Girls event"
    },
    {
      "eventNumber": 2,
      "day": "Saturday",
      "session": "Session 2",
      "description": "10 & Under 50 Free",
      "ageGroup": "10 & Under",
      "eventGender": "M",
      "timeStandardA": null,
      "timeStandardB": null,
      "notes": "Boys event"
    }
  ]
}

CRITICAL REMINDER FOR DAY/SESSION:
- Look for headers like "Saturday PM", "Friday AM", "Session 2" at the TOP of event sections
- Session format can be EITHER "AM"/"PM" OR "Session 1"/"Session 2"/"Session 3" - use whatever the PDF shows
- If you see "Saturday PM" above a group of events, ALL those events get: "day": "Saturday", "session": "PM"
- If you see "Session 2" above events, those events get: "session": "Session 2"
- NEVER leave "day" or "session" as null or empty

REMEMBER: Output must be pure JSON only. No backticks, no additional text, no markdown formatting, no code blocks. Just the raw JSON object starting with { and ending with }.`
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
            // But sometimes it still wraps in markdown fences - strip them
            let cleanContent = content.trim();
            
            // Remove markdown code fences if present
            if (cleanContent.startsWith('```json')) {
                cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
            } else if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
            }
            
            cleanContent = cleanContent.trim();
            
            // Try parsing first
            try {
                const parsed = JSON.parse(cleanContent);
                this.addDebugEntry(`✅ Successfully parsed JSON with ${parsed.events?.length || 0} events`, 'success');
                return parsed;
            } catch (parseError) {
                // If parsing fails, try to repair truncated JSON
                this.addDebugEntry(`⚠️ Initial parse failed, attempting repair...`, 'warning');
                
                // Check if JSON is truncated (missing closing brackets)
                if (!cleanContent.endsWith('}')) {
                    // Find the last complete event object
                    const lastCompleteEvent = cleanContent.lastIndexOf('}');
                    if (lastCompleteEvent > 0) {
                        // Truncate to last complete event and close the arrays/objects
                        cleanContent = cleanContent.substring(0, lastCompleteEvent + 1);
                        
                        // Count opening brackets to add proper closing
                        const openBraces = (cleanContent.match(/{/g) || []).length;
                        const closeBraces = (cleanContent.match(/}/g) || []).length;
                        const openBrackets = (cleanContent.match(/\[/g) || []).length;
                        const closeBrackets = (cleanContent.match(/\]/g) || []).length;
                        
                        // Add missing closing brackets
                        cleanContent += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
                        cleanContent += '}'.repeat(Math.max(0, openBraces - closeBraces));
                        
                        this.addDebugEntry(`🔧 Repaired truncated JSON`, 'info');
                    }
                }
                
                const parsed = JSON.parse(cleanContent);
                this.addDebugEntry(`✅ Successfully parsed repaired JSON with ${parsed.events?.length || 0} events`, 'success');
                return parsed;
            }
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
