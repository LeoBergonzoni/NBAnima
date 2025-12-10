"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const balldontlieClient_1 = require("../../../../lib/balldontlieClient");
const supabase_1 = require("../../../../lib/supabase");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const isFinalStatus = (value) => (value ?? '').toLowerCase().includes('final');
const ensureAdmin = async () => {
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return { user: null, role: null };
    }
    const { data: profile } = await supabase_1.supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    return { user, role: profile?.role ?? null };
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
        .map((entry) => ({
        player: entry.player ?? null,
        team: entry.team ?? null,
        value: maxValue,
    }));
};
const mapGame = (game) => ({
    id: game.id,
    date: game.date,
    status: game.status,
    home_team: game.home_team,
    visitor_team: game.visitor_team,
    home_team_score: game.home_team_score ?? 0,
    visitor_team_score: game.visitor_team_score ?? 0,
});
async function GET(request) {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date');
    if (!date) {
        return server_1.NextResponse.json({ error: 'Missing `date` query parameter (YYYY-MM-DD).' }, { status: 400 });
    }
    const { user, role } = await ensureAdmin();
    if (!user) {
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'admin') {
        return server_1.NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
        const games = await (0, balldontlieClient_1.fetchGamesByDate)(date);
        const finalGames = games.filter((game) => isFinalStatus(game.status));
        const gamesWithLeaders = await Promise.all(finalGames.map(async (game) => {
            const stats = await (0, balldontlieClient_1.fetchStatsForGame)(game.id);
            return {
                game: mapGame(game),
                topPerformers: {
                    points: pickTopPerformers(stats, 'pts'),
                    rebounds: pickTopPerformers(stats, 'reb'),
                    assists: pickTopPerformers(stats, 'ast'),
                },
            };
        }));
        return server_1.NextResponse.json({ date, games: gamesWithLeaders });
    }
    catch (error) {
        console.error('[api/admin/games-summary]', error);
        const status = error instanceof balldontlieClient_1.BalldontlieError && error.status
            ? error.status
            : 500;
        return server_1.NextResponse.json({ error: error.message ?? 'Failed to load BallDontLie data' }, { status });
    }
}
