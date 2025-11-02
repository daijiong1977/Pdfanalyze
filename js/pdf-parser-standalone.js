// --- COMPREHENSIVE STROKE MAPPING ---
const STROKE_MAP = {
    // Freestyle variations
    'FREE': 'FREESTYLE',
    'FREESTYLE': 'FREESTYLE',
    'FR': 'FREESTYLE',
    'FRE': 'FREESTYLE',
    
    // Backstroke variations
    'BACK': 'BACKSTROKE',
    'BACKSTROKE': 'BACKSTROKE',
    'BK': 'BACKSTROKE',
    
    // Breaststroke variations
    'BREAST': 'BREASTSTROKE',
    'BREASTSTROKE': 'BREASTSTROKE',
    'BR': 'BREASTSTROKE',
    'BRST': 'BREASTSTROKE',
    
    // Butterfly variations
    'FLY': 'BUTTERFLY',
    'BUTTERFLY': 'BUTTERFLY',
    'FL': 'BUTTERFLY',
    
    // Individual Medley variations
    'IM': 'INDIVIDUAL MEDLEY',
    'INDIVIDUALMEDLEY': 'INDIVIDUAL MEDLEY',
    'INDMEDLEY': 'INDIVIDUAL MEDLEY',
    
    // Medley Relay variations
    'MR': 'MEDLEY RELAY',
    'MEDLEYRELAY': 'MEDLEY RELAY',
    'MEDLEYRLY': 'MEDLEY RELAY',
    'MRELAY': 'MEDLEY RELAY',
    
    // Freestyle Relay variations
    'RELAY': 'FREESTYLE RELAY',
    'FRRELAY': 'FREESTYLE RELAY',
    'FREERELAY': 'FREESTYLE RELAY',
    'FREESTYLERELAY': 'FREESTYLE RELAY',
    'RLY': 'FREESTYLE RELAY',
    'FRLY': 'FREESTYLE RELAY',
    
    // Mixed Relay
    'MIXED RELAY': 'MIXED RELAY',
    'MIXEDRELAY': 'MIXED RELAY',
    'MIX RELAY': 'MIXED RELAY',
    
    // Other
    'SPRINT': 'SPRINT FREESTYLE',
    'DISTANCE': 'DISTANCE FREESTYLE',
    'OPEN': 'OPEN WATER',
    'KICK': 'KICK',
    'PULL': 'PULL',
    'DIVE': 'DIVING'
};

/**
 * Normalize stroke names for consistent sorting/filtering
 */
function normalizeStroke(rawStroke) {
    if (!rawStroke) return 'UNKNOWN';
    
    // Clean up the stroke name
    const cleanedStroke = rawStroke
        .trim()
        .toUpperCase()
        .replace(/[.\s&,-]+/g, ''); // Remove punctuation and spaces
    
    // Check if it's in our map
    if (STROKE_MAP[cleanedStroke]) {
        return STROKE_MAP[cleanedStroke];
    }
    
    // Try to find partial matches
    for (const [key, value] of Object.entries(STROKE_MAP)) {
        if (cleanedStroke.includes(key) || key.includes(cleanedStroke)) {
            return value;
        }
    }
    
    return rawStroke.toUpperCase();
}

/**
 * Extract the actual stroke type from description (last meaningful word)
 */
function extractStroke(description) {
    if (!description) return 'UNKNOWN';
    
    // Common stroke keywords
    const strokeKeywords = ['FREESTYLE', 'FREE', 'FR', 'BACKSTROKE', 'BACK', 'BK', 
                           'BREASTSTROKE', 'BREAST', 'BR', 'BUTTERFLY', 'FLY', 'FL',
                           'IM', 'MEDLEY', 'RELAY', 'RLY', 'MR', 'MIXED'];
    
    const words = description.split(/\s+/);
    
    // Look through words from right to left for stroke keywords
    for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i].toUpperCase().replace(/[.,;:]/g, '');
        
        // Check if word matches any stroke keyword
        for (const keyword of strokeKeywords) {
            if (word.includes(keyword) || keyword.includes(word)) {
                return normalizeStroke(words.slice(i).join(' '));
            }
        }
    }
    
    return normalizeStroke(description.split(/\s+/).pop());
}

// --- CORE PRE-PROCESSING FUNCTION ---

/**
 * Standardizes raw PDF text carefully.
 * KEY INSIGHT: PDFs from web extraction LOSE LINE BREAKS, causing sentences to merge.
 * Example input: "...November 1 4 - 1 6 , 202 5 SANCTIONHeld under...Any swimmer..."
 * Example output: "...November 14-16, 2025 SANCTION Held under...Any swimmer..."
 * 
 * Strategy (like original test-pdf-parser.js):
 * 1. FIRST: Convert ALL line breaks to spaces, collapse multiple spaces (reconstruct sentences)
 * 2. THEN: Fix fragmented numbers and abbreviations (targeted cleaning)
 * This aggressive PASS 1 is critical for PDFs extracted from web sources!
 */
