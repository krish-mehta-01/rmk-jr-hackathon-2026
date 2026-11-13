const fs = require('fs');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const lines = html.split('\n');
lines.forEach((line, i) => {
  if (line.includes('id="modal-')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});

