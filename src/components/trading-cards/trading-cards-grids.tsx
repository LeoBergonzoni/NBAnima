'use client';

import clsx from 'clsx';
import { CheckCircle2, Coins, Loader2, Lock, Star, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import type { MouseEvent } from 'react';

import { buyCardAction } from '@/app/[locale]/dashboard/(shop)/actions';
import type { Locale } from '@/lib/constants';
import type { Dictionary } from '@/locales/dictionaries';
import type { CardCategory, CardConference, ShopCard } from '@/types/shop-card';

const CATEGORY_ORDER: CardCategory[] = ['Rosters', 'Celebrations', 'Courtside', 'Iconic'];
const CONFERENCE_ORDER: CardConference[] = [
  'Eastern Conference',
  'Western Conference',
  'Special',
];

type GroupedCards<T extends ShopCard> = {
  category: CardCategory;
  conference: CardConference;
  cards: T[];
};

type GroupedCollectionCards<T extends ShopCard> = {
  category: CardCategory;
  cards: T[];
};

const orderIndex = <T extends string>(value: T, order: readonly T[]) => {
  const index = order.indexOf(value);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const sortCards = <T extends ShopCard>(cards: T[]) =>
  [...cards].sort((a, b) => {
    const categoryDiff =
      orderIndex(a.category as CardCategory, CATEGORY_ORDER) -
      orderIndex(b.category as CardCategory, CATEGORY_ORDER);

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    const conferenceDiff =
      orderIndex(a.conference as CardConference, CONFERENCE_ORDER) -
      orderIndex(b.conference as CardConference, CONFERENCE_ORDER);

    if (conferenceDiff !== 0) {
      return conferenceDiff;
    }

    return a.price - b.price;
  });

const groupCardsByCategory = <T extends ShopCard>(cards: T[]): GroupedCards<T>[] => {
  const sorted = sortCards(cards);
  const groups = new Map<string, GroupedCards<T>>();

  for (const card of sorted) {
    const key = `${card.category}-${card.conference}`;
    const existing = groups.get(key);

    if (existing) {
      existing.cards.push(card);
      continue;
    }

    groups.set(key, {
      category: card.category as CardCategory,
      conference: card.conference as CardConference,
      cards: [card],
    });
  }

  return Array.from(groups.values());
};

const groupCollectionCardsByCategory = <T extends ShopCard>(
  cards: T[],
): GroupedCollectionCards<T>[] => {
  const sorted = sortCards(cards);
  const groups = new Map<CardCategory, GroupedCollectionCards<T>>();

  for (const card of sorted) {
    const key = card.category as CardCategory;
    const existing = groups.get(key);

    if (existing) {
      existing.cards.push(card);
      continue;
    }

    groups.set(key, {
      category: card.category as CardCategory,
      cards: [card],
    });
  }

  return Array.from(groups.values());
};

export const CollectionGrid = ({
  cards,
  dictionary,
}: {
  cards: Array<ShopCard & { owned: boolean; quantity: number }>;
  dictionary: Dictionary;
}) => {
  const [selectedCard, setSelectedCard] = useState<
    (ShopCard & { owned: boolean; quantity: number }) | null
  >(null);
  const groupedCards = useMemo(() => groupCollectionCardsByCategory(cards), [cards]);

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
      <div className="space-y-6">
        {groupedCards.map((group) => (
          <div key={group.category} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-gold sm:text-[11px]">
                {group.category}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-3 lg:gap-4">
              {group.cards.map((card) => {
                const isMaxed = card.quantity >= 5;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={card.owned ? () => setSelectedCard(card) : undefined}
                    disabled={!card.owned}
                    className={clsx(
                      'group relative overflow-hidden rounded-xl border bg-navy-800/70 p-2 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 sm:p-3',
                      isMaxed
                        ? 'border-[#ffd700] shadow-[0_0_30px_rgba(255,215,0,0.55)] ring-2 ring-[#ffd700]/80 ring-offset-2 ring-offset-navy-900 hover:border-[#ffd700]'
                        : card.owned
                          ? 'border-accent-gold/20 hover:border-accent-gold/40'
                          : 'border-white/10 opacity-90',
                    )}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-20"
                      style={{ backgroundColor: card.accent_color ?? '#8ecae6' }}
                    />
                    <div className="relative flex min-h-full flex-col gap-3">
                      <div className="flex items-center justify-between text-[7px] uppercase tracking-wide text-slate-400 sm:text-[8px]">
                        <span>{card.rarity}</span>
                        <span className="rounded-full border border-white/10 bg-black/60 px-2 py-[2px] text-[10px] font-semibold text-white sm:text-[11px]">
                          ×{card.quantity}
                        </span>
                      </div>
                      <div
                        className={clsx(
                          'relative w-full overflow-hidden rounded-xl border bg-navy-900/80 p-1',
                          isMaxed
                            ? 'border-[#ffd700] shadow-[0_0_24px_rgba(255,215,0,0.6)]'
                            : 'border-white/10',
                        )}
                        style={{ aspectRatio: '2 / 3' }}
                      >
                        <Image
                          src={card.owned ? card.image_url : '/cards/back.png'}
                          alt={card.name}
                          fill
                          className={clsx('object-contain transition', card.owned ? '' : 'saturate-50')}
                          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 35vw, 80vw"
                        />
                        {!card.owned ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-navy-900/70 text-slate-200">
                            <Lock className="h-3.5 w-3.5" />
                            <span className="text-[8px] font-semibold uppercase tracking-wide sm:text-[9px]">
                              {dictionary.collection.locked}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <h3 className="sr-only">{card.name}</h3>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, index) => {
                            const filled = card.quantity > index;
                            return (
                              <Star
                                key={index}
                                className={clsx(
                                  'h-3 w-3 sm:h-3.5 sm:w-3.5',
                                  filled
                                    ? 'text-accent-gold drop-shadow-[0_0_6px_rgba(255,215,0,0.45)]'
                                    : 'text-slate-600',
                                )}
                                fill={filled ? 'currentColor' : 'none'}
                              />
                            );
                          })}
                        </div>
                        <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-300 sm:text-[9px]">
                          {Math.min(card.quantity, 5)}/5
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
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
            <p className="mt-4 text-center text-sm text-slate-200 sm:text-base">
              {selectedCard.description}
            </p>
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
  ownedCardCounts,
  onPurchaseSuccess,
}: {
  cards: ShopCard[];
  balance: number;
  dictionary: Dictionary;
  locale: Locale;
  ownedCardCounts: Map<string, number>;
  onPurchaseSuccess: (spent: number) => void;
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
  const groupedCards = useMemo(() => groupCardsByCategory(cards), [cards]);

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
          onPurchaseSuccess(pendingCard.price);
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
      <div className="space-y-6">
        {groupedCards.map((group) => (
          <div key={`${group.category}-${group.conference}`} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-gold sm:text-[11px]">
                {group.category}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 sm:text-[11px]">
                {group.conference}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-3 lg:gap-4">
              {group.cards.map((card) => {
                const quantity = Number(ownedCardCounts.get(card.id) ?? 0);
                const affordable = balance >= card.price;
                const canBuy = affordable;
                const isLoadingCard = isPending && pendingCard?.id === card.id;
                const buttonLabel =
                  canBuy || isLoadingCard
                    ? null
                    : dictionary.shop.insufficientPoints;

                return (
                  <div
                    key={card.id}
                    className="group relative h-full overflow-hidden rounded-xl border border-accent-gold/20 bg-navy-800/70 p-2 shadow-card transition hover:border-accent-gold/40 sm:p-3"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-30"
                      style={{ backgroundColor: card.accent_color ?? '#8ecae6' }}
                    />
                    <div className="relative flex min-h-full flex-col gap-3">
                      <div className="flex items-center text-[7px] uppercase tracking-wide text-slate-400 sm:text-[10px]">
                        <span>{card.rarity}</span>
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
                      <h3 className="text-xs font-semibold text-white sm:text-sm">{card.name}</h3>
                      <button
                        type="button"
                        onClick={() => (canBuy ? setPendingCard(card) : undefined)}
                        disabled={!canBuy || isPending}
                        className={clsx(
                          'mt-auto inline-flex w-full items-center justify-center gap-1 rounded-2xl border px-2 py-0.5 text-[8px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed sm:px-2.5 sm:py-1 sm:text-[10px]',
                          !canBuy
                            ? 'border-white/10 bg-navy-900/60 text-slate-500'
                            : quantity > 0
                              ? 'border-accent-gold bg-accent-gold/25 text-accent-gold hover:bg-accent-gold/35'
                              : 'border-accent-gold bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30',
                          isLoadingCard ? 'opacity-80' : '',
                        )}
                      >
                        {isLoadingCard ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {buttonLabel ? (
                          <span>{buttonLabel}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Coins className="h-4 w-4" />
                            {card.price}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
