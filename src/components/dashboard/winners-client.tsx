'use client';

import clsx from 'clsx';
import { Loader2, RotateCw } from 'lucide-react';
import { useMemo, useState, useCallback, type ReactNode } from 'react';
import useSWR from 'swr';

import { PicksPlayersTable, type PlayerPickRow } from '@/components/picks/PicksPlayersTable';
import { PicksTeamsTable, type TeamPickRow } from '@/components/picks/PicksTeamsTable';
import { matchesTeamIdentity, formatDateNy, formatDateTimeNy } from '@/components/picks/cells';
import {
  buildLastNDatesEastern,
  toEasternYYYYMMDD,
  yesterdayInEastern,
} from '@/lib/date-us-eastern';
import type { Locale } from '@/lib/constants';
import type {
  PointsByDate,
  SlateDate,
  UserPicksResponse,
  WinnersResponse,
} from '@/lib/types-winners';
import { SlateDateSchema } from '@/lib/types-winners';
import { getTeamMetadata, type TeamMetadata } from '@/lib/teamMetadata';
import type { Dictionary } from '@/locales/dictionaries';
type RostersMap = Record<
  string,
  Array<{
    id: string;
    name: string;
  }>
>;

interface WinnersClientProps {
  locale: Locale;
  dictionary: Dictionary;
}

function ResponsiveTable({
  headers,
  children,
}: {
  headers: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10 bg-navy-900/60 touch-scroll">
      <table className="min-w-full text-sm text-left text-slate-200">
        {headers}
        {children}
      </table>
    </div>
  );
}

function MobileList({ children }: { children: ReactNode }) {
  return <ul className="md:hidden flex flex-col gap-3">{children}</ul>;
}

const resolveOutcomeDisplay = (value?: string | null) => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'win' || normalized === 'won') {
    return { label: '✓ Win', className: 'text-emerald-300' };
  }
  if (normalized === 'loss' || normalized === 'lost') {
    return { label: '✗ Loss', className: 'text-rose-300' };
  }
  if (normalized === 'pending') {
    return { label: '• Pending', className: 'text-amber-300' };
  }
  if (normalized === 'push') {
    return { label: 'Push', className: 'text-slate-200' };
  }
  return { label: '—', className: 'text-slate-400' };
};

const createFetcher =
  (init?: RequestInit) =>
  async ([url, date]: [string, SlateDate]) => {
    const params = new URLSearchParams({ date });
    const response = await fetch(`${url}?${params.toString()}`, {
      cache: 'no-store',
      ...init,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? 'Request failed');
    }
    return response.json();
  };

const fetcher = createFetcher();
const authFetcher = createFetcher({ credentials: 'include' });
const fetchRosters = async (): Promise<RostersMap> => {
  const response = await fetch('/rosters.json', { cache: 'force-cache', credentials: 'omit' });
  if (!response.ok) {
    throw new Error('Failed to load rosters.json');
  }
  return response.json();
};

const formatSlateLabel = (locale: Locale, slate: SlateDate) => {
  try {
    const formatter = new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return formatter.format(new Date(`${slate}T00:00:00-05:00`));
  } catch {
    return slate;
  }
};

type TeamDisplay = {
  id: string | null;
  name: string | null;
  abbreviation: string | null;
};

const buildTeamDisplay = (
  meta: TeamMetadata | null | undefined,
  fallbackName?: string | null,
  fallbackAbbr?: string | null,
) : TeamDisplay => {
  const id = meta?.id ?? null;
  const derivedName =
    meta && meta.name && id && meta.name !== id ? meta.name : null;
  const name = derivedName ?? fallbackName ?? (id ?? null);
  const abbreviation = meta?.abbreviation ?? fallbackAbbr ?? null;

  return {
    id,
    name,
    abbreviation,
  };
};

const slugIdToName = (value: string) => {
  const parts = value
    .split('-')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return value;
  }

  const maybePos = parts[parts.length - 1];
  const maybeNumber = parts[parts.length - 2];
  const hasPos = maybePos && maybePos.length === 1 && /[a-z]/i.test(maybePos);
  const hasNumber = maybeNumber && /^\d+$/.test(maybeNumber);

  const coreParts = parts.slice(0, parts.length - (hasPos ? 1 : 0));
  const numberPart = hasNumber ? coreParts.pop() ?? maybeNumber : null;

  const titleCased = coreParts
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

  const rebuilt = [titleCased, numberPart].filter(Boolean).join(' ').trim();
  return rebuilt || value;
};

const formatUuidAsName = () => 'Unknown Player';
const isUuidLike = (value: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

const ErrorBanner = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
    <span>{message}</span>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
    >
      <RotateCw className="h-3.5 w-3.5" />
      Retry
    </button>
  </div>
);

