'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { Settings, PlayCircle, Radio, Users } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useFocusMode } from './FocusModeProvider';
import { useHomeLayout } from './HomeLayoutProvider';
import { useHydrated } from '@/lib/client-state';
import { InstagramIcon, TikTokIcon, XIcon } from './BrandIcons';
import type { MemberSns } from '@/lib/members';

const SNS_CLASS =
  'w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-brand-cream hover:bg-brand-brown dark:hover:text-[#2E2118] dark:hover:bg-brand-tan transition-colors';

export default function Header({ hostSns }: { hostSns?: MemberSns }) {
  const { theme, setTheme } = useTheme();
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const { showCalendar, setShowCalendar } = useHomeLayout();
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isMembers = pathname === '/members';
  
  const mounted = useHydrated();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="relative max-w-4xl mx-auto h-16 flex items-center justify-between">
        <Link href="/" className="shrink-0 text-base sm:text-lg md:text-2xl font-black tracking-tight whitespace-nowrap">
          逢田 珠里依の{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow to-brand-brown">
            SHOWROOM
          </span>
        </Link>

        {/* 副標：對整列置中，窗寬不夠就不顯示（會撞到左邊標題） */}
        {isHome && (
          <p className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap pointer-events-none">
            非公式內容紀錄
          </p>
        )}
        <div className="flex gap-1.5 sm:gap-2 items-center font-medium text-sm">
          {hostSns && (
            <div className="hidden md:flex items-center gap-1 mr-1">
              <a href={hostSns.x} target="_blank" rel="noopener noreferrer" title="逢田珠里依 X" aria-label="逢田珠里依 X" className={SNS_CLASS}>
                <XIcon size={16} />
              </a>
              <a href={hostSns.instagram} target="_blank" rel="noopener noreferrer" title="逢田珠里依 Instagram" aria-label="逢田珠里依 Instagram" className={SNS_CLASS}>
                <InstagramIcon size={16} />
              </a>
              {hostSns.tiktok && (
                <a href={hostSns.tiktok} target="_blank" rel="noopener noreferrer" title="逢田珠里依 TikTok" aria-label="逢田珠里依 TikTok" className={SNS_CLASS}>
                  <TikTokIcon size={16} />
                </a>
              )}
              <a href={hostSns.showroom} target="_blank" rel="noopener noreferrer" title="逢田珠里依 SHOWROOM" aria-label="逢田珠里依 SHOWROOM" className={SNS_CLASS}>
                <Radio size={16} />
              </a>
            </div>
          )}
          <Link
            href="/members"
            className={`group h-10 inline-flex items-center justify-center px-3 rounded-full font-bold transition-all shadow-sm hover:shadow-md hover:shadow-brand-yellow/10 ${
              isMembers
                ? 'bg-brand-brown text-brand-cream dark:bg-brand-tan dark:text-[#2E2118]'
                : 'bg-brand-yellow/10 dark:bg-brand-yellow/20 text-brand-ochre dark:text-brand-yellow hover:bg-brand-yellow/20 dark:hover:bg-brand-yellow/30'
            }`}
          >
            <Users size={16} className="shrink-0" />
            <span className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] transition-[grid-template-columns] duration-300 ease-out">
              <span className="overflow-hidden whitespace-nowrap tracking-wide">
                <span className="block pl-1.5">≒JOY 成員</span>
              </span>
            </span>
          </Link>
          <a 
            href="https://www.youtube.com/playlist?list=PLlymhAaiVUgSg8_nmjqRDYykXz0x5SFcV" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group h-10 inline-flex items-center justify-center px-3 bg-red-100 text-red-800 dark:bg-red-500/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/40 rounded-full font-bold transition-all shadow-sm hover:shadow-md hover:shadow-red-500/10"
          >
            <PlayCircle size={16} className="shrink-0" />
            <span className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] transition-[grid-template-columns] duration-300 ease-out">
              <span className="overflow-hidden whitespace-nowrap tracking-wide">
                <span className="block pl-1.5">影片清單</span>
              </span>
            </span>
          </a>
          {mounted && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-sm focus:outline-none hover:shadow-md ${isOpen ? 'bg-brand-yellow text-white shadow-brand-yellow/20' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-brand-yellow dark:hover:text-brand-yellow hover:bg-brand-yellow/10 dark:hover:bg-brand-yellow/20'}`}
                title="設定"
                aria-label="Toggle Settings"
              >
                <Settings size={20} className={isOpen ? "animate-spin-slow" : ""} />
              </button>
              
              {/* Dropdown Menu */}
              <div className={`absolute top-full right-0 mt-2 w-56 sm:w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 origin-top-right transition-all duration-200 p-2 sm:p-3 ${isOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                  <div className="px-3 pb-2 pt-1 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                      <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 tracking-wider">排版與主題設定</span>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                      {isHome && (
                        <label className="flex justify-between items-center cursor-pointer group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 p-2 rounded-lg transition-colors">
                            <span className="text-sm font-bold transition-colors text-zinc-700 dark:text-zinc-300 group-hover:text-brand-yellow">月曆選日區</span>
                            <div className="relative">
                                <input type="checkbox" className="sr-only" checked={showCalendar} onChange={() => setShowCalendar(!showCalendar)} />
                                <div className={`block w-10 sm:w-11 h-6 rounded-full shadow-inner transition-colors duration-300 ${showCalendar ? 'bg-brand-yellow' : 'bg-zinc-200 dark:bg-zinc-700'}`}></div>
                                <div className={`absolute top-1 bg-white w-4 h-4 rounded-full shadow transition-all duration-300 ease-in-out ${showCalendar ? 'left-[calc(100%-1.25rem)] sm:left-[calc(100%-1.25rem)]' : 'left-1'}`}></div>
                            </div>
                        </label>
                      )}

                      {!isHome && (
                        <label className="flex justify-between items-center cursor-pointer group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 p-2 rounded-lg transition-colors">
                            <span className="text-sm font-bold transition-colors text-zinc-700 dark:text-zinc-300 group-hover:text-brand-yellow">發光特效</span>
                            <div className="relative">
                                <input type="checkbox" className="sr-only" checked={isFocusMode} onChange={toggleFocusMode} />
                                <div className={`block w-10 sm:w-11 h-6 rounded-full shadow-inner transition-colors duration-300 ${isFocusMode ? 'bg-brand-yellow' : 'bg-zinc-200 dark:bg-zinc-700'}`}></div>
                                <div className={`absolute top-1 bg-white w-4 h-4 rounded-full shadow transition-all duration-300 ease-in-out ${isFocusMode ? 'left-[calc(100%-1.25rem)] sm:left-[calc(100%-1.25rem)]' : 'left-1'}`}></div>
                            </div>
                        </label>
                      )}

                      <label className={`flex justify-between items-center cursor-pointer group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 p-2 rounded-lg transition-colors ${isHome ? 'border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-2' : ''}`}>
                          <span className="text-sm font-bold transition-colors text-zinc-700 dark:text-zinc-300 group-hover:text-brand-yellow">亮色主題</span>
                          <div className="relative">
                              <input type="checkbox" className="sr-only" checked={theme === 'light'} onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
                              <div className={`block w-10 sm:w-11 h-6 rounded-full shadow-inner transition-colors duration-300 ${theme === 'light' ? 'bg-amber-400' : 'bg-zinc-200 dark:bg-zinc-700'}`}></div>
                              <div className={`absolute top-1 bg-white w-4 h-4 rounded-full shadow transition-all duration-300 ease-in-out ${theme === 'light' ? 'left-[calc(100%-1.25rem)] sm:left-[calc(100%-1.25rem)]' : 'left-1'}`}></div>
                          </div>
                      </label>
                  </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </nav>
  );
}
