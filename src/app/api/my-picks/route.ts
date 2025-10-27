import { NextResponse, type NextRequest } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';
import { z } from 'zod';

import { TIMEZONES } from '@/lib/constants';
import {
  createAdminSupabaseClient,
  createServerSupabase,
} from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATE_PARAM = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const getDefaultSlateDate = () =>
  formatInTimeZone(subDays(new Date(), 1), TIMEZONES.US_EASTERN, 'yyyy-MM-dd');

export async function GET(request: NextRequest) {
  const supabaseAdmin = createAdminSupabaseClient();
  const supabase = await createServerSupabase();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[api/my-picks] auth error', userError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateParam = request.nextUrl.searchParams.get('date') ?? getDefaultSlateDate();
  const parseResult = DATE_PARAM.safeParse(dateParam);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid date parameter. Expected format YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  const pickDate = parseResult.data;

  try {
    const [teamsResp, playersResp, highlightsResp] = await Promise.all([
      supabaseAdmin
        .from('picks_teams')
        .select('game_id, selected_team_id')
        .eq('user_id', user.id)
        .eq('pick_date', pickDate),
      supabaseAdmin
        .from('picks_players')
        .select('game_id, category, player_id')
        .eq('user_id', user.id)
        .eq('pick_date', pickDate),
      supabaseAdmin
        .from('picks_highlights')
        .select('player_id, rank')
        .eq('user_id', user.id)
        .eq('pick_date', pickDate),
    ]);

    if (teamsResp.error || playersResp.error || highlightsResp.error) {
      throw teamsResp.error ?? playersResp.error ?? highlightsResp.error;
    }

    const playerIds = Array.from(
      new Set((playersResp.data ?? []).map((item) => item.player_id).filter(Boolean)),
    );

    let playerMap = new Map<string, { first_name: string; last_name: string }>();
    if (playerIds.length > 0) {
      const { data: lookup, error: lookupError } = await supabaseAdmin
        .from('player')
        .select('id, first_name, last_name')
        .in('id', playerIds);

      if (!lookupError && lookup) {
        playerMap = new Map(
          lookup.map((player) => [
            player.id,
            { first_name: player.first_name, last_name: player.last_name },
          ]),
        );
      }
    }

    return NextResponse.json({
      date: pickDate,
      teams: teamsResp.data ?? [],
      players: (playersResp.data ?? []).map((player) => {
        const meta = playerMap.get(player.player_id);
        return {
          ...player,
          player: meta
            ? { firstName: meta.first_name, lastName: meta.last_name }
            : null,
        };
      }),
      highlights: highlightsResp.data ?? [],
    });
  } catch (error) {
    console.error('[api/my-picks]', error);
    return NextResponse.json(
      { error: 'Failed to load picks' },
      { status: 500 },
    );
  }
}
