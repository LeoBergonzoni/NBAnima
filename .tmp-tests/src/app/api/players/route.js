"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const rosters_1 = require("../../../lib/rosters");
// 🔒 niente cache/ISR/CDN: evita che Netlify serva la risposta della prima partita alle successive
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
// ⛔️ disabilita cache; dichiara che la risposta varia per parametri di query
const headers = new Headers({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Vary': 'homeId, homeAbbr, homeName, awayId, awayAbbr, awayName',
});
const mapPlayer = (player, teamId) => {
    const fullName = player.name ? player.name.replace(/\s+/g, ' ').trim() : `Player ${player.id}`;
    const parts = fullName.split(' ');
    const firstName = parts[0] ?? fullName;
    const lastName = parts.slice(1).join(' ');
    return {
        id: player.id,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        position: (player.pos ?? '').toUpperCase(),
        team_id: teamId,
        jersey: player.jersey ?? null,
    };
};
const readTeamParams = (params, prefix) => ({
    id: params.get(`${prefix}Id`) ?? params.get(`${prefix}_id`),
    abbr: params.get(`${prefix}Abbr`) ?? params.get(`${prefix}_abbr`),
    name: params.get(`${prefix}Name`) ?? params.get(`${prefix}_name`),
});
const resolveFromCandidates = async (candidates) => {
    const attempts = [];
    for (const candidate of candidates) {
        if (!candidate || !candidate.trim())
            continue;
        const raw = candidate.trim();
        const normalized = (0, rosters_1.slugTeam)(raw);
        attempts.push({ raw, normalized });
        const resolved = await (0, rosters_1.resolveTeamKey)(raw);
        if (resolved)
            return { key: resolved, attempts };
    }
    return attempts.length ? { key: '', attempts } : null;
};
async function GET(req) {
    const { searchParams } = new URL(req.url);
    const homeParams = readTeamParams(searchParams, 'home');
    const awayParams = readTeamParams(searchParams, 'away');
    if (!homeParams.id && !homeParams.abbr && !homeParams.name) {
        return server_1.NextResponse.json({ ok: false, error: 'missing-team', missing: { team: 'home', tried: [] } }, { status: 404, headers });
    }
    if (!awayParams.id && !awayParams.abbr && !awayParams.name) {
        return server_1.NextResponse.json({ ok: false, error: 'missing-team', missing: { team: 'away', tried: [] } }, { status: 404, headers });
    }
    const rosters = await (0, rosters_1.getRosters)();
    const homeResolution = await resolveFromCandidates([
        homeParams.id,
        homeParams.abbr,
        homeParams.name,
    ]);
    if (!homeResolution || !homeResolution.key) {
        console.warn('[api/players] Missing home roster entry', {
            input: homeParams,
            attempts: homeResolution?.attempts ?? [],
        });
        return server_1.NextResponse.json({
            ok: false,
            error: 'missing-team',
            missing: { team: 'home', input: homeParams, attempts: homeResolution?.attempts ?? [] },
        }, { status: 404, headers });
    }
    const awayResolution = await resolveFromCandidates([
        awayParams.id,
        awayParams.abbr,
        awayParams.name,
    ]);
    if (!awayResolution || !awayResolution.key) {
        console.warn('[api/players] Missing away roster entry', {
            input: awayParams,
            attempts: awayResolution?.attempts ?? [],
        });
        return server_1.NextResponse.json({
            ok: false,
            error: 'missing-team',
            missing: { team: 'away', input: awayParams, attempts: awayResolution?.attempts ?? [] },
        }, { status: 404, headers });
    }
    const homeRoster = rosters[homeResolution.key] ?? [];
    const awayRoster = rosters[awayResolution.key] ?? [];
    const payload = {
        ok: true,
        source: 'local-rosters',
        home: homeRoster.map((p) => mapPlayer(p, homeResolution.key)),
        away: awayRoster.map((p) => mapPlayer(p, awayResolution.key)),
    };
    return server_1.NextResponse.json(payload, { status: 200, headers });
}
