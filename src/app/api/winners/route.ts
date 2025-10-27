import { NextResponse, type NextRequest } from 'next/server';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays, subDays } from 'date-fns';
import { z } from 'zod';

import { TIMEZONES } from '@/lib/constants';
import { createAdminSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATE_PARAM = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const getDefaultSlateDate = () =>
  formatInTimeZone(subDays(new Date(), 1), TIMEZONES.US_EASTERN, 'yyyy-MM-dd');

const getSlateBounds = (date: string) => {
  const start = fromZonedTime(`${date}T00:00:00`, TIMEZONES.US_EASTERN);
  const end = addDays(start, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export async function GET(request: NextRequest) {
  const supabaseAdmin = createAdminSupabaseClient();
  const dateParam = request.nextUrl.searchParams.get('date') ?? getDefaultSlateDate();

  const parseResult = DATE_PARAM.safeParse(dateParam);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid date parameter. Expected format YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  const date = parseResult.data;
  const { start, end } = getSlateBounds(date);

  try {
    const { data: games, error: gamesError } = await supabaseAdmin
      .from('games')
      .select('id, home_team_id, away_team_id, game_date')
      .gte('game_date', start)
      .lt('game_date', end);

    if (gamesError) {
      throw gamesError;
    }

    const gameIds = (games ?? []).map((game) => game.id);
    const safeGameIds =
      gameIds.length > 0 ? gameIds : ['00000000-0000-0000-0000-000000000000'];

    const [teamsResponse, playersResponse] = await Promise.all([
      supabaseAdmin
        .from('results_team')
        .select('game_id, winner_team_id')
        .in('game_id', safeGameIds),
      supabaseAdmin
        .from('results_players')
        .select('game_id, category, player_id')
        .in('game_id', safeGameIds),
    ]);

    if (teamsResponse.error || playersResponse.error) {
      throw teamsResponse.error ?? playersResponse.error;
    }

    const playerIds = Array.from(
      new Set((playersResponse.data ?? []).map((item) => item.player_id).filter(Boolean)),
    );

    let playerMap = new Map<string, { first_name: string; last_name: string }>();
    if (playerIds.length > 0) {
      const { data: playersLookup, error: playersLookupError } = await supabaseAdmin
        .from('player')
        .select('id, first_name, last_name')
        .in('id', playerIds);

      if (!playersLookupError && playersLookup) {
        playerMap = new Map(
          playersLookup.map((player) => [
            player.id,
            { first_name: player.first_name, last_name: player.last_name },
          ]),
        );
      }
    }

    const gameMap = new Map(
      (games ?? []).map((game) => [
        game.id,
        { home_team_id: game.home_team_id, visitor_team_id: game.away_team_id },
      ]),
    );

    const teams = (teamsResponse.data ?? [])
      .map((result) => {
        const context = gameMap.get(result.game_id);
        if (!context) {
          return null;
        }
        return {
          game_id: result.game_id,
          winner_team_id: result.winner_team_id,
          home_team_id: context.home_team_id,
          visitor_team_id: context.visitor_team_id,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const players = (playersResponse.data ?? []).map((result) => {
      const meta = playerMap.get(result.player_id);
      return {
        game_id: result.game_id,
        category: result.category,
        player_id: result.player_id,
        player: meta
          ? { firstName: meta.first_name, lastName: meta.last_name }
          : null,
      };
    });

    return NextResponse.json({
      date,
      teams,
      players,
    });
  } catch (error) {
    console.error('[api/winners]', error);
    return NextResponse.json(
      { error: 'Failed to load winners' },
      { status: 500 },
    );
  }
}
