import { NextResponse, type NextRequest } from 'next/server';

import {
  BalldontlieError,
  fetchGamesByDate,
  fetchStatsForGame,
  type BalldontlieStat,
} from '@/lib/balldontlieClient';
import { getSlateBoundsUtc, toEasternYYYYMMDD } from '@/lib/date-us-eastern';
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';
import { applySettlementForDate } from '@/server/services/settlement.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type GameRow = Database['public']['Tables']['games']['Row'];
type TeamResultInsert = Database['public']['Tables']['results_team']['Insert'];
type TeamResultRow = Database['public']['Tables']['results_team']['Row'];
type PlayerResultInsert = Database['public']['Tables']['results_players']['Insert'];
type PlayerResultRow = Database['public']['Tables']['results_players']['Row'];
type PlayerRow = Database['public']['Tables']['player']['Row'];
type PlayerWithTeam = Pick<
  PlayerRow,
  'id' | 'provider_player_id' | 'first_name' | 'last_name' | 'team_id'
> & {
  team: { abbr?: string | null } | null;
};
type RosterCandidate = Pick<
  PlayerRow,
  'id' | 'provider_player_id' | 'first_name' | 'last_name' | 'team_id'
> & {
  team_abbr?: string | null;
};

const DEFAULT_PLAYER_CATEGORIES = ['top_scorer', 'top_assist', 'top_rebound'] as const;
const ADMIN_TOKEN_HEADER = 'x-autofill-token';

const isFinalStatus = (value: string | undefined | null) =>
  (value ?? '').toLowerCase().includes('final');

const ensureAdminOrToken = async (request: NextRequest) => {
  const token = request.headers.get(ADMIN_TOKEN_HEADER) ?? request.headers.get('authorization');
  const expected = process.env.AUTOFILL_ADMIN_TOKEN;
  if (expected && token === `Bearer ${expected}`) {
    return { ok: true };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401 as const, error: 'Unauthorized' };
  }

  const { data: profile, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  if (error) {
    return { ok: false, status: 500 as const, error: error.message };
  }

  if (profile?.role !== 'admin') {
    return { ok: false, status: 403 as const, error: 'Forbidden' };
  }

  return { ok: true };
};

type SummaryPerformer = {
  player: BalldontlieStat['player'] | null;
  team: BalldontlieStat['team'] | null;
};

const pickTopPerformers = (stats: BalldontlieStat[], key: 'pts' | 'reb' | 'ast') => {
  let maxValue = 0;
  stats.forEach((entry) => {
    const value = Number(entry?.[key] ?? 0);
    if (value > maxValue) {
      maxValue = value;
    }
  });

  if (maxValue <= 0) {
    return [] as SummaryPerformer[];
  }

  return stats
    .filter((entry) => Number(entry?.[key] ?? 0) === maxValue)
    .map((entry) => ({
      player: entry.player ?? null,
      team: entry.team ?? null,
    }));
};

const mapGame = (game: GameRow) => ({
  id: game.id,
  homeAbbr: game.home_team_abbr?.toUpperCase() ?? '',
  awayAbbr: game.away_team_abbr?.toUpperCase() ?? '',
  homeTeamId: game.home_team_id,
  awayTeamId: game.away_team_id,
});

const stripDiacritics = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '');

