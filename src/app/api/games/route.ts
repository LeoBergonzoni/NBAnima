import { NextResponse } from 'next/server';

import { listNextNightGames } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const games = await listNextNightGames();
    return NextResponse.json(games);
  } catch (error) {
    console.error('[api/games]', error);
    return NextResponse.json(
      { error: 'Failed to load games' },
      { status: 500 },
    );
  }
}
