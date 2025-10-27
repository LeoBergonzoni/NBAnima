'use client';

import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

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

type MyTeamPick = {
  game_id: string;
  selected_team_id: string;
};

type MyPlayerPick = {
  game_id: string;
  category: string;
  player_id: string;
  player?: { firstName: string; lastName: string } | null;
};

interface MyPicksResponse {
  date: string;
  teams: MyTeamPick[];
  players: MyPlayerPick[];
  highlights: Array<{ player_id: string; rank: number }>;
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
    () => ['/api/my-picks', selectedDate] as const,
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
        (myPicks?.players ?? []).map((pick) => [
          `${pick.game_id}:${pick.category}`,
          pick.player ?? null,
        ]),
      ),
    [myPicks?.players],
  );

  const hasResults =
    (winners?.teams?.length ?? 0) > 0 || (winners?.players?.length ?? 0) > 0;

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
        ) : (myPicks?.teams?.length ?? 0) > 0 ||
          (myPicks?.players?.length ?? 0) > 0 ||
          (myPicks?.highlights?.length ?? 0) > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card">
              <h4 className="text-sm font-semibold text-white">
                {dictionary.play.teams.title}
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                {(myPicks?.teams ?? []).map((pick) => {
                  const teamMeta = getTeamMetadata(pick.selected_team_id);
                  return (
                    <li
                      key={`${pick.game_id}-${pick.selected_team_id}`}
                      className="rounded-xl border border-white/5 bg-navy-800/70 px-3 py-2"
                    >
                      <span className="font-semibold text-white">
                        {teamMeta?.name ?? pick.selected_team_id}
                      </span>
                      <span className="ml-2 text-[11px] uppercase tracking-wide text-slate-500">
                        {pick.game_id.slice(0, 8)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card">
              <h4 className="text-sm font-semibold text-white">
                {dictionary.play.players.title}
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                {(myPicks?.players ?? []).map((pick) => {
                  const categoryLabel = getCategoryLabel(dictionary, pick.category);
                  const label = pick.player
                    ? `${pick.player.firstName} ${pick.player.lastName}`.trim()
                    : pick.player_id;
                  return (
                    <li
                      key={`${pick.game_id}-${pick.category}-${pick.player_id}`}
                      className="rounded-xl border border-white/5 bg-navy-800/70 px-3 py-2"
                    >
                      <span className="font-semibold text-white">{label}</span>
                      <span className="ml-2 text-[11px] uppercase tracking-wide text-slate-500">
                        {categoryLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300">{dictionary.dashboard.winners.empty}</p>
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
