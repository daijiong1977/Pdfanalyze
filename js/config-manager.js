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
