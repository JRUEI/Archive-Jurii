'use client';

import { useState, useRef, useEffect } from 'react';
import { EpisodeData, EpisodeCard } from '@/lib/markdown';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';


interface PaginatedCard {
  tag: string;
  title: string;
  content: string[];
  contentChunk: string[];
  displayTitle: string;
  /** 單一條目就超過一張卡時的字級縮放，避免內容被裁掉 */
  scale: number;
}

interface RenderableCard {
  type: 'cover' | 'content' | 'summary' | 'ending';
  tag?: string;
  title?: string;
  content?: string[];
  contentChunk?: string[];
  displayTitle?: string;
  scale?: number;
}

interface ExportableCardProps {
  card: RenderableCard;
  index: number;
  isPreview?: boolean;
  episode: EpisodeData;
  isDark: boolean;
  totalCards: number;
}

// --- Card Style Constants (inline styles required for html-to-image export) ---
const CARD_STYLES = {
  // Shared
  // 這是要分享出去的圖：#aaa 在亮色卡底 #F9FAFB 上只有 2.22，手機上幾乎看不到。
  // 深色卡底 #1a1a1a 的 7.49 沒問題，所以只換亮色那一側（#6F6961 → 5.19）
  footer: (isDark: boolean) => ({ fontSize: '30px', fontWeight: 300 as const, color: isDark ? '#aaa' : '#6F6961', margin: 0, letterSpacing: '0.03em' }),
  footerDivider: (isDark: boolean) => ({ borderTop: `1px solid ${isDark ? '#444' : '#E5E7EB'}`, paddingTop: '32px', flexShrink: 0 as const }),
  // Cover
  coverGoldBar: { width: '56px', height: '4px', background: '#E8C97A', marginTop: '60px', marginBottom: '24px' },
  coverBadge: { background: 'rgba(232,201,122,0.12)', border: '1px solid rgba(232,201,122,0.3)', color: '#E8C97A', padding: '10px 22px', borderRadius: '6px', fontSize: '26px', fontWeight: 700 as const, letterSpacing: '0.05em' },
  // Quote block
  quoteBlock: (isDark: boolean) => ({
    background: isDark ? '#333' : '#F3F4F6',
    borderLeft: `6px solid ${isDark ? '#E8C97A' : '#8A6A4B'}`,
    padding: '28px 36px', borderRadius: '0 12px 12px 0', margin: '24px 0',
  }),
  quoteText: (isDark: boolean) => ({
    fontFamily: 'var(--font-serif)', fontSize: '34px', fontWeight: 700 as const,
    color: isDark ? '#eee' : '#444', lineHeight: 1.65 as const, margin: 0,
  }),
  // Content card
  contentBody: (isDark: boolean) => ({
    background: isDark ? '#262626' : '#FFFFFF', borderRadius: '16px', padding: '48px 56px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '32px', flex: 1 as const,
    display: 'flex' as const, flexDirection: 'column' as const, justifyContent: 'flex-start' as const,
  }),
  paragraph: (color: string) => ({ fontSize: '36px', color, lineHeight: 1.8 as const, marginBottom: '28px' }),
  bigNumber: (isDark: boolean) => ({
    position: 'absolute' as const, top: '140px', right: '60px',
    fontFamily: 'var(--font-serif)', fontSize: '320px', fontWeight: 900 as const,
    color: isDark ? '#222' : '#EBEBEB', lineHeight: 1, zIndex: 0, userSelect: 'none' as const,
  }),
} as const;

// --- Color System Mapping ---
const getTagStyle = (isDark: boolean) => {
  return {
    background: isDark ? '#27272a' : 'rgba(169,124,43,0.12)', // zinc-800 或淡金底
    color: isDark ? '#E8C97A' : '#5C4433', // 金 / 深棕
  };
};

// --- Auto Pagination ---
// 依實際排版高度估算分頁。舊版用字數權重（maxWeight 260 + 最多 3 條），
// 導致一張 1920px 的卡只放 1~2 條，下半部整片留白。
const CARD_CONTENT_WIDTH = 920; // 1080 - 卡片左右內距 80*2
const BODY_BOX_WIDTH = 808;     // 920 - 內文框左右內距 56*2
const BODY_FONT = 42;
const BODY_LH = 1.8;
const QUOTE_FONT = 40;
const QUOTE_LH = 1.65;
const TITLE_FONT = 64;
const SUMMARY_FONT = 37;

