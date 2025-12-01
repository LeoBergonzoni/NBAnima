import { NextResponse, type NextRequest } from 'next/server';

import {
  BalldontlieError,
  fetchGamesByDate,
  fetchStatsForGame,
  type BalldontlieGame,
  type BalldontlieStat,
} from '@/lib/balldontlieClient';
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const isFinalStatus = (value: string | undefined | null) =>
  (value ?? '').toLowerCase().includes('final');

const ensureAdmin = async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null };
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  return { user, role: profile?.role ?? null };
};

const pickTopPerformers = (
  stats: BalldontlieStat[],
  key: 'pts' | 'reb' | 'ast',
) => {
  let maxValue = 0;
  stats.forEach((entry) => {
    const value = Number(entry?.[key] ?? 0);
    if (value > maxValue) {
      maxValue = value;
    }
  });

  if (maxValue <= 0) {
    return [] as Array<{
      player: BalldontlieStat['player'] | null;
      team: BalldontlieStat['team'] | null;
      value: number;
    }>;
  }

  return stats
    .filter((entry) => Number(entry?.[key] ?? 0) === maxValue)
    .map((entry) => ({
      player: entry.player ?? null,
      team: entry.team ?? null,
      value: maxValue,
    }));
};

const mapGame = (game: BalldontlieGame) => ({
  id: game.id,
  date: game.date,
  status: game.status,
  home_team: game.home_team,
  visitor_team: game.visitor_team,
  home_team_score: game.home_team_score ?? 0,
  visitor_team_score: game.visitor_team_score ?? 0,
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json(
      { error: 'Missing `date` query parameter (YYYY-MM-DD).' },
      { status: 400 },
    );
  }

  const { user, role } = await ensureAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const games = await fetchGamesByDate(date);
    const finalGames = games.filter((game) => isFinalStatus(game.status));

    const gamesWithLeaders = await Promise.all(
      finalGames.map(async (game) => {
        const stats = await fetchStatsForGame(game.id);
        return {
          game: mapGame(game),
          topPerformers: {
            points: pickTopPerformers(stats, 'pts'),
            rebounds: pickTopPerformers(stats, 'reb'),
            assists: pickTopPerformers(stats, 'ast'),
          },
        };
      }),
    );

    return NextResponse.json({ date, games: gamesWithLeaders });
  } catch (error) {
    console.error('[api/admin/games-summary]', error);
    const status =
      error instanceof BalldontlieError && error.status
        ? error.status
        : 500;
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to load BallDontLie data' },
      { status },
    );
  }
}
