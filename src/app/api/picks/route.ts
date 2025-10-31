import { createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  assertLockWindowOpen,
  getDailyChangeCount,
  validatePicksPayload,
} from '@/lib/picks';
import {
  createAdminSupabaseClient,
  createServerSupabase,
} from '@/lib/supabase';
import { resolveOrUpsertGame, type ClientGameDTO } from '@/lib/server/resolveGame';
import type { Database } from '@/lib/supabase.types';
import {
  getRosters,
  resolveTeamKey,
  type RosterPlayer,
  type RostersMap,
} from '@/lib/rosters';
import { TIMEZONES } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Identificatore del “sorgente” per i tuoi ID esterni
const PLAYER_PROVIDER = 'local-rosters'; // o 'balldontlie' se preferisci unificare

type GameRow = {
  id: string; // uuid
  home_team_id: string; // uuid
  away_team_id: string; // uuid
  home_team_abbr: string | null;
  away_team_abbr: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
};

type GameContext = GameRow & {
  homeRosterKey: string | null;
  awayRosterKey: string | null;
};

function isUuidLike(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

function looksLikeAbbr(v: string) {
  return /^[A-Z]{2,4}$/.test(v);
}

function teamUuidFromAbbr(input?: string | null) {
  const value = (input ?? '').trim().toLowerCase();
  if (!value) {
    throw new Error('Cannot derive team UUID without an abbreviation');
  }
  const hash = createHash('sha1').update(`team:${value}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const canonicalTeamUuid = (value: string | null | undefined, abbr?: string | null) => {
  const rawValue = (value ?? '').trim();
  if (rawValue && isUuidLike(rawValue)) {
    return rawValue;
  }
  const normalizedAbbr = (abbr ?? rawValue).trim();
  if (!normalizedAbbr) {
    throw new Error('Cannot derive canonical team uuid without identifier');
  }
  return teamUuidFromAbbr(normalizedAbbr);
};

function norm(s?: string | null) {
  return String(s ?? '').trim().toLowerCase();
}

function slugName(s?: string | null) {
  return norm(s).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

type GameCtx = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_team_abbr?: string | null;
  away_team_abbr?: string | null;
  home_team_name?: string | null;
  away_team_name?: string | null;
};

function resolveTeamSelection(input: string, game: GameCtx) {
  const raw = (input ?? '').trim();
  if (!raw) {
    throw new Error('Missing team value');
  }

  const homeUuid = isUuidLike(game.home_team_id)
    ? game.home_team_id
    : teamUuidFromAbbr(game.home_team_abbr ?? game.home_team_id);
  const awayUuid = isUuidLike(game.away_team_id)
    ? game.away_team_id
    : teamUuidFromAbbr(game.away_team_abbr ?? game.away_team_id);

  if (raw === 'home') {
    return {
      uuid: homeUuid,
      abbr: game.home_team_abbr ?? null,
      name: game.home_team_name ?? null,
      side: 'home' as const,
    };
  }
  if (raw === 'away') {
    return {
      uuid: awayUuid,
      abbr: game.away_team_abbr ?? null,
      name: game.away_team_name ?? null,
      side: 'away' as const,
    };
  }

  if (isUuidLike(raw)) {
    const lowered = raw.toLowerCase();
    if (lowered === homeUuid.toLowerCase()) {
      return {
        uuid: homeUuid,
        abbr: game.home_team_abbr ?? null,
        name: game.home_team_name ?? null,
        side: 'home' as const,
      };
    }
    if (lowered === awayUuid.toLowerCase()) {
      return {
        uuid: awayUuid,
        abbr: game.away_team_abbr ?? null,
        name: game.away_team_name ?? null,
        side: 'away' as const,
      };
    }
    throw new Error(`Team UUID does not belong to this game: "${raw}"`);
  }

  if (looksLikeAbbr(raw)) {
    const upper = raw.toUpperCase();
    const homeAbbr = (game.home_team_abbr ?? '').toUpperCase();
    const awayAbbr = (game.away_team_abbr ?? '').toUpperCase();
    if (upper === homeAbbr) {
      return {
        uuid: homeUuid,
        abbr: game.home_team_abbr ?? null,
        name: game.home_team_name ?? null,
        side: 'home' as const,
      };
    }
    if (upper === awayAbbr) {
      return {
        uuid: awayUuid,
        abbr: game.away_team_abbr ?? null,
        name: game.away_team_name ?? null,
        side: 'away' as const,
      };
    }
    throw new Error(`Unknown team abbreviation for this game: "${raw}"`);
  }

  const slugInput = slugName(raw);
  if (slugInput) {
    const homeSlug = slugName(game.home_team_name);
    const awaySlug = slugName(game.away_team_name);
    if (slugInput === homeSlug) {
      return {
        uuid: homeUuid,
        abbr: game.home_team_abbr ?? null,
        name: game.home_team_name ?? null,
        side: 'home' as const,
      };
    }
    if (slugInput === awaySlug) {
      return {
        uuid: awayUuid,
        abbr: game.away_team_abbr ?? null,
        name: game.away_team_name ?? null,
        side: 'away' as const,
      };
    }
  }

  throw new Error(`Cannot resolve team from input "${raw}"`);
}

const collectRequestedGameUuids = (payload: {
  teams: Array<{ gameId: string }>;
  players: Array<{ gameId: string }>;
  gameUuids?: string[];
}) => {
  const ids = new Set<string>();
  payload.gameUuids?.forEach((uuid) => {
    if (uuid) {
      ids.add(String(uuid));
    }
  });
  payload.teams.forEach((pick) => {
    if (pick?.gameId) {
      ids.add(String(pick.gameId));
    }
  });
  payload.players.forEach((pick) => {
    if (pick?.gameId) {
      ids.add(String(pick.gameId));
    }
  });
  return Array.from(ids).filter(Boolean);
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizePayloadGameIds = async (
  payload: Record<string, unknown>,
  supabase: SupabaseClient<Database>,
) => {
  const normalized = payload as {
    gameUuids?: unknown;
    providerGameIds?: unknown;
    teams?: unknown;
    players?: unknown;
  };

  const resolvedUuidSet = new Set<string>();
  const providerIds = new Set<string>();

  const rawGameUuidValues = Array.isArray(normalized.gameUuids)
    ? (normalized.gameUuids as unknown[])
    : [];
  const cleanedGameUuids = rawGameUuidValues
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));
  cleanedGameUuids.forEach((value) => {
    if (UUID_REGEX.test(value)) {
      resolvedUuidSet.add(value);
    } else {
      providerIds.add(value);
    }
  });
  normalized.gameUuids = cleanedGameUuids;

  const rawProviderGameIds = Array.isArray(normalized.providerGameIds)
    ? (normalized.providerGameIds as unknown[])
    : [];
  const cleanedProviderGameIds = rawProviderGameIds
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));
  cleanedProviderGameIds.forEach((value) => providerIds.add(value));
  normalized.providerGameIds =
    cleanedProviderGameIds.length > 0 ? cleanedProviderGameIds : undefined;

  const pendingTeamUpdates: Array<{ pick: Record<string, unknown>; providerId: string }> = [];
  const pendingPlayerUpdates: Array<{ pick: Record<string, unknown>; providerId: string }> = [];

  const processPickArray = (
    entries: unknown,
    pending: Array<{ pick: Record<string, unknown>; providerId: string }>,
  ) => {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const pick = entry as Record<string, unknown>;
      const rawGameId = pick.gameId ?? pick.game_id;
      if (rawGameId === null || rawGameId === undefined) {
        return;
      }
      const stringValue = String(rawGameId);
      if (UUID_REGEX.test(stringValue)) {
        pick.gameId = stringValue;
        if ('game_id' in pick) {
          delete pick.game_id;
        }
        resolvedUuidSet.add(stringValue);
      } else {
        providerIds.add(stringValue);
        pending.push({ pick, providerId: stringValue });
      }
    });
  };

  processPickArray(normalized.teams, pendingTeamUpdates);
  processPickArray(normalized.players, pendingPlayerUpdates);

  const providerIdList = Array.from(providerIds);
  const providerToUuid = new Map<string, string>();

  if (providerIdList.length > 0) {
    const { data, error } = await supabase
      .from('games')
      .select('id, provider_game_id')
      .in('provider_game_id', providerIdList);

    if (error) {
      throw error;
    }

    (data ?? []).forEach((row) => {
      if (row?.provider_game_id && row?.id) {
        providerToUuid.set(String(row.provider_game_id), String(row.id));
      }
    });

    pendingTeamUpdates.forEach(({ pick, providerId }) => {
      const uuid = providerToUuid.get(providerId);
      if (uuid) {
        pick.gameId = uuid;
        if ('game_id' in pick) {
          delete pick.game_id;
        }
        resolvedUuidSet.add(uuid);
      }
    });

    pendingPlayerUpdates.forEach(({ pick, providerId }) => {
      const uuid = providerToUuid.get(providerId);
      if (uuid) {
        pick.gameId = uuid;
        if ('game_id' in pick) {
          delete pick.game_id;
        }
        resolvedUuidSet.add(uuid);
      }
    });

    providerIdList.forEach((providerId) => {
      const uuid = providerToUuid.get(providerId);
      if (uuid) {
        resolvedUuidSet.add(uuid);
      }
    });

    const missingProviderIds = providerIdList.filter((id) => !providerToUuid.has(id));
    if (missingProviderIds.length > 0) {
      return { missingProviderIds };
    }
  }

  normalized.gameUuids = Array.from(resolvedUuidSet);
  return { missingProviderIds: [] as string[] };
};

const loadGameContexts = async (
  supabase: SupabaseClient<Database>,
  gameUuids: string[],
) => {
  const map = new Map<string, GameContext>();
  if (gameUuids.length === 0) {
    return { map, missing: [] as string[] };
  }

  const { data, error } = await supabase
    .from('games')
    .select(
      `
        id,
        home_team_id,
        away_team_id,
        home_team_abbr,
        away_team_abbr,
        home_team_name,
        away_team_name
      `,
    )
    .in('id', gameUuids);

  if (error) {
    throw error;
  }

  const entries = data ?? [];
  const foundIds = new Set(entries.map((row) => row.id));
  const missing = gameUuids.filter((id) => !foundIds.has(id));

  const contexts = await Promise.all(
    entries.map(async (row) => {
      const canonicalHomeUuid = canonicalTeamUuid(row.home_team_id, row.home_team_abbr);
      const canonicalAwayUuid = canonicalTeamUuid(row.away_team_id, row.away_team_abbr);
      const homeRosterKey = await resolveTeamKey(
        row.home_team_abbr ?? row.home_team_name ?? null,
      );
      const awayRosterKey = await resolveTeamKey(
        row.away_team_abbr ?? row.away_team_name ?? null,
      );
      return {
        ...(row as GameRow),
        home_team_id: canonicalHomeUuid,
        away_team_id: canonicalAwayUuid,
        homeRosterKey,
        awayRosterKey,
      } satisfies GameContext;
    }),
  );

  contexts.forEach((context) => {
    map.set(context.id, context);
  });

  return { map, missing };
};

const matchPlayerInRoster = (
  playerId: string,
  roster: RosterPlayer[] | undefined,
): RosterPlayer | null => {
  if (!roster) {
    return null;
  }
  return roster.find((player) => player.id === playerId) ?? null;
};

const findPlayerInGame = (
  playerId: string,
  game: GameContext,
  rosters: RostersMap,
): { side: 'home' | 'away'; rosterPlayer: RosterPlayer | null } | null => {
  const homeRoster = game.homeRosterKey
    ? rosters[game.homeRosterKey] ?? []
    : [];
  const awayRoster = game.awayRosterKey
    ? rosters[game.awayRosterKey] ?? []
    : [];

  const homeMatch = matchPlayerInRoster(playerId, homeRoster);
  if (homeMatch) {
    return { side: 'home', rosterPlayer: homeMatch };
  }

  const awayMatch = matchPlayerInRoster(playerId, awayRoster);
  if (awayMatch) {
    return { side: 'away', rosterPlayer: awayMatch };
  }

  return null;
};

const findPlayerContext = (
  playerId: string,
  games: GameContext[],
  rosters: RostersMap,
) => {
  for (const game of games) {
    const match = findPlayerInGame(playerId, game, rosters);
    if (match) {
      return { game, ...match };
    }
  }
  return null;
};

async function getOrCreatePlayerUuid(opts: {
  supabase: SupabaseClient<Database>;
  provider: string;               // es. 'local-rosters'
  providerPlayerId: string;       // id esterno (dal roster.json)
  teamUuid: string;               // UUID della squadra (da games)
  firstName: string;
  lastName: string;
  position?: string | null;
}) {
  const { supabase, provider, providerPlayerId } = opts;

  // 1) cerco per chiave logica
  const { data: found, error: selErr } = await supabase
    .from('player')
    .select('id')
    .eq('provider', provider)
    .eq('provider_player_id', providerPlayerId)
    .maybeSingle();

  if (selErr) throw selErr;
  if (found?.id) return found.id;

  // 2) creo
  const { data: inserted, error: insErr } = await supabase
    .from('player')
    .insert({
      provider: provider,
      provider_player_id: providerPlayerId,
      team_id: opts.teamUuid,
      first_name: opts.firstName || 'N.',
      last_name: opts.lastName || 'N.',
      position: opts.position ?? null,
    })
    .select('id')
    .single();

  if (insErr) throw insErr;
  return inserted!.id;
}

// Utility per spezzare un full name in first/last
function splitName(full: string) {
  const clean = (full || '').trim();
  if (!clean) return { first: 'N.', last: 'N.' };
  const parts = clean.split(/\s+/);
  return {
    first: parts[0],
    last: parts.slice(1).join(' ') || parts[0],
  };
}

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const toDateNy = (iso: string | null | undefined, fallback: string) => {
  if (!iso) {
    return fallback;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONES.US_EASTERN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
};

type GameMetaLike = {
  providerGameId: string;
  season: string;
  status?: string;
  home?: { abbr?: string; name?: string };
  away?: { abbr?: string; name?: string };
  gameDateISO?: string;
};

const buildDtoFromMeta = (meta: GameMetaLike, pickDate: string): ClientGameDTO => ({
  provider: 'bdl',
  providerGameId: meta.providerGameId,
  season: meta.season,
  status: meta.status ?? 'scheduled',
  dateNY: toDateNy(meta.gameDateISO ?? null, pickDate),
  startTimeUTC: meta.gameDateISO ?? null,
  home: {
    abbr: meta.home?.abbr,
    name: meta.home?.name ?? meta.home?.abbr,
  },
  away: {
    abbr: meta.away?.abbr,
    name: meta.away?.name ?? meta.away?.abbr,
  },
});

type PicksTeamsInsert = Database['public']['Tables']['picks_teams']['Insert'];
type PicksPlayersInsert = Database['public']['Tables']['picks_players']['Insert'];
type PicksHighlightsInsert =
  Database['public']['Tables']['picks_highlights']['Insert'];

const getUserOrThrow = async (supabaseAdmin: SupabaseClient<Database>) => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return { authUser: user, role: profile?.role ?? 'user' };
};

const fetchPicks = async (
  supabaseAdmin: SupabaseClient<Database>,
  userId: string,
  pickDate: string,
) => {
  const [teamResp, playerResp, highlightsResp] = await Promise.all([
    supabaseAdmin
      .from('picks_teams')
      .select(
        `
          game_id,
          selected_team_id,
          selected_team_abbr,
          selected_team_name,
          updated_at,
          changes_count,
          game:game_id (
            id,
            home_team_abbr,
            away_team_abbr,
            home_team_name,
            away_team_name,
            home_team_id,
            away_team_id
          )
        `,
      )
      .eq('user_id', userId)
      .eq('pick_date', pickDate),
    supabaseAdmin
      .from('picks_players')
      .select(
        `
          game_id,
          category,
          player_id,
          updated_at,
          changes_count,
          player:player_id (
            first_name,
            last_name,
            position
          ),
          game:game_id (
            id,
            home_team_name,
            home_team_abbr,
            home_team_id,
            away_team_name,
            away_team_abbr,
            away_team_id
          )
        `,
      )
      .eq('user_id', userId)
      .eq('pick_date', pickDate),
    supabaseAdmin
      .from('picks_highlights')
      .select(
        `
          player_id,
          rank,
          updated_at,
          changes_count,
          player:player_id (
            first_name,
            last_name,
            position
          )
        `,
      )
      .eq('user_id', userId)
      .eq('pick_date', pickDate),
  ]);

  if (teamResp.error || playerResp.error || highlightsResp.error) {
    throw (
      teamResp.error ??
      playerResp.error ??
      highlightsResp.error ??
      new Error('Failed to load picks')
    );
  }

  const teams = (teamResp.data ?? []) as Array<
    Record<string, unknown> & { changes_count?: number | null }
  >;
  const players = (playerResp.data ?? []) as Array<
    Record<string, unknown> & { changes_count?: number | null }
  >;
  const highlights = (highlightsResp.data ?? []) as Array<
    Record<string, unknown> & { changes_count?: number | null }
  >;

  return {
    teams,
    players,
    highlights,
    changesCount: Math.max(
      ...teams.map((p) => p.changes_count ?? 0),
      ...players.map((p) => p.changes_count ?? 0),
      ...highlights.map((p) => p.changes_count ?? 0),
      0,
    ),
  };
};

export async function GET(request: NextRequest) {
  const supabaseAdmin = createAdminSupabaseClient();
  try {
    const { authUser: user, role } = await getUserOrThrow(supabaseAdmin);
    const pickDate =
      request.nextUrl.searchParams.get('date') ?? formatDate(new Date());
    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;

    const picks = await fetchPicks(supabaseAdmin, userId, pickDate);

    return NextResponse.json({
      pickDate,
      userId,
      ...picks,
    });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[api/picks][GET]', error);
    return NextResponse.json(
      { error: 'Failed to load picks' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = createAdminSupabaseClient();
  try {
    const { authUser: user, role } = await getUserOrThrow(supabaseAdmin);
    const rawBody = await request.json();
    const rawPayload = (rawBody ?? {}) as Record<string, unknown>;
    const payload = validatePicksPayload(rawPayload);
    payload.teams = payload.teams.map((pick) => ({ ...pick }));
    payload.players = payload.players.map((pick) => ({ ...pick }));
    payload.highlights = payload.highlights.map((pick) => ({ ...pick }));

    type GameMetaEntry = NonNullable<typeof payload.gamesMeta>[number];
    const gamesMetaByProvider = new Map<string, GameMetaEntry>();
    payload.gamesMeta?.forEach((meta) => {
      if (meta?.providerGameId) {
        gamesMetaByProvider.set(meta.providerGameId, meta);
      }
    });

    const gameRefsByProvider = new Map<string, { dto?: ClientGameDTO }>();
    payload.gameRefs?.forEach((ref) => {
      if (ref?.providerGameId) {
        gameRefsByProvider.set(ref.providerGameId, { dto: ref.dto });
      }
    });

    const resolvedGameIds = new Set<string>(
      Array.isArray(payload.gameUuids) ? payload.gameUuids : [],
    );
    const providerToResolvedId = new Map<string, string>();
    const refToResolvedId = new Map<string, string>();

    resolvedGameIds.forEach((uuid) => {
      refToResolvedId.set(uuid, uuid);
    });

    if (Array.isArray(payload.gameRefs) && payload.gameRefs.length > 0) {
      for (const ref of payload.gameRefs) {
        try {
          const dto =
            ref.dto ??
            (() => {
              const meta = gamesMetaByProvider.get(ref.providerGameId);
              return meta ? buildDtoFromMeta(meta, payload.pickDate) : undefined;
            })();

          const result = await resolveOrUpsertGame({
            supabaseAdmin,
            gameProvider: ref.provider ?? 'bdl',
            providerGameId: ref.providerGameId,
            dto,
          });

          resolvedGameIds.add(result.id);
          providerToResolvedId.set(ref.providerGameId, result.id);
          refToResolvedId.set(ref.providerGameId, result.id);
        } catch (error) {
          console.error('[api/picks][POST] resolve gameRef failed', {
            providerGameId: ref.providerGameId,
            error,
          });
        }
      }
    }

    if (resolvedGameIds.size === 0) {
      return NextResponse.json({ error: 'GAME_NOT_FOUND' }, { status: 404 });
    }

    const resolveGameForPick = async (
      gameReference: {
        gameId?: string;
        gameProvider?: 'bdl';
        providerGameId?: string;
        dto?: ClientGameDTO;
      },
    ) => {
      const rawGameId = gameReference.gameId;
      const isUuidGameId = rawGameId && isUuidLike(rawGameId);
      const providerGameId =
        gameReference.providerGameId ?? (!isUuidGameId && rawGameId ? rawGameId : undefined);
      const ref = providerGameId ? gameRefsByProvider.get(providerGameId) : undefined;
      const dto =
        gameReference.dto ??
        ref?.dto ??
        (providerGameId
          ? (() => {
              const meta = gamesMetaByProvider.get(providerGameId);
              return meta ? buildDtoFromMeta(meta, payload.pickDate) : undefined;
            })()
          : undefined);

      const result = await resolveOrUpsertGame({
        supabaseAdmin,
        gameId: isUuidGameId ? rawGameId : undefined,
        gameProvider: gameReference.gameProvider ?? dto?.provider,
        providerGameId,
        dto,
      });

      if (rawGameId) {
        refToResolvedId.set(rawGameId, result.id);
      }
      if (providerGameId) {
        providerToResolvedId.set(providerGameId, result.id);
        refToResolvedId.set(providerGameId, result.id);
      }
      resolvedGameIds.add(result.id);
      return result.id;
    };

    for (const pick of payload.teams) {
      try {
        const resolvedId = await resolveGameForPick(pick);
        pick.gameId = resolvedId;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'GAME_NOT_FOUND';
        if (message === 'GAME_NOT_FOUND' || message === 'TEAM_NOT_FOUND') {
          return NextResponse.json({ error: message }, { status: 404 });
        }
        console.error('[api/picks][POST] resolve game for team failed', error);
        return NextResponse.json({ error: 'GAME_RESOLUTION_FAILED' }, { status: 500 });
      }
    }

    for (const pick of payload.players) {
      if (isUuidLike(pick.gameId)) {
        resolvedGameIds.add(pick.gameId);
        continue;
      }
      const knownResolved =
        refToResolvedId.get(pick.gameId) ?? providerToResolvedId.get(pick.gameId);
      if (knownResolved) {
        pick.gameId = knownResolved;
        resolvedGameIds.add(knownResolved);
        continue;
      }
      try {
        const resolvedId = await resolveGameForPick({
          gameId: pick.gameId,
          gameProvider: 'bdl',
          providerGameId: pick.gameId,
        });
        pick.gameId = resolvedId;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'GAME_NOT_FOUND';
        if (message === 'GAME_NOT_FOUND' || message === 'TEAM_NOT_FOUND') {
          return NextResponse.json({ error: message }, { status: 404 });
        }
        console.error('[api/picks][POST] resolve game for player failed', error);
        return NextResponse.json({ error: 'GAME_RESOLUTION_FAILED' }, { status: 500 });
      }
    }

    payload.gameUuids = Array.from(resolvedGameIds);

    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;

    if (role !== 'admin') {
      await assertLockWindowOpen(supabaseAdmin, payload.pickDate);
    }

    const requestedGameUuids = collectRequestedGameUuids(payload);
    const { map: gamesMap, missing: missingGameUuids } = await loadGameContexts(
      supabaseAdmin,
      requestedGameUuids,
    );
    if (missingGameUuids.length > 0) {
      return NextResponse.json(
        {
          error: 'Unknown game uuid(s)',
          missingGameUuids,
        },
        { status: 400 },
      );
    }

    const currentChanges = await getDailyChangeCount(
      supabaseAdmin,
      userId,
      payload.pickDate,
    );
    if (currentChanges > 0 && role !== 'admin') {
      return NextResponse.json(
        { error: 'Picks already exist for this day. Use PUT to update once.' },
        { status: 409 },
      );
    }

    const gameList = Array.from(gamesMap.values());
    const rosters = await getRosters();
    const now = new Date().toISOString();

    await supabaseAdmin.from('picks_teams').delete().match({
      user_id: userId,
      pick_date: payload.pickDate,
    });
    await supabaseAdmin.from('picks_players').delete().match({
      user_id: userId,
      pick_date: payload.pickDate,
    });
    await supabaseAdmin.from('picks_highlights').delete().match({
      user_id: userId,
      pick_date: payload.pickDate,
    });

    const teamRecords: PicksTeamsInsert[] = payload.teams.map((pick) => {
      const game = gamesMap.get(pick.gameId);
      if (!game) {
        throw new Error(`Unknown game(s): ${pick.gameId}`);
      }

      if (looksLikeAbbr(pick.teamId)) {
        console.warn('[teams] abbreviation received from client, resolving server-side', {
          pick,
          gameId: pick.gameId,
        });
      }

      const sel = resolveTeamSelection(pick.teamId, game);

      console.debug('[teams] resolve', {
        input: pick.teamId,
        gameId: pick.gameId,
        resolved: sel,
      });

      if (!isUuidLike(sel.uuid)) {
        throw new Error(`Resolved selected_team_id is not a uuid-like value: "${sel.uuid}" from "${pick.teamId}"`);
      }

      return {
        user_id: userId,
        game_id: game.id,
        selected_team_id: sel.uuid,
        selected_team_abbr: sel.abbr ?? null,
        selected_team_name: sel.name ?? null,
        pick_date: payload.pickDate,
        changes_count: 0,
        created_at: now,
        updated_at: now,
      } satisfies PicksTeamsInsert;
    });

    for (const record of teamRecords) {
      if (!isUuidLike(record.selected_team_id as string)) {
        throw new Error(`Non-UUID selected_team_id about to be inserted: ${record.selected_team_id}`);
      }
    }

    const playerReferenceGames = payload.players
      .map((pick) => gamesMap.get(pick.gameId))
      .filter((value): value is GameContext => Boolean(value));

    const playerInsert: PicksPlayersInsert[] = await Promise.all(
      payload.players.map(async (pick) => {
        const game = gamesMap.get(pick.gameId);
        if (!game) {
          throw new Error(`Unknown game(s): ${pick.gameId}`);
        }
        const match = findPlayerInGame(pick.playerId, game, rosters);
        if (!match) {
          throw new Error(
            `Cannot resolve player "${pick.playerId}" for game ${pick.gameId}`,
          );
        }
        const { first, last } = splitName(pick.playerId);
        const playerUuid = await getOrCreatePlayerUuid({
          supabase: supabaseAdmin,
          provider: PLAYER_PROVIDER,
          providerPlayerId: pick.playerId,
          teamUuid: match.side === 'home' ? game.home_team_id : game.away_team_id,
          firstName: first,
          lastName: last,
          position: match.rosterPlayer?.pos ?? null,
        });
        return {
          user_id: userId,
          game_id: game.id,
          category: pick.category,
          player_id: playerUuid,
          pick_date: payload.pickDate,
          changes_count: 0,
          created_at: now,
          updated_at: now,
        };
      }),
    );

    const highlightInsert: PicksHighlightsInsert[] = await Promise.all(
      payload.highlights.map(async (pick) => {
        const directMatch = findPlayerContext(pick.playerId, gameList, rosters);
        const fallbackMatch =
          directMatch ??
          (playerReferenceGames.length > 0
            ? (() => {
                const fallbackGame = playerReferenceGames[0];
                const match = findPlayerInGame(pick.playerId, fallbackGame, rosters);
                return match ? { game: fallbackGame, ...match } : null;
              })()
            : null);
        if (!fallbackMatch) {
          throw new Error(
            `Cannot resolve player "${pick.playerId}" for highlights`,
          );
        }
        const { game, side, rosterPlayer } = fallbackMatch;
        const { first, last } = splitName(pick.playerId);
        const playerUuid = await getOrCreatePlayerUuid({
          supabase: supabaseAdmin,
          provider: PLAYER_PROVIDER,
          providerPlayerId: pick.playerId,
          teamUuid: side === 'home' ? game.home_team_id : game.away_team_id,
          firstName: first,
          lastName: last,
          position: rosterPlayer?.pos ?? null,
        });
        return {
          user_id: userId,
          player_id: playerUuid,
          rank: pick.rank,
          pick_date: payload.pickDate,
          changes_count: 0,
          created_at: now,
          updated_at: now,
        };
      }),
    );

    const [teamsResult, playersResult, highlightsResult] = await Promise.all([
      teamRecords.length
        ? supabaseAdmin.from('picks_teams').insert(teamRecords)
        : { error: null },
      playerInsert.length
        ? supabaseAdmin.from('picks_players').insert(playerInsert)
        : { error: null },
      highlightInsert.length
        ? supabaseAdmin.from('picks_highlights').insert(highlightInsert)
        : { error: null },
    ]);

    if (teamsResult.error || playersResult.error || highlightsResult.error) {
      throw (
        teamsResult.error ??
        playersResult.error ??
        highlightsResult.error ??
        new Error('Failed to save picks')
      );
    }

    return NextResponse.json(
      await fetchPicks(supabaseAdmin, userId, payload.pickDate),
      { status: 201 },
    );
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[api/picks][POST]', error);
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to save picks' },
      { status: 400 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const supabaseAdmin = createAdminSupabaseClient();
  try {
    const { authUser: user, role } = await getUserOrThrow(supabaseAdmin);
    const rawBody = await request.json();
    const rawPayload = (rawBody ?? {}) as Record<string, unknown>;
    const { missingProviderIds } = await normalizePayloadGameIds(rawPayload, supabaseAdmin);
    if (missingProviderIds.length > 0) {
      return NextResponse.json(
        {
          error: 'Unknown provider game id(s)',
          missingProviderIds,
        },
        { status: 400 },
      );
    }

    const payload = validatePicksPayload(rawPayload);
    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;

    if (role !== 'admin') {
      await assertLockWindowOpen(supabaseAdmin, payload.pickDate);
    }

    const requestedGameUuids = collectRequestedGameUuids(payload);
    const { map: gamesMap, missing: missingGameUuids } = await loadGameContexts(
      supabaseAdmin,
      requestedGameUuids,
    );
    if (missingGameUuids.length > 0) {
      return NextResponse.json(
        {
          error: 'Unknown game uuid(s)',
          missingGameUuids,
        },
        { status: 400 },
      );
    }

    const currentChanges = await getDailyChangeCount(
      supabaseAdmin,
      userId,
      payload.pickDate,
    );
    if (currentChanges >= 1 && role !== 'admin') {
      return NextResponse.json(
        { error: 'Daily change limit reached for this date.' },
        { status: 403 },
      );
    }

    const nextChangeCount = role === 'admin' ? currentChanges : currentChanges + 1;
    const now = new Date().toISOString();
    const gameList = Array.from(gamesMap.values());
    const rosters = await getRosters();

    await supabaseAdmin.from('picks_teams').delete().match({
      user_id: userId,
      pick_date: payload.pickDate,
    });
    await supabaseAdmin.from('picks_players').delete().match({
      user_id: userId,
      pick_date: payload.pickDate,
    });
    await supabaseAdmin.from('picks_highlights').delete().match({
      user_id: userId,
      pick_date: payload.pickDate,
    });

    const teamRecords: PicksTeamsInsert[] = payload.teams.map((pick) => {
      const game = gamesMap.get(pick.gameId);
      if (!game) {
        throw new Error(`Unknown game(s): ${pick.gameId}`);
      }

      if (looksLikeAbbr(pick.teamId)) {
        console.warn('[teams] abbreviation received from client, resolving server-side', {
          pick,
          gameId: pick.gameId,
        });
      }

      const sel = resolveTeamSelection(pick.teamId, game);

      console.debug('[teams] resolve', {
        input: pick.teamId,
        gameId: pick.gameId,
        resolved: sel,
      });

      if (!isUuidLike(sel.uuid)) {
        throw new Error(`Resolved selected_team_id is not a uuid-like value: "${sel.uuid}" from "${pick.teamId}"`);
      }

      return {
        user_id: userId,
        game_id: game.id,
        selected_team_id: sel.uuid,
        selected_team_abbr: sel.abbr ?? null,
        selected_team_name: sel.name ?? null,
        pick_date: payload.pickDate,
        changes_count: nextChangeCount ?? 0,
        created_at: now,
        updated_at: now,
      } satisfies PicksTeamsInsert;
    });

    for (const record of teamRecords) {
      if (!isUuidLike(record.selected_team_id as string)) {
        throw new Error(`Non-UUID selected_team_id about to be inserted: ${record.selected_team_id}`);
      }
    }

    const playerReferenceGames = payload.players
      .map((pick) => gamesMap.get(pick.gameId))
      .filter((value): value is GameContext => Boolean(value));

    const playerUpsert: PicksPlayersInsert[] = await Promise.all(
      payload.players.map(async (pick) => {
        const game = gamesMap.get(pick.gameId);
        if (!game) {
          throw new Error(`Unknown game(s): ${pick.gameId}`);
        }
        const match = findPlayerInGame(pick.playerId, game, rosters);
        if (!match) {
          throw new Error(
            `Cannot resolve player "${pick.playerId}" for game ${pick.gameId}`,
          );
        }
        const { first, last } = splitName(pick.playerId);
        const playerUuid = await getOrCreatePlayerUuid({
          supabase: supabaseAdmin,
          provider: PLAYER_PROVIDER,
          providerPlayerId: pick.playerId,
          teamUuid: match.side === 'home' ? game.home_team_id : game.away_team_id,
          firstName: first,
          lastName: last,
          position: match.rosterPlayer?.pos ?? null,
        });
        return {
          user_id: userId,
          game_id: game.id,
          category: pick.category,
          player_id: playerUuid,
          pick_date: payload.pickDate,
          changes_count: nextChangeCount,
          created_at: now,
          updated_at: now,
        };
      }),
    );

    const highlightUpsert: PicksHighlightsInsert[] = await Promise.all(
      payload.highlights.map(async (pick) => {
        const directMatch = findPlayerContext(pick.playerId, gameList, rosters);
        const fallbackMatch =
          directMatch ??
          (playerReferenceGames.length > 0
            ? (() => {
                const fallbackGame = playerReferenceGames[0];
                const match = findPlayerInGame(pick.playerId, fallbackGame, rosters);
                return match ? { game: fallbackGame, ...match } : null;
              })()
            : null);
        if (!fallbackMatch) {
          throw new Error(
            `Cannot resolve player "${pick.playerId}" for highlights`,
          );
        }
        const { game, side, rosterPlayer } = fallbackMatch;
        const { first, last } = splitName(pick.playerId);
        const playerUuid = await getOrCreatePlayerUuid({
          supabase: supabaseAdmin,
          provider: PLAYER_PROVIDER,
          providerPlayerId: pick.playerId,
          teamUuid: side === 'home' ? game.home_team_id : game.away_team_id,
          firstName: first,
          lastName: last,
          position: rosterPlayer?.pos ?? null,
        });
        return {
          user_id: userId,
          player_id: playerUuid,
          rank: pick.rank,
          pick_date: payload.pickDate,
          changes_count: nextChangeCount,
          created_at: now,
          updated_at: now,
        };
      }),
    );

    const [teamsResult, playersResult, highlightsResult] = await Promise.all([
      teamRecords.length
        ? supabaseAdmin.from('picks_teams').insert(teamRecords)
        : { error: null },
      playerUpsert.length
        ? supabaseAdmin.from('picks_players').insert(playerUpsert)
        : { error: null },
      highlightUpsert.length
        ? supabaseAdmin.from('picks_highlights').insert(highlightUpsert)
        : { error: null },
    ]);

    if (teamsResult.error || playersResult.error || highlightsResult.error) {
      throw (
        teamsResult.error ??
        playersResult.error ??
        highlightsResult.error ??
        new Error('Failed to update picks')
      );
    }

    const response = await fetchPicks(supabaseAdmin, userId, payload.pickDate);

    return NextResponse.json(response);
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[api/picks][PUT]', error);
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to update picks' },
      { status: 400 },
    );
  }
}
