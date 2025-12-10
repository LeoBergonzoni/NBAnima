"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.picksPayloadSchema = exports.gameMetaSchema = exports.highlightPickSchema = exports.playerPickSchema = exports.teamPickSchema = exports.gameRefSchema = exports.clientGameDtoSchema = exports.playerCategorySchema = void 0;
const zod_1 = require("zod");
const playerCategories = [
    'top_scorer',
    'top_assist',
    'top_rebound',
];
exports.playerCategorySchema = zod_1.z.enum(playerCategories);
const clientGameTeamSchema = zod_1.z
    .object({
    abbr: zod_1.z.string().min(1).optional(),
    providerTeamId: zod_1.z.string().min(1).optional(),
    name: zod_1.z.string().min(1).optional(),
})
    .passthrough();
exports.clientGameDtoSchema = zod_1.z
    .object({
    provider: zod_1.z.literal('bdl'),
    providerGameId: zod_1.z.string().min(1),
    season: zod_1.z.string().min(1),
    status: zod_1.z.string().min(1),
    dateNY: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTimeUTC: zod_1.z.union([zod_1.z.string().min(1), zod_1.z.null()]).optional(),
    home: clientGameTeamSchema,
    away: clientGameTeamSchema,
})
    .passthrough();
exports.gameRefSchema = zod_1.z
    .object({
    provider: zod_1.z.literal('bdl'),
    providerGameId: zod_1.z.string().min(1),
    dto: exports.clientGameDtoSchema.optional(),
})
    .passthrough();
exports.teamPickSchema = zod_1.z
    .object({
    gameId: zod_1.z.string().min(1),
    teamId: zod_1.z.string().min(1),
    gameProvider: zod_1.z.literal('bdl').optional(),
    providerGameId: zod_1.z.string().min(1).optional(),
    dto: exports.clientGameDtoSchema.optional(),
})
    .passthrough();
exports.playerPickSchema = zod_1.z.object({
    gameId: zod_1.z.string().min(1),
    category: exports.playerCategorySchema,
    playerId: zod_1.z.string().min(1),
});
exports.highlightPickSchema = zod_1.z.object({
    playerId: zod_1.z.string().min(1),
});
const gameMetaTeamSchema = zod_1.z
    .object({
    abbr: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    providerTeamId: zod_1.z.string().min(1).optional(),
})
    .passthrough();
exports.gameMetaSchema = zod_1.z
    .object({
    provider: zod_1.z.enum(['balldontlie', 'stub']).default('balldontlie'),
    providerGameId: zod_1.z.string().min(1),
    gameDateISO: zod_1.z.string().min(1),
    season: zod_1.z.string().min(1),
    status: zod_1.z.string().min(1).optional(),
    home: gameMetaTeamSchema,
    away: gameMetaTeamSchema,
    gameId: zod_1.z.string().min(1).optional(),
    id: zod_1.z.string().min(1).optional(),
})
    .passthrough();
exports.picksPayloadSchema = zod_1.z.object({
    pickDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'pickDate must be in YYYY-MM-DD format'),
    teams: zod_1.z.array(exports.teamPickSchema),
    players: zod_1.z.array(exports.playerPickSchema),
    // prima era .length(5); ora permettiamo 0..5
    highlights: zod_1.z
        .array(exports.highlightPickSchema)
        .max(5, 'Up to 5 highlight picks are allowed'),
    gamesMeta: zod_1.z.array(exports.gameMetaSchema).optional(),
    gameUuids: zod_1.z.array(zod_1.z.string().min(1)),
    gameRefs: zod_1.z.array(exports.gameRefSchema).optional(),
    providerGameIds: zod_1.z.array(zod_1.z.string()).optional(),
}).superRefine((val, ctx) => {
    const categories = new Set();
    val.players.forEach((pick) => {
        const key = `${pick.gameId}-${pick.category}`;
        if (categories.has(key)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `Duplicate category ${pick.category} for game ${pick.gameId}`,
            });
        }
        categories.add(key);
    });
    const highlightPlayers = new Set();
    val.highlights.forEach((highlight) => {
        if (highlightPlayers.has(highlight.playerId)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Highlight players must be unique.',
            });
        }
        highlightPlayers.add(highlight.playerId);
    });
    const uuidSet = new Set(val.gameUuids);
    const referencedGameIds = new Set();
    val.teams.forEach((pick) => referencedGameIds.add(pick.gameId));
    val.players.forEach((pick) => referencedGameIds.add(pick.gameId));
    const missingReferences = Array.from(referencedGameIds).filter((id) => !uuidSet.has(id));
    if (missingReferences.length > 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Missing gameUuids for: ${missingReferences.join(', ')}`,
        });
    }
});
