import { NextResponse } from 'next/server';

import { visibleWeekStartET } from '@/lib/time';
import { createServerSupabase } from '@/lib/supabase';
import { getMyWeeklyXPVisible } from '@/server/services/xp.service';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const weekStart = visibleWeekStartET();
    const xp = await getMyWeeklyXPVisible(user.id);
    return NextResponse.json({ weekStart, xp });
  } catch (error) {
    console.error('[api/me/weekly-xp]', error);
    return NextResponse.json(
      { error: 'Failed to load weekly XP balance' },
      { status: 500 },
    );
  }
}
