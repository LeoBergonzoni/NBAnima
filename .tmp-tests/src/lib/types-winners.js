"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointsResponseSchema = exports.UserPicksResponseSchema = exports.WinnersResponseSchema = exports.PointsByDateSchema = exports.HighlightPickSchema = exports.UserPlayerPickSchema = exports.UserTeamPickSchema = exports.PlayerResultSchema = exports.TeamWinnerSchema = exports.SlateDateSchema = void 0;
const zod_1 = require("zod");
// NOTE: Slate identifiers follow a yyyy-mm-dd format in US/Eastern.
exports.SlateDateSchema = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
exports.TeamWinnerSchema = zod_1.z.object({
    game_id: zod_1.z.string(),
    winner_team_id: zod_1.z.string().nullable(),
    home_team_id: zod_1.z.string(),
    away_team_id: zod_1.z.string(),
    home_team_abbr: zod_1.z.string().nullable().optional(),
    away_team_abbr: zod_1.z.string().nullable().optional(),
    home_team_name: zod_1.z.string().nullable().optional(),
    away_team_name: zod_1.z.string().nullable().optional(),
    winner_team_abbr: zod_1.z.string().nullable().optional(),
    winner_team_name: zod_1.z.string().nullable().optional(),
});
// NOTE: category is included to disambiguate daily stat winners per pick type.
exports.PlayerResultSchema = zod_1.z.object({
    game_id: zod_1.z.string(),
    category: zod_1.z.string(),
    player_id: zod_1.z.string(),
    team_id: zod_1.z.string().nullable(),
    won: zod_1.z.boolean(),
    first_name: zod_1.z.string(),
    last_name: zod_1.z.string(),
    provider_player_id: zod_1.z.string().nullable().optional(),
});
exports.UserTeamPickSchema = zod_1.z.object({
    game_id: zod_1.z.string(),
    selected_team_id: zod_1.z.string(),
    selected_team_abbr: zod_1.z.string().nullable().optional(),
    selected_team_name: zod_1.z.string().nullable().optional(),
    game: zod_1.z
        .object({
        id: zod_1.z.string().nullable().optional(),
        home_team_id: zod_1.z.string().nullable().optional(),
        away_team_id: zod_1.z.string().nullable().optional(),
        home_team_abbr: zod_1.z.string().nullable().optional(),
        away_team_abbr: zod_1.z.string().nullable().optional(),
        home_team_name: zod_1.z.string().nullable().optional(),
        away_team_name: zod_1.z.string().nullable().optional(),
    })
        .nullable()
        .optional(),
});
exports.UserPlayerPickSchema = zod_1.z.object({
    game_id: zod_1.z.string(),
    category: zod_1.z.string(),
    player_id: zod_1.z.string(),
    team_id: zod_1.z.string().nullable(),
    provider_player_id: zod_1.z.string().nullable().optional(),
    first_name: zod_1.z.string().nullable().optional(),
    last_name: zod_1.z.string().nullable().optional(),
    position: zod_1.z.string().nullable().optional(),
    game: zod_1.z
        .object({
        id: zod_1.z.string().nullable().optional(),
        home_team_id: zod_1.z.string().nullable().optional(),
        away_team_id: zod_1.z.string().nullable().optional(),
        home_team_abbr: zod_1.z.string().nullable().optional(),
        away_team_abbr: zod_1.z.string().nullable().optional(),
        home_team_name: zod_1.z.string().nullable().optional(),
        away_team_name: zod_1.z.string().nullable().optional(),
    })
        .nullable()
        .optional(),
});
exports.HighlightPickSchema = zod_1.z.object({
    player_id: zod_1.z.string(),
    rank: zod_1.z.number().int(),
});
exports.PointsByDateSchema = zod_1.z.object({
    date: exports.SlateDateSchema,
    total_points: zod_1.z.number(),
});
exports.WinnersResponseSchema = zod_1.z.object({
    date: exports.SlateDateSchema,
    teams: zod_1.z.array(exports.TeamWinnerSchema),
    players: zod_1.z.array(exports.PlayerResultSchema),
});
exports.UserPicksResponseSchema = zod_1.z.object({
    date: exports.SlateDateSchema,
    teamPicks: zod_1.z.array(exports.UserTeamPickSchema),
    playerPicks: zod_1.z.array(exports.UserPlayerPickSchema),
    highlightPicks: zod_1.z.array(exports.HighlightPickSchema).optional(),
    changesCount: zod_1.z.number().int().nonnegative().optional(),
});
exports.PointsResponseSchema = exports.PointsByDateSchema;
