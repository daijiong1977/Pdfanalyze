class SwimMeetParserApp {
    constructor() {
        this.configManager = new ConfigManager();
        this.pdfLoader = new PDFTextExtractor();
        this.jsonEditor = new EventJSONEditor('json-editor');
        this.currentPDFFile = null;

        this.initializeApp();
    }

    initializeApp() {
        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

        this.setupEventListeners();
        this.loadSavedConfig();
    }

    setupEventListeners() {
        document.getElementById('save-api-key').addEventListener('click', () => {
            this.saveApiKey();
        });

        document.getElementById('upload-area').addEventListener('click', () => {
            document.getElementById('pdf-file').click();
        });

        document.getElementById('pdf-file').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        document.getElementById('export-json').addEventListener('click', () => {
            this.exportJSON();
        });

        document.getElementById('copy-json').addEventListener('click', () => {
            this.copyToClipboard();
        });

        document.getElementById('toggle-debug').addEventListener('click', () => {
            this.toggleDebug();
        });

        document.getElementById('close-analysis').addEventListener('click', () => {
            document.getElementById('analysis-section').hidden = true;
        });
    }

    loadSavedConfig() {
        const apiKey = this.configManager.loadApiKey();
        if (apiKey) {
            document.getElementById('api-key').value = '••••••••••••••••';
        }
    }

    saveApiKey() {
        const apiKey = document.getElementById('api-key').value.trim();
        if (!apiKey) {
            alert('Please enter your DeepSeek API key');
            return;
        }

        this.configManager.saveApiKey(apiKey);
        alert('API key saved successfully!');
        document.getElementById('api-key').value = '••••••••••••••••';
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.pdfLoader.validatePDFFile(file);
            this.currentPDFFile = file;

            document.getElementById('file-info').innerHTML = `
                ✅ <strong>${file.name}</strong>
                (${(file.size / 1024 / 1024).toFixed(1)}MB)
                <br>
                <button onclick="app.analyzePDFFile()">📊 Analyze PDF</button>
                <button onclick="app.processPDF()">🚀 Parse PDF</button>
            `;
        } catch (error) {
            alert(error.message);
        }
    }

    async analyzePDFFile() {
        try {
            this.showStatus('Analyzing PDF...');

            const pdfText = await this.pdfLoader.extractText(this.currentPDFFile);
            const analyzer = new PDFAnalyzer();
            const report = analyzer.analyzePDF(pdfText);

            document.getElementById('analysis-report').textContent = report;
            document.getElementById('analysis-section').hidden = false;
            document.getElementById('status-section').hidden = true;
        } catch (error) {
            alert('Analysis failed: ' + error.message);
            this.hideStatus();
        }
    }

    async processPDF() {
        const apiKey = this.configManager.loadApiKey();
        if (!apiKey) {
            alert('Please save your DeepSeek API key first!');
            return;
        }

        if (!this.currentPDFFile) {
            alert('Please select a PDF file first!');
            return;
        }

        try {
            this.showStatus('Extracting text from PDF...');

            const pdfText = await this.pdfLoader.extractText(this.currentPDFFile);

            this.showStatus('Parsing events with AI...');

            const parser = new DeepSeekParser(apiKey);
            const result = await parser.parseMeetPDF(pdfText);

            this.showResults(result);

        } catch (error) {
            alert('Processing failed: ' + error.message);
            console.error(error);
            this.hideStatus();
        }
    }

    showStatus(message) {
        document.getElementById('status-message').textContent = message;
        document.getElementById('status-section').hidden = false;
    }

    hideStatus() {
        document.getElementById('status-section').hidden = true;
    }

    showResults(result) {
        this.hideStatus();

        // Build meet info HTML
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

        document.getElementById('events-count').innerHTML =
            `✅ Found ${result.events.length} events${meetInfoHtml}`;

        this.jsonEditor.renderTable(result.events);
        document.getElementById('results-section').hidden = false;

        // Store debug log
        this.currentDebugLog = result.debugLog || [];
    }

    exportJSON() {
        const events = this.jsonEditor.getEditedData();
        const jsonStr = JSON.stringify(events, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'swim-meet-events.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    copyToClipboard() {
        const events = this.jsonEditor.getEditedData();
        const jsonStr = JSON.stringify(events, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            alert('JSON copied to clipboard!');
        });
    }

    toggleDebug() {
        const debugSection = document.getElementById('debug-section');
        const button = document.getElementById('toggle-debug');

        if (debugSection.hidden) {
            this.renderDebugLog();
            debugSection.hidden = false;
            button.textContent = 'Hide Debug Log';
        } else {
            debugSection.hidden = true;
            button.textContent = 'Show Debug Log';
        }
    }

    renderDebugLog() {
        const debugLog = this.currentDebugLog || [];
        const debugHtml = debugLog.map(entry => {
            const className = entry.type === 'error' ? 'debug-error' :
                             entry.type === 'success' ? 'debug-success' :
                             entry.type === 'warning' ? 'debug-warning' : 'debug-info';
            return `<div class="debug-entry ${className}">[${entry.timestamp}] ${entry.message}</div>`;
        }).join('');

        document.getElementById('debug-log').innerHTML = debugHtml || '<p>No debug log available</p>';
    }
}

// Initialize app
const app = new SwimMeetParserApp();
