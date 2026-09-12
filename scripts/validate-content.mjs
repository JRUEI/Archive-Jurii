import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const episodesDirectory = path.join(projectRoot, "content", "episodes");
const glossaryPath = path.join(projectRoot, "content", "glossary.json");
const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];

function report(collection, file, message) {
  collection.push(`${file}: ${message}`);
}

function timestampToSeconds(timestamp) {
  const parts = timestamp.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;

  const [hours, minutes, seconds] =
    parts.length === 3 ? parts : [0, parts[0], parts[1]];

  if (minutes >= 60 && parts.length === 3) return null;
  if (seconds >= 60) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function validateEpisode(fileName) {
  const relativePath = path.join("content", "episodes", fileName);
  const fullPath = path.join(episodesDirectory, fileName);
  const parsed = matter(fs.readFileSync(fullPath, "utf8"));
  const id = fileName.replace(/\.md$/, "");

  if (!parsed.data.title || typeof parsed.data.title !== "string") {
    report(errors, relativePath, "front matter 缺少 title");
  }

  const date =
    parsed.data.date instanceof Date
      ? parsed.data.date.toISOString().slice(0, 10)
      : parsed.data.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    report(errors, relativePath, "front matter 的 date 必須是 YYYY-MM-DD");
  }

  // 檔名即時間碼（YYMMDD），必須與 front matter 的 date 一致
  if (!/^\d{6}$/.test(id)) {
    report(errors, relativePath, "檔名必須是 YYMMDD 形式的時間碼");
  } else if (typeof date === "string" && id !== date.slice(2).replace(/-/g, "")) {
    report(errors, relativePath, `檔名時間碼與 date（${date}）不符`);
  }

  if (!Number.isInteger(parsed.data.episode) || parsed.data.episode < 1) {
    report(errors, relativePath, "front matter 的 episode 必須是正整數");
  }

  // 首頁卡片的「簡述」那一面讀 abstract，是另外寫的條列，不會退回去撈【精簡總結】
  const abstract = parsed.data.abstract;
  if (!Array.isArray(abstract) || abstract.length === 0) {
    report(errors, relativePath, "front matter 缺少 abstract（卡片簡述用的條列）");
  } else if (abstract.length < 3 || abstract.length > 6) {
    report(errors, relativePath, `abstract 有 ${abstract.length} 點，應落在 3～6 點之間`);
  } else {
    abstract.forEach((point, index) => {
      if (typeof point !== "string" || point.trim() === "") {
        report(errors, relativePath, `abstract 第 ${index + 1} 點是空的`);
      } else if (point.length < 15 || point.length > 60) {
        report(errors, relativePath, `abstract 第 ${index + 1} 點長度 ${point.length} 字，應落在 15～60 之間`);
      }
    });
  }

  for (const section of ["精簡總結", "無損還原", "完整逐字稿"]) {
    if (!new RegExp(`^##\\s*【${section}】\\s*$`, "m").test(parsed.content)) {
      report(errors, relativePath, `缺少 ## 【${section}】`);
    }
  }

  const lines = parsed.content.split(/\r?\n/);

  // 每一段【無損還原】的標題底下、條列之前要有一段白話簡述，首頁卡片點開目錄那一面顯示的就是它
  const losslessHeading = lines.findIndex((line) =>
    /^##\s*【無損還原】\s*$/.test(line),
  );
  if (losslessHeading !== -1) {
    for (let index = losslessHeading + 1; index < lines.length; index += 1) {
      if (/^##\s/.test(lines[index])) break;
      if (!/^###\s/.test(lines[index])) continue;

      const heading = lines[index].replace(/^###\s*/, "").trim();
      let cursor = index + 1;
      while (cursor < lines.length && lines[cursor].trim() === "") cursor += 1;
      const brief = cursor < lines.length ? lines[cursor].trim() : "";

      if (!brief || /^[*\->#]/.test(brief)) {
        report(
          errors,
          relativePath,
          `段落「${heading}」缺少簡述（標題底下、條列之前的那一段白話）`,
        );
      } else if (brief.length < 30 || brief.length > 80) {
        report(
          errors,
          relativePath,
          `段落「${heading}」的簡述長度 ${brief.length} 字，應落在 30～80 之間`,
        );
      }
    }
  }
  const transcriptHeading = lines.findIndex((line) =>
    /^##\s*【完整逐字稿】\s*$/.test(line),
  );
  if (transcriptHeading === -1) return 0;

  const transcriptPattern =
    /^\[(\d{1,3}:\d{2}(?::\d{2})?)\]\s*\[([^\]]+)\]\s*(.*)$/;
  const speakerlessPattern = /^\[(\d{1,3}:\d{2}(?::\d{2})?)\]\s*(.+)$/;
  const seen = new Set();
  const suspiciousSpeakers = new Set();
  let previousSeconds = -1;
  let parsedLines = 0;
  let speakerlessLines = 0;
  let emptyTextLines = 0;
  let duplicateLines = 0;
  let backwardsTimestamps = 0;
  let hasHost = false;

  for (let index = transcriptHeading + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    const match = line.match(transcriptPattern);
    const speakerlessMatch = line.match(speakerlessPattern);
    if (!match && !speakerlessMatch) {
      report(errors, relativePath, `第 ${index + 1} 行不是可解析的逐字稿列`);
      continue;
    }

    const timestamp = (match || speakerlessMatch)[1];
    const seconds = timestampToSeconds(timestamp);
    if (seconds === null) {
      report(errors, relativePath, `第 ${index + 1} 行的時間碼無效：${timestamp}`);
    } else {
      if (seconds < previousSeconds) backwardsTimestamps += 1;
      previousSeconds = seconds;
    }

    if (!match) {
      speakerlessLines += 1;
      continue;
    }

    parsedLines += 1;
    const [, , speaker, text] = match;
    if (!text.trim()) {
      emptyTextLines += 1;
    }
    if (speaker === "逢田珠里依") hasHost = true;
    if (
      speaker.includes("？") ||
      (speaker.startsWith("逢田珠里依") &&
        speaker !== "逢田珠里依" &&
        !/[＆&、/]/.test(speaker))
    ) {
      suspiciousSpeakers.add(speaker);
    }

    if (seen.has(line)) duplicateLines += 1;
    seen.add(line);
  }

  if (parsedLines === 0) {
    report(errors, relativePath, "完整逐字稿沒有任何可解析字幕");
  }
  if (!hasHost) {
    report(warnings, relativePath, "逐字稿找不到精確的主持人標籤 [逢田珠里依]");
  }
  if (speakerlessLines) {
    report(
      warnings,
      relativePath,
      `${speakerlessLines} 列沒有 speaker，目前網站不會顯示這些列`,
    );
  }
  if (emptyTextLines) {
    report(
      warnings,
      relativePath,
      `${emptyTextLines} 列只有 speaker／音效標籤，沒有額外文字`,
    );
  }
  if (duplicateLines) {
    report(warnings, relativePath, `${duplicateLines} 列逐字稿完全重複`);
  }
  if (backwardsTimestamps) {
    report(warnings, relativePath, `${backwardsTimestamps} 次時間倒退`);
  }
  if (suspiciousSpeakers.size) {
    report(
      warnings,
      relativePath,
      `可疑 speaker：${[...suspiciousSpeakers].join("、")}`,
    );
  }

  return parsedLines;
}

function validateGlossary() {
  let glossary;
  try {
    glossary = JSON.parse(fs.readFileSync(glossaryPath, "utf8"));
  } catch (error) {
    report(errors, "content/glossary.json", `JSON 無法解析：${error.message}`);
    return;
  }

  if (!glossary.global || typeof glossary.global !== "object") {
    report(errors, "content/glossary.json", "缺少 global 規則物件");
    return;
  }
  if (!glossary.episodes || typeof glossary.episodes !== "object") {
    report(errors, "content/glossary.json", "缺少 episodes 規則物件");
    return;
  }

  let noOpRules = 0;
  const groups = [
    ["global", glossary.global],
    ...Object.entries(glossary.episodes).map(([episode, rules]) => [
      `episodes.${episode}`,
      rules,
    ]),
  ];

  for (const [groupName, rules] of groups) {
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
      report(errors, "content/glossary.json", `${groupName} 必須是物件`);
      continue;
    }
    for (const [source, replacement] of Object.entries(rules)) {
      if (!source) {
        report(errors, "content/glossary.json", `${groupName} 含空白來源詞`);
      }
      if (typeof replacement !== "string" || !replacement) {
        report(
          errors,
          "content/glossary.json",
          `${groupName}.${source} 的替換值必須是非空字串`,
        );
      }
      if (source === replacement) noOpRules += 1;
    }
  }

  if (noOpRules) {
    report(
      warnings,
      "content/glossary.json",
      `${noOpRules} 條規則不會改變文字，dry-run 會略過`,
    );
  }
}

let episodeFiles = [];
if (!fs.existsSync(episodesDirectory)) {
  report(errors, "content/episodes", "資料夾不存在");
} else {
  episodeFiles = fs
    .readdirSync(episodesDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .sort();
}

if (!episodeFiles.length) {
  report(errors, "content/episodes", "找不到 Markdown 集數");
}

let transcriptLines = 0;
for (const fileName of episodeFiles) {
  try {
    transcriptLines += validateEpisode(fileName);
  } catch (error) {
    report(errors, path.join("content", "episodes", fileName), error.message);
  }
}
validateGlossary();

for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);

const failed = errors.length > 0 || (strict && warnings.length > 0);
const result = failed ? "failed" : "passed";
console.log(
  `Content validation ${result}: ${episodeFiles.length} episodes, ${transcriptLines} transcript lines, ${errors.length} errors, ${warnings.length} warnings.`,
);
if (strict && warnings.length) {
  console.error("Strict mode treats warnings as errors.");
}
process.exitCode = failed ? 1 : 0;
