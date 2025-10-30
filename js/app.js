class SwimMeetApp {
    constructor() {
        this.configManager = new ConfigManager();
        this.pdfLoader = new PDFLoader();
        this.pdfAnalyzer = new PDFAnalyzer();
        this.jsonEditor = new JSONEditor();
        this.aiParser = null;
        this.currentPDFText = null;
        
        this.initializeEventListeners();
        this.checkAPIKey();
    }

    initializeEventListeners() {
        // API Key Management
        document.getElementById('api-key-input').addEventListener('input', (e) => {
            this.configManager.saveAPIKey(e.target.value);
        });

        // File Upload
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('pdf-input');

        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // Action Buttons
        document.getElementById('analyze-btn').addEventListener('click', () => this.analyzePDF());
        document.getElementById('parse-btn').addEventListener('click', () => this.parsePDF());
        document.getElementById('export-btn').addEventListener('click', () => this.exportJSON());
        document.getElementById('copy-json-btn').addEventListener('click', () => this.copyJSON());
        
        // Debug Toggle
        document.getElementById('toggle-debug-btn').addEventListener('click', () => this.toggleDebug());
    }

    checkAPIKey() {
        const apiKey = this.configManager.getAPIKey();
        const apiKeyInput = document.getElementById('api-key-input');
        const apiStatus = document.getElementById('api-status');
        
        if (apiKey) {
            apiKeyInput.value = apiKey;
            apiStatus.textContent = '✅ API key configured';
            apiStatus.className = 'status-success';
        } else {
            apiStatus.textContent = '⚠️ Please enter your DeepSeek API key';
            apiStatus.className = 'status-warning';
        }
    }

    async handleFileSelect(file) {
        const fileInfo = document.getElementById('file-info');
        const actionsSection = document.getElementById('actions-section');
        
        try {
            fileInfo.innerHTML = `
                <p>📄 Selected: <strong>${file.name}</strong></p>
                <p>Size: ${(file.size / 1024).toFixed(2)} KB</p>
                <p class="loading">⏳ Loading PDF...</p>
            `;

            this.currentPDFText = await this.pdfLoader.extractTextFromPDF(file);
            
            fileInfo.innerHTML = `
                <p>✅ <strong>${file.name}</strong> loaded successfully</p>
                <p>Size: ${(file.size / 1024).toFixed(2)} KB</p>
            `;
            
            actionsSection.hidden = false;
            
        } catch (error) {
            fileInfo.innerHTML = `<p class="error">❌ Error: ${error.message}</p>`;
        }
    }

    async analyzePDF() {
        if (!this.currentPDFText) {
            alert('Please upload a PDF first');
            return;
        }

        const analysisResult = this.pdfAnalyzer.analyze(this.currentPDFText);
        const analysisSection = document.getElementById('analysis-section');
        const analysisDetails = document.getElementById('analysis-details');

        analysisDetails.innerHTML = `
            <h3>📊 PDF Analysis</h3>
            <div class="analysis-grid">
                <div class="analysis-item">
                    <strong>Total Pages:</strong> ${analysisResult.totalPages}
                </div>
                <div class="analysis-item">
                    <strong>Total Characters:</strong> ${analysisResult.totalChars.toLocaleString()}
                </div>
                <div class="analysis-item">
                    <strong>Estimated Chunks:</strong> ${analysisResult.estimatedChunks}
                </div>
            </div>
            
            <h4>Pages with Events:</h4>
            <ul>
                ${analysisResult.pagesWithEvents.map(p => 
                    `<li>Page ${p.pageNum}: ${p.eventCount} events detected</li>`
                ).join('')}
            </ul>
            
            <h4>Content Preview (First 500 chars):</h4>
            <pre class="preview">${analysisResult.preview}</pre>
        `;

        analysisSection.hidden = false;
        analysisSection.scrollIntoView({ behavior: 'smooth' });
    }

    async parsePDF() {
        const apiKey = this.configManager.getAPIKey();
        if (!apiKey) {
            alert('Please enter your DeepSeek API key first');
            return;
        }

        if (!this.currentPDFText) {
            alert('Please upload a PDF first');
            return;
        }

        const parseBtn = document.getElementById('parse-btn');
        parseBtn.disabled = true;
        parseBtn.textContent = '⏳ Parsing...';

        try {
            this.aiParser = new DeepSeekParser(apiKey);
            const result = await this.aiParser.parseMeetPDF(this.currentPDFText);
            
            // Store debug log globally
            window.parserDebugLog = result.debugLog;
            
            this.showResults(result);
            
        } catch (error) {
            alert(`Parsing error: ${error.message}`);
        } finally {
            parseBtn.disabled = false;
            parseBtn.textContent = '🚀 Parse PDF';
        }
    }

    showResults(result) {
        const resultsSection = document.getElementById('results-section');
        const eventsCount = document.getElementById('events-count');

        let meetInfoHtml = '';
        if (result.meetInfo) {
            meetInfoHtml = `<br>📋 Meet: ${result.meetInfo.name}`;
            if (result.meetInfo.date) {
                meetInfoHtml += ` (${result.meetInfo.date})`;
            }
            if (result.meetInfo.maxEventsPerDay) {
                meetInfoHtml += `<br>📊 Max Events Per Day: ${result.meetInfo.maxEventsPerDay}`;
            }
            if (result.meetInfo.maxTotalEvents) {
                meetInfoHtml += `<br>📊 Max Total Events: ${result.meetInfo.maxTotalEvents}`;
            }
            if (result.meetInfo.maxSessions) {
                meetInfoHtml += `<br>📊 Max Sessions: ${result.meetInfo.maxSessions}`;
            }
        }

        eventsCount.innerHTML = `
            ✅ Found <strong>${result.events.length}</strong> events
            ${meetInfoHtml}
        `;
        
        this.jsonEditor.renderEditableTable(result.events);

        resultsSection.hidden = false;
        
        // Render debug log
        this.renderDebugLog();
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    toggleDebug() {
        const debugPanel = document.getElementById('debug-panel');
        debugPanel.hidden = !debugPanel.hidden;
        
        const btn = document.getElementById('toggle-debug-btn');
        btn.textContent = debugPanel.hidden ? '🔍 Show Debug Log' : '🔍 Hide Debug Log';
    }

    renderDebugLog() {
        const debugContent = document.getElementById('debug-content');
        
        if (!window.parserDebugLog || window.parserDebugLog.length === 0) {
            debugContent.innerHTML = '<p>No debug information available</p>';
            return;
        }

        const logHtml = window.parserDebugLog.map(entry => {
            const typeClass = entry.type === 'error' ? 'log-error' : 
                            entry.type === 'success' ? 'log-success' : 'log-info';
            return `<div class="log-entry ${typeClass}">[${entry.timestamp}] ${entry.message}</div>`;
        }).join('');

        debugContent.innerHTML = logHtml;
    }

    exportJSON() {
        const events = this.jsonEditor.getEvents();
        const json = JSON.stringify(events, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'swim-meet-events.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    copyJSON() {
        const events = this.jsonEditor.getEvents();
        const json = JSON.stringify(events, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            const btn = document.getElementById('copy-json-btn');
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SwimMeetApp();
});