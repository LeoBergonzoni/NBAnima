import { NextResponse, type NextRequest } from 'next/server';

import {
  createAdminSupabaseClient,
  createServerSupabase,
} from '@/lib/supabase';
import type { TablesRow } from '@/lib/supabase.types';

type TeamPickRow = TablesRow<'picks_teams'>;

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(request: NextRequest) {
  const slateDate = request.nextUrl.searchParams.get('slateDate');

  if (!slateDate || !isValidDate(slateDate)) {
    return NextResponse.json(
      { error: 'Missing or invalid slateDate parameter' },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: picks, error: picksError } = await supabase
      .from('picks_teams')
      .select(
        'game_id, selected_team_id, selected_team_abbr, selected_team_name, pick_date',
      )
      .eq('user_id', user.id)
      .eq('pick_date', slateDate)
      .returns<
        Pick<
          TeamPickRow,
          'game_id' | 'selected_team_id' | 'selected_team_abbr' | 'selected_team_name' | 'pick_date'
        >[]
      >();

    if (picksError) {
      throw picksError;
    }

    const supabaseAdmin = createAdminSupabaseClient();
    const { data: winners, error: winnersError } = await supabaseAdmin
      .from('v_results_team_with_names')
      .select('game_id, winner_team_id')
      .eq('slate_date', slateDate);

    if (winnersError) {
      throw winnersError;
    }

    const byGame = new Map<string, string | null>(
      (winners ?? []).map((winner) => [winner.game_id, winner.winner_team_id]),
    );

    const payload = (picks ?? []).map((pick) => {
      const resolvedWinner = byGame.get(pick.game_id);
      let outcome: 'WIN' | 'LOSS' | 'PENDING' = 'PENDING';

      if (resolvedWinner) {
        outcome =
          resolvedWinner === pick.selected_team_id ? 'WIN' : 'LOSS';
      } else if (resolvedWinner === null) {
        outcome = 'PENDING';
      }

      return {
        game_id: pick.game_id,
        slate_date: pick.pick_date,
        selected_team_id: pick.selected_team_id,
        selected_team_name: pick.selected_team_name ?? null,
        selected_team_abbr: pick.selected_team_abbr ?? null,
        outcome,
        winner_team_id: resolvedWinner ?? undefined,
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[api/my-picks-with-outcome]', error);
    return NextResponse.json(
      { error: 'Failed to load picks' },
      { status: 500 },
    );
  }
}
