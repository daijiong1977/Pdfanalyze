class DeepSeekParser {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.deepseek.com/v1/chat/completions';
        this.chunkSize = 2000; // Smaller chunks = fewer events per response
        this.overlapPercent = 0.10; // 10% overlap between chunks
        this.maxTokens = 6000; // Account limit - do not increase
        this.debugLog = [];
    }

    addDebugEntry(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = { timestamp, message, type };
        this.debugLog.push(entry);
        console.log(`[${timestamp}] ${message}`);
    }

    getDebugLog() {
        return this.debugLog;
    }

    async parseMeetPDF(pdfText) {
        try {
            this.debugLog = [];
            this.addDebugEntry('=== STARTING PDF PARSE ===', 'info');
            
            // Step 1: Preprocess PDF to separate meet context from events
            const { meetContext, eventPages } = this.preprocessPDF(pdfText);
            
            if (eventPages.length === 0) {
                throw new Error('No event pages found in PDF');
            }
            
            // Step 2: Create size-based chunks from event pages
            const eventText = eventPages.join('\n\n');
            const chunks = this.createSizeBasedChunks(eventText);
            
            this.addDebugEntry(`Processing ${chunks.length} size-based chunks...`, 'info');
            
            // Step 3: Parse each chunk with meet context
            let allEvents = [];
            let meetInfo = null;
            
            for (let i = 0; i < chunks.length; i++) {
                try {
                    const prompt = this.buildSwimMeetPrompt(chunks[i], meetContext, i + 1, chunks.length);
                    const result = await this.callDeepSeekAPI(prompt);
                    
                    if (result.meetInfo && !meetInfo) {
                        meetInfo = result.meetInfo;
                        this.addDebugEntry(`📋 Captured meet info: ${meetInfo.name || 'Unknown'}`, 'info');
                        if (meetInfo.maxEventsPerDay) {
                            this.addDebugEntry(`   Max events per day: ${meetInfo.maxEventsPerDay}`, 'info');
                        }
                        if (meetInfo.maxTotalEvents) {
                            this.addDebugEntry(`   Max total events: ${meetInfo.maxTotalEvents}`, 'info');
                        }
                        if (meetInfo.maxSessions) {
                            this.addDebugEntry(`   Max sessions: ${meetInfo.maxSessions}`, 'info');
                        }
                    }
                    
                    if (result.events && result.events.length > 0) {
                        allEvents = this.mergeEvents(allEvents, result.events);
                    }
                } catch (error) {
                    this.addDebugEntry(`ERROR in chunk ${i + 1}: ${error.message}`, 'error');
                }
            }
            
            this.addDebugEntry(`=== PARSE COMPLETE: ${allEvents.length} total events ===`, 'success');
            
            return {
                meetInfo: meetInfo || { name: 'Unknown Meet', date: null },
                events: allEvents,
                debugLog: this.debugLog
            };
            
        } catch (error) {
            this.addDebugEntry(`FATAL ERROR: ${error.message}`, 'error');
            throw error;
        }
    }

    preprocessPDF(pdfText) {
        this.addDebugEntry('Preprocessing PDF to identify page types...', 'info');
        
        // Split by page markers
        const pages = pdfText.split(/PAGE \d+:/).filter(p => p.trim().length > 0);
        
        const eventPages = [];
        const infoPages = [];
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const pageNum = i + 1;
            
            // Check if this page has events
            const hasEvents = /EVENT\s+#/i.test(page) || /^\s*\d+\s+.*?\d+\s*&/m.test(page);
            
            // Check if this page has meet info (session times, rules, etc.)
            const hasMeetInfo = /session|Friday|Saturday|Sunday|swimmers?\s+may\s+enter|time\s+standard/i.test(page);
            
            // Skip entry forms
            const isEntryForm = /entry\s+form/i.test(page) && /team\s+name/i.test(page);
            
            if (isEntryForm) {
                this.addDebugEntry(`Skipping entry form on page ${pageNum}`, 'info');
                continue;
            }
            
            if (hasEvents) {
                this.addDebugEntry(`Found event schedule on page ${pageNum}`, 'info');
                eventPages.push(page);
            } else if (hasMeetInfo && i < 3) {
                // Only consider first 3 pages for meet context
                this.addDebugEntry(`Found meet info on page ${pageNum}`, 'info');
                infoPages.push(page);
            }
        }
        
        // Extract meet context from info pages
        let meetContext = '';
        if (infoPages.length > 0) {
            this.addDebugEntry(`Extracting meet context from pages 1-${infoPages.length}`, 'info');
            meetContext = this.extractMeetContext(infoPages.join('\n\n'));
        }
        
        return { meetContext, eventPages };
    }

    extractMeetContext(infoText) {
        const context = [];
        
        // Extract session information
        const sessionMatch = infoText.match(/session\s+\d+[^\n]{0,100}/gi);
        if (sessionMatch) {
            context.push('SESSIONS: ' + sessionMatch.join('; '));
        }
        
        // Extract swimmer limits
        const limitsMatch = infoText.match(/swimmers?\s+may\s+enter[^\n]{0,150}/gi);
        if (limitsMatch) {
            context.push('LIMITS: ' + limitsMatch.join('; '));
        }
        
        // Extract time standards
        const standardsMatch = infoText.match(/time\s+standard[^\n]{0,100}/gi);
        if (standardsMatch) {
            context.push('STANDARDS: ' + standardsMatch.join('; '));
        }
        
        return context.join('\n');
    }

    createSizeBasedChunks(pdfText) {
        const chunks = [];
        const overlapSize = Math.floor(this.chunkSize * this.overlapPercent);
        const stepSize = this.chunkSize - overlapSize;
        
        let position = 0;
        let chunkNum = 1;
        
        while (position < pdfText.length) {
            // Calculate end position
            const chunkEnd = Math.min(position + this.chunkSize, pdfText.length);
            
            // Extract chunk
            const chunk = pdfText.substring(position, chunkEnd);
            
            // Add chunk if it has content
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

MEET CONTEXT (Rules and Session Info):
${meetContext || 'No additional context available'}

CHUNKING NOTE: You are processing chunk ${chunkNum} of ${totalChunks}. Extract ALL events you see, even if they seem partial or incomplete. Duplicate event numbers across chunks will be merged later.

CRITICAL: If this chunk has NO complete events (just headers, partial data, or page breaks), return {"meetInfo": null, "events": []}. Do not attempt to create events from insufficient data.

OUTPUT FORMAT: Return ONLY valid JSON, no markdown fences, no code blocks, no explanations. The response must start with { and end with }. Must be directly parseable by JSON.parse().`
                },
                {
                    role: "user",
                    content: `Parse this swim meet schedule into JSON format:

PDF TEXT (Chunk ${chunkNum}/${totalChunks}):
${eventText}

REQUIRED JSON FORMAT - Return exactly this structure:
{
  "meetInfo": {
    "name": "Meet Name",
    "date": "2025-11-15",
    "maxEventsPerDay": "5 per day",
    "maxTotalEvents": "10 total",
    "maxSessions": 3
  },
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
        for (const newEvent of newEvents) {
            const existing = eventMap.get(newEvent.eventNumber);
            
            if (!existing) {
                // New event - add it
                eventMap.set(newEvent.eventNumber, newEvent);
            } else {
                // Event exists - keep the version with more complete data
                const existingComplete = this.countCompleteFields(existing);
                const newComplete = this.countCompleteFields(newEvent);
                
                if (newComplete > existingComplete) {
                    eventMap.set(newEvent.eventNumber, newEvent);
                }
            }
        }
        
        // Convert map back to sorted array
        return Array.from(eventMap.values()).sort((a, b) => a.eventNumber - b.eventNumber);
    }

    countCompleteFields(event) {
        let count = 0;
        if (event.description && event.description.length > 10) count++;
        if (event.ageGroup) count++;
        if (event.eventGender) count++;
        if (event.day) count++;
        if (event.session) count++;
        return count;
    }
}

// Make available globally
window.DeepSeekParser = DeepSeekParser;