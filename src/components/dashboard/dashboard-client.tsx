'use client';

import clsx from 'clsx';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Coins,
  Loader2,
  LogOut,
  UserCircle2,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { PlayerSelect } from '@/components/ui/PlayerSelect';
import { useLocale } from '@/components/providers/locale-provider';
import type { Locale } from '@/lib/constants';
import { createBrowserSupabase } from '@/lib/supabase-browser';
import type { Dictionary } from '@/locales/dictionaries';
import { useGames } from '@/hooks/useGames';
import {
  type GameMeta,
  type HighlightPick,
  type PlayerPick,
  type TeamPick,
  usePicks,
} from '@/hooks/usePicks';
import { useTeamPlayers } from '@/hooks/useTeamPlayers';
import { buyCardAction } from '@/app/[locale]/dashboard/(shop)/actions';
import { WinnersClient } from './winners-client';

const PLAYER_CATEGORIES = ['top_scorer', 'top_assist', 'top_rebound'] as const;

interface ShopCard {
  id: string;
  name: string;
  description: string;
  rarity: string;
  price: number;
  image_url: string;
  accent_color: string | null;
}

interface DashboardClientProps {
  locale: Locale;
  balance: number;
  ownedCards: ShopCard[];
  shopCards: ShopCard[];
  role: string;
}

interface GameTeam {
  id: string;
  name: string;
  city: string | null;
  logo: string | null;
  abbreviation?: string | null;
}

interface GameSummary {
  id: string;
  startsAt: string;
  status: string;
  arena?: string | null;
  homeTeam: GameTeam;
  awayTeam: GameTeam;
}

interface PlayerSummary {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string | null;
  teamId: string;
  jersey?: string | null;
}

type PlayerSelections = Record<string, Record<string, string>>;

type RemotePlayer = {
  id?: string | number | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  position?: string | null;
  pos?: string | null;
  team_id?: string | number | null;
  teamId?: string | number | null;
  jersey?: string | null;
};

type TeamInput =
  | (Partial<GameTeam> & {
      full_name?: string | null;
      fullName?: string | null;
    })
  | null
  | undefined;

const normalizeTeamInput = (team: TeamInput) => {
  const firstNonEmpty =
    team?.name ??
    team?.abbreviation ??
    (team?.id != null ? String(team.id) : '') ??
    team?.full_name ?? // se mai presente
    team?.fullName ?? // se mai presente
    team?.city ?? ''; // fallback morbido

  return String(firstNonEmpty).replace(/\s+/g, ' ').trim();
};

const formatGameTime = (locale: Locale, date: string) => {
  const value = new Date(date);
  try {
    return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(value);
  } catch {
    return value.toLocaleString();
  }
};

const deriveSeasonFromDate = (iso: string): string => {
  const date = new Date(iso);
  const fallback = new Date();
  const validDate = Number.isNaN(date.getTime()) ? fallback : date;
  const year = validDate.getUTCFullYear();
  const month = validDate.getUTCMonth(); // 0-indexed
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const computeTeamAbbr = (team: GameTeam): string => {
  const explicit = team.abbreviation?.trim();
  if (explicit) {
    return explicit.toUpperCase();
  }
  if (team.name) {
    const tokens = team.name.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      const [single] = tokens;
      if (single.length >= 3) {
        return single.slice(0, 3).toUpperCase();
      }
    }
    if (tokens.length > 0) {
      return tokens
        .map((part) => part[0] ?? '')
        .join('')
        .slice(0, 3)
        .toUpperCase();
    }
  }
  return 'UNK';
};

const normalizeProvider = (provider?: string): GameMeta['provider'] =>
  provider === 'balldontlie' ? 'balldontlie' : 'stub';

const SectionStatus = ({ complete }: { complete: boolean }) =>
  complete ? (
    <CheckCircle2 className="h-5 w-5 text-lime-400" />
  ) : (
    <CircleDashed className="h-5 w-5 text-slate-500" />
  );

