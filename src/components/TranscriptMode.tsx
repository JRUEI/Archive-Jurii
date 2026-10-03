'use client';

import { useState, useRef, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import { EpisodeCard, EpisodeData } from '@/lib/markdown';
import {
  readStoredNumber,
  readStoredString,
  useHydrated,
  writeStoredNumber,
  writeStoredString,
} from '@/lib/client-state';
import { scrollBehavior } from '@/lib/motion';
import {
  buildSubtitleRows,
  DEFAULT_SUBTITLE_STATE,
  parseSubtitleState,
  SUBTITLE_STORAGE_KEY,
  type SubtitleState,
} from '@/lib/subtitle';
import { Search, Play, X, FileText, Crosshair, LayoutList, Pin, ChevronDown, RectangleHorizontal } from 'lucide-react';
import SubtitleOverlay from './SubtitleOverlay';
import SubtitleToolbar, { BAR_BTN, LABEL } from './SubtitleToolbar';

const GROUP_SIZE_STORAGE_KEY = 'jurii-transcript-group-size';
const DEFAULT_GROUP_SIZE = 4;
const GROUP_CARD_STORAGE_KEY = 'jurii-transcript-group-card';

/** 站上的實心強調色，跟月曆翻頁鈕同一套 */
const SOLID_ACCENT =
  'bg-brand-brown text-brand-cream dark:bg-brand-tan dark:text-brand-ink';
/** 淡底強調，用在標籤與次要按鈕 */
const SOFT_ACCENT =
  'bg-brand-yellow/10 text-brand-brown dark:text-brand-yellow border border-brand-yellow/25';

/* YouTube IFrame API 只用到這幾支，就不整包型別拉進來了 */
interface YouTubePlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  getCurrentTime: () => number;
  destroy: () => void;
  /** 沒有文件、但嵌入播放器有：關掉原生字幕模組。缺了就當沒這個功能 */
  unloadModule?: (name: string) => void;
}

interface YouTubePlayerOptions {
  videoId: string;
  playerVars: Record<string, number>;
  events: {
    onReady: () => void;
    onStateChange: (event: { data: number }) => void;
  };
}

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: YouTubePlayerOptions) => YouTubePlayer;
      PlayerState: { PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// 時間字串轉換為秒數 (支援 MM:SS 或 HH:MM:SS)
function timeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  } else if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return 0;
}

