import crypto from 'crypto';
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
import type { Database } from '@/lib/supabase.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Identificatore del “sorgente” per i tuoi ID esterni
const PLAYER_PROVIDER = 'local-rosters'; // o 'balldontlie' se preferisci unificare

const slugTeamName = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const stableUuidFromString = (input: string) => {
  const hash = crypto.createHash('sha1').update(input).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
};

type GameRow = {
  id: string; // uuid
  provider: string;
  provider_game_id: string; // es. "18446877"
  home_team_id: string;     // uuid
  away_team_id: string;     // uuid
};

type GameMetaTeam = {
  id?: string | null;
  providerId?: string | null;
  name?: string | null;
  abbreviation?: string | null;
  code?: string | null;
  slug?: string | null;
  abbr?: string | null;
};

export type GameMeta = {
  id?: string;
  gameId?: string;
  provider?: string;
  providerGameId?: string;
  startsAt?: string;
  status?: string;
  season?: string;
  homeTeam?: GameMetaTeam | null;
  awayTeam?: GameMetaTeam | null;
  home?: GameMetaTeam | null;
  away?: GameMetaTeam | null;
};

type GameContext = GameRow & {
  meta?: GameMeta | null;
};

const resolveMetaGameId = (meta: GameMeta): string | null => {
  if (meta.providerGameId) return String(meta.providerGameId);
  if (meta.id) return String(meta.id);
  if (meta.gameId) return String(meta.gameId);
  return null;
};

const computeSeasonLabel = (date: Date) => {
  const year = date.getUTCFullYear();
  return `${year}-${year + 1}`;
};

const collectTeamTokens = (team?: GameMetaTeam | null) => {
  const tokens = new Set<string>();
  if (!team) {
    return tokens;
  }
  const push = (raw?: string | null) => {
    if (!raw) return;
    const value = String(raw).trim();
    if (!value) return;
    tokens.add(value.toLowerCase());
    tokens.add(slugTeamName(value));
  };
  push(team.id);
  push(team.providerId);
  push(team.abbreviation);
  push(team.abbr);
  push(team.name);
  push(team.code);
  push(team.slug);
  return tokens;
};

