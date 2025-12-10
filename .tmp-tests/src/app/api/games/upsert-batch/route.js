"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const date_fns_tz_1 = require("date-fns-tz");
const zod_1 = require("zod");
const supabase_1 = require("../../../../lib/supabase");
const constants_1 = require("../../../../lib/constants");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clientTeamSchema = zod_1.z.object({
    abbr: zod_1.z.string().min(1).optional(),
    providerTeamId: zod_1.z.string().min(1).optional(),
    name: zod_1.z.string().min(1).optional(),
});
const clientGameSchema = zod_1.z.object({
    provider: zod_1.z.literal('bdl'),
    providerGameId: zod_1.z.string().min(1),
    season: zod_1.z.string().min(1),
    status: zod_1.z.string().min(1),
    dateNY: zod_1.z
        .string()
        .regex(DATE_REGEX, { message: 'dateNY must be YYYY-MM-DD' }),
    startTimeUTC: zod_1.z
        .union([zod_1.z.string().min(1), zod_1.z.null()])
        .optional(),
    home: clientTeamSchema,
    away: clientTeamSchema,
});
const requestSchema = zod_1.z.object({
    date: zod_1.z.string().regex(DATE_REGEX, { message: 'date must be YYYY-MM-DD' }),
    games: zod_1.z.array(clientGameSchema),
});
const isUuidLike = (value) => typeof value === 'string' && UUID_REGEX.test(value);
const normalizeTeamAbbr = (abbr) => typeof abbr === 'string' ? abbr.trim().toUpperCase() : '';
const parseIsoDate = (value) => {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};
const getGameDateIso = (game) => {
    const startTimeIso = parseIsoDate(game.startTimeUTC ?? null);
    if (startTimeIso) {
        return startTimeIso;
    }
    const zoned = (0, date_fns_tz_1.fromZonedTime)(`${game.dateNY}T00:00:00`, constants_1.TIMEZONES.US_EASTERN);
    return zoned.toISOString();
};
const collectTeamLookup = async (games) => {
    const providerTeamIds = new Set();
    const abbrs = new Set();
    const registerTeam = (team) => {
        if (!team) {
            return;
        }
        const providerTeamId = team.providerTeamId?.trim();
        if (providerTeamId && !isUuidLike(providerTeamId)) {
            providerTeamIds.add(providerTeamId);
        }
        const abbr = normalizeTeamAbbr(team.abbr);
        if (abbr) {
            abbrs.add(abbr);
        }
    };
    games.forEach((game) => {
        registerTeam(game.home);
        registerTeam(game.away);
    });
    const byProviderTeamId = new Map();
    const byAbbr = new Map();
    if (providerTeamIds.size > 0) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('teams')
            .select('id, provider_team_id, abbr')
            .eq('provider', 'bdl')
            .in('provider_team_id', Array.from(providerTeamIds));
        if (error) {
            throw error;
        }
        (data ?? []).forEach((team) => {
            if (team.provider_team_id) {
                byProviderTeamId.set(team.provider_team_id, team.id);
            }
            if (team.abbr) {
                byAbbr.set(normalizeTeamAbbr(team.abbr), team.id);
            }
        });
    }
    const abbrsToFetch = Array.from(abbrs).filter((abbr) => !byAbbr.has(abbr));
    if (abbrsToFetch.length > 0) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('teams')
            .select('id, provider_team_id, abbr')
            .eq('provider', 'bdl')
            .in('abbr', abbrsToFetch);
        if (error) {
            throw error;
        }
        (data ?? []).forEach((team) => {
            if (team.provider_team_id) {
                byProviderTeamId.set(team.provider_team_id, team.id);
            }
            if (team.abbr) {
                byAbbr.set(normalizeTeamAbbr(team.abbr), team.id);
            }
        });
    }
    return { byProviderTeamId, byAbbr };
};
const resolveTeamId = (team, lookup) => {
    if (!team) {
        return null;
    }
    const providerTeamId = team.providerTeamId?.trim();
    if (providerTeamId) {
        if (isUuidLike(providerTeamId)) {
            return providerTeamId;
        }
        const mapped = lookup.byProviderTeamId.get(providerTeamId);
        if (mapped) {
            return mapped;
        }
    }
    const abbr = normalizeTeamAbbr(team.abbr);
    if (abbr) {
        const mapped = lookup.byAbbr.get(abbr);
        if (mapped) {
            return mapped;
        }
    }
    return null;
};
async function POST(request) {
    try {
        const json = await request.json();
        const parsed = requestSchema.safeParse(json);
        if (!parsed.success) {
            return server_1.NextResponse.json({ ok: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
        }
        const { games } = parsed.data;
        if (games.length === 0) {
            return server_1.NextResponse.json({ ok: true, count: 0, games: [], warnings: [] });
        }
        const lookup = await collectTeamLookup(games);
        const warnings = [];
        const nowIso = new Date().toISOString();
        const upserts = [];
        games.forEach((game) => {
            const homeTeamId = resolveTeamId(game.home, lookup);
            const awayTeamId = resolveTeamId(game.away, lookup);
            if (!homeTeamId || !awayTeamId) {
                const missingSides = [];
                if (!homeTeamId) {
                    missingSides.push('home');
                }
                if (!awayTeamId) {
                    missingSides.push('away');
                }
                warnings.push({
                    providerGameId: game.providerGameId,
                    reason: `Unable to resolve ${missingSides.join(' & ')} team`,
                });
                return;
            }
            upserts.push({
                provider: game.provider,
                provider_game_id: game.providerGameId,
                season: game.season,
                status: game.status,
                game_date: getGameDateIso(game),
                home_team_id: homeTeamId,
                away_team_id: awayTeamId,
                home_team_abbr: game.home.abbr ?? null,
                home_team_name: game.home.name ?? null,
                away_team_abbr: game.away.abbr ?? null,
                away_team_name: game.away.name ?? null,
                updated_at: nowIso,
            });
        });
        let rows = [];
        if (upserts.length > 0) {
            const { data, error } = await supabase_1.supabaseAdmin
                .from('games')
                .upsert(upserts, { onConflict: 'provider,provider_game_id' })
                .select('id, provider_game_id, home_team_abbr, away_team_abbr, game_date, status');
            if (error) {
                throw error;
            }
            rows = data;
        }
        const responseGames = (rows ?? []).map((row) => ({
            id: row.id,
            providerGameId: row.provider_game_id,
            home_abbr: row.home_team_abbr,
            away_abbr: row.away_team_abbr,
            game_date: row.game_date,
            status: row.status,
        }));
        const status = warnings.length > 0 ? 207 : 200;
        return server_1.NextResponse.json({
            ok: true,
            count: responseGames.length,
            games: responseGames,
            warnings,
        }, { status });
    }
    catch (error) {
        console.error('[api/games/upsert-batch][POST]', error);
        return server_1.NextResponse.json({ ok: false, error: error.message ?? 'Failed to upsert games' }, { status: 500 });
    }
}
