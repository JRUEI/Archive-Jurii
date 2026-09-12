'use client';

import { useFocusMode } from './FocusModeProvider';

export default function HeroGlow() {
  const { isFocusMode } = useFocusMode();
  return (
    <div 
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-yellow/40 dark:bg-brand-yellow/30 blur-[80px] rounded-full pointer-events-none transition-opacity duration-700 ease-out ${
        isFocusMode ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