const ensureGamesExist = async (
  supabase: SupabaseClient<Database>,
  gamesMeta: GameMeta[],
  pickDate: string,
) => {
  const metaList = Array.isArray(gamesMeta) ? gamesMeta.filter(Boolean) : [];
  const ids = metaList
    .map((meta) => resolveMetaGameId(meta))
    .filter((value): value is string => Boolean(value));

  if (ids.length === 0) {
    return new Map<string, GameContext>();
  }

  const uniqueIds = Array.from(new Set(ids));
  const metaById = new Map<string, GameMeta>();
  metaList.forEach((meta) => {
    const key = resolveMetaGameId(meta);
    if (key) {
      metaById.set(key, meta);
    }
  });

  const { data: existing, error: existingError } = await supabase
    .from('games')
    .select('id,provider,provider_game_id,home_team_id,away_team_id')
    .in('provider_game_id', uniqueIds);

  if (existingError) {
    throw existingError;
  }

  const map = new Map<string, GameContext>();
  (existing ?? []).forEach((row) => {
    map.set(row.provider_game_id, {
      ...(row as GameRow),
      meta: metaById.get(row.provider_game_id) ?? null,
    });
  });

  const inserts: Database['public']['Tables']['games']['Insert'][] = [];

  metaList.forEach((meta) => {
    const providerGameId = resolveMetaGameId(meta);
    if (!providerGameId || map.has(providerGameId)) {
      return;
    }

    const provider = meta.provider ?? 'balldontlie';
    const startsAtIso = meta.startsAt ?? `${pickDate}T00:00:00Z`;
    const parsedDate = new Date(startsAtIso);
    const gameDate = Number.isNaN(parsedDate.getTime())
      ? new Date(`${pickDate}T00:00:00Z`)
      : parsedDate;

    const homeSeed =
      meta.homeTeam?.id ??
      meta.home?.id ??
      meta.homeTeam?.providerId ??
      meta.home?.providerId ??
      meta.homeTeam?.abbreviation ??
      meta.home?.abbreviation ??
      meta.homeTeam?.abbr ??
      meta.home?.abbr ??
      meta.homeTeam?.name ??
      meta.home?.name ??
      'home';
    const awaySeed =
      meta.awayTeam?.id ??
      meta.away?.id ??
      meta.awayTeam?.providerId ??
      meta.away?.providerId ??
      meta.awayTeam?.abbreviation ??
      meta.away?.abbreviation ??
      meta.awayTeam?.abbr ??
      meta.away?.abbr ??
      meta.awayTeam?.name ??
      meta.away?.name ??
      'away';

    const homeTeamUuid = stableUuidFromString(`${provider}:team:${homeSeed}`);
    const awayTeamUuid = stableUuidFromString(`${provider}:team:${awaySeed}`);
    const gameUuid = stableUuidFromString(`${provider}:game:${providerGameId}`);
    const homeTeamAbbr =
      meta.home?.abbr ??
      meta.home?.abbreviation ??
      meta.homeTeam?.abbr ??
      meta.homeTeam?.abbreviation ??
      null;
    const awayTeamAbbr =
      meta.away?.abbr ??
      meta.away?.abbreviation ??
      meta.awayTeam?.abbr ??
      meta.awayTeam?.abbreviation ??
      null;
    const homeTeamName =
      meta.home?.name ?? meta.homeTeam?.name ?? null;
    const awayTeamName =
      meta.away?.name ?? meta.awayTeam?.name ?? null;

    inserts.push({
      id: gameUuid,
      provider,
      provider_game_id: providerGameId,
      season: meta.season ?? computeSeasonLabel(gameDate),
      status: meta.status ?? 'scheduled',
      game_date: gameDate.toISOString(),
      locked_at: null,
      home_team_id: homeTeamUuid,
      away_team_id: awayTeamUuid,
      home_team_abbr: homeTeamAbbr,
      away_team_abbr: awayTeamAbbr,
      home_team_name: homeTeamName,
      away_team_name: awayTeamName,
      created_at: new Date().toISOString(),
    });

    map.set(providerGameId, {
      id: gameUuid,
      provider,
      provider_game_id: providerGameId,
      home_team_id: homeTeamUuid,
      away_team_id: awayTeamUuid,
      meta,
    });
  });

  if (inserts.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('games')
      .upsert(inserts, { onConflict: 'provider,provider_game_id' })
      .select('id,provider,provider_game_id,home_team_id,away_team_id');

    if (insertError) {
      throw insertError;
    }

    (inserted ?? []).forEach((row) => {
      const entry = map.get(row.provider_game_id);
      map.set(row.provider_game_id, {
        ...(row as GameRow),
        meta: entry?.meta ?? metaById.get(row.provider_game_id) ?? null,
      });
    });
  }

  return map;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const resolveSelectedTeamUuid = (inputTeamId: string, game: GameContext): string => {
  const raw = (inputTeamId ?? '').trim();
  if (!raw) {
    throw new Error('Missing team identifier');
  }

  if (isUuid(raw)) {
    return raw;
  }

  const normalized = raw.toLowerCase();
  const slugged = slugTeamName(raw);

  const homeTokens = new Set<string>([
    game.home_team_id.toLowerCase(),
    'home',
    'h',
    'host',
    'home-team',
  ]);
  const awayTokens = new Set<string>([
    game.away_team_id.toLowerCase(),
    'away',
    'a',
    'guest',
    'visitor',
    'away-team',
  ]);

  collectTeamTokens(game.meta?.homeTeam).forEach((token) => {
    homeTokens.add(token);
  });
  collectTeamTokens(game.meta?.awayTeam).forEach((token) => {
    awayTokens.add(token);
  });

  if (homeTokens.has(normalized) || homeTokens.has(slugged)) {
    return game.home_team_id;
  }
  if (awayTokens.has(normalized) || awayTokens.has(slugged)) {
    return game.away_team_id;
  }

  throw new Error(
    `Cannot resolve team uuid for value "${inputTeamId}" on game ${game.provider_game_id}`,
  );
};

// Ritorna (o crea) un player interno e restituisce il suo UUID
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
    const validated = validatePicksPayload(rawBody);
    const payload = {
      ...validated,
      gamesMeta: Array.isArray(rawBody?.gamesMeta)
        ? (rawBody.gamesMeta as GameMeta[])
        : undefined,
    } satisfies typeof validated & { gamesMeta?: GameMeta[] };
    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;

    if (role !== 'admin') {
      await assertLockWindowOpen(supabaseAdmin, payload.pickDate);
    }  

    const gamesMap = await ensureGamesExist(
      supabaseAdmin,
      payload.gamesMeta ?? [],
      payload.pickDate,
    );

    const findMetaForGame = (gameId: string) =>
      (payload.gamesMeta ?? []).find(
        (meta) => resolveMetaGameId(meta) === gameId,
      ) ?? null;

    const ensureGameContext = async (gameId: string): Promise<GameContext> => {
      const existingMeta = findMetaForGame(gameId);
      const cached = gamesMap.get(gameId);
      if (cached) {
        if (!cached.meta && existingMeta) {
          cached.meta = existingMeta;
        }
        return cached;
      }

      const { data, error } = await supabaseAdmin
        .from('games')
        .select('id,provider,provider_game_id,home_team_id,away_team_id')
        .eq('provider_game_id', gameId)
        .maybeSingle();

      if (!error && data) {
        const context: GameContext = {
          ...(data as GameRow),
          meta: existingMeta,
        };
        gamesMap.set(gameId, context);
        return context;
      }

      const baseDate = new Date(`${payload.pickDate}T00:00:00Z`);
      const normalizedDate = Number.isNaN(baseDate.getTime())
        ? new Date()
        : baseDate;
      const gameUuid = stableUuidFromString(`stub:game:${gameId}`);
      const homeUuid = stableUuidFromString(`stub:home:${gameId}`);
      const awayUuid = stableUuidFromString(`stub:away:${gameId}`);
      const homeTeamAbbr =
        existingMeta?.home?.abbr ??
        existingMeta?.home?.abbreviation ??
        existingMeta?.homeTeam?.abbr ??
        existingMeta?.homeTeam?.abbreviation ??
        null;
      const awayTeamAbbr =
        existingMeta?.away?.abbr ??
        existingMeta?.away?.abbreviation ??
        existingMeta?.awayTeam?.abbr ??
        existingMeta?.awayTeam?.abbreviation ??
        null;
      const homeTeamName =
        existingMeta?.home?.name ?? existingMeta?.homeTeam?.name ?? null;
      const awayTeamName =
        existingMeta?.away?.name ?? existingMeta?.awayTeam?.name ?? null;

      const stubRow: Database['public']['Tables']['games']['Insert'] = {
        id: gameUuid,
        provider: existingMeta?.provider ?? 'stub',
        provider_game_id: gameId,
        season: existingMeta?.season ?? computeSeasonLabel(normalizedDate),
        status: existingMeta?.status ?? 'scheduled',
        game_date: normalizedDate.toISOString(),
        locked_at: null,
        home_team_id: homeUuid,
        away_team_id: awayUuid,
        home_team_abbr: homeTeamAbbr,
        away_team_abbr: awayTeamAbbr,
        home_team_name: homeTeamName,
        away_team_name: awayTeamName,
        created_at: new Date().toISOString(),
      };

      const { error: stubError } = await supabaseAdmin
        .from('games')
        .upsert(stubRow, { onConflict: 'provider,provider_game_id' });

      if (stubError) {
        throw stubError;
      }

      const context: GameContext = {
        id: stubRow.id!,
        provider: stubRow.provider,
        provider_game_id: stubRow.provider_game_id,
        home_team_id: stubRow.home_team_id,
        away_team_id: stubRow.away_team_id,
        meta: existingMeta,
      };
      gamesMap.set(gameId, context);
      return context;
    };

    const resolvePlayerUuidForPick = async (pick: { gameId: string; playerId: string }) => {
      const game = await ensureGameContext(pick.gameId);
      const guessedTeamUuid = game.home_team_id;
      const { first, last } = splitName(pick.playerId);

      const uuid = await getOrCreatePlayerUuid({
        supabase: supabaseAdmin,
        provider: PLAYER_PROVIDER,
        providerPlayerId: pick.playerId,
        teamUuid: guessedTeamUuid,
        firstName: first,
        lastName: last,
        position: null,
      });

      return uuid;
    };

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
    
    // TEAM INSERT (UUID già risolti)
    const teamInsert: PicksTeamsInsert[] = await Promise.all(
      payload.teams.map(async (pick) => {
        const game = await ensureGameContext(pick.gameId);
        return {
          user_id: userId,
          game_id: game.id,                                   // UUID
          selected_team_id: resolveSelectedTeamUuid(pick.teamId, game), // UUID
          pick_date: payload.pickDate,
          changes_count: 0,                                   // <-- nel POST sempre 0
          created_at: now,
          updated_at: now,
        };
      }),
    );
    
    // PLAYERS INSERT (UUID già risolti)
    const playerInsert: PicksPlayersInsert[] = await Promise.all(
      payload.players.map(async (pick) => {
        const game = await ensureGameContext(pick.gameId);
        const playerUuid = await resolvePlayerUuidForPick(pick);

        return {
          user_id: userId,
          game_id: game.id,            // UUID
          category: pick.category,
          player_id: playerUuid,       // UUID
          pick_date: payload.pickDate,
          changes_count: 0,            // <-- nel POST sempre 0
          created_at: now,
          updated_at: now,
        };
      }),
    );
    
    // HIGHLIGHTS INSERT (UUID già risolti)
    const fallbackGameId =
      payload.players[0]?.gameId ??
      (payload.gamesMeta ?? [])
        .map((meta) => resolveMetaGameId(meta))
        .find((id): id is string => Boolean(id)) ??
      Array.from(gamesMap.keys())[0];
    if (!fallbackGameId) {
      // opzionale: se non ci sono player picks, scegli un game esistente del giorno
      // o lancia un errore esplicito. Qui facciamo un fail-fast chiaro.
      throw new Error('Cannot resolve a game for highlights');
    }
    
    const highlightInsert: PicksHighlightsInsert[] = await Promise.all(
      payload.highlights.map(async (pick) => {
        const playerUuid = await resolvePlayerUuidForPick({
          gameId: fallbackGameId,
          playerId: pick.playerId,
        });
    
        return {
          user_id: userId,
          player_id: playerUuid,   // UUID
          rank: pick.rank,
          pick_date: payload.pickDate,
          changes_count: 0,        // <-- nel POST sempre 0
          created_at: now,
          updated_at: now,
        };
      }),
    );
    
    const [teamsResult, playersResult, highlightsResult] = await Promise.all([
      teamInsert.length
        ? supabaseAdmin.from('picks_teams').insert(teamInsert)
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
    const validated = validatePicksPayload(rawBody);
    const payload = {
      ...validated,
      gamesMeta: Array.isArray(rawBody?.gamesMeta)
        ? (rawBody.gamesMeta as GameMeta[])
        : undefined,
    } satisfies typeof validated & { gamesMeta?: GameMeta[] };
    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;

    if (role !== 'admin') {
      await assertLockWindowOpen(supabaseAdmin, payload.pickDate);
    }

    const gamesMap = await ensureGamesExist(
      supabaseAdmin,
      payload.gamesMeta ?? [],
      payload.pickDate,
    );

    const findMetaForGame = (gameId: string) =>
      (payload.gamesMeta ?? []).find(
        (meta) => resolveMetaGameId(meta) === gameId,
      ) ?? null;

    const ensureGameContext = async (gameId: string): Promise<GameContext> => {
      const existingMeta = findMetaForGame(gameId);
      const cached = gamesMap.get(gameId);
      if (cached) {
        if (!cached.meta && existingMeta) {
          cached.meta = existingMeta;
        }
        return cached;
      }
      const { data, error } = await supabaseAdmin
        .from('games')
        .select('id,provider,provider_game_id,home_team_id,away_team_id')
        .eq('provider_game_id', gameId)
        .maybeSingle();
      if (!error && data) {
        const context: GameContext = {
          ...(data as GameRow),
          meta: existingMeta,
        };
        gamesMap.set(gameId, context);
        return context;
      }

      const baseDate = new Date(`${payload.pickDate}T00:00:00Z`);
      const normalizedDate = Number.isNaN(baseDate.getTime())
        ? new Date()
        : baseDate;
      const gameUuid = stableUuidFromString(`stub:game:${gameId}`);
      const homeUuid = stableUuidFromString(`stub:home:${gameId}`);
      const awayUuid = stableUuidFromString(`stub:away:${gameId}`);
      const homeTeamAbbr =
        existingMeta?.home?.abbr ??
        existingMeta?.home?.abbreviation ??
        existingMeta?.homeTeam?.abbr ??
        existingMeta?.homeTeam?.abbreviation ??
        null;
      const awayTeamAbbr =
        existingMeta?.away?.abbr ??
        existingMeta?.away?.abbreviation ??
        existingMeta?.awayTeam?.abbr ??
        existingMeta?.awayTeam?.abbreviation ??
        null;
      const homeTeamName =
        existingMeta?.home?.name ?? existingMeta?.homeTeam?.name ?? null;
      const awayTeamName =
        existingMeta?.away?.name ?? existingMeta?.awayTeam?.name ?? null;

      const stubRow: Database['public']['Tables']['games']['Insert'] = {
        id: gameUuid,
        provider: existingMeta?.provider ?? 'stub',
        provider_game_id: gameId,
        season: existingMeta?.season ?? computeSeasonLabel(normalizedDate),
        status: existingMeta?.status ?? 'scheduled',
        game_date: normalizedDate.toISOString(),
        locked_at: null,
        home_team_id: homeUuid,
        away_team_id: awayUuid,
        home_team_abbr: homeTeamAbbr,
        away_team_abbr: awayTeamAbbr,
        home_team_name: homeTeamName,
        away_team_name: awayTeamName,
        created_at: new Date().toISOString(),
      };

      const { error: stubError } = await supabaseAdmin
        .from('games')
        .upsert(stubRow, { onConflict: 'provider,provider_game_id' });

      if (stubError) {
        throw stubError;
      }

      const context: GameContext = {
        id: stubRow.id!,
        provider: stubRow.provider,
        provider_game_id: stubRow.provider_game_id,
        home_team_id: stubRow.home_team_id,
        away_team_id: stubRow.away_team_id,
        meta: existingMeta,
      };
      gamesMap.set(gameId, context);
      return context;
    };

    const resolvePlayerUuidForPick = async (pick: { gameId: string; playerId: string }) => {
      const game = await ensureGameContext(pick.gameId);
      const guessedTeamUuid = game.home_team_id;
      const { first, last } = splitName(pick.playerId);

      const uuid = await getOrCreatePlayerUuid({
        supabase: supabaseAdmin,
        provider: PLAYER_PROVIDER,
        providerPlayerId: pick.playerId,
        teamUuid: guessedTeamUuid,
        firstName: first,
        lastName: last,
        position: null,
      });

      return uuid;
    };

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

    const now = new Date().toISOString();
const nextChangeCount = role === 'admin' ? currentChanges : currentChanges + 1;

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

// TEAM UPSERT (UUID risolti)
const teamUpsert: PicksTeamsInsert[] = await Promise.all(
  payload.teams.map(async (pick) => {
    const game = await ensureGameContext(pick.gameId);
    return {
      user_id: userId,
      game_id: game.id,                                   // UUID
      selected_team_id: resolveSelectedTeamUuid(pick.teamId, game), // UUID
      pick_date: payload.pickDate,
      changes_count: nextChangeCount,
      created_at: now,
      updated_at: now,
    };
  }),
);

// PLAYERS UPSERT (UUID risolti)
const playerUpsert: PicksPlayersInsert[] = await Promise.all(
  payload.players.map(async (pick) => {
    const game = await ensureGameContext(pick.gameId);
    const playerUuid = await resolvePlayerUuidForPick(pick);

    return {
      user_id: userId,
      game_id: game.id,            // UUID
      category: pick.category,
      player_id: playerUuid,       // UUID
      pick_date: payload.pickDate,
      changes_count: nextChangeCount,
      created_at: now,
      updated_at: now,
    };
  }),
);

// HIGHLIGHTS UPSERT (UUID risolti)
const fallbackGameId =
  payload.players[0]?.gameId ??
  (payload.gamesMeta ?? [])
    .map((meta) => resolveMetaGameId(meta))
    .find((id): id is string => Boolean(id)) ??
  Array.from(gamesMap.keys())[0];
if (!fallbackGameId) {
  throw new Error('Cannot resolve a game for highlights');
}

const highlightUpsert: PicksHighlightsInsert[] = await Promise.all(
  payload.highlights.map(async (pick) => {
    const playerUuid = await resolvePlayerUuidForPick({
      gameId: fallbackGameId,
      playerId: pick.playerId,
    });

    return {
      user_id: userId,
      player_id: playerUuid,   // UUID
      rank: pick.rank,
      pick_date: payload.pickDate,
      changes_count: nextChangeCount,
      created_at: now,
      updated_at: now,
    };
  }),
);

const [teamsResult, playersResult, highlightsResult] = await Promise.all([
  teamUpsert.length
    ? supabaseAdmin.from('picks_teams').insert(teamUpsert)
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
