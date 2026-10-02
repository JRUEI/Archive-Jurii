'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Bold,
  Captions,
  CaseSensitive,
  Circle,
  Info,
  LayoutList,
  MoveVertical,
  RotateCcw,
  Star,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  SUBTITLE_DEFAULT_STYLE,
  SUBTITLE_FIXED_COLORS,
  SUBTITLE_MAX_COLORS,
  SUBTITLE_RANGE,
  normHex,
  type SubtitleState,
  type SubtitleStyle,
} from '@/lib/subtitle';

type Tool = 'sb' | 'sf' | 'sw' | 'ss' | 'offset' | 'slots';
type Change = (patch: Partial<SubtitleState>) => void;

const TOOLS: { id: Tool; name: string; Icon: LucideIcon; strokeWidth?: number }[] = [
  { id: 'sb', name: '位置', Icon: MoveVertical },
  { id: 'sf', name: '字號', Icon: CaseSensitive },
  { id: 'sw', name: '粗細', Icon: Bold },
  { id: 'ss', name: '描邊', Icon: Circle, strokeWidth: 3.4 },
  { id: 'offset', name: '延遲', Icon: Timer },
  { id: 'slots', name: '快捷', Icon: Star },
];

/* 工具列放得下「圖示＋文字」的最小寬度是 720px（見下面的 @min-[720px]），比這窄就只留圖示，
   名稱在 aria-label 與 title。Tailwind 只認原始碼裡寫死的 class，所以每處都直接寫 @min-[720px]，不能用變數拼 */
const BAR_BTN =
  'inline-flex h-8 min-w-6 flex-[0_1_36px] items-center justify-center gap-1.5 rounded-[10px] border border-transparent text-[13px] font-bold text-zinc-500 transition dark:text-zinc-400 enabled:hover:bg-brand-yellow/10 aria-expanded:border-brand-yellow/25 aria-expanded:bg-brand-yellow/10 aria-expanded:text-brand-brown dark:aria-expanded:text-brand-yellow aria-pressed:border-brand-yellow/25 aria-pressed:bg-brand-yellow/10 aria-pressed:text-brand-brown dark:aria-pressed:text-brand-yellow disabled:cursor-not-allowed disabled:opacity-40 @min-[720px]:flex-none @min-[720px]:px-2.5';
const LABEL = 'hidden @min-[720px]:inline';
const MINI_BTN =
  'inline-flex h-7 items-center justify-center rounded-lg border border-brand-yellow/25 bg-brand-yellow/10 px-2.5 text-xs font-bold text-brand-brown transition dark:text-brand-yellow enabled:hover:bg-brand-yellow/20 disabled:cursor-not-allowed disabled:opacity-40';
const FIELD =
  'h-[34px] rounded-[10px] border border-zinc-200 bg-zinc-100 text-[13px] dark:border-zinc-700 dark:bg-zinc-800';

// 內部正值＝字幕提早出現。只寫正負號分不出是提早還是晚，滑桿讀數、摘要、讀屏文字都直接寫「提前／延後」
const describeOffset = (ms: number) => `${ms > 0 ? '提前' : '延後'} ${(Math.abs(ms) / 1000).toFixed(2)} 秒`;
const formatOffset = (ms: number) => (ms === 0 ? '0 秒' : describeOffset(ms));

/**
 * 影片下面的字幕設定列：字幕開關、字幕群開關、六個設定鈕、摘要、還原一排。
 * 設定鈕各開一個小浮層（absolute，不推擠頁面）；一次只開一個。
 * 狀態與存檔都在上層，這裡只負責畫面。
 */
