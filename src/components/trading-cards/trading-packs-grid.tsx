'use client';

import clsx from 'clsx';
import { Coins, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useTransition, useState } from 'react';

import { buyPackAction } from '@/app/[locale]/dashboard/(shop)/actions';
import { PACK_DEFINITIONS, type PackDefinition } from '@/config/trading-packs';
import type { Locale } from '@/lib/constants';
import type { Dictionary } from '@/locales/dictionaries';
import type { ShopCard } from '@/types/shop-card';

export type PackOpenPayload = {
  pack: PackDefinition;
  cards: ShopCard[];
  newBalance: number;
};

type PendingPack = {
  pack: PackDefinition;
  mode: 'normal' | 'admin';
};

export const PacksGrid = ({
  balance,
  dictionary,
  locale,
  isAdmin,
  onPackOpened,
}: {
  balance: number;
  dictionary: Dictionary;
  locale: Locale;
  isAdmin: boolean;
  onPackOpened: (payload: PackOpenPayload) => void;
}) => {
  const [pendingPack, setPendingPack] = useState<PendingPack | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const localeTag = locale === 'it' ? 'it-IT' : 'en-US';
  const cardCountLabel = locale === 'it' ? '4 carte' : '4 cards';

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const confirmMessage = pendingPack
    ? pendingPack.mode === 'admin'
      ? dictionary.packs.confirmAdminMessage.replace('{pack}', pendingPack.pack.name)
      : dictionary.packs.confirmMessage
          .replace('{pack}', pendingPack.pack.name)
          .replace('{price}', pendingPack.pack.price.toLocaleString(localeTag))
    : '';

  const handleConfirmPurchase = () => {
    if (!pendingPack) {
      return;
    }
    startTransition(async () => {
      try {
        setErrorMessage(null);
        const result = await buyPackAction({
          packId: pendingPack.pack.id,
          locale,
          adminOverride: pendingPack.mode === 'admin',
        });

        if (result.ok) {
          onPackOpened({
            pack: pendingPack.pack,
            cards: result.cards,
            newBalance: result.newBalance,
          });
          setPendingPack(null);
          setToastMessage(dictionary.packs.toastOpened);
          return;
        }

        const message = (() => {
          switch (result.error) {
            case 'INSUFFICIENT_FUNDS':
              return dictionary.shop.insufficientPoints;
            case 'NO_CARDS_AVAILABLE':
            case 'NO_CARDS_FOR_RARITY':
              return dictionary.packs.errorNoCards;
            case 'NOT_ADMIN_FOR_OVERRIDE':
              return dictionary.packs.onlyAdmin;
            default:
              return dictionary.packs.errorGeneric;
          }
        })();
        setErrorMessage(message);
      } catch (error) {
        console.error('[PacksGrid] purchase failed', error);
        setErrorMessage(dictionary.packs.errorGeneric);
      }
    });
  };

  const closeConfirm = () => {
    setPendingPack(null);
    setErrorMessage(null);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-[1.25rem] border border-white/10 bg-navy-900/70 p-4 shadow-card sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white sm:text-xl">{dictionary.packs.title}</h3>
              <p className="text-sm text-slate-300 sm:text-base">{dictionary.packs.description}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PACK_DEFINITIONS.map((pack) => {
            const affordable = balance >= pack.price;
            const loading = isPending && pendingPack?.pack.id === pack.id;
            const disableNormal = !affordable || loading;
            const priceLabel = pack.price.toLocaleString(localeTag);

            return (
              <div
                key={pack.id}
                className="group relative overflow-hidden rounded-2xl border border-accent-gold/25 bg-navy-900/70 p-4 shadow-card transition hover:border-accent-gold/50"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-20"
                  style={{ backgroundColor: pack.accent }}
                />
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[12px] uppercase tracking-wide text-slate-400">
                        {dictionary.packs.title}
                      </p>
                      <h4 className="text-lg font-semibold text-white">{pack.name}</h4>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
                      {dictionary.packs.oddsTitle}
                    </div>
                  </div>
                  <div
                    className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 p-3"
                    style={{ aspectRatio: '4 / 3' }}
                  >
                    <Image
                      src={pack.image}
                      alt={pack.name}
                      fill
                      className="object-contain transition duration-300 group-hover:scale-105"
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 35vw, 90vw"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-navy-950/40 to-navy-950/70" />
                    <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-semibold text-white">
                      <Sparkles className="h-4 w-4 text-accent-gold" />
                      {cardCountLabel}
                    </div>
                  </div>
                  <p className="text-sm text-slate-300">{pack.description[locale]}</p>
                  <div className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>Common</span>
                      <span>{Math.round(pack.odds.common * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Rare</span>
                      <span>{Math.round(pack.odds.rare * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Legendary</span>
                      <span>{Math.round(pack.odds.legendary * 100)}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingPack({ pack, mode: 'normal' })}
                      disabled={disableNormal}
                      className={clsx(
                        'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed',
                        disableNormal
                          ? 'border-white/10 bg-navy-900/60 text-slate-500'
                          : 'border-accent-gold bg-accent-gold/25 text-accent-gold hover:bg-accent-gold/35',
                      )}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                      <span>{priceLabel}</span>
                    </button>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => setPendingPack({ pack, mode: 'admin' })}
                        disabled={loading}
                        className={clsx(
                          'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed',
                          loading
                            ? 'border-white/10 bg-navy-900/60 text-slate-500'
                            : 'border-emerald-400 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25',
                        )}
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        <span>{dictionary.packs.adminCta}</span>
                      </button>
                    ) : null}
                    {!affordable ? (
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                        {dictionary.shop.insufficientPoints}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pendingPack ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeConfirm}
        >
          <div
            className="relative w-full max-w-md overflow-y-auto rounded-2xl border border-accent-gold/30 bg-black p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeConfirm}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
              aria-label={dictionary.common.cancel}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">
                {dictionary.packs.confirmTitle}
              </h2>
              <p className="text-sm text-slate-300">{confirmMessage}</p>
              {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-accent-gold/40 hover:text-white"
                  disabled={isPending}
                >
                  {dictionary.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPurchase}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {dictionary.packs.openCta}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-card">
          <ShieldCheck className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </>
  );
};
