const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '../content/episodes/ep01.md');
const translationPath = path.join(__dirname, '../scratch/ep01_full_translated.md');

let mdContent = fs.readFileSync(mdPath, 'utf8');
const translationContent = fs.readFileSync(translationPath, 'utf8');

const marker = '## 【完整逐字稿】\n';
const markerIndex = mdContent.indexOf('## 【完整逐字稿】');

if (markerIndex !== -1) {
    const newContent = mdContent.substring(0, markerIndex + marker.length) + '\n' + translationContent;
    fs.writeFileSync(mdPath, newContent, 'utf8');
    console.log('Updated ep01.md with full translation.');
} else {
    // If the marker doesn't exist, append it.
    const newContent = mdContent + '\n' + marker + '\n' + translationContent;
    fs.writeFileSync(mdPath, newContent, 'utf8');
    console.log('Appended marker and translation to ep01.md.');
}