// 全形字寬算 1，半形（ASCII、半形假名）約 0.55
function widthInChars(text: string) {
  let w = 0;
  for (const ch of text) w += /[\u0020-\u00FF\uFF61-\uFF9F]/.test(ch) ? 0.55 : 1;
  return w;
}

// 一行只排得下整數個字；標點不能放行首（禁則）時會把前一字擠到下一行，
// 平均每行再扣半字才不會低估（36～44px 實測）
function lineCount(text: string, fontSize: number, boxWidth: number) {
  return Math.max(1, Math.ceil(widthInChars(text) / (Math.floor(boxWidth / fontSize) - 0.5)));
}

function stripMarks(p: string) {
  return p.replace(/^QUOTE:\s*/, '').replace(/^>\s*/, '').replace(/^\*\s+/, '').replace(/\*\*/g, '');
}

// 單一段落實際佔用的高度（含下方 margin）；scale 是字級縮放，margin 不跟著縮。
// 字級照渲染端的 px() 四捨五入，差 0.5px 就可能讓每行少排一個字
function blockHeight(p: string, scale = 1) {
  const plain = stripMarks(p);
  if (p.startsWith('QUOTE:') || p.startsWith('>')) {
    // 引用框：內距 28*2 + 上下 margin 24*2 = 104
    const fs = Math.round(QUOTE_FONT * scale);
    return lineCount(`「${plain}」`, fs, BODY_BOX_WIDTH - 78) * fs * QUOTE_LH + 104;
  }
  const fs = Math.round(BODY_FONT * scale);
  if (p.startsWith('* ')) {
    // 條列：ul 左縮排 40，項目符號掛在縮排裡（實測欄寬 768）。loose list 的 li 內層多一包 <p>，
    // li 自己的 margin 16 會跟 <p> 的 28 合併取大，所以條目間距是 28 不是 44（實測）。
    // ul 自己的 margin-bottom 32 整串只算一次，併在 bodyBudget 的安全邊界裡。
    return lineCount(plain, fs, BODY_BOX_WIDTH - 40) * fs * BODY_LH + 28;
  }
  return lineCount(plain, fs, BODY_BOX_WIDTH) * fs * BODY_LH + 28;
}

// 字級每次縮 1%，縮到估算高度放得進預算為止。不能用平方根一次算：
// 行數是整數，縮完常還多一行，精簡總結會因此上下被裁
function fitScale(heightAt: (s: number) => number, budget: number, min: number) {
  let s = 1;
  while (s > min && heightAt(s) > budget) s -= 0.01;
  return Math.max(min, s);
}

// 內文框可用高度：1920 - 卡片上下內距 144 - 標籤列 141 - 標題 - 金線 56
//                 - 內文框內距 96 - 白框與頁尾間距 32 - 頁尾 69 - 安全邊界 72
function bodyBudget(title: string) {
  const titleH = lineCount(`${title}（1/9）`, TITLE_FONT, CARD_CONTENT_WIDTH) * TITLE_FONT * 1.35 + 48;
  return 1776 - 141 - 56 - 96 - 32 - 69 - 72 - titleH;
}

function packChunks(blocks: { text: string; height: number }[], budget: number) {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let curH = 0;

  blocks.forEach(b => {
    if (cur.length > 0 && curH + b.height > budget) {
      chunks.push(cur);
      cur = [];
      curH = 0;
    }
    cur.push(b.text);
    curH += b.height;
  });

  if (cur.length > 0) chunks.push(cur);
  return chunks;
}

// 精簡總結只有一張卡、不能分頁，條目多時會被 1920px 裁掉，所以照估算高度縮字級。
// 可用高度：1920 - 上下內距 160 - 標籤列 118 - 標題 - 卡框內距與框線 130 - 頁尾 102 - 安全邊界 24（各區塊皆實測）。
// 長的總結要縮到 18px 左右才放得下，下限因此設 0.45
function summaryScale(title: string, points: string[]) {
  const titleLines = lineCount(title, 64, 840);
  const budget = 1920 - 160 - 118 - (titleLines * 64 * 1.4 + 60) - 130 - 102 - 24;
  return fitScale(s => {
    const fs = Math.round(SUMMARY_FONT * s); // 同 spx() 四捨五入
    return points.reduce((sum, point, i) => sum + lineCount(point, fs, 748) * fs * 1.65 + (i === points.length - 1 ? 0 : 36 * s), 0);
  }, budget, 0.45);
}

