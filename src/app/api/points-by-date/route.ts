import { NextResponse, type NextRequest } from 'next/server';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays, subDays } from 'date-fns';
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

const getBounds = (date: string) => {
  const start = fromZonedTime(`${date}T00:00:00`, TIMEZONES.US_EASTERN);
  const end = addDays(start, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export async function GET(request: NextRequest) {
  const supabaseAdmin = createAdminSupabaseClient();
  const supabase = await createServerSupabase();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[api/points-by-date] auth error', userError);
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

  const targetDate = parseResult.data;
  const { start, end } = getBounds(targetDate);

  try {
    const { data, error } = await supabaseAdmin
      .from('anima_points_ledger')
      .select('delta, created_at')
      .eq('user_id', user.id)
      .gte('created_at', start)
      .lt('created_at', end);

    if (error) {
      throw error;
    }

    const total = (data ?? []).reduce((sum, entry) => sum + (entry.delta ?? 0), 0);

    return NextResponse.json({
      date: targetDate,
      total,
    });
  } catch (error) {
    console.error('[api/points-by-date]', error);
    return NextResponse.json(
      { error: 'Failed to load points for date' },
      { status: 500 },
    );
  }
}
