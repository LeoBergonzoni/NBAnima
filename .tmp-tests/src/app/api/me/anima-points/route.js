"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const scoring_1 = require("../../../../lib/scoring");
const supabase_1 = require("../../../../lib/supabase");
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
        const total = await (0, scoring_1.calculateUserSlatePoints)(user.id, slateDate);
        return server_1.NextResponse.json({ slateDate, total });
    }
    catch (error) {
        console.error('[api/me/anima-points]', error);
        return server_1.NextResponse.json({ error: 'Failed to calculate points' }, { status: 500 });
    }
}
