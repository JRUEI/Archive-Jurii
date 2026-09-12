'use client';

import React, { createContext, useContext, useState } from 'react';
import { readStoredBoolean, useHydrated, writeStoredBoolean } from '@/lib/client-state';

type HomeLayoutContextType = {
  showCalendar: boolean;
  setShowCalendar: (value: boolean) => void;
};

const HomeLayoutContext = createContext<HomeLayoutContextType | undefined>(undefined);
const CALENDAR_STORAGE_KEY = 'jurii-show-calendar';

export function HomeLayoutProvider({ children }: { children: React.ReactNode }) {
  const [showCalendar, setShowCalendar] = useState(
    () => readStoredBoolean(CALENDAR_STORAGE_KEY, true),
  );
  const mounted = useHydrated();

  const handleSetShowCalendar = (value: boolean) => {
    setShowCalendar(value);
    writeStoredBoolean(CALENDAR_STORAGE_KEY, value);
  };

  // SSR 時一律用預設值，避免 hydration 不一致
  const value = mounted
    ? { showCalendar, setShowCalendar: handleSetShowCalendar }
    : { showCalendar: true, setShowCalendar: () => {} };

  return <HomeLayoutContext.Provider value={value}>{children}</HomeLayoutContext.Provider>;
}

export function useHomeLayout() {
  const context = useContext(HomeLayoutContext);
  if (context === undefined) {
    throw new Error('useHomeLayout must be used within a HomeLayoutProvider');
  }
  return context;
}
