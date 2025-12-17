import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase';
import { getRosters, resolveTeamKey, slugTeam, type RosterPlayer } from '@/lib/rosters';
import {
  getEspnPlayersByProviderIds,
  normalizeProviderId,
  stripJerseyNumber,
} from '@/server/services/players.service';

// 🔒 niente cache/ISR/CDN: evita che Netlify serva la risposta della prima partita alle successive
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

// ⛔️ disabilita cache; dichiara che la risposta varia per parametri di query
const headers = new Headers({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Vary': 'homeId, homeAbbr, homeName, awayId, awayAbbr, awayName',
});

const mapPlayer = (player: RosterPlayer, teamId: string, espnRow?: { id: string; first_name?: string | null; last_name?: string | null }): PlayerLite => {
  const fullName = player.name ? player.name.replace(/\s+/g, ' ').trim() : `Player ${player.id}`;
  const parts = fullName.split(' ');
  const firstName = espnRow?.first_name ?? parts[0] ?? fullName;
  const lastName = espnRow?.last_name ?? parts.slice(1).join(' ');
  return {
    // 🔑 always use ESPN player.id as value exposed to the dashboard
    id: espnRow?.id ?? player.id,
    full_name: [firstName, lastName].filter(Boolean).join(' ').trim() || fullName,
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
    if (!candidate || !candidate.trim()) continue;
    const raw = candidate.trim();
    const normalized = slugTeam(raw);
    attempts.push({ raw, normalized });
    const resolved = await resolveTeamKey(raw);
    if (resolved) return { key: resolved, attempts };
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
      { status: 404, headers },
    );
  }

  if (!awayParams.id && !awayParams.abbr && !awayParams.name) {
    return NextResponse.json(
      { ok: false, error: 'missing-team', missing: { team: 'away', tried: [] } },
      { status: 404, headers },
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
        missing: { team: 'home', input: homeParams, attempts: homeResolution?.attempts ?? [] },
      },
      { status: 404, headers },
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
        missing: { team: 'away', input: awayParams, attempts: awayResolution?.attempts ?? [] },
      },
      { status: 404, headers },
    );
  }

  const homeRoster = rosters[homeResolution.key] ?? [];
  const awayRoster = rosters[awayResolution.key] ?? [];

  // ESPN-only mapping: resolve roster provider IDs to ESPN player UUIDs (source of truth).
  const providerIds = [
    ...homeRoster.map((p) => p.id),
    ...awayRoster.map((p) => p.id),
  ].filter(Boolean);
  const supabaseAdmin = createAdminSupabaseClient();
  const espnByProvider = await getEspnPlayersByProviderIds(supabaseAdmin, providerIds);

  const missingProviderIds: string[] = [];
  const mapRoster = (roster: RosterPlayer[], teamKey: string) =>
    roster
      .map((p) => {
        const normalizedId = normalizeProviderId(p.id);
        const jerseylessId = stripJerseyNumber(normalizedId);
        const espn =
          espnByProvider.get(p.id) ??
          espnByProvider.get(normalizedId) ??
          espnByProvider.get(jerseylessId) ??
          null;
        if (!espn) {
          missingProviderIds.push(p.id);
          return null;
        }
        return mapPlayer(p, teamKey, {
          id: espn.id,
          first_name: espn.first_name,
          last_name: espn.last_name,
        });
      })
      .filter(Boolean) as PlayerLite[];

  const payload = {
    ok: true as const,
    source: 'local-rosters' as const,
    home: mapRoster(homeRoster, homeResolution.key),
    away: mapRoster(awayRoster, awayResolution.key),
  };

  if (missingProviderIds.length > 0) {
    console.warn('[api/players] missing ESPN mapping for roster ids (filtered out)', {
      missingProviderIds: Array.from(new Set(missingProviderIds)),
      note: 'provider ids normalized by stripping trailing -g/-f/-c; jersey numbers and dot suffix variants also tried when matching',
    });
  }

  return NextResponse.json(payload, { status: 200, headers });
}
