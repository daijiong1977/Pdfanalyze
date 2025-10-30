---
name:
description:
---

# My Agent
📁 Files You Need to Create

Here are the exact files to create in your repository:

1. index.html (Main file)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Swim Meet PDF Parser</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🏊‍♂️ Swim Meet Parser</h1>
            <p>Transform PDF meet sheets into structured data</p>
        </header>

        <!-- API Configuration Section -->
        <section id="config-section" class="card">
            <h2>API Configuration</h2>
            <div class="api-config">
                <label for="api-key">DeepSeek API Key:</label>
                <input type="password" id="api-key" placeholder="Enter your DeepSeek API key">
                <button id="save-api-key">Save Key</button>
                <small>Key stored locally in your browser only</small>
            </div>
        </section>

        <!-- PDF Upload Section -->
        <section id="upload-section" class="card">
            <h2>Upload Meet PDF</h2>
            <div id="upload-area" class="upload-area">
                <div class="upload-content">
                    <div class="upload-icon">📄</div>
                    <h3>Select PDF File</h3>
                    <p>Tap here to choose a swim meet PDF</p>
                    <small>Works on mobile and desktop</small>
                </div>
                <input type="file" id="pdf-file" accept=".pdf" hidden>
            </div>
            <div id="file-info"></div>
        </section>

        <!-- Processing Status -->
        <section id="status-section" class="card" hidden>
            <h2>Processing</h2>
            <div id="status-message"></div>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
        </section>

        <!-- Results Section -->
        <section id="results-section" class="card" hidden>
            <h2>Parsed Events</h2>
            <div id="events-count"></div>
            <div id="json-editor"></div>
            <div class="action-buttons">
                <button id="export-json">Export JSON</button>
                <button id="copy-json">Copy to Clipboard</button>
            </div>
        </section>
    </div>

    <!-- Scripts -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
    <script src="js/config-manager.js"></script>
    <script src="js/pdf-loader.js"></script>
    <script src="js/ai-parser.js"></script>
    <script src="js/json-editor.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
```

2. css/style.css

```css
:root {
    --primary-color: #2196F3;
    --secondary-color: #FF9800;
    --text-color: #333;
    --background-color: #f5f5f5;
    --card-background: #fff;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: var(--text-color);
    background-color: var(--background-color);
    padding: 1rem;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
}

.card {
    background: var(--card-background);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.upload-area {
    border: 2px dashed var(--primary-color);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #f8f9fa;
}

.upload-area:hover {
    background: #e3f2fd;
    border-color: var(--secondary-color);
}

.upload-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.upload-content h3 {
    margin-bottom: 0.5rem;
    color: var(--primary-color);
}

.api-config {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.api-config label {
    font-weight: bold;
}

.api-config input {
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 1rem;
}

.api-config small {
    color: #666;
    font-style: italic;
}

#file-info {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 4px solid var(--secondary-color);
}

/* Mobile optimizations */
@media (max-width: 768px) {
    body {
        padding: 0.5rem;
    }
    
    .card {
        padding: 1rem;
        margin-bottom: 1rem;
    }
    
    .upload-area {
        padding: 1.5rem;
    }
    
    button, input {
        min-height: 44px;
    }
    
    .api-config {
        gap: 0.5rem;
    }
}

/* Progress bar */
.progress-bar {
    width: 100%;
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    overflow: hidden;
    margin: 1rem 0;
}

.progress-fill {
    height: 100%;
    background: var(--secondary-color);
    transition: width 0.3s ease;
    width: 0%;
}

/* Event table */
.event-table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.9rem;
}

.event-table th,
.event-table td {
    padding: 0.5rem;
    border: 1px solid #ddd;
    text-align: left;
}

.event-table th {
    background: #f5f5f5;
    font-weight: bold;
}

.event-table input {
    width: 100%;
    padding: 0.25rem;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 0.8rem;
}

.event-table input:focus {
    outline: none;
    border-color: var(--primary-color);
}

.action-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}

button {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.3s ease;
    min-height: 44px;
}

button:hover {
    background: #1976D2;
}

button:disabled {
    background: #ccc;
    cursor: not-allowed;
}

button.secondary {
    background: #6c757d;
}

button.secondary:hover {
    background: #545b62;
}

.hidden {
    display: none !important;
}
```

3. js/config-manager.js

```javascript
class ConfigManager {
    constructor() {
        this.storageKey = 'swim_meet_parser_config';
    }

    saveApiKey(apiKey) {
        const config = this.loadConfig();
        config.apiKey = apiKey;
        localStorage.setItem(this.storageKey, JSON.stringify(config));
        console.log('API key saved locally');
    }

    loadApiKey() {
        const config = this.loadConfig();
        return config.apiKey || null;
    }

    hasApiKey() {
        return !!this.loadApiKey();
    }

