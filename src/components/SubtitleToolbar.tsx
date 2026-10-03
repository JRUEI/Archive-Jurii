'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Bold,
  Captions,
  CaseSensitive,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  List,
  Maximize,
  Minimize,
  MoveVertical,
  Pin,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  SUBTITLE_DEFAULT_STYLE,
  SUBTITLE_FIXED_COLORS,
  SUBTITLE_MAX_COLORS,
  SUBTITLE_NAME_MAX,
  SUBTITLE_RANGE,
  normHex,
  type SubtitleState,
  type SubtitleStyle,
} from '@/lib/subtitle';

const SKIP_SECONDS = 5;

type Tool = 'style' | 'offset' | 'slots';
type Change = (patch: Partial<SubtitleState>) => void;

const TOOLS: { id: Tool; name: string; Icon: LucideIcon }[] = [
  { id: 'style', name: '樣式', Icon: SlidersHorizontal },
  { id: 'offset', name: '延遲', Icon: Timer },
  { id: 'slots', name: '快捷', Icon: Star },
];

/* 工具列放得下「圖示＋文字」的最小寬度是 780px（見下面的 @min-[780px]），比這窄就只留圖示，
   名稱在 aria-label 與 title。Tailwind 只認原始碼裡寫死的 class，所以每處都直接寫 @min-[780px]，不能用變數拼 */
export const BAR_BTN =
  'inline-flex h-8 min-w-6 flex-[0_1_36px] items-center justify-center gap-1 rounded-[10px] border border-transparent text-[13px] font-bold text-zinc-500 transition dark:text-zinc-400 enabled:hover:bg-brand-yellow/10 aria-expanded:border-brand-yellow/25 aria-expanded:bg-brand-yellow/10 aria-expanded:text-brand-brown dark:aria-expanded:text-brand-yellow aria-pressed:border-brand-yellow/25 aria-pressed:bg-brand-yellow/10 aria-pressed:text-brand-brown dark:aria-pressed:text-brand-yellow disabled:cursor-not-allowed disabled:opacity-40 @min-[780px]:flex-none @min-[780px]:px-1.5';
export const LABEL = 'hidden @min-[780px]:inline';
const SWITCH_BTN =
  'inline-flex h-8 shrink-0 items-center gap-1 rounded-[10px] px-1 text-[13px] font-bold text-zinc-700 transition hover:bg-brand-yellow/10 dark:text-zinc-200 @min-[780px]:gap-1.5 @min-[780px]:px-2';

