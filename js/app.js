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

        document.getElementById('fetch-pdf-url').addEventListener('click', () => {
            this.fetchPDFFromURL();
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
    }    loadSavedConfig() {
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

    async fetchPDFFromURL() {
        const urlInput = document.getElementById('pdf-url');
        const url = urlInput.value.trim();

        if (!url) {
            alert('Please enter a PDF URL');
            return;
        }

        if (!url.toLowerCase().endsWith('.pdf')) {
            alert('URL must point to a PDF file (.pdf)');
            return;
        }

        this.showLoading('Fetching PDF from URL...');

        try {
            // Try direct fetch first
            let response;
            try {
                response = await fetch(url, { mode: 'cors' });
            } catch (corsError) {
                // If CORS fails, try with a CORS proxy
                this.updateStatus('Direct fetch blocked by CORS, trying proxy...');
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                response = await fetch(proxyUrl);
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            
            if (blob.type !== 'application/pdf' && !blob.type.includes('pdf')) {
                throw new Error('URL did not return a PDF file');
            }

            // Extract filename from URL
            const urlParts = url.split('/');
            const filename = urlParts[urlParts.length - 1] || 'downloaded.pdf';

            // Create a File object from the blob
            const file = new File([blob], filename, { type: 'application/pdf' });
            
            this.pdfLoader.validatePDFFile(file);
            this.currentPDFFile = file;

            document.getElementById('file-info').innerHTML = `
                ✅ <strong>${file.name}</strong>
                (${(file.size / 1024 / 1024).toFixed(1)}MB) - Fetched from URL
                <br>
                <button onclick="app.analyzePDFFile()">📊 Analyze PDF</button>
                <button onclick="app.processPDF()">🚀 Parse PDF</button>
            `;

            this.hideLoading();
            urlInput.value = ''; // Clear the URL input

        } catch (error) {
            console.error('Fetch error:', error);
            alert(`Failed to fetch PDF: ${error.message}\n\nTip: If CORS is blocking the request, try downloading the PDF and uploading it manually.`);
            this.hideLoading();
        }
    }

    async processPDF() {
if (!this.currentPDFFile) {
alert('Please select a PDF file first');
return;
}

const apiKey = this.configManager.loadApiKey();
if (!apiKey) {
alert('Please configure your DeepSeek API key first');
return;
}

this.showLoading('Extracting text from PDF...');

try {
        this.updateStatus('Reading PDF content...');
        const pdfText = await this.pdfLoader.extractTextFromPDF(this.currentPDFFile);

        this.updateStatus('Analyzing with AI...');
        const aiParser = new DeepSeekParser(apiKey);
        const result = await aiParser.parseMeetPDF(pdfText);

        this.showResults(result);} catch (error) {
console.error('Processing error:', error);
alert(`Error: ${error.message}`);
} finally {
this.hideLoading();
}
}

showLoading(message) {
const statusSection = document.getElementById('status-section');
const statusMessage = document.getElementById('status-message');

statusMessage.textContent = message;
statusSection.hidden = false;
document.getElementById('results-section').hidden = true;

// Animate progress bar
const progressFill = document.querySelector('.progress-fill');
progressFill.style.width = '30%';
}

updateStatus(message) {
document.getElementById('status-message').textContent = message;
const progressFill = document.querySelector('.progress-fill');
progressFill.style.width = '70%';
}

hideLoading() {
document.getElementById('status-section').hidden = true;
const progressFill = document.querySelector('.progress-fill');
progressFill.style.width = '0%';
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
            if (result.meetInfo.entryLimit) {
                meetInfoHtml += `<br>� Entry Limit: ${result.meetInfo.entryLimit}`;
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
        const debugSection = document.getElementById('debug-section');
        const toggleBtn = document.getElementById('toggle-debug');
        
        if (debugSection.hidden) {
            debugSection.hidden = false;
            toggleBtn.textContent = 'Hide Debug Log';
            debugSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            debugSection.hidden = true;
            toggleBtn.textContent = 'Show Debug Log';
        }
    }

    renderDebugLog() {
        const debugLog = window.parserDebugLog || [];
        const debugLogDiv = document.getElementById('debug-log');
        
        if (debugLog.length === 0) {
            debugLogDiv.innerHTML = '<div class="debug-entry">No debug information available.</div>';
            return;
        }
        
        let html = '';
        for (const entry of debugLog) {
            const typeClass = entry.type === 'chunk' ? 'debug-chunk-header' :
                             entry.type === 'error' ? 'debug-error' :
                             entry.type === 'response' ? 'debug-response' : '';
            
            html += `<div class="debug-entry ${typeClass}">`;
            html += `[${entry.timestamp}] ${this.escapeHtml(entry.message)}`;
            html += `</div>`;
        }
        
        debugLogDiv.innerHTML = html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async analyzePDFFile() {
        if (!this.currentPDFFile) {
            alert('Please select a PDF file first');
            return;
        }

        this.showLoading('Analyzing PDF structure...');

        try {
            const analyzer = new PDFAnalyzer();
            const analysis = await analyzer.analyzePDF(this.currentPDFFile);
            
            const report = analyzer.generateReport();
            
            document.getElementById('analysis-report').textContent = report;
            document.getElementById('analysis-section').hidden = false;
            document.getElementById('analysis-section').scrollIntoView({ behavior: 'smooth' });
            
            console.log('PDF Analysis:', analysis);
            console.log('Page Breakdown:', analyzer.getDetailedPageBreakdown());
            
        } catch (error) {
            console.error('Analysis error:', error);
            alert(`Analysis Error: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    exportJSON() {
const jsonData = this.jsonEditor.exportJSON();
const blob = new Blob([jsonData], { type: 'application/json' });
const url = URL.createObjectURL(blob);

const a = document.createElement('a');
a.href = url;
a.download = 'swim-meet-events.json';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);

URL.revokeObjectURL(url);
}

async copyToClipboard() {
const jsonData = this.jsonEditor.exportJSON();

try {
await navigator.clipboard.writeText(jsonData);
alert('JSON copied to clipboard!');
} catch (error) {
// Fallback for older browsers
const textArea = document.createElement('textarea');
textArea.value = jsonData;
document.body.appendChild(textArea);
textArea.select();
document.execCommand('copy');
document.body.removeChild(textArea);
alert('JSON copied to clipboard!');
}
}
}

let app;
document.addEventListener('DOMContentLoaded', () => {
app = new SwimMeetParserApp();
});