function paginateCards(cards: EpisodeCard[]) {
  const paginated: PaginatedCard[] = [];

  cards.forEach(card => {
    const budget = bodyBudget(card.title);
    const blocks = card.content.map(text => ({ text, height: blockHeight(text) }));
    let chunks = packChunks(blocks, budget);

    // 貪婪切法會把內容全塞進前幾張、最後一張只剩一兩條留一大片白。
    // 張數已經固定了，就二分搜出「還能維持同樣張數的最小高度上限」，讓每張攤得平均。
    if (chunks.length > 1) {
      const count = chunks.length;
      let lo = blocks.reduce((max, b) => Math.max(max, b.height), 0);
      let hi = budget;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (packChunks(blocks, mid).length <= count) hi = mid;
        else lo = mid + 1;
      }
      chunks = packChunks(blocks, lo);
    }

    chunks.forEach(chunk => {
      const scale = fitScale(s => chunk.reduce((sum, text) => sum + blockHeight(text, s), 0), budget, 0.7);
      paginated.push({ ...card, contentChunk: chunk, displayTitle: '', scale });
    });
  });

  // Number them if split
  const titleCounts: Record<string, number> = {};
  paginated.forEach(card => {
    titleCounts[card.title] = (titleCounts[card.title] || 0) + 1;
  });

  const titleCurrentIndex: Record<string, number> = {};

  for (let i = 0; i < paginated.length; i++) {
    const title = paginated[i].title;
    const totalForTitle = titleCounts[title];

    if (totalForTitle > 1) {
      titleCurrentIndex[title] = (titleCurrentIndex[title] || 0) + 1;
      paginated[i].displayTitle = `${title} (${titleCurrentIndex[title]}/${totalForTitle})`;
    } else {
      paginated[i].displayTitle = title;
    }
  }

  return paginated;
}

// 全螢幕檢視的縮放。手機（< sm）左右不留白；頂列按鈕底緣在 53px，讓出 56px（遮罩的 pt-14）、底部留 8px。
// 桌機維持左右 48、上下 140 的留白。
// 手機多半比 9:16 細長、寬度先頂到，這時貼齊兩側拿掉圓角（容差 2px）；
// 高度先頂到（如 Safari 工具列展開）就留著圓角，免得兩側剩幾 px 細縫像跑版
function fullscreenFit() {
  const isPhone = window.innerWidth < 640;
  const availW = window.innerWidth - (isPhone ? 0 : 48);
  const availH = window.innerHeight - (isPhone ? 56 + 8 : 140);
  const scale = Math.max(0.1, Math.min(availW / 1080, availH / 1920));
  return { scale, fullBleed: isPhone && 1080 * scale > availW - 2 };
}

