'use client';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Coins, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { TouchEvent } from 'react';
import { useRouter } from 'next/navigation';

import { useLocale } from '@/components/providers/locale-provider';
import type { Locale } from '@/lib/constants';
import { CollectionGrid, ShopGrid } from '@/components/trading-cards/trading-cards-grids';
import {
  PacksGrid,
  type PackOpenPayload,
} from '@/components/trading-cards/trading-packs-grid';
import type { ShopCard } from '@/types/shop-card';

interface TradingCardsClientProps {
  locale: Locale;
  balance: number;
  shopCards: ShopCard[];
  ownedCardCounts: Record<string, number>;
  isAdmin: boolean;
}

export const TradingCardsClient = ({
  locale,
  balance,
  shopCards,
  ownedCardCounts,
  isAdmin,
}: TradingCardsClientProps) => {
  const { dictionary } = useLocale();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<'collection' | 'shop' | 'packs'>(
    'collection',
  );
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [openingPack, setOpeningPack] = useState<PackOpenPayload | null>(null);
  const [openingStage, setOpeningStage] = useState<'sealed' | 'cards'>('sealed');
  const [openingCardIndex, setOpeningCardIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const ownedCardCountsMap = useMemo(
    () => new Map(Object.entries(ownedCardCounts ?? {})),
    [ownedCardCounts],
  );
  const collectionCards = useMemo(
    () =>
      shopCards.map((card) => {
        const quantity = Number(ownedCardCountsMap.get(card.id) ?? 0);
        return { ...card, owned: quantity > 0, quantity };
      }),
    [shopCards, ownedCardCountsMap],
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-US'),
    [locale],
  );
  const totalOwnedCards = useMemo(
    () => Object.values(ownedCardCounts ?? {}).reduce((sum, value) => sum + Number(value), 0),
    [ownedCardCounts],
  );

  useEffect(() => {
    setCurrentBalance(balance);
  }, [balance]);

  useEffect(() => {
    if (!openingPack) {
      return;
    }
    setOpeningStage('sealed');
    setOpeningCardIndex(0);
    const timer = setTimeout(() => setOpeningStage('cards'), 1400);
    return () => clearTimeout(timer);
  }, [openingPack]);

  const handlePackOpened = (payload: PackOpenPayload) => {
    setOpeningPack(payload);
    setCurrentBalance(payload.newBalance);
    setActiveSection('packs');
  };

  const handleCloseOpening = () => {
    setOpeningPack(null);
    setOpeningStage('sealed');
    setOpeningCardIndex(0);
    setTouchStartX(null);
    router.refresh();
  };

  const handleGoToCollection = () => {
    setActiveSection('collection');
    handleCloseOpening();
  };

  const handleNextCard = () => {
    if (!openingPack) {
      return;
    }
    setOpeningCardIndex((prev) => Math.min(prev + 1, openingPack.cards.length - 1));
  };

  const handlePrevCard = () => {
    if (!openingPack) {
      return;
    }
    setOpeningCardIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) {
      return;
    }
    const deltaX = event.changedTouches[0]?.clientX - touchStartX;
    if (Math.abs(deltaX) < 40) {
      return;
    }
    if (deltaX < 0) {
      handleNextCard();
    } else {
      handlePrevCard();
    }
    setTouchStartX(null);
  };

  return (
    <div className="space-y-6 pb-16 pt-3 sm:pt-5 lg:pb-20">
      <div className="relative mx-auto h-32 w-full max-w-3xl overflow-hidden rounded-xl border border-accent-gold/40 bg-gradient-to-br from-accent-gold/10 via-transparent to-accent-coral/10 sm:h-40">
        <Image
          src="/NBAnimaTradingCards.png"
          alt={dictionary.tradingCards.heroImageAlt}
          fill
          priority
          className="object-contain"
          sizes="(min-width: 1024px) 50vw, 90vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950 via-transparent to-transparent" />
      </div>

      <header className="overflow-hidden rounded-2xl border border-accent-gold/50 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-850 p-4 shadow-card sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-accent-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-gold sm:text-[11px]">
              {dictionary.tradingCards.ctaLabel}
            </span>
            <Link
              href={`/${locale}/dashboard`}
              className="inline-flex items-center rounded-full border border-accent-gold/60 bg-accent-gold/15 px-3 py-2 text-xs font-semibold text-accent-gold transition hover:bg-accent-gold/25 sm:text-sm"
            >
              Dashboard
            </Link>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              {dictionary.tradingCards.pageTitle}
            </h1>
            <p className="text-sm text-slate-300 sm:text-base">
              {dictionary.tradingCards.pageSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-200 sm:gap-3 sm:text-sm">
            <div className="inline-flex items-center gap-2 rounded-xl border border-accent-gold/40 bg-navy-900/60 px-3 py-2">
              <Coins className="h-4 w-4 text-accent-gold sm:h-4 sm:w-4" />
              <div className="space-y-[2px]">
                <span className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-[11px]">
                  {dictionary.dashboard.animaPoints}
                </span>
                <span className="text-base font-semibold text-white sm:text-lg">
                  {numberFormatter.format(currentBalance)}
                </span>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-accent-gold/40 bg-navy-900/60 px-3 py-2">
              <Sparkles className="h-4 w-4 text-accent-gold sm:h-4 sm:w-4" />
              <div className="space-y-[2px]">
                <span className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-[11px]">
                  {dictionary.collection.title}
                </span>
                <span className="text-base font-semibold text-white sm:text-lg">
                  {numberFormatter.format(totalOwnedCards)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        <div
          className="flex flex-col gap-3 rounded-[1.25rem] border border-white/10 bg-navy-900/60 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
          role="tablist"
          aria-label={dictionary.tradingCards.pageTitle}
        >
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {(
              [
                { key: 'collection', label: dictionary.tradingCards.collectionTab },
                { key: 'packs', label: dictionary.tradingCards.packsTab },
                { key: 'shop', label: dictionary.tradingCards.shopTab },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                onClick={() => setActiveSection(option.key)}
                aria-selected={activeSection === option.key}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 sm:px-4',
                  activeSection === option.key
                    ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                    : 'border-white/10 bg-navy-800/70 text-slate-300 hover:border-accent-gold/30',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 sm:text-sm">{dictionary.tradingCards.ctaDescription}</p>
        </div>

        <section className="rounded-[1.25rem] border border-white/10 bg-navy-900/70 p-4 shadow-card sm:p-6">
          {activeSection === 'collection' ? (
            collectionCards.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-navy-900/50 p-6 text-sm text-slate-300">
                {dictionary.collection.empty}
              </p>
            ) : (
              <CollectionGrid cards={collectionCards} dictionary={dictionary} />
            )
          ) : null}

          {activeSection === 'shop' ? (
            <ShopGrid
              cards={shopCards}
              balance={currentBalance}
              dictionary={dictionary}
              locale={locale}
              ownedCardCounts={ownedCardCountsMap}
              onPurchaseSuccess={(spent) => {
                setCurrentBalance((prev) => Math.max(prev - spent, 0));
                router.refresh();
              }}
            />
          ) : null}

          {activeSection === 'packs' ? (
            <PacksGrid
              balance={currentBalance}
              dictionary={dictionary}
              locale={locale}
              isAdmin={isAdmin}
              onPackOpened={handlePackOpened}
            />
          ) : null}
        </section>
      </div>

      {openingPack ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={handleCloseOpening}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-accent-gold/30 bg-black p-4 shadow-[0_20px_60px_rgba(0,0,0,0.65)] sm:max-w-4xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseOpening}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
              aria-label={dictionary.common.cancel}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-accent-gold/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold">
                  <Sparkles className="h-4 w-4" />
                  {openingPack.pack.name}
                </span>
              </div>
              <div className="relative max-h-[82vh] rounded-3xl border border-white/10 bg-black p-3 sm:max-h-[85vh] sm:p-4">
                <div
                  className={clsx(
                    'absolute inset-0 flex items-center justify-center transition duration-1200',
                    openingStage === 'sealed' ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-105',
                  )}
                >
                  <Image
                    src={openingPack.pack.image}
                    alt={openingPack.pack.name}
                    width={540}
                    height={360}
                    className="h-36 w-auto sm:h-60"
                    priority
                  />
                </div>
                <div
                  className={clsx(
                    'relative flex flex-col items-center gap-4 px-3 py-4 transition duration-1200 sm:flex-row sm:gap-6 sm:px-6 sm:py-6',
                    openingStage === 'cards'
                      ? 'opacity-100 translate-y-0'
                      : 'pointer-events-none translate-y-6 opacity-0',
                  )}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <button
                    type="button"
                    onClick={handlePrevCard}
                    disabled={openingCardIndex === 0}
                    className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-40 sm:inline-flex"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div className="relative w-full flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black p-3 shadow-card sm:p-4">
                    <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                      {openingPack.cards[openingCardIndex]?.rarity}
                    </div>
                    <div className="flex justify-center">
                      <Image
                        src={openingPack.cards[openingCardIndex]?.image_url ?? '/cards/back.png'}
                        alt={openingPack.cards[openingCardIndex]?.name ?? 'Card'}
                        width={720}
                        height={1080}
                        className="h-[44vh] w-auto max-w-full object-contain sm:h-[60vh]"
                        priority
                      />
                    </div>
                    <div className="mt-3 space-y-1 text-center sm:text-left">
                      <h3 className="text-base font-semibold text-white sm:text-lg">
                        {openingPack.cards[openingCardIndex]?.name}
                      </h3>
                      <p className="text-xs text-slate-300 sm:text-sm">
                        {openingPack.cards[openingCardIndex]?.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleNextCard}
                    disabled={openingCardIndex === openingPack.cards.length - 1}
                    className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-40 sm:inline-flex"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-200">
                  <Sparkles className="h-4 w-4 text-accent-gold" />
                  <span>{dictionary.packs.swipeHint}</span>
                </div>
                <div className="flex items-center gap-2">
                  {openingPack.cards.map((card, index) => (
                    <span
                      key={card.id + index.toString()}
                      className={clsx(
                        'h-2 w-8 rounded-full transition',
                        index === openingCardIndex
                          ? 'bg-accent-gold shadow-[0_0_10px_rgba(255,215,0,0.5)]'
                          : 'bg-white/15',
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-white">
                  {openingCardIndex + 1}/{openingPack.cards.length}
                </span>
              </div>
              <div className="flex min-h-[60px] items-center justify-center">
                {openingCardIndex === openingPack.cards.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleGoToCollection}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-3.5 py-2.5 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110 sm:px-4 sm:py-2 sm:text-sm"
                  >
                    {dictionary.packs.toCollection}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
