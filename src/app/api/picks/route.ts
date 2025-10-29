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

type GameRow = {
  id: string; // uuid
  provider: string;
  provider_game_id: string; // es. "18446877"
  home_team_id: string;     // uuid
  away_team_id: string;     // uuid
};

// Mappa i provider_game_id ai row di games
async function loadGamesMap(
  supabase: SupabaseClient<Database>,
  providerGameIds: string[],
) {
  const unique = Array.from(new Set(providerGameIds)).filter(Boolean);
  if (unique.length === 0) return new Map<string, GameRow>();

  const { data, error } = await supabase
    .from('games')
    .select('id,provider,provider_game_id,home_team_id,away_team_id')
    .in('provider_game_id', unique);

  if (error) throw error;

  const map = new Map<string, GameRow>();
  (data ?? []).forEach((g) => map.set(g.provider_game_id, g as GameRow));
  return map;
}

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
      .select('game_id, selected_team_id, updated_at, changes_count')
      .eq('user_id', userId)
      .eq('pick_date', pickDate),
    supabaseAdmin
      .from('picks_players')
      .select('game_id, category, player_id, updated_at, changes_count')
      .eq('user_id', userId)
      .eq('pick_date', pickDate),
    supabaseAdmin
      .from('picks_highlights')
      .select('player_id, rank, updated_at, changes_count')
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

  return {
    teams: teamResp.data ?? [],
    players: playerResp.data ?? [],
    highlights: highlightsResp.data ?? [],
    changesCount: Math.max(
      ...(teamResp.data ?? []).map((p) => p.changes_count ?? 0),
      ...(playerResp.data ?? []).map((p) => p.changes_count ?? 0),
      ...(highlightsResp.data ?? []).map((p) => p.changes_count ?? 0),
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
    const payload = validatePicksPayload(await request.json());
    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;

    await assertLockWindowOpen(supabaseAdmin, payload.pickDate);

// 1) Carico la mappa provider_game_id -> games row (UUID + team UUID)
const providerGameIds = [
  ...payload.teams.map(t => t.gameId),
  ...payload.players.map(p => p.gameId),
];
const gamesMap = await loadGamesMap(supabaseAdmin, providerGameIds);

// Fail-fast se non trovo alcune partite
const missingGames = providerGameIds
  .filter(Boolean)
  .filter(id => !gamesMap.has(id));
if (missingGames.length) {
  throw new Error(`Unknown games (provider_game_id): ${missingGames.join(', ')}`);
}

// 2) Preparo un resolver per TEAM UUID in picks_teams
function resolveSelectedTeamUuid(inputTeamId: string, game: GameRow): string {
  // Se già UUID valido, tienilo
  if (/^[0-9a-fA-F-]{36}$/.test(inputTeamId)) return inputTeamId;

  // Altrimenti prova con abbreviazioni/alias “home/away”
  const val = (inputTeamId || '').toLowerCase().trim();
  if (val === 'home' || val === 'h' || val === 'host' || val === game.home_team_id) {
    return game.home_team_id;
  }
  if (val === 'away' || val === 'a' || val === 'guest' || val === game.away_team_id) {
    return game.away_team_id;
  }

  // Se passavi le abbreviazioni (es. PHI/GSW), prova un match euristico:
  // NB: solo se ti salvi anche le abbreviazioni delle squadre su 'games' o altrove.
  // In assenza, fallback sicuro: lancia un errore chiaro.
  throw new Error(`Cannot resolve team uuid for value "${inputTeamId}" on game ${game.provider_game_id}`);
}

// 3) Preparo un resolver per PLAYER UUID in picks_players / highlights
async function resolvePlayerUuidForPick(pick: { gameId: string; playerId: string }) {
  const game = gamesMap.get(pick.gameId)!;

  // Dato che il tuo valore playerId proviene dal roster locale (non UUID),
  // uso provider=local-rosters e come team associo quello della partita:
  // Qui **devi** sapere se quel player appartiene all'home o all'away.
  // Nella tua UI i select di “Players” nascono dal roster della singola partita:
  // quando salvi, puoi includere anche “teamSide” ('home'/'away') nel payload.
  //
  // Se non l’hai ancora fatto, approssimo: provo prima "home", poi "away".
  // (Meglio: passa teamSide dal client).
  const guessedTeamUuid = game.home_team_id;

  // Per i nomi, in questo endpoint non li hai: recuperali ad hoc se li hai nel client,
  // altrimenti salva degli placeholder. Idealmente passa anche first/last nel payload.
  const { first, last } = splitName(pick.playerId); // fallback brutale se hai messo il nome dentro playerId

  const uuid = await getOrCreatePlayerUuid({
    supabase: supabaseAdmin,
    provider: PLAYER_PROVIDER,
    providerPlayerId: pick.playerId,  // <-- l’ID esterno del roster
    teamUuid: guessedTeamUuid,        // <-- meglio se passi quello reale dal client
    firstName: first,
    lastName: last,
    position: null,
  });

  return uuid;
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
        const game = gamesMap.get(pick.gameId)!;
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
        const game = gamesMap.get(pick.gameId)!;
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
    const fallbackGameId = payload.players[0]?.gameId ?? providerGameIds[0];
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
    const payload = validatePicksPayload(await request.json());
    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;

    await assertLockWindowOpen(supabaseAdmin, payload.pickDate);

// 1) Carico la mappa provider_game_id -> games row (UUID + team UUID)
const providerGameIds = [
  ...payload.teams.map(t => t.gameId),
  ...payload.players.map(p => p.gameId),
];
const gamesMap = await loadGamesMap(supabaseAdmin, providerGameIds);

// Fail-fast se non trovo alcune partite
const missingGames = providerGameIds
  .filter(Boolean)
  .filter(id => !gamesMap.has(id));
if (missingGames.length) {
  throw new Error(`Unknown games (provider_game_id): ${missingGames.join(', ')}`);
}

// 2) Preparo un resolver per TEAM UUID in picks_teams
function resolveSelectedTeamUuid(inputTeamId: string, game: GameRow): string {
  // Se già UUID valido, tienilo
  if (/^[0-9a-fA-F-]{36}$/.test(inputTeamId)) return inputTeamId;

  // Altrimenti prova con abbreviazioni/alias “home/away”
  const val = (inputTeamId || '').toLowerCase().trim();
  if (val === 'home' || val === 'h' || val === 'host' || val === game.home_team_id) {
    return game.home_team_id;
  }
  if (val === 'away' || val === 'a' || val === 'guest' || val === game.away_team_id) {
    return game.away_team_id;
  }

  // Se passavi le abbreviazioni (es. PHI/GSW), prova un match euristico:
  // NB: solo se ti salvi anche le abbreviazioni delle squadre su 'games' o altrove.
  // In assenza, fallback sicuro: lancia un errore chiaro.
  throw new Error(`Cannot resolve team uuid for value "${inputTeamId}" on game ${game.provider_game_id}`);
}

// 3) Preparo un resolver per PLAYER UUID in picks_players / highlights
async function resolvePlayerUuidForPick(pick: { gameId: string; playerId: string }) {
  const game = gamesMap.get(pick.gameId)!;

  // Dato che il tuo valore playerId proviene dal roster locale (non UUID),
  // uso provider=local-rosters e come team associo quello della partita:
  // Qui **devi** sapere se quel player appartiene all'home o all'away.
  // Nella tua UI i select di “Players” nascono dal roster della singola partita:
  // quando salvi, puoi includere anche “teamSide” ('home'/'away') nel payload.
  //
  // Se non l’hai ancora fatto, approssimo: provo prima "home", poi "away".
  // (Meglio: passa teamSide dal client).
  const guessedTeamUuid = game.home_team_id;

  // Per i nomi, in questo endpoint non li hai: recuperali ad hoc se li hai nel client,
  // altrimenti salva degli placeholder. Idealmente passa anche first/last nel payload.
  const { first, last } = splitName(pick.playerId); // fallback brutale se hai messo il nome dentro playerId

  const uuid = await getOrCreatePlayerUuid({
    supabase: supabaseAdmin,
    provider: PLAYER_PROVIDER,
    providerPlayerId: pick.playerId,  // <-- l’ID esterno del roster
    teamUuid: guessedTeamUuid,        // <-- meglio se passi quello reale dal client
    firstName: first,
    lastName: last,
    position: null,
  });

  return uuid;
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
    const game = gamesMap.get(pick.gameId)!;
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
    const game = gamesMap.get(pick.gameId)!;
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
const fallbackGameId = payload.players[0]?.gameId ?? providerGameIds[0];
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
