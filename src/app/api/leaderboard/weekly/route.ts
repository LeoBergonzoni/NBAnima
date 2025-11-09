import { NextResponse } from 'next/server';

import { getWeeklyRankingCurrent } from '@/server/services/xp.service';

export async function GET() {
  try {
    const { ranking, weekStart } = await getWeeklyRankingCurrent();

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
