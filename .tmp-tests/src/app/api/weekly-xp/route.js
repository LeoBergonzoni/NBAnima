"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const time_1 = require("../../../lib/time");
const xp_service_1 = require("../../../server/services/xp.service");
const WEEK_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const resolveWeekStart = async (request) => {
    const input = request.nextUrl.searchParams.get('weekStart');
    if (input && WEEK_FORMAT.test(input)) {
        return {
            storageWeekStart: input,
            displayWeekStart: (0, time_1.mondayFromSundayWeekStart)(input),
        };
    }
    const context = await (0, xp_service_1.resolveWeeklyXpContext)();
    return {
        storageWeekStart: context.storageWeekStart,
        additionalWeekStart: context.rolloverWeekStart,
        displayWeekStart: context.displayWeekStart,
    };
};
async function GET(request) {
    try {
        const { storageWeekStart, additionalWeekStart, displayWeekStart } = await resolveWeekStart(request);
        const totals = await (0, xp_service_1.getWeeklyTotalsByWeek)(storageWeekStart, additionalWeekStart);
        return server_1.NextResponse.json({
            weekStart: displayWeekStart,
            totals,
        });
    }
    catch (error) {
        console.error('[api/weekly-xp]', error);
        return server_1.NextResponse.json({ error: 'Failed to load weekly XP totals' }, { status: 500 });
    }
}
