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
    const players = await provider.listPlayersForGame(gameId);

    return NextResponse.json(players);
  } catch (error) {
    console.error('[api/players]', error);
    return NextResponse.json(
      { error: 'Failed to load players' },
      { status: 500 },
    );
  }
}
