'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import supabaseClient from '@/lib/supabaseClient';
import {
  DEFAULT_LOCALE,
  LOCAL_STORAGE_LOCALE_KEY,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/constants';

const resolveLocale = (): Locale => {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const saved = localStorage.getItem(LOCAL_STORAGE_LOCALE_KEY);
  if ((SUPPORTED_LOCALES as readonly string[]).includes(saved ?? '')) {
    return saved as Locale;
  }

  return DEFAULT_LOCALE;
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const syncSessionAndRedirect = async () => {
      try {
        await supabaseClient.auth.getSession();
      } catch (error) {
        console.error('[auth/callback] unable to load session', error);
        if (isMounted) {
          setHasError(true);
        }
      } finally {
        const locale = resolveLocale();
        router.replace(`/${locale}/user`);
        router.refresh();
      }
    };

    void syncSessionAndRedirect();
    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-navy-900/80 px-6 py-8 text-center shadow-card">
        <Loader2 className="h-6 w-6 animate-spin text-accent-gold" />
        <p className="text-lg font-semibold text-white">Accesso in corso…</p>
        <p className="text-sm text-slate-300">
          {hasError
            ? 'Non siamo riusciti a verificare la sessione, verrai reindirizzato.'
            : 'Ti reindirizziamo al tuo profilo.'}
        </p>
      </div>
    </main>
  );
}
