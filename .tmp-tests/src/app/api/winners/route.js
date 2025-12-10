"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const zod_1 = require("zod");
const date_us_eastern_1 = require("../../../lib/date-us-eastern");
const supabase_1 = require("../../../lib/supabase");
const types_winners_1 = require("../../../lib/types-winners");
const winners_service_1 = require("../../../server/services/winners.service");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const resolveSlateDate = (request) => {
    const fallback = (0, date_us_eastern_1.toEasternYYYYMMDD)((0, date_us_eastern_1.yesterdayInEastern)());
    const input = request.nextUrl.searchParams.get('date') ?? fallback;
    const parsed = types_winners_1.SlateDateSchema.safeParse(input);
    if (!parsed.success) {
        throw new zod_1.ZodError(parsed.error.issues);
    }
    return parsed.data;
};
async function GET(request) {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    try {
        const date = resolveSlateDate(request);
        const data = await (0, winners_service_1.getWinnersByDate)(supabaseAdmin, date);
        const payload = types_winners_1.WinnersResponseSchema.parse({
            date,
            ...data,
        });
        return server_1.NextResponse.json(payload);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return server_1.NextResponse.json({ error: 'Invalid date parameter. Expected format YYYY-MM-DD.' }, { status: 400 });
        }
        console.error('[api/winners]', error);
        return server_1.NextResponse.json({ error: 'Failed to load winners' }, { status: 500 });
    }
}
