'use client';

import { useEffect, useId, useState, type CSSProperties, type RefObject } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { rowAt, type SubtitleRow, type SubtitleStyle } from '@/lib/subtitle';

/**
 * 疊在 YouTube 播放器上的字幕。字幕層整個 pointer-events-none，影片上的任何操作都不受影響；
 * 大小一律用舞台寬度的百分比（cqw），所以舞台是 @container。
 * 要放在舞台裡、放在 YouTube 取代掉的那個 div 後面：React 往它前面插節點會找不到參照。
 */
export default function SubtitleOverlay({
  playerRef,
  stageRef,
  rows,
  style,
  offsetMs,
}: {
  playerRef: RefObject<{ getCurrentTime: () => number } | null>;
  stageRef: RefObject<HTMLElement | null>;
  rows: readonly SubtitleRow[];
  style: SubtitleStyle;
  offsetMs: number;
}) {
  const [index, setIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hintId = useId();

  // 每個畫面影格問一次播放器現在幾秒。YouTube 自己會在頁面端往前推算、暫停時就停在那一秒，
  // 所以這裡不另外外插；暫停、拖進度時照樣顯示當下那一列。換列才改 state，不是一秒 60 次重繪
  useEffect(() => {
    let frame = 0;
    let shown = -2;
    const tick = () => {
      const time = playerRef.current?.getCurrentTime?.();
      if (typeof time === 'number') {
        const next = rowAt(rows, time + offsetMs / 1000);
        if (next !== shown) {
          shown = next;
          setIndex(next);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playerRef, rows, offsetMs]);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [stageRef]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else stageRef.current?.requestFullscreen().catch(() => {});
  };

  // iPhone 不支援把任意元素全螢幕：沒有這顆按鈕，提示也就不用放
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[5%] z-10 text-center leading-[1.35] text-white text-balance [overflow-wrap:anywhere] [paint-order:stroke_fill]"
        style={
          {
            '--sb': style.sb,
            '--sf': style.sf,
            '--sw': style.sw,
            '--ss': style.ss,
            '--sc': style.c,
            bottom: 'calc(var(--sb) * 1%)',
            fontSize: 'calc(var(--sf) * 1cqw)',
            fontWeight: 'var(--sw)',
            WebkitTextStroke: 'calc(var(--ss) * 1cqw) var(--sc)',
          } as CSSProperties
        }
      >
        {rows[index]?.text}
      </div>

      {canFullscreen && (
        // 按鈕在右上角，提示疊在按鈕正下方、靠右：YouTube 暫停或游標移上去時，左上角會浮出標題列，
        // 一路拉到按鈕左邊；提示放在標題下一行的右半邊，才不會跟標題字疊在一起。
        // 右緣往左讓開右側懸浮鈕（fixed、z-40、約 70px，窄視窗會整個蓋住按鈕）：舞台置中，舞台右緣離視窗右緣
        // (100vw - 100%) / 2，懸浮鈕要讓 5.5rem，扣掉這段空隙才是要讓的；視窗夠寬扣成負的，就維持貼角 0.5rem。
        // 5.5rem 比 70px 多的是捲軸的一半：100vw 含捲軸，懸浮鈕的定位不含
        <div
          className="pointer-events-none absolute top-2 z-10 flex flex-col items-end gap-1"
          style={{ right: 'max(0.5rem, calc(5.5rem - (100vw - 100%) / 2))' }}
        >
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? '離開全螢幕' : '字幕全螢幕'}
            aria-describedby={isFullscreen ? undefined : hintId}
            title={isFullscreen ? '離開全螢幕' : '字幕全螢幕'}
            className="pointer-events-auto inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/55 text-white/90 transition hover:bg-black/75 hover:text-white"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          {!isFullscreen && (
            <span id={hintId} className="rounded-md bg-black/55 px-1.5 py-1 text-[11px] leading-none text-white/85">
              內建全螢幕看不到字幕
            </span>
          )}
        </div>
      )}
    </>
  );
}
