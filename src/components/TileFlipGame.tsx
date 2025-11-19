'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocale } from '@/components/providers/locale-provider';

type Coast = 'west' | 'east';

type PlayerDefinition = {
  id: string;
  name: string;
  team: string;
  image: string;
  coast: Coast;
};

type Card = {
  id: string;
  playerId: string;
  image: string;
  matched: boolean;
  flipped: boolean;
};

type RewardState = 'idle' | 'pending' | 'success' | 'error' | 'ineligible';

const MAX_MOVES_FOR_REWARD = 15;

const PLAYER_SETS: Record<Coast, PlayerDefinition[]> = {
  west: [
    {
      id: 'alperen-sengun',
      name: 'Alperen Sengun',
      team: 'Houston Rockets',
      image: '/nbanima-tiles/WestCoast/AlperenSengunAnime.png',
      coast: 'west',
    },
    {
      id: 'chet-holmgren',
      name: 'Chet Holmgren',
      team: 'Oklahoma City Thunder',
      image: '/nbanima-tiles/WestCoast/ChetHolmgrenAnime.png',
      coast: 'west',
    },
    {
      id: 'cooper-flagg',
      name: 'Cooper Flagg',
      team: 'Dallas Mavericks',
      image: '/nbanima-tiles/WestCoast/CooperFlaggAnime.png',
      coast: 'west',
    },
    {
      id: 'demar-derozan',
      name: 'Demar Derozan',
      team: 'Sacramento Kings',
      image: '/nbanima-tiles/WestCoast/DemarDerozanAnime.png',
      coast: 'west',
    },
    {
      id: 'kevin-durant',
      name: 'Kevin Durant',
      team: 'Houston Rockets',
      image: '/nbanima-tiles/WestCoast/KevinDurantAnime.png',
      coast: 'west',
    },
    {
      id: 'lebron-james',
      name: 'LeBron James',
      team: 'Los Angeles Lakers',
      image: '/nbanima-tiles/WestCoast/LebronJamesAnime.png',
      coast: 'west',
    },
    {
      id: 'nikola-jokic',
      name: 'Nikola Jokic',
      team: 'Denver Nuggets',
      image: '/nbanima-tiles/WestCoast/NikolaJokicAnime.png',
      coast: 'west',
    },
    {
      id: 'stephen-curry',
      name: 'Stephen Curry',
      team: 'Golden State Warriors',
      image: '/nbanima-tiles/WestCoast/StephenCurryAnime.png',
      coast: 'west',
    },
  ],
  east: [
    {
      id: 'cade-cunningham',
      name: 'Cade Cunningham',
      team: 'Detroit Pistons',
      image: '/nbanima-tiles/EastCoast/CadeCunninghamAnime.png',
      coast: 'east',
    },
    {
      id: 'donovan-mitchell',
      name: 'Donovan Mitchell',
      team: 'Cleveland Cavaliers',
      image: '/nbanima-tiles/EastCoast/DonovanMitchellAnime.png',
      coast: 'east',
    },
    {
      id: 'giannis-antetokounmpo',
      name: 'Giannis Antetokounmpo',
      team: 'Milwaukee Bucks',
      image: '/nbanima-tiles/EastCoast/GiannisAntetokounmpoAnime.png',
      coast: 'east',
    },
    {
      id: 'jaylen-brown',
      name: 'Jaylen Brown',
      team: 'Boston Celtics',
      image: '/nbanima-tiles/EastCoast/JaylenBrownAnime.png',
      coast: 'east',
    },
    {
      id: 'karl-anthony-towns',
      name: 'Karl Anthony Towns',
      team: 'New York Knicks',
      image: '/nbanima-tiles/EastCoast/KarlAnthonyTownsAnime.png',
      coast: 'east',
    },
    {
      id: 'lamelo-ball',
      name: 'Lamelo Ball',
      team: 'Charlotte Hornets',
      image: '/nbanima-tiles/EastCoast/LameloBallAnime.png',
      coast: 'east',
    },
    {
      id: 'trae-young',
      name: 'Trae Young',
      team: 'Atlanta Hawks',
      image: '/nbanima-tiles/EastCoast/TraeYoungAnime.png',
      coast: 'east',
    },
    {
      id: 'tyrese-maxey',
      name: 'Tyrese Maxey',
      team: 'Philadelphia 76ers',
      image: '/nbanima-tiles/EastCoast/TyreseMaxeyAnime.png',
      coast: 'east',
    },
  ],
};

