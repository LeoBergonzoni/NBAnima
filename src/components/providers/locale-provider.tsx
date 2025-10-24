'use client';

import { createContext, useContext } from 'react';

import type { Locale } from '@/lib/constants';
import type { Dictionary } from '@/locales/dictionaries';

interface LocaleContextValue {
  locale: Locale;
  dictionary: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export const LocaleProvider = ({
  value,
  children,
}: {
  value: LocaleContextValue;
  children: React.ReactNode;
}) => (
  <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
);

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