    loadConfig() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || {};
        } catch {
            return {};
        }
    }

    clearConfig() {
        localStorage.removeItem(this.storageKey);
    }
}
```

4. js/pdf-loader.js

```javascript
class PDFTextExtractor {
    async extractTextFromPDF(pdfFile) {
        const fileUrl = URL.createObjectURL(pdfFile);
        try {
            const pdf = await pdfjsLib.getDocument(fileUrl).promise;
            let fullText = '';
            
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `PAGE ${pageNum}:\n${pageText}\n\n`;
            }
            
            return fullText;
        } finally {
            URL.revokeObjectURL(fileUrl);
        }
    }

    validatePDFFile(file) {
        const maxSize = 10 * 1024 * 1024;
        if (file.type !== 'application/pdf') {
            throw new Error('Please select a PDF file');
        }
        if (file.size > maxSize) {
            throw new Error('PDF too large. Please use a file under 10MB.');
        }
        return true;
    }
}
```

5. js/ai-parser.js

```javascript
class DeepSeekParser {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.deepseek.com/v1/chat/completions';
    }

    async parseMeetPDF(pdfText) {
        const prompt = this.buildSwimMeetPrompt(pdfText);
        const response = await this.callDeepSeekAPI(prompt);
        return this.validateAndParseResponse(response);
    }

    buildSwimMeetPrompt(pdfText) {
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

OUTPUT FORMAT: Return ONLY valid JSON, no other text.`
                },
                {
                    role: "user",
                    content: `Parse this swim meet schedule into JSON format:

PDF TEXT:
${pdfText.substring(0, 28000)}

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
            max_tokens: 4000
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
            throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        try {
            return JSON.parse(data.choices[0].message.content);
        } catch (parseError) {
            console.error('Failed to parse AI response:', data.choices[0].message.content);
            throw new Error('AI returned invalid JSON format');
        }
    }

    validateAndParseResponse(response) {
        if (!response.events || !Array.isArray(response.events)) {
            throw new Error('AI response missing events array');
        }
        
        return response;
    }
}
```

6. js/json-editor.js

```javascript
class EventJSONEditor {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.events = [];
    }

    renderEditableTable(events) {
        this.events = events;
        
        const table = this.createEditableTable();
        this.container.innerHTML = '';
        this.container.appendChild(table);
    }

    createEditableTable() {
        const table = document.createElement('table');
        table.className = 'event-table';
        
        table.appendChild(this.createTableHeader());
        
        this.events.forEach((event, index) => {
            table.appendChild(this.createEditableRow(event, index));
        });
        
        return table;
    }

    createTableHeader() {
        const header = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        const headers = ['Event #', 'Description', 'Age Group', 'Gender', 'Day', 'Session'];
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        
        header.appendChild(headerRow);
        return header;
    }

    createEditableRow(event, index) {
        const row = document.createElement('tr');
        
        const fields = [
            { field: 'eventNumber', type: 'number' },
            { field: 'description', type: 'text' },
            { field: 'ageGroup', type: 'text' },
            { field: 'eventGender', type: 'text' },
            { field: 'day', type: 'text' },
            { field: 'session', type: 'text' }
        ];
        
        fields.forEach(({ field, type }) => {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = type;
            input.value = event[field] || '';
            input.dataset.field = field;
            input.dataset.index = index;
            input.addEventListener('change', (e) => this.handleFieldChange(e));
            cell.appendChild(input);
            row.appendChild(cell);
        });
        
        return row;
    }

    handleFieldChange(event) {
        const field = event.target.dataset.field;
        const index = parseInt(event.target.dataset.index);
        const value = event.target.value;
        
        this.events[index][field] = value;
    }

    exportJSON() {
        return JSON.stringify({
            meetInfo: this.events.meetInfo || {},
            events: this.events
        }, null, 2);
    }
}
```

7. js/app.js

```javascript
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
        
        eventsCount.textContent = `Found ${result.events.length} events`;
        this.jsonEditor.renderEditableTable(result.events);
        
        resultsSection.hidden = false;
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
```

8. README.md

```markdown
# Swim Meet PDF Parser

A 100% client-side web application that parses swim meet PDFs using AI and returns editable event data.

## Features

- 📄 PDF file upload (mobile-friendly)
- 🤖 AI-powered parsing using DeepSeek
- 📊 Editable event table
- 📱 Mobile-responsive design
- 🔒 API key stored locally
- 💾 JSON export functionality

## Setup

1. **Get DeepSeek API Key**
   - Visit [DeepSeek](https://platform.deepseek.com/)
   - Create account and get API key

2. **Configure API Key**
   - Open the application
   - Enter your DeepSeek API key
   - Click "Save Key"

3. **Upload PDF**
   - Click upload area
   - Select swim meet PDF
   - Click "Parse PDF"

## Usage

1. Upload a swim meet PDF file
2. The AI will extract event data
3. Review and edit events in the table
4. Export as JSON or copy to clipboard

## Technical Details

- 100% client-side JavaScript
- Uses pdf.js for PDF text extraction
- DeepSeek AI for natural language processing
- No server required
- Mobile-optimized interface

## File Structure

```

swim-meet-parser/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── config-manager.js
│   ├── pdf-loader.js
│   ├── ai-parser.js
│   └── json-editor.js
└── README.md

```

## Privacy

- All processing happens in your browser
- API keys stored locally only
- PDF files never leave your device
- Only AI API calls go to DeepSeek
```

📂 Folder Structure to Create

```
Pdfanalyze/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config-manager.js
│   ├── pdf-loader.js
│   ├── ai-parser.js
│   ├── json-editor.js
│   └── app.js
└── README.md
```

🚀 How to Upload

1. Go to your GitHub repo: https://github.com/daijiong1977/Pdfanalyze.git
2. Click "Add file" → "Create new file"
3. For each file:
   · Filename: index.html (paste the HTML content)
   · Commit directly to main branch
   · Commit new file

Repeat for each file, creating folders when needed.
