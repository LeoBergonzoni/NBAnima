import { NextResponse, type NextRequest } from 'next/server';

import { visibleWeekStartET } from '@/lib/time';
import { getWeeklyTotalsByWeek } from '@/server/services/xp.service';

const WEEK_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const resolveWeekStart = (request: NextRequest): string => {
  const input = request.nextUrl.searchParams.get('weekStart');
  if (input && WEEK_FORMAT.test(input)) {
    return input;
  }
  return visibleWeekStartET();
};

export async function GET(request: NextRequest) {
  try {
    const weekStart = resolveWeekStart(request);
    const totals = await getWeeklyTotalsByWeek(weekStart);

    return NextResponse.json({
      weekStart,
      totals,
    });
  } catch (error) {
    console.error('[api/weekly-xp]', error);
    return NextResponse.json(
      { error: 'Failed to load weekly XP totals' },
      { status: 500 },
    );
  }
}
