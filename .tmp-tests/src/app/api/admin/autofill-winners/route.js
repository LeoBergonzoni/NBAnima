"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.revalidate = exports.dynamic = exports.runtime = void 0;
const server_1 = require("next/server");
const balldontlieClient_1 = require("../../../../lib/balldontlieClient");
const date_us_eastern_1 = require("../../../../lib/date-us-eastern");
const supabase_1 = require("../../../../lib/supabase");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const DEFAULT_PLAYER_CATEGORIES = ['top_scorer', 'top_assist', 'top_rebound'];
const ADMIN_TOKEN_HEADER = 'x-autofill-token';
const isFinalStatus = (value) => (value ?? '').toLowerCase().includes('final');
const normalizeProviderId = (value) => (value ?? '')
    .toLowerCase()
    .replace(/\./g, '-')
    .replace(/[-.]?(g|f|c)$/i, '')
    .trim();
const ensureAdminOrToken = async (request) => {
    const token = request.headers.get(ADMIN_TOKEN_HEADER) ?? request.headers.get('authorization');
    const expected = process.env.AUTOFILL_ADMIN_TOKEN;
    if (expected && token === `Bearer ${expected}`) {
        return { ok: true };
    }
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, status: 401, error: 'Unauthorized' };
    }
    const { data: profile, error } = await supabase_1.supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    if (error) {
        return { ok: false, status: 500, error: error.message };
    }
    if (profile?.role !== 'admin') {
        return { ok: false, status: 403, error: 'Forbidden' };
    }
    return { ok: true };
};
const pickTopPerformers = (stats, key) => {
    let maxValue = 0;
    stats.forEach((entry) => {
        const value = Number(entry?.[key] ?? 0);
        if (value > maxValue) {
            maxValue = value;
        }
    });
    if (maxValue <= 0) {
        return [];
    }
    return stats
        .filter((entry) => Number(entry?.[key] ?? 0) === maxValue)
        .map((entry) => (entry.player?.id != null ? String(entry.player.id) : null))
        .filter((value) => Boolean(value));
};
const mapGame = (game) => ({
    id: game.id,
    homeAbbr: game.home_team_abbr?.toUpperCase() ?? '',
    awayAbbr: game.away_team_abbr?.toUpperCase() ?? '',
    homeTeamId: game.home_team_id,
    awayTeamId: game.away_team_id,
});
const localPlayerCache = new Map();
const resolveLocalRosterPlayer = async (performer, game) => {
    const cacheKey = `${performer.id}:${game.id}`;
    if (localPlayerCache.has(cacheKey)) {
        return localPlayerCache.get(cacheKey);
    }
    const rawPid = performer.id;
    const normalizedPid = normalizeProviderId(rawPid);
    const stat = performer.stat;
    const playerFirst = (stat?.player?.first_name ?? '').trim();
    const playerLast = (stat?.player?.last_name ?? '').trim();
    const statTeamAbbr = stat?.team?.abbreviation?.toUpperCase() ?? null;
    const teamAbbrGuess = (() => {
        if (statTeamAbbr === game.homeAbbr || statTeamAbbr === game.awayAbbr) {
            return statTeamAbbr;
        }
        return null;
    })();
    const teamId = teamAbbrGuess === game.homeAbbr
        ? game.homeTeamId
        : teamAbbrGuess === game.awayAbbr
            ? game.awayTeamId
            : null;
    let query = supabase_1.supabaseAdmin
        .from('player')
        .select('id')
        .eq('provider', 'local-rosters')
        .in('provider_player_id', [rawPid, normalizedPid])
        .limit(1);
    if (teamId) {
        query = query.eq('team_id', teamId);
    }
    const { data: byPid, error: pidError } = await query;
    if (pidError) {
        throw pidError;
    }
    const foundByPid = byPid?.[0]?.id ?? null;
    if (foundByPid) {
        localPlayerCache.set(cacheKey, foundByPid);
        return foundByPid;
    }
    if (playerFirst || playerLast) {
        let nameQuery = supabase_1.supabaseAdmin
            .from('player')
            .select('id')
            .eq('provider', 'local-rosters')
            .ilike('first_name', playerFirst || '%')
            .ilike('last_name', playerLast || '%')
            .limit(1);
        if (teamId) {
            nameQuery = nameQuery.eq('team_id', teamId);
        }
        const { data: byName, error: nameError } = await nameQuery;
        if (nameError) {
            throw nameError;
        }
        const foundByName = byName?.[0]?.id ?? null;
        localPlayerCache.set(cacheKey, foundByName);
        return foundByName;
    }
    localPlayerCache.set(cacheKey, null);
    return null;
};
const POST = async (request) => {
    const auth = await ensureAdminOrToken(request);
    if (!auth.ok) {
        return server_1.NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const dateParam = request.nextUrl.searchParams.get('date') ?? (0, date_us_eastern_1.toEasternYYYYMMDD)(new Date());
    const bufferMinutes = Number(request.nextUrl.searchParams.get('bufferMinutes') ?? '2');
    const { start, end } = (0, date_us_eastern_1.getSlateBoundsUtc)(dateParam);
    try {
        const [{ data: games, error: gamesError }, summary] = await Promise.all([
            supabase_1.supabaseAdmin
                .from('games')
                .select('*')
                .gte('game_date', start)
                .lt('game_date', end)
                .eq('status', 'finished')
                .returns(),
            (0, balldontlieClient_1.fetchGamesByDate)(dateParam),
        ]);
        if (gamesError) {
            throw gamesError;
        }
        const finishedGames = (games ?? []).map(mapGame);
        if (finishedGames.length === 0) {
            return server_1.NextResponse.json({
                date: dateParam,
                updated: 0,
                playersInserted: 0,
                message: 'No finished games for date',
            });
        }
        const summaryFinal = summary.filter((game) => isFinalStatus(game.status));
        const statsByGameId = new Map();
        for (const game of summaryFinal) {
            const stats = await (0, balldontlieClient_1.fetchStatsForGame)(game.id);
            statsByGameId.set(game.id, stats);
        }
        const summaryByMatch = new Map();
        summaryFinal.forEach((game) => {
            const key = `${game.home_team.abbreviation?.toUpperCase() ?? ''}-${game.visitor_team.abbreviation?.toUpperCase() ?? ''}`;
            const winner = (game.home_team_score ?? 0) === (game.visitor_team_score ?? 0)
                ? null
                : (game.home_team_score ?? 0) > (game.visitor_team_score ?? 0)
                    ? 'home'
                    : 'away';
            const stats = statsByGameId.get(game.id) ?? [];
            const statsByPlayerId = new Map();
            stats.forEach((stat) => {
                if (stat?.player?.id != null) {
                    statsByPlayerId.set(String(stat.player.id), stat);
                }
            });
            summaryByMatch.set(key, {
                winner,
                performers: {
                    top_scorer: pickTopPerformers(stats, 'pts').map((id) => ({ id, stat: statsByPlayerId.get(id) ?? null })),
                    top_rebound: pickTopPerformers(stats, 'reb').map((id) => ({ id, stat: statsByPlayerId.get(id) ?? null })),
                    top_assist: pickTopPerformers(stats, 'ast').map((id) => ({ id, stat: statsByPlayerId.get(id) ?? null })),
                },
            });
        });
        const gameIds = finishedGames.map((game) => game.id);
        const [teamResults, playerResults] = await Promise.all([
            supabase_1.supabaseAdmin
                .from('results_team')
                .select('*')
                .in('game_id', gameIds)
                .returns(),
            supabase_1.supabaseAdmin
                .from('results_players')
                .select('*')
                .in('game_id', gameIds)
                .returns(),
        ]);
        const existingTeams = new Map((teamResults.data ?? []).map((entry) => [entry.game_id, entry]));
        const existingPlayers = new Map();
        (playerResults.data ?? []).forEach((entry) => {
            const key = `${entry.game_id}:${entry.category}`;
            const list = existingPlayers.get(key) ?? [];
            list.push(entry);
            existingPlayers.set(key, list);
        });
        const providerIds = new Set();
        summaryByMatch.forEach((value) => {
            DEFAULT_PLAYER_CATEGORIES.forEach((category) => {
                value.performers[category].forEach((entry) => providerIds.add(entry.id));
            });
        });
        const providerMap = new Map();
        if (providerIds.size > 0) {
            const { data: players, error: playersError } = await supabase_1.supabaseAdmin
                .from('player')
                .select('id, provider, provider_player_id')
                .in('provider_player_id', Array.from(providerIds));
            if (playersError) {
                throw playersError;
            }
            (players ?? []).forEach((entry) => {
                if (!entry.provider_player_id) {
                    return;
                }
                const normalized = normalizeProviderId(entry.provider_player_id);
                const preferLocal = entry.provider === 'local-rosters';
                const current = providerMap.get(entry.provider_player_id);
                if (!current || preferLocal) {
                    providerMap.set(entry.provider_player_id, entry.id);
                }
                if (normalized) {
                    const currentNorm = providerMap.get(normalized);
                    if (!currentNorm || preferLocal) {
                        providerMap.set(normalized, entry.id);
                    }
                }
            });
        }
        const teamUpserts = [];
        const playerUpserts = [];
        for (const game of finishedGames) {
            const matchKey = `${game.homeAbbr}-${game.awayAbbr}`;
            const summaryEntry = summaryByMatch.get(matchKey);
            if (!summaryEntry || !summaryEntry.winner) {
                continue;
            }
            const existingTeam = existingTeams.get(game.id);
            if (existingTeam) {
                continue;
            }
            const winnerTeamId = summaryEntry.winner === 'home' ? game.homeTeamId : game.awayTeamId;
            if (!winnerTeamId) {
                continue;
            }
            teamUpserts.push({
                game_id: game.id,
                winner_team_id: winnerTeamId,
                settled_at: undefined,
            });
            for (const category of DEFAULT_PLAYER_CATEGORIES) {
                const existing = existingPlayers.get(`${game.id}:${category}`);
                if (existing && existing.length > 0) {
                    continue;
                }
                const performers = summaryEntry.performers[category];
                for (const performer of performers) {
                    let playerId = providerMap.get(performer.id);
                    if (!playerId) {
                        playerId = await resolveLocalRosterPlayer(performer, game) ?? undefined;
                    }
                    if (!playerId) {
                        continue;
                    }
                    playerUpserts.push({
                        game_id: game.id,
                        category,
                        player_id: playerId,
                        settled_at: undefined,
                    });
                }
            }
        }
        if (teamUpserts.length > 0) {
            const { error } = await supabase_1.supabaseAdmin
                .from('results_team')
                .upsert(teamUpserts, { onConflict: 'game_id' });
            if (error) {
                throw error;
            }
        }
        if (playerUpserts.length > 0) {
            const { error } = await supabase_1.supabaseAdmin
                .from('results_players')
                .upsert(playerUpserts, { onConflict: 'game_id,category,player_id' });
            if (error) {
                throw error;
            }
        }
        return server_1.NextResponse.json({
            date: dateParam,
            updated: teamUpserts.length,
            playersInserted: playerUpserts.length,
        });
    }
    catch (error) {
        const status = error instanceof balldontlieClient_1.BalldontlieError && error.status ? error.status : 500;
        console.error('[api/admin/autofill-winners]', error);
        return server_1.NextResponse.json({ error: error.message ?? 'Failed to autofill winners' }, { status });
    }
};
exports.POST = POST;
