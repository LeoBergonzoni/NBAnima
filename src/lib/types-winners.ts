import { z } from 'zod';

// NOTE: Slate identifiers follow a yyyy-mm-dd format in US/Eastern.
export const SlateDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type SlateDate = z.infer<typeof SlateDateSchema>;

export const TeamWinnerSchema = z.object({
  game_id: z.string(),
  winner_team_id: z.string().nullable(),
  home_team_id: z.string(),
  away_team_id: z.string(),
  home_team_abbr: z.string().nullable().optional(),
  away_team_abbr: z.string().nullable().optional(),
  home_team_name: z.string().nullable().optional(),
  away_team_name: z.string().nullable().optional(),
  winner_team_abbr: z.string().nullable().optional(),
  winner_team_name: z.string().nullable().optional(),
});
export type TeamWinner = z.infer<typeof TeamWinnerSchema>;

// NOTE: category is included to disambiguate daily stat winners per pick type.
export const PlayerResultSchema = z.object({
  game_id: z.string(),
  category: z.string(),
  player_id: z.string(),
  team_id: z.string().nullable(),
  won: z.boolean(),
  first_name: z.string(),
  last_name: z.string(),
  provider_player_id: z.string().nullable().optional(),
});
export type PlayerResult = z.infer<typeof PlayerResultSchema>;

export const UserTeamPickSchema = z.object({
  game_id: z.string(),
  selected_team_id: z.string(),
  selected_team_abbr: z.string().nullable().optional(),
  selected_team_name: z.string().nullable().optional(),
  game: z
    .object({
      id: z.string().nullable().optional(),
      home_team_id: z.string().nullable().optional(),
      away_team_id: z.string().nullable().optional(),
      home_team_abbr: z.string().nullable().optional(),
      away_team_abbr: z.string().nullable().optional(),
      home_team_name: z.string().nullable().optional(),
      away_team_name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type UserTeamPick = z.infer<typeof UserTeamPickSchema>;

export const UserPlayerPickSchema = z.object({
  game_id: z.string(),
  category: z.string(),
  player_id: z.string(),
  team_id: z.string().nullable(),
  provider_player_id: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  game: z
    .object({
      id: z.string().nullable().optional(),
      home_team_id: z.string().nullable().optional(),
      away_team_id: z.string().nullable().optional(),
      home_team_abbr: z.string().nullable().optional(),
      away_team_abbr: z.string().nullable().optional(),
      home_team_name: z.string().nullable().optional(),
      away_team_name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type UserPlayerPick = z.infer<typeof UserPlayerPickSchema>;

export const HighlightPickSchema = z.object({
  player_id: z.string(),
  rank: z.number().int(),
});
export type HighlightPick = z.infer<typeof HighlightPickSchema>;

export const PointsByDateSchema = z.object({
  date: SlateDateSchema,
  total_points: z.number(),
});
export type PointsByDate = z.infer<typeof PointsByDateSchema>;

export const WinnersResponseSchema = z.object({
  date: SlateDateSchema,
  teams: z.array(TeamWinnerSchema),
  players: z.array(PlayerResultSchema),
});
export type WinnersResponse = z.infer<typeof WinnersResponseSchema>;

export const UserPicksResponseSchema = z.object({
  date: SlateDateSchema,
  teamPicks: z.array(UserTeamPickSchema),
  playerPicks: z.array(UserPlayerPickSchema),
  highlightPicks: z.array(HighlightPickSchema).optional(),
  changesCount: z.number().int().nonnegative().optional(),
});
export type UserPicksResponse = z.infer<typeof UserPicksResponseSchema>;

export const PointsResponseSchema = PointsByDateSchema;
