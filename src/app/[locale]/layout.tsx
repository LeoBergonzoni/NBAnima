import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LanguageToggle } from '@/components/language-toggle';
import { LocaleSync } from '@/components/locale-sync';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { APP_TITLE, SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { getDictionary } from '@/locales/dictionaries';

const LOGO_SRC = '/logo.png';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);

  return (
    <LocaleProvider value={{ locale, dictionary }}>
      <LocaleSync locale={locale} />
      <div className="relative min-h-screen overflow-hidden bg-navy-900 text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-grid-overlay opacity-60" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-white/5 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/${locale}`} className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-accent-gold/40 shadow-card">
                <Image src={LOGO_SRC} alt={APP_TITLE} fill className="object-cover" priority />
              </div>
              <div>
                <p className="text-sm uppercase tracking-widest text-accent-gold/80">{APP_TITLE}</p>
                <p className="text-base font-semibold text-white">NBAnima</p>
              </div>
            </Link>
            <div className="flex flex-1 items-center justify-between gap-4 sm:justify-end">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                {dictionary.dashboard.welcome}
              </p>
              <LanguageToggle locale={locale} />
            </div>
          </header>
          <main className="flex-1 py-8">{children}</main>
          <footer className="mt-auto flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} NBAnima</span>
            <span>{APP_TITLE}</span>
          </footer>
        </div>
      </div>
    </LocaleProvider>
  );
}