// --- Reusable Component for 1080x1920 Card ---
const ExportableCard = ({ card, index, isPreview = false, episode, isDark, totalCards }: ExportableCardProps) => {
  if (!card) return null;

  // Cover Card
  if (card.type === 'cover') {
    return (
      <div className={`export-card ${isPreview ? 'absolute inset-0' : 'relative'} w-[1080px] h-[1920px] bg-[#111111] overflow-hidden box-border flex flex-col p-[80px]`}>
        <div style={CARD_STYLES.coverGoldBar}></div>
        <div style={{ marginBottom: 'auto' }}>
          <span className="whitespace-nowrap" style={CARD_STYLES.coverBadge}>
            節目拆解 / 完整收錄
          </span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '84px', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.35, margin: '0 0 40px 0' }}>
          {episode.title}
        </h1>
        <div style={{ borderLeft: '4px solid #E8C97A', paddingLeft: '32px', marginBottom: '120px' }}>
          <p style={{ fontSize: '32px', fontWeight: 300, color: '#aaa', margin: 0, lineHeight: 1.6 }}>
            {episode.episodeLabel || `第 ${episode.episodeNumber} 回`}精華完整收錄。
          </p>
        </div>
        <div style={{ borderTop: '1px solid #2A2A2A', paddingTop: '36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* 封面卡底寫死 #111111，不跟主題，所以固定用深色那一套 */}
          <p style={CARD_STYLES.footer(true)}>逢田珠里依（≒JOY）｜SHOWROOM</p>
        </div>
      </div>
    );
  }

  // Ending Card
  if (card.type === 'ending') {
    return (
      <div className={`export-card ${isPreview ? 'absolute inset-0' : 'relative'} w-[1080px] h-[1920px] bg-[#111111] overflow-hidden box-border flex flex-col justify-center p-[80px]`}>
        <div style={{ border: '1px solid rgba(232,201,122,0.3)', borderRadius: '16px', padding: '52px', marginBottom: '80px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '80px', color: 'rgba(232,201,122,0.2)', lineHeight: 0.8, marginBottom: '20px', fontWeight: 900 }}>&ldquo;</div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '38px', fontWeight: 700, color: '#E8C97A', lineHeight: 1.7, margin: '0 0 28px 0' }}>
            本集內容到此結束。
          </p>
          <p style={{ fontSize: '26px', fontWeight: 300, color: '#888', margin: 0 }}>— 逢田珠里依｜SHOWROOM</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ flex: 1, height: '1px', background: '#2A2A2A' }}></div>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#555', letterSpacing: '0.2em' }}>END</span>
          <div style={{ flex: 1, height: '1px', background: '#2A2A2A' }}></div>
        </div>
      </div>
    );
  }

  // Summary Card (Standalone Poster Style)
  if (card.type === 'summary') {
    const s = card.scale ?? 1;
    const spx = (base: number) => `${Math.round(base * s)}px`;
    return (
      <div className={`export-card ${isPreview ? 'absolute inset-0' : 'relative'} w-[1080px] h-[1920px] overflow-hidden box-border flex flex-col justify-center p-[80px]`} style={{ background: isDark ? '#111' : '#F9FAFB' }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '800px', height: '800px', background: isDark ? 'radial-gradient(circle, rgba(232,201,122,0.10) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(202,138,4,0.10) 0%, transparent 70%)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '800px', height: '800px', background: isDark ? 'radial-gradient(circle, rgba(217,119,6,0.10) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(146,64,14,0.08) 0%, transparent 70%)', borderRadius: '50%' }}></div>

        <div style={{ zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <span style={{ display: 'inline-block', background: isDark ? 'rgba(232,201,122,0.15)' : 'rgba(212,175,55,0.1)', border: isDark ? '1px solid rgba(232,201,122,0.4)' : '1px solid rgba(212,175,55,0.4)', color: isDark ? '#E8C97A' : '#D4AF37', padding: '12px 28px', borderRadius: '8px', fontSize: '28px', fontWeight: 700, letterSpacing: '0.1em' }}>
              {episode.episodeLabel || `第 ${episode.episodeNumber} 回`}精華
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '64px', fontWeight: 900, color: isDark ? '#FFFFFF' : '#111111', lineHeight: 1.4, marginBottom: '60px', textAlign: 'center', padding: '0 40px' }}>
            {episode.title}
          </h1>

          <div style={{ background: isDark ? '#222' : '#FFFFFF', borderRadius: '24px', padding: '64px 56px', border: isDark ? '1px solid #333' : '1px solid #E5E7EB', boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.4)' : '0 20px 40px rgba(0,0,0,0.05)' }}>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {(card.contentChunk || []).map((point: string, i: number) => (
                <li key={i} style={{ fontSize: spx(SUMMARY_FONT), color: isDark ? '#EBEBEB' : '#333333', lineHeight: 1.65, marginBottom: i === (card.contentChunk || []).length - 1 ? 0 : spx(36), display: 'flex', gap: spx(24) }}>
                  <span style={{ color: isDark ? '#E8C97A' : '#A97C2B', fontSize: spx(36), lineHeight: 1.4, flexShrink: 0 }}>✦</span>
                  <div>{point}</div>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <p style={{ fontSize: '28px', color: isDark ? '#666' : '#9ca3af', letterSpacing: '0.05em', margin: 0 }}>
              逢田珠里依（≒JOY）｜SHOWROOM
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Content Card
  const cardBg = isDark ? '#1a1a1a' : '#F9FAFB';
  const titleColor = isDark ? '#FFFFFF' : '#111111';
  const textColor = isDark ? '#DDDDDD' : '#333333';

  const contentIndex = index;
  const totalContent = Math.max(1, totalCards - 2);
  const scale = card.scale ?? 1;
  const px = (base: number) => `${Math.round(base * scale)}px`;

  return (
    <div className={`export-card ${isPreview ? 'absolute inset-0' : 'relative'} w-[1080px] h-[1920px] overflow-hidden box-border flex flex-col p-[72px_80px]`} style={{ background: cardBg }}>

      <div className="whitespace-nowrap" style={{ position: 'absolute', top: '72px', right: '80px', fontSize: '28px', fontWeight: 300, color: '#aaa', letterSpacing: '0.05em' }}>
        {contentIndex} / {totalContent}
      </div>

      <div style={{ marginBottom: '72px' }}>
        {card.tag && (
          <div className="whitespace-nowrap inline-flex items-center" style={{ ...getTagStyle(isDark), borderRadius: '8px', padding: '14px 28px' }}>
            <span style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '0.06em' }}>{card.tag}</span>
          </div>
        )}
      </div>

      <div style={CARD_STYLES.bigNumber(isDark)}>
        {String(contentIndex).padStart(2, '0')}
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '64px', fontWeight: 900, color: titleColor, lineHeight: 1.35, margin: '0 0 48px 0' }}>
          {card.displayTitle}
        </h2>
        <div style={{ width: '48px', height: '4px', background: isDark ? '#E8C97A' : '#A97C2B', borderRadius: '2px', marginBottom: '52px' }}></div>

        <div style={CARD_STYLES.contentBody(isDark)}>

          <ReactMarkdown
            components={{
              p: ({node, ...props}) => {
                void node;
                if (typeof props.children === 'string' && props.children.startsWith('QUOTE:')) {
                  const quoteText = props.children.replace('QUOTE:', '');
                  return (
                    <div style={CARD_STYLES.quoteBlock(isDark)}>
                      <p style={{ ...CARD_STYLES.quoteText(isDark), fontSize: px(QUOTE_FONT) }}>
                        「{quoteText}」
                      </p>
                    </div>
                  );
                }
                return <p style={{ ...CARD_STYLES.paragraph(textColor), fontSize: px(BODY_FONT) }} {...props} />;
              },
              strong: ({node, ...props}) => {
                void node;
                return <strong style={{ color: isDark ? '#E8C97A' : '#8A6A4B', fontWeight: 900 }} {...props} />;
              },
              ul: ({node, ...props}) => {
                void node;
                return <ul className={isDark ? "marker:text-[#E8C97A]" : "marker:text-[#A97C2B]"} style={{ margin: '0 0 32px 40px', padding: 0 }} {...props} />;
              },
              li: ({node, ...props}) => {
                void node;
                return <li style={{ fontSize: px(BODY_FONT), color: textColor, lineHeight: 1.8, marginBottom: '16px', listStyleType: 'disc' }} {...props} />;
              },
              blockquote: ({node, ...props}) => {
                void node;
                return (
                  <div style={CARD_STYLES.quoteBlock(isDark)}>
                    <p style={{ ...CARD_STYLES.quoteText(isDark), fontSize: px(QUOTE_FONT) }}>
                      {props.children}
                    </p>
                  </div>
                );
              },
            }}
          >
            {card.contentChunk?.join('\n\n') || ''}
          </ReactMarkdown>

        </div>
      </div>

      <div style={CARD_STYLES.footerDivider(isDark)}>
        <p className="whitespace-nowrap" style={CARD_STYLES.footer(isDark)}>逢田珠里依（≒JOY）｜SHOWROOM</p>
      </div>
    </div>
  );
};