const normalizeName = (value?: string | null) =>
  stripDiacritics(value ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim();

const normalizeToken = (value?: string | number | null) =>
  stripDiacritics((value ?? '').toString())
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

const resolveTeamIdForPerformer = (
  performer: SummaryPerformer,
  game: ReturnType<typeof mapGame>,
) => {
  const teamAbbr = performer.team?.abbreviation?.toUpperCase() ?? null;
  if (teamAbbr && teamAbbr === game.homeAbbr) {
    return game.homeTeamId;
  }
  if (teamAbbr && teamAbbr === game.awayAbbr) {
    return game.awayTeamId;
  }
  return null;
};

const resolvePlayerMatch = (
  performer: SummaryPerformer,
  candidates: RosterCandidate[],
  fallbackId?: string,
) => {
  if (fallbackId) {
    return fallbackId;
  }

  const performerId = normalizeToken(performer.player?.id);
  const first = normalizeName(performer.player?.first_name);
  const last = normalizeName(performer.player?.last_name);
  const fullName = normalizeName(
    `${performer.player?.first_name ?? ''} ${performer.player?.last_name ?? ''}`,
  );
  const teamAbbr = performer.team?.abbreviation?.toUpperCase() ?? null;
  const teamToken = normalizeName(teamAbbr);

  const scored = candidates
    .map((candidate) => {
      const candidateId = normalizeToken(candidate.provider_player_id || candidate.id);
      const candidateFirst = normalizeName(candidate.first_name);
      const candidateLast = normalizeName(candidate.last_name);
      const candidateFull = normalizeName(
        `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`,
      );
      const candidateTeamToken = normalizeName(candidate.team_abbr);

      let score = 0;
      if (performerId && candidateId && performerId === candidateId) {
        score += 8;
      }
      if (fullName && candidateFull && fullName === candidateFull) {
        score += 4;
      } else if (first && last && candidateFirst && candidateLast) {
        if (first === candidateFirst && last === candidateLast) {
          score += 3;
        } else if (last === candidateLast) {
          score += 1.5;
        }
      } else if (last && candidateLast && last === candidateLast) {
        score += 1.5;
      }
      if (teamToken && candidateTeamToken && teamToken === candidateTeamToken) {
        score += 1;
      }

      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.candidate.id ?? null;
};

export const POST = async (request: NextRequest) => {
  const auth = await ensureAdminOrToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const dateParam =
    request.nextUrl.searchParams.get('date') ?? toEasternYYYYMMDD(new Date());
  const bufferMinutes = Number(
    request.nextUrl.searchParams.get('bufferMinutes') ?? '2',
  );
  const publish =
    request.nextUrl.searchParams.get('publish') === '1' ||
    request.nextUrl.searchParams.get('publish') === 'true';

  const { start, end } = getSlateBoundsUtc(dateParam);

  try {
    const [{ data: games, error: gamesError }, summary] = await Promise.all([
      supabaseAdmin
        .from('games')
        .select('*')
        .gte('game_date', start)
        .lt('game_date', end)
        .returns<GameRow[]>(),
      fetchGamesByDate(dateParam),
    ]);

    if (gamesError) {
      throw gamesError;
    }

    const finishedGames = (games ?? []).map(mapGame);
    if (finishedGames.length === 0) {
      return NextResponse.json({
        date: dateParam,
        updated: 0,
        playersInserted: 0,
        message: 'No finished games for date',
      });
    }

    const summaryFinal = summary.filter((game) => isFinalStatus(game.status));
    const statsByGameId = new Map<number, Awaited<ReturnType<typeof fetchStatsForGame>>>();

    for (const game of summaryFinal) {
      const stats = await fetchStatsForGame(game.id);
      statsByGameId.set(game.id, stats);
    }

    const summaryByMatch = new Map<
      string,
      {
        winner: 'home' | 'away' | null;
        performers: Record<(typeof DEFAULT_PLAYER_CATEGORIES)[number], SummaryPerformer[]>;
      }
    >();
    summaryFinal.forEach((game) => {
      const key = `${game.home_team.abbreviation?.toUpperCase() ?? ''}-${game.visitor_team.abbreviation?.toUpperCase() ?? ''}`;
      const winner =
        (game.home_team_score ?? 0) === (game.visitor_team_score ?? 0)
          ? null
          : (game.home_team_score ?? 0) > (game.visitor_team_score ?? 0)
            ? 'home'
            : 'away';
      const stats = statsByGameId.get(game.id) ?? [];
      summaryByMatch.set(key, {
        winner,
        performers: {
          top_scorer: pickTopPerformers(stats, 'pts'),
          top_rebound: pickTopPerformers(stats, 'reb'),
          top_assist: pickTopPerformers(stats, 'ast'),
        },
      });
    });

    const gameIds = finishedGames.map((game) => game.id);
    const [teamResults, playerResults] = await Promise.all([
      supabaseAdmin
        .from('results_team')
        .select('*')
        .in('game_id', gameIds)
        .returns<TeamResultRow[]>(),
      supabaseAdmin
        .from('results_players')
        .select('*')
        .in('game_id', gameIds)
        .returns<PlayerResultRow[]>(),
    ]);

    const existingTeams = new Map(
      (teamResults.data ?? []).map((entry) => [entry.game_id, entry]),
    );
    const existingPlayers = new Map<string, PlayerResultRow[]>();
    (playerResults.data ?? []).forEach((entry) => {
      const key = `${entry.game_id}:${entry.category}`;
      const list = existingPlayers.get(key) ?? [];
      list.push(entry);
      existingPlayers.set(key, list);
    });

    const teamIds = Array.from(
      new Set(
        finishedGames
          .flatMap((game) => [game.homeTeamId, game.awayTeamId])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const rosterByTeamId = new Map<string, RosterCandidate[]>();
    const providerMap = new Map<string, string>();
    if (teamIds.length > 0) {
      const { data: players, error: playersError } = await supabaseAdmin
        .from('player')
        .select('id, provider_player_id, first_name, last_name, team_id, team:team_id (abbr)')
        .in('team_id', teamIds)
        .eq('provider', 'espn') // only use ESPN UUIDs when auto-filling winners
        .returns<PlayerWithTeam[]>();

      if (playersError) {
        throw playersError;
      }

      (players ?? []).forEach((entry) => {
        if (!entry.team_id) {
          return;
        }
        const rosterEntry = {
          id: entry.id,
          provider_player_id: entry.provider_player_id,
          first_name: entry.first_name,
          last_name: entry.last_name,
          team_id: entry.team_id,
          team_abbr: entry.team?.abbr ?? null,
        };
        const list = rosterByTeamId.get(entry.team_id) ?? [];
        list.push(rosterEntry);
        rosterByTeamId.set(entry.team_id, list);
        if (entry.provider_player_id) {
          providerMap.set(entry.provider_player_id, entry.id);
        }
      });
    }

    const teamUpserts: TeamResultInsert[] = [];
    const playerUpserts: PlayerResultInsert[] = [];
    const settledAt = publish ? new Date().toISOString() : undefined;

    finishedGames.forEach((game) => {
      const matchKey = `${game.homeAbbr}-${game.awayAbbr}`;
      const summaryEntry = summaryByMatch.get(matchKey);
      if (!summaryEntry || !summaryEntry.winner) {
        return;
      }

      const existingTeam = existingTeams.get(game.id);
      if (existingTeam) {
        return;
      }

      const winnerTeamId = summaryEntry.winner === 'home' ? game.homeTeamId : game.awayTeamId;
      if (!winnerTeamId) {
        return;
      }

      teamUpserts.push({
        game_id: game.id,
        winner_team_id: winnerTeamId,
        settled_at: settledAt,
      });

      DEFAULT_PLAYER_CATEGORIES.forEach((category) => {
        const existing = existingPlayers.get(`${game.id}:${category}`);
        if (existing && existing.length > 0) {
          return;
        }

        const performers = summaryEntry.performers[category];
        const added = new Set<string>();

        performers.forEach((performer) => {
          const providerId = performer.player?.id != null ? String(performer.player.id) : null;
          const fallbackId = providerId ? providerMap.get(providerId) : undefined;
          const teamId = resolveTeamIdForPerformer(performer, game);
          const candidates = teamId
            ? rosterByTeamId.get(teamId) ?? []
            : [
                ...(game.homeTeamId ? rosterByTeamId.get(game.homeTeamId) ?? [] : []),
                ...(game.awayTeamId ? rosterByTeamId.get(game.awayTeamId) ?? [] : []),
              ];
          const playerId = resolvePlayerMatch(performer, candidates, fallbackId);
          if (!playerId) {
            // Only ESPN players are allowed; skip and log when missing.
            console.warn('[autofill-winners] missing ESPN player for provider id', {
              game_id: game.id,
              category,
              providerId,
              playerName: performer.player
                ? `${performer.player.first_name ?? ''} ${performer.player.last_name ?? ''}`.trim()
                : null,
            });
            return;
          }
          if (added.has(playerId)) {
            return;
          }
          added.add(playerId);
          playerUpserts.push({
            game_id: game.id,
            category,
            player_id: playerId,
            settled_at: settledAt,
          });
        });
      });
    });

    if (teamUpserts.length > 0) {
      const { error } = await supabaseAdmin
        .from('results_team')
        .upsert(teamUpserts, { onConflict: 'game_id' });
      if (error) {
        throw error;
      }
    }

    if (playerUpserts.length > 0) {
      const { error } = await supabaseAdmin
        .from('results_players')
        .upsert(playerUpserts, { onConflict: 'game_id,category,player_id' });
      if (error) {
        throw error;
      }
    }

    const settlement = publish ? await applySettlementForDate(dateParam) : null;

    return NextResponse.json({
      date: dateParam,
      updated: teamUpserts.length,
      playersInserted: playerUpserts.length,
      settlementProcessed: settlement?.processed ?? 0,
    });
  } catch (error) {
    const status =
      error instanceof BalldontlieError && error.status ? error.status : 500;
    console.error('[api/admin/autofill-winners]', error);
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to autofill winners' },
      { status },
    );
  }
};