const LoadingGrid = ({ count }: { count: number }) => (
  <div className="grid gap-4 md:grid-cols-2">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="h-28 animate-pulse rounded-2xl border border-white/10 bg-navy-900/40"
      />
    ))}
  </div>
);

const LoadingTable = () => (
  <div className="animate-pulse rounded-2xl border border-white/10 bg-navy-900/40 p-6 text-sm text-slate-300">
    Loading…
  </div>
);

const getCategoryLabel = (
  dictionary: Dictionary,
  category: string,
) =>
  dictionary.play.players.categories[
    category as keyof Dictionary['play']['players']['categories']
  ] ?? category;

export const WinnersClient = ({ locale, dictionary }: WinnersClientProps) => {
  const fallbackDate = useMemo(() => toEasternYYYYMMDD(yesterdayInEastern()), []);

  const dateOptions = useMemo(() => {
    const base = buildLastNDatesEastern(14);
    return base.includes(fallbackDate) ? base : [fallbackDate, ...base];
  }, [fallbackDate]);

  const [selectedDate, setSelectedDate] = useState<SlateDate>(dateOptions[0] ?? fallbackDate);

  const winnersKey = useMemo(() => ['/api/winners', selectedDate] as const, [selectedDate]);
  const picksKey = useMemo(() => ['/api/picks', selectedDate] as const, [selectedDate]);
  const pointsKey = useMemo(
    () => ['/api/points-by-date', selectedDate] as const,
    [selectedDate],
  );

  const {
    data: winners,
    error: winnersError,
    isLoading: winnersLoading,
    mutate: reloadWinners,
  } = useSWR<WinnersResponse>(winnersKey, fetcher, { revalidateOnFocus: false });

  const {
    data: picks,
    error: picksError,
    isLoading: picksLoading,
    mutate: reloadPicks,
  } = useSWR<UserPicksResponse>(picksKey, authFetcher, { revalidateOnFocus: false });

  const {
    data: points,
    error: pointsError,
    isLoading: pointsLoading,
    mutate: reloadPoints,
  } = useSWR<PointsByDate>(pointsKey, authFetcher, { revalidateOnFocus: false });

  const { data: rosters } = useSWR<RostersMap>('local-rosters-map', fetchRosters, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const hasResults =
    (winners?.teams?.length ?? 0) > 0 || (winners?.players?.length ?? 0) > 0;

  const teamWinnersByGameId = useMemo(() => {
    const map = new Map<string, WinnersResponse['teams'][number]>();
    (winners?.teams ?? []).forEach((team) => {
      map.set(team.game_id, team);
    });
    return map;
  }, [winners?.teams]);

  const playerWinnersByKey = useMemo(() => {
    const map = new Map<string, WinnersResponse['players'][number]>();
    (winners?.players ?? []).forEach((player) => {
      map.set(`${player.game_id}:${player.category}`, player);
    });
    return map;
  }, [winners?.players]);

  const teamSelections = useMemo(() => picks?.teamPicks ?? [], [picks]);
  const playerSelections = useMemo(() => picks?.playerPicks ?? [], [picks]);

  const knownTeams = useMemo(() => {
    const map = new Map<string, TeamDisplay>();
    const register = (id?: string | null, name?: string | null, abbr?: string | null) => {
      if (!id) {
        return;
      }
      const existing = map.get(id) ?? { id, name: null, abbreviation: null };
      if (name && (!existing.name || existing.name === id)) {
        existing.name = name;
      }
      if (abbr && !existing.abbreviation) {
        existing.abbreviation = abbr;
      }
      map.set(id, existing);
    };

    (winners?.teams ?? []).forEach((team) => {
      register(team.home_team_id, team.home_team_name, team.home_team_abbr);
      register(team.away_team_id, team.away_team_name, team.away_team_abbr);
      register(team.winner_team_id, team.winner_team_name, team.winner_team_abbr);
    });

    teamSelections.forEach((pick) => {
      register(pick.selected_team_id, pick.selected_team_name ?? null, pick.selected_team_abbr ?? null);
      const game = (pick.game as TeamPickRow['game']) ?? null;
      if (game) {
        register(game.home_team_id ?? null, game.home_team_name ?? null, game.home_team_abbr ?? null);
        register(game.away_team_id ?? null, game.away_team_name ?? null, game.away_team_abbr ?? null);
      }
    });

    playerSelections.forEach((pick) => {
      const game = (pick.game as PlayerPickRow['game']) ?? null;
      if (game) {
        register(game.home_team_id ?? null, game.home_team_name ?? null, game.home_team_abbr ?? null);
        register(game.away_team_id ?? null, game.away_team_name ?? null, game.away_team_abbr ?? null);
      }
    });

    return map;
  }, [winners?.teams, teamSelections, playerSelections]);

  const rosterNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (rosters) {
      Object.values(rosters).forEach((players) => {
        players.forEach((player) => {
          const name = player?.name?.trim();
          if (player?.id && name && !map.has(player.id)) {
            map.set(player.id, name);
            map.set(player.id.toLowerCase(), name);
          }
        });
      });
    }
    return map;
  }, [rosters]);

  const resolveTeamDisplay = useCallback(
    (teamId?: string | null, fallbackName?: string | null, fallbackAbbr?: string | null): TeamDisplay => {
      if (!teamId) {
        return {
          id: null,
          name: fallbackName ?? null,
          abbreviation: fallbackAbbr ?? null,
        };
      }

      const entry = knownTeams.get(teamId);
      if (entry) {
        const nameCandidate =
          (entry.name && entry.name !== teamId ? entry.name : null) ??
          fallbackName ??
          entry.name ??
          teamId;
        return {
          id: teamId,
          name: nameCandidate,
          abbreviation: entry.abbreviation ?? fallbackAbbr ?? null,
        };
      }

      return buildTeamDisplay(getTeamMetadata(teamId), fallbackName, fallbackAbbr);
    },
    [knownTeams],
  );

  const resolvePlayerName = useCallback(
    (
      playerId?: string | null,
      firstName?: string | null,
      lastName?: string | null,
      providerId?: string | null,
    ) => {
      const rosterName = providerId
        ? rosterNameById.get(providerId) ?? rosterNameById.get(providerId.toLowerCase()) ?? null
        : null;
      let rosterFirst = '';
      let rosterLast = '';
      if (rosterName) {
        const parts = rosterName.split(/\s+/).filter(Boolean);
        if (parts.length > 0) {
          rosterFirst = parts[0] ?? '';
          rosterLast = parts.slice(1).join(' ');
        } else {
          rosterFirst = rosterName;
          rosterLast = '';
        }
      }

      let resolvedFirst = rosterFirst;
      let resolvedLast = rosterLast;

      const looksLikeId = (value: string) => value.includes('-');
      const trimmedFirstRaw = (firstName ?? '').trim();
      const trimmedLastRaw = (lastName ?? '').trim();
      const trimmedFirst = looksLikeId(trimmedFirstRaw) ? '' : trimmedFirstRaw;
      const trimmedLast = looksLikeId(trimmedLastRaw) ? '' : trimmedLastRaw;
      if (!resolvedFirst && trimmedFirst) {
        resolvedFirst = trimmedFirst;
      }
      if (!resolvedLast && trimmedLast) {
        resolvedLast = trimmedLast;
      }
      if (!resolvedFirst && !resolvedLast) {
        resolvedFirst = trimmedFirst;
        resolvedLast = trimmedLast;
      }

      if (!rosterName && providerId && !isUuidLike(providerId)) {
        const slugName = slugIdToName(providerId);
        if (!resolvedFirst && !resolvedLast && slugName) {
          const slugParts = slugName.split(' ').filter(Boolean);
          resolvedFirst = slugParts.shift() ?? slugName;
          resolvedLast = slugParts.join(' ');
        }
      }

      if (!rosterName && playerId) {
        const uuidFormatted = formatUuidAsName();
        if (!resolvedFirst && !resolvedLast) {
          resolvedFirst = uuidFormatted;
          resolvedLast = '';
        }
      }

      const builtName = `${resolvedFirst} ${resolvedLast}`.trim();
      const fallbackSource = rosterName ?? (providerId && !isUuidLike(providerId) ? slugIdToName(providerId) : null);
      const fullName = fallbackSource ?? (builtName || playerId || '—');

      return {
        fullName,
        firstName: resolvedFirst || (rosterFirst || ''),
        lastName: resolvedLast || (rosterLast || ''),
      };
    },
    [rosterNameById],
  );

  const teamSelectionsByGameId = useMemo(() => {
    const map = new Map<string, (typeof teamSelections)[number]>();
    teamSelections.forEach((pick) => {
      if (!map.has(pick.game_id)) {
        map.set(pick.game_id, pick);
      }
    });
    return map;
  }, [teamSelections]);

  const playerSelectionsByKey = useMemo(() => {
    const map = new Map<string, (typeof playerSelections)[number]>();
    playerSelections.forEach((pick) => {
      const key = `${pick.game_id}:${pick.category}`;
      if (!map.has(key)) {
        map.set(key, pick);
      }
    });
    return map;
  }, [playerSelections]);

  const teamOutcomes = useMemo(() => {
    const map = new Map<string, 'win' | 'loss' | 'pending'>();
    teamSelections.forEach((pick) => {
      const winner = teamWinnersByGameId.get(pick.game_id);
      if (!winner || !winner.winner_team_id) {
        map.set(pick.game_id, 'pending');
        return;
      }
      const winningMeta = {
        id: winner.winner_team_id,
        abbr: winner.winner_team_abbr ?? null,
        name: winner.winner_team_name ?? null,
      };
      const selectedMeta = {
        id: pick.selected_team_id,
        abbr: pick.selected_team_abbr ?? null,
        name: pick.selected_team_name ?? null,
      };
      const isWin = matchesTeamIdentity(selectedMeta, winningMeta);
      map.set(pick.game_id, isWin ? 'win' : 'loss');
    });
    return map;
  }, [teamSelections, teamWinnersByGameId]);

  const playerOutcomes = useMemo(() => {
    const map = new Map<string, 'win' | 'loss' | 'pending'>();
    playerSelections.forEach((pick) => {
      const key = `${pick.game_id}:${pick.category}`;
      const winner = playerWinnersByKey.get(key);
      if (!winner) {
        map.set(key, 'pending');
        return;
      }
      map.set(key, winner.player_id === pick.player_id ? 'win' : 'loss');
    });
    return map;
  }, [playerSelections, playerWinnersByKey]);

  const teamSummaryCards = useMemo(() => {
    return (winners?.teams ?? []).map((team) => {
      const homeMeta = team.home_team_id ? getTeamMetadata(team.home_team_id) : undefined;
      const awayMeta = team.away_team_id ? getTeamMetadata(team.away_team_id) : undefined;
      const winnerMeta = team.winner_team_id ? getTeamMetadata(team.winner_team_id) : undefined;
      const userPick = teamSelectionsByGameId.get(team.game_id);
      const userPickMeta = userPick?.selected_team_id
        ? getTeamMetadata(userPick.selected_team_id)
        : undefined;
      const status = userPick ? teamOutcomes.get(team.game_id) ?? 'pending' : 'pending';

      const homeDisplay = resolveTeamDisplay(team.home_team_id, team.home_team_name, team.home_team_abbr);
      const awayDisplay = resolveTeamDisplay(team.away_team_id, team.away_team_name, team.away_team_abbr);
      const winnerDisplay = resolveTeamDisplay(
        team.winner_team_id ?? null,
        team.winner_team_name,
        team.winner_team_abbr,
      );
      const pickDisplay = resolveTeamDisplay(
        userPick?.selected_team_id ?? null,
        userPick?.selected_team_name ?? null,
        userPick?.selected_team_abbr ?? null,
      );

      return {
        team,
        homeMeta,
        awayMeta,
        winnerMeta,
        userPick,
        userPickMeta,
        status,
        homeDisplay,
        awayDisplay,
        winnerDisplay,
        pickDisplay,
      };
    });
  }, [winners?.teams, teamSelectionsByGameId, teamOutcomes, resolveTeamDisplay]);

  const playerSummaryCards = useMemo(() => {
    return (winners?.players ?? []).map((player) => {
      const key = `${player.game_id}:${player.category}`;
      const userPick = playerSelectionsByKey.get(key);
      const status = userPick ? playerOutcomes.get(key) ?? 'pending' : 'pending';
      const winnerTeamMeta = player.team_id ? getTeamMetadata(player.team_id) : undefined;
      const userPickTeamMeta = userPick?.team_id ? getTeamMetadata(userPick.team_id) : undefined;
      const winnerTeamDisplay = resolveTeamDisplay(
        player.team_id ?? null,
        winnerTeamMeta?.name ?? null,
        winnerTeamMeta?.abbreviation ?? null,
      );
      const userPickTeamDisplay = resolveTeamDisplay(
        userPick?.team_id ?? null,
        userPickTeamMeta?.name ?? null,
        userPickTeamMeta?.abbreviation ?? null,
      );
      const winnerNameInfo = resolvePlayerName(
        player.player_id,
        player.first_name,
        player.last_name,
        player.provider_player_id ?? null,
      );
      const userPickNameInfo = userPick
        ? resolvePlayerName(
            userPick.player_id,
            userPick.first_name ?? null,
            userPick.last_name ?? null,
            userPick.provider_player_id ?? null,
          )
        : null;

      return {
        player,
        status,
        userPick,
        winnerTeamDisplay,
        userPickTeamDisplay,
        winnerNameInfo,
        userPickNameInfo,
      };
    });
  }, [winners?.players, playerSelectionsByKey, playerOutcomes, resolveTeamDisplay, resolvePlayerName]);

  const pickDate = picks?.date ?? selectedDate;
  const changeCount = picks?.changesCount ?? null;

  const teamTableRows = useMemo<TeamPickRow[]>(() => {
    return teamSelections.map((pick) => {
      const status = teamOutcomes.get(pick.game_id) ?? 'pending';
      const game = (pick.game as TeamPickRow['game']) ?? null;

      let fallbackName = pick.selected_team_name ?? null;
      let fallbackAbbr = pick.selected_team_abbr ?? null;

      if ((!fallbackName || fallbackName === pick.selected_team_id) && game) {
        const homeIdentity = {
          id: game.home_team_id ?? null,
          abbr: game.home_team_abbr ?? null,
        };
        const awayIdentity = {
          id: game.away_team_id ?? null,
          abbr: game.away_team_abbr ?? null,
        };
        const selectedIdentity = {
          id: pick.selected_team_id ?? null,
          abbr: pick.selected_team_abbr ?? null,
        };
        if (matchesTeamIdentity(selectedIdentity, homeIdentity)) {
          fallbackName = game.home_team_name ?? fallbackName;
          fallbackAbbr = game.home_team_abbr ?? fallbackAbbr;
        } else if (matchesTeamIdentity(selectedIdentity, awayIdentity)) {
          fallbackName = game.away_team_name ?? fallbackName;
          fallbackAbbr = game.away_team_abbr ?? fallbackAbbr;
        }
      }

      const display = resolveTeamDisplay(
        pick.selected_team_id ?? null,
        fallbackName,
        fallbackAbbr,
      );

      return {
        game_id: pick.game_id,
        selected_team_id: pick.selected_team_id,
        selected_team_abbr: display.abbreviation,
        selected_team_name:
          display.name && display.name !== pick.selected_team_id
            ? display.name
            : fallbackName ?? pick.selected_team_id,
        pick_date: pickDate,
        result: status,
        changes_count: changeCount,
        game,
      };
    });
  }, [teamSelections, teamOutcomes, pickDate, changeCount, resolveTeamDisplay]);

  const playerTableRows = useMemo<PlayerPickRow[]>(() => {
    return playerSelections.map((pick) => {
      const teamDisplay = resolveTeamDisplay(
        pick.team_id ?? null,
        null,
        null,
      );
      const key = `${pick.game_id}:${pick.category}`;
      const status = playerOutcomes.get(key) ?? 'pending';
      const nameInfo = resolvePlayerName(
        pick.player_id,
        pick.first_name ?? null,
        pick.last_name ?? null,
        pick.provider_player_id ?? null,
      );
      return {
        game_id: pick.game_id,
        category: pick.category,
        player_id: pick.player_id,
        provider_player_id: pick.provider_player_id ?? null,
        pick_date: pickDate,
        result: status,
        changes_count: changeCount,
        player: {
          first_name: nameInfo.firstName || null,
          last_name: nameInfo.lastName || null,
          position: pick.position ?? null,
          team_abbr: teamDisplay.abbreviation ?? teamDisplay.name ?? null,
        },
        game: (pick.game as PlayerPickRow['game']) ?? null,
      };
    });
  }, [playerSelections, pickDate, changeCount, resolveTeamDisplay, playerOutcomes, resolvePlayerName]);

  const pointsValue = points?.total_points ?? (points as { total?: number } | undefined)?.total ?? 0;
  const slateDisplay = formatSlateLabel(locale, selectedDate);

  return (
    <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 py-4 md:py-6">
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 md:mx-0 bg-navy-950/80 backdrop-blur supports-[backdrop-filter]:bg-navy-950/60">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 py-3">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold text-white">
              {dictionary.dashboard.winners.title}
            </h2>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <span>{dictionary.dashboard.winners.dateLabel}</span>
              <select
                value={selectedDate}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  const parsed = SlateDateSchema.safeParse(nextValue);
                  if (parsed.success) {
                    setSelectedDate(parsed.data);
                  }
                }}
                className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
              >
                {dateOptions.map((dateOption) => (
                  <option key={dateOption} value={dateOption}>
                    {formatSlateLabel(locale, dateOption as SlateDate)}
                  </option>
                ))}
              </select>
            </label>
          </header>
        </div>
      </div>

      <div className="space-y-6 pt-4 md:pt-6">
        {winnersLoading ? (
          <LoadingGrid count={4} />
        ) : winnersError ? (
          <ErrorBanner
            message={(winnersError as Error).message ?? 'Failed to load winners.'}
            onRetry={() => {
              void reloadWinners();
            }}
          />
        ) : hasResults ? (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-white">
                {dictionary.play.teams.title}
              </h3>
              <ResponsiveTable
                headers={
                  <thead className="bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Matchup</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Winner</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">
                        {dictionary.dashboard.winners.myPick}
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Esito</th>
                    </tr>
                  </thead>
                }
              >
                <tbody className="divide-y divide-white/10 text-sm text-slate-200">
                  {teamSummaryCards.map((summary) => {
                    const homeAbbr =
                      summary.homeDisplay.abbreviation ??
                      summary.homeDisplay.name ??
                      'HOME';
                    const awayAbbr =
                      summary.awayDisplay.abbreviation ??
                      summary.awayDisplay.name ??
                      'AWAY';
                    const homeName =
                      summary.homeDisplay.name ?? summary.homeDisplay.abbreviation ?? 'Home Team';
                    const awayName =
                      summary.awayDisplay.name ?? summary.awayDisplay.abbreviation ?? 'Away Team';
                    const winnerName = summary.winnerDisplay.name ?? '—';
                    const winnerAbbr = summary.winnerDisplay.abbreviation ?? '—';
                    const pickName = summary.pickDisplay.name ?? '—';
                    const pickAbbr = summary.pickDisplay.abbreviation ?? '—';
                    const outcome = resolveOutcomeDisplay(summary.status);
                    return (
                      <tr key={summary.team.game_id}>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {awayAbbr} @ {homeAbbr}
                            </span>
                            <span className="text-xs text-slate-400">
                              {awayName} · {homeName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-white">{winnerName}</div>
                          <div className="text-xs text-slate-400">{winnerAbbr}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-white">{pickName}</div>
                          <div className="text-xs text-slate-400">{pickAbbr}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={clsx('font-semibold', outcome.className)}>
                            {outcome.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </ResponsiveTable>
              <MobileList>
                {teamSummaryCards.map((summary, index) => {
                  const homeAbbr =
                    summary.homeDisplay.abbreviation ??
                    summary.homeDisplay.name ??
                    'HOME';
                  const awayAbbr =
                    summary.awayDisplay.abbreviation ??
                    summary.awayDisplay.name ??
                    'AWAY';
                  const homeName =
                    summary.homeDisplay.name ?? summary.homeDisplay.abbreviation ?? 'Home Team';
                  const awayName =
                    summary.awayDisplay.name ?? summary.awayDisplay.abbreviation ?? 'Away Team';
                  const winnerName = summary.winnerDisplay.name ?? '—';
                  const winnerAbbr = summary.winnerDisplay.abbreviation ?? '—';
                  const pickName = summary.pickDisplay.name ?? '—';
                  const pickAbbr = summary.pickDisplay.abbreviation ?? '—';
                  const outcome = resolveOutcomeDisplay(summary.status);
                  return (
                    <li
                      key={`team-winner-${summary.team.game_id}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {awayAbbr}
                            </span>
                            <span className="text-[11px] uppercase text-slate-500">
                              vs
                            </span>
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {homeAbbr}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {awayName} @ {homeName}
                          </p>
                        </div>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {outcome.label}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-slate-200">
                        <p>
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            Scelta:
                          </span>{' '}
                          <span className="font-semibold text-white">
                            {pickName}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">{pickAbbr}</span>
                        </p>
                        <p>
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            Esito:
                          </span>{' '}
                          <span className={clsx('font-semibold', outcome.className)}>
                            {outcome.label}
                          </span>
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {slateDisplay} · Changes: {changeCount ?? 0} · Winner:{' '}
                        {winnerAbbr !== '—' ? winnerAbbr : winnerName}
                      </p>
                    </li>
                  );
                })}
              </MobileList>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-white">
                {dictionary.play.players.title}
              </h3>
              <ResponsiveTable
                headers={
                  <thead className="bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Matchup</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Categoria</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Winner</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">
                        {dictionary.dashboard.winners.myPick}
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Esito</th>
                    </tr>
                  </thead>
                }
              >
                <tbody className="divide-y divide-white/10 text-sm text-slate-200">
                  {playerSummaryCards.map((summary) => {
                    const userGame = summary.userPick?.game ?? null;
                    const homeAbbr =
                      userGame?.home_team_abbr ??
                      summary.userPickTeamDisplay.abbreviation ??
                      summary.winnerTeamDisplay.abbreviation ??
                      'HOME';
                    const awayAbbr =
                      userGame?.away_team_abbr ??
                      summary.userPickTeamDisplay.abbreviation ??
                      'AWY';
                    const homeName =
                      userGame?.home_team_name ??
                      summary.userPickTeamDisplay.name ??
                      summary.winnerTeamDisplay.name ??
                      'Home Team';
                    const awayName =
                      userGame?.away_team_name ??
                      summary.userPickTeamDisplay.name ??
                      'Away Team';
                    const winnerName =
                      summary.winnerNameInfo?.fullName ?? summary.player.player_id;
                    const winnerTeam =
                      summary.winnerTeamDisplay.abbreviation ?? summary.winnerTeamDisplay.name ?? '—';
                    const pickName =
                      summary.userPickNameInfo?.fullName ?? summary.userPick?.player_id ?? '—';
                    const pickTeam =
                      summary.userPickTeamDisplay.abbreviation ??
                      summary.userPickTeamDisplay.name ??
                      '—';
                    const outcome = resolveOutcomeDisplay(summary.status);
                    return (
                      <tr key={`${summary.player.game_id}-${summary.player.category}`}>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {awayAbbr?.toUpperCase()} @ {homeAbbr?.toUpperCase()}
                            </span>
                            <span className="text-xs text-slate-400">
                              {awayName} · {homeName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs uppercase tracking-wide text-slate-400">
                          {getCategoryLabel(dictionary, summary.player.category)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-white">{winnerName}</div>
                          <div className="text-xs text-slate-400">{winnerTeam}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-white">{pickName}</div>
                          <div className="text-xs text-slate-400">{pickTeam}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={clsx('font-semibold', outcome.className)}>
                            {outcome.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </ResponsiveTable>
              <MobileList>
                {playerSummaryCards.map((summary, index) => {
                  const userGame = summary.userPick?.game ?? null;
                  const homeAbbr =
                    userGame?.home_team_abbr ??
                    summary.userPickTeamDisplay.abbreviation ??
                    summary.winnerTeamDisplay.abbreviation ??
                    'HOME';
                  const awayAbbr =
                    userGame?.away_team_abbr ??
                    summary.userPickTeamDisplay.abbreviation ??
                    'AWY';
                  const homeName =
                    userGame?.home_team_name ??
                    summary.userPickTeamDisplay.name ??
                    summary.winnerTeamDisplay.name ??
                    'Home Team';
                  const awayName =
                    userGame?.away_team_name ??
                    summary.userPickTeamDisplay.name ??
                    'Away Team';
                  const winnerName =
                    summary.winnerNameInfo?.fullName ?? summary.player.player_id;
                  const winnerTeam =
                    summary.winnerTeamDisplay.abbreviation ?? summary.winnerTeamDisplay.name ?? '—';
                  const pickName =
                    summary.userPickNameInfo?.fullName ?? summary.userPick?.player_id ?? '—';
                  const pickTeam =
                    summary.userPickTeamDisplay.abbreviation ??
                    summary.userPickTeamDisplay.name ??
                    '—';
                  const categoryLabel = getCategoryLabel(dictionary, summary.player.category);
                  const outcome = resolveOutcomeDisplay(summary.status);
                  return (
                    <li
                      key={`player-winner-${summary.player.game_id}-${summary.player.category}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {awayAbbr?.toUpperCase()}
                            </span>
                            <span className="text-[11px] uppercase text-slate-500">
                              vs
                            </span>
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {homeAbbr?.toUpperCase()}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {awayName} @ {homeName}
                          </p>
                        </div>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {categoryLabel}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-slate-200">
                        <p>
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            Scelta:
                          </span>{' '}
                          <span className="font-semibold text-white">{pickName}</span>
                          <span className="ml-2 text-xs text-slate-400">{pickTeam}</span>
                        </p>
                        <p>
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            Esito:
                          </span>{' '}
                          <span className={clsx('font-semibold', outcome.className)}>
                            {outcome.label}
                          </span>
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {slateDisplay} · Changes: {changeCount ?? 0} · Winner: {winnerTeam} · {winnerName}
                      </p>
                    </li>
                  );
                })}
              </MobileList>
            </section>
          </div>
        ) : (
          <p className="text-sm text-slate-300">{dictionary.dashboard.winners.empty}</p>
        )}

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-white">
            {dictionary.dashboard.winners.myPick}
          </h3>
          {picksLoading ? (
            <LoadingTable />
          ) : picksError ? (
            <ErrorBanner
              message={(picksError as Error).message ?? 'Failed to load picks.'}
              onRetry={() => {
                void reloadPicks();
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="hidden gap-4 md:grid md:grid-cols-2">
                <PicksTeamsTable
                  className="h-full"
                  title={dictionary.play.teams.title}
                  rows={teamTableRows}
                  emptyMessage={dictionary.dashboard.winners.empty}
                  showDateColumn={false}
                  showChangesColumn={false}
                  showTimestampsColumn={false}
                />
                <PicksPlayersTable
                  className="h-full"
                  title={dictionary.play.players.title}
                  rows={playerTableRows}
                  emptyMessage={dictionary.dashboard.winners.empty}
                  formatCategory={(category) => getCategoryLabel(dictionary, category)}
                  showDateColumn={false}
                  showChangesColumn={false}
                  showTimestampsColumn={false}
                  showOutcomeColumn
                />
              </div>
              <div className="space-y-4 md:hidden">
                <div className="space-y-2">
                  <h4 className="text-base font-semibold text-white">
                    {dictionary.play.teams.title}
                  </h4>
                  <MobileList>
                    {teamTableRows.map((row, index) => {
                      const homeAbbr = (row.game?.home_team_abbr ?? 'HOME').toUpperCase();
                      const awayAbbr = (row.game?.away_team_abbr ?? 'AWY').toUpperCase();
                      const homeName =
                        row.game?.home_team_name ?? row.selected_team_name ?? 'Home Team';
                      const awayName =
                        row.game?.away_team_name ?? row.selected_team_name ?? 'Away Team';
                      const selectionLabel =
                        row.selected_team_name ??
                        row.selected_team_abbr ??
                        row.selected_team_id ??
                        '—';
                      const outcome = resolveOutcomeDisplay(row.result);
                      return (
                        <li
                          key={`team-pick-${row.game_id ?? 'unknown'}-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {awayAbbr}
                            </span>
                            <span className="text-[11px] uppercase text-slate-500">
                              vs
                            </span>
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {homeAbbr}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {awayName} @ {homeName}
                          </p>
                          <div className="mt-3 space-y-1 text-sm text-slate-200">
                            <p>
                              <span className="text-xs uppercase tracking-wide text-slate-400">
                                Scelta:
                              </span>{' '}
                              <span className="font-semibold text-white">
                                {selectionLabel}
                              </span>
                            </p>
                            <p>
                              <span className="text-xs uppercase tracking-wide text-slate-400">
                                Esito:
                              </span>{' '}
                              <span className={clsx('font-semibold', outcome.className)}>
                                {outcome.label}
                              </span>
                            </p>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">
                            {formatDateNy(row.pick_date)} · Changes: {row.changes_count ?? 0} · Updated: {formatDateTimeNy(row.updated_at)}
                          </p>
                        </li>
                      );
                    })}
                  </MobileList>
                </div>
                <div className="space-y-2">
                  <h4 className="text-base font-semibold text-white">
                    {dictionary.play.players.title}
                  </h4>
                  <MobileList>
                    {playerTableRows.map((row, index) => {
                      const homeAbbr = (row.game?.home_team_abbr ?? 'HOME').toUpperCase();
                      const awayAbbr = (row.game?.away_team_abbr ?? 'AWY').toUpperCase();
                      const homeName = row.game?.home_team_name ?? 'Home Team';
                      const awayName = row.game?.away_team_name ?? 'Away Team';
                      const playerName = (() => {
                        const first = row.player?.first_name?.trim() ?? '';
                        const last = row.player?.last_name?.trim() ?? '';
                        const combined = `${first} ${last}`.trim();
                        return combined || row.player_id || '—';
                      })();
                      const categoryLabel = getCategoryLabel(dictionary, row.category);
                      const outcome = resolveOutcomeDisplay(row.result);
                      return (
                        <li
                          key={`player-pick-${row.game_id ?? 'unknown'}-${row.category}-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {awayAbbr}
                            </span>
                            <span className="text-[11px] uppercase text-slate-500">
                              vs
                            </span>
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {homeAbbr}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {awayName} @ {homeName}
                          </p>
                          <div className="mt-3 space-y-1 text-sm text-slate-200">
                            <p>
                              <span className="text-xs uppercase tracking-wide text-slate-400">
                                Scelta:
                              </span>{' '}
                              <span className="font-semibold text-white">{playerName}</span>
                              <span className="ml-2 text-xs text-slate-400">{categoryLabel}</span>
                            </p>
                            <p>
                              <span className="text-xs uppercase tracking-wide text-slate-400">
                                Esito:
                              </span>{' '}
                              <span className={clsx('font-semibold', outcome.className)}>
                                {outcome.label}
                              </span>
                            </p>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">
                            {formatDateNy(row.pick_date)} · Changes: {row.changes_count ?? 0} · Updated: {formatDateTimeNy(row.updated_at)}
                          </p>
                        </li>
                      );
                    })}
                  </MobileList>
                </div>
              </div>
            </div>
          )}
        </section>

        <footer className="rounded-2xl border border-accent-gold/30 bg-navy-900/60 p-4 shadow-card">
          {pointsLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{dictionary.common.loading}</span>
            </div>
          ) : pointsError ? (
            <ErrorBanner
              message={(pointsError as Error).message ?? 'Failed to load points.'}
              onRetry={() => {
                void reloadPoints();
              }}
            />
          ) : (
            <p className="text-sm text-slate-300">
              {dictionary.dashboard.winners.pointsOfDay}:{' '}
              <span className="font-semibold text-white">{pointsValue}</span>
            </p>
          )}
        </footer>
      </div>
    </div>
  );

};
