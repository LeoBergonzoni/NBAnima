"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const rosters_1 = require("../../../../../lib/espn/rosters");
const supabase_1 = require("../../../../../lib/supabase");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const ensureAdmin = async () => {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, error, } = await supabase.auth.getUser();
    if (error) {
        throw error;
    }
    if (!user) {
        return { supabaseAdmin, role: null };
    }
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    if (profileError) {
        throw profileError;
    }
    return { supabaseAdmin, role: profile?.role ?? 'user' };
};
async function GET(request) {
    try {
        const { role } = await ensureAdmin();
        const isProduction = process.env.NODE_ENV === 'production';
        if (role !== 'admin') {
            if (isProduction) {
                return server_1.NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            console.warn('[espn-rosters] proceeding without admin (dev mode)');
        }
        const { teams, errors } = await (0, rosters_1.fetchEspnRosters)();
        return server_1.NextResponse.json({
            season: 'current',
            teams,
            errors,
        });
    }
    catch (error) {
        console.error('[api/admin/rosters/espn][GET]', error);
        return server_1.NextResponse.json({ error: error.message ?? 'Failed to fetch ESPN rosters' }, { status: 500 });
    }
}
