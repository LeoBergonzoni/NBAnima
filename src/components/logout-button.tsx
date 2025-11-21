'use client';

import clsx from 'clsx';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { Locale } from '@/lib/constants';
import { createBrowserSupabase } from '@/lib/supabase-browser';

type LogoutButtonProps = {
  locale: Locale;
  label: string;
  className?: string;
  iconClassName?: string;
};

export function LogoutButton({ locale, label, className, iconClassName }: LogoutButtonProps) {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push(`/${locale}`);
      router.refresh();
    } catch (error) {
      console.error('[logout] signOut failed', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      type='button'
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border border-white/15 bg-navy-900/80 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-accent-gold/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <LogOut className={clsx('h-3 w-3', iconClassName)} />
      <span>{isLoggingOut ? '…' : label}</span>
    </button>
  );
}
