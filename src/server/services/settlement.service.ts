import type { Database } from '@/lib/supabase.types';
import { supabaseAdmin } from '@/lib/supabase';
import { computeDailyScore } from '@/lib/scoring';

const LEDGER_TABLE =
  'anima_points_ledger' as keyof Database['public']['Tables'] & string;
const SAFE_UUID = '00000000-0000-0000-0000-000000000000';

type TeamPickRow = Database['public']['Tables']['picks_teams']['Row'];
type PlayerPickRow = Database['public']['Tables']['picks_players']['Row'];
type HighlightPickRow = Database['public']['Tables']['picks_highlights']['Row'];
type TeamResultRow = Database['public']['Tables']['results_team']['Row'];
type PlayerResultRow = Database['public']['Tables']['results_players']['Row'];
type HighlightResultRow =
  Database['public']['Tables']['results_highlights']['Row'];
type LedgerRow = Database['public']['Tables']['anima_points_ledger']['Row'];
type UserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'email' | 'anima_points_balance'
>;
type LedgerInsert =
  Database['public']['Tables']['anima_points_ledger']['Insert'];

const settlementReason = (dateNY: string) => `settlement:${dateNY}`;

const fetchTeamResultsForGames = async (
  gameIds: string[],
): Promise<TeamResultRow[]> => {
  if (gameIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('results_team')
    .select('*')
    .in('game_id', gameIds)
    .returns<TeamResultRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
};

const fetchPlayerResultsForGames = async (
  gameIds: string[],
): Promise<PlayerResultRow[]> => {
  if (gameIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('results_players')
    .select('*')
    .in('game_id', gameIds)
    .returns<PlayerResultRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
};

const fetchHighlightResultsForDate = async (dateNY: string) => {
  const { data, error } = await supabaseAdmin
    .from('results_highlights')
    .select('player_id, rank')
    .eq('result_date', dateNY);

  if (error) {
    throw error;
  }

  return (data ?? []) as HighlightResultRow[];
};

export const applySettlementForDate = async (dateNY: string) => {
  const reason = settlementReason(dateNY);

  const [teamPicksResponse, playerPicksResponse, highlightPicksResponse, ledgerResponse] =
    await Promise.all([
      supabaseAdmin
        .from('picks_teams')
        .select('user_id, game_id, selected_team_id, pick_date')
        .eq('pick_date', dateNY),
      supabaseAdmin
        .from('picks_players')
        .select('user_id, game_id, category, player_id, pick_date')
        .eq('pick_date', dateNY),
      supabaseAdmin
        .from('picks_highlights')
        .select('user_id, player_id, rank, pick_date')
        .eq('pick_date', dateNY),
      supabaseAdmin
        .from('anima_points_ledger')
        .select('user_id, delta')
        .eq('reason', reason),
    ]);

  if (
    teamPicksResponse.error ||
    playerPicksResponse.error ||
    highlightPicksResponse.error ||
    ledgerResponse.error
  ) {
    throw (
      teamPicksResponse.error ??
      playerPicksResponse.error ??
      highlightPicksResponse.error ??
      ledgerResponse.error ??
      new Error('Failed to load settlement context')
    );
  }

  const teamPicks = (teamPicksResponse.data ?? []) as TeamPickRow[];
  const playerPicks = (playerPicksResponse.data ?? []) as PlayerPickRow[];
  const highlightPicks = (highlightPicksResponse.data ?? []) as HighlightPickRow[];
  const previousLedger = (ledgerResponse.data ?? []) as Pick<
    LedgerRow,
    'user_id' | 'delta'
  >[];

  const gameIds = Array.from(
    new Set(
      [...teamPicks, ...playerPicks].map((pick) => pick.game_id).filter(Boolean),
    ),
  );
  const safeGameIds = gameIds.length > 0 ? gameIds : [SAFE_UUID];

  const [teamResults, playerResults, highlightResults] = await Promise.all([
    fetchTeamResultsForGames(safeGameIds),
    fetchPlayerResultsForGames(safeGameIds),
    fetchHighlightResultsForDate(dateNY),
  ]);

  const previousDeltaByUser = new Map<string, number>();
  previousLedger.forEach((entry) => {
    previousDeltaByUser.set(
      entry.user_id,
      (previousDeltaByUser.get(entry.user_id) ?? 0) + (entry.delta ?? 0),
    );
  });

  const userIds = new Set<string>();
  teamPicks.forEach((pick) => userIds.add(pick.user_id));
  playerPicks.forEach((pick) => userIds.add(pick.user_id));
  highlightPicks.forEach((pick) => userIds.add(pick.user_id));
  previousLedger.forEach((entry) => userIds.add(entry.user_id));

  const userIdList = Array.from(userIds);

  const usersResponse =
    userIdList.length > 0
      ? await supabaseAdmin
          .from('users')
          .select('id, email, anima_points_balance')
          .in('id', userIdList)
      : { data: [] as UserRow[], error: null };

  if (usersResponse.error) {
    throw usersResponse.error;
  }

  const userMap = new Map<string, UserRow>(
    ((usersResponse.data ?? []) as UserRow[]).map((user) => [user.id, user]),
  );

  const teamResultsFormatted = (teamResults ?? []).map((result) => ({
    gameId: result.game_id,
    winnerTeamId: result.winner_team_id,
  }));
  const playerResultsFormatted = (playerResults ?? []).map((result) => ({
    gameId: result.game_id,
    category: result.category,
    playerId: result.player_id,
  }));
  const highlightResultsFormatted = (highlightResults ?? []).map((result) => ({
    playerId: result.player_id,
    rank: result.rank,
  }));

  const teamPicksByUser = new Map<string, TeamPickRow[]>();
  teamPicks.forEach((pick) => {
    const list = teamPicksByUser.get(pick.user_id);
    if (list) {
      list.push(pick);
    } else {
      teamPicksByUser.set(pick.user_id, [pick]);
    }
  });

  const playerPicksByUser = new Map<string, PlayerPickRow[]>();
  playerPicks.forEach((pick) => {
    const list = playerPicksByUser.get(pick.user_id);
    if (list) {
      list.push(pick);
    } else {
      playerPicksByUser.set(pick.user_id, [pick]);
    }
  });

  const highlightPicksByUser = new Map<string, HighlightPickRow[]>();
  highlightPicks.forEach((pick) => {
    const list = highlightPicksByUser.get(pick.user_id);
    if (list) {
      list.push(pick);
    } else {
      highlightPicksByUser.set(pick.user_id, [pick]);
    }
  });

  const nowIso = new Date().toISOString();

  const ledgerInserts: LedgerInsert[] = [];
  const userUpserts: Database['public']['Tables']['users']['Insert'][] = [];

  userIdList.forEach((userId) => {
    const score = computeDailyScore({
      teamPicks: (teamPicksByUser.get(userId) ?? []).map((pick) => ({
        gameId: pick.game_id,
        selectedTeamId: pick.selected_team_id,
      })),
      teamResults: teamResultsFormatted,
      playerPicks: (playerPicksByUser.get(userId) ?? []).map((pick) => ({
        gameId: pick.game_id,
        category: pick.category,
        playerId: pick.player_id,
      })),
      playerResults: playerResultsFormatted,
      highlightPicks: (highlightPicksByUser.get(userId) ?? []).map((pick) => ({
        playerId: pick.player_id,
        rank: pick.rank,
      })),
      highlightResults: highlightResultsFormatted,
    });

    const newDelta = score.totalPoints;
    const previousDelta = previousDeltaByUser.get(userId) ?? 0;

    const userRow = userMap.get(userId);
    const currentBalance = userRow?.anima_points_balance ?? 0;
    const newBalance = currentBalance - previousDelta + newDelta;

    if (userRow) {
      userUpserts.push({
        id: userRow.id,
        email: userRow.email,
        anima_points_balance: newBalance,
        updated_at: nowIso,
      });
    }

    if (newDelta > 0) {
      ledgerInserts.push({
        user_id: userId,
        delta: newDelta,
        balance_after: newBalance,
        reason,
        created_at: nowIso,
      });
    }
  });

  const { error: deleteLedgerError } = await supabaseAdmin
    .from(LEDGER_TABLE)
    .delete()
    .eq('reason', reason);

  if (deleteLedgerError) {
    throw deleteLedgerError;
  }

  if (userUpserts.length > 0) {
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .upsert(userUpserts, { onConflict: 'id' });

    if (userUpdateError) {
      throw userUpdateError;
    }
  }

  if (ledgerInserts.length > 0) {
    const { error: ledgerInsertError } = await supabaseAdmin
      .from(LEDGER_TABLE)
      .insert(ledgerInserts);

    if (ledgerInsertError) {
      throw ledgerInsertError;
    }
  }

  return {
    processed: ledgerInserts.length,
    users: userUpserts.length,
  };
};
