import { NextResponse, type NextRequest } from 'next/server';

import { calculateUserSlatePoints } from '@/lib/scoring';
import { createServerSupabase } from '@/lib/supabase';

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
    const total = await calculateUserSlatePoints(user.id, slateDate);
    return NextResponse.json({ slateDate, total });
  } catch (error) {
    console.error('[api/me/anima-points]', error);
    return NextResponse.json(
      { error: 'Failed to calculate points' },
      { status: 500 },
    );
  }
}
