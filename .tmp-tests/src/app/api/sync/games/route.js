"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const date_fns_tz_1 = require("date-fns-tz");
const supabase_1 = require("../../../../lib/supabase");
const constants_1 = require("../../../../lib/constants");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PROVIDER = 'bdl';
const DEFAULT_BDL_BASE_URL = 'https://api.balldontlie.io/api/v1';
const PAGE_SIZE = 100;
const isValidDateParam = (value) => {
    if (!DATE_REGEX.test(value)) {
        return false;
    }
    const candidate = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(candidate.getTime()) && candidate.toISOString().startsWith(value);
};
const getGameDateIso = (game, fallbackDate) => {
    const primaryCandidates = [game?.start_time, game?.date];
    for (const candidate of primaryCandidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            const parsed = new Date(candidate);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString();
            }
        }
    }
    const zoned = (0, date_fns_tz_1.fromZonedTime)(`${fallbackDate}T00:00:00`, constants_1.TIMEZONES.US_EASTERN);
    return zoned.toISOString();
};
const buildBallDontLieUrl = (page, date) => {
    const base = process.env.BALLDONTLIE_API_URL ?? DEFAULT_BDL_BASE_URL;
    const url = new URL('/games', base);
    url.searchParams.set('per_page', String(PAGE_SIZE));
    url.searchParams.set('dates[]', date);
    url.searchParams.set('page', String(page));
    return url.toString();
};
const fetchGames = async (date) => {
    const apiKey = process.env.BALLDONTLIE_API_KEY;
    const results = [];
    let page = 1;
    while (true) {
        const url = buildBallDontLieUrl(page, date);
        const headers = { accept: 'application/json' };
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }
        const response = await fetch(url, { headers, cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch games from balldontlie (status ${response.status})`);
        }
        const payload = await response.json();
        const data = Array.isArray(payload?.data) ? payload.data : [];
        results.push(...data);
        const nextPage = payload?.meta?.next_page;
        if (nextPage && Number(nextPage) > page) {
            page = Number(nextPage);
            continue;
        }
        break;
    }
    return results;
};
const normalizeTeamAbbr = (abbr) => typeof abbr === 'string' ? abbr.trim().toUpperCase() : '';
const collectTeamsLookup = async (games) => {
    const providerIds = new Set();
    const abbrs = new Set();
    const registerTeam = (team) => {
        if (!team) {
            return;
        }
        const providerId = team.id;
        if (providerId !== null && providerId !== undefined && `${providerId}`.trim().length > 0) {
            providerIds.add(String(providerId));
        }
        const abbr = normalizeTeamAbbr(team.abbreviation);
        if (abbr) {
            abbrs.add(abbr);
        }
    };
    games.forEach((game) => {
        registerTeam(game.home_team);
        registerTeam(game.visitor_team);
    });
    const byProviderId = new Map();
    const byAbbr = new Map();
    if (providerIds.size > 0) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('teams')
            .select('id, provider_team_id, abbr')
            .eq('provider', PROVIDER)
            .in('provider_team_id', Array.from(providerIds));
        if (error) {
            throw error;
        }
        (data ?? []).forEach((team) => {
            if (team.provider_team_id) {
                byProviderId.set(team.provider_team_id, team.id);
            }
            if (team.abbr) {
                byAbbr.set(normalizeTeamAbbr(team.abbr), team.id);
            }
        });
    }
    const missingAbbrs = Array.from(abbrs).filter((abbr) => !byAbbr.has(abbr));
    if (missingAbbrs.length > 0) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('teams')
            .select('id, provider_team_id, abbr')
            .eq('provider', PROVIDER)
            .in('abbr', missingAbbrs);
        if (error) {
            throw error;
        }
        (data ?? []).forEach((team) => {
            if (team.provider_team_id) {
                byProviderId.set(team.provider_team_id, team.id);
            }
            if (team.abbr) {
                byAbbr.set(normalizeTeamAbbr(team.abbr), team.id);
            }
        });
    }
    const resolveTeamId = (team, context) => {
        if (!team) {
            throw new Error(`Missing team data for ${context}`);
        }
        const providerId = team.id;
        if (providerId !== null && providerId !== undefined) {
            const key = String(providerId);
            const found = byProviderId.get(key);
            if (found) {
                return found;
            }
        }
        const abbr = normalizeTeamAbbr(team.abbreviation);
        if (abbr) {
            const found = byAbbr.get(abbr);
            if (found) {
                return found;
            }
        }
        throw new Error(`Unable to resolve team for ${context} (provider_team_id=${providerId ?? 'null'}, abbreviation=${team.abbreviation ?? 'null'})`);
    };
    return { resolveTeamId };
};
const mapGameToUpsert = (game, date, resolveTeamId) => {
    const homeTeam = game.home_team ?? null;
    const awayTeam = game.visitor_team ?? null;
    const homeTeamId = resolveTeamId(homeTeam, 'home_team');
    const awayTeamId = resolveTeamId(awayTeam, 'away_team');
    const homeAbbr = homeTeam?.abbreviation ?? null;
    const awayAbbr = awayTeam?.abbreviation ?? null;
    const homeName = homeTeam?.full_name ?? homeTeam?.name ?? null;
    const awayName = awayTeam?.full_name ?? awayTeam?.name ?? null;
    const providerGameId = game.id;
    if (providerGameId === null || providerGameId === undefined) {
        throw new Error('Encountered balldontlie game without an id');
    }
    return {
        provider: PROVIDER,
        provider_game_id: String(providerGameId),
        season: String(game?.season ?? ''),
        status: String(game?.status ?? ''),
        game_date: getGameDateIso(game, date),
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_team_abbr: homeAbbr,
        away_team_abbr: awayAbbr,
        home_team_name: homeName,
        away_team_name: awayName,
    };
};
async function GET(request) {
    try {
        const dateParam = request.nextUrl.searchParams.get('date');
        if (!dateParam || !isValidDateParam(dateParam)) {
            return server_1.NextResponse.json({ ok: false, error: 'Missing or invalid date parameter (expected YYYY-MM-DD)' }, { status: 400 });
        }
        const games = await fetchGames(dateParam);
        if (games.length === 0) {
            return server_1.NextResponse.json({ ok: true, count: 0, games: [] });
        }
        const { resolveTeamId } = await collectTeamsLookup(games);
        const upserts = games.map((game) => mapGameToUpsert(game, dateParam, resolveTeamId));
        const { data, error } = await supabase_1.supabaseAdmin
            .from('games')
            .upsert(upserts, { onConflict: 'provider,provider_game_id' })
            .select('id, provider_game_id, home_team_abbr, away_team_abbr, game_date, status');
        if (error) {
            throw error;
        }
        const result = (data ?? []).map((row) => ({
            id: row.id,
            home_abbr: row.home_team_abbr,
            away_abbr: row.away_team_abbr,
            game_date: row.game_date,
            status: row.status,
        }));
        return server_1.NextResponse.json({
            ok: true,
            count: result.length,
            games: result,
        });
    }
    catch (error) {
        console.error('[api/sync/games][GET]', error);
        return server_1.NextResponse.json({ ok: false, error: error.message ?? 'Failed to sync games' }, { status: 500 });
    }
}
