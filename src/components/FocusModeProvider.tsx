'use client';

import React, { createContext, useContext, useState } from 'react';
import { readStoredBoolean, useHydrated, writeStoredBoolean } from '@/lib/client-state';

type FocusModeContextType = {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
};

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);
const FOCUS_MODE_STORAGE_KEY = 'harumatope-focus-mode';

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [isFocusMode, setIsFocusMode] = useState(
    () => readStoredBoolean(FOCUS_MODE_STORAGE_KEY, false),
  );
  const mounted = useHydrated();

  const toggleFocusMode = () => {
    setIsFocusMode(prev => {
      const next = !prev;
      writeStoredBoolean(FOCUS_MODE_STORAGE_KEY, next);
      return next;
    });
  };

  if (!mounted) {
    return (
      <FocusModeContext.Provider value={{ isFocusMode: false, toggleFocusMode: () => {} }}>
        {children}
      </FocusModeContext.Provider>
    );
  }

  return (
    <FocusModeContext.Provider value={{ isFocusMode, toggleFocusMode }}>
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  const context = useContext(FocusModeContext);
  if (context === undefined) {
    throw new Error('useFocusMode must be used within a FocusModeProvider');
  }
  return context;
}
