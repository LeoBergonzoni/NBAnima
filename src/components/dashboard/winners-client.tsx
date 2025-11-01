'use client';

import clsx from 'clsx';
import { Loader2, RotateCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { PicksPlayersTable, type PlayerPickRow } from '@/components/picks/PicksPlayersTable';
import { PicksTeamsTable, type TeamPickRow } from '@/components/picks/PicksTeamsTable';
import { matchesTeamIdentity } from '@/components/picks/cells';
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
import { getTeamMetadata } from '@/lib/teamMetadata';
import type { Dictionary } from '@/locales/dictionaries';

interface WinnersClientProps {
  locale: Locale;
  dictionary: Dictionary;
}

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

const statusBadge = (status: 'win' | 'loss' | 'pending') => {
  switch (status) {
    case 'win':
      return {
        label: 'WIN',
        className:
          'rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200',
      };
    case 'loss':
      return {
        label: 'LOSS',
        className:
          'rounded-full border border-rose-400/40 bg-rose-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200',
      };
    default:
      return {
        label: 'PENDING',
        className:
          'rounded-full border border-slate-400/40 bg-slate-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200',
      };
  }
};

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
        // eslint-disable-next-line react/no-array-index-key
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

  const teamSelections = picks?.teamPicks ?? [];
  const playerSelections = picks?.playerPicks ?? [];

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

      return {
        team,
        homeMeta,
        awayMeta,
        winnerMeta,
        userPick,
        userPickMeta,
        status,
      };
    });
  }, [winners?.teams, teamSelectionsByGameId, teamOutcomes]);

  const playerSummaryCards = useMemo(() => {
    return (winners?.players ?? []).map((player) => {
      const key = `${player.game_id}:${player.category}`;
      const userPick = playerSelectionsByKey.get(key);
      const status = userPick ? playerOutcomes.get(key) ?? 'pending' : 'pending';
      const winnerTeamMeta = player.team_id ? getTeamMetadata(player.team_id) : undefined;
      const userPickTeamMeta = userPick?.team_id ? getTeamMetadata(userPick.team_id) : undefined;

      return {
        player,
        status,
        userPick,
        winnerTeamMeta,
        userPickTeamMeta,
      };
    });
  }, [winners?.players, playerSelectionsByKey, playerOutcomes]);

  const pickDate = picks?.date ?? selectedDate;
  const changeCount = picks?.changesCount ?? null;

  const teamTableRows = useMemo<TeamPickRow[]>(() => {
    return teamSelections.map((pick) => {
      const status = teamOutcomes.get(pick.game_id) ?? 'pending';
      const selectedMeta = pick.selected_team_id ? getTeamMetadata(pick.selected_team_id) : null;
      return {
        game_id: pick.game_id,
        selected_team_id: pick.selected_team_id,
        selected_team_abbr: pick.selected_team_abbr ?? selectedMeta?.abbreviation ?? null,
        selected_team_name: pick.selected_team_name ?? selectedMeta?.name ?? null,
        pick_date: pickDate,
        result: status,
        changes_count: changeCount,
        game: (pick.game as TeamPickRow['game']) ?? null,
      };
    });
  }, [teamSelections, teamOutcomes, pickDate, changeCount]);

  const playerTableRows = useMemo<PlayerPickRow[]>(() => {
    return playerSelections.map((pick) => {
      const teamMeta = pick.team_id ? getTeamMetadata(pick.team_id) : null;
      return {
        game_id: pick.game_id,
        category: pick.category,
        player_id: pick.player_id,
        pick_date: pickDate,
        changes_count: changeCount,
        player: {
          first_name: pick.first_name ?? null,
          last_name: pick.last_name ?? null,
          position: pick.position ?? null,
          team_abbr: teamMeta?.abbreviation ?? null,
        },
        game: (pick.game as PlayerPickRow['game']) ?? null,
      };
    });
  }, [playerSelections, pickDate, changeCount]);

  const pointsValue = points?.total_points ?? (points as { total?: number } | undefined)?.total ?? 0;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
            >
              {dateOptions.map((dateOption) => (
                <option key={dateOption} value={dateOption}>
                  {formatSlateLabel(locale, dateOption as SlateDate)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

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
            <div className="grid gap-4 md:grid-cols-2">
              {teamSummaryCards.map(
                ({
                  team,
                  homeMeta,
                  awayMeta,
                  winnerMeta,
                  userPick,
                  userPickMeta,
                  status,
                }) => {
                  const badge = statusBadge(status);
                  const ringClass =
                    status === 'win'
                      ? 'ring-2 ring-emerald-400'
                      : status === 'loss'
                        ? 'ring-2 ring-rose-400/80'
                        : '';
                  const homeLabel = homeMeta?.abbreviation ?? homeMeta?.name ?? 'HOME';
                  const awayLabel = awayMeta?.abbreviation ?? awayMeta?.name ?? 'AWAY';
                  const winnerName = winnerMeta?.name ?? '—';
                  const pickName =
                    userPickMeta?.name ??
                    userPick?.selected_team_name ??
                    userPick?.selected_team_id ??
                    '—';

                  return (
                    <article
                      key={team.game_id}
                      className={clsx(
                        'rounded-2xl border border-accent-gold/30 bg-navy-900/60 p-4 shadow-card transition',
                        ringClass,
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          {awayLabel} @ {homeLabel}
                        </span>
                        <span className={badge.className}>{badge.label}</span>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                        Winner
                      </p>
                      <p className="text-sm font-semibold text-white">{winnerName}</p>
                      <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                        {dictionary.dashboard.winners.myPick}
                      </p>
                      <p className="text-sm font-semibold text-white">{pickName}</p>
                    </article>
                  );
                },
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">
              {dictionary.play.players.title}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {playerSummaryCards.map(
                ({ player, status, userPick, winnerTeamMeta, userPickTeamMeta }) => {
                  const badge = statusBadge(status);
                  const ringClass =
                    status === 'win'
                      ? 'ring-2 ring-emerald-400'
                      : status === 'loss'
                        ? 'ring-2 ring-rose-400/80'
                        : '';
                  const winnerName = `${player.first_name} ${player.last_name}`.trim();
                  const pickName = userPick
                    ? `${userPick.first_name ?? ''} ${userPick.last_name ?? ''}`.trim() ||
                      userPick.player_id
                    : '—';
                  const categoryLabel = getCategoryLabel(dictionary, player.category);

                  return (
                    <article
                      key={`${player.game_id}-${player.category}`}
                      className={clsx(
                        'rounded-2xl border border-accent-gold/30 bg-navy-900/60 p-4 shadow-card transition',
                        ringClass,
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          {categoryLabel}
                        </span>
                        <span className={badge.className}>{badge.label}</span>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                        Winner
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {winnerName || player.player_id}
                      </p>
                      <p className="text-xs text-slate-400">
                        {winnerTeamMeta?.abbreviation ?? winnerTeamMeta?.name ?? '—'}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                        {dictionary.dashboard.winners.myPick}
                      </p>
                      <p className="text-sm font-semibold text-white">{pickName || '—'}</p>
                      <p className="text-xs text-slate-400">
                        {userPickTeamMeta?.abbreviation ?? userPickTeamMeta?.name ?? '—'}
                      </p>
                    </article>
                  );
                },
              )}
            </div>
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
          <div className="grid gap-4 md:grid-cols-2">
            <PicksTeamsTable
              className="h-full"
              title={dictionary.play.teams.title}
              rows={teamTableRows}
              emptyMessage={dictionary.dashboard.winners.empty}
            />
            <PicksPlayersTable
              className="h-full"
              title={dictionary.play.players.title}
              rows={playerTableRows}
              emptyMessage={dictionary.dashboard.winners.empty}
              formatCategory={(category) => getCategoryLabel(dictionary, category)}
            />
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
  );
};
