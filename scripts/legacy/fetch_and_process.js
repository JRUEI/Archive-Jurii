const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const episodesDir = path.join(__dirname, 'content', 'episodes');
const glossaryPath = path.join(__dirname, 'content', 'glossary.json');
const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));

// Helper to clean VTT auto-captions (removes duplicated scrolling text and tags)
function cleanVtt(vttContent) {
  const lines = vttContent.split('\n');
  const cleanedLines = [];
  let lastText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match timestamp line
    const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2})\.\d{3}\s*-->/);
    if (timeMatch) {
      const time = timeMatch[1];
      let textLine = '';
      let j = i + 1;
      // Read lines until empty line (end of cue)
      while (j < lines.length && lines[j].trim() !== '') {
        textLine += lines[j] + ' ';
        j++;
      }
      
      // Strip <c> tags and other formatting
      textLine = textLine.replace(/<[^>]+>/g, '').trim();
      
      // Auto-captions repeat the same sentence as it builds up. We only want distinct phrases.
      // A simple heuristic: if the current text contains the last text, replace the last text.
      if (textLine && textLine !== lastText) {
          if (textLine.startsWith(lastText) && cleanedLines.length > 0) {
              // Update the last entry
              cleanedLines[cleanedLines.length - 1].text = textLine;
          } else {
              cleanedLines.push({ time, text: textLine });
          }
          lastText = textLine;
      }
      i = j; // skip processed lines
    }
  }

  // Format into Markdown [HH:MM:SS] [Speaker] Text
  return cleanedLines.map(c => `[${c.time}] [?] ${c.text}`).join('\n');
}

const files = fs.readdirSync(episodesDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const epId = file.replace('ep0', '').replace('.md', '');
  const filePath = path.join(episodesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Parse frontmatter to get YouTube URL
  const ytMatch = content.match(/youtube:\s*"([^"]+)"/);
  if (!ytMatch) continue;
  const ytUrl = ytMatch[1];

  let rawTranscript = '';

  // For episodes 1 to 7, fetch VTT if we don't have it
  if (parseInt(epId) >= 1 && parseInt(epId) <= 7) {
    const vttFile = path.join(__dirname, 'content', `ep0${epId}.ja.vtt`);
    
    if (!fs.existsSync(vttFile)) {
      console.log(`Downloading subtitles for Episode ${epId}...`);
      try {
        execSync(`yt-dlp --write-auto-subs --sub-lang ja --skip-download "${ytUrl}" -o "content/ep0${epId}.%(ext)s"`, { stdio: 'inherit' });
      } catch (err) {
        console.error(`Failed to download subtitles for Ep ${epId}:`, err.message);
        continue;
      }
    }

    if (fs.existsSync(vttFile)) {
      console.log(`Processing VTT for Episode ${epId}...`);
      const vttContent = fs.readFileSync(vttFile, 'utf8');
      rawTranscript = cleanVtt(vttContent);
      
      // Replace existing transcript or append
      if (content.includes('## 【完整逐字稿】')) {
          content = content.split('## 【完整逐字稿】')[0] + '## 【完整逐字稿】\n' + rawTranscript;
      } else {
          content += `\n\n## 【完整逐字稿】\n` + rawTranscript;
      }
    }
  }

  // Apply glossary corrections
  let correctedContent = content;

  // 1. Global
  for (const [wrong, right] of Object.entries(glossary.global)) {
    const regex = new RegExp(wrong, 'g');
    correctedContent = correctedContent.replace(regex, right);
  }

  // 2. Local
  if (glossary.episodes && glossary.episodes[epId]) {
    for (const [wrong, right] of Object.entries(glossary.episodes[epId])) {
      const regex = new RegExp(wrong, 'g');
      correctedContent = correctedContent.replace(regex, right);
    }
  }

  if (content !== correctedContent || rawTranscript) {
    fs.writeFileSync(filePath, correctedContent, 'utf8');
    console.log(`Episode ${epId} processed and saved!`);
  }
}
console.log("All tasks completed!");
