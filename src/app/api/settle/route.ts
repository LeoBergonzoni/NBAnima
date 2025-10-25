import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import { computeDailyScore } from '@/lib/scoring';
import {
  createAdminSupabaseClient,
  createServerSupabase,
} from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

type UsersRow = Database['public']['Tables']['users']['Row'];
type UsersInsert = Database['public']['Tables']['users']['Insert'];
type LedgerInsert = Database['public']['Tables']['anima_points_ledger']['Insert'];
type TeamPickRow = Database['public']['Tables']['picks_teams']['Row'];
type PlayerPickRow = Database['public']['Tables']['picks_players']['Row'];
type HighlightPickRow = Database['public']['Tables']['picks_highlights']['Row'];
type TeamResultRow = Database['public']['Tables']['results_team']['Row'];
type PlayerResultRow = Database['public']['Tables']['results_players']['Row'];
type HighlightResultRow = Database['public']['Tables']['results_highlights']['Row'];

const getAdminUserOrThrow = async (
  supabaseAdmin: SupabaseClient<Database>,
) => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error('Unauthorized');

  const { data, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!data || data.role !== 'admin') throw new Error('Forbidden');

  return user;
};

export async function POST(request: NextRequest) {
  const supabaseAdmin = createAdminSupabaseClient();
  try {
    await getAdminUserOrThrow(supabaseAdmin);

    const pickDate = isoDateSchema.parse(
      request.nextUrl.searchParams.get('date') ?? formatDate(new Date()),
    );

    const { data: games, error: gamesError } = await supabaseAdmin
      .from('games')
      .select('id')
      .gte('game_date', `${pickDate}T00:00:00Z`)
      .lte('game_date', `${pickDate}T23:59:59Z`);

    if (gamesError) throw gamesError;

    const gameIds = games?.map((game) => game.id) ?? [];
    const safeGameIds =
      gameIds.length > 0
        ? gameIds
        : ['00000000-0000-0000-0000-000000000000'];

    const [
      { data: teamResults, error: teamResultsError },
      { data: playerResults, error: playerResultsError },
      { data: highlightResults, error: highlightResultsError },
    ] = await Promise.all([
      supabaseAdmin
        .from('results_team')
        .select('game_id, winner_team_id')
        .in('game_id', safeGameIds),
      supabaseAdmin
        .from('results_players')
        .select('game_id, category, player_id')
        .in('game_id', safeGameIds),
      supabaseAdmin
        .from('results_highlights')
        .select('player_id, rank')
        .eq('result_date', pickDate),
    ]);

    if (teamResultsError || playerResultsError || highlightResultsError) {
      throw (
        teamResultsError ??
        playerResultsError ??
        highlightResultsError ??
        new Error('Failed to load results')
      );
    }

    const [
      { data: teamPicks, error: teamPicksError },
      { data: playerPicks, error: playerPicksError },
      { data: highlightPicks, error: highlightPicksError },
    ] = await Promise.all([
      supabaseAdmin
        .from('picks_teams')
        .select('user_id, game_id, selected_team_id')
        .eq('pick_date', pickDate)
        .in('game_id', safeGameIds),
      supabaseAdmin
        .from('picks_players')
        .select('user_id, game_id, category, player_id')
        .eq('pick_date', pickDate)
        .in('game_id', safeGameIds),
      supabaseAdmin
        .from('picks_highlights')
        .select('user_id, player_id, rank')
        .eq('pick_date', pickDate),
    ]);

    if (teamPicksError || playerPicksError || highlightPicksError) {
      throw (
        teamPicksError ??
        playerPicksError ??
        highlightPicksError ??
        new Error('Failed to load picks')
      );
    }

    const userIds = new Set<string>();
    (teamPicks ?? []).forEach((pick) => userIds.add(pick.user_id));
    (playerPicks ?? []).forEach((pick) => userIds.add(pick.user_id));
    (highlightPicks ?? []).forEach((pick) => userIds.add(pick.user_id));

    if (userIds.size === 0) {
      return NextResponse.json({
        message: 'No picks found for date',
        date: pickDate,
      });
    }

    const [usersResponse, ledgerResponse] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, email, anima_points_balance')
        .in('id', Array.from(userIds)),
      supabaseAdmin
        .from('anima_points_ledger')
        .select('user_id')
        .eq('reason', `daily_settlement:${pickDate}`),
    ]);

    if (usersResponse.error || ledgerResponse.error) {
      throw (
        usersResponse.error ??
        ledgerResponse.error ??
        new Error('Failed to load settlement context')
      );
    }

    type UserContextRow = Pick<
      UsersRow,
      'id' | 'email' | 'anima_points_balance'
    >;

    const existingUsers = new Map<string, UserContextRow>(
      ((usersResponse.data ?? []) as UserContextRow[]).map((user) => [
        user.id,
        user,
      ]),
    );

    const settledUsers = new Set(
      (ledgerResponse.data ?? []).map((item) => item.user_id),
    );
    const balanceMap = new Map(
      Array.from(existingUsers.values()).map((user) => [
        user.id,
        user.anima_points_balance ?? 0,
      ]),
    );

    const nowIso = new Date().toISOString();
    const reason = `daily_settlement:${pickDate}`;

    const ledgerInserts: LedgerInsert[] = [];
    const userUpserts: UsersInsert[] = [];
    const settlements: Record<
      string,
      {
        delta: number;
        basePoints: number;
        multiplier: number;
        hits: {
          teams: number;
          players: number;
          highlights: number;
          total: number;
        };
      }
    > = {};

    const teamResultsList = (teamResults ?? []) as TeamResultRow[];
    const playerResultsList = (playerResults ?? []) as PlayerResultRow[];
    const highlightResultsList = (highlightResults ?? []) as HighlightResultRow[];
    const teamPicksList = (teamPicks ?? []) as TeamPickRow[];
    const playerPicksList = (playerPicks ?? []) as PlayerPickRow[];
    const highlightPicksList = (highlightPicks ?? []) as HighlightPickRow[];

    const formattedTeamResults = teamResultsList.map((result) => ({
      gameId: result.game_id,
      winnerTeamId: result.winner_team_id,
    }));

    const formattedPlayerResults = playerResultsList.map((result) => ({
      gameId: result.game_id,
      category: result.category,
      playerId: result.player_id,
    }));

    const formattedHighlightResults = highlightResultsList.map((result) => ({
      playerId: result.player_id,
      rank: result.rank,
    }));

    Array.from(userIds).forEach((userId) => {
      if (settledUsers.has(userId)) {
        return;
      }

      const score = computeDailyScore({
        teamPicks: teamPicksList
          .filter((pick) => pick.user_id === userId)
          .map((pick) => ({
            gameId: pick.game_id,
            selectedTeamId: pick.selected_team_id,
          })),
        teamResults: formattedTeamResults,
        playerPicks: playerPicksList
          .filter((pick) => pick.user_id === userId)
          .map((pick) => ({
            gameId: pick.game_id,
            category: pick.category,
            playerId: pick.player_id,
          })),
        playerResults: formattedPlayerResults,
        highlightPicks: highlightPicksList
          .filter((pick) => pick.user_id === userId)
          .map((pick) => ({
            playerId: pick.player_id,
            rank: pick.rank,
          })),
        highlightResults: formattedHighlightResults,
      });

      if (score.basePoints <= 0) {
        settlements[userId] = {
          delta: 0,
          basePoints: 0,
          multiplier: 1,
          hits: score.hits,
        };
        return;
      }

      const previousBalance = balanceMap.get(userId) ?? 0;
      const newBalance = previousBalance + score.totalPoints;

      ledgerInserts.push({
        user_id: userId,
        delta: score.totalPoints,
        balance_after: newBalance,
        reason,
        created_at: nowIso,
      });

      const existingUser = existingUsers.get(userId);
      if (existingUser) {
        userUpserts.push({
          id: userId,
          email: existingUser.email,
          anima_points_balance: newBalance,
          updated_at: nowIso,
        });
      }

      balanceMap.set(userId, newBalance);

      settlements[userId] = {
        delta: score.totalPoints,
        basePoints: score.basePoints,
        multiplier:
          score.basePoints > 0 ? score.totalPoints / score.basePoints : 1,
        hits: score.hits,
      };
    });

    if (ledgerInserts.length === 0) {
      return NextResponse.json({
        message: 'No new settlements to record',
        date: pickDate,
        settlements,
      });
    }

    const [ledgerInsertResult, userUpdateResult] = await Promise.all([
      supabaseAdmin
        .from('anima_points_ledger')
        .insert(ledgerInserts),
      supabaseAdmin.from('users').upsert(userUpserts),
    ]);

    if (ledgerInsertResult.error || userUpdateResult.error) {
      throw (
        ledgerInsertResult.error ??
        userUpdateResult.error ??
        new Error('Failed to write settlement')
      );
    }

    return NextResponse.json({
      date: pickDate,
      processed: ledgerInserts.length,
      settlements,
    });
  } catch (error) {
    const message = (error as Error).message ?? 'Failed to settle picks';
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error('[api/settle]', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
