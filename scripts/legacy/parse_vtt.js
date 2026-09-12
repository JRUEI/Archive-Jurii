const fs = require('fs');

const vttContent = fs.readFileSync('content/ep01.ja.vtt', 'utf8');
const lines = vttContent.split('\n');

let cleanLines = [];
let prevCleanLine = "";
let currentTimestamp = "";

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  if (line.includes('-->')) {
    currentTimestamp = line.split('-->')[0].trim().substring(0, 8); // e.g., 00:00:05
  } else if (line !== '' && !line.startsWith('WEBVTT') && !line.startsWith('Kind:') && !line.startsWith('Language:')) {
    // Strip tags
    let text = line.replace(/<[^>]+>/g, '');
    
    if (text !== prevCleanLine) {
        cleanLines.push(`[${currentTimestamp}] ${text}`);
        prevCleanLine = text;
    }
  }
}

// deduplicate more aggressively if needed
let finalLines = [];
let lastAddedText = "";
for (let entry of cleanLines) {
    let text = entry.substring(11);
    if (text !== lastAddedText) {
        // often youtube repeats the exact same line, but sometimes it is a substring
        // skip if text is just empty space
        if (text.trim().length === 0) continue;
        
        // if the new text is basically the same as last text, skip
        if (lastAddedText.includes(text) && text.length > 2) {
            continue;
        }
        
        finalLines.push(entry);
        lastAddedText = text;
    }
}

fs.writeFileSync('scratch/ep01_parsed.txt', finalLines.join('\n'));
console.log('Parsed to scratch/ep01_parsed.txt. Total lines:', finalLines.length);
