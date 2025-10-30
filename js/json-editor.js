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
