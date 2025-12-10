"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const providers_1 = require("../../../lib/providers");
const supabase_1 = require("../../../lib/supabase");
const resolveGame_1 = require("../../../lib/server/resolveGame");
const constants_1 = require("../../../lib/constants");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const toDateNy = (iso) => {
    if (!iso) {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: constants_1.TIMEZONES.US_EASTERN,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: constants_1.TIMEZONES.US_EASTERN,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());
    }
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: constants_1.TIMEZONES.US_EASTERN,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
};
async function GET() {
    try {
        const games = await (0, providers_1.listNextNightGames)();
        const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
        const results = await Promise.allSettled(games.map(async (game) => {
            const dto = {
                provider: 'bdl',
                providerGameId: game.id,
                season: 'unknown',
                status: game.status ?? 'scheduled',
                dateNY: toDateNy(game.startsAt),
                startTimeUTC: game.startsAt ?? null,
                home: {
                    abbr: game.homeTeam?.abbreviation ?? undefined,
                    name: game.homeTeam?.name ?? undefined,
                    providerTeamId: game.homeTeam?.id,
                },
                away: {
                    abbr: game.awayTeam?.abbreviation ?? undefined,
                    name: game.awayTeam?.name ?? undefined,
                    providerTeamId: game.awayTeam?.id,
                },
            };
            const result = await (0, resolveGame_1.resolveOrUpsertGame)({
                supabaseAdmin,
                gameProvider: 'bdl',
                providerGameId: game.id,
                dto,
            });
            return {
                ...game,
                id: result.id,
                provider_game_id: game.id,
            };
        }));
        const enrichedGames = results.map((entry, index) => {
            if (entry.status === 'fulfilled') {
                return entry.value;
            }
            return {
                ...games[index],
                provider_game_id: games[index].id,
            };
        });
        const warnings = results
            .map((result, index) => ({ result, game: games[index] }))
            .filter(({ result }) => result.status === 'rejected')
            .map(({ result, game }) => ({
            providerGameId: game.id,
            reason: result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
        }));
        const payload = warnings.length > 0
            ? { games: enrichedGames, warnings }
            : enrichedGames;
        return server_1.NextResponse.json(payload);
    }
    catch (error) {
        console.error('[api/games]', error);
        return server_1.NextResponse.json({ error: 'Failed to load games' }, { status: 500 });
    }
}
