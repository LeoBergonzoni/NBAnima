"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const cache_1 = require("next/cache");
const constants_1 = require("../../../../lib/constants");
const supabase_1 = require("../../../../lib/supabase");
const REWARD_POINTS = 10;
const MAX_MOVES_FOR_REWARD = 15;
const REWARD_REASON = 'tile_flip_game_reward';
async function POST(request) {
    try {
        const { moves, locale } = await request.json().catch(() => ({}));
        if (typeof moves !== 'number' || Number.isNaN(moves)) {
            return server_1.NextResponse.json({ error: 'INVALID_MOVES' }, { status: 400 });
        }
        if (moves > MAX_MOVES_FOR_REWARD) {
            return server_1.NextResponse.json({ error: 'TOO_MANY_MOVES' }, { status: 400 });
        }
        const supabase = await (0, supabase_1.createServerSupabase)();
        const { data: { user }, error: authError, } = await supabase.auth.getUser();
        if (authError || !user) {
            return server_1.NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        }
        const { data: userRow, error: userError } = await supabase_1.supabaseAdmin
            .from('users')
            .select('anima_points_balance')
            .eq('id', user.id)
            .maybeSingle();
        if (userError || !userRow) {
            return server_1.NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
        }
        const currentBalance = userRow.anima_points_balance ?? 0;
        const nextBalance = currentBalance + REWARD_POINTS;
        const [{ error: ledgerError }, { error: updateError }] = await Promise.all([
            supabase_1.supabaseAdmin.from('anima_points_ledger').insert({
                user_id: user.id,
                delta: REWARD_POINTS,
                balance_after: nextBalance,
                reason: REWARD_REASON,
            }),
            supabase_1.supabaseAdmin
                .from('users')
                .update({ anima_points_balance: nextBalance })
                .eq('id', user.id),
        ]);
        if (ledgerError || updateError) {
            return server_1.NextResponse.json({ error: 'LEDGER_FAIL' }, { status: 500 });
        }
        const normalizedLocale = typeof locale === 'string' && constants_1.SUPPORTED_LOCALES.includes(locale)
            ? locale
            : null;
        if (normalizedLocale) {
            (0, cache_1.revalidatePath)(`/${normalizedLocale}/dashboard`);
            (0, cache_1.revalidatePath)(`/${normalizedLocale}/dashboard/tile-flip-game`);
        }
        return server_1.NextResponse.json({ ok: true, balance: nextBalance, delta: REWARD_POINTS });
    }
    catch (error) {
        console.error('[tile-flip/reward] failed to assign reward', error);
        return server_1.NextResponse.json({ error: 'UNKNOWN' }, { status: 500 });
    }
}
