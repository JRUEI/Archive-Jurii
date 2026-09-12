import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const dialoguePattern =
  /^Dialogue:\s*([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),(.*)$/;
const timecodePattern = /^\d+:\d{2}:\d{2}\.\d{2}$/;

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function parseDialogues(text) {
  return text.split(/\r?\n/).flatMap((raw, index) => {
    const match = raw.match(dialoguePattern);
    if (!match) return [];
    return [
      {
        lineNumber: index + 1,
        start: match[2].trim(),
        end: match[3].trim(),
        text: match[10],
      },
    ];
  });
}

function visibleLength(text) {
  const withoutTags = text.replace(/\{[^}]*\}/g, "").replace(/\\h/g, " ");
  return [...withoutTags].filter((character) => !/\s/u.test(character)).length;
}

function validate(sourceText, candidateText, strictLength) {
  const errors = [];
  const warnings = [];
  const source = parseDialogues(sourceText);
  const candidate = parseDialogues(candidateText);
  const sourceHasHeaders = /\[(?:Script Info|Events)\]/.test(sourceText);
  const candidateHasHeaders = /\[(?:Script Info|Events)\]/.test(candidateText);

  if (!source.length) errors.push("來源檔沒有 Dialogue 列");
  if (!candidate.length) errors.push("候選檔沒有 Dialogue 列");
  if (sourceHasHeaders !== candidateHasHeaders) {
    errors.push("候選檔新增或移除了 ASS 標頭");
  }
  if (!sourceHasHeaders) {
    const extraLines = candidateText
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith("Dialogue:"));
    if (extraLines.length) {
      errors.push("來源沒有 ASS 標頭時，候選檔只能包含 Dialogue 列");
    }
  }
  if (source.length !== candidate.length) {
    errors.push(`Dialogue 列數不同：來源 ${source.length}，候選 ${candidate.length}`);
  }

  const comparableLines = Math.min(source.length, candidate.length);
  for (let index = 0; index < comparableLines; index += 1) {
    const before = source[index];
    const after = candidate[index];

    if (!timecodePattern.test(before.start) || !timecodePattern.test(before.end)) {
      errors.push(`來源 Dialogue ${index + 1} 的時間碼格式不是 H:MM:SS.cc`);
    }
    if (!timecodePattern.test(after.start) || !timecodePattern.test(after.end)) {
      errors.push(`候選 Dialogue ${index + 1} 的時間碼格式不是 H:MM:SS.cc`);
    }
    if (before.start !== after.start || before.end !== after.end) {
      errors.push(
        `Dialogue ${index + 1} 時間碼被更動：${before.start}–${before.end} → ${after.start}–${after.end}`,
      );
    }

    const visualLines = after.text.split(/\\N|\\n/);
    for (let visualIndex = 0; visualIndex < visualLines.length; visualIndex += 1) {
      const length = visibleLength(visualLines[visualIndex]);
      const label = `Dialogue ${index + 1} 第 ${visualIndex + 1} 行`;
      if (length > 25) {
        errors.push(`${label} 有 ${length} 字，超過絕對上限 25`);
      } else if (length > 20) {
        const message = `${label} 有 ${length} 字，超過目標上限 20`;
        (strictLength ? errors : warnings).push(message);
      }
    }
  }

  return { source, candidate, errors, warnings };
}

if (process.argv.includes("--self-test")) {
  const source =
    "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,原文\\N翻譯";
  const same = validate(source, source, true);
  assert.equal(same.errors.length, 0);
  const changed = validate(
    source,
    source.replace("0:00:02.00", "0:00:03.00"),
    true,
  );
  assert.ok(changed.errors.some((message) => message.includes("時間碼被更動")));
  console.log("ASS validator self-test passed.");
  process.exit(0);
}

const sourceOption = getOption("--source");
const candidateOption = getOption("--candidate");
if (!sourceOption || !candidateOption) {
  console.error(
    "Usage: node scripts/validate-ass.mjs --source input.ass --candidate output.ass [--strict-length]",
  );
  process.exit(2);
}

const sourcePath = path.resolve(sourceOption);
const candidatePath = path.resolve(candidateOption);
const result = validate(
  fs.readFileSync(sourcePath, "utf8"),
  fs.readFileSync(candidatePath, "utf8"),
  process.argv.includes("--strict-length"),
);

for (const warning of result.warnings) console.warn(`WARN  ${warning}`);
for (const error of result.errors) console.error(`ERROR ${error}`);
console.log(
  `ASS validation ${result.errors.length ? "failed" : "passed"}: ${result.candidate.length} Dialogue lines, ${result.errors.length} errors, ${result.warnings.length} warnings.`,
);
process.exitCode = result.errors.length ? 1 : 0;
