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
  nameLabel?: string;
  emailLabel: string;
  passwordLabel: string;
  confirmPasswordLabel?: string;
  passwordMismatch: string;
  genericError: string;
  confirmationNotice?: string;
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = (formData.get('email') ?? '').toString().trim();
    const password = (formData.get('password') ?? '').toString();
    const confirmPassword =
      (formData.get('confirmPassword') ?? '').toString();
    const fullNameEntry = formData.get('fullName');
    const fullName =
      typeof fullNameEntry === 'string' ? fullNameEntry.trim() : '';

    if (!email || !password) {
      setErrorMessage(copy.genericError);
      return;
    }

    if (mode === 'signup' && !fullName) {
      setErrorMessage(copy.genericError);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMessage(copy.passwordMismatch);
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        if (mode === 'signup') {
          const emailRedirectTo =
            typeof window !== 'undefined'
              ? `${window.location.origin}/${locale}/login`
              : undefined;

          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo,
              data: fullName ? { full_name: fullName } : undefined,
            },
          });
          if (error) {
            throw error;
          }
          form.reset();
          setStatusMessage(copy.confirmationNotice ?? null);
          setIsRedirecting(false);
          return;
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) {
            throw error;
          }
          const user = data.user;
          if (user) {
            const metadataName =
              (user.user_metadata?.full_name as string | undefined)?.trim() ?? null;
            try {
              await supabase
                .from('users')
                .upsert(
                  {
                    id: user.id,
                    email: user.email ?? email,
                    full_name: metadataName ?? undefined,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'id' },
                );
            } catch (profileError) {
              console.warn('[AuthForm] Failed to sync profile', profileError);
            }
          }
          setStatusMessage(null);
          setIsRedirecting(true);
          router.push(`/${locale}/dashboard`);
          router.refresh();
        }
      } catch (error) {
        console.error('[AuthForm] Auth error', error);
        setErrorMessage((error as Error).message || copy.genericError);
        setStatusMessage(null);
        setIsRedirecting(false);
      }
    });
  };

  return (
    <main className="flex min-h-screen flex-col bg-navy-950 pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full max-w-lg rounded-[2.25rem] border border-accent-gold/40 bg-navy-900/80 p-6 shadow-card backdrop-blur">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold text-white">{copy.title}</h1>
            <p className="text-sm text-slate-300">{copy.subtitle}</p>
          </div>
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-8 space-y-5"
          >
            {mode === 'signup' ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  {copy.nameLabel ?? 'Name'}
                </span>
                <input
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-navy-800/90 px-4 py-3 text-base text-white shadow-inner focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/60"
                />
              </label>
            ) : null}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">
                {copy.emailLabel}
              </span>
              <input
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                className="w-full rounded-2xl border border-white/10 bg-navy-800/90 px-4 py-3 text-base text-white shadow-inner focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/60"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">
                {copy.passwordLabel}
              </span>
              <input
                type="password"
                name="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                className="w-full rounded-2xl border border-white/10 bg-navy-800/90 px-4 py-3 text-base text-white shadow-inner focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/60"
              />
            </label>
            {mode === 'signup' ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  {copy.confirmPasswordLabel ?? copy.passwordLabel}
                </span>
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-navy-800/90 px-4 py-3 text-base text-white shadow-inner focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/60"
                />
              </label>
            ) : null}
            <div
              role="status"
              aria-live="polite"
              className="min-h-[1.5rem] space-y-2"
            >
              {errorMessage ? (
                <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                  {errorMessage}
                </p>
              ) : null}
              {statusMessage ? (
                <p className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
                  {statusMessage}
                </p>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={isPending || isRedirecting}
              aria-busy={isPending || isRedirecting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent-gold via-accent-coral to-accent-gold px-4 py-3 text-base font-semibold text-navy-900 shadow-card transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
        </section>
      </div>
    </main>
  );
};
