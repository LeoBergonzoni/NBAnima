'use client';

import clsx from 'clsx';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Coins,
  Loader2,
  LogOut,
  Sparkles,
  UserCircle2,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import { PlayerSelect } from '@/components/ui/PlayerSelect';
import { useLocale } from '@/components/providers/locale-provider';
import { FEATURES, type Locale } from '@/lib/constants';
import { supabaseBrowser } from '@/lib/supabase-browser';
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
import type { WeeklyRankingRow } from '@/types/database';

const PLAYER_CATEGORIES = ['top_scorer', 'top_assist', 'top_rebound'] as const;
const HIGHLIGHT_SLOT_COUNT = 5;
const buildEmptyHighlightSlots = () =>
  Array.from({ length: HIGHLIGHT_SLOT_COUNT }, () => '');

type WeeklyXpResponse = {
  weekStart: string;
  xp: number;
};

type WeeklyRankingResponse = {
  weekStart: string;
  ranking: WeeklyRankingRow[];
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed');
  }
  return payload as unknown as T;
};

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
  highlightSelections: string[];
  onChange: (slotIndex: number, playerId: string) => void;
  players: PlayerSummary[];
}) => {
  const selectedPlayerIds = useMemo(
    () => new Set(highlightSelections.filter((value) => value)),
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
        const currentSelection = highlightSelections[index] ?? '';
        const disabledIds = new Set(selectedPlayerIds);
        if (currentSelection) {
          disabledIds.delete(currentSelection);
        }
        const options = sortedPlayers.map((player) => ({
          value: player.id,
          label: createOptionLabel(player),
          meta: {
            altNames: [player.fullName, player.firstName, player.lastName].filter(Boolean),
            disabled: disabledIds.has(player.id),
          },
        }));
        const normalizedValue = currentSelection ? currentSelection : null;

        return (
          <label key={index} className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {dictionary.play.highlights.selectionLabel}
              <span className="sr-only"> {index + 1}</span>
            </span>
            <PlayerSelect
              options={options}
              value={normalizedValue ?? undefined}
              onChange={(playerId) => onChange(index, playerId ?? '')}
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
  const highlightsEnabled = FEATURES.HIGHLIGHTS_ENABLED;
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-US'),
    [locale],
  );
  const [activeTab, setActiveTab] = useState<
    'play' | 'myPicks' | 'winners' | 'collection' | 'shop' | 'weekly'
  >('play');
  const [teamSelections, setTeamSelections] = useState<Record<string, string>>({});
  const [playerSelections, setPlayerSelections] = useState<PlayerSelections>({});
  const [highlightSelections, setHighlightSelections] = useState<string[]>(() =>
    buildEmptyHighlightSlots(),
  );
  const [playersManuallyCompleted, setPlayersManuallyCompleted] = useState(false);
  const [highlightsManuallyCompleted, setHighlightsManuallyCompleted] = useState(false);
  const [playersByGame, setPlayersByGame] = useState<Record<string, PlayerSummary[]>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isTeamsOpen, setIsTeamsOpen] = useState(true);
  const [isPlayersOpen, setIsPlayersOpen] = useState(false);

  const pickDate = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  const {
    data: weeklyXpData,
    error: weeklyXpError,
    isLoading: weeklyXpLoading,
  } = useSWR<WeeklyXpResponse>('/api/me/weekly-xp', fetchJson, {
    revalidateOnFocus: false,
  });

  const {
    data: weeklyRankingData,
    error: weeklyRankingError,
    isLoading: weeklyRankingLoading,
  } = useSWR<WeeklyRankingResponse>('/api/leaderboard/weekly', fetchJson, {
    revalidateOnFocus: false,
  });

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
        const game = pick.game ?? null;
        const selectedId = pick.selected_team_id;
        if (selectedId === 'home' || selectedId === 'away') {
          acc[pick.game_id] = selectedId;
          return acc;
        }
        if (game) {
          if (selectedId && selectedId === game.home_team_id) {
            acc[pick.game_id] = 'home';
            return acc;
          }
          if (selectedId && selectedId === game.away_team_id) {
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

    const sortedHighlights = [...(picks.highlights ?? [])]
      .filter((highlight) => highlight?.player_id)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const slots = buildEmptyHighlightSlots();
    sortedHighlights.slice(0, HIGHLIGHT_SLOT_COUNT).forEach((highlight, index) => {
      slots[index] = highlight.player_id;
    });
    setHighlightSelections(slots);
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

  const weeklyXpValue = weeklyXpData?.xp ?? 0;
  const weeklyXpWeekStart = weeklyXpData?.weekStart ?? null;
  const weeklyRanking = weeklyRankingData?.ranking ?? [];
  const weeklyRankingWeekStart =
    weeklyRankingData?.weekStart ?? weeklyXpWeekStart ?? null;
  const weeklyXpCaption = dictionary.dashboard.weeklyRangeCaption.replace(
    '{date}',
    weeklyXpWeekStart ?? '—',
  );
  const weeklyRankingCaption = dictionary.dashboard.weeklyRangeCaption.replace(
    '{date}',
    weeklyRankingWeekStart ?? '—',
  );
  const weeklyXpErrorMessage = weeklyXpError
    ? locale === 'it'
      ? 'Impossibile caricare i Weekly XP.'
      : 'Unable to load Weekly XP.'
    : null;
  const weeklyRankingErrorMessage = weeklyRankingError
    ? locale === 'it'
      ? 'Impossibile caricare la classifica settimanale.'
      : 'Unable to load the weekly ranking.'
    : null;
  const weeklyRankingEmptyMessage =
    locale === 'it'
      ? 'Nessun dato settimanale disponibile al momento.'
      : 'No weekly data available yet.';

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

  const highlightsComplete = useMemo(() => {
    if (!highlightsEnabled) {
      return true;
    }
    return (
      highlightsManuallyCompleted ||
      highlightSelections.filter((playerId) => playerId).length === HIGHLIGHT_SLOT_COUNT
    );
  }, [highlightsEnabled, highlightsManuallyCompleted, highlightSelections]);

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

  const handleHighlightSelect = (slotIndex: number, playerId: string) => {
    setHighlightSelections((previous) => {
      const next = [...previous];
      while (next.length < HIGHLIGHT_SLOT_COUNT) {
        next.push('');
      }

      if (!playerId) {
        next[slotIndex] = '';
        return next;
      }

      for (let i = 0; i < next.length; i += 1) {
        if (i !== slotIndex && next[i] === playerId) {
          next[i] = '';
        }
      }

      next[slotIndex] = playerId;
      return next;
    });
  };

  const hasExistingPicks = Boolean(picks && picks.teams.length > 0);
  const dailyChanges = picks?.changesCount ?? 0;
  const changeHintMessage = dictionary.play.changesHint.replace(
    '{count}',
    String(dailyChanges),
  );
  const canSubmit = teamsComplete && !isSaving;

  const handleSave = async () => {
    if (!canSubmit) {
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
      highlights: highlightSelections
        .filter((playerId) => playerId)
        .map<HighlightPick>((playerId) => ({
          playerId,
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
    key: 'play' | 'myPicks' | 'winners' | 'collection' | 'shop' | 'weekly';
    label: string;
  }> = [
    { key: 'play', label: dictionary.dashboard.playTab },
    { key: 'myPicks', label: dictionary.dashboard.myPicksTab },
    { key: 'winners', label: dictionary.dashboard.winnersTab },
    { key: 'collection', label: dictionary.dashboard.collectionTab },
    { key: 'shop', label: dictionary.dashboard.shopTab },
    { key: 'weekly', label: dictionary.dashboard.weeklyRanking },
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
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-2xl font-semibold text-white">NBAnima</span>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 text-xs text-slate-300">
              <UserCircle2 className="h-4 w-4 text-accent-gold" />
              <span>{locale.toUpperCase()}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-navy-900/70 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-accent-gold/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-3 w-3" />
              {isLoggingOut ? '…' : dictionary.common.logout}
            </button>
          </div>
        </div>
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
      </section>

      <section className="rounded-[2rem] border border-accent-gold/40 bg-navy-900/70 p-6 shadow-card">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-gold/40 bg-navy-800/70">
              <Coins className="h-7 w-7 text-accent-gold" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {dictionary.dashboard.animaPoints}
              </p>
              <p className="text-3xl font-semibold text-white">
                {numberFormatter.format(balance)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-gold/40 bg-navy-800/70">
              <Sparkles className="h-7 w-7 text-accent-gold" />
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {dictionary.dashboard.weeklyXpBalance}
              </p>
              <div className="flex min-h-[2.25rem] items-center justify-center gap-2 text-3xl font-semibold text-white sm:justify-start">
                {weeklyXpLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-label={dictionary.common.loading} />
                ) : (
                  <span>{weeklyXpError ? '—' : numberFormatter.format(weeklyXpValue)}</span>
                )}
              </div>
              <p className="text-xs text-slate-400">{weeklyXpCaption}</p>
              <p className="text-xs text-slate-400">
                {dictionary.dashboard.weeklyXpExplainer}
              </p>
              {weeklyXpErrorMessage ? (
                <p className="text-xs text-rose-300">{weeklyXpErrorMessage}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-300">
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

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsTeamsOpen((previous) => !previous)}
                  className={clsx(
                    'flex flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition',
                    isTeamsOpen
                      ? 'border-accent-gold bg-accent-gold/10 text-white shadow-card'
                      : 'border-white/10 bg-navy-900/40 text-slate-200 hover:border-accent-gold/40',
                  )}
                  aria-expanded={isTeamsOpen}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-white">
                      {dictionary.play.teams.title}
                    </span>
                    <ArrowRight
                      className={clsx(
                        'h-4 w-4 transition-transform',
                        isTeamsOpen ? 'rotate-90 text-accent-gold' : 'text-slate-300',
                      )}
                    />
                  </div>
                  <p className="text-sm text-slate-300">
                    {dictionary.play.teams.description}
                  </p>
                  <p className="text-xs font-semibold text-accent-gold">
                    {dictionary.play.teams.reward}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPlayersOpen((previous) => !previous)}
                  className={clsx(
                    'flex flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition',
                    isPlayersOpen
                      ? 'border-accent-gold bg-accent-gold/10 text-white shadow-card'
                      : 'border-white/10 bg-navy-900/40 text-slate-200 hover:border-accent-gold/40',
                  )}
                  aria-expanded={isPlayersOpen}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-white">
                      {dictionary.play.players.title}
                    </span>
                    <ArrowRight
                      className={clsx(
                        'h-4 w-4 transition-transform',
                        isPlayersOpen ? 'rotate-90 text-accent-gold' : 'text-slate-300',
                      )}
                    />
                  </div>
                  <p className="text-sm text-slate-300">
                    {dictionary.play.players.description}
                  </p>
                  <p className="text-xs font-semibold text-accent-gold">
                    {dictionary.play.players.reward}
                  </p>
                </button>
              </div>

              {isTeamsOpen ? (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <SectionStatus complete={teamsComplete} />
                    <h3 className="text-lg font-semibold text-white">
                      {dictionary.play.teams.title}
                    </h3>
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
              ) : null}

              {isPlayersOpen ? (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <SectionStatus complete={playersComplete} />
                    <h3 className="text-lg font-semibold text-white">
                      {dictionary.play.players.title}
                    </h3>
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
              ) : null}

              {highlightsEnabled ? (
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
              ) : null}

              <footer className="space-y-4">
                <p className="text-sm text-slate-300">{changeHintMessage}</p>
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
                    canSubmit
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

          {activeTab === 'myPicks' ? (
            <WinnersClient
              locale={locale}
              dictionary={dictionary}
              mode="picksOnly"
              title={dictionary.dashboard.myPicksTab}
            />
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

          {activeTab === 'weekly' ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">
                {dictionary.dashboard.weeklyRanking}
              </h2>
              <p className="text-sm text-slate-300">{weeklyRankingCaption}</p>
              <p className="text-xs text-slate-400">
                {dictionary.dashboard.weeklyXpExplainer}
              </p>
              <section className="rounded-2xl border border-white/10 bg-navy-900/60 p-6 shadow-card">
                <div className="overflow-x-auto">
                  {weeklyRankingLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{dictionary.common.loading}</span>
                    </div>
                  ) : weeklyRankingErrorMessage ? (
                    <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {weeklyRankingErrorMessage}
                    </p>
                  ) : weeklyRanking.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-300">
                      {weeklyRankingEmptyMessage}
                    </p>
                  ) : (
                    <table
                      className="min-w-full divide-y divide-white/5 text-left text-sm text-slate-200"
                      aria-label={dictionary.dashboard.weeklyRanking}
                    >
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-slate-400">
                          <th scope="col" className="px-4 py-2">
                            {locale === 'it' ? 'Pos' : 'Pos'}
                          </th>
                          <th scope="col" className="px-4 py-2">
                            {locale === 'it' ? 'Giocatore' : 'Player'}
                          </th>
                          <th scope="col" className="px-4 py-2 text-right">
                            XP
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {weeklyRanking.map((row, index) => (
                          <tr key={row.user_id}>
                            <td className="px-4 py-2 text-slate-300">#{index + 1}</td>
                            <td className="px-4 py-2">
                              {row.full_name?.trim()?.length ? row.full_name : '—'}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-white">
                              {numberFormatter.format(row.weekly_xp)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
