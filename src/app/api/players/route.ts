import { NextResponse } from 'next/server';

import { getRosters, resolveTeamKey, slugTeam, type RosterPlayer } from '@/lib/rosters';

export const runtime = 'nodejs';

type PlayerLite = {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team_id: string;
  jersey?: string | null;
};

type TeamQuery = {
  id: string | null;
  abbr: string | null;
  name: string | null;
};

type Resolution = {
  key: string;
  attempts: Array<{ raw: string; normalized: string }>;
};

const headers = new Headers({
  'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
});

const mapPlayer = (player: RosterPlayer, teamId: string): PlayerLite => {
  const fullName = player.name ? player.name.replace(/\s+/g, ' ').trim() : `Player ${player.id}`;
  const parts = fullName.split(' ');
  const firstName = parts[0] ?? fullName;
  const lastName = parts.slice(1).join(' ');
  return {
    id: player.id,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    position: (player.pos ?? '').toUpperCase(),
    team_id: teamId,
    jersey: player.jersey ?? null,
  };
};

const readTeamParams = (params: URLSearchParams, prefix: 'home' | 'away'): TeamQuery => ({
  id: params.get(`${prefix}Id`) ?? params.get(`${prefix}_id`),
  abbr: params.get(`${prefix}Abbr`) ?? params.get(`${prefix}_abbr`),
  name: params.get(`${prefix}Name`) ?? params.get(`${prefix}_name`),
});

const resolveFromCandidates = async (
  candidates: Array<string | null>,
): Promise<Resolution | null> => {
  const attempts: Array<{ raw: string; normalized: string }> = [];
  for (const candidate of candidates) {
    if (!candidate || !candidate.trim()) {
      continue;
    }
    const raw = candidate.trim();
    const normalized = slugTeam(raw);
    attempts.push({ raw, normalized });
    const resolved = await resolveTeamKey(raw);
    if (resolved) {
      return { key: resolved, attempts };
    }
  }
  return attempts.length ? { key: '', attempts } : null;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const homeParams = readTeamParams(searchParams, 'home');
  const awayParams = readTeamParams(searchParams, 'away');

  if (!homeParams.id && !homeParams.abbr && !homeParams.name) {
    return NextResponse.json(
      { ok: false, error: 'missing-team', missing: { team: 'home', tried: [] } },
      { status: 404 },
    );
  }

  if (!awayParams.id && !awayParams.abbr && !awayParams.name) {
    return NextResponse.json(
      { ok: false, error: 'missing-team', missing: { team: 'away', tried: [] } },
      { status: 404 },
    );
  }

  const rosters = await getRosters();

  const homeResolution = await resolveFromCandidates([
    homeParams.id,
    homeParams.abbr,
    homeParams.name,
  ]);

  if (!homeResolution || !homeResolution.key) {
    console.warn('[api/players] Missing home roster entry', {
      input: homeParams,
      attempts: homeResolution?.attempts ?? [],
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'missing-team',
        missing: {
          team: 'home',
          input: homeParams,
          attempts: homeResolution?.attempts ?? [],
        },
      },
      { status: 404 },
    );
  }

  const awayResolution = await resolveFromCandidates([
    awayParams.id,
    awayParams.abbr,
    awayParams.name,
  ]);

  if (!awayResolution || !awayResolution.key) {
    console.warn('[api/players] Missing away roster entry', {
      input: awayParams,
      attempts: awayResolution?.attempts ?? [],
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'missing-team',
        missing: {
          team: 'away',
          input: awayParams,
          attempts: awayResolution?.attempts ?? [],
        },
      },
      { status: 404 },
    );
  }

  const homeRoster = rosters[homeResolution.key] ?? [];
  const awayRoster = rosters[awayResolution.key] ?? [];

  const payload = {
    ok: true as const,
    source: 'local-rosters' as const,
    home: homeRoster.map((player) => mapPlayer(player, homeResolution.key)),
    away: awayRoster.map((player) => mapPlayer(player, awayResolution.key)),
  };

  return NextResponse.json(payload, { status: 200, headers });
}
