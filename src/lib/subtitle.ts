/**
 * 逐字稿模式「影片上的字幕」用到的純函式與設定資料。
 * 不 import 任何東西：scripts/check-subtitle.mjs 直接用 Node 載入這支檔案跑檢查。
 */

export interface SubtitleStyle {
  /** 描邊顏色，小寫 #rrggbb */
  c: string;
  /** 距離影片底邊的百分比 */
  sb: number;
  /** 字號，單位是影片寬度的 1% */
  sf: number;
  /** font-weight */
  sw: number;
  /** 描邊粗細，單位同字號 */
  ss: number;
}

export interface SubtitleState {
  v: 1;
  on: boolean;
  cur: SubtitleStyle;
  /** 描邊快捷色：前三個固定（藍、酒紅、深綠，都不是黑），之後是使用者存的，最多 6 個 */
  saved: string[];
  /** 整組樣式快捷，三格，空的是 null */
  slots: (SubtitleStyle | null)[];
  /** 字幕時間補償（毫秒），正值＝字幕提早出現 */
  offset: number;
  /** 是否顯示「目前設定」摘要列 */
  summary: boolean;
}

export const SUBTITLE_STORAGE_KEY = 'jurii-transcript-subtitle';
export const SUBTITLE_SLOT_COUNT = 3;
export const SUBTITLE_MAX_COLORS = 6;
export const SUBTITLE_FIXED_COLORS: readonly string[] = ['#14247a', '#7b1226', '#14532d'];
export const SUBTITLE_DEFAULT_STYLE: SubtitleStyle = { c: '#14247a', sb: 13, sf: 4.4, sw: 700, ss: 0.9 };

/** [最小, 最大, 間距]：滑桿與讀回存檔時的夾限共用同一份 */
export const SUBTITLE_RANGE = {
  sb: [3, 45, 0.5],
  sf: [2.5, 8, 0.1],
  sw: [400, 900, 100],
  ss: [0, 2, 0.05],
  offset: [-500, 800, 10],
} as const;

export const DEFAULT_SUBTITLE_STATE: SubtitleState = {
  v: 1,
  on: false,
  cur: SUBTITLE_DEFAULT_STYLE,
  saved: [...SUBTITLE_FIXED_COLORS],
  slots: [null, null, null],
  offset: 0,
  summary: false,
};

/** `#abc`、`abc`、`#AABBCC` 都收成小寫 `#rrggbb`，不是色碼就回 null */
export function normHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let hex = raw.trim().toLowerCase();
  if (hex[0] !== '#') hex = `#${hex}`;
  if (/^#[0-9a-f]{3}$/.test(hex)) hex = `#${[...hex.slice(1)].map(ch => ch + ch).join('')}`;
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

function clamp(value: unknown, [min, max]: readonly [number, number, number], fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function sanitizeStyle(raw: unknown): SubtitleStyle {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = SUBTITLE_DEFAULT_STYLE;
  return {
    c: normHex(o.c) ?? d.c,
    sb: clamp(o.sb, SUBTITLE_RANGE.sb, d.sb),
    sf: clamp(o.sf, SUBTITLE_RANGE.sf, d.sf),
    sw: clamp(o.sw, SUBTITLE_RANGE.sw, d.sw),
    ss: clamp(o.ss, SUBTITLE_RANGE.ss, d.ss),
  };
}

/** 讀 localStorage 存的字串：壞掉、版本不對、欄位亂填都不會丟錯，該回預設的回預設、超出範圍的夾回範圍 */
export function parseSubtitleState(raw: string | null): SubtitleState {
  let o: Record<string, unknown> | null = null;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && parsed.v === 1) o = parsed;
  } catch {
    // 存檔壞掉就當作沒有存過
  }
  if (!o) return DEFAULT_SUBTITLE_STATE;

  const saved = [...SUBTITLE_FIXED_COLORS];
  for (const c of Array.isArray(o.saved) ? o.saved.map(normHex) : []) {
    if (c && !saved.includes(c) && saved.length < SUBTITLE_MAX_COLORS) saved.push(c);
  }
  const slots = Array.isArray(o.slots) ? o.slots : [];

  return {
    v: 1,
    on: o.on === true,
    cur: sanitizeStyle(o.cur),
    saved,
    slots: Array.from({ length: SUBTITLE_SLOT_COUNT }, (_, i) =>
      slots[i] && typeof slots[i] === 'object' ? sanitizeStyle(slots[i]) : null,
    ),
    offset: clamp(o.offset, SUBTITLE_RANGE.offset, 0),
    summary: o.summary === true,
  };
}

/**
 * 逐字稿一列一列切，「」常常跨列：開頭在引號裡就補「，結尾還在引號裡就補」。
 * 只改顯示用的字串，不動原始資料。
 * ponytail: 只算一層。原檔裡漏掉的「」會一路補到下一個」為止，要擋就在 validate-content 查。
 */
export function balanceQuotes(texts: readonly string[]): string[] {
  let inside = false;
  return texts.map(text => {
    const startsInside = inside;
    for (const ch of text) {
      if (ch === '「') inside = true;
      else if (ch === '」') inside = false;
    }
    return (startsInside ? '「' : '') + text + (inside ? '」' : '');
  });
}

/** 字幕結束時間：字越多停越久（夾在 2 到 6 秒），而且不會蓋到下一列 */
export function subtitleEnd(start: number, text: string, nextStart: number): number {
  const chars = text.replace(/\s/g, '').length;
  return Math.min(nextStart, start + Math.min(6, Math.max(2, 1.2 + 0.28 * chars)));
}

export interface SubtitleRow {
  start: number;
  end: number;
  /** 顯示用，已補成對的引號 */
  text: string;
}

export function buildSubtitleRows(lines: readonly { seconds: number; text: string }[]): SubtitleRow[] {
  const texts = balanceQuotes(lines.map(line => line.text));
  return lines.map((line, i) => ({
    start: line.seconds,
    end: subtitleEnd(line.seconds, line.text, i + 1 < lines.length ? lines[i + 1].seconds : Infinity),
    text: texts[i],
  }));
}

/** 二分查找 t 這個時間該顯示哪一列；還沒開始、或已經過了結束時間就回 -1 */
export function rowAt(rows: readonly SubtitleRow[], t: number): number {
  let low = 0;
  let high = rows.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (rows[mid].start <= t) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found >= 0 && t < rows[found].end ? found : -1;
}
