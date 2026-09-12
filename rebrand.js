const fs = require('fs');
const path = require('path');

const epDir = 'e:/Documents/Antigravity/Project_Testing/jurii-showroom/content/episodes';
if (fs.existsSync(epDir)) {
  const eps = fs.readdirSync(epDir);
  for (const ep of eps) {
    if (ep.endsWith('.md')) fs.unlinkSync(path.join(epDir, ep));
  }
}

fs.writeFileSync('e:/Documents/Antigravity/Project_Testing/jurii-showroom/content/glossary.json', JSON.stringify({global:{},episodes:{}}, null, 2));

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [search, replace] of replacements) {
    content = content.replaceAll(search, replace);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

const dir = 'e:/Documents/Antigravity/Project_Testing/jurii-showroom';

replaceInFile(path.join(dir, 'package.json'), [
  ['"name": "harumatope-wiki"', '"name": "jurii-showroom"']
]);

replaceInFile(path.join(dir, 'src/app/layout.tsx'), [
  ['『はるまとぺーじ』非官方逐字稿與資料庫', '逢田珠里依 SHOWROOM 非官方逐字稿與資料庫'],
  ['福嶋晴菜', '逢田珠里依']
]);

replaceInFile(path.join(dir, 'src/app/page.tsx'), [
  ['『はるまとぺーじ』', '逢田珠里依 SHOWROOM'],
  ['福嶋晴菜', '逢田珠里依']
]);

replaceInFile(path.join(dir, 'src/components/Header.tsx'), [
  ['『はるまとぺーじ』', '逢田珠里依 SHOWROOM']
]);

console.log('Cleanup and Rebranding complete!');
