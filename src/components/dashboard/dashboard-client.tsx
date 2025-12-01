'use client';

import clsx from 'clsx';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDashed,
  Coins,
  Medal,
  Loader2,
  Sparkles,
  UserCircle2,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import useSWR from 'swr';

import { PlayerSelect, type PlayerOptionSection } from '@/components/ui/PlayerSelect';
import { useLocale } from '@/components/providers/locale-provider';
import { FEATURES, type Locale } from '@/lib/constants';
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
import { WinnersClient } from './winners-client';
import type { WeeklyRankingRow } from '@/types/database';
import type { ShopCard } from '@/types/shop-card';

const PLAYER_CATEGORIES = ['top_scorer', 'top_assist', 'top_rebound'] as const;
const HIGHLIGHT_SLOT_COUNT = 5;
const LOCK_WINDOW_BUFFER_MS = 5 * 60 * 1000;
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

const formatCountdown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((unit) => unit.toString().padStart(2, '0'))
    .join(':');
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

const getDefaultDashboardTab = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
    ? 'weekly'
    : 'play';

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
  onSelectOpenChange,
}: {
  locale: Locale;
  dictionary: Dictionary;
  game: GameSummary;
  playerSelections: Record<string, string>;
  onChange: (category: string, playerId: string) => void;
  onPlayersLoaded: (gameId: string, players: PlayerSummary[]) => void;
  onSelectOpenChange?: (open: boolean) => void;
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
        id: player.id,
        label: createOptionLabel(player),
        subtitle: player.jersey
          ? player.jersey.startsWith('#')
            ? player.jersey
            : `#${player.jersey}`
          : undefined,
        keywords: [player.fullName, player.firstName, player.lastName].filter(Boolean),
      })),
    [combinedPlayers, createOptionLabel],
  );

  const selectSections = useMemo<PlayerOptionSection[]>(() => {
    const playerTeamMap = new Map<string, string | null>();
    combinedPlayers.forEach((player) => {
      const normalizedTeamId =
        player.teamId !== undefined && player.teamId !== null && player.teamId !== ''
          ? String(player.teamId)
          : null;
      playerTeamMap.set(player.id, normalizedTeamId);
    });

    const homeIds = new Set(homeRosterPlayers.map((player) => String(player.id)));
    const awayIds = new Set(awayRosterPlayers.map((player) => String(player.id)));

    const belongsToHome = (optionId: string) =>
      homeIds.has(optionId) || playerTeamMap.get(optionId) === homeTeamId;
    const belongsToAway = (optionId: string) =>
      awayIds.has(optionId) || playerTeamMap.get(optionId) === awayTeamId;

    const homeOptions = selectOptions.filter((option) => belongsToHome(option.id));
    const awayOptions = selectOptions.filter((option) => belongsToAway(option.id));

    const assignedIds = new Set([...homeOptions, ...awayOptions].map((option) => option.id));
    const otherOptions = selectOptions.filter((option) => !assignedIds.has(option.id));

    const fallbackLabel = locale === 'it' ? 'Altri giocatori' : 'Other players';
    const homeLabel = game.homeTeam.name ?? (locale === 'it' ? 'Squadra casa' : 'Home team');
    const awayLabel = game.awayTeam.name ?? (locale === 'it' ? 'Squadra trasferta' : 'Away team');

    const sections: PlayerOptionSection[] = [];

    if (homeOptions.length > 0) {
      sections.push({ label: homeLabel, options: homeOptions });
    }

    if (awayOptions.length > 0) {
      sections.push({ label: awayLabel, options: awayOptions });
    }

    if (otherOptions.length > 0) {
      sections.push({
        label: fallbackLabel,
        options: otherOptions,
      });
    }

    return sections;
  }, [
    awayRosterPlayers,
    awayTeamId,
    combinedPlayers,
    game.awayTeam.name,
    game.homeTeam.name,
    homeRosterPlayers,
    homeTeamId,
    locale,
    selectOptions,
  ]);

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
                  sections={selectSections}
                  value={normalizedValue ?? undefined}
                  onChange={(playerId) => onChange(category, playerId ?? '')}
                  placeholder="-"
                  disabled={combinedPlayers.length === 0 && isLoading}
                  onDialogOpenChange={onSelectOpenChange}
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
          id: player.id,
          label: createOptionLabel(player),
          subtitle: player.jersey
            ? player.jersey.startsWith('#')
              ? player.jersey
              : `#${player.jersey}`
            : undefined,
          disabled: disabledIds.has(player.id),
          keywords: [player.fullName, player.firstName, player.lastName].filter(Boolean),
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

