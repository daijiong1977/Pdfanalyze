class DeepSeekParser {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.deepseek.com/v1/chat/completions';
        this.maxTokens = 6000; // Safe limit to avoid timeouts
        this.debugLog = [];
    }

    async parseMeetPDF(pdfText) {
        this.debugLog = []; // Reset debug log
        this.addDebugEntry('=== STARTING PDF PARSE ===', 'info');
        
        // Preprocess: Remove non-event pages and clean up
        const cleanedText = this.preprocessPDF(pdfText);
        
        // Split into page-based chunks with overlap
        const chunks = this.createPageChunks(cleanedText);
        
        this.addDebugEntry(`Processing ${chunks.length} page chunks...`, 'info');
        console.log(`Processing ${chunks.length} page chunks...`);
        
        let allEvents = [];
        let meetInfo = null;
        
        for (let i = 0; i < chunks.length; i++) {
            this.addDebugEntry(`\n--- Chunk ${i + 1}/${chunks.length} ---`, 'chunk');
            console.log(`Parsing chunk ${i + 1}/${chunks.length}...`);
            
            try {
                const prompt = this.buildSwimMeetPrompt(chunks[i], i + 1, chunks.length);
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
        
        let cleanedPages = [];
        
        for (let i = 0; i < pages.length; i++) {
            let page = pages[i].trim();
            if (!page) continue;
            
            // Skip pages that look like cover/non-event pages
            const lowerPage = page.toLowerCase();
            const skipKeywords = [
                'welcome',
                'thank you',
                'officials',
                'directions',
                'facility rules',
                'acknowledgments',
                'sponsors'
            ];
            
            // Check if page is mostly non-event content
            let skipCount = 0;
            for (const keyword of skipKeywords) {
                if (lowerPage.includes(keyword)) {
                    skipCount++;
                }
            }
            
            // Skip if page has multiple skip keywords and no event numbers
            if (skipCount >= 2 && !/event\s+\d+/i.test(page)) {
                this.addDebugEntry(`Skipping page ${i + 1} (non-event content)`, 'info');
                continue;
            }
            
            // Remove common headers/footers
            page = this.removeHeadersFooters(page);
            
            cleanedPages.push(`PAGE ${i + 1}:\n${page}`);
        }
        
        this.addDebugEntry(`Cleaned PDF: ${cleanedPages.length} pages kept from ${pages.length} total`, 'info');
        return cleanedPages.join('\n\n');
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

    createPageChunks(pdfText) {
        const pages = pdfText.split(/PAGE \d+:/);
        const chunks = [];
        const overlapChars = 200; // Characters to overlap between chunks
        
        for (let i = 0; i < pages.length; i++) {
            let page = pages[i].trim();
            if (!page) continue;
            
            let chunk = `PAGE ${i + 1}:\n${page}`;
            
            // Add overlap from previous page (last 200 chars)
            if (i > 0 && pages[i - 1]) {
                const prevPage = pages[i - 1].trim();
                const overlap = prevPage.slice(-overlapChars);
                chunk = `...${overlap}\n\n${chunk}`;
            }
            
            // Add overlap from next page (first 200 chars)
            if (i < pages.length - 1 && pages[i + 1]) {
                const nextPage = pages[i + 1].trim();
                const overlap = nextPage.slice(0, overlapChars);
                chunk = `${chunk}\n\n${overlap}...`;
            }
            
            chunks.push(chunk);
        }
        
        return chunks;
    }

    buildSwimMeetPrompt(pdfText, chunkNum, totalChunks) {
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

CHUNKING NOTE: You are processing chunk ${chunkNum} of ${totalChunks}. Extract ALL events you see, even if they seem partial. Duplicate event numbers across chunks will be merged.

OUTPUT FORMAT: Return ONLY valid JSON, no other text. If you cannot complete parsing all events due to length, still return valid JSON with what you found.`
                },
                {
                    role: "user",
                    content: `Parse this swim meet schedule into JSON format:

PDF TEXT (Chunk ${chunkNum}/${totalChunks}):
${pdfText}

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
            max_tokens: this.maxTokens
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

        const data = await response.json();
        let content = data.choices[0].message.content;

        // Log raw response
        this.addDebugEntry(`RAW API RESPONSE:\n${content}`, 'response');

        try {
            const parsed = JSON.parse(content);
            this.addDebugEntry(`Successfully parsed JSON with ${parsed.events?.length || 0} events`, 'success');
            return parsed;
        } catch (parseError) {
            this.addDebugEntry(`Parse failed, attempting repair... Error: ${parseError.message}`, 'warning');
            
            // Try to repair truncated JSON
            const repaired = this.repairTruncatedJSON(content);
            this.addDebugEntry(`REPAIRED JSON:\n${repaired}`, 'response');
            
            try {
                const parsed = JSON.parse(repaired);
                this.addDebugEntry(`Repair successful! Parsed ${parsed.events?.length || 0} events`, 'success');
                return parsed;
            } catch (repairError) {
                this.addDebugEntry(`Repair failed: ${repairError.message}`, 'error');
                throw new Error('AI returned invalid or truncated JSON. Try a shorter PDF or check the API token limit.');
            }
        }
    }

    repairTruncatedJSON(jsonString) {
        let repaired = jsonString.trim();
        
        // Remove any trailing incomplete content after last complete object
        const lastCompleteObject = repaired.lastIndexOf('}');
        if (lastCompleteObject > -1) {
            repaired = repaired.substring(0, lastCompleteObject + 1);
        }
        
        // Count and balance brackets
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;
        
        // Close any unclosed strings
        const quotes = (repaired.match(/"/g) || []).length;
        if (quotes % 2 !== 0) {
            repaired += '"';
        }
        
        // Close brackets
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
            repaired += ']';
        }
        
        // Close braces
        for (let i = 0; i < openBraces - closeBraces; i++) {
            repaired += '}';
        }
        
        return repaired;
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
