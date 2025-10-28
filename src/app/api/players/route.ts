import { NextResponse } from 'next/server';

import { getServerEnv } from '@/lib/env';

async function fetchBalldontlie(
  path: string,
  search?: Record<string, string | number | undefined>,
) {
  const base = 'https://api.balldontlie.io/v1';
  const url = new URL(base + path);
  if (search) {
    Object.entries(search).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const { BALLDONTLIE_API_KEY } = getServerEnv();
  const response = await fetch(url.toString(), {
    headers: BALLDONTLIE_API_KEY ? { Authorization: BALLDONTLIE_API_KEY } : {},
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`balldontlie ${response.status}: ${text || response.statusText}`);
  }

  return response.json();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const homeId = searchParams.get('home_id');
    const awayId = searchParams.get('away_id');
    const season = searchParams.get('season') ?? '';

    if (!homeId || !awayId) {
      return NextResponse.json(
        { error: 'home_id and away_id are required' },
        { status: 400 },
      );
    }

    const per_page = 100;
    const [home, away] = await Promise.all([
      fetchBalldontlie('/players', { 'team_ids[]': homeId, per_page, season }),
      fetchBalldontlie('/players', { 'team_ids[]': awayId, per_page, season }),
    ]);

    const normalize = (list: any[], teamId: string) =>
      (list ?? []).map((player) => ({
        id: String(player.id),
        full_name: [player.first_name, player.last_name].filter(Boolean).join(' ').trim(),
        number: player.jersey_number ?? player.jersey ?? null,
        position: player.position ?? '',
        team_id: teamId,
        active: player.active ?? true,
      }));

    const players = [
      ...normalize(home.data, String(homeId)),
      ...normalize(away.data, String(awayId)),
    ];

    return NextResponse.json({ ok: true, players }, { status: 200 });
  } catch (error: unknown) {
    console.error('[api/players] Error:', error);
    return NextResponse.json(
      { ok: false, error: String((error as Error)?.message ?? error) },
      { status: 500 },
    );
  }
}
