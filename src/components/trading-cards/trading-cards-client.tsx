'use client';

import clsx from 'clsx';
import { Coins, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useLocale } from '@/components/providers/locale-provider';
import type { Locale } from '@/lib/constants';
import { CollectionGrid, ShopGrid } from '@/components/trading-cards/trading-cards-grids';
import type { ShopCard } from '@/types/shop-card';

interface TradingCardsClientProps {
  locale: Locale;
  balance: number;
  shopCards: ShopCard[];
  ownedCardCounts: Record<string, number>;
}

export const TradingCardsClient = ({
  locale,
  balance,
  shopCards,
  ownedCardCounts,
}: TradingCardsClientProps) => {
  const { dictionary } = useLocale();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<'collection' | 'shop'>('collection');
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
              {dictionary.dashboard.playTab}
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
                  {numberFormatter.format(balance)}
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
          ) : (
            <ShopGrid
              cards={shopCards}
              balance={balance}
              dictionary={dictionary}
              locale={locale}
              ownedCardCounts={ownedCardCountsMap}
              onPurchaseSuccess={() => router.refresh()}
            />
          )}
        </section>
      </div>
    </div>
  );
};
