"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const xp_service_1 = require("../../../../server/services/xp.service");
async function GET() {
    try {
        const { ranking, weekStart } = await (0, xp_service_1.getWeeklyRankingCurrent)();
        return server_1.NextResponse.json({
            weekStart,
            ranking,
        });
    }
    catch (error) {
        console.error('[api/leaderboard/weekly]', error);
        return server_1.NextResponse.json({ error: 'Failed to load weekly ranking' }, { status: 500 });
    }
}
