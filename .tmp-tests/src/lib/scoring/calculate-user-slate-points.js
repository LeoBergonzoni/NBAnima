"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateUserSlatePoints = calculateUserSlatePoints;
const supabase_1 = require("../../lib/supabase");
const index_1 = require("./index");
const formatTeamPicks = (picks) => picks.map((pick) => ({
    gameId: pick.game_id,
    selectedTeamId: pick.selected_team_id,
}));
const formatPlayerPicks = (picks, identities) => picks.map((pick) => ({
    gameId: pick.game_id,
    category: pick.category,
    playerId: pick.player_id,
    providerPlayerId: pick.player?.provider_player_id ??
        identities.get(pick.player_id)?.providerId ??
        null,
    playerName: identities.get(pick.player_id)?.name ?? null,
}));
const formatHighlightPicks = (picks, identities) => picks.map((pick) => ({
    playerId: pick.player_id,
    rank: pick.rank,
    providerPlayerId: pick.player?.provider_player_id ??
        identities.get(pick.player_id)?.providerId ??
        null,
    playerName: identities.get(pick.player_id)?.name ?? null,
}));
const formatTeamResults = (results) => results.map((result) => ({
    gameId: result.game_id,
    winnerTeamId: result.winner_team_id,
}));
const formatPlayerResults = (results, identities) => results.map((result) => ({
    gameId: result.game_id,
    category: result.category,
    playerId: result.player_id,
    providerPlayerId: result.player?.provider_player_id ??
        identities.get(result.player_id)?.providerId ??
        null,
    playerName: identities.get(result.player_id)?.name ?? null,
}));
const formatHighlightResults = (results, identities) => results.map((result) => ({
    playerId: result.player_id,
    rank: result.rank,
    providerPlayerId: result.player?.provider_player_id ??
        identities.get(result.player_id)?.providerId ??
        null,
    playerName: identities.get(result.player_id)?.name ?? null,
}));
async function calculateUserSlatePoints(userId, slateDate) {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    const [{ data: teamPickRows, error: teamPickError }, { data: playerPickRows, error: playerPickError }, { data: highlightPickRows, error: highlightPickError },] = await Promise.all([
        supabaseAdmin
            .from('picks_teams')
            .select('*')
            .eq('user_id', userId)
            .eq('pick_date', slateDate)
            .returns(),
        supabaseAdmin
            .from('picks_players')
            .select('*, player:player_id (provider_player_id)')
            .eq('user_id', userId)
            .eq('pick_date', slateDate)
            .returns(),
        supabaseAdmin
            .from('picks_highlights')
            .select('*, player:player_id (provider_player_id)')
            .eq('user_id', userId)
            .eq('pick_date', slateDate)
            .returns(),
    ]);
    if (teamPickError || playerPickError || highlightPickError) {
        throw (teamPickError ??
            playerPickError ??
            highlightPickError ??
            new Error('Failed to load picks for scoring'));
    }
    const teamPicks = teamPickRows ?? [];
    const playerPicks = playerPickRows ?? [];
    const highlightPicks = highlightPickRows ?? [];
    if (teamPicks.length === 0 &&
        playerPicks.length === 0 &&
        highlightPicks.length === 0) {
        return 0;
    }
    const gameIds = Array.from(new Set([
        ...teamPicks.map((pick) => pick.game_id),
        ...playerPicks.map((pick) => pick.game_id),
    ].filter(Boolean)));
    const shouldLoadGameResults = gameIds.length > 0;
    const teamResultsPromise = shouldLoadGameResults
        ? supabaseAdmin
            .from('results_team')
            .select('*')
            .in('game_id', gameIds)
            .returns()
        : Promise.resolve({ data: [], error: null });
    const playerResultsPromise = shouldLoadGameResults
        ? supabaseAdmin
            .from('results_players')
            .select('game_id, category, player_id')
            .in('game_id', gameIds)
            .returns()
        : Promise.resolve({ data: [], error: null });
    const highlightResultsPromise = supabaseAdmin
        .from('results_highlights')
        .select('player_id, rank')
        .eq('result_date', slateDate)
        .returns();
    const [{ data: teamResultRows, error: teamResultError }, { data: playerResultRows, error: playerResultError }, { data: highlightResultRows, error: highlightResultError },] = await Promise.all([
        teamResultsPromise,
        playerResultsPromise,
        highlightResultsPromise,
    ]);
    if (teamResultError || playerResultError || highlightResultError) {
        throw (teamResultError ??
            playerResultError ??
            highlightResultError ??
            new Error('Failed to load results for scoring'));
    }
    const identitiesByPlayerId = new Map();
    const allPlayerIds = new Set();
    playerPicks.forEach((pick) => {
        if (pick.player_id)
            allPlayerIds.add(pick.player_id);
    });
    highlightPicks.forEach((pick) => {
        if (pick.player_id)
            allPlayerIds.add(pick.player_id);
    });
    (playerResultRows ?? []).forEach((row) => {
        if (row.player_id)
            allPlayerIds.add(row.player_id);
    });
    (highlightResultRows ?? []).forEach((row) => {
        if (row.player_id)
            allPlayerIds.add(row.player_id);
    });
    if (allPlayerIds.size > 0) {
        const { data: playerLookup, error: playerLookupError } = await supabaseAdmin
            .from('player')
            .select('id, provider_player_id, first_name, last_name')
            .in('id', Array.from(allPlayerIds));
        if (playerLookupError) {
            throw playerLookupError;
        }
        (playerLookup ?? []).forEach((row) => {
            const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || null;
            identitiesByPlayerId.set(row.id, {
                providerId: row.provider_player_id ?? null,
                name: fullName,
            });
        });
    }
    const score = (0, index_1.computeDailyScore)({
        teamPicks: formatTeamPicks(teamPicks),
        teamResults: formatTeamResults(teamResultRows ?? []),
        playerPicks: formatPlayerPicks(playerPicks, identitiesByPlayerId),
        playerResults: formatPlayerResults(playerResultRows ?? [], identitiesByPlayerId),
        highlightPicks: formatHighlightPicks(highlightPicks, identitiesByPlayerId),
        highlightResults: formatHighlightResults(highlightResultRows ?? [], identitiesByPlayerId),
    });
    return score.totalPoints;
}
