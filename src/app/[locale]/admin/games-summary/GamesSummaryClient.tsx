'use client';

import clsx from 'clsx';
import { format, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Loader2, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTeamRecords } from '@/hooks/useTeamRecords';
import type { Locale } from '@/lib/constants';
import type { Dictionary } from '@/locales/dictionaries';

type Team = {
  id: number;
  abbreviation?: string | null;
  full_name: string;
};

type Performer = {
  player: { id: number; first_name: string; last_name: string } | null;
  team: Team | null;
  value: number;
};

type GameSummary = {
  game: {
    id: number;
    date: string;
    status: string;
    home_team: Team;
    visitor_team: Team;
    home_team_score: number;
    visitor_team_score: number;
  };
  topPerformers: {
    points: Performer[];
    rebounds: Performer[];
    assists: Performer[];
  };
};

const defaultNyDate = formatInTimeZone(
  subDays(new Date(), 1),
  'America/New_York',
  'yyyy-MM-dd',
);

const formatLocalTipoff = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return format(parsed, 'PPpp');
};

const resolveErrorMessage = (status: number, fallback?: string) => {
  if (status === 401) {
    return 'Autenticazione o API key BallDontLie non valida (401).';
  }
  if (status === 429) {
    return 'Limite di richieste BallDontLie raggiunto (429). Riprova tra qualche minuto.';
  }
  return fallback ?? 'Errore nel recupero delle partite dal provider.';
};

export function GamesSummaryClient({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  void locale;

  const [selectedDate, setSelectedDate] = useState(defaultNyDate);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamIds = useMemo(() => {
    const ids = new Set<string>();
    games.forEach(({ game }) => {
      if (game?.home_team?.id !== undefined) {
        ids.add(String(game.home_team.id));
      }
      if (game?.visitor_team?.id !== undefined) {
        ids.add(String(game.visitor_team.id));
      }
    });
    return Array.from(ids);
  }, [games]);

  // Placeholder: this will surface real W–L records once `/v1/standings` is available (GOAT)
  // or after computing wins/losses from `/v1/games` history.
  const { records } = useTeamRecords(teamIds);

  const handleLoad = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/games-summary?date=${encodeURIComponent(selectedDate)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = resolveErrorMessage(response.status, payload?.error);
        throw new Error(message);
      }

      setGames(Array.isArray(payload?.games) ? (payload.games as GameSummary[]) : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossibile caricare le partite.';
      setError(message);
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPerformers = (label: string, performers: Performer[] | null | undefined) => {
    const list = Array.isArray(performers) ? performers.filter((p) => p?.player) : [];
    if (list.length === 0) {
      return (
        <div>
          <p className="text-xs uppercase text-slate-400">{label}</p>
          <p className="text-sm text-slate-400">—</p>
        </div>
      );
    }

    return (
      <div>
        <p className="text-xs uppercase text-slate-400">{label}</p>
        <div className="mt-1 space-y-1">
          {list.map((performer) => {
            const name = `${performer.player?.first_name ?? ''} ${performer.player?.last_name ?? ''}`.trim();
            const teamName = performer.team?.full_name ?? performer.team?.abbreviation ?? '—';
            return (
              <p key={performer.player?.id} className="text-sm font-semibold text-white">
                {name}
                <span className="text-slate-400"> · {teamName}</span>
                <span className="ml-1 text-xs text-accent-gold">({performer.value ?? 0})</span>
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRecord = (teamId?: number) => {
    if (teamId === undefined) {
      return 'W–L —';
    }
    const record = records[String(teamId)];
    if (record) {
      return `W–L ${record.wins}-${record.losses}`;
    }
    return 'W–L —';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-gold">
            Admin · BallDontLie All-Star
          </p>
          <h1 className="text-2xl font-semibold text-white">Riepilogo partite NBA</h1>
          <p className="text-sm text-slate-400">
            Seleziona una data (America/New_York) e carica le partite finalizzate con i migliori
            giocatori.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Data (NYC)
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-navy-800/80 px-3 py-2 text-sm text-white shadow-inner outline-none transition focus:border-accent-gold"
            />
          </label>
          <button
            type="button"
            onClick={handleLoad}
            disabled={isLoading || !selectedDate}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-accent-gold/60 bg-accent-gold/20 px-4 py-2 text-sm font-semibold text-accent-gold shadow-md transition hover:border-accent-gold hover:bg-accent-gold/30 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-400"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isLoading ? dictionary.common.loading : 'Carica partite del giorno'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-navy-900/60 p-4 text-sm text-slate-200">
          <Loader2 className="h-5 w-5 animate-spin text-accent-gold" />
          <span>Recupero partite e statistiche...</span>
        </div>
      ) : null}

      {!isLoading && games.length === 0 && !error ? (
        <div className="rounded-xl border border-white/5 bg-navy-900/60 p-4 text-sm text-slate-300">
          Nessuna partita finalizzata trovata per {selectedDate}.
        </div>
      ) : null}

      <div className="grid gap-4">
        {games.map(({ game, topPerformers }) => {
          const homeIsWinner = game.home_team_score > game.visitor_team_score;
          const visitorIsWinner = game.visitor_team_score > game.home_team_score;

          return (
            <div
              key={game.id}
              className="rounded-xl border border-white/10 bg-navy-900/60 p-4 shadow-card"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-accent-gold/80">
                  {formatLocalTipoff(game.date)}
                </div>
                <div className="text-xs text-slate-400">{game.status}</div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="flex flex-col gap-1">
                  <p
                    className={clsx(
                      'text-base font-semibold',
                      homeIsWinner ? 'text-emerald-300' : 'text-white',
                    )}
                  >
                    {game.home_team.full_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {game.home_team.abbreviation}
                    {' · '}
                    {renderRecord(game.home_team.id)}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <span
                    className={clsx(
                      'rounded-lg px-3 py-1 text-lg font-bold',
                      homeIsWinner ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-white',
                    )}
                  >
                    {game.home_team_score}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">vs</span>
                  <span
                    className={clsx(
                      'rounded-lg px-3 py-1 text-lg font-bold',
                      visitorIsWinner
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'bg-white/5 text-white',
                    )}
                  >
                    {game.visitor_team_score}
                  </span>
                </div>

                <div className="flex flex-col gap-1 text-right sm:text-left">
                  <p
                    className={clsx(
                      'text-base font-semibold',
                      visitorIsWinner ? 'text-emerald-300' : 'text-white',
                    )}
                  >
                    {game.visitor_team.full_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {game.visitor_team.abbreviation}
                    {' · '}
                    {renderRecord(game.visitor_team.id)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-white/5 bg-white/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Top performers
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {renderPerformers('Punti', topPerformers.points)}
                  {renderPerformers('Rimbalzi', topPerformers.rebounds)}
                  {renderPerformers('Assist', topPerformers.assists)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
