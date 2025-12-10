"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = exports.runtime = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const zod_1 = require("zod");
const supabase_1 = require("../../../../lib/supabase");
const resolveGame_1 = require("../../../../lib/server/resolveGame");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER_BDL = 'bdl';
const isUuid = (value) => Boolean(value && UUID_REGEX.test(value));
const clientTeamSchema = zod_1.z.object({
    abbr: zod_1.z.string().min(1).optional(),
    providerTeamId: zod_1.z.string().min(1).optional(),
    name: zod_1.z.string().min(1).optional(),
});
const clientGameSchema = zod_1.z.object({
    provider: zod_1.z.literal(PROVIDER_BDL),
    providerGameId: zod_1.z.string().min(1),
    season: zod_1.z.string().min(1),
    status: zod_1.z.string().min(1),
    dateNY: zod_1.z.string().regex(DATE_REGEX, { message: 'dateNY must be YYYY-MM-DD' }),
    startTimeUTC: zod_1.z.union([zod_1.z.string().min(1), zod_1.z.null()]).optional(),
    home: clientTeamSchema,
    away: clientTeamSchema,
});
const requestSchema = zod_1.z.object({
    pickDate: zod_1.z.string().regex(DATE_REGEX, { message: 'pickDate must be YYYY-MM-DD' }),
    game: zod_1.z.object({
        gameId: zod_1.z.string().uuid().optional(),
        gameProvider: zod_1.z.literal(PROVIDER_BDL).optional(),
        providerGameId: zod_1.z.string().min(1).optional(),
        dto: clientGameSchema.optional(),
    }),
    selectedTeam: zod_1.z
        .object({
        teamId: zod_1.z.string().uuid().optional(),
        abbr: zod_1.z.string().min(1).optional(),
        provider: zod_1.z.literal(PROVIDER_BDL).optional(),
        providerTeamId: zod_1.z.string().min(1).optional(),
    })
        .refine((value) => Boolean(value.teamId || value.providerTeamId || value.abbr), {
        message: 'selectedTeam must include at least one identifier between teamId, providerTeamId or abbr',
        path: ['selectedTeam'],
    }),
});
const TEAM_SELECT = 'id, abbr, name, provider, provider_team_id';
const normalizeAbbr = (abbr) => typeof abbr === 'string' ? abbr.trim().toUpperCase() : '';
const resolveTeam = async (supabaseAdmin, selectedTeam) => {
    const provider = selectedTeam.provider ?? PROVIDER_BDL;
    if (provider === PROVIDER_BDL && selectedTeam.providerTeamId) {
        const { data, error } = await supabaseAdmin
            .from('teams')
            .select(TEAM_SELECT)
            .eq('provider', PROVIDER_BDL)
            .eq('provider_team_id', selectedTeam.providerTeamId)
            .maybeSingle();
        if (error) {
            throw error;
        }
        if (data) {
            return data;
        }
    }
    const abbr = normalizeAbbr(selectedTeam.abbr);
    if (abbr) {
        const { data, error } = await supabaseAdmin
            .from('teams')
            .select(TEAM_SELECT)
            .eq('provider', provider)
            .eq('abbr', abbr)
            .maybeSingle();
        if (error) {
            throw error;
        }
        if (data) {
            return data;
        }
    }
    if (isUuid(selectedTeam.teamId)) {
        const { data, error } = await supabaseAdmin
            .from('teams')
            .select(TEAM_SELECT)
            .eq('id', selectedTeam.teamId)
            .maybeSingle();
        if (error) {
            throw error;
        }
        if (data) {
            return data;
        }
    }
    return null;
};
const upsertPick = async ({ supabaseAdmin, userId, gameId, pickDate, teamId, teamAbbr, teamName, }) => {
    const nowIso = new Date().toISOString();
    const { data: existing, error: existingError } = await supabaseAdmin
        .from('picks_teams')
        .select('id, changes_count')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .eq('pick_date', pickDate)
        .maybeSingle();
    if (existingError) {
        throw existingError;
    }
    if (existing) {
        const { data, error } = await supabaseAdmin
            .from('picks_teams')
            .update({
            selected_team_id: teamId,
            selected_team_abbr: teamAbbr,
            selected_team_name: teamName,
            changes_count: (existing.changes_count ?? 0) + 1,
            updated_at: nowIso,
        })
            .eq('id', existing.id)
            .select('id, selected_team_abbr, selected_team_name')
            .single();
        if (error) {
            throw error;
        }
        return data;
    }
    const { data, error } = await supabaseAdmin
        .from('picks_teams')
        .insert({
        user_id: userId,
        game_id: gameId,
        pick_date: pickDate,
        selected_team_id: teamId,
        selected_team_abbr: teamAbbr,
        selected_team_name: teamName,
        changes_count: 0,
    })
        .select('id, selected_team_abbr, selected_team_name')
        .single();
    if (error) {
        throw error;
    }
    return data;
};
async function POST(request) {
    try {
        const payload = await request.json().catch(() => null);
        const parsed = requestSchema.safeParse(payload);
        if (!parsed.success) {
            return server_1.NextResponse.json({
                ok: false,
                error: 'INVALID_PAYLOAD',
                details: parsed.error.flatten(),
            }, { status: 400 });
        }
        const body = parsed.data;
        const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
        const supabase = await (0, supabase_1.createServerSupabase)();
        const { data: { user }, error: authError, } = await supabase.auth.getUser();
        if (authError || !user) {
            return server_1.NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
        }
        let resolvedGameId;
        try {
            const result = await (0, resolveGame_1.resolveOrUpsertGame)({
                supabaseAdmin,
                gameId: body.game.gameId,
                gameProvider: body.game.gameProvider,
                providerGameId: body.game.providerGameId,
                dto: body.game.dto,
            });
            resolvedGameId = result.id;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'GAME_NOT_FOUND';
            if (message === 'GAME_NOT_FOUND' || message === 'TEAM_NOT_FOUND') {
                return server_1.NextResponse.json({ ok: false, error: message }, { status: 404 });
            }
            console.error('[api/picks/team] resolveOrUpsertGame failed', error);
            return server_1.NextResponse.json({ ok: false, error: 'GAME_RESOLUTION_FAILED' }, { status: 500 });
        }
        let teamRow;
        try {
            teamRow = await resolveTeam(supabaseAdmin, body.selectedTeam);
        }
        catch (error) {
            console.error('[api/picks/team] resolveTeam failed', error);
            return server_1.NextResponse.json({ ok: false, error: 'TEAM_RESOLUTION_FAILED' }, { status: 500 });
        }
        if (!teamRow) {
            return server_1.NextResponse.json({ ok: false, error: 'TEAM_NOT_FOUND' }, { status: 404 });
        }
        const fallbackAbbr = normalizeAbbr(body.selectedTeam.abbr) || teamRow.abbr || null;
        const fallbackName = teamRow.name ??
            body.selectedTeam.providerTeamId ??
            (body.selectedTeam.abbr ? body.selectedTeam.abbr.toUpperCase() : null);
        let pickRecord;
        try {
            pickRecord = await upsertPick({
                supabaseAdmin,
                userId: user.id,
                gameId: resolvedGameId,
                pickDate: body.pickDate,
                teamId: teamRow.id,
                teamAbbr: fallbackAbbr,
                teamName: fallbackName,
            });
        }
        catch (error) {
            console.error('[api/picks/team] upsertPick failed', error);
            return server_1.NextResponse.json({ ok: false, error: 'PICK_SAVE_FAILED' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            ok: true,
            pickId: pickRecord.id,
            gameId: resolvedGameId,
            selected_abbr: pickRecord.selected_team_abbr ?? fallbackAbbr,
            selected_name: pickRecord.selected_team_name ?? fallbackName,
        });
    }
    catch (error) {
        console.error('[api/picks/team][POST]', error);
        return server_1.NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
