'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';

type ClientTeamDTO = {
  abbr?: string;
  providerTeamId?: string;
  name?: string;
};

type ClientGameDTO = {
  provider: 'bdl';
  providerGameId: string;
  season: string;
  status: string;
  dateNY: string;
  startTimeUTC?: string | null;
  home: ClientTeamDTO;
  away: ClientTeamDTO;
};

type BalldontlieTeam = {
  id?: number | string | null;
  abbreviation?: string | null;
  full_name?: string | null;
  name?: string | null;
};

type BalldontlieGame = {
  id?: number | string | null;
  season?: number | string | null;
  status?: string | null;
  date?: string | null;
  start_time?: string | null;
  home_team?: BalldontlieTeam | null;
  visitor_team?: BalldontlieTeam | null;
};

type UpsertedGame = {
  id: string;
  providerGameId: string;
  home_abbr: string | null;
  away_abbr: string | null;
  game_date: string;
  status: string;
};

type DayGamesProps = {
  dateNY: string;
};

const BDL_ENDPOINT = 'https://www.balldontlie.io/api/v1/games';

const normalizeString = (value?: number | string | null) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const extractTeamDto = (team: BalldontlieTeam | null | undefined): ClientTeamDTO => ({
  abbr: team?.abbreviation ?? undefined,
  providerTeamId:
    team?.id !== null && team?.id !== undefined ? normalizeString(team.id) : undefined,
  name: team?.full_name ?? team?.name ?? undefined,
});

const mapGameToDto = (game: BalldontlieGame, dateNY: string): ClientGameDTO => {
  const startTime =
    typeof game?.start_time === 'string' && game.start_time.trim().length > 0
      ? game.start_time
      : typeof game?.date === 'string'
        ? game.date
        : null;

  return {
    provider: 'bdl',
    providerGameId: normalizeString(game?.id),
    season: normalizeString(game?.season),
    status: normalizeString(game?.status),
    dateNY,
    startTimeUTC: startTime,
    home: extractTeamDto(game?.home_team ?? null),
    away: extractTeamDto(game?.visitor_team ?? null),
  };
};

