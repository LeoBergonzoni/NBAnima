"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_1 = require("../../../../lib/supabase");
async function GET() {
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, error: userError, } = await supabase.auth.getUser();
    if (userError || !user) {
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { data, error } = await supabase
            .from('weekly_xp_ranking_current')
            .select('user_id, full_name, week_start_monday, weekly_xp')
            .eq('user_id', user.id)
            .single();
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        return server_1.NextResponse.json({
            weekStart: data?.week_start_monday ?? null,
            xp: data?.weekly_xp ?? 0,
        });
    }
    catch (error) {
        console.error('[api/me/weekly-xp]', error);
        return server_1.NextResponse.json({ error: 'Failed to load weekly XP balance' }, { status: 500 });
    }
}
