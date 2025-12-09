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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type GameRow = Database['public']['Tables']['games']['Row'];
type TeamResultInsert = Database['public']['Tables']['results_team']['Insert'];
type TeamResultRow = Database['public']['Tables']['results_team']['Row'];
type PlayerResultInsert = Database['public']['Tables']['results_players']['Insert'];
type PlayerResultRow = Database['public']['Tables']['results_players']['Row'];

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

const pickTopPerformers = (stats: BalldontlieStat[], key: 'pts' | 'reb' | 'ast') => {
  let maxValue = 0;
  stats.forEach((entry) => {
    const value = Number(entry?.[key] ?? 0);
    if (value > maxValue) {
      maxValue = value;
    }
  });

  if (maxValue <= 0) {
    return [] as string[];
  }

  return stats
    .filter((entry) => Number(entry?.[key] ?? 0) === maxValue)
    .map((entry) => (entry.player?.id != null ? String(entry.player.id) : null))
    .filter((value): value is string => Boolean(value));
};

const mapGame = (game: GameRow) => ({
  id: game.id,
  homeAbbr: game.home_team_abbr?.toUpperCase() ?? '',
  awayAbbr: game.away_team_abbr?.toUpperCase() ?? '',
  homeTeamId: game.home_team_id,
  awayTeamId: game.away_team_id,
});

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

  const { start, end } = getSlateBoundsUtc(dateParam);

  try {
    const [{ data: games, error: gamesError }, summary] = await Promise.all([
      supabaseAdmin
        .from('games')
        .select('*')
        .gte('game_date', start)
        .lt('game_date', end)
        .eq('status', 'finished')
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
      { winner: 'home' | 'away' | null; performers: Record<(typeof DEFAULT_PLAYER_CATEGORIES)[number], string[]> }
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

    const providerIds = new Set<string>();
    summaryByMatch.forEach((value) => {
      DEFAULT_PLAYER_CATEGORIES.forEach((category) => {
        value.performers[category].forEach((providerId) => providerIds.add(providerId));
      });
    });

    const providerMap = new Map<string, string>();
    if (providerIds.size > 0) {
      const { data: players, error: playersError } = await supabaseAdmin
        .from('player')
        .select('id, provider_player_id')
        .in('provider_player_id', Array.from(providerIds));

      if (playersError) {
        throw playersError;
      }

      (players ?? []).forEach((entry) => {
        if (entry.provider_player_id) {
          providerMap.set(entry.provider_player_id, entry.id);
        }
      });
    }

    const teamUpserts: TeamResultInsert[] = [];
    const playerUpserts: PlayerResultInsert[] = [];

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
        settled_at: undefined,
      });

      DEFAULT_PLAYER_CATEGORIES.forEach((category) => {
        const existing = existingPlayers.get(`${game.id}:${category}`);
        if (existing && existing.length > 0) {
          return;
        }

        const performers = summaryEntry.performers[category];
        performers.forEach((providerId) => {
          const playerId = providerMap.get(providerId);
          if (!playerId) {
            return;
          }
          playerUpserts.push({
            game_id: game.id,
            category,
            player_id: playerId,
            settled_at: undefined,
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

    return NextResponse.json({
      date: dateParam,
      updated: teamUpserts.length,
      playersInserted: playerUpserts.length,
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
