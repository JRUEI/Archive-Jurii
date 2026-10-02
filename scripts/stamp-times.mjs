// 把逐字稿每一列的整秒時間碼補成 0.1 秒：[13:32] → [13:32.4]，超過一小時 [1:02:03] → [1:02:03.4]。
//
//   node scripts/stamp-times.mjs <YYMMDD ...|--all> [--check]
//   --check 只算不寫（統計照印）；--self-test 跑檔案最後面的小檢查。
//
// 讀 content/episodes/<ep>.md 和 content/<ep>.ja.vtt，只動「## 【完整逐字稿】」底下還沒有小數的列，
// 其他位元組（換行、文字、段落標題）原樣保留；已經有小數的列不碰，所以重跑不會再改。
//
// 時間哪來：日文自動字幕每個字都帶開口時間（<00:00:01.234><c>字</c>），每個 cue 的第一個字用 cue 開始時間，
// 「。」「、」也各算一個字。這是 YouTube 的字幕時間，不保證貼著實際聲音。
//
// 挑哪個字：一列的整秒 t 是它第一個字開口時間捨去到整秒，所以那個字一定落在 [t, t+1) 秒的窗口內，
// 小數 = 它的開口時間捨去到 0.1 秒（整秒部分因此永遠等於原標籤）。窗口常有好幾個字，每個字打分數，越低越好：
//   1. 先驗：窗口內第一個句首字 0、後面的句首字 1、子句邊界 2、其他 3。句首字＝整份字幕第一個字，或上一個字
//      以 。？！ 結尾；子句邊界＝上一個字是「、」，或離上一個字開口 ≥ 0.4 秒。
//   2. 長度：一列的中文字數約是它涵蓋的日文字數的 0.67 倍（Gale–Church 長度比對）。0.67 取自 25 集相鄰兩個
//      句首列（共 6,716 組）的中位數 0.667。相鄰兩列選的字決定上一列涵蓋多少日文字，對不上就扣分。
//   3. 順序：選到不在上一列之後的字扣重分，所以時間不會倒退。
//   整集用 Viterbi 一次找總分最低的組合，一列選哪個字也看前後列的字數。
//   窗口裡一個字都沒有的列（標籤不是任何字的整秒）維持整秒，統計列為「留整秒」。
//   常數不敏感：比例 0.5–0.85、長度權重 ×½–×2、先驗分數各調一兩分，換字的列都不到 2%；停頓門檻改成
//   0.25–0.8 秒會動到 3.6–6%；把長度拿掉（只看先驗）會動到約 8%。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const contentDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "content");

// ponytail: 比例固定，各集中位數落在 0.56–0.83；要更準就每集用句首列量一次
const RATIO = 0.67; // 中文字數 ÷ 日文字數
const SMOOTH = 4; // 長度差的變異數 ＝ 日文字數 + SMOOTH
const PAUSE_MS = 400;
const OUT_OF_ORDER = 8;
const PRIOR = { firstSentence: 0, laterSentence: 1, clause: 2, other: 3 };

// [mm:ss] 或 [h:mm:ss]，後面可帶一位小數；和 validate-content.mjs 認的逐字稿列一致
const ROW =
  /^([ \t]*\[(\d{1,3}:\d{2}(?::\d{2})?))(?:\.(\d))?\][ \t]*\[[^\]\r\n]+\][ \t]*([^\r\n]*)/gm;
const TAGS = /\[[^\]]*\]|［[^］]*］/g;
const MARKS = /[\s。，、？！「」『』（）()—…·〈〉《》,.?!:;：；"'~〜♪]/g;

class Fail extends Error {}

// 口語字數：不算標點、空白和 [音效] 標記
const spoken = (text) => [...text.replace(TAGS, "").replace(MARKS, "")].length;

// 自動字幕 → { T: 每個字的開口時間(ms), W: 每個字的文字 }
export function parseVtt(vtt) {
  const T = [];
  const W = [];
  const ms = (m) => ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4].padEnd(3, "0").slice(0, 3);
  for (const block of vtt.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = block.trim().split("\n");
    const head = lines.findIndex((line) => line.includes("-->"));
    if (head === -1) continue;
    const start = ms(lines[head].match(/(\d+):(\d+):(\d+)\.(\d+)/));
    for (const line of lines.slice(head + 1)) {
      if (!line.includes("<c>")) continue; // 沒有逐字標記的是上一句的重複
      const lead = line.slice(0, line.indexOf("<"));
      if (lead.trim()) {
        T.push(start);
        W.push(lead);
      }
      for (const m of line.matchAll(/<(\d+):(\d+):(\d+)\.(\d+)><c>(.*?)<\/c>/g)) {
        T.push(ms(m));
        W.push(m[5]);
      }
    }
  }
  return { T, W };
}