const BACK_IMAGES: Record<Coast, string> = {
  west: '/nbanima-tiles/WestCoast/back.png',
  east: '/nbanima-tiles/EastCoast/back.png',
};

const PLAYER_LOOKUP: Record<string, PlayerDefinition> = Object.values(PLAYER_SETS)
  .flat()
  .reduce<Record<string, PlayerDefinition>>((acc, player) => {
    acc[player.id] = player;
    return acc;
  }, {});

const createShuffledDeck = (players: PlayerDefinition[]): Card[] => {
  const baseDeck: Card[] = players.flatMap((player) => [
    {
      id: `${player.id}-a`,
      playerId: player.id,
      image: player.image,
      matched: false,
      flipped: false,
    },
    {
      id: `${player.id}-b`,
      playerId: player.id,
      image: player.image,
      matched: false,
      flipped: false,
    },
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
  const [selectedCoast, setSelectedCoast] = useState<Coast>('west');
  const [cards, setCards] = useState<Card[]>(() => createShuffledDeck(PLAYER_SETS.west));
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [matchedPlayerIds, setMatchedPlayerIds] = useState<string[]>([]);
  const [rewardState, setRewardState] = useState<RewardState>('idle');
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [rewardSubmitted, setRewardSubmitted] = useState(false);
  const cardsRef = useRef<Card[]>(cards);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const resetGame = useCallback(
    (coast?: Coast) => {
      const nextCoast = coast ?? selectedCoast;
      const deck = createShuffledDeck(PLAYER_SETS[nextCoast]);
      cardsRef.current = deck;
      setCards(deck);
      setFlippedIndices([]);
      setIsLocked(false);
      setMoves(0);
      setMatches(0);
      setMatchedPlayerIds([]);
      setRewardState('idle');
      setRewardMessage(null);
      setRewardSubmitted(false);
    },
    [selectedCoast],
  );

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
        setMatchedPlayerIds((prev) =>
          prev.includes(firstCard.playerId) ? prev : [...prev, firstCard.playerId],
        );
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

  const currentPlayers = PLAYER_SETS[selectedCoast];
  const totalPairs = currentPlayers.length;
  const backImage = BACK_IMAGES[selectedCoast];
  const matchedPlayers = useMemo(
    () => matchedPlayerIds.map((id) => PLAYER_LOOKUP[id]).filter(Boolean),
    [matchedPlayerIds],
  );

  const allMatched = matches === totalPairs;

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

      <div className="mt-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">{t.coastToggleLabel}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {(['west', 'east'] as const).map((coast) => (
            <button
              key={coast}
              type="button"
              onClick={() => {
                if (coast !== selectedCoast) {
                  setSelectedCoast(coast);
                  resetGame(coast);
                }
              }}
              className={clsx(
                'min-w-[160px] rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                selectedCoast === coast
                  ? 'border-accent-gold bg-accent-gold/10 text-white shadow-card'
                  : 'border-white/15 bg-navy-900/60 text-slate-200 hover:border-accent-gold/40',
              )}
            >
              {t.coastOptions[coast]}
            </button>
          ))}
        </div>
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
              {matches}/{totalPairs}
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
          const playerMeta = PLAYER_LOOKUP[card.playerId];
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
                      src={backImage}
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
                        alt={playerMeta ? playerMeta.name : 'NBAnima card face'}
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

      <div className="mt-6 rounded-2xl border border-white/10 bg-navy-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">{t.galleryTitle}</p>
            <p className="text-xs text-slate-400">{t.gallerySubtitle}</p>
          </div>
          <span className="text-xs font-semibold text-accent-gold">
            {matchedPlayers.length}/{totalPairs}
          </span>
        </div>
        {matchedPlayers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">{t.galleryEmpty}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {matchedPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-800/60 p-3"
              >
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src={player.image}
                    alt={player.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{player.name}</p>
                  <p className="text-xs text-slate-400">{player.team}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TileFlipGameNBAnima;
