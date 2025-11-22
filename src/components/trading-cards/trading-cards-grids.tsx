'use client';

import clsx from 'clsx';
import { CheckCircle2, Coins, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState, useTransition } from 'react';
import type { MouseEvent } from 'react';

import { buyCardAction } from '@/app/[locale]/dashboard/(shop)/actions';
import type { Locale } from '@/lib/constants';
import type { Dictionary } from '@/locales/dictionaries';
import type { ShopCard } from '@/types/shop-card';

export const CollectionGrid = ({
  cards,
  dictionary,
}: {
  cards: ShopCard[];
  dictionary: Dictionary;
}) => {
  const [selectedCard, setSelectedCard] = useState<ShopCard | null>(null);

  useEffect(() => {
    if (!selectedCard) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCard(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCard]);

  if (cards.length === 0) {
    return null;
  }

  const closeModal = () => setSelectedCard(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-3 lg:gap-4">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelectedCard(card)}
            className="group relative overflow-hidden rounded-xl border border-accent-gold/20 bg-navy-800/70 p-2 text-left shadow-card transition hover:border-accent-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 sm:p-3"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-20"
              style={{ backgroundColor: card.accent_color ?? '#8ecae6' }}
            />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between text-[7px] uppercase tracking-wide text-slate-400 sm:text-[8px]">
                <span>{card.rarity}</span>
                <span>{card.price} AP</span>
              </div>
              <div
                className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-navy-900/80 p-1"
                style={{ aspectRatio: '2 / 3' }}
              >
                <Image
                  src={card.image_url}
                  alt={card.name}
                  fill
                  className="object-contain"
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 35vw, 80vw"
                />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white sm:text-sm">{card.name}</h3>
                <p className="text-[7px] text-slate-300 sm:text-[9px]">{card.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedCard ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-accent-gold/30 bg-navy-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
              aria-label={dictionary.common.cancel}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex justify-center">
              <Image
                src={selectedCard.image_url}
                alt={selectedCard.name}
                width={900}
                height={1200}
                className="h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="mt-4 flex justify-center">
              <a
                href={selectedCard.image_url}
                download
                className="inline-flex items-center rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 font-semibold text-navy-900 shadow-card transition hover:brightness-110"
              >
                {dictionary.collection.download}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export const ShopGrid = ({
  cards,
  balance,
  dictionary,
  locale,
  ownedCardIds,
  onPurchaseSuccess,
}: {
  cards: ShopCard[];
  balance: number;
  dictionary: Dictionary;
  locale: Locale;
  ownedCardIds: Set<string>;
  onPurchaseSuccess: () => void;
}) => {
  const [pendingCard, setPendingCard] = useState<ShopCard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const handleGuardContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
    },
    [],
  );

  useEffect(() => {
    if (!pendingCard) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingCard(null);
        setErrorMessage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingCard]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const localeTag = locale === 'it' ? 'it-IT' : 'en-US';

  const handleConfirmPurchase = () => {
    if (!pendingCard) {
      return;
    }
    startTransition(async () => {
      try {
        setErrorMessage(null);
        const result = await buyCardAction({
          cardId: pendingCard.id,
          locale,
        });

        if (result.ok) {
          setPendingCard(null);
          setToastMessage(dictionary.dashboard.toasts.cardPurchased);
          onPurchaseSuccess();
          return;
        }

        const message = (() => {
          switch (result.error) {
            case 'INSUFFICIENT_FUNDS':
              return dictionary.shop.insufficientPoints;
            case 'ALREADY_OWNED':
              return dictionary.shop.owned;
            case 'CARD_NOT_FOUND':
            case 'USER_CARDS_FAIL':
            case 'LEDGER_OR_USER_UPDATE_FAIL':
            case 'UNKNOWN':
            default:
              return dictionary.shop.errorGeneric;
          }
        })();
        setErrorMessage(message);
      } catch (error) {
        console.error('[ShopGrid] purchase failed', error);
        setErrorMessage(dictionary.shop.errorGeneric);
      }
    });
  };

  const closeConfirm = () => {
    setPendingCard(null);
    setErrorMessage(null);
  };

  const formattedConfirmMessage = pendingCard
    ? dictionary.shop.confirmMessage.replace(
        '{price}',
        pendingCard.price.toLocaleString(localeTag),
      )
    : '';

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-3 lg:gap-4">
        {cards.map((card) => {
          const affordable = balance >= card.price;
          const alreadyOwned = ownedCardIds.has(card.id);
          const canBuy = affordable && !alreadyOwned;
          const isLoadingCard = isPending && pendingCard?.id === card.id;
          const buttonLabel = alreadyOwned
            ? dictionary.shop.owned
            : canBuy
              ? dictionary.shop.buy
              : dictionary.shop.insufficientPoints;

          return (
            <div
              key={card.id}
              className="group relative overflow-hidden rounded-xl border border-accent-gold/20 bg-navy-800/70 p-2 shadow-card transition hover:border-accent-gold/40 sm:p-3"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-30"
                style={{ backgroundColor: card.accent_color ?? '#8ecae6' }}
              />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between text-[7px] uppercase tracking-wide text-slate-400 sm:text-[10px]">
                  <span>{card.rarity}</span>
                  <span className="flex items-center gap-2 text-slate-200">
                    <Coins className="h-4 w-4 text-accent-gold" />
                    {card.price}
                  </span>
                </div>
                <div
                  className="relative h-20 w-full overflow-hidden rounded-lg border border-white/10 bg-navy-900 select-none sm:h-32"
                  onContextMenu={handleGuardContextMenu}
                >
                  <Image
                    src={card.image_url}
                    alt={card.name}
                    fill
                    draggable={false}
                    onContextMenu={handleGuardContextMenu}
                    className="pointer-events-none object-cover"
                  />
                  <div
                    aria-hidden="true"
                    onContextMenu={handleGuardContextMenu}
                    className="pointer-events-auto absolute inset-0 rounded-2xl bg-gradient-to-b from-navy-950/30 via-navy-950/10 to-navy-950/50 backdrop-blur-[1px]"
                  />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white sm:text-sm">{card.name}</h3>
                  <p className="text-[10px] text-slate-300 sm:text-[9px]">{card.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => (canBuy ? setPendingCard(card) : undefined)}
                  disabled={!canBuy || isPending}
                  className={clsx(
                    'inline-flex w-full items-center justify-center gap-1 rounded-2xl border px-2 py-0.5 text-[8px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed sm:px-2.5 sm:py-1 sm:text-[10px]',
                    alreadyOwned
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                      : canBuy
                        ? 'border-accent-gold bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30'
                        : 'border-white/10 bg-navy-900/60 text-slate-500',
                    isLoadingCard ? 'opacity-80' : '',
                  )}
                >
                  {isLoadingCard ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>{buttonLabel}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pendingCard ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeConfirm}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-accent-gold/30 bg-navy-900 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
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
                {dictionary.shop.confirmTitle}
              </h2>
              <p className="text-sm text-slate-300">{formattedConfirmMessage}</p>
              {errorMessage ? (
                <p className="text-sm text-red-400">{errorMessage}</p>
              ) : null}
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
                  {dictionary.common.confirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-card">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </>
  );
};
