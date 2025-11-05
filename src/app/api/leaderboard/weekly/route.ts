import { NextResponse } from 'next/server';

import { visibleWeekStartET } from '@/lib/time';
import { getWeeklyRankingCurrent } from '@/server/services/xp.service';

export async function GET() {
  try {
    const ranking = await getWeeklyRankingCurrent();
    const weekStart = ranking[0]?.week_start_sunday ?? visibleWeekStartET();

    return NextResponse.json({
      weekStart,
      ranking,
    });
  } catch (error) {
    console.error('[api/leaderboard/weekly]', error);
    return NextResponse.json(
      { error: 'Failed to load weekly ranking' },
      { status: 500 },
    );
  }
}