export default function SubtitleToolbar({
  state,
  onChange,
  groupOn,
  onGroupChange,
}: {
  state: SubtitleState;
  onChange: Change;
  /** 影片下方「即時字幕群」卡片的開關，狀態在上層 */
  groupOn: boolean;
  onGroupChange: (on: boolean) => void;
}) {
  const { on, cur, offset, summary } = state;
  const uid = useId();
  const [open, setOpen] = useState<Tool | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Partial<Record<Tool, HTMLButtonElement | null>>>({});
  // 字幕關掉時設定鈕都停用，浮層也一併收起
  const active = on ? open : null;

  const closeActive = () => {
    if (active) buttonRefs.current[active]?.focus();
    setOpen(null);
  };

  useEffect(() => {
    if (!active) return;
    const close = () => setOpen(null);
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (rootRef.current?.contains(document.activeElement)) buttonRefs.current[active]?.focus();
      close();
    };
    // 點到跨網域的 YouTube iframe 時，pointerdown 傳不到這一層，只看得到視窗失焦、焦點落在 iframe 上
    const onBlur = () => {
      if (document.activeElement instanceof HTMLIFrameElement) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [active]);

  const setStyle = (patch: Partial<SubtitleStyle>) => onChange({ cur: { ...cur, ...patch } });

  // 項目內的空白換成不斷行空白：窄螢幕換行只會落在「 · 」，不會把「提前 / 0.30 秒」拆在兩行
  const summaryText = [
    `位置 ${cur.sb}%`,
    `字號 ${cur.sf.toFixed(1)}`,
    `粗 ${cur.sw}`,
    `描邊 ${cur.ss.toFixed(2)}`,
    ...(offset !== 0 ? [describeOffset(offset)] : []),
  ]
    .map(item => item.replace(/ /g, ' '))
    .join(' · ');

  let panel: ReactNode = null;
  if (active === 'sb') {
    panel = (
      <Slider label="位置" value={cur.sb} range={SUBTITLE_RANGE.sb} format={v => `${v}%`} onChange={sb => setStyle({ sb })} />
    );
  } else if (active === 'sf') {
    panel = (
      <Slider label="字號" value={cur.sf} range={SUBTITLE_RANGE.sf} format={v => v.toFixed(1)} onChange={sf => setStyle({ sf })} />
    );
  } else if (active === 'sw') {
    panel = (
      <Slider label="粗細" value={cur.sw} range={SUBTITLE_RANGE.sw} format={String} onChange={sw => setStyle({ sw })} />
    );
  } else if (active === 'ss') {
    panel = (
      <>
        <Slider label="描邊" value={cur.ss} range={SUBTITLE_RANGE.ss} format={v => v.toFixed(2)} onChange={ss => setStyle({ ss })} />
        <ColorPanel state={state} onChange={onChange} />
      </>
    );
  } else if (active === 'offset') {
    panel = (
      <>
        <Slider label="延遲" value={offset} range={SUBTITLE_RANGE.offset} format={formatOffset} onChange={v => onChange({ offset: v })} />
        <p className="m-0 grid gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span>字幕比聲音慢 → 往右拉（提前）</span>
          <span>字幕比聲音快 → 往左拉（延後）</span>
        </p>
      </>
    );
  } else if (active === 'slots') {
    panel = <SlotsPanel state={state} onChange={onChange} />;
  }

  return (
    <div>
      {/* z-[41]：比右側懸浮的「畫面定位／逐字稿抽屜」(z-40) 高、比站頂 Header (z-50) 低。
          手機上那組懸浮鈕會蓋住工具列右端的「目前設定」「還原」，按「畫面定位」之後更是剛好對上 */}
      <div ref={rootRef} className="@container relative z-[41]">
        <div
          role="group"
          aria-label="字幕設定"
          className="flex h-11 items-center gap-0.5 rounded-2xl border border-zinc-200 bg-white px-1 dark:border-zinc-800 dark:bg-zinc-900 @min-[720px]:gap-1"
        >
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="字幕"
            onClick={() => {
              setOpen(null);
              onChange({ on: !on });
            }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-bold text-zinc-700 transition hover:bg-brand-yellow/10 dark:text-zinc-200"
          >
            <Captions size={16} aria-hidden="true" />
            <span className={LABEL}>字幕</span>
            <span
              aria-hidden="true"
              className={`relative h-[18px] w-8 rounded-full transition-colors ${
                on ? 'bg-brand-brown dark:bg-brand-tan' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 size-3.5 rounded-full bg-white transition-transform ${
                  on ? 'translate-x-3.5' : ''
                }`}
              />
            </span>
          </button>
          {/* 影片下方卡片的開關：跟「目前設定」一樣是按下去亮底的圖示鈕，手機放得下（再加一個滑動開關會擠出工具列） */}
          <button
            type="button"
            aria-pressed={groupOn}
            aria-label="即時字幕群"
            title="顯示／隱藏影片下方的即時字幕群"
            onClick={() => onGroupChange(!groupOn)}
            className={BAR_BTN}
          >
            <LayoutList size={16} aria-hidden="true" className="shrink-0" />
            <span className={LABEL}>字幕群</span>
          </button>

          {TOOLS.map(({ id, name, Icon, strokeWidth }) => (
            <button
              key={id}
              ref={el => {
                buttonRefs.current[id] = el;
              }}
              type="button"
              disabled={!on}
              aria-label={name}
              title={name}
              aria-expanded={active === id}
              aria-controls={`${uid}-${id}`}
              onClick={() => setOpen(active === id ? null : id)}
              className={BAR_BTN}
            >
              <Icon size={16} strokeWidth={strokeWidth} aria-hidden="true" className="shrink-0" />
              <span className={LABEL}>{name}</span>
            </button>
          ))}

          <span className="min-w-0 flex-1" />

          <button
            type="button"
            aria-pressed={summary}
            aria-label="目前設定"
            title="顯示／隱藏目前設定"
            onClick={() => onChange({ summary: !summary })}
            className={BAR_BTN}
          >
            <Info size={16} aria-hidden="true" className="shrink-0" />
            <span className={LABEL}>目前設定</span>
          </button>
          <button
            type="button"
            disabled={!on}
            aria-label="還原"
            title="還原預設字幕樣式"
            onClick={() => onChange({ cur: SUBTITLE_DEFAULT_STYLE })}
            className={BAR_BTN}
          >
            <RotateCcw size={16} aria-hidden="true" className="shrink-0" />
            <span className={LABEL}>還原</span>
          </button>
        </div>

        {active && (
          <div
            id={`${uid}-${active}`}
            role="group"
            aria-label={`${TOOLS.find(t => t.id === active)?.name}設定`}
            className="absolute left-0 top-[calc(100%+6px)] z-[45] grid w-[min(100%,24rem)] gap-3 rounded-2xl border border-zinc-200 bg-white py-3 pl-3.5 pr-11 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={closeActive}
              aria-label="關閉"
              className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <X size={16} aria-hidden="true" />
            </button>
            {panel}
          </div>
        )}
      </div>

      {summary && (
        // 窄螢幕設了延遲會超出一行：換行，不截斷（延遲正是最需要看到的那段）
        <p className="m-0 flex min-h-7 items-center gap-2 px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full border border-zinc-400"
            style={{ backgroundColor: cur.c }}
          />
          <span className="min-w-0 tabular-nums">{summaryText}</span>
        </p>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  range: [min, max, step],
  format,
  onChange,
}: {
  label: string;
  value: number;
  range: readonly [number, number, number];
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[2.6rem_minmax(0,1fr)_4.8rem] items-center gap-3 text-[13px]">
      <span className="font-semibold text-zinc-500 dark:text-zinc-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={format(value)}
        onChange={e => onChange(Number(e.target.value))}
        className="h-6 w-full accent-brand-brown dark:accent-brand-tan"
      />
      <output className="text-right font-semibold tabular-nums">{format(value)}</output>
    </label>
  );
}

function ColorPanel({ state: { cur, saved }, onChange }: { state: SubtitleState; onChange: Change }) {
  // 色碼欄打到一半的字：離開欄位或按 Enter 才套用，打不成色碼就還原
  const [draft, setDraft] = useState<string | null>(null);
  const setColor = (c: string) => onChange({ cur: { ...cur, c } });
  const commit = () => {
    const hex = normHex(draft);
    if (hex) setColor(hex);
    setDraft(null);
  };

  return (
    <div className="grid gap-3">
      <div role="group" aria-label="描邊顏色" className="flex flex-wrap items-center gap-x-4 gap-y-4 pt-1.5">
        {saved.map((c, i) => (
          <span key={c} className="relative">
            <button
              type="button"
              onClick={() => setColor(c)}
              aria-pressed={c === cur.c}
              aria-label={`描邊色 ${c.toUpperCase()}`}
              title={c.toUpperCase()}
              style={{ backgroundColor: c }}
              className="block size-[30px] rounded-full border-2 border-zinc-200 dark:border-zinc-700 aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-zinc-900 dark:aria-pressed:outline-zinc-100"
            />
            {i >= SUBTITLE_FIXED_COLORS.length && (
              <button
                type="button"
                onClick={() => onChange({ saved: saved.filter(x => x !== c) })}
                aria-label={`刪除色塊 ${c.toUpperCase()}`}
                className="absolute -right-2.5 -top-2.5 inline-flex size-6 items-center justify-center rounded-full bg-zinc-900 text-white ring-2 ring-white dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-900"
              >
                <X size={12} strokeWidth={3} aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="color"
          value={cur.c}
          onChange={e => setColor(e.target.value)}
          aria-label="選色盤"
          className={`${FIELD} w-10 cursor-pointer p-0.5`}
        />
        <input
          type="text"
          value={draft ?? cur.c.toUpperCase()}
          maxLength={7}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
          }}
          aria-label="色碼"
          className={`${FIELD} w-26 px-2.5 tabular-nums`}
        />
        <button
          type="button"
          onClick={() => onChange({ saved: [...saved, cur.c] })}
          disabled={saved.includes(cur.c) || saved.length >= SUBTITLE_MAX_COLORS}
          title={saved.length >= SUBTITLE_MAX_COLORS ? `最多存 ${SUBTITLE_MAX_COLORS} 個，先刪掉一個` : undefined}
          className={MINI_BTN}
        >
          存成快捷色
        </button>
      </div>
    </div>
  );
}

function SlotsPanel({ state: { cur, slots }, onChange }: { state: SubtitleState; onChange: Change }) {
  const put = (i: number, value: SubtitleStyle | null) =>
    onChange({ slots: slots.map((slot, j) => (j === i ? value : slot)) });

  return (
    <div className="grid gap-2">
      {slots.map((slot, i) => (
        <div
          key={i}
          className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-800/50"
        >
          <div className="grid min-w-0 gap-0.5">
            <b className="flex items-center gap-1.5 text-[13px]">
              {slot && (
                <i
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full border border-zinc-400"
                  style={{ backgroundColor: slot.c }}
                />
              )}
              快捷 {i + 1}
            </b>
            <small className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {slot ? `${slot.c.toUpperCase()}・${slot.sf.toFixed(1)}・${slot.sw}・${slot.sb}%` : '空'}
            </small>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              disabled={!slot}
              aria-label={`套用快捷 ${i + 1}`}
              onClick={() => slot && onChange({ cur: { ...slot } })}
              className={MINI_BTN}
            >
              套用
            </button>
            <button type="button" aria-label={`存入快捷 ${i + 1}`} onClick={() => put(i, { ...cur })} className={MINI_BTN}>
              存入
            </button>
            <button type="button" disabled={!slot} aria-label={`清除快捷 ${i + 1}`} onClick={() => put(i, null)} className={MINI_BTN}>
              清
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
