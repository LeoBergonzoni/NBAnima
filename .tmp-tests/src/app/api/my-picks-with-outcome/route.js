"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_1 = require("../../../lib/supabase");
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
async function GET(request) {
    const slateDate = request.nextUrl.searchParams.get('slateDate');
    if (!slateDate || !isValidDate(slateDate)) {
        return server_1.NextResponse.json({ error: 'Missing or invalid slateDate parameter' }, { status: 400 });
    }
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, error: userError, } = await supabase.auth.getUser();
    if (userError || !user) {
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { data: picks, error: picksError } = await supabase
            .from('picks_teams')
            .select('game_id, selected_team_id, selected_team_abbr, selected_team_name, pick_date')
            .eq('user_id', user.id)
            .eq('pick_date', slateDate)
            .returns();
        if (picksError) {
            throw picksError;
        }
        const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
        const { data: winners, error: winnersError } = await supabaseAdmin
            .from('v_results_team_with_names')
            .select('game_id, winner_team_id')
            .eq('slate_date', slateDate)
            .returns();
        if (winnersError) {
            throw winnersError;
        }
        const byGame = new Map((winners ?? []).map((winner) => [winner.game_id, winner.winner_team_id]));
        const payload = (picks ?? []).map((pick) => {
            const resolvedWinner = byGame.get(pick.game_id);
            let outcome = 'PENDING';
            if (resolvedWinner) {
                outcome =
                    resolvedWinner === pick.selected_team_id ? 'WIN' : 'LOSS';
            }
            else if (resolvedWinner === null) {
                outcome = 'PENDING';
            }
            return {
                game_id: pick.game_id,
                slate_date: pick.pick_date,
                selected_team_id: pick.selected_team_id,
                selected_team_name: pick.selected_team_name ?? null,
                selected_team_abbr: pick.selected_team_abbr ?? null,
                outcome,
                winner_team_id: resolvedWinner ?? undefined,
            };
        });
        return server_1.NextResponse.json(payload);
    }
    catch (error) {
        console.error('[api/my-picks-with-outcome]', error);
        return server_1.NextResponse.json({ error: 'Failed to load picks' }, { status: 500 });
    }
}
