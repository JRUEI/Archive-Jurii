'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { EpisodeData } from '@/lib/markdown';
import { formatDuration } from '@/lib/format';
import dynamic from 'next/dynamic';
import TextMode from './TextMode';

const CardMode = dynamic(() => import('./CardMode'), { 
  ssr: false, 
  loading: () => <div className="w-full h-[500px] flex items-center justify-center text-zinc-500">載入中...</div> 
});
import { LayoutGrid, AlignLeft } from 'lucide-react';

import TranscriptMode from './TranscriptMode';

/** 網址列的 #：伺服器端當作空字串，這樣不會跟 hydration 打架 */
function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export default function EpisodeViewer({ episode }: { episode: EpisodeData }) {
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => '',
  );
  // 從首頁卡片的簡述點進來時網址會帶 #section-N：預設就開在段落紀錄，捲到那一段
  const anchoredSection = /^#section-(\d+)$/.exec(hash)?.[1] ?? null;

  // 使用者自己按過分頁就以他按的為準，沒按過才看網址
  const [pickedView, setPickedView] = useState<'summary' | 'lossless' | 'transcript' | null>(null);
  const viewType = pickedView ?? (anchoredSection ? 'lossless' : 'summary');
  const setViewType = setPickedView;
  const [isCardMode, setIsCardMode] = useState(false);

  useEffect(() => {
    if (!anchoredSection) return;
    // 直接落點，不用滑的：從首頁點進來本來就等同開新頁，捲個五千像素只是拖時間
    document.getElementById(`section-${anchoredSection}`)?.scrollIntoView({ block: 'start' });
  }, [anchoredSection]);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Header */}
      <header className="mb-6 flex flex-col items-center w-full">
        <div className="flex flex-wrap justify-center gap-3 mb-5">
          <span className="px-6 py-2 bg-brand-yellow/10 dark:bg-zinc-800 text-brand-yellow rounded-full text-lg font-bold tracking-wider">
            {episode.episodeLabel || `第 ${episode.episodeNumber} 回`}
          </span>
          {episode.guest && (
            <span className="px-6 py-2 rounded-full text-lg font-bold tracking-wider shadow-sm bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              來賓：{episode.guest}
            </span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center leading-tight">{episode.title}</h1>
        
        <div className="w-full max-w-2xl flex items-center justify-center gap-4">
          {/* 左側漸層線條 */}
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-brand-yellow/50"></div>
          {/* 日期 (置中) */}
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium whitespace-nowrap tracking-wider">
            {episode.date} 配信
            {episode.durationMinutes ? `・${formatDuration(episode.durationMinutes)}` : ''}
          </p>
          {/* 右側漸層線條 */}
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-brand-yellow/50"></div>
        </div>
      </header>

      {/* Toolbar Area */}
      <div className="w-full flex flex-col lg:flex-row gap-4 mb-6">
        {/* YouTube Link */}
        {episode.youtubeUrl && (
          <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:px-5 flex items-center justify-between shadow-sm transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 text-red-500 p-2.5 rounded-full flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 whitespace-nowrap">官方 YouTube 收聽</h3>
            </div>
            <a 
              href={episode.youtubeUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-400 font-bold rounded-xl transition-colors text-sm whitespace-nowrap ml-2 flex-shrink-0 shadow-sm border border-red-200 dark:border-red-500/30"
            >
              前往
            </a>
          </div>
        )}

        {/* Control Panel */}
        <div className="flex-[1.7] relative z-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:px-5 flex flex-col sm:flex-row justify-between items-center gap-2 lg:gap-3 shadow-sm overflow-x-auto">
          
          {/* Content Toggle */}
          <div className="flex w-full sm:w-auto bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-xl shrink-0 min-w-min">
            <button
              onClick={() => setViewType('summary')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-bold transition-all text-sm border ${viewType === 'summary' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border-transparent dark:border-zinc-700/50' : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              精簡總結
            </button>
            <button
              onClick={() => setViewType('lossless')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-bold transition-all text-sm border ${viewType === 'lossless' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border-transparent dark:border-zinc-700/50' : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              段落紀錄
            </button>
            <button
              onClick={() => setViewType('transcript')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-bold transition-all text-sm border ${viewType === 'transcript' ? 'bg-brand-yellow/15 dark:bg-brand-yellow/20 text-brand-yellow shadow-sm border-transparent dark:border-brand-yellow/20' : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              逐字稿
            </button>
          </div>

          {/* Mode Toggle */}
          <div className={`flex w-full sm:w-auto bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-xl shrink-0 min-w-min ${viewType === 'transcript' ? 'opacity-50 pointer-events-none' : ''}`}>
            <button
              onClick={() => setIsCardMode(true)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-bold transition-all text-sm border ${isCardMode ? 'bg-brand-yellow/15 dark:bg-brand-yellow/20 text-brand-yellow shadow-sm border-transparent dark:border-brand-yellow/20' : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              <LayoutGrid size={18} strokeWidth={2.5} className="shrink-0" />
              <span className="whitespace-nowrap">圖卡</span>
            </button>
            <button
              onClick={() => setIsCardMode(false)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-bold transition-all text-sm border ${!isCardMode ? 'bg-brand-yellow/15 dark:bg-brand-yellow/20 text-brand-yellow shadow-sm border-transparent dark:border-brand-yellow/20' : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              <AlignLeft size={18} strokeWidth={2.5} className="shrink-0" />
              <span className="whitespace-nowrap">文字</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full flex justify-center">
        {viewType === 'transcript' ? (
          <TranscriptMode episode={episode} />
        ) : isCardMode ? (
          <CardMode key={viewType} episode={episode} isLossless={viewType === 'lossless'} />
        ) : (
          <TextMode episode={episode} isLossless={viewType === 'lossless'} />
        )}
      </div>
    </div>
  );
}
