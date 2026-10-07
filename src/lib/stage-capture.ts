'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useHydrated } from './client-state';

/*
 * 舞台截圖。YouTube 是跨網域 iframe，頁面讀不到它的像素（html-to-image 畫出來是空的），
 * 只能請瀏覽器「分享此分頁」，再用區域擷取（Chrome／Edge 104+）把串流鎖在舞台那一塊：
 * 抓到的就是畫面上看到的樣子，字幕疊層的描邊、cqw 字級都不用重畫。
 * TS 的 DOM 型別還沒有 CropTarget／cropTo，這裡自己標。
 */
type CropTargetStatic = { fromElement(element: Element): Promise<unknown> };
type CroppableTrack = MediaStreamTrack & { cropTo?: (target: unknown) => Promise<void> };
const cropTarget = () => (window as unknown as { CropTarget?: CropTargetStatic }).CropTarget;

/** 第一次按要授權，之後同一頁直接秒截；串流一直留著，離開頁面或按 Chrome 的「停止分享」才結束 */
export function useStageCapture(stageRef: RefObject<HTMLElement | null>, getName: () => string) {
  const hydrated = useHydrated();
  const supported = hydrated && !!navigator.mediaDevices?.getDisplayMedia && !!cropTarget();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'saved' | 'failed' | null>(null);
  const shared = useRef<{ stream: MediaStream; video: HTMLVideoElement } | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stop = useCallback(() => {
    shared.current?.stream.getTracks().forEach(track => track.stop());
    shared.current = null;
  }, []);
  useEffect(() => {
    const timer = resultTimer;
    return () => {
      stop();
      clearTimeout(timer.current);
    };
  }, [stop]);

  const flash = (next: 'saved' | 'failed') => {
    clearTimeout(resultTimer.current);
    setResult(next);
    resultTimer.current = setTimeout(() => setResult(null), 1400);
  };

  const open = async (stage: HTMLElement) => {
    // preferCurrentTab 也還沒進 TS 的 DisplayMediaStreamOptions
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true } as DisplayMediaStreamOptions);
    try {
      const [track] = stream.getVideoTracks() as CroppableTrack[];
      await track.cropTo!(await cropTarget()!.fromElement(stage));
      track.addEventListener('ended', stop);
      // 裁切生效後才接上 video，第一張就不會抓到沒裁的整個分頁
      const video = document.createElement('video');
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      shared.current = { stream, video };
    } catch (err) {
      stream.getTracks().forEach(track => track.stop());
      throw err;
    }
  };

  const capture = async () => {
    const stage = stageRef.current;
    if (!stage || busy) return;
    setBusy(true);
    try {
      if (!shared.current) await open(stage);
      const { video } = shared.current!;

      // 舞台有圓角與邊框，裁出來的四角是頁面背景：內縮到圓弧之內，剩下的才是影片
      const style = getComputedStyle(stage);
      const inset =
        (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderTopLeftRadius) || 0) * (1 - Math.SQRT1_2);
      // +1：裁切邊界四捨五入會差一格，最外圈偶爾還是頁面的顏色
      const px = Math.ceil((inset * video.videoWidth) / stage.getBoundingClientRect().width) + 1;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth - px * 2;
      canvas.height = video.videoHeight - px * 2;
      canvas.getContext('2d')!.drawImage(video, px, px, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('canvas.toBlob returned null');
      const { saveAs } = await import('file-saver');
      saveAs(blob, `${getName()}.png`);
      flash('saved');
    } catch (err) {
      // 在分享視窗按「取消」是使用者不要，不算失敗
      if (err instanceof DOMException && err.name === 'NotAllowedError') return;
      console.error('Stage capture failed:', err);
      stop();
      flash('failed');
    } finally {
      setBusy(false);
    }
  };

  return { supported, busy, result, capture };
}
