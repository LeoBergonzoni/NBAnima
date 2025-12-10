"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPointsByDate = exports.getUserPicksByDate = exports.getWinnersByDate = void 0;
const date_us_eastern_1 = require("../../lib/date-us-eastern");
const types_winners_1 = require("../../lib/types-winners");
const unique = (values) => Array.from(new Set(values.filter(Boolean)));
const utcRangeForDate = (date) => (0, date_us_eastern_1.getSlateBoundsUtc)(date);
const getWinnersByDate = async (client, date) => {
    const { start, end } = utcRangeForDate(date);
    const { data: games, error: gamesError } = await client
        .from('games')
        .select('id, home_team_id, away_team_id')
        .gte('game_date', start)
        .lt('game_date', end);
    if (gamesError) {
        throw gamesError;
    }
    const gameIds = unique((games ?? []).map((game) => game.id));
    if (gameIds.length === 0) {
        return { teams: [], players: [] };
    }
    const [{ data: teamResults, error: teamError }, { data: playerResults, error: playerError }] = await Promise.all([
        client
            .from('results_team')
            .select('game_id, winner_team_id')
            .in('game_id', gameIds),
        client
            .from('results_players')
            .select('game_id, category, player_id, settled_at')
            .in('game_id', gameIds),
    ]);
    if (teamError) {
        throw teamError;
    }
    if (playerError) {
        throw playerError;
    }
    const teamIds = unique([
        ...games.flatMap((game) => [game.home_team_id, game.away_team_id]),
        ...(teamResults ?? []).map((result) => result.winner_team_id),
    ]);
    const { data: teamLookup, error: teamLookupError } = await client
        .from('teams')
        .select('id, abbr, name')
        .in('id', teamIds);
    if (teamLookupError) {
        throw teamLookupError;
    }
    const teamMeta = new Map(teamLookup?.map((team) => [team.id, team]) ?? []);
    const gamesMeta = new Map(games?.map((game) => [
        game.id,
        {
            home_team_id: game.home_team_id,
            away_team_id: game.away_team_id,
            home_team_abbr: teamMeta.get(game.home_team_id)?.abbr ?? null,
            away_team_abbr: teamMeta.get(game.away_team_id)?.abbr ?? null,
            home_team_name: teamMeta.get(game.home_team_id)?.name ?? null,
            away_team_name: teamMeta.get(game.away_team_id)?.name ?? null,
        },
    ]) ?? []);
    const teams = (teamResults ?? []).map((result) => {
        const meta = gamesMeta.get(result.game_id);
        const winnerMeta = result.winner_team_id ? teamMeta.get(result.winner_team_id) : undefined;
        return types_winners_1.TeamWinnerSchema.parse({
            game_id: result.game_id,
            winner_team_id: result.winner_team_id ?? null,
            home_team_id: meta?.home_team_id ?? '',
            away_team_id: meta?.away_team_id ?? '',
            home_team_abbr: meta?.home_team_abbr ?? null,
            away_team_abbr: meta?.away_team_abbr ?? null,
            home_team_name: meta?.home_team_name ?? null,
            away_team_name: meta?.away_team_name ?? null,
            winner_team_abbr: winnerMeta?.abbr ?? null,
            winner_team_name: winnerMeta?.name ?? null,
        });
    });
    const playerIds = unique((playerResults ?? []).map((row) => row.player_id));
    const { data: playersLookup, error: playersLookupError } = playerIds.length
        ? await client
            .from('player')
            .select('id, first_name, last_name, team_id, provider_player_id')
            .in('id', playerIds)
        : { data: [], error: null };
    if (playersLookupError) {
        throw playersLookupError;
    }
    const playerMeta = new Map(playersLookup?.map((player) => [player.id, player]) ?? []);
    const players = (playerResults ?? []).map((result) => {
        const meta = playerMeta.get(result.player_id);
        return types_winners_1.PlayerResultSchema.parse({
            game_id: result.game_id,
            category: result.category,
            player_id: result.player_id,
            team_id: meta?.team_id ?? null,
            won: true,
            first_name: meta?.first_name ?? '',
            last_name: meta?.last_name ?? '',
            provider_player_id: meta?.provider_player_id ?? null,
        });
    });
    return {
        teams,
        players,
    };
};
exports.getWinnersByDate = getWinnersByDate;
const getUserPicksByDate = async (client, userId, date) => {
    const { data: teamRows, error: teamError } = await client
        .from('picks_teams')
        .select(`
        game_id,
        selected_team_id,
        selected_team_abbr,
        selected_team_name,
        changes_count,
        game:game_id (
          id,
          home_team_id,
          away_team_id,
          home_team_abbr,
          away_team_abbr,
          home_team_name,
          away_team_name
        )
      `)
        .eq('user_id', userId)
        .eq('pick_date', date);
    if (teamError) {
        throw teamError;
    }
    const { data: playerRows, error: playerError } = await client
        .from('picks_players')
        .select(`
        game_id,
        category,
        player_id,
        changes_count,
        player:player_id (
          first_name,
          last_name,
          team_id,
          position,
          provider_player_id
        ),
        game:game_id (
          id,
          home_team_id,
          away_team_id,
          home_team_abbr,
          away_team_abbr,
          home_team_name,
          away_team_name
        )
      `)
        .eq('user_id', userId)
        .eq('pick_date', date);
    if (playerError) {
        throw playerError;
    }
    const { data: highlightRows, error: highlightError } = await client
        .from('picks_highlights')
        .select('player_id, rank, changes_count')
        .eq('user_id', userId)
        .eq('pick_date', date);
    if (highlightError) {
        throw highlightError;
    }
    const teamPicks = (teamRows ?? []).map((row) => types_winners_1.UserTeamPickSchema.parse({
        game_id: row.game_id,
        selected_team_id: row.selected_team_id,
        selected_team_abbr: row.selected_team_abbr ?? null,
        selected_team_name: row.selected_team_name ?? null,
        game: row.game ?? null,
    }));
    const seenPlayers = new Set();
    const playerPicks = (playerRows ?? []).reduce((acc, row) => {
        const key = `${row.game_id}:${row.category}:${row.player_id}`;
        if (seenPlayers.has(key)) {
            return acc;
        }
        seenPlayers.add(key);
        const meta = row.player;
        const parsed = types_winners_1.UserPlayerPickSchema.parse({
            game_id: row.game_id,
            category: row.category,
            player_id: row.player_id,
            team_id: meta?.team_id ?? null,
            provider_player_id: meta?.provider_player_id ?? null,
            first_name: meta?.first_name ?? null,
            last_name: meta?.last_name ?? null,
            position: meta?.position ?? null,
            game: row.game ?? null,
        });
        acc.push(parsed);
        return acc;
    }, []);
    const highlightChangeCounts = (highlightRows ?? []).map((row) => row.changes_count ?? 0);
    const highlightPicks = (highlightRows ?? []).map((row) => ({
        player_id: row.player_id,
        rank: row.rank,
    }));
    const teamChangeCounts = (teamRows ?? []).map((row) => row.changes_count ?? 0);
    const playerChangeCounts = (playerRows ?? []).map((row) => row.changes_count ?? 0);
    const changesCount = Math.max(0, ...teamChangeCounts, ...playerChangeCounts, ...highlightChangeCounts);
    return {
        teamPicks,
        playerPicks,
        highlightPicks,
        changesCount,
    };
};
exports.getUserPicksByDate = getUserPicksByDate;
const getPointsByDate = async (client, userId, date) => {
    const reason = `settlement:${date}`;
    const { data, error } = await client
        .from('anima_points_ledger')
        .select('delta')
        .eq('user_id', userId)
        .eq('reason', reason);
    if (error) {
        throw error;
    }
    const total = (data ?? []).reduce((sum, entry) => sum + (entry.delta ?? 0), 0);
    return types_winners_1.PointsByDateSchema.parse({
        date,
        total_points: total,
    });
};
exports.getPointsByDate = getPointsByDate;
