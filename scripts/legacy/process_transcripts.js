const fs = require('fs');
const path = require('path');

const episodesDir = path.join(__dirname, 'content', 'episodes');
const glossaryPath = path.join(__dirname, 'content', 'glossary.json');

// 讀取詞語庫
const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));

// 產生假造的「原始出錯聽寫」片段給 1~7 回作展示
const mockTranscripts = {
  "1": [
    "[00:00:00] 福島なの: 大家好！歡迎收聽第一回的春マト！我是福島なの。",
    "[00:00:15] 福島なの: 今天要用ラーミー來錄HMR喔！",
    "[00:01:20] 福島なの: 我平常很喜歡玩ルービックキューブ和ざとき。"
  ],
  "2": [
    "[00:00:00] 福島なの: こんまとぺ！今天有特別來賓 今泉リオラ！",
    "[00:00:20] 今泉リオラ: 嗨嗨！自從ウマ娘 プリティーダービー初舞台以來，我們チビコ組感情就超好呢。",
    "[00:01:05] 福島なの: 妳還送我一個超可愛的スノーピー呢！",
    "[00:01:45] 今泉リオラ: 後來玩海龜湯的腹痛い梗真的是笑死我了！"
  ],
  "3": [
    "[00:00:00] 福島なの: こんまとぺ！",
    "[00:00:15] 福島なの: 前幾天我和魔の水希一起去吃了好吃的蛋糕！"
  ],
  "4": [
    "[00:00:00] 福島なの: 哈囉！今天我們來進行ハルマトペ研究所吧！",
    "[00:05:22] 福島なの: 聽眾投稿的ふわっぱ感覺超可愛的！"
  ],
  "5": [
    "[00:00:00] 福島なの: 大家好，這裡是福島なの。",
    "[00:02:10] 福島なの: 今天要玩ウミガメのスープ喔！"
  ],
  "6": [
    "[00:00:00] 福島なの: 今天有很多福民的ふつおた寄過來呢！",
    "[00:10:00] 福島なの: 下次要不要找山田京奈和結月花一起來玩啊？"
  ],
  "7": [
    "[00:00:00] 福島なの: 大家好！我是福島！",
    "[00:05:00] 福島なの: 最近很迷チピチピチャパチャパ這個梗呢！"
  ]
};

// 處理所有的 Markdown 檔案
const files = fs.readdirSync(episodesDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const epId = file.replace('ep0', '').replace('.md', '');
  const filePath = path.join(episodesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 如果 1~7 尚未有逐字稿，先插入模擬的未校正版本
  if (parseInt(epId) >= 1 && parseInt(epId) <= 7) {
    if (!content.includes('## 【完整逐字稿】')) {
      content += `\n\n## 【完整逐字稿】\n`;
      content += mockTranscripts[epId].join('\n');
    }
  }

  // --- 校正邏輯 ---
  let correctedContent = content;

  // 1. 套用 Global 詞庫
  for (const [wrong, right] of Object.entries(glossary.global)) {
    // 為了避免重複替換或是部分匹配，使用正則表達式，但不加單詞邊界 (因為日文/中文通常不用)
    const regex = new RegExp(wrong, 'g');
    correctedContent = correctedContent.replace(regex, right);
  }

  // 2. 套用 Episode-Specific 詞庫
  if (glossary.episodes[epId]) {
    for (const [wrong, right] of Object.entries(glossary.episodes[epId])) {
      const regex = new RegExp(wrong, 'g');
      correctedContent = correctedContent.replace(regex, right);
    }
  }

  // 將結果寫回
  if (content !== correctedContent) {
    fs.writeFileSync(filePath, correctedContent, 'utf8');
    console.log(`Episode ${epId} corrected!`);
  } else {
    console.log(`Episode ${epId} - No corrections needed or processed.`);
  }
}
console.log("All episodes processed and corrected!");
