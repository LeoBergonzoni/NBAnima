import { createAdminSupabaseClient } from '@/lib/supabase';
import type { TablesRow } from '@/lib/supabase.types';

import { computeDailyScore } from './index';

type TeamPickRow = TablesRow<'picks_teams'>;
type PlayerPickRow = TablesRow<'picks_players'>;
type HighlightPickRow = TablesRow<'picks_highlights'>;
type TeamResultRow = TablesRow<'results_team'>;
type PlayerResultRow = TablesRow<'results_players'>;
type HighlightResultRow = TablesRow<'results_highlights'>;
type HighlightResultSummary = Pick<HighlightResultRow, 'player_id' | 'rank'>;

const formatTeamPicks = (picks: TeamPickRow[]) =>
  picks.map((pick) => ({
    gameId: pick.game_id,
    selectedTeamId: pick.selected_team_id,
  }));

const formatPlayerPicks = (picks: PlayerPickRow[]) =>
  picks.map((pick) => ({
    gameId: pick.game_id,
    category: pick.category,
    playerId: pick.player_id,
  }));

const formatHighlightPicks = (picks: HighlightPickRow[]) =>
  picks.map((pick) => ({
    playerId: pick.player_id,
    rank: pick.rank,
  }));

const formatTeamResults = (results: TeamResultRow[]) =>
  results.map((result) => ({
    gameId: result.game_id,
    winnerTeamId: result.winner_team_id,
  }));

const formatPlayerResults = (results: PlayerResultRow[]) =>
  results.map((result) => ({
    gameId: result.game_id,
    category: result.category,
    playerId: result.player_id,
  }));

const formatHighlightResults = (results: HighlightResultSummary[]) =>
  results.map((result) => ({
    playerId: result.player_id,
    rank: result.rank,
  }));

export async function calculateUserSlatePoints(
  userId: string,
  slateDate: string,
): Promise<number> {
  const supabaseAdmin = createAdminSupabaseClient();

  const [
    { data: teamPickRows, error: teamPickError },
    { data: playerPickRows, error: playerPickError },
    { data: highlightPickRows, error: highlightPickError },
  ] = await Promise.all([
    supabaseAdmin
      .from('picks_teams')
      .select('*')
      .eq('user_id', userId)
      .eq('pick_date', slateDate)
      .returns<TeamPickRow[]>(),
    supabaseAdmin
      .from('picks_players')
      .select('*')
      .eq('user_id', userId)
      .eq('pick_date', slateDate)
      .returns<PlayerPickRow[]>(),
    supabaseAdmin
      .from('picks_highlights')
      .select('*')
      .eq('user_id', userId)
      .eq('pick_date', slateDate)
      .returns<HighlightPickRow[]>(),
  ]);

  if (teamPickError || playerPickError || highlightPickError) {
    throw (
      teamPickError ??
      playerPickError ??
      highlightPickError ??
      new Error('Failed to load picks for scoring')
    );
  }

  const teamPicks = teamPickRows ?? [];
  const playerPicks = playerPickRows ?? [];
  const highlightPicks = highlightPickRows ?? [];

  if (
    teamPicks.length === 0 &&
    playerPicks.length === 0 &&
    highlightPicks.length === 0
  ) {
    return 0;
  }

  const gameIds = Array.from(
    new Set(
      [
        ...teamPicks.map((pick) => pick.game_id),
        ...playerPicks.map((pick) => pick.game_id),
      ].filter(Boolean),
    ),
  );
  const shouldLoadGameResults = gameIds.length > 0;

  const teamResultsPromise = shouldLoadGameResults
    ? supabaseAdmin
        .from('results_team')
        .select('*')
        .in('game_id', gameIds)
        .returns<TeamResultRow[]>()
    : Promise.resolve({ data: [] as TeamResultRow[], error: null });

  const playerResultsPromise = shouldLoadGameResults
    ? supabaseAdmin
        .from('results_players')
        .select('*')
        .in('game_id', gameIds)
        .returns<PlayerResultRow[]>()
    : Promise.resolve({ data: [] as PlayerResultRow[], error: null });

  const highlightResultsPromise = supabaseAdmin
    .from('results_highlights')
    .select('player_id, rank')
    .eq('result_date', slateDate)
    .returns<HighlightResultSummary[]>();

  const [
    { data: teamResultRows, error: teamResultError },
    { data: playerResultRows, error: playerResultError },
    { data: highlightResultRows, error: highlightResultError },
  ] = await Promise.all([
    teamResultsPromise,
    playerResultsPromise,
    highlightResultsPromise,
  ]);

  if (teamResultError || playerResultError || highlightResultError) {
    throw (
      teamResultError ??
      playerResultError ??
      highlightResultError ??
      new Error('Failed to load results for scoring')
    );
  }

  const score = computeDailyScore({
    teamPicks: formatTeamPicks(teamPicks),
    teamResults: formatTeamResults(teamResultRows ?? []),
    playerPicks: formatPlayerPicks(playerPicks),
    playerResults: formatPlayerResults(playerResultRows ?? []),
    highlightPicks: formatHighlightPicks(highlightPicks),
    highlightResults: formatHighlightResults(highlightResultRows ?? []),
  });

  return score.totalPoints;
}
