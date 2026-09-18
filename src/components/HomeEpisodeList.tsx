'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { formatDuration } from '@/lib/format';
import type { EpisodeListItem, EpisodeSection } from '@/lib/markdown';
import { useHomeLayout } from './HomeLayoutProvider';
import { readStoredString, useHydrated, writeStoredString } from '@/lib/client-state';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const NO_SUMMARY = '尚未整理摘要';

type MonthGroup = {
  key: string;
  year: number;
  month: number;
  episodes: EpisodeListItem[];
};

// 「2026-08-05」→ { year, month, day }，不經過 Date 以免受時區影響。
function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function weekdayOf(date: string) {
  const { year, month, day } = parseDate(date);
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
}

function monthDay(date: string) {
  const { month, day } = parseDate(date);
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

// 節目已依日期新到舊排好，照順序切成一個個月份即可。
function groupByMonth(episodes: EpisodeListItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];

  for (const episode of episodes) {
    const { year, month } = parseDate(episode.date);
    const key = `${year}-${month}`;
    const current = groups[groups.length - 1];

    if (current && current.key === key) {
      current.episodes.push(episode);
    } else {
      groups.push({ key, year, month, episodes: [episode] });
    }
  }

  return groups;
}

function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    // 標題跟旁註字級不同，文字走 baseline，色條另外置中
    <h2 className="text-xl font-bold mb-4 flex items-baseline gap-2">
      <span className="w-1 h-5 bg-brand-yellow rounded-full self-center" />
      {children}
      {note && <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{note}</span>}
    </h2>
  );
}

/** 段落目錄：無損還原的每個 ### 標題，limit 之後收成「還有 N 段」 */
function SectionList({ sections, limit }: { sections: EpisodeSection[]; limit?: number }) {
  const shown = limit ? sections.slice(0, limit) : sections;
  const rest = sections.length - shown.length;

  return (
    <ul className="grid gap-x-8 gap-y-0.5 sm:grid-cols-2">
      {shown.map((section, index) => (
        <li key={`${section.tag}-${index}`} className="text-[14px] leading-[1.7] text-zinc-600 dark:text-zinc-400">
          {section.tag && (
            <span className="font-mono text-[13px] tracking-wide text-brand-ochre dark:text-brand-yellow mr-2">
              {section.tag}
            </span>
          )}
          {section.title}
        </li>
      ))}
      {rest > 0 && (
        <li className="text-[14px] leading-[1.7] text-zinc-500 dark:text-zinc-400">還有 {rest} 段</li>
      )}
    </ul>
  );
}

/** 目錄一頁最多幾列。再多就換頁，讓每一列都留得下兩行標題 */
const SECTION_ROWS = 8;

/** 段落多的回次怎麼切頁：頁數先算出來，再把段落平均分到每一頁 */
function sectionPaging(total: number) {
  const columns = total > SECTION_ROWS ? 2 : 1;
  const pages = Math.max(1, Math.ceil(total / (columns * SECTION_ROWS)));
  const perPage = Math.ceil(total / pages);
  return { columns, rows: Math.ceil(perPage / columns), perPage, pages };
}

