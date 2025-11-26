import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LanguageToggle } from '@/components/language-toggle';
import { LocaleSync } from '@/components/locale-sync';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { UserNavButton } from '@/components/user-nav-button';
import { APP_TITLE, SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { getDictionary } from '@/locales/dictionaries';
import { createServerSupabase } from '@/lib/supabase';
import { ensureUserProfile } from '@/lib/server/ensureUserProfile';

const LOGO_SRC = '/logo.png';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(rawLocale as Locale) ? (rawLocale as Locale) : undefined;
  if (!locale) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    try {
      const profile = await ensureUserProfile(user.id, user.email);
      role = profile.role ?? null;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[layout] unable to load user role', error);
      }
    }
  }

  return (
    <LocaleProvider value={{ locale, dictionary }}>
      <LocaleSync locale={locale} />
      <div className="relative min-h-screen overflow-hidden bg-navy-900 text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-grid-overlay opacity-60" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <header className="border-b border-white/5 pb-4 sm:pb-6">
            <div className="flex items-center justify-between sm:hidden">
              <Link href={`/${locale}`} className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-accent-gold/40 shadow-card">
                  <Image src={LOGO_SRC} alt={APP_TITLE} fill className="object-cover" priority />
                </div>
                <p className="text-base font-semibold text-white">NBAnima</p>
              </Link>
              {role === 'admin' ? (
                <Link
                  href={`/${locale}/admin`}
                  className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-navy-900/60 px-3 py-1 text-xs font-semibold text-accent-gold transition hover:border-accent-gold"
                >
                  {dictionary.common.admin}
                  <span aria-hidden>↗</span>
                </Link>
              ) : null}
            </div>

            <div className="hidden items-center justify-between gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
              <Link href={`/${locale}`} className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-accent-gold/40 shadow-card">
                  <Image src={LOGO_SRC} alt={APP_TITLE} fill className="object-cover" priority />
                </div>
                <div>
                  <p className="hidden text-sm uppercase tracking-widest text-accent-gold/80 sm:block">
                    {APP_TITLE}
                  </p>
                  <p className="text-base font-semibold text-white">NBAnima</p>
                </div>
              </Link>
              <div className="flex items-center gap-4">
                <LanguageToggle locale={locale} />
                <UserNavButton locale={locale} label={dictionary.user.title} />
              </div>
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