export function DashboardClient({
  locale,
  balance,
  ownedCards,
  shopCards,
}: DashboardClientProps) {
  const { dictionary } = useLocale();
  const highlightsEnabled = FEATURES.HIGHLIGHTS_ENABLED;
  const tabsSectionRef = useRef<HTMLElement | null>(null);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-US'),
    [locale],
  );
  const ownedCount = ownedCards.length;
  const shopCount = shopCards.length;
  const [activeTab, setActiveTab] = useState<'play' | 'myPicks' | 'winners' | 'weekly'>(() =>
    getDefaultDashboardTab(),
  );
  const [teamSelections, setTeamSelections] = useState<Record<string, string>>({});
  const [playerSelections, setPlayerSelections] = useState<PlayerSelections>({});
  const [highlightSelections, setHighlightSelections] = useState<string[]>(() =>
    buildEmptyHighlightSlots(),
  );
  const [picksToast, setPicksToast] = useState<string | null>(null);
  const [highlightsManuallyCompleted, setHighlightsManuallyCompleted] = useState(false);
  const [playersByGame, setPlayersByGame] = useState<Record<string, PlayerSummary[]>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTeamsOpen, setIsTeamsOpen] = useState(false);
  const [isPlayersOpen, setIsPlayersOpen] = useState(false);
  const [mobilePicker, setMobilePicker] = useState<'teams' | 'players' | null>(null);
  const [mobileSlideIndex, setMobileSlideIndex] = useState(0);
  const [mobileTouchStartX, setMobileTouchStartX] = useState<number | null>(null);
  const [mobileSaveToast, setMobileSaveToast] = useState<string | null>(null);
  const [mobileSwipeLocked, setMobileSwipeLocked] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

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

  const displayGames = useMemo(() => {
    if (games.length > 0) {
      return games;
    }
    if (!picks) {
      return [] as GameSummary[];
    }

    type LegacyPickGame = {
      home_team_name?: string | null;
      away_team_name?: string | null;
      home_team_abbr?: string | null;
      away_team_abbr?: string | null;
    };

    const map = new Map<string, GameSummary>();

    const normalizeFromGameMeta = (game: GameMeta, gameId: string): GameSummary => ({
      id: gameId,
      startsAt: game.gameDateISO ?? pickDate,
      status: 'locked',
      arena: null,
      homeTeam: {
        id: game.home?.abbr ?? 'home',
        name: game.home?.name ?? 'Home',
        city: null,
        logo: null,
        abbreviation: game.home?.abbr ?? undefined,
      },
      awayTeam: {
        id: game.away?.abbr ?? 'away',
        name: game.away?.name ?? 'Away',
        city: null,
        logo: null,
        abbreviation: game.away?.abbr ?? undefined,
      },
    });

    const normalizeFromLegacy = (game: LegacyPickGame, gameId: string): GameSummary => ({
      id: gameId,
      startsAt: pickDate,
      status: 'locked',
      arena: null,
      homeTeam: {
        id: 'home',
        name: game.home_team_name ?? 'Home',
        city: null,
        logo: null,
        abbreviation: game.home_team_abbr ?? undefined,
      },
      awayTeam: {
        id: 'away',
        name: game.away_team_name ?? 'Away',
        city: null,
        logo: null,
        abbreviation: game.away_team_abbr ?? undefined,
      },
    });

    const maybeAdd = (gameId: string, game?: GameMeta | LegacyPickGame | null) => {
      if (!gameId || !game || map.has(gameId)) {
        return;
      }
      const isMeta = (candidate: unknown): candidate is GameMeta =>
        typeof (candidate as GameMeta)?.provider === 'string' &&
        typeof (candidate as GameMeta)?.providerGameId === 'string';

      const summary = isMeta(game)
        ? normalizeFromGameMeta(game, gameId)
        : normalizeFromLegacy(game as LegacyPickGame, gameId);

      map.set(gameId, summary);
    };

    const teamGameById = new Map<string, GameMeta | LegacyPickGame | null>();
    picks.teams.forEach((entry) => {
      teamGameById.set(entry.game_id, (entry.game as GameMeta | LegacyPickGame | null) ?? null);
      maybeAdd(entry.game_id, entry.game as GameMeta | LegacyPickGame | null);
    });
    picks.players.forEach((entry) => {
      const fromTeam = teamGameById.get(entry.game_id) ?? null;
      maybeAdd(entry.game_id, fromTeam);
    });

    return Array.from(map.values());
  }, [games, picks, pickDate]);

  useEffect(() => {
    if (mobileSlideIndex >= Math.max(displayGames.length, 1)) {
      setMobileSlideIndex(0);
    }
  }, [displayGames.length, mobileSlideIndex]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (getDefaultDashboardTab() === 'weekly') {
      setActiveTab((current) => (current === 'play' ? 'weekly' : current));
    }
  }, []);

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
        const providerPlayerId =
          (pick as typeof pick & {
            player?: { provider_player_id?: string | null } | null;
          }).player?.provider_player_id ?? null;
        acc[pick.game_id] = acc[pick.game_id] ?? {};
        acc[pick.game_id][pick.category] = providerPlayerId ?? pick.player_id;
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
    setHighlightsManuallyCompleted(false);
  }, [picks]);

  useEffect(() => {
    if (!picksToast) {
      return;
    }
    const timer = setTimeout(() => setPicksToast(null), 3000);
    return () => clearTimeout(timer);
  }, [picksToast]);

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
  const medals: Array<{ color: string; label: string }> = [
    { color: 'text-amber-300', label: locale === 'it' ? 'Oro' : 'Gold' },
    { color: 'text-slate-200', label: locale === 'it' ? 'Argento' : 'Silver' },
    { color: 'text-orange-400', label: locale === 'it' ? 'Bronzo' : 'Bronze' },
  ];

  const earliestGameStartTs = useMemo(() => {
    const timestamps = games
      .map((game) => new Date(game.startsAt).getTime())
      .filter((value) => Number.isFinite(value));
    if (!timestamps.length) {
      return null;
    }
    return Math.min(...timestamps);
  }, [games]);

  const lockWindowDeadlineTs = useMemo(() => {
    if (!earliestGameStartTs) {
      return null;
    }
    return earliestGameStartTs - LOCK_WINDOW_BUFFER_MS;
  }, [earliestGameStartTs]);

  const lockWindowActive = useMemo(() => {
    if (!lockWindowDeadlineTs) {
      return false;
    }
    return nowTs >= lockWindowDeadlineTs;
  }, [lockWindowDeadlineTs, nowTs]);

  const teamsComplete = useMemo(
    () => displayGames.length > 0 && displayGames.every((game) => !!teamSelections[game.id]),
    [displayGames, teamSelections],
  );

  const playersComplete = useMemo(
    () =>
      displayGames.length > 0 &&
      displayGames.every((game) =>
        PLAYER_CATEGORIES.every((category) => Boolean(playerSelections[game.id]?.[category])),
      ),
    [displayGames, playerSelections],
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

  const totalMobileSlides = mobilePicker ? Math.max(displayGames.length, 1) : 0;

  const openMobilePicker = (mode: 'teams' | 'players') => {
    if (games.length === 0) {
      return;
    }
    setMobilePicker(mode);
    setMobileSlideIndex(0);
    setMobileTouchStartX(null);
  };

  const closeMobilePicker = () => {
    setMobilePicker(null);
    setMobileSlideIndex(0);
    setMobileTouchStartX(null);
  };

  const handleMobileNext = () => {
    if (!mobilePicker || totalMobileSlides === 0) {
      return;
    }
    setMobileSlideIndex((previous) => Math.min(previous + 1, totalMobileSlides - 1));
  };

  const handleMobilePrev = () => {
    if (!mobilePicker || totalMobileSlides === 0) {
      return;
    }
    setMobileSlideIndex((previous) => Math.max(previous - 1, 0));
  };

  const handleMobileTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (mobileSwipeLocked) return;
    setMobileTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleMobileTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (mobileSwipeLocked || mobileTouchStartX === null) {
      return;
    }
    const deltaX = (event.changedTouches[0]?.clientX ?? 0) - mobileTouchStartX;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        handleMobileNext();
      } else {
        handleMobilePrev();
      }
    }
    setMobileTouchStartX(null);
  };

  const hasExistingPicks = Boolean(picks && picks.teams.length > 0);
  const dailyChanges = picks?.changesCount ?? 0;
  const changeHintMessage = dictionary.play.changesHint.replace(
    '{count}',
    String(dailyChanges),
  );
  const lockCountdownInfo = useMemo(() => {
    if (!lockWindowDeadlineTs) {
      return {
        status: 'pending' as const,
        label: dictionary.play.lockCountdown.pending,
        time: null,
      };
    }
    const diff = lockWindowDeadlineTs - nowTs;
    if (diff <= 0) {
      return {
        status: 'closed' as const,
        label: dictionary.play.lockCountdown.closed,
        time: null,
      };
    }
    return {
      status: 'running' as const,
      label: dictionary.play.lockCountdown.label,
      time: formatCountdown(diff),
    };
  }, [dictionary.play.lockCountdown, lockWindowDeadlineTs, nowTs]);
  const canSubmit = teamsComplete && !isSaving && !lockWindowActive;

  const handleSave = async (options?: { allowPartialTeams?: boolean }) => {
    const allowPartialTeams = options?.allowPartialTeams ?? false;
    if (
      isSaving ||
      lockWindowActive ||
      picksLoading ||
      gamesLoading ||
      (games.length === 0 && !allowPartialTeams)
    ) {
      return false;
    }
    if (!allowPartialTeams && !teamsComplete) {
      return false;
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

    let success = false;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (hasExistingPicks) {
        await updatePicks(payload);
        setPicksToast(dictionary.dashboard.toasts.picksUpdated);
      } else {
        await saveInitialPicks(payload);
        setPicksToast(dictionary.dashboard.toasts.picksSaved);
      }
      success = true;
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
    return success;
  };

  const handleMobileSave = async () => {
    const saved = await handleSave({ allowPartialTeams: mobilePicker === 'players' });
    if (saved) {
      setMobileSaveToast(
        hasExistingPicks ? dictionary.dashboard.toasts.picksUpdated : dictionary.dashboard.toasts.picksSaved,
      );
    }
  };

  useEffect(() => {
    if (!mobileSaveToast) return undefined;
    const id = window.setTimeout(() => setMobileSaveToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [mobileSaveToast]);

  useEffect(() => {
    if (!mobilePicker) {
      return undefined;
    }
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [mobilePicker]);

  const tabs: Array<{
    key: 'play' | 'myPicks' | 'winners' | 'weekly';
    label: string;
  }> = [
    { key: 'play', label: dictionary.dashboard.playTab },
    { key: 'weekly', label: dictionary.dashboard.weeklyRanking },
    { key: 'myPicks', label: dictionary.dashboard.myPicksTab },
    { key: 'winners', label: dictionary.dashboard.winnersTab },
  ];

  return (
    <>
      <div className="space-y-8 pb-16 pt-2 sm:pt-4 lg:pb-24">
      <section className="hidden space-y-3 sm:block">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-2xl font-semibold text-white">NBAnima</span>
        </div>
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <section className="flex-1 rounded-[2rem] border border-accent-gold/40 bg-navy-900/70 p-4 shadow-card sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-gold/40 bg-navy-800/70 sm:h-14 sm:w-14">
              <Coins className="h-6 w-6 text-accent-gold sm:h-7 sm:w-7" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400 sm:text-xs">
                {dictionary.dashboard.animaPoints}
              </p>
              <p className="text-xl font-semibold text-white sm:text-3xl">
                {numberFormatter.format(balance)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-gold/40 bg-navy-800/70 sm:h-14 sm:w-14">
              <Sparkles className="h-6 w-6 text-accent-gold sm:h-7 sm:w-7" />
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 sm:text-xs">
                {dictionary.dashboard.weeklyXpBalance}
              </p>
              <div className="flex min-h-[1.5rem] items-center justify-center gap-2 text-xl font-semibold text-white sm:min-h-[2.25rem] sm:text-3xl sm:justify-start">
                {weeklyXpLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-label={dictionary.common.loading} />
                ) : (
                  <span>{weeklyXpError ? '—' : numberFormatter.format(weeklyXpValue)}</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 sm:text-xs">{weeklyXpCaption}</p>
              {weeklyXpErrorMessage ? (
                <p className="text-xs text-rose-300">{weeklyXpErrorMessage}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <button
            type="button"
            onClick={() => {
              setActiveTab('weekly');
              tabsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold text-accent-gold hover:border-accent-gold transition"
          >
            {dictionary.dashboard.weeklyLeaderboardButton}
            <ArrowRight className="h-3 w-3" />
          </button>
          <Link
            href={`/${locale}/dashboard/tile-flip-game`}
            className="hidden items-center gap-2 rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold text-accent-gold transition hover:border-accent-gold sm:inline-flex"
          >
            {dictionary.tileGame.sectionTitle}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
      <Link
        href={`/${locale}/dashboard/trading-cards`}
        className="group relative hidden w-full max-w-sm self-stretch items-center gap-3 overflow-hidden rounded-xl border-[1.6px] border-[#d4af37] bg-navy-900/70 p-1 shadow-[0_0_25px_rgba(255,215,0,0.18)] transition hover:brightness-110 sm:flex sm:max-w-xs sm:p-2 lg:max-w-[320px] lg:self-center"
      >
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-accent-gold/60 bg-navy-800/80">
          <Image
            src="/NBAnimaTradingCards.png"
            alt={dictionary.tradingCards.heroImageAlt}
            fill
            sizes="72px"
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-navy-950/40" />
        </div>
        <div className="flex flex-1 flex-col gap-1 text-[10px] font-semibold text-slate-200 sm:text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            <Sparkles className="h-3 w-3 text-accent-gold sm:h-3.5 sm:w-3.5" />
            {numberFormatter.format(ownedCount)} {dictionary.tradingCards.collectionBadge}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            <Coins className="h-3 w-3 text-accent-gold sm:h-3.5 sm:w-3.5" />
            {numberFormatter.format(shopCount)} {dictionary.tradingCards.shopBadge}
          </span>
        </div>
        <span className="inline-flex items-center justify-center rounded-full border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-3 py-2 text-[11px] font-semibold text-navy-900 shadow-card transition group-hover:translate-x-1 sm:text-xs">
          {dictionary.tradingCards.ctaLabel}
        </span>
      </Link>
      </div>

      {/* Mobile lock timer */}
      <div className="sm:hidden px-1">
        <div className="mb-3 rounded-2xl border border-white/10 bg-navy-900/70 px-3 py-2 text-xs text-slate-300 shadow-card">
          {lockCountdownInfo.status === 'running' ? (
            <>
              {lockCountdownInfo.label}{' '}
              <span className="font-semibold text-white">{lockCountdownInfo.time}</span>
            </>
          ) : (
            lockCountdownInfo.label
          )}
        </div>
      </div>

      <div className="sm:hidden">
        <div className="flex snap-x gap-4 overflow-x-auto px-3 pb-3 pt-1 [-webkit-overflow-scrolling:touch]">
          <button
            type="button"
            onClick={() => openMobilePicker('teams')}
            disabled={displayGames.length === 0}
            className={clsx(
              'group relative min-w-[220px] snap-center overflow-hidden rounded-3xl border px-3.5 py-3.5 text-left shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900',
              teamsComplete
                ? 'border-lime-300/70 ring-2 ring-lime-400/60 shadow-[0_18px_60px_rgba(132,204,22,0.35)]'
                : 'border-white/10 hover:scale-[1.01] hover:border-accent-gold/50',
              displayGames.length === 0 ? 'cursor-not-allowed opacity-60' : 'active:scale-[0.99]',
            )}
            aria-pressed={mobilePicker === 'teams'}
            aria-disabled={displayGames.length === 0}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-300/60 via-teal-300/60 to-sky-400/60" />
            <div className="absolute inset-0 bg-white/5" />
            <div className="relative space-y-3 pt-12">
              <span className="absolute left-3 top-2 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                {dictionary.play.teams.rewardBadge}
              </span>
              <span
                className={clsx(
                  'absolute right-3 top-2 flex aspect-square h-7 items-center justify-center rounded-full border-2',
                  teamsComplete
                    ? 'border-lime-200 bg-lime-200/25 shadow-[0_0_16px_rgba(132,204,22,0.45)]'
                    : 'border-white/60 bg-black/15',
                )}
              >
                {teamsComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-lime-300 drop-shadow" />
                ) : (
                  <CircleDashed className="h-5 w-5 text-white/90" />
                )}
              </span>
              <div className="space-y-1">
                <p className="text-base font-semibold text-white drop-shadow">
                  {dictionary.play.teams.title}
                </p>
                <p className="text-[11px] leading-snug text-slate-100/90">
                  {dictionary.play.teams.description}
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openMobilePicker('players')}
            disabled={displayGames.length === 0}
            className={clsx(
              'group relative min-w-[220px] snap-center overflow-hidden rounded-3xl border px-3.5 py-3.5 text-left shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900',
              playersComplete
                ? 'border-lime-300/70 ring-2 ring-lime-400/60 shadow-[0_18px_60px_rgba(132,204,22,0.35)]'
                : 'border-white/10 hover:scale-[1.01] hover:border-accent-gold/50',
              displayGames.length === 0 ? 'cursor-not-allowed opacity-60' : 'active:scale-[0.99]',
            )}
            aria-pressed={mobilePicker === 'players'}
            aria-disabled={displayGames.length === 0}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-300/60 via-violet-300/60 to-sky-300/55" />
            <div className="absolute inset-0 bg-white/5" />
            <div className="relative space-y-3 pt-12">
              <span className="absolute left-3 top-2 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                {dictionary.play.players.rewardBadge}
              </span>
              <span
                className={clsx(
                  'absolute right-3 top-2 flex aspect-square h-7 items-center justify-center rounded-full border-2',
                  playersComplete
                    ? 'border-lime-200 bg-lime-200/25 shadow-[0_0_16px_rgba(132,204,22,0.45)]'
                    : 'border-white/60 bg-black/15',
                )}
              >
                {playersComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-lime-300 drop-shadow" />
                ) : (
                  <CircleDashed className="h-5 w-5 text-white/90" />
                )}
              </span>
              <div className="space-y-1">
                <p className="text-base font-semibold text-white drop-shadow">
                  {dictionary.play.players.title}
                </p>
                <p className="text-[11px] leading-snug text-slate-100/90">
                  {dictionary.play.players.description}
                </p>
              </div>
            </div>
          </button>

          <Link
            href={`/${locale}/dashboard/tile-flip-game`}
            className={clsx(
              'group relative min-w-[220px] snap-center overflow-hidden rounded-3xl border px-3.5 py-3.5 text-left shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900',
              'border-white/12 hover:scale-[1.01] hover:border-accent-gold/50 active:scale-[0.99]',
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-300/70 via-orange-400/60 to-rose-400/60" />
            <div className="absolute inset-0 bg-white/5" />
            <div className="relative space-y-3 pt-12">
              <span className="absolute left-3 top-2 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                {dictionary.tileGame.rewardPointsLabel}
              </span>
              <div className="space-y-1">
                <p className="text-base font-semibold text-white drop-shadow">
                  {dictionary.tileGame.sectionTitle}
                </p>
                <p className="text-[11px] leading-snug text-slate-100/90">
                  {dictionary.tileGame.rewardHint}
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <section
        ref={tabsSectionRef}
        className="rounded-[2rem] border border-white/10 bg-navy-900/50 p-4 shadow-card"
      >
        <div className="flex snap-x gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={clsx(
                'rounded-full border px-3 py-1 text-[10px] font-semibold transition min-h-[34px]',
                tab.key === 'play' ? 'hidden sm:inline-flex' : 'inline-flex',
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
            <div className="hidden space-y-6 sm:block">
              <header className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">
                {dictionary.play.title}
              </h2>
              <p className="text-sm text-slate-300">{dictionary.play.subtitle}</p>
              <p className="text-sm text-slate-400">{dictionary.play.multiplierHint}</p>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsTeamsOpen((previous) => !previous)}
                    className={clsx(
                      'flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition',
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

                  {isTeamsOpen ? (
                    <section className="space-y-4 rounded-2xl border border-white/10 bg-navy-900/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <SectionStatus complete={teamsComplete} />
                          <h3 className="text-lg font-semibold text-white">
                            {dictionary.play.teams.title}
                          </h3>
                        </div>
                        <span className="inline-flex items-center justify-center rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-gold">
                          {dictionary.play.teams.rewardBadge}
                        </span>
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
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsPlayersOpen((previous) => !previous)}
                    className={clsx(
                      'flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition',
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

                  {isPlayersOpen ? (
                    <section className="space-y-4 rounded-2xl border border-white/10 bg-navy-900/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <SectionStatus complete={playersComplete} />
                          <h3 className="text-lg font-semibold text-white">
                            {dictionary.play.players.title}
                          </h3>
                        </div>
                        <span className="inline-flex items-center justify-center rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-gold">
                          {dictionary.play.players.rewardBadge}
                        </span>
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
                    </section>
                  ) : null}
                </div>
              </div>

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
                <div className="text-xs text-slate-400">
                  {lockCountdownInfo.status === 'running' ? (
                    <>
                      {lockCountdownInfo.label}{' '}
                      <span className="font-semibold text-white">{lockCountdownInfo.time}</span>
                    </>
                  ) : (
                    lockCountdownInfo.label
                  )}
                </div>
                <div
                  role="status"
                  aria-live="polite"
                  className="min-h-[1.5rem] text-sm text-red-400"
                >
                  {errorMessage ?? null}
                </div>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={
                    !canSubmit || picksLoading || gamesLoading || isSaving || lockWindowActive
                  }
                  className={clsx(
                    'inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition min-h-[48px]',
                    lockWindowActive
                      ? 'cursor-not-allowed border-rose-500/60 bg-rose-500/15 text-rose-100'
                      : canSubmit
                        ? 'border-lime-400/80 bg-lime-400/20 text-lime-300 hover:bg-lime-400/30'
                        : 'border-white/10 bg-navy-800/70 text-slate-400',
                  )}
                  aria-busy={isSaving}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {lockWindowActive
                    ? dictionary.dashboard.lockWindowActive
                    : hasExistingPicks
                      ? dictionary.play.update
                      : dictionary.play.submit}
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
                          <th scope="col" className="px-3 py-2">{locale === 'it' ? 'Pos' : 'Pos'}</th>
                          <th scope="col" className="px-3 py-2">{locale === 'it' ? 'Giocatore' : 'Player'}</th>
                          <th scope="col" className="px-3 py-2 text-right">XP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {weeklyRanking.map((row, index) => {
                          const medal = medals[index];
                          return (
                            <tr key={row.user_id}>
                              <td className="px-3 py-2 text-slate-300">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-slate-200">
                                    #{index + 1}
                                  </span>
                                  {medal ? (
                                    <Medal
                                      className={clsx('h-4 w-4', medal.color)}
                                      aria-label={medal.label}
                                    />
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-navy-800/70">
                                    {row.avatar_url ? (
                                      <Image
                                        src={row.avatar_url}
                                        alt={row.full_name ?? 'Avatar'}
                                        fill
                                        sizes="32px"
                                        className="object-cover"
                                      />
                                    ) : (
                                      <UserCircle2 className="h-5 w-5 text-accent-gold" aria-hidden="true" />
                                    )}
                                  </div>
                                  <span className="text-sm font-semibold text-white">
                                    {row.full_name?.trim()?.length ? row.full_name : '—'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-white">
                                {numberFormatter.format(row.weekly_xp)}
                              </td>
                            </tr>
                          );
                        })}
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

      {mobilePicker ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeMobilePicker}
        >
          <div
            className="relative flex h-[calc(100vh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-black p-3 shadow-[0_25px_80px_rgba(0,0,0,0.7)] sm:h-[calc(100vh-2rem)] sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            {mobileSaveToast ? (
              <div className="pointer-events-none absolute inset-x-3 top-3 z-50 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-500/80 px-3 py-2 text-xs font-semibold text-white shadow-lg">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{mobileSaveToast}</span>
                </div>\n              </div>
            ) : null}
            <button
              type="button"
              onClick={closeMobilePicker}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
              aria-label={dictionary.common.cancel}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 pr-12 sm:pr-20">
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-accent-gold/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold">
                    {mobilePicker === 'teams'
                      ? dictionary.play.teams.rewardBadge
                      : dictionary.play.players.rewardBadge}
                  </div>
                  <h3 className="text-xl font-semibold text-white sm:text-2xl">
                    {mobilePicker === 'teams'
                      ? dictionary.play.teams.title
                      : dictionary.play.players.title}
                  </h3>
                  <p className="text-sm text-slate-300 sm:max-w-3xl">
                    {mobilePicker === 'teams'
                      ? dictionary.play.teams.description
                      : dictionary.play.players.description}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className={clsx(
                    'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                    mobilePicker === 'teams' ? (teamsComplete ? 'border-lime-300 bg-lime-300/20 text-lime-200' : 'border-white/10 bg-white/5 text-slate-200') : (playersComplete ? 'border-lime-300 bg-lime-300/20 text-lime-200' : 'border-white/10 bg-white/5 text-slate-200'),
                  )}>
                    <SectionStatus complete={mobilePicker === 'teams' ? teamsComplete : playersComplete} />
                    <span>{locale === 'it' ? 'Completo' : 'Complete'}</span>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                    {Math.min(mobileSlideIndex + 1, totalMobileSlides || 1)}/{totalMobileSlides || 1}
                  </span>
                  <button
                    type="button"
                    onClick={handleMobileSave}
                    disabled={
                      lockWindowActive ||
                      isSaving ||
                      picksLoading ||
                      gamesLoading ||
                      displayGames.length === 0 ||
                      (mobilePicker === 'teams' && !teamsComplete)
                    }
                    className={clsx(
                      'inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:text-sm',
                      lockWindowActive
                        ? 'cursor-not-allowed border-rose-500/60 bg-rose-500/15 text-rose-100'
                        : mobilePicker === 'teams'
                          ? teamsComplete
                            ? 'border-lime-400/80 bg-lime-400/20 text-lime-300 hover:bg-lime-400/30'
                            : 'border-white/10 bg-white/5 text-slate-300'
                          : 'border-lime-400/80 bg-lime-400/20 text-lime-300 hover:bg-lime-400/30',
                    )}
                    aria-busy={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {hasExistingPicks ? dictionary.play.update : dictionary.play.submit}
                  </button>
                </div>
              </div>

              <div className="relative flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black/60 p-3 sm:p-5">
                <div className="absolute left-2 top-1/2 flex -translate-y-1/2">
                  <button
                    type="button"
                    onClick={handleMobilePrev}
                    disabled={mobileSlideIndex === 0}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40 sm:h-11 sm:w-11"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                </div>
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2">
                  <button
                    type="button"
                    onClick={handleMobileNext}
                    disabled={mobileSlideIndex === Math.max(totalMobileSlides - 1, 0)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40 sm:h-11 sm:w-11"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </div>

                <div className="h-full overflow-y-auto pb-4" onTouchStart={handleMobileTouchStart} onTouchEnd={handleMobileTouchEnd}>
                  <div className="space-y-4 sm:space-y-5">
                    {gamesLoading && displayGames.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{dictionary.common.loading}</span>
                      </div>
                    ) : displayGames.length === 0 ? (
                      <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-200">
                        {locale === 'it'
                          ? 'Nessuna partita disponibile al momento.'
                          : 'No games available right now.'}
                      </p>
                    ) : (
                      (() => {
                        const safeIndex = Math.min(mobileSlideIndex, displayGames.length - 1);
                        const game = displayGames[safeIndex];
                        return (
                          <div className="space-y-3 sm:space-y-4">
                            {mobilePicker === 'teams' ? (
                              <GameTeamsRow
                                locale={locale}
                                game={game}
                                selection={teamSelections[game.id]}
                                onSelect={(teamId) => handleTeamsSelect(game.id, teamId)}
                              />
                            ) : (
                              <GamePlayersCard
                                locale={locale}
                              dictionary={dictionary}
                              game={game}
                              playerSelections={playerSelections[game.id] ?? {}}
                              onChange={(category, playerId) =>
                                handlePlayerSelect(game.id, category, playerId)
                              }
                              onPlayersLoaded={onPlayersLoaded}
                              onSelectOpenChange={(open) => {
                                if (mobilePicker === 'players') {
                                  setMobileSwipeLocked(open);
                                }
                              }}
                            />
                          )}
                        </div>
                      );
                    })()
                    )}
                  </div>
                </div>
              </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                  <span>
                    {locale === 'it'
                      ? 'Swipe o usa le frecce per scorrere i match.'
                      : 'Swipe or use arrows to move across games.'}
                  </span>
                  <div className="flex flex-1 items-center justify-end gap-2">
                    {Array.from({ length: Math.max(totalMobileSlides, 1) }).map((_, index) => (
                    <span
                      key={index}
                      className={clsx(
                        'h-2 rounded-full transition',
                        index === mobileSlideIndex
                          ? 'w-8 bg-accent-gold shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                          : 'w-4 bg-white/15',
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {picksToast ? (
        <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-card">
          <CheckCircle2 className="h-4 w-4" />
          <span>{picksToast}</span>
        </div>
      ) : null}
    </>
  );
}
