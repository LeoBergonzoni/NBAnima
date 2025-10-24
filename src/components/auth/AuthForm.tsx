'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { createBrowserSupabase } from '@/lib/supabase-browser';

interface AuthFormCopy {
  title: string;
  subtitle: string;
  submit: string;
  switchPrompt: string;
  switchCta: string;
  emailLabel: string;
  passwordLabel: string;
  confirmPasswordLabel?: string;
  passwordMismatch: string;
  genericError: string;
}

interface AuthFormProps {
  mode: 'login' | 'signup';
  locale: string;
  copy: AuthFormCopy;
  switchHref: string;
}

export const AuthForm = ({ mode, locale, copy, switchHref }: AuthFormProps) => {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = (formData.get('email') ?? '').toString().trim();
    const password = (formData.get('password') ?? '').toString();
    const confirmPassword =
      (formData.get('confirmPassword') ?? '').toString();

    if (!email || !password) {
      setErrorMessage(copy.genericError);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMessage(copy.passwordMismatch);
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      try {
        if (mode === 'signup') {
          const { error } = await supabase.auth.signUp({
            email,
            password,
          });
          if (error) {
            throw error;
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) {
            throw error;
          }
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setErrorMessage(copy.genericError);
          return;
        }
        setIsRedirecting(true);
        router.push(`/${locale}/dashboard`);
        router.refresh();
      } catch (error) {
        setErrorMessage((error as Error).message || copy.genericError);
        setIsRedirecting(false);
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-accent-gold/40 bg-navy-900/70 p-8 shadow-card backdrop-blur">
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-white">{copy.title}</h1>
          <p className="text-sm text-slate-300">{copy.subtitle}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">
              {copy.emailLabel}
            </span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-xl border border-white/10 bg-navy-800/80 px-4 py-3 text-sm text-white shadow-inner focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/60"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">
              {copy.passwordLabel}
            </span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-xl border border-white/10 bg-navy-800/80 px-4 py-3 text-sm text-white shadow-inner focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/60"
            />
          </label>
          {mode === 'signup' ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">
                {copy.confirmPasswordLabel}
              </span>
              <input
                type="password"
                name="confirmPassword"
                required
                className="w-full rounded-xl border border-white/10 bg-navy-800/80 px-4 py-3 text-sm text-white shadow-inner focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/60"
              />
            </label>
          ) : null}
          {errorMessage ? (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isPending || isRedirecting}
            className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-accent-gold via-accent-coral to-accent-gold px-4 py-3 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending || isRedirecting ? '…' : copy.submit}
          </button>
        </form>
        {isRedirecting ? (
          <p className="mt-4 text-center text-sm text-slate-400">
            Redirecting to your dashboard…
          </p>
        ) : null}
        <div className="mt-6 text-center text-sm text-slate-300">
          <span>{copy.switchPrompt} </span>
          <Link
            href={switchHref}
            className="font-semibold text-accent-gold hover:underline"
          >
            {copy.switchCta}
          </Link>
        </div>
      </div>
    </div>
  );
};