const DayGames = ({ dateNY }: DayGamesProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bdlGames, setBdlGames] = useState<ClientGameDTO[]>([]);
  const [upsertedMap, setUpsertedMap] = useState<Record<string, UpsertedGame>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadGames = async () => {
      setLoading(true);
      setError(null);
      setBdlGames([]);
      setUpsertedMap({});

      try {
        const params = new URLSearchParams({
          'dates[]': dateNY,
          per_page: '100',
        });

        const response = await fetch(`${BDL_ENDPOINT}?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`BallDontLie response ${response.status}`);
        }

        const payload = await response.json();
        const rawGames: BalldontlieGame[] = Array.isArray(payload?.data) ? payload.data : [];
        const dtos = rawGames.map((game) => mapGameToDto(game, dateNY));

        if (cancelled) {
          return;
        }

        setBdlGames(dtos);

        if (dtos.length === 0) {
          setUpsertedMap({});
          setLoading(false);
          return;
        }

        const upsertResponse = await fetch('/api/games/upsert-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ date: dateNY, games: dtos }),
        });

        const upsertPayload = await upsertResponse.json();

        if (cancelled) {
          return;
        }

        if (upsertResponse.ok && upsertPayload?.ok) {
          const map: Record<string, UpsertedGame> = {};
          const games: UpsertedGame[] = Array.isArray(upsertPayload?.games)
            ? upsertPayload.games
            : [];

          games.forEach((game) => {
            if (game?.providerGameId) {
              map[game.providerGameId] = game;
            }
          });

          setUpsertedMap(map);
        } else {
          throw new Error(
            upsertPayload?.error
              ? String(upsertPayload.error)
              : 'Errore in /api/games/upsert-batch',
          );
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Impossibile caricare le partite.';
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGames();

    return () => {
      cancelled = true;
    };
  }, [dateNY]);

  const supabaseIdByProvider = useMemo(() => upsertedMap, [upsertedMap]);

  const handlePick = useCallback(
    async (game: ClientGameDTO, side: 'home' | 'away') => {
      const supabaseGame = supabaseIdByProvider[game.providerGameId];
      if (!supabaseGame) {
        window.alert('Partita non sincronizzata. Riprova tra pochi secondi.');
        return;
      }

      const teamInfo = side === 'home' ? game.home : game.away;
      const responseTeamAbbr =
        side === 'home' ? supabaseGame.home_abbr : supabaseGame.away_abbr;
      const abbr = teamInfo?.abbr ?? responseTeamAbbr ?? undefined;

      if (!abbr) {
        window.alert('Abbreviazione della squadra non disponibile.');
        return;
      }

      const submissionKey = `${game.providerGameId}-${side}`;
      setSubmittingKey(submissionKey);

      try {
        const providerGameId = game.providerGameId;
        const season = game.season;
        const status = supabaseGame?.status ?? game.status;
        const startTimeISO = game.startTimeUTC ?? null;
        const homeAbbr = game.home.abbr ?? supabaseGame?.home_abbr ?? undefined;
        const awayAbbr = game.away.abbr ?? supabaseGame?.away_abbr ?? undefined;
        const homeProviderTeamId = game.home.providerTeamId;
        const awayProviderTeamId = game.away.providerTeamId;
        const homeName = game.home.name ?? homeAbbr ?? null;
        const awayName = game.away.name ?? awayAbbr ?? null;

        const response = await fetch('/api/picks/team', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pickDate: dateNY,
            game: {
              gameId: supabaseGame.id,
              gameProvider: 'bdl',
              providerGameId,
              dto: {
                provider: 'bdl',
                providerGameId: String(providerGameId),
                season: String(season),
                status,
                dateNY,
                startTimeUTC: startTimeISO ?? null,
                home: {
                  abbr: homeAbbr,
                  providerTeamId: homeProviderTeamId ? String(homeProviderTeamId) : undefined,
                  name: homeName ?? undefined,
                },
                away: {
                  abbr: awayAbbr,
                  providerTeamId: awayProviderTeamId ? String(awayProviderTeamId) : undefined,
                  name: awayName ?? undefined,
                },
              },
            },
            selectedTeam: {
              abbr,
            },
          }),
        });

        const payload = await response.json();

        if (response.ok && payload?.ok) {
          window.alert(`Pick salvata: Vince ${abbr}!`);
        } else {
          const errorMessage =
            payload?.error ?? `Errore imprevisto (${response.status}).`;
          window.alert(`Errore nel salvataggio della pick: ${errorMessage}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        window.alert(`Errore di rete: ${message}`);
      } finally {
        setSubmittingKey((current) => (current === submissionKey ? null : current));
      }
    },
    [dateNY, supabaseIdByProvider],
  );

  const renderContent = () => {
    if (loading) {
      return <div className="text-sm text-muted-foreground">Carico le partite...</div>;
    }

    if (error) {
      return (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Errore: {error}
        </div>
      );
    }

    if (bdlGames.length === 0) {
      return (
        <div className="text-sm text-muted-foreground">
          Nessuna partita trovata per {dateNY}.
        </div>
      );
    }

    return (
      <ul className="flex flex-col gap-4">
        {bdlGames.map((game) => {
          const supabaseGame = supabaseIdByProvider[game.providerGameId];
          const homeAbbr = game.home.abbr ?? supabaseGame?.home_abbr ?? 'HOME';
          const awayAbbr = game.away.abbr ?? supabaseGame?.away_abbr ?? 'AWAY';
          const isHomeSubmitting = submittingKey === `${game.providerGameId}-home`;
          const isAwaySubmitting = submittingKey === `${game.providerGameId}-away`;

          return (
            <li
              key={game.providerGameId}
              className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{homeAbbr} vs {awayAbbr}</span>
                <span className="text-xs text-slate-500">
                  Stato: {supabaseGame?.status ?? game.status}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  onClick={() => handlePick(game, 'home')}
                  disabled={!supabaseGame || isHomeSubmitting}
                >
                  {isHomeSubmitting ? 'Salvo...' : `Vince ${homeAbbr}`}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                  onClick={() => handlePick(game, 'away')}
                  disabled={!supabaseGame || isAwaySubmitting}
                >
                  {isAwaySubmitting ? 'Salvo...' : `Vince ${awayAbbr}`}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Partite del {dateNY}</h2>
        <span className="text-xs text-slate-500">
          Aggiornate da BallDontLie
        </span>
      </header>

      {renderContent()}
    </section>
  );
};

export default DayGames;
