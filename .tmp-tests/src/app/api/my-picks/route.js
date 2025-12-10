"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const date_fns_tz_1 = require("date-fns-tz");
const date_fns_1 = require("date-fns");
const zod_1 = require("zod");
const constants_1 = require("../../../lib/constants");
const supabase_1 = require("../../../lib/supabase");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const DATE_PARAM = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const getDefaultSlateDate = () => (0, date_fns_tz_1.formatInTimeZone)((0, date_fns_1.subDays)(new Date(), 1), constants_1.TIMEZONES.US_EASTERN, 'yyyy-MM-dd');
async function GET(request) {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, error: userError, } = await supabase.auth.getUser();
    if (userError) {
        console.error('[api/my-picks] auth error', userError);
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) {
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const dateParam = request.nextUrl.searchParams.get('date') ?? getDefaultSlateDate();
    const parseResult = DATE_PARAM.safeParse(dateParam);
    if (!parseResult.success) {
        return server_1.NextResponse.json({ error: 'Invalid date parameter. Expected format YYYY-MM-DD.' }, { status: 400 });
    }
    const pickDate = parseResult.data;
    try {
        const [teamsResp, playersResp, highlightsResp] = await Promise.all([
            supabaseAdmin
                .from('picks_teams')
                .select('game_id, selected_team_id')
                .eq('user_id', user.id)
                .eq('pick_date', pickDate),
            supabaseAdmin
                .from('picks_players')
                .select('game_id, category, player_id')
                .eq('user_id', user.id)
                .eq('pick_date', pickDate),
            supabaseAdmin
                .from('picks_highlights')
                .select('player_id, rank')
                .eq('user_id', user.id)
                .eq('pick_date', pickDate),
        ]);
        if (teamsResp.error || playersResp.error || highlightsResp.error) {
            throw teamsResp.error ?? playersResp.error ?? highlightsResp.error;
        }
        const playerIds = Array.from(new Set((playersResp.data ?? []).map((item) => item.player_id).filter(Boolean)));
        let playerMap = new Map();
        if (playerIds.length > 0) {
            const { data: lookup, error: lookupError } = await supabaseAdmin
                .from('player')
                .select('id, first_name, last_name')
                .in('id', playerIds);
            if (!lookupError && lookup) {
                playerMap = new Map(lookup.map((player) => [
                    player.id,
                    { first_name: player.first_name, last_name: player.last_name },
                ]));
            }
        }
        return server_1.NextResponse.json({
            date: pickDate,
            teams: teamsResp.data ?? [],
            players: (playersResp.data ?? []).map((player) => {
                const meta = playerMap.get(player.player_id);
                return {
                    ...player,
                    player: meta
                        ? { firstName: meta.first_name, lastName: meta.last_name }
                        : null,
                };
            }),
            highlights: highlightsResp.data ?? [],
        });
    }
    catch (error) {
        console.error('[api/my-picks]', error);
        return server_1.NextResponse.json({ error: 'Failed to load picks' }, { status: 500 });
    }
}
