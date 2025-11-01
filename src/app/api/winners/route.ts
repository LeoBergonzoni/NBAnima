import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import {
  toEasternYYYYMMDD,
  yesterdayInEastern,
} from '@/lib/date-us-eastern';
import { createAdminSupabaseClient } from '@/lib/supabase';
import {
  SlateDateSchema,
  WinnersResponseSchema,
} from '@/lib/types-winners';
import { getWinnersByDate } from '@/server/services/winners.service';

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
  const supabaseAdmin = createAdminSupabaseClient();

  try {
    const date = resolveSlateDate(request);
    const data = await getWinnersByDate(supabaseAdmin, date);
    const payload = WinnersResponseSchema.parse({
      date,
      ...data,
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid date parameter. Expected format YYYY-MM-DD.' },
        { status: 400 },
      );
    }
    console.error('[api/winners]', error);
    return NextResponse.json(
      { error: 'Failed to load winners' },
      { status: 500 },
    );
  }
}
