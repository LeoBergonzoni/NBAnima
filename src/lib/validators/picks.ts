import { z } from 'zod';

const playerCategories = [
  'top_scorer',
  'top_assist',
  'top_rebound',
] as const;

export const playerCategorySchema = z.enum(playerCategories);
export type PlayerCategory = z.infer<typeof playerCategorySchema>;

const clientGameTeamSchema = z
  .object({
    abbr: z.string().min(1).optional(),
    providerTeamId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  })
  .passthrough();

export const clientGameDtoSchema = z
  .object({
    provider: z.literal('bdl'),
    providerGameId: z.string().min(1),
    season: z.string().min(1),
    status: z.string().min(1),
    dateNY: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTimeUTC: z.union([z.string().min(1), z.null()]).optional(),
    home: clientGameTeamSchema,
    away: clientGameTeamSchema,
  })
  .passthrough();

export const gameRefSchema = z
  .object({
    provider: z.literal('bdl'),
    providerGameId: z.string().min(1),
    dto: clientGameDtoSchema.optional(),
  })
  .passthrough();

export const teamPickSchema = z
  .object({
    gameId: z.string().min(1),
    teamId: z.string().min(1),
    gameProvider: z.literal('bdl').optional(),
    providerGameId: z.string().min(1).optional(),
    dto: clientGameDtoSchema.optional(),
  })
  .passthrough();

export const playerPickSchema = z.object({
  gameId: z.string().min(1),
  category: playerCategorySchema,
  playerId: z.string().min(1),
});

export const highlightPickSchema = z.object({
  playerId: z.string().min(1),
});

const gameMetaTeamSchema = z
  .object({
    abbr: z.string().min(1),
    name: z.string().min(1),
    providerTeamId: z.string().min(1).optional(),
  })
  .passthrough();

export const gameMetaSchema = z
  .object({
    provider: z.enum(['balldontlie', 'stub']).default('balldontlie'),
    providerGameId: z.string().min(1),
    gameDateISO: z.string().min(1),
    season: z.string().min(1),
    status: z.string().min(1).optional(),
    home: gameMetaTeamSchema,
    away: gameMetaTeamSchema,
    gameId: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
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
  gameUuids: z.array(z.string().min(1)),
  gameRefs: z.array(gameRefSchema).optional(),
  providerGameIds: z.array(z.string()).optional(),
}).superRefine((val, ctx) => {
  const categories = new Set<string>();
  val.players.forEach((pick) => {
    const key = `${pick.gameId}-${pick.category}`;
    if (categories.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate category ${pick.category} for game ${pick.gameId}`,
      });
    }
    categories.add(key);
  });

  const highlightPlayers = new Set<string>();
  val.highlights.forEach((highlight) => {
    if (highlightPlayers.has(highlight.playerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Highlight players must be unique.',
      });
    }
    highlightPlayers.add(highlight.playerId);
  });

  const uuidSet = new Set(val.gameUuids);
  const referencedGameIds = new Set<string>();
  val.teams.forEach((pick) => referencedGameIds.add(pick.gameId));
  val.players.forEach((pick) => referencedGameIds.add(pick.gameId));
  const missingReferences = Array.from(referencedGameIds).filter(
    (id) => !uuidSet.has(id),
  );
  if (missingReferences.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Missing gameUuids for: ${missingReferences.join(', ')}`,
    });
  }
});

export type PicksPayload = z.infer<typeof picksPayloadSchema>;
