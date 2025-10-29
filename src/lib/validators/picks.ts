import { z } from 'zod';

const playerCategories = [
  'top_scorer',
  'top_assist',
  'top_rebound',
] as const;

export const playerCategorySchema = z.enum(playerCategories);
export type PlayerCategory = z.infer<typeof playerCategorySchema>;

export const teamPickSchema = z.object({
  gameId: z.string().min(1),
  teamId: z.string().min(1),
});

export const playerPickSchema = z.object({
  gameId: z.string().min(1),
  category: playerCategorySchema,
  playerId: z.string().min(1),
});

export const highlightPickSchema = z.object({
  playerId: z.string().min(1),
  rank: z.number().int().min(1).max(10),
});

const gameMetaTeamSchema = z
  .object({
    id: z.string().min(1).nullable().optional(),
    providerId: z.string().min(1).nullable().optional(),
    abbreviation: z.string().min(1).nullable().optional(),
    abbr: z.string().min(1).nullable().optional(),
    name: z.string().min(1).nullable().optional(),
    code: z.string().min(1).nullable().optional(),
    slug: z.string().min(1).nullable().optional(),
  })
  .passthrough();

export const gameMetaSchema = z
  .object({
    gameId: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    providerGameId: z.string().min(1).optional(),
    startsAt: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    season: z.string().min(1).optional(),
    homeTeam: gameMetaTeamSchema.nullish(),
    awayTeam: gameMetaTeamSchema.nullish(),
    home: gameMetaTeamSchema.nullish(),
    away: gameMetaTeamSchema.nullish(),
  })
  .passthrough();

export const picksPayloadSchema = z.object({
  pickDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'pickDate must be in YYYY-MM-DD format'),
  teams: z.array(teamPickSchema),
  players: z.array(playerPickSchema),
  // prima era .length(5); ora permettiamo 0..5
  highlights: z
    .array(highlightPickSchema)
    .max(5, 'Up to 5 highlight picks are allowed'),
  gamesMeta: z.array(gameMetaSchema).optional(),
});

export type PicksPayload = z.infer<typeof picksPayloadSchema>;