export default function CardMode({ episode, isLossless }: { episode: EpisodeData, isLossless: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { theme } = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [{ scale: fullScale, fullBleed }, setFullFit] = useState(() =>
    typeof window === 'undefined' ? { scale: 0.4, fullBleed: false } : fullscreenFit());
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 系統設了「減少動態」就不要橫移換卡，淡入淡出保留：
  // 會造成前庭不適的是位移，不是透明度
  const reduceMotion = useReducedMotion();
  const slideX = reduceMotion ? 0 : 60;

  // Touch swipe states
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  const minSwipeDistance = 40; // Only requires a 40px swipe, very sensitive!

  const handleTouchStart = (e: React.TouchEvent) => {
    touchEndRef.current = null;
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEndAction = () => {
    if (touchStartRef.current === null || touchEndRef.current === null) return;
    const distance = touchStartRef.current - touchEndRef.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  useEffect(() => {
    if (isFullscreen) {
      const updateFullScale = () => setFullFit(fullscreenFit());
      updateFullScale();
      window.addEventListener('resize', updateFullScale);

      // Prevent scrolling on body when in fullscreen
      document.body.style.overflow = 'hidden';

      return () => {
        window.removeEventListener('resize', updateFullScale);
        document.body.style.overflow = '';
      };
    }
  }, [isFullscreen]);

  // Determine cards
  let cardsToRender: RenderableCard[] = [];

  if (!isLossless) {
    cardsToRender = [
      { type: 'summary', contentChunk: episode.summary, scale: summaryScale(episode.title, episode.summary) }
    ];
  } else {
    const pCards = paginateCards(episode.cards);
    cardsToRender = [
      { type: 'cover' },
      ...pCards.map(c => ({ type: 'content' as const, ...c })),
      { type: 'ending' }
    ];
  }

  const handleNext = () => {
    if (currentIndex < cardsToRender.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const downloadAllCards = async () => {
    if (!hiddenContainerRef.current) return;
    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: 0 });
    try {
      const htmlToImage = await import('html-to-image');
      const { saveAs } = await import('file-saver');

      const cardElements = hiddenContainerRef.current.querySelectorAll('.export-card');
      const total = cardElements.length;
      setDownloadProgress({ current: 0, total });

      // 標題含有 / 等字元，不能直接當檔名
      const safeTitle = episode.title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'card';
      const renderCard = (node: HTMLElement) =>
        htmlToImage.toPng(node, {
          pixelRatio: 1,
          quality: 1.0,
          style: { transform: 'scale(1)', transformOrigin: 'top left' },
          cacheBust: true,
        });

      // 只有一張圖卡時直接存 PNG，不需要壓縮檔
      if (total === 1) {
        setDownloadProgress({ current: 1, total });
        const dataUrl = await renderCard(cardElements[0] as HTMLElement);
        const blob = await (await fetch(dataUrl)).blob();
        saveAs(blob, `${safeTitle}.png`);
        return;
      }

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const failedCards: number[] = [];

      for (let i = 0; i < cardElements.length; i++) {
        setDownloadProgress({ current: i + 1, total });
        try {
          const dataUrl = await renderCard(cardElements[i] as HTMLElement);
          const base64Data = dataUrl.split(',')[1];
          zip.file(`Card-${String(i+1).padStart(2, '0')}.png`, base64Data, {base64: true});
        } catch (cardErr) {
          console.error(`Failed to export card ${i + 1}:`, cardErr);
          failedCards.push(i + 1);
        }
      }

      if (Object.keys(zip.files).length === 0) {
        console.error('All cards failed to export');
        return;
      }

      const content = await zip.generateAsync({type: 'blob'});
      saveAs(content, `${safeTitle}-Cards.zip`);

      if (failedCards.length > 0) {
        console.warn(`Cards ${failedCards.join(', ')} failed to export`);
      }
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsDownloading(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  // Guard against an out-of-bounds index while the card collection changes.
  const currentCard = cardsToRender[currentIndex] || cardsToRender[0];
  const isDark = theme === 'dark';

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Fallback for older browsers
    if (typeof ResizeObserver === 'undefined') {
      const updateScale = () => {
        if (containerRef.current) {
          setScale(containerRef.current.offsetWidth / 1080);
        }
      };
      updateScale();
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setScale(entry.contentRect.width / 1080);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => Math.min(prev + 1, cardsToRender.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Tab' && isFullscreen && overlayRef.current) {
        // 全螢幕是蓋住整頁的對話框，Tab 不該跑到底下那層看不見的頁面去
        const focusables = overlayRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === overlayRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cardsToRender.length, isFullscreen]);

  // 開啟時把焦點送進對話框，關閉時還給原本那顆按鈕，
  // 不然鍵盤使用者關掉全螢幕後焦點會掉回 body，得從頭 Tab 一次
  useEffect(() => {
    if (!isFullscreen) return;
    const previous = document.activeElement as HTMLElement | null;
    overlayRef.current?.focus();
    return () => previous?.focus?.();
  }, [isFullscreen]);


  return (
    <>
      {/* Fullscreen Overlay */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label={`圖卡放大檢視（第 ${Math.min(currentIndex + 1, cardsToRender.length)} 張，共 ${cardsToRender.length} 張）`}
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-overlay)] bg-zinc-950/98 backdrop-blur-2xl flex flex-col justify-center items-center pt-14 sm:pt-0 overflow-hidden touch-none select-none focus:outline-none"
            onClick={() => setIsFullscreen(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEndAction}
          >
            {/* Top Navigation Bar - Cleanly positioned at top, zero collision with card */}
            <div 
              className="absolute top-0 inset-x-0 h-16 z-10 flex items-center justify-between px-6 pointer-events-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress counter badge (top-left) */}
              <div className="pointer-events-auto bg-zinc-900/90 text-zinc-100 text-xs sm:text-sm font-bold px-4 py-1.5 rounded-full border border-zinc-700/60 shadow-lg tracking-wider">
                {Math.min(currentIndex + 1, cardsToRender.length)} / {cardsToRender.length}
              </div>

              {/* Close Button (top-right) */}
              <button
                onClick={() => setIsFullscreen(false)}
                className="pointer-events-auto bg-zinc-900/90 hover:bg-zinc-800 text-white p-2.5 rounded-full transition-all border border-zinc-700/60 shadow-lg hover:scale-105 active:scale-95"
                title="關閉放大 (ESC)"
                aria-label="Close fullscreen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Desktop Navigation Arrows (Side controls) */}
            {currentIndex > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="hidden sm:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-10 bg-zinc-900/80 hover:bg-zinc-800 text-white p-3.5 rounded-full transition-all border border-zinc-700/60 shadow-xl hover:scale-110 active:scale-95"
                aria-label="上一張"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {currentIndex < cardsToRender.length - 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="hidden sm:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-10 bg-zinc-900/80 hover:bg-zinc-800 text-white p-3.5 rounded-full transition-all border border-zinc-700/60 shadow-xl hover:scale-110 active:scale-95"
                aria-label="下一張"
              >
                <ChevronRight size={24} />
              </button>
            )}

            {/* Scaled Container for Fullscreen - 100% Mathematically Centered */}
            <div
              className={`relative overflow-hidden shadow-2xl bg-zinc-950 flex-shrink-0 ${fullBleed ? '' : 'rounded-2xl sm:rounded-[36px] border border-zinc-800/80'}`}
              style={{ width: `${Math.round(1080 * fullScale)}px`, height: `${Math.round(1920 * fullScale)}px` }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Tap Left/Right zones for navigation on mobile / touch */}
              <div className="absolute inset-y-0 left-0 w-1/4 z-30 cursor-w-resize" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
              <div className="absolute inset-y-0 right-0 w-1/4 z-30 cursor-e-resize" onClick={(e) => { e.stopPropagation(); handleNext(); }} />

              <div
                className="absolute top-0 left-0 origin-top-left w-[1080px] h-[1920px]"
                style={{ transform: `scale(${fullScale})` }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: slideX }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -slideX }}
                    transition={{ duration: 0.18 }}
                    className="w-full h-full"
                  >
                    <ExportableCard card={currentCard} index={currentIndex} isPreview={true} episode={episode} isDark={isDark} totalCards={cardsToRender.length} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center w-full max-w-lg">

        {/* Controls */}
        <div className="w-full flex justify-between items-center mb-4 px-2">
          <div className="w-16 sm:w-24"></div>
          <div className="text-zinc-500 dark:text-zinc-400 font-bold bg-zinc-100 dark:bg-zinc-900 px-4 py-1.5 rounded-full text-xs sm:text-sm border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm tracking-wider">
            {Math.min(currentIndex + 1, cardsToRender.length)} / {cardsToRender.length}
          </div>
          <button 
            onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full font-bold text-xs transition-all shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 hover:scale-105 active:scale-95"
            aria-label="放大全螢幕"
            title="放大全螢幕檢視"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
            <span>放大</span>
          </button>
        </div>

        {/* The viewport container that scales down the 1080x1920 card */}
        <div
          ref={containerRef}
          className="relative isolate w-full aspect-[9/16] box-content bg-zinc-950 dark:bg-zinc-950 rounded-xl sm:rounded-3xl shadow-2xl border-4 border-zinc-800 dark:border-zinc-800 overflow-hidden flex items-center justify-center select-none group"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEndAction}
        >


          {/* Navigation Overlays */}
          <div className="absolute inset-y-0 left-0 w-1/6 z-50 cursor-w-resize" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
          <div className="absolute inset-y-0 right-0 w-1/6 z-50 cursor-e-resize" onClick={(e) => { e.stopPropagation(); handleNext(); }} />

          {/* Visual Arrows (Only show on hover for better immersion) */}
          {currentIndex > 0 && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 bg-black/50 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <ChevronLeft size={28} />
            </div>
          )}
          {currentIndex < cardsToRender.length - 1 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 bg-black/50 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <ChevronRight size={28} />
            </div>
          )}

          {/* Scaled Container. We use a container that is exactly 1080x1920, and scale it down to fit the parent. */}
          <div className="absolute top-0 left-0 origin-top-left w-[1080px] h-[1920px] transition-opacity duration-300"
               style={{ transform: `scale(${scale})`, opacity: scale > 0 ? 1 : 0 }}
          >
             <AnimatePresence mode="wait">
               <motion.div
                 key={currentIndex}
                 initial={{ opacity: 0, x: slideX ? 100 : 0 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: slideX ? -100 : 0 }}
                 transition={{ duration: 0.2 }}
                 className="w-full h-full"
               >
                 <ExportableCard card={currentCard} index={currentIndex} isPreview={true} episode={episode} isDark={isDark} totalCards={cardsToRender.length} />
               </motion.div>
             </AnimatePresence>
          </div>
        </div>

      {/* --- Hidden Container for Exporting All Cards --- */}
      <div
        ref={hiddenContainerRef}
        style={{ position: 'absolute', width: '1080px', visibility: 'hidden', overflow: 'hidden', height: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {cardsToRender.map((card, i) => (
          <ExportableCard key={i} card={card} index={i} isPreview={false} episode={episode} isDark={isDark} totalCards={cardsToRender.length} />
        ))}
      </div>

      {/* Download Section (Collapsible) */}
      <div className="w-full mt-8 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
        <button
          onClick={() => setIsDownloadOpen(!isDownloadOpen)}
          className="w-full flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="bg-brand-brown/20 text-brand-brown p-2 rounded-lg">
              <Download size={20} />
            </div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">圖卡下載區</span>
          </div>
          <div className={`transform transition-transform ${isDownloadOpen ? 'rotate-180' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-zinc-500">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isDownloadOpen && (
          <div className="p-6 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4 leading-relaxed">
              {cardsToRender.length === 1
                ? '將目前預覽的圖卡存成 PNG 圖片。手機版若跳出提示請允許下載。'
                : `將會把目前預覽的所有圖卡（共 ${cardsToRender.length} 張）打包成單一 ZIP 壓縮檔下載。手機版若跳出提示請允許下載。`}
            </p>
            <button
              onClick={downloadAllCards}
              disabled={isDownloading}
              className="w-full flex justify-center items-center gap-2 bg-brand-brown hover:bg-brand-ochre text-brand-cream dark:bg-brand-tan dark:hover:bg-brand-ochre dark:text-brand-ink px-6 py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-zinc-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {downloadProgress.total > 0 ? `轉換中 ${downloadProgress.current}/${downloadProgress.total}` : '準備中...'}
                </>
              ) : (
                <>
                  <Download size={20} />
                  {cardsToRender.length === 1 ? '確認下載圖卡 (PNG)' : `確認下載 ${cardsToRender.length} 張圖卡 (ZIP)`}
                </>
              )}
            </button>
          </div>
        )}
      </div>

    </div>
    </>
  );
}
