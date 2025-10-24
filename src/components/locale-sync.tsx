'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import {
  DEFAULT_LOCALE,
  LOCAL_STORAGE_LOCALE_KEY,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/constants';

const isSupportedLocale = (value: string): value is Locale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

export const LocaleSync = ({ locale }: { locale: Locale }) => {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedLocale = localStorage.getItem(LOCAL_STORAGE_LOCALE_KEY);
    if (!savedLocale) {
      localStorage.setItem(LOCAL_STORAGE_LOCALE_KEY, locale);
      return;
    }

    if (isSupportedLocale(savedLocale) && savedLocale !== locale) {
      const segments = pathname.split('/').filter(Boolean);
      segments[0] = savedLocale;
      const nextPath = `/${segments.join('/')}`;
      router.replace(nextPath === '//' ? `/${DEFAULT_LOCALE}` : nextPath);
    } else {
      localStorage.setItem(LOCAL_STORAGE_LOCALE_KEY, locale);
    }
  }, [locale, pathname, router]);

  return null;
};