function cleanRawText(fullText) {
    let cleanedText = fullText;

    // ========== PASS 1: RECONSTRUCT SENTENCES (MOST CRITICAL FOR WEB-EXTRACTED PDFs) ==========
    // Convert ALL line breaks to spaces (handles merged text from web extraction)
    cleanedText = cleanedText.replace(/[\r\n]+/g, ' ');
    
    // Collapse multiple spaces to single space immediately (normalizes merged text)
    cleanedText = cleanedText.replace(/\s{2,}/g, ' ');
    
    // ========== PASS 2: FIX FRAGMENTED EVENT PAIRS ==========
    // Pattern: "1 3 5-1 3 6" → "135-136"
    cleanedText = cleanedText.replace(/(\d)\s(\d)\s(\d)\s*-\s*(\d)\s(\d)\s(\d)/g, '$1$2$3-$4$5$6');
    
    // ========== PASS 3: FIX ABBREVIATIONS ==========
    // Fix fragmented ABBREVIATIONS with dots: "M . R ." → "MR"
    cleanedText = cleanedText.replace(/([A-Z])\s*\.\s+([A-Z])\s*\./g, '$1$2');
    
    // Fix fragmented single-letter abbreviations: "I M" → "IM", "F R" → "FR", etc.
    cleanedText = cleanedText.replace(/\bI\s+M\b/g, 'IM');
    cleanedText = cleanedText.replace(/\bF\s+R\b/g, 'FR');
    cleanedText = cleanedText.replace(/\bM\s+R\b/g, 'MR');
    
    // ========== PASS 4: FIX FRAGMENTED NUMBERS (Context-aware) ==========
    // Fix "100 M.R." or "100 IM" patterns (distance + stroke/abbreviation)
    cleanedText = cleanedText.replace(/(\d)\s+(\d)\s+(\d)(?=\s+(?:M\.R|MR|IM|FR|M|F))/g, '$1$2$3');
    
    // ========== PASS 5: NORMALIZE HYPHENS ==========
    // Clean up spaces around hyphens: "135 - 136" → "135-136"
    cleanedText = cleanedText.replace(/(\d)\s*-\s*(\d)/g, '$1-$2');

    return cleanedText.trim();
}

// --- IMPROVED PARSING FUNCTIONS ---

// 1. Basic Information Parser
function extractBasicInfo(fullText) {
    // Try to find meet name
    const eventNameMatch = fullText.match(
        /(?:Patriot Aquatics|RAFC|FAST|Florida Aquatics|Swim Meet|Invitational|Open|Championship)/i
    );
    
    // Try to find date range
    const dateRangeMatch = fullText.match(
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{1,2}(?:st|nd|rd|th)?)?\s*,?\s*\d{4}/i
    );
    
    // Try to find address
    const addressMatch = fullText.match(
        /(\d{1,5}\s+[^,\n]+(?:Rd|Road|St|Street|Ave|Avenue|Lane|Ln|Pkwy|Parkway|Blvd|Boulevard|Cir|Circle)[^,]*,\s*(?:FL|FL\.)\s*\d{5})/i
    );
    
    // Find entry limit
    const entryLimitMatch = fullText.match(
        /[Ss]wimmers?\s+(?:will be\s+)?limited\s+to\s+([0-9]+)\s+events?\s+per\s+(session|day|meet)/i
    );
    
    let limitText = 'N/A';
    if (entryLimitMatch) {
        const num = entryLimitMatch[1];
        const period = entryLimitMatch[2].toLowerCase();
        limitText = `${num} events per ${period}`;
    }

    return {
        eventName: eventNameMatch ? eventNameMatch[0].trim() : 'Swim Meet',
        dateRange: dateRangeMatch ? dateRangeMatch[0].trim() : 'N/A',
        address: addressMatch ? addressMatch[1].trim() : 'N/A',
        entryLimit: limitText
    };
}

