"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
async function GET() {
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            'content-type': 'application/json',
        },
    });
}