// 從 YouTube URL 提取 videoId
function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|v)\/))([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

export default function TranscriptMode({
  episode,
  active = true,
  onReturn,
}: {
  episode: EpisodeData;
  /** 不在逐字稿分頁時為 false：整塊藏起來但不卸載（卸載會銷毀播放器、聲音就斷了），並在角落浮出「回逐字稿」鈕 */
  active?: boolean;
  onReturn?: () => void;
}) {
  const videoId = extractYouTubeId(episode.youtubeUrl);

  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [, setIsPlayerReady] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [landscape, setLandscape] = useState<boolean>(false);

  // 抽屜分頁：逐字稿 ↔ 段落紀錄（段落沒有時間碼，只能對照，不能跳轉）
  const [drawerTab, setDrawerTab] = useState<'lines' | 'sections'>('lines');
  // 釘選中的段落：切回逐字稿分頁時固定在搜尋框下方，一次只釘一段
  const [pinnedCard, setPinnedCard] = useState<number | null>(null);
  const [isPinExpanded, setIsPinExpanded] = useState<boolean>(true);
  const [openCards, setOpenCards] = useState<ReadonlySet<number>>(() => new Set());

  const toggleCard = useCallback((idx: number) => {
    setOpenCards(prev => {
      const next = new Set(prev);
      if (!next.delete(idx)) next.add(idx);
      return next;
    });
  }, []);

  const togglePin = useCallback((idx: number) => {
    setPinnedCard(prev => (prev === idx ? null : idx));
    setIsPinExpanded(true);
  }, []);

  // 自訂字幕群句數（預設 4 句，可自訂 1~5 句，純狀態調整，絕不中斷或重啟影片）
  const [storedGroupSize, setStoredGroupSize] = useState(() =>
    readStoredNumber(GROUP_SIZE_STORAGE_KEY, DEFAULT_GROUP_SIZE, 1, 5),
  );
  const hydrated = useHydrated();
  // 伺服器不知道使用者存了什麼，所以水合前一律先照預設值畫，避免對不起來
  const groupSize = hydrated ? storedGroupSize : DEFAULT_GROUP_SIZE;

  const handleSetGroupSize = useCallback((num: number) => {
    setStoredGroupSize(num);
    writeStoredNumber(GROUP_SIZE_STORAGE_KEY, num);
  }, []);

  // 影片下方「即時字幕群」卡片的開關（跟影片上的字幕是兩回事），預設開，記住上次選擇
  const [storedShowGroupCard, setStoredShowGroupCard] = useState(
    () => readStoredString(GROUP_CARD_STORAGE_KEY) !== '0',
  );
  const showGroupCard = hydrated ? storedShowGroupCard : true;
  const handleGroupCardChange = (on: boolean) => {
    setStoredShowGroupCard(on);
    writeStoredString(GROUP_CARD_STORAGE_KEY, on ? '1' : '0');
  };

  // 影片上的字幕：開關、樣式、快捷、延遲整包存在同一個 key。水合前一律用預設（預設是關）
  const [storedSubtitle, setStoredSubtitle] = useState(() =>
    parseSubtitleState(readStoredString(SUBTITLE_STORAGE_KEY)),
  );
  const subtitle = hydrated ? storedSubtitle : DEFAULT_SUBTITLE_STATE;
  const handleSubtitleChange = (patch: Partial<SubtitleState>) => {
    const next = { ...subtitle, ...patch };
    setStoredSubtitle(next);
    writeStoredString(SUBTITLE_STORAGE_KEY, JSON.stringify(next));
  };

  const playerRef = useRef<YouTubePlayer | null>(null);
  const theaterRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const drawerRef = useRef<HTMLElement>(null);

  // 一鍵平滑滾動畫面：底部對齊字幕群底下空白的中間，剛好露出上方影片時間軸
  const scrollToTheaterView = useCallback(() => {
    const subtitleEl = document.getElementById('transcript-subtitle-group');
    const playerEl = document.getElementById('transcript-player-stage');

    if (subtitleEl) {
      const subtitleRect = subtitleEl.getBoundingClientRect();
      const subtitleBottom = window.scrollY + subtitleRect.bottom;

      // 字幕群底下留 10px 再對齊
      const midBlankY = subtitleBottom + 10;

      // 定位後的底部對齊字幕群底下空白的中間 (window.scrollY + window.innerHeight = midBlankY)
      let targetScrollY = midBlankY - window.innerHeight;

      // 安全限制：若視窗極高，最多只往上捲至播放器頂部（與 sticky navbar 保持 16px 間隔）
      if (playerEl) {
        const playerRect = playerEl.getBoundingClientRect();
        const playerTop = window.scrollY + playerRect.top;
        const navbarHeight = 64;
        const minScrollY = playerTop - navbarHeight - 16;
        if (targetScrollY < minScrollY) {
          targetScrollY = minScrollY;
        }
      }

      window.scrollTo({ top: Math.max(0, targetScrollY), behavior: scrollBehavior() });
    } else if (playerEl) {
      playerEl.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }
  }, []);

  // 從別的分頁切回來（頂端分頁鈕或角落的「回逐字稿」鈕）時，落在播放器與字幕群：別的分頁捲得很深，回來頁面變短，視窗不一定剛好對到播放器
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) scrollToTheaterView();
    wasActive.current = active;
  }, [active, scrollToTheaterView]);

  // 加上列序號。seconds 在 markdown.ts 就解析好了（含 0.1 秒小數），這裡不能拿 time 重算：time 是整秒，會把小數洗掉
  const parsedLines = useMemo(() => {
    return (episode.transcript || []).map((line, idx) => ({ ...line, index: idx }));
  }, [episode.transcript]);

  const subtitleRows = useMemo(() => buildSubtitleRows(parsedLines), [parsedLines]);

  // 正下方顯示的即時字幕群（預設 4 句，目前 timecode 對應第二句，容錯時間延遲並方便提前預讀）
  const currentGroupLines = useMemo(() => {
    if (parsedLines.length === 0) return [];
    const offset = groupSize >= 2 ? 1 : 0;
    const baseIdx = Math.max(0, activeIndex >= 0 ? activeIndex - offset : 0);
    return parsedLines.slice(baseIdx, baseIdx + groupSize);
  }, [parsedLines, activeIndex, groupSize]);

  // 字幕群時間欄寬（ch）：時間遞增，最後一列字最多；整集固定寬，播放中不會跳動
  const timeCh = parsedLines.at(-1)?.time.length ?? 5;

  // 二分查找當前秒數落在哪一句話
  const findActiveIndex = useCallback(
    (time: number): number => {
      if (parsedLines.length === 0) return -1;
      let low = 0;
      let high = parsedLines.length - 1;
      let result = -1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (parsedLines[mid].seconds <= time) {
          result = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return result;
    },
    [parsedLines],
  );

  const findActiveIndexRef = useRef(findActiveIndex);
  useEffect(() => {
    findActiveIndexRef.current = findActiveIndex;
  }, [findActiveIndex]);

  // 跳轉至特定秒數並播放
  const seekTo = useCallback((sec: number, targetIdx?: number) => {
    const player = playerRef.current;
    if (player) {
      player.seekTo(sec, true);
      player.playVideo();
    }
    if (typeof targetIdx === 'number') {
      setActiveIndex(targetIdx);
    }
  }, []);

  // 相對目前進度前後跳（不改播放／暫停狀態）
  const skipBy = useCallback((delta: number) => {
    const player = playerRef.current;
    if (!player) return;
    const sec = Math.max(0, player.getCurrentTime() + delta);
    player.seekTo(sec, true);
    const idx = findActiveIndexRef.current(sec);
    if (idx !== -1) setActiveIndex(idx);
  }, []);

  // 立即平滑滾動定位至當前播放句（免手動滑動滾輪）
  const scrollToActive = useCallback(() => {
    if (activeIndex < 0) return;
    lineRefs.current[activeIndex]?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, [activeIndex]);

  // 啟動進度輪詢器 (每 200ms)
  const startProgressLoop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const time = player.getCurrentTime();
      if (typeof time !== 'number') return;
      const idx = findActiveIndexRef.current(time);
      if (idx !== -1) {
        setActiveIndex(prev => (prev !== idx ? idx : prev));
      }
    }, 200);
  }, []);

  const startProgressLoopRef = useRef(startProgressLoop);
  useEffect(() => {
    startProgressLoopRef.current = startProgressLoop;
  }, [startProgressLoop]);

  // 當 activeIndex 改變且開啟 autoScroll 時，平滑置中滾動抽屜內的逐字稿
  useEffect(() => {
    if (!autoScroll || activeIndex < 0 || !isDrawerOpen) return;
    lineRefs.current[activeIndex]?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, [activeIndex, autoScroll, isDrawerOpen]);

  // 抽屜開啟時自動平滑置中當前句
  useEffect(() => {
    if (!isDrawerOpen || activeIndex < 0) return;
    const timer = setTimeout(() => {
      lineRefs.current[activeIndex]?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    }, 150);
    return () => clearTimeout(timer);
  }, [isDrawerOpen, activeIndex]);

  // 手機橫向放大：播放器鋪滿視窗（樣式在 globals.css 的 .stage-landscape）。只切 class、不動 iframe，播放不會斷
  useEffect(() => {
    if (!landscape) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLandscape(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [landscape]);

  // 監聽鍵盤 Escape 鍵關閉抽屜
  // 開啟時焦點送進面板、鎖住背景捲動；關閉時還原。
  // 原本手機上滑抽屜，底下的頁面會跟著滾
  useEffect(() => {
    if (!isDrawerOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  // 初始化 YouTube IFrame API
  useEffect(() => {
    if (!videoId) return;

    let isMounted = true;

    // 站上有自己的字幕（疊層與字幕群），YouTube 原生 CC 一律關掉，不然帳號或瀏覽器開了 CC 就會兩層字幕疊在一起
    function closeNativeCaptions() {
      try {
        playerRef.current?.unloadModule?.('captions');
      } catch {
        // 播放器還沒準備好或這支沒有該方法，下次狀態變化再試
      }
    }

    function initPlayer() {
      if (!window.YT?.Player) return;
      if (playerRef.current) return;
      if (!document.getElementById('transcript-yt-player')) return;

      try {
        playerRef.current = new window.YT.Player('transcript-yt-player', {
          videoId: videoId!,
          playerVars: {
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1,
            cc_load_policy: 0, // 0 是「照觀看者自己的 YouTube 設定」，不是強制關；真正關掉靠 closeNativeCaptions
            iv_load_policy: 3, // 關閉註解
          },
          events: {
            onReady: () => {
              if (!isMounted) return;
              closeNativeCaptions();
              setIsPlayerReady(true);
              startProgressLoopRef.current();
            },
            onStateChange: event => {
              if (!isMounted) return;
              if (event.data === window.YT?.PlayerState.PLAYING) {
                // 字幕模組常在第一次播放才載入，ready 時關過一次還不夠
                closeNativeCaptions();
                startProgressLoopRef.current();
              }
            },
          },
        });
      } catch (err) {
        console.error('Failed to initialize YouTube player:', err);
      }
    }

    if (window.YT?.Player) {
      initPlayer();
    } else {
      // 載入 YouTube API Script
      if (!document.getElementById('youtube-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        if (isMounted) initPlayer();
      };
    }

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // 播放器可能已經被 iframe 自己收掉了，這裡不需要吵
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  if (!episode.transcript || episode.transcript.length === 0) {
    if (!active) return null;
    return (
      <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 md:p-12 shadow-xl flex items-center justify-center min-h-[300px]">
        <p className="text-zinc-500 text-lg">目前此集數尚未提供逐字稿。</p>
      </div>
    );
  }

  // 搜尋過濾
  const filteredLines = parsedLines.filter(line => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    return line.text.toLowerCase().includes(kw);
  });

  const cards = episode.cards || [];
  // 同一個搜尋框在段落分頁改搜標題、簡述與條列
  const filteredCards = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => {
      if (!searchKeyword.trim()) return true;
      const kw = searchKeyword.toLowerCase();
      return [card.tag, card.title, card.brief ?? '', ...card.content]
        .join('\n')
        .toLowerCase()
        .includes(kw);
    });

  const isSectionTab = drawerTab === 'sections';
  const pinned = pinnedCard !== null ? cards[pinnedCard] : undefined;

  return (
    <>
    <div className={active ? 'w-full' : 'hidden'}>
      {/* 劇院居中主容器 */}
      {/* 有影片時整塊（播放器起算）至少撐到視窗高：捲到最底時影片剛好能貼在固定列正下方。
          72px＝固定列 65px＋7px 空隙，112px＝72px＋EpisodeViewer 的 py-10 底距；lvh 取最大視窗高，行動版網址列收起時也不會差一截 */}
      <div className={`max-w-4xl mx-auto flex flex-col gap-4 ${videoId ? 'min-h-[calc(100lvh-112px)]' : ''}`}>

        {/* 1. 居中 YouTube 播放器 (16:9)，底下接字幕設定列。
            字幕疊層預設關閉；開了也是 pointer-events-none，影片上的操作與時間軸都不受影響。
            疊層放在 YouTube 取代掉的那個 div 後面，React 往它前面插節點會找不到參照 */}
        {videoId && (
          <div className="flex flex-col gap-4">
            <div
              id="transcript-player-stage"
              ref={theaterRef}
              className={`@container scroll-mt-20 relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl [&:fullscreen]:rounded-none [&:fullscreen]:border-0 ${landscape ? 'stage-landscape' : ''}`}
            >
              <div id="transcript-yt-player" className="w-full h-full"></div>
              {subtitle.on && (
                <SubtitleOverlay
                  playerRef={playerRef}
                  rows={subtitleRows}
                  style={subtitle.cur}
                  offsetMs={subtitle.offset}
                />
              )}
              {landscape && (
                <button
                  type="button"
                  onClick={() => setLandscape(false)}
                  aria-label="退出橫向放大"
                  title="退出橫向放大 (Esc)"
                  className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </div>
            <SubtitleToolbar
              state={subtitle}
              stageRef={theaterRef}
              onChange={handleSubtitleChange}
              groupOn={showGroupCard}
              onGroupChange={handleGroupCardChange}
              onSkip={skipBy}
            >
              {/* 進度與導航：併進字幕工具列同一排（右側，全螢幕之前） */}
              <button
                type="button"
                onClick={scrollToTheaterView}
                aria-label="畫面定位"
                title="畫面定位：一鍵將畫面視角平滑置中對齊至播放器與字幕"
                className={BAR_BTN}
              >
                <Crosshair size={16} aria-hidden="true" className="shrink-0" />
                <span className={LABEL}>畫面定位</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                aria-label={`完整字幕（${parsedLines.length} 句）`}
                title={`展開完整逐字稿與搜尋（${parsedLines.length} 句）`}
                className={BAR_BTN}
              >
                <Search size={16} aria-hidden="true" className="shrink-0" />
                <span className={LABEL}>完整字幕</span>
              </button>
              {/* 只給觸控裝置：iPhone 的瀏覽器沒有元素全螢幕（上面那顆全螢幕鈕不會出現），這顆自己鋪滿並轉橫 */}
              <button
                type="button"
                onClick={() => setLandscape(true)}
                aria-label="橫向放大"
                title="橫向放大：播放器鋪滿畫面並轉成橫的"
                className={`${BAR_BTN} pointer-fine:hidden`}
              >
                <RectangleHorizontal size={16} aria-hidden="true" className="shrink-0" />
                <span className={LABEL}>橫向放大</span>
              </button>
            </SubtitleToolbar>
          </div>
        )}

        {/* 2. 影片正下方「即時字幕群卡片」（可自訂 1~5 句） */}
        {showGroupCard && currentGroupLines.length > 0 && (
          <div
            id="transcript-subtitle-group"
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 pt-3 sm:pt-4 shadow-lg flex flex-col gap-2.5"
          >
            {/* 標題列的 pb 跟卡片的 pt-3 sm:pt-4 同值：上緣離卡片邊 = 下緣離分隔線，字才會落在這一段的正中；要調鬆緊兩處一起改 */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 pb-3 sm:pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
              <span className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-200">
                <span className="w-2 h-2 rounded-full bg-brand-yellow animate-ping"></span>
                即時字幕群<span className="max-sm:hidden">（{groupSize} 句同步）</span>
              </span>
              {/* 手機只留標題和按鈕一排；句數按鈕本身就看得出目前幾句 */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="max-sm:hidden text-[13px] text-zinc-500 dark:text-zinc-400">顯示句數：</span>
                <div className="inline-flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleSetGroupSize(num);
                      }}
                      className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold transition-all ${
                        groupSize === num
                          ? `${SOLID_ACCENT} shadow-sm`
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                      title={`字幕群顯示 ${num} 句`}
                    >
                      {num}句
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 無框對話流（劇本台詞風，消除多餘方框） */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 flex flex-col">
              {currentGroupLines.map(line => (
                <button
                  key={line.index}
                  type="button"
                  onClick={() => seekTo(line.seconds, line.index)}
                  className="group w-full text-left py-2.5 sm:py-3 px-2 sm:px-3 flex items-start sm:gap-3 rounded-xl cursor-pointer hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-[background-color] duration-200"
                  title="點擊跳轉影片至此秒數"
                >
                  {/* 時間：桌面是純數字欄，手機只留給螢幕閱讀器（max-sm:sr-only）省下 72px 寬。
                      欄寬 = 這組最長的時間字數（ch），各列文字左緣才切齊。
                      高度 = 內文行高（sm:text-base × leading-relaxed = 26px），時間在裡面置中，
                      對到內文第一行；sm:top-[…] 是字型字面中心的校正值，換字型或字級要重量 */}
                  <span
                    className="max-sm:sr-only sm:flex sm:h-[26px] sm:w-(--time-w) sm:shrink-0 sm:items-center sm:relative sm:top-[1px] font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-500 transition-colors group-hover:text-brand-brown dark:group-hover:text-brand-tan"
                    style={{ '--time-w': `${timeCh}ch` } as CSSProperties}
                  >
                    {line.time}
                  </span>

                  {/* 對話內文。全站都是單人直播，這張卡片不顯示說話者（抽屜裡仍有）。
                      button 裡只能放 phrasing content，所以這幾層都是 span */}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm sm:text-base leading-relaxed text-zinc-900 dark:text-zinc-100 font-medium">
                      {line.text}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. 常駐畫面右側邊緣的懸浮快捷按鈕群 */}
      {/* 內容欄最寬 max-w-4xl(896px)，兩側餘白放得下這組鈕才顯示（xl 起）；
          更窄時會壓在影片、字幕工具列上，同樣兩個動作控制列裡都有 */}
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2.5">
        {/* 畫面定位按鈕 */}
        <button
          type="button"
          onClick={scrollToTheaterView}
          className="bg-white/95 dark:bg-zinc-900/95 hover:bg-brand-yellow/10 text-brand-ochre dark:text-brand-yellow font-bold p-2.5 sm:p-3 rounded-2xl shadow-xl flex flex-col items-center gap-1.5 transition-all hover:scale-110 border border-brand-yellow/30 backdrop-blur group"
          title="畫面定位：一鍵平滑滾動畫面對齊至播放器與字幕"
        >
          <Crosshair size={18} className="transition group-hover:rotate-45" />
          <span className="text-[13px] tracking-wider [writing-mode:vertical-lr] font-bold">
            畫面定位
          </span>
        </button>

        {/* 逐字稿抽屜按鈕 */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className={`font-bold px-2.5 sm:px-3 py-3 sm:py-3.5 rounded-2xl shadow-2xl flex flex-col items-center gap-1.5 transition-all hover:scale-110 group ${SOLID_ACCENT}`}
          title="展開逐字稿抽屜 (支援全文搜尋)"
        >
          <FileText size={18} className="transition group-hover:rotate-6" />
          <span className="text-[13px] tracking-wider [writing-mode:vertical-lr] font-black">
            逐字稿抽屜
          </span>
          <span className="text-[10px] bg-black/15 dark:bg-black/20 px-1.5 py-0.5 rounded-full font-mono font-bold">
            {parsedLines.length}
          </span>
        </button>
      </div>

      {/* 5. 側邊抽屜 Backdrop 遮罩 */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-drawer)] transition-opacity"
        />
      )}

      {/* 6. 側邊滑動抽屜面板 */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="逐字稿與段落紀錄"
        tabIndex={-1}
        /* 關閉時只用 pointer-events-none 擋得住滑鼠，擋不住鍵盤：裡面的搜尋框、
           分頁鈕與上百句逐字稿全都還在 Tab 順序裡，鍵盤使用者會掉進一個看不見
           的面板。inert 才會把整棵子樹移出焦點順序與輔助技術樹 */
        inert={!isDrawerOpen}
        className={`fixed top-0 right-0 h-full w-full sm:w-[500px] md:w-[540px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 z-[var(--z-drawer)] shadow-2xl flex flex-col transition-transform duration-300 ease-out focus:outline-none ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* 抽屜頂部 Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          {/* 分頁切換：逐字稿 ↔ 段落紀錄 */}
          {/* 原本掛 role=tablist/tab 但沒有 aria-controls、沒有 tabpanel、方向鍵也不會切，
              報讀器宣告成分頁、使用者按左右鍵卻沒反應。這裡並沒有真正的 tabpanel
              結構，與其補成半套不如誠實用一組 aria-pressed 切換鈕 */}
          <div
            role="group"
            aria-label="抽屜內容"
            className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl shrink-0"
          >
            <button
              type="button"
              aria-pressed={!isSectionTab}
              onClick={() => setDrawerTab('lines')}
              className={`flex items-baseline gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs transition-all border ${
                !isSectionTab
                  ? 'bg-brand-yellow/15 dark:bg-brand-yellow/20 text-brand-brown dark:text-brand-yellow border-transparent dark:border-brand-yellow/20 shadow-sm'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {/* 分頁名跟句數字級不同，用 baseline 對齊，圖示另外置中 */}
              <FileText size={13} className="self-center" />
              <span>逐字稿</span>
              <span className="font-mono text-[10px]">{parsedLines.length}</span>
            </button>
            <button
              type="button"
              aria-pressed={isSectionTab}
              onClick={() => setDrawerTab('sections')}
              disabled={cards.length === 0}
              className={`flex items-baseline gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                isSectionTab
                  ? 'bg-brand-yellow/15 dark:bg-brand-yellow/20 text-brand-brown dark:text-brand-yellow border-transparent dark:border-brand-yellow/20 shadow-sm'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <LayoutList size={13} className="self-center" />
              <span>段落紀錄</span>
              <span className="font-mono text-[10px]">{cards.length}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* 定位當前播放句按鈕（段落分頁沒有時間軸，不顯示） */}
            {!isSectionTab && (
              <button
                type="button"
                onClick={scrollToActive}
                disabled={activeIndex < 0}
                className={`hidden sm:flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm enabled:hover:scale-105 active:scale-95 ${SOFT_ACCENT} enabled:hover:bg-brand-yellow/20`}
                title="立即定位滾動至目前播放句"
              >
                <Crosshair size={13} />
                <span>定位當前句</span>
              </button>
            )}

            {/* 跟隨播放開關 */}
            {!isSectionTab && (
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={e => setAutoScroll(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-brand-brown dark:accent-brand-tan bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                />
                <span>跟隨播放</span>
              </label>
            )}

            {/* 關閉按鈕 */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="關閉抽屜 (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 抽屜內搜尋框 */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder={
                isSectionTab
                  ? '搜尋段落標題、簡述與重點...'
                  : '搜尋逐字稿關鍵字（如：生誕祭、禮物、點歌）...'
              }
              className="w-full pl-10 pr-20 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-brand-yellow shadow-sm transition"
            />
            {searchKeyword ? (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                title="清除搜尋"
              >
                <X size={14} />
              </button>
            ) : (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-500 dark:text-zinc-400 font-mono">
                {isSectionTab ? `${filteredCards.length} 段` : `${filteredLines.length} 句`}
              </span>
            )}
          </div>
          {searchKeyword && (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between px-1">
              <span>
                {isSectionTab
                  ? `找到 ${filteredCards.length} 段提到「${searchKeyword}」`
                  : `找到 ${filteredLines.length} 句包含「${searchKeyword}」`}
              </span>
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="text-brand-ochre dark:text-brand-yellow hover:underline"
              >
                清除篩選
              </button>
            </div>
          )}
        </div>

        {/* 釘選中的段落：切回逐字稿分頁也跟著走，邊聽邊對照 */}
        {pinned && !isSectionTab && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 border-l-[3px] border-l-brand-yellow bg-brand-yellow/[0.07] dark:bg-brand-yellow/10 px-4 py-3">
            {/* 「對照中」跟標題字級不同，文字走 baseline，右邊兩顆按鈕自己置中 */}
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-mono font-bold tracking-widest text-brand-brown dark:text-brand-yellow shrink-0">
                對照中
              </span>
              <h4 className="flex-1 min-w-0 truncate text-sm font-bold text-zinc-900 dark:text-white m-0">
                {pinned.tag ? `[${pinned.tag}] ` : ''}
                {pinned.title}
              </h4>
              <button
                type="button"
                onClick={() => setIsPinExpanded(prev => !prev)}
                className="self-center p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
                title={isPinExpanded ? '收合重點' : '展開重點'}
              >
                <ChevronDown size={15} className={`transition-transform ${isPinExpanded ? 'rotate-180' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setPinnedCard(null)}
                className="self-center p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
                title="取消釘選"
              >
                <X size={15} />
              </button>
            </div>

            {isPinExpanded && (
              <div className="mt-2 flex flex-col gap-2">
                {pinned.brief && (
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 m-0">{pinned.brief}</p>
                )}
                <CardBullets content={pinned.content} />
              </div>
            )}
          </div>
        )}

        {/* 抽屜內滾動段落紀錄列表（對照用，點時間碼跳到該段開始的地方） */}
        {isSectionTab ? (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
            {filteredCards.map(({ card, index }) => (
              <DrawerSectionCard
                key={index}
                card={card}
                index={index}
                isOpen={openCards.has(index)}
                isPinned={pinnedCard === index}
                keyword={searchKeyword}
                onToggle={() => toggleCard(index)}
                onPin={() => togglePin(index)}
                onSeek={() => {
                  const seconds = timeToSeconds(card.time ?? '');
                  seekTo(seconds, findActiveIndex(seconds));
                }}
              />
            ))}

            {filteredCards.length === 0 && (
              <div className="py-12 text-center text-zinc-500">
                沒有段落提到「{searchKeyword}」。
              </div>
            )}
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {filteredLines.map(line => {
            const offset = groupSize >= 2 ? 1 : 0;
            const startGroupIdx = Math.max(0, activeIndex - offset);
            const isActive =
              activeIndex >= 0 && line.index >= startGroupIdx && line.index < startGroupIdx + groupSize;

            return (
              <button
                key={line.index}
                type="button"
                ref={el => {
                  lineRefs.current[line.index] = el;
                }}
                onClick={() => seekTo(line.seconds, line.index)}
                className={`group w-full text-left flex items-baseline gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl cursor-pointer transition-all duration-200 border ${
                  isActive
                    ? 'border-brand-yellow bg-brand-yellow/10 shadow-[0_0_16px_rgba(169,124,43,0.12)] dark:shadow-[0_0_16px_rgba(232,201,122,0.10)]'
                    : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                {/* 時間戳播放按鈕：外層 baseline 對齊，跟右邊內文第一行同一條線 */}
                <span className="shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all ${
                      isActive
                        ? `${SOLID_ACCENT} shadow-md`
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                    }`}
                    title="點擊跳轉影片至此秒數"
                  >
                    <Play size={10} className="fill-current" />
                    <span>{line.time}</span>
                  </span>
                </span>

                {/* 對話內文。button 裡只能放 phrasing content，所以這幾層都是 span */}
                <span className="flex-1 min-w-0">
                  <span
                    className={`block text-sm sm:text-base leading-relaxed transition-colors ${
                      isActive
                        ? 'text-zinc-950 dark:text-zinc-50 font-medium'
                        : 'text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'
                    }`}
                  >
                    {searchKeyword ? highlightText(line.text, searchKeyword) : line.text}
                  </span>
                </span>
              </button>
            );
          })}

          {filteredLines.length === 0 && (
            <div className="py-12 text-center text-zinc-500">
              沒有找到符合「{searchKeyword}」的逐字稿內容。
            </div>
          )}
        </div>
        )}

        {/* 抽屜懸浮快速定位鈕（滾動遠離時一鍵跳回播放處） */}
        {activeIndex >= 0 && !isSectionTab && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <button
              type="button"
              onClick={scrollToActive}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs shadow-2xl transition-all hover:scale-105 active:scale-95 ${SOLID_ACCENT}`}
              title="立即平滑滾動定位至目前播放句"
            >
              <Crosshair size={14} />
              <span>定位至播放句（{parsedLines[activeIndex]?.time || '00:00'}）</span>
            </button>
          </div>
        )}
      </aside>
    </div>

    {/* 在別的分頁時浮在角落：顯示目前播到哪，按下去切回逐字稿。放在隱藏容器外面，fixed 才不會跟著被藏掉 */}
    {!active && (
      <button
        type="button"
        onClick={onReturn}
        className={`fixed bottom-5 right-4 sm:right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs shadow-2xl transition-all hover:scale-105 active:scale-95 ${SOLID_ACCENT}`}
        title="回到逐字稿與播放器"
      >
        <FileText size={14} className="shrink-0" />
        {activeIndex >= 0 && (
          <span className="font-mono tabular-nums">{parsedLines[activeIndex]?.time}</span>
        )}
        <span>回逐字稿</span>
      </button>
    )}
    </>
  );
}

/** 段落條列在抽屜裡走緊湊版：小標粗體、引言另外標色，跟文字模式同一套解析規則 */
function CardBullets({ content, keyword = '' }: { content: string[]; keyword?: string }) {
  if (content.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400 m-0">這一段只有簡述，沒有條列重點。</p>
    );
  }

  return (
    <ul className="m-0 pl-4 flex flex-col gap-1.5 list-disc marker:text-brand-yellow/60">
      {content.map((line, idx) => {
        if (line.startsWith('QUOTE:')) {
          return (
            <li key={idx} className="list-none -ml-4">
              <span className="block border-l-2 border-brand-yellow pl-2.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {highlightText(line.slice('QUOTE:'.length), keyword)}
              </span>
            </li>
          );
        }

        const labelled = line.match(/^\*\s*\*\*(.*?)\*\*[：:]?\s*(.*)$/);
        if (labelled) {
          return (
            <li key={idx} className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              <b className="text-zinc-900 dark:text-zinc-100">{highlightText(labelled[1], keyword)}</b>
              {labelled[2] ? <>：{highlightText(labelled[2], keyword)}</> : null}
            </li>
          );
        }

        return (
          <li key={idx} className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {highlightText(line.replace(/^\*\s*/, ''), keyword)}
          </li>
        );
      })}
    </ul>
  );
}

/** 抽屜裡的段落卡：點時間碼跳到這一段開始的地方，點標題展開重點，點圖釘把它釘到逐字稿分頁上對照 */
function DrawerSectionCard({
  card,
  index,
  isOpen,
  isPinned,
  keyword,
  onToggle,
  onPin,
  onSeek,
}: {
  card: EpisodeCard;
  index: number;
  isOpen: boolean;
  isPinned: boolean;
  keyword: string;
  onToggle: () => void;
  onPin: () => void;
  onSeek: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border transition-all ${
        isPinned
          ? 'border-brand-yellow bg-brand-yellow/[0.06] dark:bg-brand-yellow/10'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-brand-yellow/40'
      }`}
    >
      <div className="flex items-start gap-3 p-3.5">
        {card.time && (
          <button
            type="button"
            onClick={onSeek}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-brand-ochre dark:hover:text-brand-yellow transition"
            title="影片跳到這一段開始的地方"
          >
            <Play size={10} className="fill-current" />
            <span>{card.time}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="font-mono text-[10px] font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            {card.tag && (
              <span className={`font-bold text-[13px] px-2 py-0.5 rounded-full ${SOFT_ACCENT}`}>
                {highlightText(card.tag, keyword)}
              </span>
            )}
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
              {highlightText(card.title, keyword)}
            </span>
          </div>
          {card.brief && (
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 m-0">
              {highlightText(card.brief, keyword)}
            </p>
          )}
        </button>

        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onPin}
            aria-pressed={isPinned}
            className={`p-1.5 rounded-lg border transition ${
              isPinned
                ? `${SOLID_ACCENT} border-transparent shadow-sm`
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-brand-ochre dark:hover:text-brand-yellow hover:border-brand-yellow/40'
            }`}
            title={isPinned ? '取消釘選' : '釘選對照：切回逐字稿也看得到這一段'}
          >
            <Pin size={13} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-hidden="true"
            tabIndex={-1}
            className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
          >
            <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-3.5 pb-3.5 pl-9">
          <CardBullets content={card.content} keyword={keyword} />
        </div>
      )}
    </div>
  );
}

// 關鍵字高亮輔助函式
function highlightText(text: string, keyword: string) {
  if (!keyword.trim()) return text;
  const parts = text.split(new RegExp(`(${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} className="bg-brand-yellow/30 text-brand-brown dark:text-brand-cream px-1 rounded font-bold">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