// 2A. Parser for Type A Documents (Hyphenated Event Pairs)
function parseEvents_TypeA(fullText) {
    const events = [];
    const processedRanges = new Set(); // Track which sections we've already parsed
    
    // PASS 1: Find all lines with hyphenated event pairs (normal format)
    // Pattern: "135-136 10 & Under 100 Freestyle"
    const eventLineRegex = /(\d{1,3})-(\d{1,3})\s+([^-\n]*?)(?=(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:AM|PM)|(\d{1,3})-\d{1,3})|$)/gm;
    
    let match;
    while ((match = eventLineRegex.exec(fullText)) !== null) {
        const girlsNum = parseInt(match[1]);
        const boysNum = parseInt(match[2]);
        let description = match[3].trim();
        
        // Remove session markers that might have been captured (Saturday AM, etc.)
        description = description.replace(/\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(AM|PM)\s*/i, '').trim();
        
        // Extract stroke from description
        const stroke = extractStroke(description);
        
        if (!isNaN(girlsNum)) {
            events.push({
                eventNumber: girlsNum,
                gender: 'Girls',
                description: description,
                stroke: stroke
            });
            processedRanges.add(girlsNum);
        }
        
        if (!isNaN(boysNum)) {
            events.push({
                eventNumber: boysNum,
                gender: 'Boys',
                description: description,
                stroke: stroke
            });
            processedRanges.add(boysNum);
        }
    }
    
    // PASS 2: Find fragmented event pairs (OCR splits "7-8" into "7  8" with multiple spaces)
    // Pattern: "7  8 11 & 12 200 Freestyle" where 2+ spaces between digits indicate OCR fragmentation
    const fragmentedRegex = /(\d{1,3})\s{2,}(\d{1,3})\s+([^-\n]*?)(?=(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:AM|PM)|(\d{1,3})\s{2,}\d{1,3}|(\d{1,3})-\d{1,3})|$)/gm;
    
    while ((match = fragmentedRegex.exec(fullText)) !== null) {
        const girlsNum = parseInt(match[1]);
        const boysNum = parseInt(match[2]);
        let description = match[3].trim();
        
        // Skip if we already parsed these event numbers (avoid duplicates)
        if (processedRanges.has(girlsNum) || processedRanges.has(boysNum)) {
            continue;
        }
        
        // Remove session markers
        description = description.replace(/\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(AM|PM)\s*/i, '').trim();
        
        // Extract stroke
        const stroke = extractStroke(description);
        
        if (!isNaN(girlsNum)) {
            events.push({
                eventNumber: girlsNum,
                gender: 'Girls',
                description: description,
                stroke: stroke
            });
            processedRanges.add(girlsNum);
        }
        
        if (!isNaN(boysNum)) {
            events.push({
                eventNumber: boysNum,
                gender: 'Boys',
                description: description,
                stroke: stroke
            });
            processedRanges.add(boysNum);
        }
    }
    
    return events.sort((a, b) => a.eventNumber - b.eventNumber);
}

// 2B. Parser for Type B Documents (Three-Column Table)
function parseEvents_TypeB(fullText) {
    const events = [];
    
    // Pattern for quoted three-column format: "101","Description","102"
    const rowRegex = /"(\d{1,3})"\s*,\s*"([^"]+)"\s*,\s*"(\d{1,3})"/g;
    
    let match;
    while ((match = rowRegex.exec(fullText)) !== null) {
        const girlsNum = parseInt(match[1]);
        const description = match[2].trim();
        const boysNum = parseInt(match[3]);
        
        // Extract stroke
        const stroke = extractStroke(description);
        
        if (!isNaN(girlsNum)) {
            events.push({
                eventNumber: girlsNum,
                gender: 'Girls',
                description: description,
                stroke: stroke
            });
        }
        
        if (!isNaN(boysNum)) {
            events.push({
                eventNumber: boysNum,
                gender: 'Boys',
                description: description,
                stroke: stroke
            });
        }
    }
    
    return events.sort((a, b) => a.eventNumber - b.eventNumber);
}

// 3. Main Router Function
function parseFullPDFData(fullText) {
    // STEP 1: PRE-PROCESS
    const cleanedText = cleanRawText(fullText);
    
    // STEP 2: EXTRACT BASIC INFO
    const basicInfo = extractBasicInfo(cleanedText);
    
    let eventsList = [];
    
    // STEP 3: DETECT FORMAT AND PARSE
    if (cleanedText.includes('","') && cleanedText.match(/"(\d{1,3})/)) {
        console.log("✅ Document Type: B (Three-Column Quoted Table)");
        eventsList = parseEvents_TypeB(cleanedText);
    } 
    else if (cleanedText.match(/\d{1,3}\s*-\s*\d{1,3}/)) {
        console.log("✅ Document Type: A (Hyphenated Pairs)");
        eventsList = parseEvents_TypeA(cleanedText);
    } 
    else {
        console.error("❌ Unknown document format");
    }
    
    return {
        ...basicInfo,
        events: eventsList
    };
}

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseFullPDFData,
        cleanRawText,
        extractStroke,
        normalizeStroke,
        extractBasicInfo,
        parseEvents_TypeA,
        parseEvents_TypeB,
        STROKE_MAP
    };
}
