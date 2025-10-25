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

    const teamInsert: PicksTeamsInsert[] = payload.teams.map((pick) => ({
      user_id: userId,
      game_id: pick.gameId,
      selected_team_id: pick.teamId,
      pick_date: payload.pickDate,
      changes_count: 0,
      created_at: now,
      updated_at: now,
    }));

    const playerInsert: PicksPlayersInsert[] = payload.players.map((pick) => ({
      user_id: userId,
      game_id: pick.gameId,
      category: pick.category,
      player_id: pick.playerId,
      pick_date: payload.pickDate,
      changes_count: 0,
      created_at: now,
      updated_at: now,
    }));

    const highlightInsert: PicksHighlightsInsert[] = payload.highlights.map((pick) => ({
      user_id: userId,
      player_id: pick.playerId,
      rank: pick.rank,
      pick_date: payload.pickDate,
      changes_count: 0,
      created_at: now,
      updated_at: now,
    }));

    const [teamsResult, playersResult, highlightsResult] = await Promise.all([
      teamInsert.length
        ? supabaseAdmin.from('picks_teams').insert(teamInsert)
        : { error: null },
      playerInsert.length
        ? supabaseAdmin.from('picks_players').insert(playerInsert)
        : { error: null },
      highlightInsert.length
        ? supabaseAdmin
            .from('picks_highlights')
            .insert(highlightInsert)
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

    const teamUpsert: PicksTeamsInsert[] = payload.teams.map((pick) => ({
      user_id: userId,
      game_id: pick.gameId,
      selected_team_id: pick.teamId,
      pick_date: payload.pickDate,
      changes_count: nextChangeCount,
      created_at: now,
      updated_at: now,
    }));

    const playerUpsert: PicksPlayersInsert[] = payload.players.map((pick) => ({
      user_id: userId,
      game_id: pick.gameId,
      category: pick.category,
      player_id: pick.playerId,
      pick_date: payload.pickDate,
      changes_count: nextChangeCount,
      created_at: now,
      updated_at: now,
    }));

    const highlightUpsert: PicksHighlightsInsert[] = payload.highlights.map((pick) => ({
      user_id: userId,
      player_id: pick.playerId,
      rank: pick.rank,
      pick_date: payload.pickDate,
      changes_count: nextChangeCount,
      created_at: now,
      updated_at: now,
    }));

    const [teamsResult, playersResult, highlightsResult] = await Promise.all([
      teamUpsert.length
        ? supabaseAdmin.from('picks_teams').insert(teamUpsert)
        : { error: null },
      playerUpsert.length
        ? supabaseAdmin.from('picks_players').insert(playerUpsert)
        : { error: null },
      highlightUpsert.length
        ? supabaseAdmin
            .from('picks_highlights')
            .insert(highlightUpsert)
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
