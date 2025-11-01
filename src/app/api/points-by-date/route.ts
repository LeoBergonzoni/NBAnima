import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import {
  createAdminSupabaseClient,
  createServerSupabase,
} from '@/lib/supabase';
import {
  PointsResponseSchema,
  SlateDateSchema,
} from '@/lib/types-winners';
import { toEasternYYYYMMDD, yesterdayInEastern } from '@/lib/date-us-eastern';
import { getPointsByDate } from '@/server/services/winners.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const resolveSlateDate = (request: NextRequest) => {
  const fallback = toEasternYYYYMMDD(yesterdayInEastern());
  const input = request.nextUrl.searchParams.get('date') ?? fallback;
  const parsed = SlateDateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ZodError(parsed.error.issues);
  }
  return parsed.data;
};

export async function GET(request: NextRequest) {
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

  const supabaseAdmin = createAdminSupabaseClient();

  try {
    const date = resolveSlateDate(request);
    const result = await getPointsByDate(supabaseAdmin, user.id, date);
    const payload = PointsResponseSchema.parse(result);

    return NextResponse.json({
      ...payload,
      total: payload.total_points,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid date parameter. Expected format YYYY-MM-DD.' },
        { status: 400 },
      );
    }
    console.error('[api/points-by-date]', error);
    return NextResponse.json(
      { error: 'Failed to load points for date' },
      { status: 500 },
    );
  }
}
