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

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const isUuidLike = (value: string) => UUID_REGEX.test(value);

const normalizeAbbr = (abbr?: string | null) =>
  typeof abbr === 'string' ? abbr.trim().toUpperCase() : '';

const parseJerseyFromProviderId = (providerId?: string | null) => {
  if (!providerId) return null;
  const match = providerId.match(/-(\d{1,2})(?:-|$)/);
  return match ? match[1] : null;
};

// ⛔️ disabilita cache; dichiara che la risposta varia per parametri di query
const headers = new Headers({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Vary': 'homeId, homeAbbr, homeName, awayId, awayAbbr, awayName',
});

const mapPlayer = (
  player: RosterPlayer,
  teamId: string,
  espnRow?: { id: string; first_name?: string | null; last_name?: string | null },
): PlayerLite => {
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

const resolveTeamRow = async (
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  params: TeamQuery,
) => {
  if (params.id && params.id.trim()) {
    const trimmed = params.id.trim();
    if (isUuidLike(trimmed)) {
      const { data } = await supabaseAdmin
        .from('teams')
        .select('id, abbr, name, provider_team_id')
        .eq('id', trimmed)
        .maybeSingle();
      if (data) return data;
    } else if (/^\d+$/.test(trimmed)) {
      const { data } = await supabaseAdmin
        .from('teams')
        .select('id, abbr, name, provider_team_id')
        .eq('provider_team_id', trimmed)
        .eq('provider', 'balldontlie')
        .maybeSingle();
      if (data) return data;
    }
  }

  const abbr = normalizeAbbr(params.abbr);
  if (abbr) {
    const { data } = await supabaseAdmin
      .from('teams')
      .select('id, abbr, name, provider_team_id')
      .eq('abbr', abbr)
      .maybeSingle();
    if (data) return data;
  }

  if (params.name && params.name.trim()) {
    const { data } = await supabaseAdmin
      .from('teams')
      .select('id, abbr, name, provider_team_id')
      .ilike('name', params.name.trim())
      .maybeSingle();
    if (data) return data;
  }

  return null;
};

const mapPlayerRow = (player: {
  id: string;
  provider_player_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  team_id: string;
}): PlayerLite => {
  const firstName = player.first_name?.trim() || '';
  const lastName = player.last_name?.trim() || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || `Player ${player.id}`;
  return {
    id: player.id,
    full_name: fullName,
    first_name: firstName || fullName,
    last_name: lastName,
    position: (player.position ?? '').toUpperCase(),
    team_id: player.team_id,
    jersey: parseJerseyFromProviderId(player.provider_player_id),
  };
};

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

  const supabaseAdmin = createAdminSupabaseClient();

  const [homeTeamRow, awayTeamRow] = await Promise.all([
    resolveTeamRow(supabaseAdmin, homeParams),
    resolveTeamRow(supabaseAdmin, awayParams),
  ]);

  const [homeDbPlayers, awayDbPlayers] = await Promise.all([
    homeTeamRow
      ? supabaseAdmin
          .from('player')
          .select('id, provider_player_id, first_name, last_name, position, team_id')
          .eq('team_id', homeTeamRow.id)
          .eq('active', true)
          .eq('provider', 'espn')
      : Promise.resolve({ data: [], error: null }),
    awayTeamRow
      ? supabaseAdmin
          .from('player')
          .select('id, provider_player_id, first_name, last_name, position, team_id')
          .eq('team_id', awayTeamRow.id)
          .eq('active', true)
          .eq('provider', 'espn')
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (homeDbPlayers.error) {
    throw homeDbPlayers.error;
  }
  if (awayDbPlayers.error) {
    throw awayDbPlayers.error;
  }

  const homeDbList = (homeDbPlayers.data ?? []).map(mapPlayerRow);
  const awayDbList = (awayDbPlayers.data ?? []).map(mapPlayerRow);
  const needsHomeRosterFallback = homeDbList.length === 0;
  const needsAwayRosterFallback = awayDbList.length === 0;

  if (!needsHomeRosterFallback && !needsAwayRosterFallback) {
    return NextResponse.json(
      {
        ok: true as const,
        source: 'supabase' as const,
        home: homeDbList,
        away: awayDbList,
      },
      { status: 200, headers },
    );
  }

  const rosters = await getRosters();

  const homeResolution = needsHomeRosterFallback
    ? await resolveFromCandidates([homeParams.id, homeParams.abbr, homeParams.name])
    : null;
  const awayResolution = needsAwayRosterFallback
    ? await resolveFromCandidates([awayParams.id, awayParams.abbr, awayParams.name])
    : null;

  if (needsHomeRosterFallback && (!homeResolution || !homeResolution.key)) {
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

  if (needsAwayRosterFallback && (!awayResolution || !awayResolution.key)) {
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

  const homeRoster = needsHomeRosterFallback ? rosters[homeResolution?.key ?? ''] ?? [] : [];
  const awayRoster = needsAwayRosterFallback ? rosters[awayResolution?.key ?? ''] ?? [] : [];

  // ESPN-only mapping: resolve roster provider IDs to ESPN player UUIDs (source of truth).
  const providerIds = [
    ...homeRoster.map((p) => p.id),
    ...awayRoster.map((p) => p.id),
  ].filter(Boolean);
  const espnByProvider = await getEspnPlayersByProviderIds(supabaseAdmin, providerIds);

  const missingProviderIds: string[] = [];
  const mapRoster = (roster: RosterPlayer[], teamKey: string, teamId?: string | null) =>
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
        return mapPlayer(p, teamId ?? teamKey, {
          id: espn.id,
          first_name: espn.first_name,
          last_name: espn.last_name,
        });
      })
      .filter(Boolean) as PlayerLite[];

  const source =
    needsHomeRosterFallback && needsAwayRosterFallback
      ? ('local-rosters' as const)
      : ('mixed' as const);
  const payload = {
    ok: true as const,
    source,
    home: needsHomeRosterFallback
      ? mapRoster(homeRoster, homeResolution?.key ?? '', homeTeamRow?.id ?? null)
      : homeDbList,
    away: needsAwayRosterFallback
      ? mapRoster(awayRoster, awayResolution?.key ?? '', awayTeamRow?.id ?? null)
      : awayDbList,
  };

  if (missingProviderIds.length > 0) {
    console.warn('[api/players] missing ESPN mapping for roster ids (filtered out)', {
      missingProviderIds: Array.from(new Set(missingProviderIds)),
      note: 'provider ids normalized by stripping trailing -g/-f/-c; jersey numbers and dot suffix variants also tried when matching',
    });
  }

  return NextResponse.json(payload, { status: 200, headers });
}