/** 卡片「目錄」那一面：標籤貼著標題（不占固定欄），一欄讀完再換下一欄，列高平分整個固定框 */
function SectionIndex({
  sections,
  page,
  onSelect,
}: {
  sections: EpisodeSection[];
  page: number;
  onSelect: (index: number) => void;
}) {
  const { columns, rows, perPage } = sectionPaging(sections.length);
  const start = page * perPage;
  const visible = sections.slice(start, start + perPage);

  return (
    // 手機寬度切兩欄，標題一行只剩四五個字，所以 sm 以下一律單欄往下排
    <ol
      className="h-full grid gap-x-5 sm:grid-flow-col sm:grid-cols-(--cols) sm:grid-rows-(--rows)"
      style={
        {
          '--cols': `repeat(${columns}, minmax(0, 1fr))`,
          '--rows': `repeat(${rows}, minmax(0, 1fr))`,
        } as React.CSSProperties
      }
    >
      {visible.map((section, index) => {
        const absolute = start + index;
        // 標題折成兩行時，標籤要貼齊第一行，不是浮在兩行中間
        const body = (
          <span className="min-w-0 flex items-baseline gap-2.5">
            {section.tag && (
              <span className="shrink-0 font-mono text-[14px] text-brand-ochre dark:text-brand-yellow">
                {section.tag}
              </span>
            )}
            <span className="min-w-0 line-clamp-2">{section.title}</span>
          </span>
        );

        return (
          // lg 以下卡片不定高，列高貼著字，要自己留上下空白才不會壓到分隔線
          <li
            key={`${absolute}-${section.tag}`}
            className="flex min-w-0 py-2 lg:py-0 border-b border-zinc-100 dark:border-zinc-800/70 text-[14px] leading-[1.45] text-zinc-600 dark:text-zinc-300"
          >
            {/* 還沒寫簡述的段落點開也沒東西看，就讓它留在底層的整卡連結上 */}
            {section.brief ? (
              <button
                type="button"
                onClick={() => onSelect(absolute)}
                className="group/row relative z-10 flex-1 min-w-0 flex items-center gap-2.5 text-left px-2 -mx-2 rounded-md hover:bg-brand-yellow/10 dark:hover:bg-zinc-800/60 transition-colors"
              >
                {body}
                <ChevronRight
                  size={14}
                  className="ml-auto shrink-0 opacity-0 group-hover/row:opacity-70 text-brand-ochre dark:text-brand-yellow transition-opacity"
                />
              </button>
            ) : (
              <div className="flex-1 min-w-0 flex items-center gap-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 「1 小時 3 分 · 11 段 · 207 句」，缺哪一項就少哪一項 */
function metaOf(episode: EpisodeListItem) {
  return [
    formatDuration(episode.durationMinutes),
    episode.sections.length ? `${episode.sections.length} 段` : '',
    episode.lineCount ? `${episode.lineCount} 句` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** 預覽：月曆點到哪一天，這裡就換成那一集。卡片大小固定，目錄與簡述在裡面換面 */
function EpisodePreview({ episode }: { episode: EpisodeListItem }) {
  const duration = formatDuration(episode.durationMinutes);
  const hasSections = episode.sections.length > 0;
  const [page, setPage] = useState(0);
  // null＝在看目錄，數字＝點開了第幾段
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { pages } = sectionPaging(episode.sections.length);

  // 換集數時收回目錄的第一頁
  const [lastId, setLastId] = useState(episode.id);
  if (lastId !== episode.id) {
    setLastId(episode.id);
    setOpenIndex(null);
    setPage(0);
  }

  const openSection = openIndex === null ? undefined : episode.sections[openIndex];

  return (
    <div className="group relative h-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-7 shadow-sm flex flex-col hover:border-brand-yellow/60 dark:hover:border-brand-yellow/50 transition-colors">
      {/* 整張卡片可點：連結鋪滿底層，頁籤靠 z-10 浮在上面 */}
      <Link
        href={`/episodes/${episode.id}`}
        aria-label={`看 ${episode.date} 這一回`}
        className="absolute inset-0 rounded-2xl"
      />

      {/* 手機寬度放不下一整列，時長換到日期下一行，不要把「週日」擠成兩行 */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3">
        <div className="flex items-baseline gap-3 font-mono text-2xl md:text-3xl font-bold tracking-tight">
          <span className="tabular-nums">{episode.date.replace(/-/g, '/')}</span>
          <span>週{weekdayOf(episode.date)}</span>
        </div>
        {duration && (
          <span className="shrink-0 inline-flex items-center gap-1.5 tabular-nums text-[13px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
            <Clock size={14} />
            {duration}
          </span>
        )}
      </div>

      {/* 這一列點開某一段時整條都是「回目錄」，不只箭頭；沒點開就放翻頁鈕。高度固定住，換內容時框不會跳 */}
      {hasSections &&
        (openSection ? (
          // 底線與間距留在外框，浮影只包住那一行字，才會上下置中
          <div className="flex mt-2 pb-2 min-h-[38px] border-b border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              aria-label="回目錄"
              title="回目錄"
              className="relative z-10 flex-1 min-w-0 flex items-center gap-2 px-2 -mx-2 rounded-md text-left hover:bg-brand-yellow/10 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="shrink-0 flex text-brand-ochre dark:text-brand-yellow">
                <ChevronLeft size={16} />
              </span>
              {/* 標籤是 mono、標題是內文字體，行高不同，置中會錯位，改用 baseline 對齊 */}
              <span className="min-w-0 flex items-baseline gap-2">
                {openSection.tag && (
                  <span className="shrink-0 font-mono text-[14px] text-brand-ochre dark:text-brand-yellow">
                    {openSection.tag}
                  </span>
                )}
                <span className="min-w-0 truncate text-[15px] text-zinc-600 dark:text-zinc-300">
                  {openSection.title}
                </span>
              </span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-2 pb-2 min-h-[38px] border-b border-zinc-100 dark:border-zinc-800">
            {pages > 1 && (
              <div className="relative z-10 ml-auto flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="上一頁目錄"
                  className="p-1 rounded-md disabled:opacity-30 enabled:hover:text-brand-ochre dark:enabled:hover:text-brand-yellow transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-mono tabular-nums text-[13px]">
                  {page + 1}/{pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                  disabled={page === pages - 1}
                  aria-label="下一頁目錄"
                  className="p-1 rounded-md disabled:opacity-30 enabled:hover:text-brand-ochre dark:enabled:hover:text-brand-yellow transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        ))}

      {/* 這一格的高度由 flex-1 決定，跟裝什麼無關：目錄、單段簡述、沒逐字稿的告示都吃同一個框 */}
      <div className="flex-1 min-h-0 grid [grid-template-rows:minmax(0,1fr)] pt-4">
        {/* 裡面的列用 px-2 -mx-2 讓底色往外長，裁切框要跟著讓開同樣寬度，
            否則左側 8px 會被 overflow-hidden 切掉。px 再把內容推回原位置 */}
        <div className="[grid-area:1/1] min-h-0 overflow-hidden -mx-2 px-2">
          {!hasSections ? (
            <p className="text-base leading-[1.85] text-zinc-500 dark:text-zinc-400 italic">
              {NO_SUMMARY}
              <span className="block not-italic text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                逐字稿還沒補上，點進去可以先看原片。
              </span>
            </p>
          ) : openSection ? (
            // 簡述整片是自己的連結：點它直接落到該段落，點卡片其他地方還是照舊進整集
            <Link
              href={`/episodes/${episode.id}#section-${(openIndex ?? 0) + 1}`}
              aria-label={`看「${openSection.title}」這一段`}
              className="relative z-10 block h-full min-h-0 px-2 -mx-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <SectionBrief section={openSection} index={openIndex ?? 0} total={episode.sections.length} />
            </Link>
          ) : (
            <SectionIndex sections={episode.sections} page={page} onSelect={setOpenIndex} />
          )}
        </div>
      </div>

      {/* 回次跟箭頭一起釘在底部，中間用一條橫槓跟內容隔開；上方留白跟卡片自己的下緣一樣寬，這一列才會落在正中間 */}
      <div className="mt-auto pt-6 md:pt-7 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3 text-[13px] tracking-wider text-zinc-500 dark:text-zinc-400">
          <span className="shrink-0 font-bold">{episode.episodeLabel || `第 ${episode.episodeNumber} 回`}</span>
          {episode.guest && <span className="truncate">來賓：{episode.guest}</span>}
        </div>
        <ArrowRight
          size={18}
          className="shrink-0 text-zinc-500 dark:text-zinc-400 group-hover:text-brand-ochre dark:group-hover:text-brand-yellow group-hover:translate-x-0.5 transition-all"
        />
      </div>
    </div>
  );
}

/** 點開目錄某一段之後的那一面：那一段的簡述，段號釘在框底 */
function SectionBrief({ section, index, total }: { section: EpisodeSection; index: number; total: number }) {
  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* 一段簡述撐不滿這個框，所以讓它置中、字級拉到跟卡片主體相稱，而不是黏在上緣留一大片空白 */}
      <div className="flex-1 min-h-0 flex items-center">
        <p className="max-w-[34em] text-[19px] leading-[1.9] text-zinc-600 dark:text-zinc-300">{section.brief}</p>
      </div>
      <span className="pt-3 font-mono tabular-nums text-[12px] text-zinc-500 dark:text-zinc-400">
        第 {index + 1} 段 / 共 {total} 段
      </span>
    </div>
  );
}

/** 月曆：一次只顯示一個月，點有播的日子就換預覽 */
function MonthCalendar({
  group,
  selectedId,
  onSelect,
  onStep,
  canPrev,
  canNext,
  maxMinutes,
}: {
  group: MonthGroup;
  selectedId: string;
  onSelect: (id: string) => void;
  onStep: (delta: number) => void;
  canPrev: boolean;
  canNext: boolean;
  maxMinutes: number;
}) {
  const byDay = new Map<number, EpisodeListItem>();
  for (const episode of group.episodes) {
    byDay.set(parseDate(episode.date).day, episode);
  }

  const firstWeekday = new Date(group.year, group.month - 1, 1).getDay();
  const daysInMonth = new Date(group.year, group.month, 0).getDate();
  // 一律補滿 6 週，切換月份時卡片高度才不會跳
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // 視覺仍是 28px，但用 ::before 把可點範圍撐到 40px。這兩顆各在一列的兩端，
  // 不像 SNS 圖示（gap 6px）或目錄翻頁（gap 4px）那樣擴大後會互相重疊
  const stepButton = 'relative before:absolute before:-inset-1.5 before:content-[""] w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 inline-flex items-center justify-center transition-colors enabled:hover:bg-brand-brown enabled:hover:text-brand-cream dark:enabled:hover:bg-brand-tan dark:enabled:hover:text-brand-ink disabled:opacity-30';

  return (
    // 格子高度跟著寬度走，卡片太寬格子就變巨大，lg 以下限成一張手機月曆的寬度
    <div className="h-full min-h-0 w-full max-w-96 lg:max-w-none mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button type="button" onClick={() => onStep(-1)} disabled={!canPrev} className={stepButton} aria-label="上個月">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-baseline gap-2">
          <span className="font-bold">
            {group.year} 年 {group.month} 月
          </span>
          <span className="font-mono tabular-nums text-[13px] text-zinc-500 dark:text-zinc-400">
            {group.episodes.length} 回
          </span>
        </div>
        <button type="button" onClick={() => onStep(1)} disabled={!canNext} className={stepButton} aria-label="下個月">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            {weekday}
          </div>
        ))}
      </div>

      {/* 格子比例固定，高度不跟著視窗變形；正方形看起來會偏高，壓 6% 才像方的 */}
      <div className="grid grid-cols-7 gap-1 shrink-0 [&>*]:aspect-[16/15]">
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} />;

          const episode = byDay.get(day);
          if (!episode) {
            return (
              <div
                key={day}
                className="flex items-center justify-center rounded-lg font-mono tabular-nums text-[13px] text-zinc-500 dark:text-zinc-400"
              >
                {day}
              </div>
            );
          }

          const isSelected = episode.id === selectedId;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(episode.id)}
              aria-pressed={isSelected}
              title={`${episode.date}　${episode.episodeLabel || `第 ${episode.episodeNumber} 回`}`}
              className={`flex items-center justify-center rounded-lg font-mono tabular-nums text-[13px] font-bold transition-colors ${
                isSelected
                  ? 'bg-brand-brown text-brand-cream dark:bg-brand-tan dark:text-brand-ink'
                  : 'bg-brand-yellow/10 dark:bg-brand-yellow/12 text-brand-brown dark:text-brand-yellow hover:bg-brand-yellow/25 dark:hover:bg-brand-yellow/25'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <MonthDigest group={group} selectedId={selectedId} onSelect={onSelect} maxMinutes={maxMinutes} />

      <div className="mt-auto pt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-brand-yellow/25" />
          有直播
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-brand-brown dark:bg-brand-tan" />
          目前選取
        </span>
      </div>
    </div>
  );
}

/** 長條旁邊的時長：未滿一小時只寫分鐘，超過寫「1:05」，右對齊後位數自己會排好 */
function clockOf(minutes: number | undefined) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** 月曆底下的該月概況：一回一條，長度就是直播長度 */
function MonthDigest({
  group,
  selectedId,
  onSelect,
  maxMinutes,
}: {
  group: MonthGroup;
  selectedId: string;
  onSelect: (id: string) => void;
  maxMinutes: number;
}) {
  const totalMinutes = group.episodes.reduce((sum, episode) => sum + (episode.durationMinutes ?? 0), 0);
  const totalSections = group.episodes.reduce((sum, episode) => sum + episode.sections.length, 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
      <p className="tabular-nums text-xs leading-none text-zinc-500 dark:text-zinc-400 mb-2.5">
        {[
          `${group.episodes.length} 回`,
          totalMinutes > 0 ? formatDuration(totalMinutes) : '',
          totalSections > 0 ? `${totalSections} 段` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {/* 長條想要 28px，位置不夠就一起壓扁；回數少的月份則置中，空白平均分在上下 */}
      <div className="flex-1 min-h-0 overflow-y-auto -mr-1 pr-1 flex flex-col justify-center">
        {[...group.episodes].reverse().map((episode) => {
          const minutes = episode.durationMinutes ?? 0;
          const isSelected = episode.id === selectedId;
          return (
            <button
              key={episode.id}
              type="button"
              onClick={() => onSelect(episode.id)}
              aria-pressed={isSelected}
              title={`${episode.date}　${episode.episodeLabel || `第 ${episode.episodeNumber} 回`}`}
              className="group w-full flex-[0_1_28px] min-h-[16px] flex items-center gap-3"
            >
              <span
                className={`w-7 shrink-0 text-left font-mono tabular-nums text-xs transition-colors ${
                  isSelected
                    ? 'text-brand-ochre dark:text-brand-yellow'
                    : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200'
                }`}
              >
                {monthDay(episode.date).slice(3)}
              </span>
              <span className="relative flex-1 h-[6px] rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span
                  className={`block h-full rounded-full transition-colors ${
                    isSelected
                      ? 'bg-brand-brown dark:bg-brand-tan'
                      : 'bg-brand-yellow/40 group-hover:bg-brand-yellow/70'
                  }`}
                  style={{ width: maxMinutes ? `${Math.max(6, (minutes / maxMinutes) * 100)}%` : '0%' }}
                />
                {/* 一小時的刻度，不看數字也知道誰過線了 */}
                {maxMinutes > 60 && (
                  <span
                    className="absolute top-[-2px] bottom-[-2px] w-px bg-zinc-300 dark:bg-zinc-600"
                    style={{ left: `${(60 / maxMinutes) * 100}%` }}
                  />
                )}
              </span>
              <span
                className={`w-9 shrink-0 text-right font-mono tabular-nums text-xs transition-colors ${
                  isSelected
                    ? 'text-brand-ochre dark:text-brand-yellow'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {clockOf(minutes)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 全部紀錄：一集一列，點列去那一回，點箭頭在原地展開段落目錄 */
function EpisodeRow({ episode, isSelected }: { episode: EpisodeListItem; isSelected: boolean }) {
  // 滑過去就展開；點箭頭可以釘住，觸控裝置沒有 hover 時也用得到
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hasSections = episode.sections.length > 0;
  const meta = metaOf(episode);
  const open = hasSections && (hovered || pinned);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`border-b border-zinc-100 dark:border-zinc-800/80 transition-colors ${
        isSelected
          ? 'bg-brand-yellow/10 dark:bg-zinc-900 shadow-[inset_2px_0_0_var(--color-brand-brown)] dark:shadow-[inset_2px_0_0_var(--color-brand-tan)]'
          : 'hover:bg-brand-yellow/5 dark:hover:bg-zinc-900'
      }`}
    >
      <div className="flex items-center gap-1">
        <Link
          href={`/episodes/${episode.id}`}
          className="group flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0 px-2 sm:px-3 py-3 rounded-xl"
        >
          <span className="w-[4.2rem] shrink-0 font-mono tabular-nums text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {monthDay(episode.date)}
            <span className="ml-1 text-xs font-normal text-zinc-600 dark:text-zinc-400">
              {weekdayOf(episode.date)}
            </span>
          </span>

          <span
            className={`shrink-0 px-3 py-1 rounded-full text-[13px] font-bold tracking-wider ${
              isSelected
                ? 'bg-brand-brown text-brand-cream dark:bg-brand-tan dark:text-brand-ink'
                : 'bg-brand-yellow/10 dark:bg-zinc-800 text-brand-brown dark:text-brand-yellow'
            }`}
          >
            {episode.episodeLabel || `第 ${episode.episodeNumber} 回`}
          </span>

          {episode.guest && (
            <span className="shrink-0 px-3 py-1 rounded-full text-[13px] font-bold tracking-wider bg-brand-yellow/10 dark:bg-zinc-800 text-brand-brown dark:text-brand-yellow">
              來賓：{episode.guest}
            </span>
          )}

          <span className="font-mono tabular-nums text-[13px] text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-300 transition-colors">
            {meta || NO_SUMMARY}
          </span>
        </Link>

        {hasSections && (
          <button
            type="button"
            onClick={() => setPinned((value) => !value)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
            aria-expanded={open}
            aria-label={open ? '收合段落目錄' : '展開段落目錄'}
            className="shrink-0 w-8 h-8 mr-1 rounded-lg inline-flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-brand-ochre dark:hover:text-brand-yellow hover:bg-brand-yellow/10 dark:hover:bg-zinc-800 transition-colors"
          >
            <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {open && (
        <div className="px-2 sm:px-3 pb-4 pl-2 sm:pl-[5.2rem]">
          <SectionList sections={episode.sections} />
        </div>
      )}
    </div>
  );
}

const SELECTED_STORAGE_KEY = 'jurii-selected-episode';

export default function HomeEpisodeList({ episodes }: { episodes: EpisodeListItem[] }) {
  const { showCalendar } = useHomeLayout();

  const groups = groupByMonth(episodes);
  // 月曆由舊到新排，箭頭往右＝往後翻
  const months = [...groups].reverse();
  const latest = episodes[0];

  // 長條共用同一把尺，跨月份才比得出誰長誰短
  const maxMinutes = episodes.reduce((max, episode) => Math.max(max, episode.durationMinutes ?? 0), 0);

  // 上次點的日期。SSR 跟首次 client render 一律當作沒有，掛載後才採用，
  // 不然 hydration 對不起來。集數被刪掉時 find 找不到，自動退回最新一集。
  const mounted = useHydrated();
  const [storedId] = useState(() => readStoredString(SELECTED_STORAGE_KEY));
  const [pickedId, setPickedId] = useState<string | null>(null);
  // 箭頭翻月只改月曆顯示的月份，不動選取；選新的一集就把它清掉
  const [steppedMonth, setSteppedMonth] = useState<number | null>(null);

  if (episodes.length === 0) return null;

  const selected =
    episodes.find((episode) => episode.id === (pickedId ?? (mounted ? storedId : null))) ?? latest;

  const handleSelect = (id: string) => {
    setPickedId(id);
    setSteppedMonth(null);
    writeStoredString(SELECTED_STORAGE_KEY, id);
  };

  // 沒翻頁的話，月曆就停在選取那一集所在的月份
  const selectedDate = parseDate(selected.date);
  const selectedMonth = months.findIndex(
    (group) => group.year === selectedDate.year && group.month === selectedDate.month,
  );
  const monthIndex = steppedMonth ?? (selectedMonth >= 0 ? selectedMonth : months.length - 1);
  const currentMonth = months[Math.min(monthIndex, months.length - 1)];

  return (
    <div className="max-w-4xl mx-auto mb-20 flex flex-col gap-10">
      {/* 卡片高度寫死：目錄與簡述在同一個框裡換面，框不跟著內容變形 */}
      {showCalendar && (
        <section className="grid gap-4 lg:h-[calc(100svh-7.75rem)] lg:min-h-[30rem] lg:max-h-[44rem] lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_20.5rem] items-stretch">
          <div className="order-2 lg:order-1 min-h-0">
            <EpisodePreview episode={selected} />
          </div>
          <div className="order-1 lg:order-2 min-h-0">
            <MonthCalendar
              group={currentMonth}
              selectedId={selected.id}
              onSelect={handleSelect}
              onStep={(delta) => setSteppedMonth(monthIndex + delta)}
              canPrev={monthIndex > 0}
              canNext={monthIndex < months.length - 1}
              maxMinutes={maxMinutes}
            />
          </div>
        </section>
      )}

      <section>
        <SectionTitle note={`共 ${episodes.length} 回`}>全部紀錄</SectionTitle>
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="flex items-baseline gap-3 pb-2 mb-1 border-b border-zinc-200 dark:border-zinc-800">
                <span className="font-bold">
                  {group.year} 年 {group.month} 月
                </span>
                <span className="font-mono tabular-nums text-[13px] text-zinc-500 dark:text-zinc-400">
                  {group.episodes.length} 回
                </span>
              </div>
              {group.episodes.map((episode) => (
                <EpisodeRow
                  key={episode.id}
                  episode={episode}
                  isSelected={showCalendar && episode.id === selected.id}
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
