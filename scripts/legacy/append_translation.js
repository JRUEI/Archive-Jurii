const fs = require('fs');
const content = fs.readFileSync('scratch/chunk_translated.txt', 'utf8');
fs.appendFileSync('scratch/ep01_full_translated.md', content + '\n');
console.log('Appended to scratch/ep01_full_translated.md');
