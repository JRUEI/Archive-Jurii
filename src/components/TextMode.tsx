'use client';

import { EpisodeData, EpisodeCard } from '@/lib/markdown';
import { motion, useScroll } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import React, { useEffect, useRef, useState } from 'react';
import { useFocusMode } from './FocusModeProvider';
import { scrollBehavior } from '@/lib/motion';

function SectionBlock({ card, index, isFocusMode }: { card: EpisodeCard, index: number, isFocusMode: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isFocusMode) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsActive(entry.isIntersecting);
    }, { rootMargin: '-30% 0px -40% 0px', threshold: 0 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isFocusMode]);

  return (
    <div 
      ref={ref} 
      id={`section-${index + 1}`}
      className={`relative scroll-mt-24 transition-all duration-500 ease-out ${isFocusMode ? 'cursor-pointer' : ''} ${isFocusMode && !isActive ? 'opacity-40 scale-95' : 'opacity-100 scale-100'} ${isFocusMode && isActive ? 'bg-zinc-50 dark:bg-brand-yellow/5 shadow-[inset_0_0_0_1px_rgba(169,124,43,0.12)] rounded-3xl p-6 md:p-8 -mx-6 md:-mx-8' : ''}`}
      onClick={() => isFocusMode && ref.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })}
    >
      {/* Timeline Line */}
      <div className={`hidden sm:block absolute top-0 bottom-0 rounded-full transition-all duration-500 w-1.5 left-0 bg-gradient-to-b from-brand-yellow to-brand-brown shadow-[0_0_12px_rgba(201,162,39,0.45)] ${isFocusMode && isActive ? 'opacity-100' : 'opacity-0'}`} />
      
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
        {card.tag && (
          <div className={`inline-flex transition-all duration-500`}>
            <span className={`text-brand-ochre dark:text-brand-yellow border border-brand-yellow/50 bg-transparent px-4 py-1.5 rounded-full text-sm font-bold tracking-widest shadow-[0_0_8px_rgba(201,162,39,0.25)]`}>
              {card.tag}
            </span>
          </div>
        )}
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 m-0 tracking-tight">
          {card.title}
        </h3>
      </div>
      <div className="mt-6 space-y-4">
        {card.content.map((line, lineIdx) => {
          if (line.startsWith('QUOTE:')) {
            const quoteText = line.replace('QUOTE:', '');
            return (
              <blockquote key={lineIdx} className="border-l-4 border-brand-yellow bg-brand-yellow/5 dark:bg-brand-yellow/10 p-4 rounded-r-lg text-zinc-700 dark:text-zinc-300">
                {quoteText}
              </blockquote>
            );
          }
          
          const cardMatch = line.match(/^\*\s*\*\*(.*?)\*\*[：:]?\s*(.*)$/);
          if (cardMatch) {
            const title = cardMatch[1];
            const text = cardMatch[2];
            return (
              // 左右兩欄行高不同，用 baseline 讓小標跟內文第一行對齊
              <div key={lineIdx} className="bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-baseline gap-4 md:gap-8 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors shadow-sm dark:shadow-none">
                <div className="text-brand-ochre text-lg md:w-32 shrink-0 tracking-wider font-bold">
                  {title}
                </div>
                <div className="text-zinc-700 dark:text-zinc-400 text-lg leading-relaxed m-0 flex-1">
                  {text}
                </div>
              </div>
            );
          }

          // Normal bullet list item (without strong tag at start)
          const bulletMatch = line.match(/^\*\s*(.*)$/);
          if (bulletMatch) {
            return (
              <ul key={lineIdx} className="space-y-4 my-6 pl-0">
                <li className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300 pl-6 list-disc marker:text-brand-yellow/60">
                  {bulletMatch[1]}
                </li>
              </ul>
            );
          }

          return (
            <p key={lineIdx} className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300 my-4">
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export default function TextMode({ episode, isLossless }: { episode: EpisodeData, isLossless: boolean }) {
  // Note: useScroll runs even in summary mode because React hooks cannot be called conditionally
  const { scrollYProgress } = useScroll();
  const { isFocusMode } = useFocusMode();

  if (!isLossless) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 md:p-12 shadow-xl text-zinc-800 dark:text-zinc-200">
        <h2 className="text-2xl font-bold text-brand-yellow mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">精簡總結</h2>
        <ul className="space-y-4">
          {episode.summary.map((item, idx) => (
            <li key={idx} className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
              <ReactMarkdown>{item}</ReactMarkdown>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-yellow to-brand-brown origin-left z-[var(--z-toast)]"
        style={{ scaleX: scrollYProgress }}
      />
      <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 md:p-12 shadow-xl">
        <h2 className="text-2xl font-bold text-brand-yellow mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800">節目文字全紀錄</h2>
        
        <div className="space-y-8">
          {episode.cards.map((card, idx) => (
            <SectionBlock key={idx} card={card} index={idx} isFocusMode={isFocusMode} />
          ))}
        </div>
      </div>
    </>
  );
}
