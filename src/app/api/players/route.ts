import { NextResponse } from 'next/server';

import { getRosters, lookupTeamKeys, type RosterPlayer } from '@/lib/rosters';

export const runtime = 'nodejs';

type TeamParamSet = {
  id: string | null;
  abbr: string | null;
  name: string | null;
};

const buildTeamParams = (searchParams: URLSearchParams, prefix: 'home' | 'away'): TeamParamSet => {
  const id =
    searchParams.get(`${prefix}Id`) ??
    searchParams.get(`${prefix}_id`) ??
    null;
  const abbr =
    searchParams.get(`${prefix}Abbr`) ??
    searchParams.get(`${prefix}_abbr`) ??
    null;
  const name =
    searchParams.get(`${prefix}Name`) ??
    searchParams.get(`${prefix}_name`) ??
    null;
  return { id, abbr, name };
};

const resolveTeamPlayers = (
  label: 'home' | 'away',
  keys: string[],
  rosters: Record<string, RosterPlayer[]>,
  missingCollector: Set<string>,
): RosterPlayer[] => {
  for (const key of keys) {
    const players = rosters[key];
    if (players && players.length) {
      return players;
    }
  }
  if (keys.length === 0) {
    missingCollector.add(`${label}:<none>`);
  } else {
    keys.forEach((key) => missingCollector.add(`${label}:${key}`));
  }
  return [];
};

const headers = new Headers({
  'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const homeParams = buildTeamParams(searchParams, 'home');
    const awayParams = buildTeamParams(searchParams, 'away');

    const hasHomeIdentifier = Boolean(homeParams.id || homeParams.abbr || homeParams.name);
    const hasAwayIdentifier = Boolean(awayParams.id || awayParams.abbr || awayParams.name);

    if (!hasHomeIdentifier || !hasAwayIdentifier) {
      return NextResponse.json(
        { error: 'home team and away team identifiers are required' },
        { status: 400 },
      );
    }

    const rosters = await getRosters();
    const missing = new Set<string>();

    const homeKeys = lookupTeamKeys({
      id: homeParams.id ?? undefined,
      abbr: homeParams.abbr ?? undefined,
      name: homeParams.name ?? undefined,
    });
    const awayKeys = lookupTeamKeys({
      id: awayParams.id ?? undefined,
      abbr: awayParams.abbr ?? undefined,
      name: awayParams.name ?? undefined,
    });

    const homePlayers = resolveTeamPlayers('home', homeKeys, rosters, missing);
    const awayPlayers = resolveTeamPlayers('away', awayKeys, rosters, missing);

    const payload: {
      ok: true;
      players: { home: RosterPlayer[]; away: RosterPlayer[] };
      source: 'local-rosters';
      missing?: string[];
    } = {
      ok: true,
      players: {
        home: homePlayers,
        away: awayPlayers,
      },
      source: 'local-rosters',
    };

    if (missing.size > 0) {
      payload.missing = Array.from(missing);
    }

    return NextResponse.json(payload, { status: 200, headers });
  } catch (error: unknown) {
    console.error('[api/players] Error:', error);
    return NextResponse.json(
      { ok: false, error: String((error as Error)?.message ?? error) },
      { status: 500 },
    );
  }
}
