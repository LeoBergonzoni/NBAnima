import { NextResponse } from 'next/server';

import { getServerEnv } from '@/lib/env';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
type CachedEntry = { expiresAt: number; players: PlayerResponse[] };
const playersCache = new Map<string, CachedEntry>();

type PlayerResponse = {
  id: string;
  full_name: string;
  number: string | number | null;
  position: string;
  team_id: string;
  active: boolean;
};

class BalldontlieError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message);
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    headers: BALLDONTLIE_API_KEY
      ? { Authorization: BALLDONTLIE_API_KEY }
      : {},
    next: { revalidate: 3600 },
    credentials: 'omit',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new BalldontlieError(
      `balldontlie ${response.status}: ${text || response.statusText}`,
      response.status,
      text,
    );
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

    const cacheKey = `${homeId}:${awayId}:${season}`;
    const cached = playersCache.get(cacheKey);
    const now = Date.now();
    let cachedPlayers: PlayerResponse[] | null = null;
    if (cached) {
      if (cached.expiresAt > now) {
        cachedPlayers = cached.players;
      } else {
        playersCache.delete(cacheKey);
      }
    }

    const headers = new Headers({
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
    });

    const per_page = 100;
    const normalize = (list: any[], teamId: string): PlayerResponse[] =>
      (list ?? []).map((player) => ({
        id: String(player.id),
        full_name: [player.first_name, player.last_name]
          .filter(Boolean)
          .join(' ')
          .trim(),
        number: player.jersey_number ?? player.jersey ?? null,
        position: player.position ?? '',
        team_id: teamId,
        active: player.active ?? true,
      }));

    const fetchTeams = () =>
      Promise.all([
        fetchBalldontlie('/players', {
          'team_ids[]': homeId,
          per_page,
          season,
        }),
        fetchBalldontlie('/players', {
          'team_ids[]': awayId,
          per_page,
          season,
        }),
      ]);

    let homeData: any;
    let awayData: any;

    try {
      [homeData, awayData] = await fetchTeams();
    } catch (initialError) {
      const shouldRetry =
        initialError instanceof BalldontlieError &&
        initialError.status === 429;
      if (shouldRetry) {
        await delay(1000);
        try {
          [homeData, awayData] = await fetchTeams();
        } catch (retryError) {
          if (cachedPlayers) {
            console.warn(
              '[api/players] returning cached data after rate limit retry failure',
              retryError,
            );
            headers.set('x-nb-cache', 'hit');
            return NextResponse.json(
              { ok: true, players: cachedPlayers, cached: true },
              { status: 200, headers },
            );
          }
          throw retryError;
        }
      } else {
        if (cachedPlayers) {
          console.warn(
            '[api/players] returning cached data after upstream error',
            initialError,
          );
          headers.set('x-nb-cache', 'hit');
          return NextResponse.json(
            { ok: true, players: cachedPlayers, cached: true },
            { status: 200, headers },
          );
        }
        throw initialError;
      }
    }

    const players = [
      ...normalize(homeData.data, String(homeId)),
      ...normalize(awayData.data, String(awayId)),
    ];

    playersCache.set(cacheKey, {
      players,
      expiresAt: now + CACHE_TTL_MS,
    });
    headers.set('x-nb-cache', cachedPlayers ? 'refreshed' : 'miss');

    return NextResponse.json({ ok: true, players }, { status: 200, headers });
  } catch (error: unknown) {
    console.error('[api/players] Error:', error);
    return NextResponse.json(
      { ok: false, error: String((error as Error)?.message ?? error) },
      { status: 500 },
    );
  }
}
