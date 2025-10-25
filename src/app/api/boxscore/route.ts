import { NextResponse, type NextRequest } from 'next/server';

import { getGameProvider } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const gameId = searchParams.get('gameId');

  if (!gameId) {
    return NextResponse.json(
      { error: '`gameId` query parameter is required' },
      { status: 400 },
    );
  }

  try {
    const provider = getGameProvider();
    const results = await provider.getGameResults(gameId);

    return NextResponse.json(results);
  } catch (error) {
    console.error('[api/boxscore]', error);
    return NextResponse.json(
      { error: 'Failed to load box score' },
      { status: 500 },
    );
  }
}