const TeamButton = ({
  team,
  value,
  selected,
  onSelect,
}: {
  team: GameTeam;
  value: string;
  selected: boolean;
  onSelect: (teamId: string) => void;
}) => {
  const initials = useMemo(() => {
    const pieces = team.name.split(' ');
    return pieces
      .map((part) => part[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
  }, [team.name]);

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={clsx(
        'group flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition min-h-[64px]',
        selected
          ? 'border-accent-gold bg-accent-gold/10 shadow-card'
          : 'border-white/10 bg-navy-800/60 hover:border-accent-gold/60',
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-navy-900 text-lg font-bold text-accent-gold">
        {team.logo ? (
          <Image
            src={team.logo}
            alt={`${team.name} logo`}
            width={48}
            height={48}
            className="h-full w-full object-contain"
          />
        ) : (
          initials
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-white">{team.name}</span>
        {team.city ? (
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {team.city}
          </span>
        ) : null}
      </div>
    </button>
  );
};

const GameTeamsRow = ({
  locale,
  game,
  selection,
  onSelect,
}: {
  locale: Locale;
  game: GameSummary;
  selection?: string;
  onSelect: (teamId: string) => void;
}) => (
  <div className="space-y-3 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card">
    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
      <span>{formatGameTime(locale, game.startsAt)}</span>
      {game.arena ? <span>· {game.arena}</span> : null}
      <span>· {game.status}</span>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <TeamButton
        team={game.awayTeam}
        value="away"
        selected={selection === 'away'}
        onSelect={onSelect}
      />
      <div className="flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-slate-400">
        VS
      </div>
      <TeamButton
        team={game.homeTeam}
        value="home"
        selected={selection === 'home'}
        onSelect={onSelect}
      />
    </div>
  </div>
);

const GamePlayersCard = ({
  locale,
  dictionary,
  game,
  playerSelections,
  onChange,
  onPlayersLoaded,
}: {
  locale: Locale;
  dictionary: Dictionary;
  game: GameSummary;
  playerSelections: Record<string, string>;
  onChange: (category: string, playerId: string) => void;
  onPlayersLoaded: (gameId: string, players: PlayerSummary[]) => void;
}) => {
  const homeTeamId = String(game.homeTeam.id);
  const awayTeamId = String(game.awayTeam.id);

// Chiavi memoizzate e con dipendenze che NON cambiano di lunghezza
const homeKey = useMemo(
  () => normalizeTeamInput(game.homeTeam),
  [game.homeTeam],
);

const awayKey = useMemo(
  () => normalizeTeamInput(game.awayTeam),
  [game.awayTeam],
);

  const {
    players: apiPlayers,
    homePlayers: homeRosterPlayers,
    awayPlayers: awayRosterPlayers,
    missing: missingRosterKeys,
    isLoading: playersLoading,
    isError: playersError,
    error: playersErrorMessage,
  } = useTeamPlayers({
    homeId: homeTeamId,
    homeAbbr: game.homeTeam.abbreviation ?? null,
    homeName: game.homeTeam.name,
    awayId: awayTeamId,
    awayAbbr: game.awayTeam.abbreviation ?? null,
    awayName: game.awayTeam.name,
  });

  const combinedPlayers = useMemo(() => {
    const map = new Map<string, PlayerSummary>();
    apiPlayers.forEach((player) => {
      const rawName = (player.full_name || '').trim();
      const fallbackName = rawName || `Player ${player.id}`;
      const parts = fallbackName.split(/\s+/);
      const firstName = parts[0] ?? fallbackName;
      const lastName = parts.slice(1).join(' ');
      map.set(player.id, {
        id: player.id,
        fullName: fallbackName,
        firstName,
        lastName,
        position: player.position || null,
        teamId: player.team_id,
        jersey: player.jersey ?? null,
      });
    });
    return Array.from(map.values());
  }, [apiPlayers]);

  const createOptionLabel = useCallback((player: PlayerSummary) => {
    const parts = [player.fullName];
    if (player.jersey) {
      const jerseyValue = player.jersey.startsWith('#') ? player.jersey : `#${player.jersey}`;
      parts.push(jerseyValue);
    }
    if (player.position) {
      parts.push(`· ${player.position}`);
    }
    return parts.join(' ');
  }, []);

  const selectOptions = useMemo(
    () =>
      combinedPlayers.map((player) => ({
        value: player.id,
        label: createOptionLabel(player),
        meta: {
          altNames: [player.fullName, player.firstName, player.lastName].filter(Boolean),
        },
      })),
    [combinedPlayers, createOptionLabel],
  );

  const isLoading = playersLoading;
  const loadError = playersError ? playersErrorMessage ?? 'Players unavailable' : null;
  const hasNoPlayers = !isLoading && !loadError && combinedPlayers.length === 0;

  const homeCount = homeRosterPlayers.length;
  const awayCount = awayRosterPlayers.length;

  useEffect(() => {
    if (!homeKey || !awayKey) return;

    let cancelled = false;
    const ctrl = new AbortController();
  
    (async () => {
      try {
        const url =
          `/api/players?` +
          `homeName=${encodeURIComponent(homeKey)}` +
          `&awayName=${encodeURIComponent(awayKey)}`;
  
        const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
  
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.warn('[players] fetch failed', {
            gameId: game.id,
            status: res.status,
            error: body?.error,
            input: { homeKey, awayKey },
            attempts: body?.missing?.attempts,
          });
          return;
        }
  
        const payload = (await res.json()) as Partial<{
          home: RemotePlayer[];
          away: RemotePlayer[];
        }>;

        // === costruiamo PlayerSummary completo ===
        const toSummary = (player: RemotePlayer): PlayerSummary => {
          const fallbackName = player.id != null ? `Player ${player.id}` : 'Unknown Player';
          const full = (
            player.full_name ??
            `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim() ??
            player.name ??
            fallbackName
          )
            .replace(/\s+/g, ' ')
            .trim();

          const [first, ...rest] = full.split(' ');
          const firstName = first || full;
          const lastName = rest.join(' ');

          return {
            id: String(player.id),
            fullName: full,
            firstName,
            lastName,
            position: (player.position ?? player.pos ?? null) ?? null,
            teamId: String(player.team_id ?? player.teamId ?? ''),
            jersey: player.jersey ?? null,
          };
        };

        const byId = new Map<string, PlayerSummary>();
        payload.home?.forEach((player) => {
          if (player?.id == null) return;
          byId.set(String(player.id), toSummary(player));
        });
        payload.away?.forEach((player) => {
          if (player?.id == null) return;
          byId.set(String(player.id), toSummary(player));
        });

        const merged: PlayerSummary[] = Array.from(byId.values()).sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        );

        if (!cancelled) {
          onPlayersLoaded?.(game.id, merged);
        }
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('[players] fetch error', { gameId: game.id, err });
        }
      }
    })();
  
    return () => {
      cancelled = true;
      ctrl.abort();
    };

    if (missingRosterKeys.length) {
      console.warn('[players] Missing roster entries', {
        gameId: game.id,
        missing: missingRosterKeys,
      });
    }
  }, [awayKey, game.id, homeKey, missingRosterKeys, onPlayersLoaded]);

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-wide text-slate-400">
        <span>{formatGameTime(locale, game.startsAt)}</span>
        <span>
          {game.awayTeam.name} @ {game.homeTeam.name}
        </span>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{dictionary.common.loading}</span>
        </div>
      ) : null}
      {!isLoading && loadError ? (
        <p className="text-sm text-red-400">{loadError}</p>
      ) : null}
      {!isLoading && !loadError && hasNoPlayers ? (
        <p className="text-sm text-red-400">No players loaded.</p>
      ) : null}
      {combinedPlayers.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {PLAYER_CATEGORIES.map((category) => {
            const rawValue = playerSelections[category];
            const normalizedValue =
              rawValue === undefined || rawValue === null || rawValue === ''
                ? null
                : rawValue;

            return (
              <label key={category} className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {dictionary.play.players.categories[category]}
                </span>
                <PlayerSelect
                  options={selectOptions}
                  value={normalizedValue ?? undefined}
                  onChange={(playerId) => onChange(category, playerId ?? '')}
                  placeholder="-"
                  disabled={combinedPlayers.length === 0 && isLoading}
                />
              </label>
            );
          })}
        </div>
      ) : null}
      {process.env.NODE_ENV !== 'production' && (
        <div className="text-[11px] text-slate-400">
          <div>
            HOME {game.homeTeam.name} / {game.homeTeam.abbreviation ?? '—'} — players:{' '}
            {homeCount}
          </div>
          <div>
            AWAY {game.awayTeam.name} / {game.awayTeam.abbreviation ?? '—'} — players:{' '}
            {awayCount}
          </div>
          {loadError ? <div className="text-red-400">Error: {loadError}</div> : null}
        </div>
      )}
    </div>
  );
};

const HighlightsSelector = ({
  dictionary,
  highlightSelections,
  onChange,
  players,
}: {
  dictionary: Dictionary;
  highlightSelections: HighlightPick[];
  onChange: (rank: number, playerId: string) => void;
  players: PlayerSummary[];
}) => {
  const selectedByRank = useMemo(() => {
    const map = new Map<number, string>();
    highlightSelections.forEach((entry) => {
      map.set(entry.rank, entry.playerId);
    });
    return map;
  }, [highlightSelections]);

  const selectedPlayerIds = useMemo(
    () => new Set(highlightSelections.map((entry) => entry.playerId)),
    [highlightSelections],
  );

  const sortedPlayers = useMemo(() => {
    const seen = new Set<string>();
    return players.filter((player) => {
      if (seen.has(player.id)) {
        return false;
      }
      seen.add(player.id);
      return true;
    });
  }, [players]);

  const createOptionLabel = useCallback((player: PlayerSummary) => {
    const parts = [player.fullName];
    if (player.jersey) {
      const jerseyValue = player.jersey.startsWith('#') ? player.jersey : `#${player.jersey}`;
      parts.push(jerseyValue);
    }
    if (player.position) {
      parts.push(`· ${player.position}`);
    }
    return parts.join(' ');
  }, []);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 5 }).map((_, index) => {
        const rank = index + 1;
        const selectedPlayer = selectedByRank.get(rank) ?? '';
        const options = sortedPlayers.map((player) => ({
          value: player.id,
          label: createOptionLabel(player),
          meta: {
            altNames: [player.fullName, player.firstName, player.lastName].filter(Boolean),
            disabled: player.id !== selectedPlayer && selectedPlayerIds.has(player.id),
          },
        }));
        const normalizedValue =
          selectedPlayer === undefined ||
          selectedPlayer === null ||
          selectedPlayer === ''
            ? null
            : selectedPlayer;

        return (
          <label key={rank} className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {dictionary.admin.rank} #{rank}
            </span>
            <PlayerSelect
              options={options}
              value={normalizedValue ?? undefined}
              onChange={(playerId) => onChange(rank, playerId ?? '')}
              placeholder="-"
            />
          </label>
        );
      })}
    </div>
  );
};

const CollectionGrid = ({
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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelectedCard(card)}
            className="group relative overflow-hidden rounded-[1.5rem] border border-accent-gold/20 bg-navy-800/70 p-5 text-left shadow-card transition hover:border-accent-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-20"
              style={{ backgroundColor: card.accent_color ?? '#8ecae6' }}
            />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                <span>{card.rarity}</span>
                <span>{card.price} AP</span>
              </div>
              <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-navy-900">
                <Image
                  src={card.image_url}
                  alt={card.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{card.name}</h3>
                <p className="text-sm text-slate-300">{card.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedCard ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-accent-gold/30 bg-navy-900/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
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

const ShopGrid = ({
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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              className="group relative overflow-hidden rounded-[1.5rem] border border-accent-gold/20 bg-navy-800/70 p-5 shadow-card transition hover:border-accent-gold/40"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-30"
                style={{ backgroundColor: card.accent_color ?? '#8ecae6' }}
              />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                  <span>{card.rarity}</span>
                  <span className="flex items-center gap-2 text-slate-200">
                    <Coins className="h-4 w-4 text-accent-gold" />
                    {card.price}
                  </span>
                </div>
                <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-navy-900">
                  <Image
                    src={card.image_url}
                    alt={card.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{card.name}</h3>
                  <p className="text-sm text-slate-300">{card.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => (canBuy ? setPendingCard(card) : undefined)}
                  disabled={!canBuy || isPending}
                  className={clsx(
                    'inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed',
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeConfirm}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-accent-gold/30 bg-navy-900/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
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

export function DashboardClient({
  locale,
  balance,
  ownedCards,
  shopCards,
  role,
}: DashboardClientProps) {
  const { dictionary } = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [activeTab, setActiveTab] = useState<'play' | 'winners' | 'collection' | 'shop'>('play');
  const [teamSelections, setTeamSelections] = useState<Record<string, string>>({});
  const [playerSelections, setPlayerSelections] = useState<PlayerSelections>({});
  const [highlightSelections, setHighlightSelections] = useState<HighlightPick[]>([]);
  const [playersManuallyCompleted, setPlayersManuallyCompleted] = useState(false);
  const [highlightsManuallyCompleted, setHighlightsManuallyCompleted] = useState(false);
  const [playersByGame, setPlayersByGame] = useState<Record<string, PlayerSummary[]>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const pickDate = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  const { games, isLoading: gamesLoading } = useGames(locale);
  const {
    data: picks,
    isLoading: picksLoading,
    saveInitialPicks,
    updatePicks,
  } = usePicks(pickDate);

  useEffect(() => {
    if (!picks) {
      return;
    }

    setTeamSelections(
      picks.teams.reduce<Record<string, string>>((acc, pick) => {
        const game = (pick as any).game;
        const selectedId = pick.selected_team_id;
        if (selectedId === 'home' || selectedId === 'away') {
          acc[pick.game_id] = selectedId;
          return acc;
        }
        if (game) {
          if (selectedId === game.home_team_id) {
            acc[pick.game_id] = 'home';
            return acc;
          }
          if (selectedId === game.away_team_id) {
            acc[pick.game_id] = 'away';
            return acc;
          }
        }
        acc[pick.game_id] = selectedId;
        return acc;
      }, {}),
    );

    setPlayerSelections(
      picks.players.reduce<PlayerSelections>((acc, pick) => {
        acc[pick.game_id] = acc[pick.game_id] ?? {};
        acc[pick.game_id][pick.category] = pick.player_id;
        return acc;
      }, {}),
    );

    setHighlightSelections(
      picks.highlights
        .map((highlight) => ({
          playerId: highlight.player_id,
          rank: highlight.rank,
        }))
        .sort((a, b) => a.rank - b.rank),
    );
    setPlayersManuallyCompleted(false);
    setHighlightsManuallyCompleted(false);
  }, [picks]);

  const onPlayersLoaded = useCallback((gameId: string, players: PlayerSummary[]) => {
    setPlayersByGame((previous) => {
      const existing = previous[gameId] ?? [];
      if (
        existing.length === players.length &&
        existing.every((player, index) => player.id === players[index]?.id)
      ) {
        return previous;
      }
      return { ...previous, [gameId]: players };
    });
  }, []);

  const highlightPlayerPool = useMemo(
    () => Object.values(playersByGame).flat(),
    [playersByGame],
  );

  const teamsComplete = useMemo(
    () => games.length > 0 && games.every((game) => !!teamSelections[game.id]),
    [games, teamSelections],
  );

  const playersComplete = useMemo(
    () =>
      playersManuallyCompleted ||
      (games.length > 0 &&
        games.every((game) =>
          PLAYER_CATEGORIES.every((category) =>
            Boolean(playerSelections[game.id]?.[category]),
          ),
        )),
    [games, playerSelections, playersManuallyCompleted],
  );

  const highlightsComplete = useMemo(
    () => highlightsManuallyCompleted || highlightSelections.length === 5,
    [highlightsManuallyCompleted, highlightSelections.length],
  );

  const handleTeamsSelect = (gameId: string, teamId: string) => {
    setTeamSelections((previous) => ({ ...previous, [gameId]: teamId }));
  };

  const handlePlayerSelect = (gameId: string, category: string, playerId: string) => {
    setPlayerSelections((previous) => ({
      ...previous,
      [gameId]: {
        ...(previous[gameId] ?? {}),
        [category]: playerId,
      },
    }));
  };

  const handleHighlightSelect = (rank: number, playerId: string) => {
    setHighlightSelections((previous) => {
      const filtered = previous.filter((entry) => entry.rank !== rank);
      if (!playerId) {
        return filtered;
      }
      filtered.push({ rank, playerId });
      return filtered.sort((a, b) => a.rank - b.rank);
    });
  };

  const hasExistingPicks = Boolean(picks && picks.teams.length > 0);
  const dailyChanges = picks?.changesCount ?? 0;
  const changeLimitReached = dailyChanges >= 1;
  const canSubmit = teamsComplete && playersComplete && highlightsComplete && !isSaving;

  const dictionaryChangeHint = changeLimitReached
    ? dictionary.play.changesHintExhausted
    : dictionary.play.changesHintAvailable;

  const handleSave = async () => {
    if (!canSubmit) {
      return;
    }
    if (hasExistingPicks && changeLimitReached) {
      setErrorMessage(dictionary.play.changesHintExhausted);
      return;
    }

    const gamesMeta: GameMeta[] = games.map((game) => {
      const providerGameId =
        String((game as { providerGameId?: string; id: string }).providerGameId ?? game.id);
      const provider = normalizeProvider(
        (game as { provider?: string }).provider,
      );
      const startsAtDate = new Date(game.startsAt);
      const startsAtIso = Number.isNaN(startsAtDate.getTime())
        ? new Date().toISOString()
        : startsAtDate.toISOString();
      const seasonValue = (game as { season?: string | number }).season;
      const season =
        typeof seasonValue === 'number' || typeof seasonValue === 'string'
          ? String(seasonValue)
          : deriveSeasonFromDate(game.startsAt);

      return {
        provider,
        providerGameId,
        gameDateISO: startsAtIso,
        season,
        status: game.status ?? 'scheduled',
        home: {
          abbr: computeTeamAbbr(game.homeTeam),
          name: game.homeTeam.name ?? (game.homeTeam.city ?? 'Unknown'),
        },
        away: {
          abbr: computeTeamAbbr(game.awayTeam),
          name: game.awayTeam.name ?? (game.awayTeam.city ?? 'Unknown'),
        },
      };
    });
    const gameUuids = Array.from(new Set(games.map((game) => game.id)));

    const teams: TeamPick[] = games
      .map((game) => {
        const selection = teamSelections[game.id];
        if (!selection) {
          return null;
        }
        const rawSelection = String(selection);
        if (rawSelection === 'home' || rawSelection === 'away') {
          return { gameId: game.id, teamId: rawSelection };
        }
        const lowerSelection = rawSelection.toLowerCase();
        const homeAbbr = game.homeTeam.abbreviation?.toLowerCase() ?? '';
        const awayAbbr = game.awayTeam.abbreviation?.toLowerCase() ?? '';
        const homeId = String(game.homeTeam.id).toLowerCase();
        const awayId = String(game.awayTeam.id).toLowerCase();

        if (lowerSelection === homeAbbr || lowerSelection === homeId) {
          return { gameId: game.id, teamId: 'home' };
        }
        if (lowerSelection === awayAbbr || lowerSelection === awayId) {
          return { gameId: game.id, teamId: 'away' };
        }

        return null;
      })
      .filter(
        (entry): entry is TeamPick =>
          entry !== null && (entry.teamId === 'home' || entry.teamId === 'away'),
      );

    const payload = {
      pickDate,
      teams,
      players: Object.entries(playerSelections).flatMap(([gameId, categories]) =>
        Object.entries(categories)
          .filter(([, playerId]) => !!playerId)
          .map<PlayerPick>(([category, playerId]) => ({
            gameId,
            category,
            playerId,
          })),
      ),
      highlights: highlightSelections.map<HighlightPick>((entry) => ({
        playerId: entry.playerId,
        rank: entry.rank,
      })),
      gamesMeta,
      gameUuids,
    };

    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (hasExistingPicks) {
        await updatePicks(payload);
      } else {
        await saveInitialPicks(payload);
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: Array<{
    key: 'play' | 'winners' | 'collection' | 'shop';
    label: string;
  }> = [
    { key: 'play', label: dictionary.dashboard.playTab },
    { key: 'winners', label: dictionary.dashboard.winnersTab },
    { key: 'collection', label: dictionary.dashboard.collectionTab },
    { key: 'shop', label: dictionary.dashboard.shopTab },
  ];

  const ownedCardIds = useMemo(
    () => new Set(ownedCards.map((card) => card.id)),
    [ownedCards],
  );

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push(`/${locale}`);
      router.refresh();
    } catch (error) {
      console.error('[dashboard] signOut failed', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-8 pb-16 pt-2 sm:pt-4 lg:pb-24">
      <section>
        <h1 className="mb-2 text-xl font-bold">Dashboard NBAnima</h1>
        <p className="text-sm text-gray-500">
          Benvenuto! Bilancio attuale: {balance} Anima Points
        </p>
      </section>

      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-navy-900/60 p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {dictionary.dashboard.welcome}
          </p>
          <h1 className="text-2xl font-semibold text-white">NBAnima</h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 text-xs text-slate-300">
            <UserCircle2 className="h-4 w-4 text-accent-gold" />
            <span>{locale.toUpperCase()}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-accent-gold/40 bg-navy-800/80 px-5 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-navy-800/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? '…' : dictionary.common.logout}
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-6 rounded-[2rem] border border-accent-gold/40 bg-navy-900/70 p-6 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-gold/40 bg-navy-800/70">
            <Coins className="h-7 w-7 text-accent-gold" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {dictionary.dashboard.animaPoints}
            </p>
            <p className="text-3xl font-semibold text-white">{balance.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span>{dictionary.dashboard.lastUpdated}:</span>
          <code className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 font-mono text-xs">
            {pickDate}
          </code>
          {role === 'admin' ? (
            <Link
              href={`/${locale}/admin`}
              className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold text-accent-gold hover:border-accent-gold"
            >
              {dictionary.common.admin}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-navy-900/50 p-4 shadow-card">
        <div className="flex snap-x gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={clsx(
                'rounded-full border px-5 py-2 text-sm font-semibold transition min-h-[40px]',
                activeTab === tab.key
                  ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                  : 'border-white/10 bg-navy-800/70 text-slate-300 hover:border-accent-gold/30',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === 'play' ? (
            <div className="space-y-6">
              <header className="space-y-2">
                <h2 className="text-2xl font-semibold text-white">
                  {dictionary.play.title}
                </h2>
                <p className="text-sm text-slate-300">{dictionary.play.subtitle}</p>
                <div className="mt-4 flex gap-3 flex-wrap">
                  <a
                    href="https://www.nba.com/stats"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card hover:brightness-110 transition"
                  >
                    {dictionary.play.links.nbaStats}
                  </a>
                  <a
                    href="https://www.nba.com/players/todays-lineups"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card hover:brightness-110 transition"
                  >
                    {dictionary.play.links.nbaLineups}
                  </a>
                </div>
              </header>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <SectionStatus complete={teamsComplete} />
                      {dictionary.play.teams.title}
                    </h3>
                    <p className="text-sm text-slate-300">
                      {dictionary.play.teams.description}
                    </p>
                  </div>
                </div>
                {gamesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{dictionary.common.loading}</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {games.map((game) => (
                      <GameTeamsRow
                        key={game.id}
                        locale={locale}
                        game={game}
                        selection={teamSelections[game.id]}
                        onSelect={(teamId) => handleTeamsSelect(game.id, teamId)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <SectionStatus complete={playersComplete} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {dictionary.play.players.title}
                    </h3>
                    <p className="text-sm text-slate-300">
                      {dictionary.play.players.description}
                    </p>
                  </div>
                </div>
                {games.map((game) => (
                  <GamePlayersCard
                    key={game.id}
                    locale={locale}
                    dictionary={dictionary}
                    game={game}
                    playerSelections={playerSelections[game.id] ?? {}}
                    onChange={(category, playerId) =>
                      handlePlayerSelect(game.id, category, playerId)
                    }
                    onPlayersLoaded={onPlayersLoaded}
                  />
                ))}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setPlayersManuallyCompleted(true)}
                    className="rounded-lg border border-accent-gold bg-gradient-to-r from-accent-gold/90 to-accent-coral/90 px-4 py-2 text-sm font-semibold text-navy-900 shadow-card hover:brightness-105"
                  >
                    {dictionary?.play?.players?.endPicks ?? 'Termina scelte'}
                  </button>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <SectionStatus complete={highlightsComplete} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {dictionary.play.highlights.title}
                    </h3>
                    <p className="text-sm text-slate-300">
                      {dictionary.play.highlights.description}
                    </p>
                  </div>
                </div>
                <HighlightsSelector
                  dictionary={dictionary}
                  highlightSelections={highlightSelections}
                  onChange={handleHighlightSelect}
                  players={highlightPlayerPool}
                />
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setHighlightsManuallyCompleted(true)}
                    className="rounded-lg border border-accent-gold bg-gradient-to-r from-accent-gold/90 to-accent-coral/90 px-4 py-2 text-sm font-semibold text-navy-900 shadow-card hover:brightness-105"
                  >
                    {dictionary?.play?.highlights?.endPicks ?? 'Termina scelte'}
                  </button>
                </div>
              </section>

              <footer className="space-y-4">
                <p className="text-sm text-slate-300">{dictionaryChangeHint}</p>
                <div
                  role="status"
                  aria-live="polite"
                  className="min-h-[1.5rem] text-sm text-red-400"
                >
                  {errorMessage ?? null}
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSubmit || picksLoading || gamesLoading || isSaving}
                  className={clsx(
                    'inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition min-h-[48px]',
                    canSubmit && !changeLimitReached
                      ? 'border-lime-400/80 bg-lime-400/20 text-lime-300 hover:bg-lime-400/30'
                      : 'border-white/10 bg-navy-800/70 text-slate-400',
                  )}
                  aria-busy={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {hasExistingPicks ? dictionary.play.update : dictionary.play.submit}
                </button>
              </footer>
            </div>
          ) : null}

          {activeTab === 'winners' ? (
            <WinnersClient locale={locale} dictionary={dictionary} />
          ) : null}

          {activeTab === 'collection' ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">
              {dictionary.collection.title}
            </h2>
            {ownedCards.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-navy-900/50 p-6 text-sm text-slate-300">
                {dictionary.collection.empty}
              </p>
            ) : (
              <CollectionGrid cards={ownedCards} dictionary={dictionary} />
            )}
          </div>
          ) : null}

          {activeTab === 'shop' ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">
                {dictionary.shop.title}
              </h2>
              <ShopGrid
                cards={shopCards}
                balance={balance}
                dictionary={dictionary}
                locale={locale}
                ownedCardIds={ownedCardIds}
                onPurchaseSuccess={() => router.refresh()}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
