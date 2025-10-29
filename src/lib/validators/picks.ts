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
});

export type PicksPayload = z.infer<typeof picksPayloadSchema>;
