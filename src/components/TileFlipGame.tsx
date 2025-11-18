'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLocale } from '@/components/providers/locale-provider';

type Card = {
  id: number;
  image: string;
  matched: boolean;
  flipped: boolean;
};

type RewardState = 'idle' | 'pending' | 'success' | 'error' | 'ineligible';

const FACE_COUNT = 8;
const MAX_MOVES_FOR_REWARD = 15;

const FACES: string[] = Array.from({ length: FACE_COUNT }, (_, index) => `/nbanima-tiles/${index + 1}.png`);
const BACK_IMAGE = '/nbanima-tiles/back.png';

const createShuffledDeck = (): Card[] => {
  const baseDeck: Card[] = FACES.flatMap((image, index) => [
    { id: index * 2, image, matched: false, flipped: false },
    { id: index * 2 + 1, image, matched: false, flipped: false },
  ]);
  for (let i = baseDeck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [baseDeck[i], baseDeck[j]] = [baseDeck[j], baseDeck[i]];
  }
  return baseDeck;
};

export const TileFlipGameNBAnima = () => {
  const { locale, dictionary } = useLocale();
  const t = dictionary.tileGame;
  const [cards, setCards] = useState<Card[]>(() => createShuffledDeck());
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [rewardState, setRewardState] = useState<RewardState>('idle');
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [rewardSubmitted, setRewardSubmitted] = useState(false);
  const cardsRef = useRef<Card[]>(cards);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const resetGame = useCallback(() => {
    setCards(createShuffledDeck());
    setFlippedIndices([]);
    setIsLocked(false);
    setMoves(0);
    setMatches(0);
    setRewardState('idle');
    setRewardMessage(null);
    setRewardSubmitted(false);
  }, []);

  const handleCardClick = useCallback(
    (index: number) => {
      if (isLocked) {
        return;
      }
      const current = cardsRef.current[index];
      if (!current || current.matched || current.flipped) {
        return;
      }

      setCards((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], flipped: true };
        return updated;
      });
      setFlippedIndices((prev) => {
        if (prev.length >= 2) {
          return prev;
        }
        return [...prev, index];
      });
    },
    [isLocked],
  );

  useEffect(() => {
    if (flippedIndices.length !== 2) {
      return undefined;
    }

    setIsLocked(true);
    setMoves((prev) => prev + 1);
    const [firstIdx, secondIdx] = flippedIndices;
    const firstCard = cardsRef.current[firstIdx];
    const secondCard = cardsRef.current[secondIdx];

    if (!firstCard || !secondCard) {
      setFlippedIndices([]);
      setIsLocked(false);
      return undefined;
    }

    if (firstCard.image === secondCard.image) {
      const timeout = window.setTimeout(() => {
        setCards((current) => {
          const updated = [...current];
          updated[firstIdx] = { ...updated[firstIdx], matched: true };
          updated[secondIdx] = { ...updated[secondIdx], matched: true };
          return updated;
        });
        setFlippedIndices([]);
        setIsLocked(false);
        setMatches((prev) => prev + 1);
      }, 350);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      setCards((current) => {
        const updated = [...current];
        updated[firstIdx] = { ...updated[firstIdx], flipped: false };
        updated[secondIdx] = { ...updated[secondIdx], flipped: false };
        return updated;
      });
      setFlippedIndices([]);
      setIsLocked(false);
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [flippedIndices]);

  const requestReward = useCallback(async () => {
    setRewardState('pending');
    setRewardMessage(t.rewardStatus.pending);
    try {
      const response = await fetch('/api/tile-flip/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves, locale }),
      });
      if (!response.ok) {
        throw new Error('Failed to assign reward');
      }
      setRewardState('success');
      setRewardMessage(t.rewardStatus.success);
    } catch (error) {
      console.error('[TileFlipGame] reward request failed', error);
      setRewardState('error');
      setRewardMessage(t.rewardStatus.failure);
    }
  }, [locale, moves, t.rewardStatus.failure, t.rewardStatus.pending, t.rewardStatus.success]);

  const allMatched = matches === FACE_COUNT;

  useEffect(() => {
    if (!allMatched) {
      return;
    }
    if (moves <= MAX_MOVES_FOR_REWARD) {
      if (!rewardSubmitted) {
        setRewardSubmitted(true);
        void requestReward();
      }
    } else {
      setRewardState('ineligible');
      setRewardMessage(t.rewardStatus.retry);
    }
  }, [allMatched, moves, requestReward, rewardSubmitted, t.rewardStatus.retry]);

  const statusText = rewardMessage ?? t.rewardStatus.eligible;
  const statusTone =
    rewardState === 'success'
      ? 'text-emerald-400'
      : rewardState === 'pending'
        ? 'text-amber-200'
        : rewardState === 'error' || rewardState === 'ineligible'
          ? 'text-rose-300'
          : 'text-slate-400';

  return (
    <div className="mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-gradient-to-b from-navy-950/90 to-navy-900/70 p-6 shadow-card">
      <div className="flex flex-col gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <div className="space-y-2">
          <span className="inline-flex items-center justify-center rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-gold">
            {t.rewardPointsLabel}
          </span>
          <div>
            <h1 className="text-3xl font-semibold text-white">{t.pageTitle}</h1>
            <p className="text-sm text-slate-300">{t.pageSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={resetGame}
          className="h-10 rounded-full border border-white/15 bg-navy-900/70 px-5 text-sm font-semibold text-white transition hover:border-accent-gold/40"
        >
          {t.resetCta}
        </button>
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-navy-900/60 p-4">
        <p className="text-sm text-slate-200">{t.rewardHint}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
          <span>
            {t.stats.moves}:{' '}
            <strong className="text-white">{moves}</strong>
          </span>
          <span>
            {t.stats.matches}:{' '}
            <strong className="text-white">
              {matches}/{FACE_COUNT}
            </strong>
          </span>
          {allMatched ? (
            <span className="text-emerald-400">{t.stats.completed}</span>
          ) : null}
        </div>
        <p className={`text-sm font-semibold ${statusTone}`}>{statusText}</p>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-3 mx-auto max-w-[520px]">
        {cards.map((card, index) => {
          const showFront = card.flipped || card.matched;
          const borderColor = card.matched ? 'border-emerald-400/70' : 'border-white/15';
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardClick(index)}
              disabled={card.matched || isLocked}
              className={`relative aspect-square w-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/70 ${card.matched ? 'cursor-default' : 'cursor-pointer'} ${isLocked && !card.flipped ? 'cursor-wait' : ''}`}
            >
              <div
                className="absolute inset-0 rounded-2xl shadow-card transition-transform duration-300"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: showFront ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  boxShadow: card.matched
                    ? '0 0 0 2px rgba(34,197,94,0.5), 0 15px 30px rgba(0,0,0,0.55)'
                    : '0 12px 25px rgba(5,11,26,0.85)',
                }}
              >
                <div
                  className={`absolute inset-0 rounded-2xl border ${borderColor}`}
                  style={{
                    backfaceVisibility: 'hidden',
                    overflow: 'hidden',
                    background:
                      'radial-gradient(circle at top, #0284c7 0%, #1d4ed8 40%, #020617 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="relative h-[80%] w-[80%]">
                    <Image
                      src={BACK_IMAGE}
                      alt="NBAnima card back"
                      fill
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 140px"
                      className="rounded-2xl object-cover"
                      priority={false}
                    />
                  </div>
                </div>
                <div
                  className={`absolute inset-0 rounded-2xl border ${borderColor}`}
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    overflow: 'hidden',
                    backgroundColor: '#020617',
                  }}
                >
                  <div className="relative h-full w-full">
                    <Image
                      src={card.image}
                      alt="NBAnima card face"
                      fill
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 140px"
                      className="object-cover"
                      priority={false}
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">{t.instructions}</p>
    </div>
  );
};

export default TileFlipGameNBAnima;
