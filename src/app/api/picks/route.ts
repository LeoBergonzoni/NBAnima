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
import {
  getRosters,
  resolveTeamKey,
  type RosterPlayer,
  type RostersMap,
} from '@/lib/rosters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Identificatore del “sorgente” per i tuoi ID esterni
const PLAYER_PROVIDER = 'local-rosters'; // o 'balldontlie' se preferisci unificare

type GameRow = {
  id: string; // uuid
  provider: string;
  provider_game_id: string; // es. "18446877"
  home_team_id: string;     // uuid
  away_team_id: string;     // uuid
  home_team_abbr: string | null;
  away_team_abbr: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
};

type GameContext = GameRow & {
  homeRosterKey: string | null;
  awayRosterKey: string | null;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const resolveSelectedTeamUuid = (input: string, game: GameRow): string => {
  const trimmed = (input ?? '').trim();
  if (!trimmed) {
    throw new Error('Missing team value');
  }

  if (isUuid(trimmed)) {
    if (trimmed === game.home_team_id || trimmed === game.away_team_id) {
      return trimmed;
    }
    throw new Error(`Team UUID does not belong to this game: ${trimmed}`);
  }

  const value = trimmed.toLowerCase();
  const homeTokens = new Set<string>([
    'home',
    'h',
    (game.home_team_abbr ?? '').toLowerCase(),
  ]);
  const awayTokens = new Set<string>([
    'away',
    'a',
    (game.away_team_abbr ?? '').toLowerCase(),
  ]);

  if (homeTokens.has(value)) {
    return game.home_team_id;
  }
  if (awayTokens.has(value)) {
    return game.away_team_id;
  }

  const allowed = [
    `home (${game.home_team_abbr ?? 'N/A'})`,
    `away (${game.away_team_abbr ?? 'N/A'})`,
  ];
  throw new Error(
    `Cannot resolve team for value "${input}". Allowed: ${allowed.join(', ')}.`,
  );
};

const collectRequestedGameIds = (payload: {
  teams: Array<{ gameId: string }>;
  players: Array<{ gameId: string }>;
  gamesMeta?: unknown;
}) => {
  const ids = new Set<string>();
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
  if (Array.isArray(payload.gamesMeta)) {
    for (const meta of payload.gamesMeta as Array<Record<string, unknown>>) {
      const raw =
        meta?.providerGameId ??
        meta?.gameId ??
        meta?.id ??
        null;
      if (raw) {
        ids.add(String(raw));
      }
    }
  }
  return Array.from(ids).filter(Boolean);
};

const loadGameContexts = async (
  supabase: SupabaseClient<Database>,
  providerGameIds: string[],
) => {
  const map = new Map<string, GameContext>();
  if (providerGameIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from('games')
    .select(
      `
        id,
        provider,
        provider_game_id,
        home_team_id,
        away_team_id,
        home_team_abbr,
        away_team_abbr,
        home_team_name,
        away_team_name
      `,
    )
    .in('provider_game_id', providerGameIds);

  if (error) {
    throw error;
  }

  const entries = data ?? [];
  const contexts = await Promise.all(
    entries.map(async (row) => {
      const homeRosterKey = await resolveTeamKey(
        row.home_team_abbr ?? row.home_team_name ?? null,
      );
      const awayRosterKey = await resolveTeamKey(
        row.away_team_abbr ?? row.away_team_name ?? null,
      );
      return {
        ...(row as GameRow),
        homeRosterKey,
        awayRosterKey,
      } satisfies GameContext;
    }),
  );

  contexts.forEach((context) => {
    map.set(context.provider_game_id, context);
  });

  return map;
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
    const validated = validatePicksPayload(rawBody);
    const payload = {
      ...validated,
      gamesMeta: Array.isArray(rawBody?.gamesMeta)
        ? (rawBody.gamesMeta as Array<Record<string, unknown>>)
        : undefined,
    } satisfies typeof validated & { gamesMeta?: Array<Record<string, unknown>> };
    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;

    if (role !== 'admin') {
      await assertLockWindowOpen(supabaseAdmin, payload.pickDate);
    }

    const providerGameIds = collectRequestedGameIds(payload);
    const gamesMap = await loadGameContexts(supabaseAdmin, providerGameIds);
    const missingGames = providerGameIds.filter((id) => !gamesMap.has(id));
    if (missingGames.length > 0) {
      throw new Error(`Unknown game(s): ${missingGames.join(', ')}`);
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

    const teamInsert: PicksTeamsInsert[] = await Promise.all(
      payload.teams.map(async (pick) => {
        const game = gamesMap.get(pick.gameId);
        if (!game) {
          throw new Error(`Unknown game(s): ${pick.gameId}`);
        }
        const selectedTeamId = resolveSelectedTeamUuid(pick.teamId, game);
        const isHome = selectedTeamId === game.home_team_id;
        const selectedAbbr = isHome ? game.home_team_abbr : game.away_team_abbr;
        const selectedName = isHome ? game.home_team_name : game.away_team_name;
        return {
          user_id: userId,
          game_id: game.id,
          selected_team_id: selectedTeamId,
          selected_team_abbr: selectedAbbr ?? null,
          selected_team_name: selectedName ?? null,
          pick_date: payload.pickDate,
          changes_count: 0,
          created_at: now,
          updated_at: now,
        };
      }),
    );

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
        ? (rawBody.gamesMeta as Array<Record<string, unknown>>)
        : undefined,
    } satisfies typeof validated & { gamesMeta?: Array<Record<string, unknown>> };
    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;

    if (role !== 'admin') {
      await assertLockWindowOpen(supabaseAdmin, payload.pickDate);
    }

    const providerGameIds = collectRequestedGameIds(payload);
    const gamesMap = await loadGameContexts(supabaseAdmin, providerGameIds);
    const missingGames = providerGameIds.filter((id) => !gamesMap.has(id));
    if (missingGames.length > 0) {
      throw new Error(`Unknown game(s): ${missingGames.join(', ')}`);
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

    const teamUpsert: PicksTeamsInsert[] = await Promise.all(
      payload.teams.map(async (pick) => {
        const game = gamesMap.get(pick.gameId);
        if (!game) {
          throw new Error(`Unknown game(s): ${pick.gameId}`);
        }
        const selectedTeamId = resolveSelectedTeamUuid(pick.teamId, game);
        const isHome = selectedTeamId === game.home_team_id;
        const selectedAbbr = isHome ? game.home_team_abbr : game.away_team_abbr;
        const selectedName = isHome ? game.home_team_name : game.away_team_name;
        return {
          user_id: userId,
          game_id: game.id,
          selected_team_id: selectedTeamId,
          selected_team_abbr: selectedAbbr ?? null,
          selected_team_name: selectedName ?? null,
          pick_date: payload.pickDate,
          changes_count: nextChangeCount,
          created_at: now,
          updated_at: now,
        };
      }),
    );

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
