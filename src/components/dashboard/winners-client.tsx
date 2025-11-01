'use client';

import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { PicksPlayersTable, type PlayerPickRow } from '@/components/picks/PicksPlayersTable';
import { PicksTeamsTable, type TeamPickRow } from '@/components/picks/PicksTeamsTable';
import { matchesTeamIdentity } from '@/components/picks/cells';
import { TIMEZONES, type Locale } from '@/lib/constants';
import { getTeamMetadata } from '@/lib/teamMetadata';
import type { Dictionary } from '@/locales/dictionaries';

interface WinnersClientProps {
  locale: Locale;
  dictionary: Dictionary;
}

type TeamResult = {
  game_id: string;
  winner_team_id: string | null;
  home_team_id: string | null;
  visitor_team_id: string | null;
};

type PlayerResult = {
  game_id: string;
  category: string;
  player_id: string;
  player?: { firstName: string; lastName: string } | null;
};

interface WinnersResponse {
  date: string;
  teams: TeamResult[];
  players: PlayerResult[];
}

interface PicksTeamRecord {
  game_id: string;
  selected_team_id: string;
  selected_team_abbr?: string | null;
  selected_team_name?: string | null;
  pick_date?: string | null;
  changes_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  result?: string | null;
  game?: {
    id?: string | null;
    home_team_id?: string | null;
    away_team_id?: string | null;
    home_team_abbr?: string | null;
    away_team_abbr?: string | null;
    home_team_name?: string | null;
    away_team_name?: string | null;
  } | null;
}

interface PicksPlayerRecord {
  game_id: string;
  category: string;
  player_id: string;
  pick_date?: string | null;
  changes_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  player?: {
    first_name?: string | null;
    last_name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    position?: string | null;
    team_abbr?: string | null;
  } | null;
  game?: {
    id?: string | null;
    home_team_id?: string | null;
    away_team_id?: string | null;
    home_team_abbr?: string | null;
    away_team_abbr?: string | null;
    home_team_name?: string | null;
    away_team_name?: string | null;
  } | null;
}

interface MyPicksResponse {
  pickDate: string;
  userId?: string;
  teams: PicksTeamRecord[];
  players: PicksPlayerRecord[];
  highlights: Array<{ player_id: string; rank: number }>;
  changesCount: number;
}

interface PointsResponse {
  date: string;
  total: number;
}

const swrFetcher = async ([url, date]: [string, string]) => {
  const response = await fetch(`${url}?date=${date}`, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Request failed');
  }
  return response.json();
};

const buildDateOptions = () => {
  const now = new Date();
  const entries: string[] = [];
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = subDays(now, offset);
    const formatted = formatInTimeZone(candidate, TIMEZONES.US_EASTERN, 'yyyy-MM-dd');
    if (!entries.includes(formatted)) {
      entries.push(formatted);
    }
  }
  return entries;
};

const formatDateLabel = (locale: Locale, dateString: string) => {
  try {
    const formatter = new Intl.DateTimeFormat(
      locale === 'it' ? 'it-IT' : 'en-US',
      {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      },
    );
    return formatter.format(new Date(`${dateString}T00:00:00Z`));
  } catch {
    return dateString;
  }
};

const getCategoryLabel = (
  dictionary: Dictionary,
  category: string,
) =>
  dictionary.play.players.categories[
    category as keyof Dictionary['play']['players']['categories']
  ] ?? category;

