'use client';

import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { rowAt, type SubtitleRow, type SubtitleStyle } from '@/lib/subtitle';

/**
 * 疊在 YouTube 播放器上的字幕。字幕層整個 pointer-events-none，影片上的任何操作都不受影響；
 * 大小一律用舞台寬度的百分比（cqw），所以舞台是 @container。
 * 要放在舞台裡、放在 YouTube 取代掉的那個 div 後面：React 往它前面插節點會找不到參照。
 */
export default function SubtitleOverlay({
  playerRef,
  rows,
  style,
  offsetMs,
}: {
  playerRef: RefObject<{ getCurrentTime: () => number } | null>;
  rows: readonly SubtitleRow[];
  style: SubtitleStyle;
  offsetMs: number;
}) {
  const [index, setIndex] = useState(-1);

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
    </>
  );
}