// 每個字：是不是句首、是不是子句邊界、前面累積多少口語字（chars[j] - chars[i] ＝ 第 i 到 j-1 個字的字數）
export function buildStream({ T, W }) {
  const sent = [];
  const clause = [];
  const chars = [0];
  for (let i = 0; i < T.length; i += 1) {
    const prev = W[i - 1] ?? "";
    sent[i] = i === 0 || /[。？！?!]\s*$/.test(prev);
    clause[i] = !sent[i] && (/[、，,]\s*$/.test(prev) || T[i] - T[i - 1] >= PAUSE_MS);
    chars[i + 1] = chars[i] + spoken(W[i]);
  }
  return { T, sent, clause, chars };
}

const lowerBound = (T, x) => {
  let lo = 0;
  let hi = T.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (T[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

// 字本身像不像一列的開頭
function prior(S, j, firstSentence) {
  if (S.sent[j]) return j === firstSentence ? PRIOR.firstSentence : PRIOR.laterSentence;
  return S.clause[j] ? PRIOR.clause : PRIOR.other;
}

// 上一列選第 pj 個字、這一列選第 j 個字：上一列的中文字數 zh 跟它涵蓋的日文字數對不對得上
function transition(S, pj, j, zh) {
  const span = S.chars[j] - S.chars[pj];
  const length = span > 0 ? 0.5 * ((zh - RATIO * span) / Math.sqrt(span + SMOOTH)) ** 2 : 3 + 0.2 * zh;
  return length + (j <= pj ? OUT_OF_ORDER : 0);
}

// rows: [{ lo, hi, zh }]，候選字的開口時間落在 [lo, hi) ms，zh ＝ 這一列的中文口語字數。
// 回傳每列選到的字（index），窗口裡沒有字的列是 null。
export function pickTokens(S, rows) {
  const cand = rows.map(({ lo, hi }) => {
    const first = lowerBound(S.T, lo);
    return Array.from({ length: lowerBound(S.T, hi) - first }, (_, k) => first + k);
  });
  const live = cand.flatMap((c, k) => (c.length ? [k] : []));
  const picks = rows.map(() => null);
  if (!live.length) return picks;
  // 每個有字的列到下一個有字的列之間的中文字數（中間沒有字的列算進去）
  const zh = live.map((k, m) => {
    let sum = 0;
    for (let q = k; q < (live[m + 1] ?? rows.length); q += 1) sum += rows[q].zh;
    return sum;
  });

  // layers[m][a]：第 m 個有字的列選第 a 個候選時，從頭到這裡的最低總分，和它是從上一層哪個候選來的
  const layers = [];
  live.forEach((k, m) => {
    const firstSentence = cand[k].find((j) => S.sent[j]);
    const prev = layers[m - 1];
    layers.push(
      cand[k].map((j) => {
        if (!prev) return { j, cost: prior(S, j, firstSentence), from: -1 };
        let best = { cost: Infinity, from: -1 };
        prev.forEach((p, a) => {
          const cost = p.cost + transition(S, p.j, j, zh[m - 1]);
          if (cost < best.cost) best = { cost, from: a };
        });
        return { j, cost: best.cost + prior(S, j, firstSentence), from: best.from };
      }),
    );
  });

  const last = layers[layers.length - 1];
  let a = last.reduce((best, c, i) => (c.cost < last[best].cost ? i : best), 0);
  for (let m = live.length - 1; m >= 0; m -= 1) {
    picks[live[m]] = layers[m][a].j;
    a = layers[m][a].from;
  }
  return picks;
}

// md 全文 + 字幕 → { text: 補好小數的全文, stats, whole: 留整秒的列, picks }
// 只在時間碼數字後面插入 ".d"，其餘一個位元組都不動。
export function stamp(md, S) {
  const heading = /^##[ \t]*【完整逐字稿】[ \t]*\r?$/m.exec(md);
  if (!heading) throw new Fail("找不到「## 【完整逐字稿】」段落");
  const from = heading.index + heading[0].length;
  const next = md.slice(from).search(/^## /m);
  const section = md.slice(from, next === -1 ? md.length : from + next);

  const rows = [...section.matchAll(ROW)].map((m) => {
    const seconds = m[2].split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
    const lo = seconds * 1000 + (m[3] === undefined ? 0 : Number(m[3]) * 100);
    return {
      at: from + m.index + m[1].length, // 時間碼數字後面、"]" 或既有小數前面
      tc: m[2],
      lo,
      hi: lo + (m[3] === undefined ? 1000 : 100), // 已經有小數的列，窗口縮成那 0.1 秒
      fixed: m[3] !== undefined,
      zh: spoken(m[4]),
      text: m[4],
    };
  });
  if (!rows.length) throw new Fail("逐字稿底下沒有可解析的列");
  const stray = (section.match(/^[ \t]*\[\d/gm) ?? []).length - rows.length;

  const picks = pickTokens(S, rows);
  const stats = { rows: rows.length, had: 0, sentence: 0, clause: 0, other: 0, whole: 0, stray };
  const whole = [];
  let text = "";
  let done = 0;
  rows.forEach((row, k) => {
    const j = picks[k];
    if (row.fixed) {
      stats.had += 1;
    } else if (j === null) {
      stats.whole += 1;
      whole.push({ line: md.slice(0, row.at).split("\n").length, tc: row.tc, text: row.text });
    } else {
      text += `${md.slice(done, row.at)}.${Math.floor((S.T[j] - row.lo) / 100)}`;
      done = row.at;
      stats[S.sent[j] ? "sentence" : S.clause[j] ? "clause" : "other"] += 1;
    }
  });
  return { text: text + md.slice(done), stats, whole, picks };
}

const describe = (s) =>
  `句首 ${s.sentence}／子句或停頓 ${s.clause}／其他 ${s.other}，已有小數 ${s.had}，留整秒 ${s.whole}`;

function stampEpisode(ep, check) {
  const mdFile = path.join(contentDirectory, "episodes", `${ep}.md`);
  const vttFile = path.join(contentDirectory, `${ep}.ja.vtt`);
  const vttName = `content/${ep}.ja.vtt`;
  if (!fs.existsSync(mdFile)) throw new Fail(`找不到 content/episodes/${ep}.md`);
  if (!fs.existsSync(vttFile)) {
    throw new Fail(`找不到 ${vttName}（日文自動字幕，抓法見 docs/episode-workflow.md）`);
  }
  const tokens = parseVtt(fs.readFileSync(vttFile, "utf8"));
  if (!tokens.T.length) {
    throw new Fail(`${vttName} 裡沒有逐字時間（<時間><c>字</c>），不是 YouTube 的自動字幕格式？`);
  }
  const back = tokens.T.findIndex((t, i) => i > 0 && t < tokens.T[i - 1]);
  if (back !== -1) throw new Fail(`${vttName} 的字幕時間倒退（第 ${back + 1} 個字），沒辦法對時間`);

  const md = fs.readFileSync(mdFile, "utf8");
  const { text, stats, whole } = stamp(md, buildStream(tokens));
  if (!check && text !== md) fs.writeFileSync(mdFile, text);

  const added = stats.sentence + stats.clause + stats.other;
  console.log(
    `${ep}  ${stats.rows} 列：${check ? "會補上" : "補上"} ${added}（${describe(stats)}）` +
      (check ? "　--check，沒寫檔" : ""),
  );
  for (const row of whole.slice(0, 3)) {
    console.log(`    留整秒（窗口內沒有字）：第 ${row.line} 行 [${row.tc}] ${row.text.slice(0, 20)}`);
  }
  if (stats.stray) {
    console.log(`    注意：有 ${stats.stray} 行長得像時間碼但不是可解析的列，沒動（validate-content 會報）`);
  }
  return stats;
}

const usage = "用法：node scripts/stamp-times.mjs <YYMMDD ...|--all> [--check]（--self-test 跑內建檢查）";

function main(argv) {
  if (argv.includes("--self-test")) return selfTest();
  const names = argv.filter((arg) => !arg.startsWith("--"));
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const all = flags.includes("--all");
  const unknownFlag = flags.some((flag) => flag !== "--all" && flag !== "--check");
  if (unknownFlag || (all ? names.length > 0 : names.length === 0)) {
    console.error(usage);
    return 2;
  }
  const badName = names.find((name) => !/^\d{6}$/.test(name));
  if (badName) {
    console.error(`集數要寫成 YYMMDD（例如 260929），收到「${badName}」\n${usage}`);
    return 2;
  }
  const episodes = all
    ? fs
        .readdirSync(path.join(contentDirectory, "episodes"))
        .filter((file) => /^\d{6}\.md$/.test(file))
        .map((file) => file.slice(0, 6))
        .sort()
    : names;

  const total = { rows: 0, had: 0, sentence: 0, clause: 0, other: 0, whole: 0 };
  let failed = 0;
  for (const ep of episodes) {
    try {
      const stats = stampEpisode(ep, flags.includes("--check"));
      for (const key of Object.keys(total)) total[key] += stats[key];
    } catch (error) {
      if (!(error instanceof Fail)) throw error;
      console.error(`${ep}  錯誤：${error.message}`);
      failed += 1;
    }
  }
  if (episodes.length > 1) console.log(`合計  ${total.rows} 列：${describe(total)}`);
  return failed ? 1 : 0;
}

// 小檢查：句首優先、長度把選擇拉到對的字、小時格式、沒字的列留整秒、已有小數不動、CRLF 與段落標題原樣、重跑不變
function selfTest() {
  const vtt = [
    "WEBVTT",
    "",
    "00:00:01.000 --> 00:00:03.000",
    "こんにちは<00:00:01.500><c>。</c><00:00:01.900><c>今日</c><00:00:02.300><c>は</c>",
    "",
    "00:01:00.000 --> 00:01:02.000",
    "前の行",
    "あのね<00:01:00.250><c>、</c><00:01:00.700><c>それ</c>",
    "",
    "01:00:00.200 --> 01:00:02.000",
    "ねえ<01:00:00.250><c>。</c>",
  ].join("\n");
  const md = [
    "## 【精簡總結】",
    "### [0:01] 標題",
    "## 【完整逐字稿】",
    "",
    "[0:01] [逢田珠里依] 你好",
    "[0:02] [逢田珠里依] 今天",
    "[0:30] [逢田珠里依] 沒有字的整秒",
    "[1:00] [逢田珠里依] 欸那個",
    "[1:00:00] [逢田珠里依] 欸",
    "[1:00:01.5] [逢田珠里依] 已經有小數",
    "",
  ].join("\r\n");

  const S = buildStream(parseVtt(vtt));
  const { text, stats } = stamp(md, S);
  assert.equal(
    text,
    md
      .replace("[0:01] [逢", "[0:01.0] [逢")
      .replace("[0:02]", "[0:02.3]")
      .replace("[1:00] [逢", "[1:00.7] [逢")
      .replace("[1:00:00]", "[1:00:00.2]"),
  );
  assert.equal(text.replace(/(\[\d+:\d\d(?::\d\d)?)\.\d\]/g, "$1]"), md.replace("[1:00:01.5]", "[1:00:01]"));
  assert.deepEqual(
    [stats.sentence, stats.clause, stats.other, stats.had, stats.whole],
    [1, 3, 0, 1, 1],
  );
  assert.equal(stamp(text, S).text, text);
  console.log("自我檢查通過");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