export const WinnersClient = ({ locale, dictionary }: WinnersClientProps) => {
  const fallbackDate = useMemo(
    () => formatInTimeZone(subDays(new Date(), 1), TIMEZONES.US_EASTERN, 'yyyy-MM-dd'),
    [],
  );

  const dateOptions = useMemo(() => {
    const base = buildDateOptions();
    if (!base.includes(fallbackDate)) {
      base.unshift(fallbackDate);
    }
    return base;
  }, [fallbackDate]);

  const [selectedDate, setSelectedDate] = useState(dateOptions[0] ?? fallbackDate);

  const winnersKey = useMemo(
    () => ['/api/winners', selectedDate] as const,
    [selectedDate],
  );
  const picksKey = useMemo(
    () => ['/api/picks', selectedDate] as const,
    [selectedDate],
  );
  const pointsKey = useMemo(
    () => ['/api/points-by-date', selectedDate] as const,
    [selectedDate],
  );

  const {
    data: winners,
    error: winnersError,
    isLoading: winnersLoading,
  } = useSWR<WinnersResponse>(winnersKey, swrFetcher, { revalidateOnFocus: false });

  const {
    data: myPicks,
    error: picksError,
    isLoading: picksLoading,
  } = useSWR<MyPicksResponse>(picksKey, swrFetcher, { revalidateOnFocus: false });

  const {
    data: points,
    error: pointsError,
    isLoading: pointsLoading,
  } = useSWR<PointsResponse>(pointsKey, swrFetcher, { revalidateOnFocus: false });

  const teamPicksMap = useMemo(
    () =>
      new Map(
        (myPicks?.teams ?? []).map((pick) => [pick.game_id, pick.selected_team_id]),
      ),
    [myPicks?.teams],
  );

  const playerPicksMap = useMemo(
    () =>
      new Map(
        (myPicks?.players ?? []).map((pick) => [
          `${pick.game_id}:${pick.category}`,
          pick.player_id,
        ]),
      ),
    [myPicks?.players],
  );

  const playerPickMetaMap = useMemo(
    () =>
      new Map(
        (myPicks?.players ?? []).map((pick) => {
          const raw = pick.player ?? null;
          const meta = raw
            ? {
                firstName:
                  (raw as { firstName?: string | null }).firstName ??
                  (raw as { first_name?: string | null }).first_name ??
                  '',
                lastName:
                  (raw as { lastName?: string | null }).lastName ??
                  (raw as { last_name?: string | null }).last_name ??
                  '',
              }
            : null;
          return [`${pick.game_id}:${pick.category}`, meta];
        }),
      ),
    [myPicks?.players],
  );

  const hasResults =
    (winners?.teams?.length ?? 0) > 0 || (winners?.players?.length ?? 0) > 0;

  const winnersByGameId = useMemo(
    () =>
      new Map(
        (winners?.teams ?? []).map((team) => [team.game_id, team]),
      ),
    [winners?.teams],
  );

  const myTeamTableRows = useMemo<TeamPickRow[]>(() => {
    if (!myPicks?.teams) {
      return [];
    }
    return myPicks.teams.map((pick) => {
      const record = pick as PicksTeamRecord;
      const winner = winnersByGameId.get(record.game_id);
      const selectedMeta = getTeamMetadata(record.selected_team_id);
      const homeMeta =
        (record.game?.home_team_id
          ? getTeamMetadata(record.game.home_team_id)
          : winner?.home_team_id
            ? getTeamMetadata(winner.home_team_id)
            : undefined) ?? undefined;
      const awayMeta =
        (record.game?.away_team_id
          ? getTeamMetadata(record.game.away_team_id)
          : winner?.visitor_team_id
            ? getTeamMetadata(winner.visitor_team_id)
            : undefined) ?? undefined;
      const gameInfo: TeamPickRow['game'] = {
        id: record.game?.id ?? record.game_id,
        home_team_id: record.game?.home_team_id ?? winner?.home_team_id ?? null,
        away_team_id: record.game?.away_team_id ?? winner?.visitor_team_id ?? null,
        home_team_abbr:
          record.game?.home_team_abbr ?? homeMeta?.abbreviation ?? null,
        away_team_abbr:
          record.game?.away_team_abbr ?? awayMeta?.abbreviation ?? null,
        home_team_name:
          record.game?.home_team_name ?? homeMeta?.name ?? null,
        away_team_name:
          record.game?.away_team_name ?? awayMeta?.name ?? null,
      };
      const winnerMeta =
        winner?.winner_team_id ? getTeamMetadata(winner.winner_team_id) : undefined;

      let result = record.result ?? null;
      if (!result && winner?.winner_team_id) {
        const selected = {
          id: record.selected_team_id,
          abbr:
            record.selected_team_abbr ??
            selectedMeta?.abbreviation ??
            null,
        };
        const winning = {
          id: winner.winner_team_id,
          abbr: winnerMeta?.abbreviation ?? null,
        };
        result = matchesTeamIdentity(selected, winning) ? 'win' : 'loss';
      }

      return {
        game_id: record.game_id,
        selected_team_id: record.selected_team_id,
        selected_team_abbr:
          record.selected_team_abbr ?? selectedMeta?.abbreviation ?? null,
        selected_team_name:
          record.selected_team_name ?? selectedMeta?.name ?? null,
        pick_date: record.pick_date ?? myPicks.pickDate ?? selectedDate,
        result,
        changes_count: record.changes_count ?? null,
        created_at: record.created_at ?? null,
        updated_at: record.updated_at ?? null,
        game: gameInfo,
      };
    });
  }, [myPicks, winnersByGameId, selectedDate]);

  const myPlayerTableRows = useMemo<PlayerPickRow[]>(() => {
    if (!myPicks?.players) {
      return [];
    }
    return myPicks.players.map((pick) => {
      const record = pick as PicksPlayerRecord;
      const winner = winnersByGameId.get(record.game_id);
      const homeMeta =
        (record.game?.home_team_id
          ? getTeamMetadata(record.game.home_team_id)
          : winner?.home_team_id
            ? getTeamMetadata(winner.home_team_id)
            : undefined) ?? undefined;
      const awayMeta =
        (record.game?.away_team_id
          ? getTeamMetadata(record.game.away_team_id)
          : winner?.visitor_team_id
            ? getTeamMetadata(winner.visitor_team_id)
            : undefined) ?? undefined;

      const normalizedPlayer = record.player
        ? {
            first_name:
              record.player.first_name ??
              (record.player as { firstName?: string | null }).firstName ??
              null,
            last_name:
              record.player.last_name ??
              (record.player as { lastName?: string | null }).lastName ??
              null,
            position: record.player.position ?? null,
            team_abbr: record.player.team_abbr ?? null,
          }
        : null;

      return {
        game_id: record.game_id,
        category: record.category,
        player_id: record.player_id,
        pick_date: record.pick_date ?? myPicks.pickDate ?? selectedDate,
        changes_count: record.changes_count ?? null,
        created_at: record.created_at ?? null,
        updated_at: record.updated_at ?? null,
        player: normalizedPlayer,
        game: {
          id: record.game?.id ?? record.game_id,
          home_team_id: record.game?.home_team_id ?? winner?.home_team_id ?? null,
          away_team_id: record.game?.away_team_id ?? winner?.visitor_team_id ?? null,
          home_team_abbr:
            record.game?.home_team_abbr ?? homeMeta?.abbreviation ?? null,
          away_team_abbr:
            record.game?.away_team_abbr ?? awayMeta?.abbreviation ?? null,
          home_team_name:
            record.game?.home_team_name ?? homeMeta?.name ?? null,
          away_team_name:
            record.game?.away_team_name ?? awayMeta?.name ?? null,
        },
      };
    });
  }, [myPicks, winnersByGameId, selectedDate]);

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
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
            >
              {dateOptions.map((dateOption) => (
                <option key={dateOption} value={dateOption}>
                  {formatDateLabel(locale, dateOption)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {winnersLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{dictionary.common.loading}</span>
        </div>
      ) : winnersError ? (
        <p className="text-sm text-red-400">
          {(winnersError as Error).message ?? 'Failed to load winners.'}
        </p>
      ) : hasResults ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">
              {dictionary.play.teams.title}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {winners?.teams.map((team) => {
                const homeMeta = getTeamMetadata(team.home_team_id);
                const visitorMeta = getTeamMetadata(team.visitor_team_id);
                const winnerMeta = getTeamMetadata(team.winner_team_id);
                const userPick = teamPicksMap.get(team.game_id);
                const userPickMeta = getTeamMetadata(userPick);
                const isHit =
                  Boolean(team.winner_team_id) &&
                  Boolean(userPick) &&
                  team.winner_team_id === userPick;

                return (
                  <article
                    key={team.game_id}
                    className={clsx(
                      'rounded-2xl border border-accent-gold/30 bg-navy-900/60 p-4 shadow-card transition',
                      isHit ? 'ring-2 ring-emerald-400' : '',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {(homeMeta?.abbreviation ?? homeMeta?.name ?? '—')}{' '}
                        vs{' '}
                        {(visitorMeta?.abbreviation ?? visitorMeta?.name ?? '—')}
                      </span>
                      {winnerMeta ? (
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          {winnerMeta.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-slate-300">
                      {dictionary.dashboard.winners.myPick}:{' '}
                      <span className="font-semibold text-white">
                        {userPickMeta?.name ?? userPick ?? '—'}
                      </span>
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">
              {dictionary.play.players.title}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {winners?.players.map((player) => {
                const key = `${player.game_id}:${player.category}`;
                const userPick = playerPicksMap.get(key);
                const userMeta = playerPickMetaMap.get(key);
                const isHit =
                  Boolean(userPick) && userPick === player.player_id;
                const winnerName = player.player
                  ? `${player.player.firstName} ${player.player.lastName}`.trim()
                  : player.player_id;
                const pickName = userMeta
                  ? `${userMeta.firstName} ${userMeta.lastName}`.trim()
                  : userPick ?? '—';
                const categoryLabel = getCategoryLabel(dictionary, player.category);

                return (
                  <article
                    key={`${player.game_id}-${player.category}`}
                    className={clsx(
                      'rounded-2xl border border-accent-gold/30 bg-navy-900/60 p-4 shadow-card transition',
                      isHit ? 'ring-2 ring-emerald-400' : '',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {categoryLabel}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">
                        {player.game_id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {winnerName}
                    </p>
                    <p className="mt-2 text-xs text-slate-300">
                      {dictionary.dashboard.winners.myPick}:{' '}
                      <span className="font-semibold text-white">{pickName}</span>
                    </p>
                  </article>
                );
              })}
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
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{dictionary.common.loading}</span>
          </div>
        ) : picksError ? (
          <p className="text-sm text-red-400">
            {(picksError as Error).message ?? 'Failed to load picks.'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <PicksTeamsTable
              className="h-full"
              title={dictionary.play.teams.title}
              rows={myTeamTableRows}
              emptyMessage={dictionary.dashboard.winners.empty}
            />
            <PicksPlayersTable
              className="h-full"
              title={dictionary.play.players.title}
              rows={myPlayerTableRows}
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
          <p className="text-sm text-red-400">
            {(pointsError as Error).message ?? 'Failed to load points.'}
          </p>
        ) : (
          <p className="text-sm text-slate-300">
            {dictionary.dashboard.winners.pointsOfDay}:{' '}
            <span className="font-semibold text-white">{points?.total ?? 0}</span>
          </p>
        )}
      </footer>
    </div>
  );
};
