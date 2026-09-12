import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

const inputOption = getOption("--input");
if (!inputOption) {
  console.error(
    "Usage: node scripts/glossary-dry-run.mjs --input transcript.txt [--episode 2]",
  );
  process.exit(2);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const glossaryPath = path.join(projectRoot, "content", "glossary.json");
const glossary = JSON.parse(fs.readFileSync(glossaryPath, "utf8"));
const episode = getOption("--episode");
const episodeRules = episode ? glossary.episodes?.[episode] : {};

if (episode && !episodeRules) {
  console.error(`Glossary has no episode-specific rules for episode ${episode}.`);
  process.exit(2);
}

const inputPath = path.resolve(inputOption);
const input = fs.readFileSync(inputPath, "utf8");
const rules = Object.entries({ ...glossary.global, ...episodeRules })
  .filter(([source, replacement]) => source !== replacement)
  .sort(([left], [right]) => right.length - left.length);
const counts = new Map(rules.map(([source]) => [source, 0]));

for (let offset = 0; offset < input.length; ) {
  const match = rules.find(([source]) => input.startsWith(source, offset));
  if (!match) {
    offset += 1;
    continue;
  }
  const [source] = match;
  counts.set(source, counts.get(source) + 1);
  offset += source.length;
}

const matches = rules
  .map(([source, replacement]) => ({
    source,
    replacement,
    count: counts.get(source),
  }))
  .filter((rule) => rule.count > 0);
const total = matches.reduce((sum, rule) => sum + rule.count, 0);

for (const rule of matches) {
  console.log(`${rule.count}× ${rule.source} → ${rule.replacement}`);
}
console.log(
  `Dry-run complete: ${total} possible replacements in ${path.relative(projectRoot, inputPath)}. No files changed.`,
);
