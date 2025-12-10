"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const providers_1 = require("../../../lib/providers");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
async function GET(request) {
    const { searchParams } = request.nextUrl;
    const gameId = searchParams.get('gameId');
    if (!gameId) {
        return server_1.NextResponse.json({ error: '`gameId` query parameter is required' }, { status: 400 });
    }
    try {
        const provider = (0, providers_1.getGameProvider)();
        const results = await provider.getGameResults(gameId);
        return server_1.NextResponse.json(results);
    }
    catch (error) {
        console.error('[api/boxscore]', error);
        return server_1.NextResponse.json({ error: 'Failed to load box score' }, { status: 500 });
    }
}
