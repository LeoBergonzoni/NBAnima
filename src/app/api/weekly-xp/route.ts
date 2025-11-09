import { NextResponse, type NextRequest } from 'next/server';

import { mondayFromSundayWeekStart, weeklyXpWeekContext } from '@/lib/time';
import { getWeeklyTotalsByWeek } from '@/server/services/xp.service';

const WEEK_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

type WeekStartResolution = {
  storageWeekStart: string;
  additionalWeekStart?: string;
  displayWeekStart: string;
};

const resolveWeekStart = (request: NextRequest): WeekStartResolution => {
  const input = request.nextUrl.searchParams.get('weekStart');
  if (input && WEEK_FORMAT.test(input)) {
    return {
      storageWeekStart: input,
      displayWeekStart: mondayFromSundayWeekStart(input),
    };
  }
  const context = weeklyXpWeekContext();
  return {
    storageWeekStart: context.storageWeekStart,
    additionalWeekStart: context.rolloverWeekStart,
    displayWeekStart: context.displayWeekStart,
  };
};

export async function GET(request: NextRequest) {
  try {
    const { storageWeekStart, additionalWeekStart, displayWeekStart } = resolveWeekStart(request);
    const totals = await getWeeklyTotalsByWeek(storageWeekStart, additionalWeekStart);

    return NextResponse.json({
      weekStart: displayWeekStart,
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
