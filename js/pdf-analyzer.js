class PDFAnalyzer {
    constructor() {
        this.analysis = null;
    }

    async analyzePDF(pdfFile) {
        console.log('Starting PDF analysis...');
        
        // Extract text using existing PDFTextExtractor
        const extractor = new PDFTextExtractor();
        const fullText = await extractor.extractTextFromPDF(pdfFile);
        
        // Perform analysis
        this.analysis = {
            fileName: pdfFile.name,
            fileSize: pdfFile.size,
            fileSizeMB: (pdfFile.size / 1024 / 1024).toFixed(2),
            totalCharacters: fullText.length,
            pages: this.analyzePages(fullText),
            events: this.detectEvents(fullText),
            chunkEstimates: this.estimateChunks(fullText.length),
            contentQuality: this.assessContentQuality(fullText)
        };
        
        return this.analysis;
    }

    analyzePages(pdfText) {
        const pages = pdfText.split(/PAGE \d+:/);
        const pageStats = [];
        
        for (let i = 1; i < pages.length; i++) {
            const page = pages[i].trim();
            const eventMatches = page.match(/event\s+\d+/gi) || [];
            const hasEventNumbers = eventMatches.length > 0;
            
            pageStats.push({
                pageNumber: i,
                characters: page.length,
                lines: page.split('\n').length,
                eventMatches: eventMatches.length,
                hasEvents: hasEventNumbers,
                preview: page.substring(0, 100).replace(/\s+/g, ' ')
            });
        }
        
        return {
            total: pageStats.length,
            details: pageStats,
            totalChars: pageStats.reduce((sum, p) => sum + p.characters, 0),
            avgCharsPerPage: Math.round(pageStats.reduce((sum, p) => sum + p.characters, 0) / pageStats.length),
            pagesWithEvents: pageStats.filter(p => p.hasEvents).length
        };
    }

    detectEvents(pdfText) {
        // Match various event number patterns
        const eventPatterns = [
            /event\s+(\d+)/gi,
            /^(\d+)\s+[FM]/gm,  // "123 F" or "123 M" at start of line
            /^(\d+)\s+\d+&/gm   // "123 10&Under" pattern
        ];
        
        const eventNumbers = new Set();
        
        for (const pattern of eventPatterns) {
            const matches = pdfText.matchAll(pattern);
            for (const match of matches) {
                const num = parseInt(match[1]);
                if (num > 0 && num < 1000) {  // Reasonable event number range
                    eventNumbers.add(num);
                }
            }
        }
        
        const sortedEvents = Array.from(eventNumbers).sort((a, b) => a - b);
        
        return {
            total: sortedEvents.length,
            eventNumbers: sortedEvents,
            range: sortedEvents.length > 0 ? {
                min: sortedEvents[0],
                max: sortedEvents[sortedEvents.length - 1]
            } : null,
            gaps: this.findGaps(sortedEvents)
        };
    }

    findGaps(sortedEvents) {
        const gaps = [];
        for (let i = 0; i < sortedEvents.length - 1; i++) {
            const diff = sortedEvents[i + 1] - sortedEvents[i];
            if (diff > 1) {
                gaps.push({
                    after: sortedEvents[i],
                    before: sortedEvents[i + 1],
                    size: diff - 1
                });
            }
        }
        return gaps;
    }

    estimateChunks(totalChars) {
        const configs = [
            { size: 8000, name: 'Large' },
            { size: 5000, name: 'Medium' },
            { size: 3000, name: 'Small (current)' },
            { size: 2000, name: 'Very Small' }
        ];
        
        const estimates = [];
        
        for (const config of configs) {
            const overlapPercent = 0.10;
            const overlapSize = Math.floor(config.size * overlapPercent);
            const stepSize = config.size - overlapSize;
            
            let chunks = 0;
            let position = 0;
            
            while (position < totalChars) {
                chunks++;
                position += stepSize;
                if (position >= totalChars) break;
            }
            
            estimates.push({
                name: config.name,
                chunkSize: config.size,
                overlapSize: overlapSize,
                stepSize: stepSize,
                estimatedChunks: chunks,
                avgEventsPerChunk: null  // Will calculate after knowing total events
            });
        }
        
        return estimates;
    }

    assessContentQuality(pdfText) {
        const issues = [];
        
        // Check for common extraction issues
        if (pdfText.length < 5000) {
            issues.push('⚠️ Very short text - PDF may have extraction issues');
        }
        
        const specialCharRatio = (pdfText.match(/[^\x20-\x7E\n]/g) || []).length / pdfText.length;
        if (specialCharRatio > 0.2) {
            issues.push('⚠️ High special character ratio - may indicate encoding issues');
        }
        
        const words = pdfText.split(/\s+/).filter(w => w.length > 0);
        const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
        if (avgWordLength > 15) {
            issues.push('⚠️ Very long average word length - may indicate merged text');
        }
        
        const hasPageMarkers = /PAGE \d+:/.test(pdfText);
        if (!hasPageMarkers) {
            issues.push('⚠️ No page markers found');
        }
        
        return {
            quality: issues.length === 0 ? '✅ Good' : '⚠️ Has Issues',
            issues: issues,
            stats: {
                totalWords: words.length,
                avgWordLength: avgWordLength.toFixed(1),
                specialCharPercent: (specialCharRatio * 100).toFixed(1)
            }
        };
    }

    generateReport() {
        if (!this.analysis) {
            return 'No analysis available. Run analyzePDF() first.';
        }
        
        const a = this.analysis;
        
        return `
📊 PDF ANALYSIS REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 FILE INFO:
   Name: ${a.fileName}
   Size: ${a.fileSizeMB} MB
   Total Characters: ${a.totalCharacters.toLocaleString()}

📁 PAGE ANALYSIS:
   Total Pages: ${a.pages.total}
   Pages with Events: ${a.pages.pagesWithEvents}
   Avg Chars/Page: ${a.pages.avgCharsPerPage}
   Total Content Chars: ${a.pages.totalChars.toLocaleString()}

🏊 EVENT DETECTION:
   Detected Events: ${a.events.total}
   Event Range: ${a.events.range ? `${a.events.range.min} - ${a.events.range.max}` : 'N/A'}
   ${a.events.gaps.length > 0 ? `Gaps Found: ${a.events.gaps.length} gaps` : 'No gaps detected'}

🔧 CHUNK ESTIMATES:
${a.chunkEstimates.map(c => `   ${c.name}: ${c.estimatedChunks} chunks (${c.chunkSize} chars, step: ${c.stepSize})`).join('\n')}

✨ CONTENT QUALITY: ${a.contentQuality.quality}
${a.contentQuality.issues.length > 0 ? '   Issues:\n   ' + a.contentQuality.issues.join('\n   ') : '   No issues detected'}
   
   Stats:
   • Words: ${a.contentQuality.stats.totalWords.toLocaleString()}
   • Avg Word Length: ${a.contentQuality.stats.avgWordLength} chars
   • Special Chars: ${a.contentQuality.stats.specialCharPercent}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMMENDATIONS:
${this.generateRecommendations()}
        `.trim();
    }

    generateRecommendations() {
        const a = this.analysis;
        const recommendations = [];
        
        if (a.events.total > 100) {
            recommendations.push('• Use Small (3000) or Very Small (2000) chunks for best coverage');
        } else if (a.events.total > 50) {
            recommendations.push('• Small (3000) chunks should work well');
        } else {
            recommendations.push('• Medium (5000) or Large (8000) chunks are sufficient');
        }
        
        if (a.events.gaps.length > 5) {
            recommendations.push('• Many event gaps detected - verify event numbering in source PDF');
        }
        
        const eventsPerPage = a.events.total / a.pages.pagesWithEvents;
        if (eventsPerPage > 20) {
            recommendations.push('• High event density - smaller chunks recommended');
        }
        
        if (a.contentQuality.issues.length > 0) {
            recommendations.push('• Content quality issues detected - check PDF text extraction');
        }
        
        const currentConfig = a.chunkEstimates.find(c => c.name === 'Small (current)');
        if (currentConfig) {
            const eventsPerChunk = a.events.total / currentConfig.estimatedChunks;
            recommendations.push(`• Expected ~${eventsPerChunk.toFixed(1)} events per chunk with current settings`);
        }
        
        return recommendations.length > 0 ? recommendations.join('\n') : '• Current settings look good!';
    }

    getDetailedPageBreakdown() {
        if (!this.analysis) return [];
        
        return this.analysis.pages.details.map(page => ({
            page: page.pageNumber,
            chars: page.characters,
            events: page.eventMatches,
            preview: page.preview
        }));
    }

    exportJSON() {
        return JSON.stringify(this.analysis, null, 2);
    }
}
