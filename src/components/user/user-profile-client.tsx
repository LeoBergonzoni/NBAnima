'use client';

import clsx from 'clsx';
import { ArrowLeft, Check, Loader2, Pencil, UserCircle2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { GoogleAuthButton } from '@/components/GoogleAuthButton';
import { LanguageToggle } from '@/components/language-toggle';
import { LogoutButton } from '@/components/logout-button';
import { useLocale } from '@/components/providers/locale-provider';
import type { Locale } from '@/lib/constants';
import { AVATAR_OPTIONS, type AvatarOption } from '@/lib/avatar-options';
import { createBrowserSupabase } from '@/lib/supabase-browser';

type UserProfileClientProps = {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  locale: Locale;
};

type ProfileUpdate = {
  full_name?: string | null;
  avatar_url?: string | null;
};

export function UserProfileClient({
  userId,
  email,
  fullName,
  avatarUrl,
  locale,
}: UserProfileClientProps) {
  const { dictionary } = useLocale();
  const copy = dictionary.user;
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(avatarUrl ?? null);
  const [name, setName] = useState<string>(fullName ?? '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCheckingIdentity, setIsCheckingIdentity] = useState(true);
  const [hasGoogleIdentity, setHasGoogleIdentity] = useState(false);

  useEffect(() => {
    if (avatarModalOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [avatarModalOpen]);

  useEffect(() => {
    let isMounted = true;
    const fetchIdentities = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) {
          throw error;
        }
        const isGoogleLinked =
          user?.identities?.some((identity) => identity.provider === 'google') ?? false;
        if (isMounted) {
          setHasGoogleIdentity(isGoogleLinked);
        }
      } catch (identityError) {
        console.error('[user] failed to load identities', identityError);
      } finally {
        if (isMounted) {
          setIsCheckingIdentity(false);
        }
      }
    };

    void fetchIdentities();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const updateProfile = async (payload: ProfileUpdate) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const { error } = await supabase
      .from('users')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      throw error;
    }
  };

  const handleAvatarSelect = async (option: AvatarOption) => {
    setIsSavingAvatar(true);
    try {
      await updateProfile({ avatar_url: option.src });
      setCurrentAvatar(option.src);
      setStatusMessage(copy.statusSaved);
      setAvatarModalOpen(false);
    } catch (error) {
      console.error('[user] failed to save avatar', error);
      setErrorMessage(copy.statusError);
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    setIsSavingName(true);
    try {
      await updateProfile({ full_name: trimmed.length ? trimmed : null });
      setStatusMessage(copy.statusSaved);
      setIsEditingName(false);
    } catch (error) {
      console.error('[user] failed to save name', error);
      setErrorMessage(copy.statusError);
    } finally {
      setIsSavingName(false);
    }
  };

  const groupedAvatars: Record<'east' | 'west', AvatarOption[]> = useMemo(
    () => ({
      east: AVATAR_OPTIONS.filter((option) => option.coast === 'east'),
      west: AVATAR_OPTIONS.filter((option) => option.coast === 'west'),
    }),
    [],
  );

  const displayName = name.trim() || email || 'NBAnima user';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-white">{copy.title}</h1>
        <p className="text-sm text-slate-300">{copy.subtitle}</p>
      </header>

      <section className="rounded-[2rem] border border-accent-gold/40 bg-navy-900/80 p-6 shadow-card">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="relative flex flex-col items-center gap-3">
            <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-accent-gold/50 bg-navy-800/80 shadow-card sm:h-36 sm:w-36">
              {currentAvatar ? (
                <Image
                  src={currentAvatar}
                  alt={copy.avatarLabel}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              ) : (
                <UserCircle2 className="h-20 w-20 text-accent-gold/80 sm:h-24 sm:w-24" />
              )}
            </div>
            <button
              type="button"
              onClick={() => setAvatarModalOpen(true)}
              disabled={isSavingAvatar}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white shadow-card transition hover:border-accent-gold/50 hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Pencil className="h-4 w-4" />
              <span>{copy.changeAvatar}</span>
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-xl font-semibold text-white">{displayName}</p>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {copy.nicknameLabel}
            </p>
            {isEditingName ? (
              <div className="flex flex-col items-center gap-3 sm:w-80">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={copy.nicknamePlaceholder}
                  className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white outline-none ring-1 ring-transparent transition focus:border-accent-gold/70 focus:ring-accent-gold/30"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="inline-flex items-center gap-2 rounded-full border border-accent-gold/60 bg-accent-gold/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    <span>{copy.saveNickname}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-200/40 hover:text-slate-100"
                  >
                    <X className="h-4 w-4" />
                    <span>{dictionary.common.cancel}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent-gold/50 hover:text-accent-gold"
              >
                <Pencil className="h-4 w-4" />
                <span>{copy.editNickname}</span>
              </button>
            )}
          </div>

          {statusMessage ? (
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">
              <Check className="h-4 w-4" />
              <span>{statusMessage}</span>
            </div>
          ) : null}
          {errorMessage ? (
            <div className="flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100">
              <X className="h-4 w-4" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              {dictionary.common.language}
            </p>
            <LanguageToggle locale={locale} />
          </div>

          <div className="pt-2">
            <Link
              href={`/${locale}/dashboard`}
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent-gold/50 hover:text-accent-gold"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{copy.backToDashboard}</span>
            </Link>
            <LogoutButton locale={locale} label={dictionary.common.logout} />
          </div>

          <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left shadow-card sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {copy.securityTitle}
                </p>
                <p className="text-sm text-slate-300">{copy.securitySubtitle}</p>
              </div>
              {isCheckingIdentity ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-navy-900/70 px-4 py-2 text-sm font-semibold text-white">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{dictionary.common.loading}</span>
                </div>
              ) : hasGoogleIdentity ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">
                  <Check className="h-4 w-4" />
                  <span>{copy.googleLinked}</span>
                </div>
              ) : (
                <GoogleAuthButton
                  label={copy.linkGoogle}
                  className="w-full sm:w-auto"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {avatarModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black px-4 py-10">
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-5xl rounded-[2rem] border border-accent-gold/40 bg-black p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setAvatarModalOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-accent-gold/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-2 pr-10">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-gold/70">
                {copy.avatarLabel}
              </p>
              <h3 className="text-2xl font-semibold text-white">{copy.avatarModalTitle}</h3>
              <p className="text-sm text-slate-300">{copy.avatarModalSubtitle}</p>
            </div>

            <div className="mt-6 flex max-h-[75vh] flex-col gap-6 overflow-y-auto pr-2">
              {(['east', 'west'] as const).map((coast) => (
                <div key={coast} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {coast === 'east' ? copy.eastLabel : copy.westLabel}
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {groupedAvatars[coast].map((option) => {
                      const isSelected = currentAvatar === option.src;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={isSavingAvatar}
                          onClick={() => handleAvatarSelect(option)}
                          className={clsx(
                            'group relative overflow-hidden rounded-2xl border bg-navy-800/80 text-left shadow-card transition hover:-translate-y-1 hover:border-accent-gold/50 hover:shadow-lg disabled:cursor-not-allowed',
                            isSelected ? 'border-accent-gold/70' : 'border-white/10',
                          )}
                        >
                          <div className="relative h-28 w-full bg-navy-900/70">
                            <Image
                              src={option.src}
                              alt={option.label}
                              fill
                              sizes="(max-width: 768px) 50vw, 200px"
                              className="object-cover transition duration-200 group-hover:scale-105"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/30 px-3 py-2">
                            <span className="text-xs font-semibold text-white">
                              {option.label}
                            </span>
                            {isSelected ? (
                              <Check className="h-4 w-4 text-accent-gold" />
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
