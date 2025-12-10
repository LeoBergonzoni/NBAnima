"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
exports.POST = POST;
exports.PUT = PUT;
const crypto_1 = require("crypto");
const server_1 = require("next/server");
const zod_1 = require("zod");
const picks_1 = require("../../../lib/picks");
const supabase_1 = require("../../../lib/supabase");
const resolveGame_1 = require("../../../lib/server/resolveGame");
const rosters_1 = require("../../../lib/rosters");
const constants_1 = require("../../../lib/constants");
const date_us_eastern_1 = require("../../../lib/date-us-eastern");
const types_winners_1 = require("../../../lib/types-winners");
const winners_service_1 = require("../../../server/services/winners.service");
const upsertPlayers_1 = require("../../../lib/db/upsertPlayers");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
// Identificatore del “sorgente” per i tuoi ID esterni
const PLAYER_PROVIDER = 'local-rosters'; // o 'balldontlie' se preferisci unificare
function isUuidLike(v) {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}
function looksLikeAbbr(v) {
    return /^[A-Z]{2,4}$/.test(v);
}
function teamUuidFromAbbr(input) {
    const value = (input ?? '').trim().toLowerCase();
    if (!value) {
        throw new Error('Cannot derive team UUID without an abbreviation');
    }
    const hash = (0, crypto_1.createHash)('sha1').update(`team:${value}`).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
const canonicalTeamUuid = (value, abbr) => {
    const rawValue = (value ?? '').trim();
    if (rawValue && isUuidLike(rawValue)) {
        return rawValue;
    }
    const normalizedAbbr = (abbr ?? rawValue).trim();
    if (!normalizedAbbr) {
        throw new Error('Cannot derive canonical team uuid without identifier');
    }
    return teamUuidFromAbbr(normalizedAbbr);
};
function norm(s) {
    return String(s ?? '').trim().toLowerCase();
}
function slugName(s) {
    return norm(s).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
function resolveTeamSelection(input, game) {
    const raw = (input ?? '').trim();
    if (!raw) {
        throw new Error('Missing team value');
    }
    const homeUuid = isUuidLike(game.home_team_id)
        ? game.home_team_id
        : teamUuidFromAbbr(game.home_team_abbr ?? game.home_team_id);
    const awayUuid = isUuidLike(game.away_team_id)
        ? game.away_team_id
        : teamUuidFromAbbr(game.away_team_abbr ?? game.away_team_id);
    if (raw === 'home') {
        return {
            uuid: homeUuid,
            abbr: game.home_team_abbr ?? null,
            name: game.home_team_name ?? null,
            side: 'home',
        };
    }
    if (raw === 'away') {
        return {
            uuid: awayUuid,
            abbr: game.away_team_abbr ?? null,
            name: game.away_team_name ?? null,
            side: 'away',
        };
    }
    if (isUuidLike(raw)) {
        const lowered = raw.toLowerCase();
        if (lowered === homeUuid.toLowerCase()) {
            return {
                uuid: homeUuid,
                abbr: game.home_team_abbr ?? null,
                name: game.home_team_name ?? null,
                side: 'home',
            };
        }
        if (lowered === awayUuid.toLowerCase()) {
            return {
                uuid: awayUuid,
                abbr: game.away_team_abbr ?? null,
                name: game.away_team_name ?? null,
                side: 'away',
            };
        }
        throw new Error(`Team UUID does not belong to this game: "${raw}"`);
    }
    if (looksLikeAbbr(raw)) {
        const upper = raw.toUpperCase();
        const homeAbbr = (game.home_team_abbr ?? '').toUpperCase();
        const awayAbbr = (game.away_team_abbr ?? '').toUpperCase();
        if (upper === homeAbbr) {
            return {
                uuid: homeUuid,
                abbr: game.home_team_abbr ?? null,
                name: game.home_team_name ?? null,
                side: 'home',
            };
        }
        if (upper === awayAbbr) {
            return {
                uuid: awayUuid,
                abbr: game.away_team_abbr ?? null,
                name: game.away_team_name ?? null,
                side: 'away',
            };
        }
        throw new Error(`Unknown team abbreviation for this game: "${raw}"`);
    }
    const slugInput = slugName(raw);
    if (slugInput) {
        const homeSlug = slugName(game.home_team_name);
        const awaySlug = slugName(game.away_team_name);
        if (slugInput === homeSlug) {
            return {
                uuid: homeUuid,
                abbr: game.home_team_abbr ?? null,
                name: game.home_team_name ?? null,
                side: 'home',
            };
        }
        if (slugInput === awaySlug) {
            return {
                uuid: awayUuid,
                abbr: game.away_team_abbr ?? null,
                name: game.away_team_name ?? null,
                side: 'away',
            };
        }
    }
    throw new Error(`Cannot resolve team from input "${raw}"`);
}
const collectRequestedGameUuids = (payload) => {
    const ids = new Set();
    payload.gameUuids?.forEach((uuid) => {
        if (uuid) {
            ids.add(String(uuid));
        }
    });
    payload.teams.forEach((pick) => {
        if (pick?.gameId) {
            ids.add(String(pick.gameId));
        }
    });
    payload.players.forEach((pick) => {
        if (pick?.gameId) {
            ids.add(String(pick.gameId));
        }
    });
    return Array.from(ids).filter(Boolean);
};
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizePayloadGameIds = async (payload, supabase) => {
    const normalized = payload;
    const resolvedUuidSet = new Set();
    const providerIds = new Set();
    const rawGameUuidValues = Array.isArray(normalized.gameUuids)
        ? normalized.gameUuids
        : [];
    const cleanedGameUuids = rawGameUuidValues
        .filter((value) => value !== null && value !== undefined)
        .map((value) => String(value));
    cleanedGameUuids.forEach((value) => {
        if (UUID_REGEX.test(value)) {
            resolvedUuidSet.add(value);
        }
        else {
            providerIds.add(value);
        }
    });
    normalized.gameUuids = cleanedGameUuids;
    const rawProviderGameIds = Array.isArray(normalized.providerGameIds)
        ? normalized.providerGameIds
        : [];
    const cleanedProviderGameIds = rawProviderGameIds
        .filter((value) => value !== null && value !== undefined)
        .map((value) => String(value));
    cleanedProviderGameIds.forEach((value) => providerIds.add(value));
    normalized.providerGameIds =
        cleanedProviderGameIds.length > 0 ? cleanedProviderGameIds : undefined;
    const pendingTeamUpdates = [];
    const pendingPlayerUpdates = [];
    const processPickArray = (entries, pending) => {
        if (!Array.isArray(entries)) {
            return;
        }
        entries.forEach((entry) => {
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const pick = entry;
            const rawGameId = pick.gameId ?? pick.game_id;
            if (rawGameId === null || rawGameId === undefined) {
                return;
            }
            const stringValue = String(rawGameId);
            if (UUID_REGEX.test(stringValue)) {
                pick.gameId = stringValue;
                if ('game_id' in pick) {
                    delete pick.game_id;
                }
                resolvedUuidSet.add(stringValue);
            }
            else {
                providerIds.add(stringValue);
                pending.push({ pick, providerId: stringValue });
            }
        });
    };
    processPickArray(normalized.teams, pendingTeamUpdates);
    processPickArray(normalized.players, pendingPlayerUpdates);
    const providerIdList = Array.from(providerIds);
    const providerToUuid = new Map();
    if (providerIdList.length > 0) {
        const { data, error } = await supabase
            .from('games')
            .select('id, provider_game_id')
            .in('provider_game_id', providerIdList);
        if (error) {
            throw error;
        }
        (data ?? []).forEach((row) => {
            if (row?.provider_game_id && row?.id) {
                providerToUuid.set(String(row.provider_game_id), String(row.id));
            }
        });
        pendingTeamUpdates.forEach(({ pick, providerId }) => {
            const uuid = providerToUuid.get(providerId);
            if (uuid) {
                pick.gameId = uuid;
                if ('game_id' in pick) {
                    delete pick.game_id;
                }
                resolvedUuidSet.add(uuid);
            }
        });
        pendingPlayerUpdates.forEach(({ pick, providerId }) => {
            const uuid = providerToUuid.get(providerId);
            if (uuid) {
                pick.gameId = uuid;
                if ('game_id' in pick) {
                    delete pick.game_id;
                }
                resolvedUuidSet.add(uuid);
            }
        });
        providerIdList.forEach((providerId) => {
            const uuid = providerToUuid.get(providerId);
            if (uuid) {
                resolvedUuidSet.add(uuid);
            }
        });
        const missingProviderIds = providerIdList.filter((id) => !providerToUuid.has(id));
        if (missingProviderIds.length > 0) {
            return { missingProviderIds };
        }
    }
    normalized.gameUuids = Array.from(resolvedUuidSet);
    return { missingProviderIds: [] };
};
const loadGameContexts = async (supabase, gameUuids) => {
    const map = new Map();
    if (gameUuids.length === 0) {
        return { map, missing: [] };
    }
    const { data, error } = await supabase
        .from('games')
        .select(`
        id,
        home_team_id,
        away_team_id,
        home_team_abbr,
        away_team_abbr,
        home_team_name,
        away_team_name
      `)
        .in('id', gameUuids);
    if (error) {
        throw error;
    }
    const entries = data ?? [];
    const foundIds = new Set(entries.map((row) => row.id));
    const missing = gameUuids.filter((id) => !foundIds.has(id));
    const contexts = await Promise.all(entries.map(async (row) => {
        const canonicalHomeUuid = canonicalTeamUuid(row.home_team_id, row.home_team_abbr);
        const canonicalAwayUuid = canonicalTeamUuid(row.away_team_id, row.away_team_abbr);
        const homeRosterKey = await (0, rosters_1.resolveTeamKey)(row.home_team_abbr ?? row.home_team_name ?? null);
        const awayRosterKey = await (0, rosters_1.resolveTeamKey)(row.away_team_abbr ?? row.away_team_name ?? null);
        return {
            ...row,
            home_team_id: canonicalHomeUuid,
            away_team_id: canonicalAwayUuid,
            homeRosterKey,
            awayRosterKey,
        };
    }));
    contexts.forEach((context) => {
        map.set(context.id, context);
    });
    return { map, missing };
};
const matchPlayerInRoster = (playerId, roster) => {
    if (!roster) {
        return null;
    }
    return roster.find((player) => player.id === playerId) ?? null;
};
const findPlayerInGame = (playerId, game, rosters) => {
    const homeRoster = game.homeRosterKey
        ? rosters[game.homeRosterKey] ?? []
        : [];
    const awayRoster = game.awayRosterKey
        ? rosters[game.awayRosterKey] ?? []
        : [];
    const homeMatch = matchPlayerInRoster(playerId, homeRoster);
    if (homeMatch) {
        return { side: 'home', rosterPlayer: homeMatch };
    }
    const awayMatch = matchPlayerInRoster(playerId, awayRoster);
    if (awayMatch) {
        return { side: 'away', rosterPlayer: awayMatch };
    }
    return null;
};
const findPlayerContext = (playerId, games, rosters) => {
    for (const game of games) {
        const match = findPlayerInGame(playerId, game, rosters);
        if (match) {
            return { game, ...match };
        }
    }
    return null;
};
// Utility per spezzare un full name in first/last
function splitName(full) {
    const clean = (full || '').trim();
    if (!clean)
        return { first: 'N.', last: 'N.' };
    const parts = clean.split(/\s+/);
    return {
        first: parts[0],
        last: parts.slice(1).join(' ') || parts[0],
    };
}
const buildPlayerKey = (provider, providerPlayerId) => `${provider}:${providerPlayerId}`;
const resolveSlateDate = (request) => {
    const fallback = (0, date_us_eastern_1.toEasternYYYYMMDD)((0, date_us_eastern_1.yesterdayInEastern)());
    const input = request.nextUrl.searchParams.get('date') ?? fallback;
    const parsed = types_winners_1.SlateDateSchema.safeParse(input);
    if (!parsed.success) {
        throw new zod_1.ZodError(parsed.error.issues);
    }
    return parsed.data;
};
const toDateNy = (iso, fallback) => {
    if (!iso) {
        return fallback;
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return fallback;
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: constants_1.TIMEZONES.US_EASTERN,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(date);
};
const buildDtoFromMeta = (meta, pickDate) => ({
    provider: 'bdl',
    providerGameId: meta.providerGameId,
    season: meta.season,
    status: meta.status ?? 'scheduled',
    dateNY: toDateNy(meta.gameDateISO ?? null, pickDate),
    startTimeUTC: meta.gameDateISO ?? null,
    home: {
        abbr: meta.home?.abbr,
        name: meta.home?.name ?? meta.home?.abbr,
    },
    away: {
        abbr: meta.away?.abbr,
        name: meta.away?.name ?? meta.away?.abbr,
    },
});
const getUserOrThrow = async (supabaseAdmin) => {
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, error, } = await supabase.auth.getUser();
    if (error) {
        throw error;
    }
    if (!user) {
        throw new Error('Unauthorized');
    }
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    if (profileError) {
        throw profileError;
    }
    return { authUser: user, role: profile?.role ?? 'user' };
};
const fetchPicks = async (supabaseAdmin, userId, pickDate) => {
    const { teamPicks, playerPicks, highlightPicks, changesCount } = await (0, winners_service_1.getUserPicksByDate)(supabaseAdmin, userId, pickDate);
    return {
        teams: teamPicks.map((pick) => ({
            game_id: pick.game_id,
            selected_team_id: pick.selected_team_id,
            selected_team_abbr: pick.selected_team_abbr ?? null,
            selected_team_name: pick.selected_team_name ?? null,
            game: pick.game ?? null,
        })),
        players: playerPicks.map((pick) => ({
            game_id: pick.game_id,
            category: pick.category,
            player_id: pick.player_id,
            player: {
                first_name: pick.first_name ?? null,
                last_name: pick.last_name ?? null,
                position: pick.position ?? null,
                team_id: pick.team_id ?? null,
            },
            game: pick.game ?? null,
        })),
        highlights: highlightPicks.map((pick) => ({
            player_id: pick.player_id,
            rank: pick.rank,
        })),
        changesCount,
    };
};
async function GET(request) {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    try {
        const { authUser: user, role } = await getUserOrThrow(supabaseAdmin);
        const pickDate = resolveSlateDate(request);
        const requestedUserId = request.nextUrl.searchParams.get('userId');
        const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;
        const base = await (0, winners_service_1.getUserPicksByDate)(supabaseAdmin, userId, pickDate);
        const normalized = types_winners_1.UserPicksResponseSchema.parse({
            date: pickDate,
            teamPicks: base.teamPicks,
            playerPicks: base.playerPicks,
            highlightPicks: base.highlightPicks,
            changesCount: base.changesCount,
        });
        const legacyTeams = normalized.teamPicks.map((pick) => ({
            game_id: pick.game_id,
            selected_team_id: pick.selected_team_id,
            selected_team_abbr: pick.selected_team_abbr ?? null,
            selected_team_name: pick.selected_team_name ?? null,
            game: pick.game ?? null,
        }));
        const legacyPlayers = normalized.playerPicks.map((pick) => ({
            game_id: pick.game_id,
            category: pick.category,
            player_id: pick.player_id,
            player: {
                first_name: pick.first_name ?? null,
                last_name: pick.last_name ?? null,
                position: pick.position ?? null,
                team_id: pick.team_id ?? null,
                provider_player_id: pick.provider_player_id ?? null,
            },
            game: pick.game ?? null,
        }));
        const legacyHighlights = (normalized.highlightPicks ?? []).map((pick) => ({
            player_id: pick.player_id,
            rank: pick.rank,
        }));
        return server_1.NextResponse.json({
            ...normalized,
            pickDate: normalized.date,
            userId,
            teams: legacyTeams,
            players: legacyPlayers,
            highlights: legacyHighlights,
            changesCount: normalized.changesCount ?? 0,
        });
    }
    catch (error) {
        if (error.message === 'Unauthorized') {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (error instanceof zod_1.ZodError) {
            return server_1.NextResponse.json({ error: 'Invalid date parameter. Expected format YYYY-MM-DD.' }, { status: 400 });
        }
        console.error('[api/picks][GET]', error);
        return server_1.NextResponse.json({ error: 'Failed to load picks' }, { status: 500 });
    }
}
async function POST(request) {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    try {
        const { authUser: user, role } = await getUserOrThrow(supabaseAdmin);
        const rawBody = await request.json();
        const rawPayload = (rawBody ?? {});
        const payload = (0, picks_1.validatePicksPayload)(rawPayload);
        payload.teams = payload.teams.map((pick) => ({ ...pick }));
        payload.players = payload.players.map((pick) => ({ ...pick }));
        payload.highlights = payload.highlights.map((pick) => ({ ...pick }));
        const gamesMetaByProvider = new Map();
        payload.gamesMeta?.forEach((meta) => {
            if (meta?.providerGameId) {
                gamesMetaByProvider.set(meta.providerGameId, meta);
            }
        });
        const gameRefsByProvider = new Map();
        payload.gameRefs?.forEach((ref) => {
            if (ref?.providerGameId) {
                gameRefsByProvider.set(ref.providerGameId, { dto: ref.dto });
            }
        });
        const resolvedGameIds = new Set(Array.isArray(payload.gameUuids) ? payload.gameUuids : []);
        const providerToResolvedId = new Map();
        const refToResolvedId = new Map();
        resolvedGameIds.forEach((uuid) => {
            refToResolvedId.set(uuid, uuid);
        });
        if (Array.isArray(payload.gameRefs) && payload.gameRefs.length > 0) {
            for (const ref of payload.gameRefs) {
                try {
                    const dto = ref.dto ??
                        (() => {
                            const meta = gamesMetaByProvider.get(ref.providerGameId);
                            return meta ? buildDtoFromMeta(meta, payload.pickDate) : undefined;
                        })();
                    const result = await (0, resolveGame_1.resolveOrUpsertGame)({
                        supabaseAdmin,
                        gameProvider: ref.provider ?? 'bdl',
                        providerGameId: ref.providerGameId,
                        dto,
                    });
                    resolvedGameIds.add(result.id);
                    providerToResolvedId.set(ref.providerGameId, result.id);
                    refToResolvedId.set(ref.providerGameId, result.id);
                }
                catch (error) {
                    console.error('[api/picks][POST] resolve gameRef failed', {
                        providerGameId: ref.providerGameId,
                        error,
                    });
                }
            }
        }
        if (resolvedGameIds.size === 0) {
            return server_1.NextResponse.json({ error: 'GAME_NOT_FOUND' }, { status: 404 });
        }
        const resolveGameForPick = async (gameReference) => {
            const rawGameId = gameReference.gameId;
            const isUuidGameId = rawGameId && isUuidLike(rawGameId);
            const providerGameId = gameReference.providerGameId ?? (!isUuidGameId && rawGameId ? rawGameId : undefined);
            const ref = providerGameId ? gameRefsByProvider.get(providerGameId) : undefined;
            const dto = gameReference.dto ??
                ref?.dto ??
                (providerGameId
                    ? (() => {
                        const meta = gamesMetaByProvider.get(providerGameId);
                        return meta ? buildDtoFromMeta(meta, payload.pickDate) : undefined;
                    })()
                    : undefined);
            const result = await (0, resolveGame_1.resolveOrUpsertGame)({
                supabaseAdmin,
                gameId: isUuidGameId ? rawGameId : undefined,
                gameProvider: gameReference.gameProvider ?? dto?.provider,
                providerGameId,
                dto,
            });
            if (rawGameId) {
                refToResolvedId.set(rawGameId, result.id);
            }
            if (providerGameId) {
                providerToResolvedId.set(providerGameId, result.id);
                refToResolvedId.set(providerGameId, result.id);
            }
            resolvedGameIds.add(result.id);
            return result.id;
        };
        for (const pick of payload.teams) {
            try {
                const resolvedId = await resolveGameForPick(pick);
                pick.gameId = resolvedId;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'GAME_NOT_FOUND';
                if (message === 'GAME_NOT_FOUND' || message === 'TEAM_NOT_FOUND') {
                    return server_1.NextResponse.json({ error: message }, { status: 404 });
                }
                console.error('[api/picks][POST] resolve game for team failed', error);
                return server_1.NextResponse.json({ error: 'GAME_RESOLUTION_FAILED' }, { status: 500 });
            }
        }
        for (const pick of payload.players) {
            if (isUuidLike(pick.gameId)) {
                resolvedGameIds.add(pick.gameId);
                continue;
            }
            const knownResolved = refToResolvedId.get(pick.gameId) ?? providerToResolvedId.get(pick.gameId);
            if (knownResolved) {
                pick.gameId = knownResolved;
                resolvedGameIds.add(knownResolved);
                continue;
            }
            try {
                const resolvedId = await resolveGameForPick({
                    gameId: pick.gameId,
                    gameProvider: 'bdl',
                    providerGameId: pick.gameId,
                });
                pick.gameId = resolvedId;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'GAME_NOT_FOUND';
                if (message === 'GAME_NOT_FOUND' || message === 'TEAM_NOT_FOUND') {
                    return server_1.NextResponse.json({ error: message }, { status: 404 });
                }
                console.error('[api/picks][POST] resolve game for player failed', error);
                return server_1.NextResponse.json({ error: 'GAME_RESOLUTION_FAILED' }, { status: 500 });
            }
        }
        payload.gameUuids = Array.from(resolvedGameIds);
        const requestedUserId = request.nextUrl.searchParams.get('userId');
        const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;
        if (role !== 'admin') {
            await (0, picks_1.assertLockWindowOpen)(supabaseAdmin, payload.pickDate);
        }
        const requestedGameUuids = collectRequestedGameUuids(payload);
        const { map: gamesMap, missing: missingGameUuids } = await loadGameContexts(supabaseAdmin, requestedGameUuids);
        if (missingGameUuids.length > 0) {
            return server_1.NextResponse.json({
                error: 'Unknown game uuid(s)',
                missingGameUuids,
            }, { status: 400 });
        }
        const currentChanges = await (0, picks_1.getDailyChangeCount)(supabaseAdmin, userId, payload.pickDate);
        if (currentChanges > 0 && role !== 'admin') {
            return server_1.NextResponse.json({ error: 'Picks already exist for this day. Use PUT to update once.' }, { status: 409 });
        }
        const gameList = Array.from(gamesMap.values());
        const rosters = await (0, rosters_1.getRosters)();
        const now = new Date().toISOString();
        await supabaseAdmin.from('picks_teams').delete().match({
            user_id: userId,
            pick_date: payload.pickDate,
        });
        await supabaseAdmin.from('picks_players').delete().match({
            user_id: userId,
            pick_date: payload.pickDate,
        });
        await supabaseAdmin.from('picks_highlights').delete().match({
            user_id: userId,
            pick_date: payload.pickDate,
        });
        const teamRecords = payload.teams.map((pick) => {
            const game = gamesMap.get(pick.gameId);
            if (!game) {
                throw new Error(`Unknown game(s): ${pick.gameId}`);
            }
            if (looksLikeAbbr(pick.teamId)) {
                console.warn('[teams] abbreviation received from client, resolving server-side', {
                    pick,
                    gameId: pick.gameId,
                });
            }
            const sel = resolveTeamSelection(pick.teamId, game);
            console.debug('[teams] resolve', {
                input: pick.teamId,
                gameId: pick.gameId,
                resolved: sel,
            });
            if (!isUuidLike(sel.uuid)) {
                throw new Error(`Resolved selected_team_id is not a uuid-like value: "${sel.uuid}" from "${pick.teamId}"`);
            }
            return {
                user_id: userId,
                game_id: game.id,
                selected_team_id: sel.uuid,
                selected_team_abbr: sel.abbr ?? null,
                selected_team_name: sel.name ?? null,
                pick_date: payload.pickDate,
                changes_count: 0,
                created_at: now,
                updated_at: now,
            };
        });
        for (const record of teamRecords) {
            if (!isUuidLike(record.selected_team_id)) {
                throw new Error(`Non-UUID selected_team_id about to be inserted: ${record.selected_team_id}`);
            }
        }
        const playerPayloadMap = new Map();
        const registerPlayerPayload = (key, payload) => {
            if (!playerPayloadMap.has(key)) {
                playerPayloadMap.set(key, payload);
            }
        };
        const playerPickContexts = payload.players.map((pick) => {
            const game = gamesMap.get(pick.gameId);
            if (!game) {
                throw new Error(`Unknown game(s): ${pick.gameId}`);
            }
            const match = findPlayerInGame(pick.playerId, game, rosters);
            if (!match) {
                throw new Error(`Cannot resolve player "${pick.playerId}" for game ${pick.gameId}`);
            }
            const { first, last } = splitName(pick.playerId);
            const teamId = match.side === 'home' ? game.home_team_id : game.away_team_id;
            const key = buildPlayerKey(PLAYER_PROVIDER, pick.playerId);
            registerPlayerPayload(key, {
                provider: PLAYER_PROVIDER,
                provider_player_id: pick.playerId,
                team_id: teamId,
                first_name: first,
                last_name: last,
                position: match.rosterPlayer?.pos ?? null,
            });
            return { pick, game, playerKey: key };
        });
        const playerReferenceGames = payload.players
            .map((pick) => gamesMap.get(pick.gameId))
            .filter((value) => Boolean(value));
        const highlightContexts = payload.highlights.map((pick, index) => {
            const directMatch = findPlayerContext(pick.playerId, gameList, rosters);
            const fallbackMatch = directMatch ??
                (playerReferenceGames.length > 0
                    ? (() => {
                        const fallbackGame = playerReferenceGames[0];
                        const match = findPlayerInGame(pick.playerId, fallbackGame, rosters);
                        return match ? { game: fallbackGame, ...match } : null;
                    })()
                    : null);
            if (!fallbackMatch) {
                throw new Error(`Cannot resolve player "${pick.playerId}" for highlights`);
            }
            const { game, side, rosterPlayer } = fallbackMatch;
            const { first, last } = splitName(pick.playerId);
            const teamId = side === 'home' ? game.home_team_id : game.away_team_id;
            const key = buildPlayerKey(PLAYER_PROVIDER, pick.playerId);
            registerPlayerPayload(key, {
                provider: PLAYER_PROVIDER,
                provider_player_id: pick.playerId,
                team_id: teamId,
                first_name: first,
                last_name: last,
                position: rosterPlayer?.pos ?? null,
            });
            return { pick, rank: index + 1, playerKey: key };
        });
        const upsertInputs = Array.from(playerPayloadMap.values());
        const { data: upsertedPlayers, error: playerUpsertError, } = upsertInputs.length
            ? await (0, upsertPlayers_1.upsertPlayers)(supabaseAdmin, upsertInputs)
            : { data: [], error: null };
        if (playerUpsertError) {
            throw playerUpsertError;
        }
        const playerUuidByKey = new Map();
        (upsertedPlayers ?? []).forEach((row) => {
            const key = buildPlayerKey(row.provider, row.provider_player_id);
            playerUuidByKey.set(key, row.id);
        });
        const resolvePlayerUuid = (key, label) => {
            const uuid = playerUuidByKey.get(key);
            if (!uuid) {
                throw new Error(`Unable to resolve player id for "${label}"`);
            }
            return uuid;
        };
        const playerInsert = playerPickContexts.map(({ pick, game, playerKey }) => ({
            user_id: userId,
            game_id: game.id,
            category: pick.category,
            player_id: resolvePlayerUuid(playerKey, pick.playerId),
            pick_date: payload.pickDate,
            changes_count: 0,
            created_at: now,
            updated_at: now,
        }));
        const highlightInsert = highlightContexts.map(({ pick, rank, playerKey }) => ({
            user_id: userId,
            player_id: resolvePlayerUuid(playerKey, pick.playerId),
            rank,
            pick_date: payload.pickDate,
            changes_count: 0,
            created_at: now,
            updated_at: now,
        }));
        const [teamsResult, playersResult, highlightsResult] = await Promise.all([
            teamRecords.length
                ? supabaseAdmin.from('picks_teams').insert(teamRecords)
                : { error: null },
            playerInsert.length
                ? supabaseAdmin.from('picks_players').insert(playerInsert)
                : { error: null },
            highlightInsert.length
                ? supabaseAdmin.from('picks_highlights').insert(highlightInsert)
                : { error: null },
        ]);
        if (teamsResult.error || playersResult.error || highlightsResult.error) {
            throw (teamsResult.error ??
                playersResult.error ??
                highlightsResult.error ??
                new Error('Failed to save picks'));
        }
        return server_1.NextResponse.json(await fetchPicks(supabaseAdmin, userId, payload.pickDate), { status: 201 });
    }
    catch (error) {
        if (error.message === 'Unauthorized') {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('[api/picks][POST]', error);
        return server_1.NextResponse.json({ error: error.message ?? 'Failed to save picks' }, { status: 400 });
    }
}
async function PUT(request) {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    try {
        const { authUser: user, role } = await getUserOrThrow(supabaseAdmin);
        const rawBody = await request.json();
        const rawPayload = (rawBody ?? {});
        const { missingProviderIds } = await normalizePayloadGameIds(rawPayload, supabaseAdmin);
        if (missingProviderIds.length > 0) {
            return server_1.NextResponse.json({
                error: 'Unknown provider game id(s)',
                missingProviderIds,
            }, { status: 400 });
        }
        const payload = (0, picks_1.validatePicksPayload)(rawPayload);
        const requestedUserId = request.nextUrl.searchParams.get('userId');
        const userId = role === 'admin' && requestedUserId ? requestedUserId : user.id;
        if (role !== 'admin') {
            await (0, picks_1.assertLockWindowOpen)(supabaseAdmin, payload.pickDate);
        }
        const requestedGameUuids = collectRequestedGameUuids(payload);
        const { map: gamesMap, missing: missingGameUuids } = await loadGameContexts(supabaseAdmin, requestedGameUuids);
        if (missingGameUuids.length > 0) {
            return server_1.NextResponse.json({
                error: 'Unknown game uuid(s)',
                missingGameUuids,
            }, { status: 400 });
        }
        const currentChanges = await (0, picks_1.getDailyChangeCount)(supabaseAdmin, userId, payload.pickDate);
        const nextChangeCount = currentChanges + 1;
        const now = new Date().toISOString();
        const gameList = Array.from(gamesMap.values());
        const rosters = await (0, rosters_1.getRosters)();
        await supabaseAdmin.from('picks_teams').delete().match({
            user_id: userId,
            pick_date: payload.pickDate,
        });
        await supabaseAdmin.from('picks_players').delete().match({
            user_id: userId,
            pick_date: payload.pickDate,
        });
        await supabaseAdmin.from('picks_highlights').delete().match({
            user_id: userId,
            pick_date: payload.pickDate,
        });
        const teamRecords = payload.teams.map((pick) => {
            const game = gamesMap.get(pick.gameId);
            if (!game) {
                throw new Error(`Unknown game(s): ${pick.gameId}`);
            }
            if (looksLikeAbbr(pick.teamId)) {
                console.warn('[teams] abbreviation received from client, resolving server-side', {
                    pick,
                    gameId: pick.gameId,
                });
            }
            const sel = resolveTeamSelection(pick.teamId, game);
            console.debug('[teams] resolve', {
                input: pick.teamId,
                gameId: pick.gameId,
                resolved: sel,
            });
            if (!isUuidLike(sel.uuid)) {
                throw new Error(`Resolved selected_team_id is not a uuid-like value: "${sel.uuid}" from "${pick.teamId}"`);
            }
            return {
                user_id: userId,
                game_id: game.id,
                selected_team_id: sel.uuid,
                selected_team_abbr: sel.abbr ?? null,
                selected_team_name: sel.name ?? null,
                pick_date: payload.pickDate,
                changes_count: nextChangeCount,
                created_at: now,
                updated_at: now,
            };
        });
        for (const record of teamRecords) {
            if (!isUuidLike(record.selected_team_id)) {
                throw new Error(`Non-UUID selected_team_id about to be inserted: ${record.selected_team_id}`);
            }
        }
        const playerPayloadMap = new Map();
        const registerPlayerPayload = (key, payload) => {
            if (!playerPayloadMap.has(key)) {
                playerPayloadMap.set(key, payload);
            }
        };
        const playerPickContexts = payload.players.map((pick) => {
            const game = gamesMap.get(pick.gameId);
            if (!game) {
                throw new Error(`Unknown game(s): ${pick.gameId}`);
            }
            const match = findPlayerInGame(pick.playerId, game, rosters);
            if (!match) {
                throw new Error(`Cannot resolve player "${pick.playerId}" for game ${pick.gameId}`);
            }
            const { first, last } = splitName(pick.playerId);
            const teamId = match.side === 'home' ? game.home_team_id : game.away_team_id;
            const key = buildPlayerKey(PLAYER_PROVIDER, pick.playerId);
            registerPlayerPayload(key, {
                provider: PLAYER_PROVIDER,
                provider_player_id: pick.playerId,
                team_id: teamId,
                first_name: first,
                last_name: last,
                position: match.rosterPlayer?.pos ?? null,
            });
            return { pick, game, playerKey: key };
        });
        const playerReferenceGames = payload.players
            .map((pick) => gamesMap.get(pick.gameId))
            .filter((value) => Boolean(value));
        const highlightContexts = payload.highlights.map((pick, index) => {
            const directMatch = findPlayerContext(pick.playerId, gameList, rosters);
            const fallbackMatch = directMatch ??
                (playerReferenceGames.length > 0
                    ? (() => {
                        const fallbackGame = playerReferenceGames[0];
                        const match = findPlayerInGame(pick.playerId, fallbackGame, rosters);
                        return match ? { game: fallbackGame, ...match } : null;
                    })()
                    : null);
            if (!fallbackMatch) {
                throw new Error(`Cannot resolve player "${pick.playerId}" for highlights`);
            }
            const { game, side, rosterPlayer } = fallbackMatch;
            const { first, last } = splitName(pick.playerId);
            const teamId = side === 'home' ? game.home_team_id : game.away_team_id;
            const key = buildPlayerKey(PLAYER_PROVIDER, pick.playerId);
            registerPlayerPayload(key, {
                provider: PLAYER_PROVIDER,
                provider_player_id: pick.playerId,
                team_id: teamId,
                first_name: first,
                last_name: last,
                position: rosterPlayer?.pos ?? null,
            });
            return { pick, rank: index + 1, playerKey: key };
        });
        const upsertInputs = Array.from(playerPayloadMap.values());
        const { data: upsertedPlayers, error: playerUpsertError, } = upsertInputs.length
            ? await (0, upsertPlayers_1.upsertPlayers)(supabaseAdmin, upsertInputs)
            : { data: [], error: null };
        if (playerUpsertError) {
            throw playerUpsertError;
        }
        const playerUuidByKey = new Map();
        (upsertedPlayers ?? []).forEach((row) => {
            const key = buildPlayerKey(row.provider, row.provider_player_id);
            playerUuidByKey.set(key, row.id);
        });
        const resolvePlayerUuid = (key, label) => {
            const uuid = playerUuidByKey.get(key);
            if (!uuid) {
                throw new Error(`Unable to resolve player id for "${label}"`);
            }
            return uuid;
        };
        const playerUpsert = playerPickContexts.map(({ pick, game, playerKey }) => ({
            user_id: userId,
            game_id: game.id,
            category: pick.category,
            player_id: resolvePlayerUuid(playerKey, pick.playerId),
            pick_date: payload.pickDate,
            changes_count: nextChangeCount,
            created_at: now,
            updated_at: now,
        }));
        const highlightUpsert = highlightContexts.map(({ pick, rank, playerKey }) => ({
            user_id: userId,
            player_id: resolvePlayerUuid(playerKey, pick.playerId),
            rank,
            pick_date: payload.pickDate,
            changes_count: nextChangeCount,
            created_at: now,
            updated_at: now,
        }));
        const [teamsResult, playersResult, highlightsResult] = await Promise.all([
            teamRecords.length
                ? supabaseAdmin.from('picks_teams').insert(teamRecords)
                : { error: null },
            playerUpsert.length
                ? supabaseAdmin.from('picks_players').insert(playerUpsert)
                : { error: null },
            highlightUpsert.length
                ? supabaseAdmin.from('picks_highlights').insert(highlightUpsert)
                : { error: null },
        ]);
        if (teamsResult.error || playersResult.error || highlightsResult.error) {
            throw (teamsResult.error ??
                playersResult.error ??
                highlightsResult.error ??
                new Error('Failed to update picks'));
        }
        const response = await fetchPicks(supabaseAdmin, userId, payload.pickDate);
        return server_1.NextResponse.json(response);
    }
    catch (error) {
        if (error.message === 'Unauthorized') {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('[api/picks][PUT]', error);
        return server_1.NextResponse.json({ error: error.message ?? 'Failed to update picks' }, { status: 400 });
    }
}
