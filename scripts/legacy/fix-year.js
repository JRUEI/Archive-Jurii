const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'content', 'episodes');

fs.readdirSync(dir).filter(f => f.endsWith('.md')).forEach(file => {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/date:\s*"2024-/g, 'date: "2026-');
  fs.writeFileSync(p, content, 'utf8');
  console.log(`Updated ${file}`);
});
