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
│ └── style.css
├── js/
│ ├── app.js
│ ├── config-manager.js
│ ├── pdf-loader.js
│ ├── ai-parser.js
│ └── json-editor.js
└── README.md

```

## Privacy

- All processing happens in your browser
- API keys stored locally only
- PDF files never leave your device
- Only AI API calls go to DeepSeek
