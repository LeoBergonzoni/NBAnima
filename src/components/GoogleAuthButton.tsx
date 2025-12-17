'use client';

import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import supabaseClient from '@/lib/supabaseClient';

type GoogleAuthButtonProps = {
  label?: string;
  className?: string;
};

const LINKING_FALLBACK_MESSAGE =
  'Accedi con email e poi collega Google dalla pagina User';

export function GoogleAuthButton({
  label = 'Continua con Google',
  className,
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabaseClient.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }

      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : undefined;

      if (sessionData.session?.user) {
        const linkIdentity = (
          supabaseClient.auth as typeof supabaseClient.auth & {
            linkIdentity?: typeof supabaseClient.auth.linkIdentity;
          }
        ).linkIdentity;

        if (typeof linkIdentity !== 'function') {
          alert(LINKING_FALLBACK_MESSAGE);
          return;
        }

        const { data, error } = await linkIdentity({
          provider: 'google',
          options: { redirectTo },
        } as Parameters<typeof linkIdentity>[0]);
        if (error) {
          throw error;
        }
        if (data?.url) {
          window.location.href = data.url;
        }
        return;
      }

      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) {
        throw error;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('[GoogleAuthButton] auth error', error);
      alert("Non è stato possibile completare l'operazione. Riprova più tardi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={clsx(
        'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:border-accent-gold/60 hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className="text-lg" aria-hidden>
          G
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}
