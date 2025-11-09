import { NextResponse, type NextRequest } from 'next/server';

import { createServerSupabase } from '@/lib/supabase';

export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('weekly_xp_ranking_current')
      .select('user_id, full_name, week_start_monday, weekly_xp')
      .eq('user_id', user.id)
      .single<{ week_start_monday: string | null; weekly_xp: number | null }>();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({
      weekStart: data?.week_start_monday ?? null,
      xp: data?.weekly_xp ?? 0,
    });
  } catch (error) {
    console.error('[api/me/weekly-xp]', error);
    return NextResponse.json(
      { error: 'Failed to load weekly XP balance' },
      { status: 500 },
    );
  }
}