/* 軌道 flex + items-center，白球由 flex 垂直置中（不靠 top 手算）；開時右移 = 軌道寬 32 − 左右內距各 2 − 球 14 = 14px（translate-x-3.5） */
function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-[18px] w-8 shrink-0 items-center rounded-full px-0.5 transition-colors ${
        on ? 'bg-brand-brown dark:bg-brand-tan' : 'bg-zinc-300 dark:bg-zinc-600'
      }`}
    >
      <span className={`size-3.5 rounded-full bg-white transition-transform ${on ? 'translate-x-3.5' : ''}`} />
    </span>
  );
}
const MINI_LOOK =
  'inline-flex items-center justify-center border border-brand-yellow/25 bg-brand-yellow/10 font-bold text-brand-brown transition dark:text-brand-yellow enabled:hover:bg-brand-yellow/20 disabled:cursor-not-allowed disabled:opacity-40';
const MINI_BTN = `${MINI_LOOK} h-7 rounded-lg px-2.5 text-xs`;
/* 面板裡的輸入欄與按鈕（選色盤、色碼、存色、存成快捷、取名）同一個高度、圓角、字級 */
const CTRL = 'h-9 rounded-[10px] text-[13px]';
const CTRL_BTN = `${MINI_LOOK} ${CTRL} px-3`;
const FIELD = `${CTRL} border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800`;

// 內部正值＝字幕提早出現。只寫正負號分不出是提早還是晚，滑桿讀數、摘要、讀屏文字都直接寫「提前／延後」
const describeOffset = (ms: number) => `${ms > 0 ? '提前' : '延後'} ${(Math.abs(ms) / 1000).toFixed(2)} 秒`;
const formatOffset = (ms: number) => (ms === 0 ? '0 秒' : describeOffset(ms));

/**
 * 影片下面的字幕設定列：字幕開關、字幕群開關、三個設定鈕一排（還原在樣式面板裡）。
 * 設定鈕各開一個小浮層（absolute，不推擠頁面）；一次只開一個。
 * 狀態與存檔都在上層，這裡只負責畫面。
 */
export default function SubtitleToolbar({
  state,
  stageRef,
  onChange,
  groupOn,
  onGroupChange,
  onSkip,
  children,
}: {
  state: SubtitleState;
  /** 影片舞台：字幕疊在它裡面，全螢幕要整個舞台一起，字幕才看得到 */
  stageRef: RefObject<HTMLElement | null>;
  onChange: Change;
  /** 影片下方「即時字幕群」卡片的開關，狀態在上層 */
  groupOn: boolean;
  onGroupChange: (on: boolean) => void;
  /** 設定列中間的倒退／快轉鈕，傳入要跳的秒數（負為倒退） */
  onSkip?: (delta: number) => void;
  /** 設定列右側、全螢幕之前多放的項目（播放進度與導航） */
  children?: ReactNode;
}) {
  const { on, cur, offset } = state;
  const uid = useId();
  const [open, setOpen] = useState<Tool | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Partial<Record<Tool, HTMLButtonElement | null>>>({});
  // 字幕關掉時設定鈕都停用，浮層也一併收起
  const active = on ? open : null;

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

  // 浮層是 absolute，工具列貼近視窗底部時會掉到畫面外：打開後把它捲進可視範圍（已看得到就不動）
  useEffect(() => {
    if (active) panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active]);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [stageRef]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else stageRef.current?.requestFullscreen().catch(() => {});
  };

  // iPhone 不支援把任意元素全螢幕：沒有這顆按鈕
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  const setStyle = (patch: Partial<SubtitleStyle>) => onChange({ cur: { ...cur, ...patch } });

  let panel: ReactNode = null;
  if (active === 'style') {
    panel = (
      <>
        <Slider
          label="位置"
          Icon={MoveVertical}
          value={cur.sb}
          range={SUBTITLE_RANGE.sb}
          format={v => `${v}%`}
          onChange={sb => setStyle({ sb })}
        />
        <Slider
          label="字號"
          Icon={CaseSensitive}
          value={cur.sf}
          range={SUBTITLE_RANGE.sf}
          format={v => v.toFixed(1)}
          onChange={sf => setStyle({ sf })}
        />
        <Slider label="粗細" Icon={Bold} value={cur.sw} range={SUBTITLE_RANGE.sw} format={String} onChange={sw => setStyle({ sw })} />
        <Slider
          label="描邊"
          Icon={Circle}
          iconStrokeWidth={3.4}
          value={cur.ss}
          range={SUBTITLE_RANGE.ss}
          format={v => v.toFixed(2)}
          onChange={ss => setStyle({ ss })}
        />
        <ColorPanel state={state} onChange={onChange} />
        <SaveSlot state={state} onChange={onChange} />
      </>
    );
  } else if (active === 'offset') {
    panel = (
      <>
        <Slider
          label="延遲"
          Icon={Timer}
          value={offset}
          range={SUBTITLE_RANGE.offset}
          format={formatOffset}
          wide
          onChange={v => onChange({ offset: v })}
        />
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
          手機上那組懸浮鈕會蓋住工具列右端的「目前設定」，按「畫面定位」之後更是剛好對上 */}
      <div ref={rootRef} className="@container relative z-[41]">
        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div role="group" aria-label="字幕設定" className="flex h-11 items-center gap-0.5 px-1">
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label="字幕"
              onClick={() => {
                setOpen(null);
                onChange({ on: !on });
              }}
              className={SWITCH_BTN}
            >
              <Captions size={16} aria-hidden="true" />
              <span className={LABEL}>字幕</span>
              <SwitchTrack on={on} />
            </button>
            {/* 影片下方卡片的開關，跟「字幕」同一款滑動開關 */}
            <button
              type="button"
              role="switch"
              aria-checked={groupOn}
              aria-label="即時字幕群"
              title="顯示／隱藏影片下方的即時字幕群"
              onClick={() => onGroupChange(!groupOn)}
              className={SWITCH_BTN}
            >
              <List size={16} aria-hidden="true" />
              <span className={LABEL}>字幕群</span>
              <SwitchTrack on={groupOn} />
            </button>

            <span className="min-w-0 flex-1" />

            {onSkip && (
              <>
                <button type="button" onClick={() => onSkip(-SKIP_SECONDS)} aria-label={`倒退 ${SKIP_SECONDS} 秒`} title={`倒退 ${SKIP_SECONDS} 秒`} className={BAR_BTN}>
                  <ChevronLeft size={16} aria-hidden="true" className="shrink-0" />
                  <span className={LABEL}>{SKIP_SECONDS} 秒</span>
                </button>
                <button type="button" onClick={() => onSkip(SKIP_SECONDS)} aria-label={`快轉 ${SKIP_SECONDS} 秒`} title={`快轉 ${SKIP_SECONDS} 秒`} className={BAR_BTN}>
                  <span className={LABEL}>{SKIP_SECONDS} 秒</span>
                  <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
                </button>
                <span className="min-w-0 flex-1" />
              </>
            )}

            {TOOLS.map(({ id, name, Icon }) => (
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
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                <span className={LABEL}>{name}</span>
              </button>
            ))}

          {children}
          <span aria-hidden="true" className="mx-1 hidden h-4 w-px shrink-0 bg-zinc-200 @min-[780px]:block dark:bg-zinc-700" />

            {canFullscreen && (
              <button
                type="button"
                disabled={!on}
                aria-label={isFullscreen ? '離開全螢幕' : '字幕全螢幕'}
                title={isFullscreen ? '離開全螢幕' : '字幕全螢幕（YouTube 內建全螢幕看不到字幕）'}
                onClick={toggleFullscreen}
                className={BAR_BTN}
              >
                {isFullscreen ? (
                  <Minimize size={16} aria-hidden="true" className="shrink-0" />
                ) : (
                  <Maximize size={16} aria-hidden="true" className="shrink-0" />
                )}
                <span className={LABEL}>全螢幕</span>
              </button>
            )}
          </div>
          </div>

        {active && (
          <div
            ref={panelRef}
            id={`${uid}-${active}`}
            role="group"
            aria-label={`${TOOLS.find(t => t.id === active)?.name}設定`}
            className="absolute left-0 top-[calc(100%+1rem)] z-[45] scroll-mb-4 grid w-[min(100%,26rem)] gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            {panel}
          </div>
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  Icon,
  iconStrokeWidth,
  value,
  range: [min, max, step],
  format,
  onChange,
  wide,
}: {
  label: string;
  Icon: LucideIcon;
  iconStrokeWidth?: number;
  /** 讀數是一句話（延遲的「提前 0.50 秒」）時用寬欄，數字讀數用窄欄貼著滑桿 */
  wide?: boolean;
  value: number;
  range: readonly [number, number, number];
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label
      className={`grid items-center gap-2.5 text-[13px] ${wide ? 'grid-cols-[3.4rem_minmax(0,1fr)_4.6rem]' : 'grid-cols-[3.4rem_minmax(0,1fr)_1.8rem]'}`}
    >
      <span className="flex items-center gap-1.5 font-semibold text-zinc-500 dark:text-zinc-400">
        <Icon size={14} strokeWidth={iconStrokeWidth} aria-hidden="true" className="shrink-0" />
        {label}
      </span>
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
      <output className="whitespace-nowrap text-right font-semibold tabular-nums">{format(value)}</output>
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
    <div className="grid grid-cols-[3.4rem_minmax(0,1fr)] items-center gap-x-2.5 border-t border-zinc-200 pt-2.5 dark:border-zinc-800">
      <span className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">描邊色</span>
      <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="描邊顏色" className="contents">
        {saved.map((c, i) => (
          <span key={c} className="relative">
            <button
              type="button"
              onClick={() => setColor(c)}
              aria-pressed={c === cur.c}
              aria-label={`描邊色 ${c.toUpperCase()}`}
              title={c.toUpperCase()}
              style={{ backgroundColor: c }}
              className="block size-6 rounded-full ring-1 ring-inset ring-white/20 aria-pressed:outline-2 aria-pressed:outline-zinc-900 dark:aria-pressed:outline-zinc-100"
            />
            {i >= SUBTITLE_FIXED_COLORS.length && (
              <button
                type="button"
                onClick={() => onChange({ saved: saved.filter(x => x !== c) })}
                aria-label={`刪除色塊 ${c.toUpperCase()}`}
                className="absolute -right-1.5 -top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-zinc-900 text-white ring-2 ring-white dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-900"
              >
                <X size={10} strokeWidth={3} aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
      </div>
        {/* 選色盤縮成欄位裡的小色塊，跟色碼合成一格：整列只剩「色球們＋一格色碼＋存色」 */}
        <div className={`${FIELD} flex min-w-[6.5rem] flex-1 items-center justify-center gap-2 px-2 focus-within:border-brand-yellow/50`}>
          <input
            type="color"
            value={cur.c}
            onChange={e => setColor(e.target.value)}
            aria-label="選色盤"
            className="size-5 shrink-0 cursor-pointer appearance-none border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-white/20"
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
            className="min-w-[4ch] -translate-y-px bg-transparent tabular-nums outline-none field-sizing-content"
          />
        </div>
        <button
          type="button"
          onClick={() => onChange({ saved: [...saved, cur.c] })}
          disabled={saved.includes(cur.c) || saved.length >= SUBTITLE_MAX_COLORS}
          aria-label="存成快捷色"
          title={saved.length >= SUBTITLE_MAX_COLORS ? `最多存 ${SUBTITLE_MAX_COLORS} 個，先刪掉一個` : '把目前的描邊色存成快捷色塊'}
          className={CTRL_BTN}
        >
          存色
        </button>
      </div>
    </div>
  );
}

const FLASH_TEXT = { reset: '已還原', def: '已設預設', slot: '已存快捷' };

/** 把目前整組樣式存進第一個空的快捷格；按下後出現名稱欄，留空就用預設的「快捷 N」直接存 */
function SaveSlot({ state: { cur, slots, names, def }, onChange }: { state: SubtitleState; onChange: Change }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  // 按完要有回應：按鈕短暫換成打勾＋「已…」，不然看不出有沒有存成功（4 字以內，手機窄按鈕才放得下）
  const [flash, setFlash] = useState<keyof typeof FLASH_TEXT | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  const ping = (k: keyof typeof FLASH_TEXT) => {
    clearTimeout(flashTimer.current);
    setFlash(k);
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  };
  const face = (k: keyof typeof FLASH_TEXT, Icon: LucideIcon, text: string) =>
    flash === k ? (
      <>
        <Check size={14} strokeWidth={3} aria-hidden="true" />
        {FLASH_TEXT[k]}
      </>
    ) : (
      <>
        <Icon size={14} aria-hidden="true" />
        {text}
      </>
    );
  const btn = (k: keyof typeof FLASH_TEXT) =>
    `${CTRL_BTN} flex-1 gap-1.5 ${flash === k ? 'animate-[btn-pop_0.35s_ease-out] border-brand-yellow/60 bg-brand-yellow/35!' : ''}`;
  const free = slots.indexOf(null);
  const done = () => {
    const n = name.trim().slice(0, SUBTITLE_NAME_MAX);
    if (free < 0) return;
    onChange({
      slots: slots.map((s, j) => (j === free ? { ...cur } : s)),
      names: names.map((x, j) => (j === free ? n : x)),
    });
    setNaming(false);
    setName('');
    ping('slot');
  };

  // 已有預設快捷就覆寫它（名稱保留）；沒有就存進第一個空格並設成預設，不問名字
  const target = def ?? (free < 0 ? null : free);
  const saveDefault = () => {
    if (target === null) return;
    onChange({ slots: slots.map((s, j) => (j === target ? { ...cur } : s)), def: target });
    ping('def');
  };

  if (!naming) {
    return (
      <div className="flex gap-2 border-t border-zinc-200 pt-2.5 dark:border-zinc-800">
        <button
          type="button"
          title={def === null ? '還原預設字幕樣式' : `還原成預設快捷：${names[def] || `快捷 ${def + 1}`}`}
          onClick={() => {
            onChange({ cur: (def !== null && slots[def]) || SUBTITLE_DEFAULT_STYLE });
            ping('reset');
          }}
          className={btn('reset')}
        >
          {face('reset', RotateCcw, '還原')}
        </button>
        <button
          type="button"
          disabled={target === null}
          title={
            target === null
              ? '三格都滿了，到「快捷」分頁清除一格'
              : def === null
                ? '把目前樣式存進空的快捷格，並設成預設（「還原」會回到它）'
                : `用目前樣式覆寫預設快捷：${names[def] || `快捷 ${def + 1}`}`
          }
          onClick={saveDefault}
          className={btn('def')}
        >
          {face('def', Pin, '存成預設')}
        </button>
        <button
          type="button"
          disabled={free < 0}
          title={free < 0 ? '三格都滿了，到「快捷」分頁清除一格' : '把目前的位置、字號、粗細、描邊與顏色存成一組快捷'}
          onClick={() => setNaming(true)}
          className={btn('slot')}
        >
          {face('slot', Star, '存成快捷')}
        </button>
        <span role="status" className="sr-only">
          {flash && FLASH_TEXT[flash]}
        </span>
      </div>
    );
  }
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        done();
      }}
      className="grid gap-2 border-t border-zinc-200 pt-2.5 dark:border-zinc-800"
    >
      <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400" htmlFor="slot-name">
        替這組快捷取個名字
      </label>
      <div className="flex gap-2">
        <input
          id="slot-name"
          autoFocus
          value={name}
          maxLength={SUBTITLE_NAME_MAX}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && (e.stopPropagation(), setNaming(false))}
          placeholder={`快捷 ${free + 1}`}
          className={`${FIELD} min-w-0 flex-1 px-2.5`}
        />
        <button type="submit" className={CTRL_BTN}>
          存好
        </button>
        <button type="button" onClick={() => setNaming(false)} className={`${CTRL_BTN} border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-700 dark:text-zinc-400`}>
          取消
        </button>
      </div>
    </form>
  );
}

function SlotsPanel({ state: { cur, slots, names, def }, onChange }: { state: SubtitleState; onChange: Change }) {
  const [editing, setEditing] = useState<number | null>(null);
  const put = (i: number, value: SubtitleStyle | null) =>
    onChange({ slots: slots.map((slot, j) => (j === i ? value : slot)), ...(value === null && def === i && { def: null }) });
  const rename = (i: number, name: string) => {
    setEditing(null);
    onChange({
      names: names.map((n, j) => (j === i ? name.trim().slice(0, SUBTITLE_NAME_MAX) : n)),
    });
  };

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
              {editing === i ? (
                <input
                  autoFocus
                  defaultValue={names[i]}
                  maxLength={SUBTITLE_NAME_MAX}
                  placeholder={`快捷 ${i + 1}`}
                  aria-label={`快捷 ${i + 1} 的名稱`}
                  onFocus={e => e.currentTarget.select()}
                  onBlur={e => rename(i, e.currentTarget.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    else if (e.key === 'Escape') setEditing(null);
                  }}
                  className="h-[19.5px] w-28 min-w-0 rounded border border-zinc-400 bg-transparent px-1 py-0 text-[13px] font-bold outline-none focus:border-amber-500"
                />
              ) : (
                <button
                  type="button"
                  title="點一下改名稱"
                  aria-label={`改名稱：${names[i] || `快捷 ${i + 1}`}`}
                  onClick={() => setEditing(i)}
                  className="truncate rounded text-left font-bold hover:underline"
                >
                  {names[i] || `快捷 ${i + 1}`}
                </button>
              )}
            </b>
            <small className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {def === i && <span className="mr-1.5 font-bold text-brand-brown dark:text-brand-yellow">預設</span>}
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
            <button
              type="button"
              disabled={!slot}
              aria-pressed={def === i}
              aria-label={`設為預設：快捷 ${i + 1}`}
              title="設成預設後，樣式面板的「還原」會回到這一組；再按一次取消"
              onClick={() => onChange({ def: def === i ? null : i })}
              className={MINI_BTN}
            >
              預設
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
