'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { LOCAL_STORAGE_LOCALE_KEY, type Locale } from '@/lib/constants';

const languages: { label: string; value: Locale }[] = [
  { label: 'IT', value: 'it' },
  { label: 'EN', value: 'en' },
];

export const LanguageToggle = ({
  locale,
}: {
  locale: Locale;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [activeLocale, setActiveLocale] = useState<Locale>(locale);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setActiveLocale(locale);
  }, [locale]);

  const switchLocale = (value: Locale) => {
    if (value === activeLocale) {
      return;
    }

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      segments.push(value);
    } else {
      segments[0] = value;
    }

    const nextPath = `/${segments.join('/')}`;
    localStorage.setItem(LOCAL_STORAGE_LOCALE_KEY, value);
    startTransition(() => {
      router.push(nextPath === '//' ? `/${value}` : nextPath);
    });
  };

  return (
    <div className="flex rounded-full border border-accent-gold/50 bg-navy-900/60 p-1 text-[11px] uppercase shadow-card sm:text-xs">
      {languages.map(({ label, value }) => (
        <button
          key={value}
          type="button"
          disabled={isPending}
          onClick={() => switchLocale(value)}
          className={`px-2 py-1 transition-colors ${
            value === activeLocale
              ? 'bg-gradient-to-r from-accent-gold/90 to-accent-ice/90 font-semibold text-navy-950 shadow-lg sm:text-sm'
              : 'text-[10px] font-medium text-slate-200 hover:text-white sm:text-xs'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
