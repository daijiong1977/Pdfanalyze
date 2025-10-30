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
    }loadSavedConfig() {
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
<br><button onclick="app.processPDF()">Parse PDF</button>
`;

} catch (error) {
alert(error.message);
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

this.showResults(result);

} catch (error) {
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

        eventsCount.innerHTML = `
            ✅ Found <strong>${result.events.length}</strong> events
            ${result.meetInfo ? `<br>📋 Meet: ${result.meetInfo.name}` : ''}
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
    }exportJSON() {
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
