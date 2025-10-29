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
