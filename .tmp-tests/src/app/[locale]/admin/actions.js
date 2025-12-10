"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishPlayerWinners = exports.publishTeamWinners = exports.loadPlayerWinners = exports.loadTeamWinners = exports.saveHighlightsAction = exports.revokeCardAction = exports.assignCardAction = exports.adjustUserBalanceAction = void 0;
const cache_1 = require("next/cache");
const zod_1 = require("zod");
const date_us_eastern_1 = require("../../../lib/date-us-eastern");
const supabase_1 = require("../../../lib/supabase");
const scoring_1 = require("../../../lib/scoring");
const admin_1 = require("../../../lib/admin");
const upsertPlayers_1 = require("../../../lib/db/upsertPlayers");
const LEDGER_TABLE = 'anima_points_ledger';
const USERS_TABLE = 'users';
const USER_CARDS_TABLE = 'user_cards';
const RESULTS_HIGHLIGHTS_TABLE = 'results_highlights';
const DATE_SCHEMA = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');
const dayRangeForDate = (dateNY) => (0, date_us_eastern_1.getSlateBoundsUtc)(dateNY);
const normalizeProviderId = (value) => (value ?? '')
    .toLowerCase()
    .replace(/\./g, '-')
    .replace(/[-.]?(g|f|c)$/i, '')
    .trim();
const settlementReason = (dateNY) => `settlement:${dateNY}`;
const SAFE_UUID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_PLAYER_CATEGORIES = [
    'top_scorer',
    'top_assist',
    'top_rebound',
];
const POINT_STEP = admin_1.ADMIN_POINT_STEP;
const PLAYER_PROVIDER = 'local-rosters';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const teamIdCache = new Map();
const providerPlayerIdCache = new Map();
const isUuid = (value) => Boolean(value && UUID_REGEX.test(value));
const extractTeamAbbr = (label) => {
    if (!label) {
        return null;
    }
    const [namePart, teamPart] = label.split('—').map((part) => part.trim());
    if (!teamPart) {
        return null;
    }
    const cleaned = teamPart.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (cleaned.length >= 3) {
        return cleaned.slice(0, 3);
    }
    if (namePart) {
        const parts = namePart.split(/\s+/).filter(Boolean);
        if (parts.length >= 1) {
            return parts[0].slice(0, 3).toUpperCase();
        }
    }
    return null;
};
const normalizeNameParts = (selection) => {
    const first = selection.firstName?.trim();
    const last = selection.lastName?.trim();
    if (first || last) {
        return {
            first: first && first.length > 0 ? first : last ?? 'N.',
            last: last && last.length > 0 ? last : first ?? 'N.',
        };
    }
    const base = selection.label
        ? selection.label.split('—')[0]?.trim()
        : selection.providerPlayerId ?? selection.id;
    if (!base) {
        return { first: 'N.', last: 'N.' };
    }
    const tokens = base.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        return { first: 'N.', last: 'N.' };
    }
    if (tokens.length === 1) {
        return { first: tokens[0], last: tokens[0] };
    }
    const [firstToken, ...rest] = tokens;
    const lastToken = rest.join(' ') || firstToken;
    return { first: firstToken, last: lastToken };
};
const getTeamIdByAbbr = async (abbr) => {
    const key = abbr.trim().toUpperCase();
    if (teamIdCache.has(key)) {
        return teamIdCache.get(key);
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('teams')
        .select('id')
        .eq('abbr', key)
        .maybeSingle();
    if (error) {
        throw error;
    }
    if (!data?.id) {
        throw new Error(`Nessuna squadra trovata per l'abbreviazione "${key}"`);
    }
    teamIdCache.set(key, data.id);
    return data.id;
};
const ensurePlayerUuid = async (selection) => {
    if (!selection) {
        throw new Error('Player selection is required');
    }
    const providerIdRaw = selection.providerPlayerId ?? selection.id;
    if (!providerIdRaw) {
        throw new Error('Missing providerPlayerId for player selection');
    }
    const providerId = providerIdRaw;
    const normalizedProviderId = normalizeProviderId(providerIdRaw);
    const cacheKey = normalizedProviderId || providerId;
    if (providerPlayerIdCache.has(cacheKey)) {
        return providerPlayerIdCache.get(cacheKey);
    }
    const immediate = selection.supabaseId ?? selection.id;
    if (isUuid(immediate)) {
        // Se l'ID appartiene a un player non-local, prova a mapparlo a local-rosters.
        const { data: existingPlayer, error: existingError } = await supabase_1.supabaseAdmin
            .from('player')
            .select('id, provider, provider_player_id, team_id, first_name, last_name, position')
            .eq('id', immediate)
            .maybeSingle();
        if (existingError) {
            throw existingError;
        }
        if (existingPlayer) {
            if (existingPlayer.provider === PLAYER_PROVIDER) {
                providerPlayerIdCache.set(cacheKey, existingPlayer.id);
                return existingPlayer.id;
            }
            const teamId = existingPlayer.team_id;
            const pidVariants = [existingPlayer.provider_player_id, normalizedProviderId].filter(Boolean);
            if (pidVariants.length > 0) {
                const { data: mapped, error: mappedError } = await supabase_1.supabaseAdmin
                    .from('player')
                    .select('id')
                    .eq('provider', PLAYER_PROVIDER)
                    .eq('team_id', teamId)
                    .or(pidVariants.map((pid) => `provider_player_id.eq.${pid}`).join(','))
                    .limit(1)
                    .maybeSingle();
                if (mappedError) {
                    throw mappedError;
                }
                if (mapped?.id) {
                    providerPlayerIdCache.set(cacheKey, mapped.id);
                    return mapped.id;
                }
            }
            // Altrimenti crea un local-rosters usando i dati esistenti.
            const teamAbbrFallback = selection.teamAbbr?.toUpperCase() ?? extractTeamAbbr(selection.label);
            const teamIdResolved = teamId
                ? teamId
                : teamAbbrFallback
                    ? await getTeamIdByAbbr(teamAbbrFallback)
                    : null;
            if (!teamIdResolved) {
                throw new Error(`Impossibile determinare la squadra per il giocatore "${providerId}"`);
            }
            const upsertPayload = {
                provider: PLAYER_PROVIDER,
                provider_player_id: providerId,
                team_id: teamIdResolved,
                first_name: existingPlayer.first_name || 'N.',
                last_name: existingPlayer.last_name || 'N.',
                position: existingPlayer.position ?? null,
            };
            const { data: created, error: upsertErr } = await (0, upsertPlayers_1.upsertPlayers)(supabase_1.supabaseAdmin, [upsertPayload]);
            if (upsertErr) {
                throw upsertErr;
            }
            const createdId = created?.[0]?.id;
            if (!createdId) {
                throw new Error(`Creazione giocatore non riuscita per "${providerId}"`);
            }
            providerPlayerIdCache.set(cacheKey, createdId);
            return createdId;
        }
    }
    const teamAbbr = selection.teamAbbr?.toUpperCase() ?? extractTeamAbbr(selection.label);
    if (!teamAbbr) {
        throw new Error(`Impossibile determinare la squadra per il giocatore "${providerId}"`);
    }
    const teamId = await getTeamIdByAbbr(teamAbbr);
    // Preferisci un record esistente local-rosters se già presente (pid o nome)
    const pidVariants = [providerId, normalizedProviderId].filter(Boolean);
    const { data: existingByPid, error: existingPidError } = await supabase_1.supabaseAdmin
        .from('player')
        .select('id')
        .eq('provider', PLAYER_PROVIDER)
        .eq('team_id', teamId)
        .or(pidVariants.map((pid) => `provider_player_id.eq.${pid}`).join(','))
        .limit(1)
        .maybeSingle();
    if (existingPidError) {
        throw existingPidError;
    }
    if (existingByPid?.id) {
        providerPlayerIdCache.set(cacheKey, existingByPid.id);
        return existingByPid.id;
    }
    const { first, last } = normalizeNameParts(selection);
    if (first || last) {
        const { data: existingByName, error: existingNameError } = await supabase_1.supabaseAdmin
            .from('player')
            .select('id')
            .eq('provider', PLAYER_PROVIDER)
            .eq('team_id', teamId)
            .ilike('first_name', first || '%')
            .ilike('last_name', last || '%')
            .limit(1)
            .maybeSingle();
        if (existingNameError) {
            throw existingNameError;
        }
        if (existingByName?.id) {
            providerPlayerIdCache.set(cacheKey, existingByName.id);
            return existingByName.id;
        }
    }
    const position = selection.position
        ? selection.position.toUpperCase()
        : null;
    const upsertPayload = {
        provider: PLAYER_PROVIDER,
        provider_player_id: providerId,
        team_id: teamId,
        first_name: first || 'N.',
        last_name: last || 'N.',
        position,
    };
    const { data, error } = await (0, upsertPlayers_1.upsertPlayers)(supabase_1.supabaseAdmin, [upsertPayload]);
    if (error) {
        throw error;
    }
    const created = data?.find((entry) => entry.provider === PLAYER_PROVIDER &&
        entry.provider_player_id === providerId);
    if (!created?.id) {
        throw new Error(`Creazione giocatore non riuscita per "${providerId}"`);
    }
    providerPlayerIdCache.set(cacheKey, created.id);
    return created.id;
};
const ensureAdminUser = async () => {
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, error, } = await supabase.auth.getUser();
    if (error) {
        throw error;
    }
    if (!user) {
        throw new Error('Unauthorized');
    }
    const { data, error: profileError } = await supabase_1.supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    if (profileError) {
        throw profileError;
    }
    if (!data || data.role !== 'admin') {
        throw new Error('Forbidden');
    }
    return user;
};
const fetchGamesForDate = async (dateNY) => {
    const { start, end } = dayRangeForDate(dateNY);
    const { data, error } = await supabase_1.supabaseAdmin
        .from('games')
        .select('*')
        .gte('game_date', start)
        .lt('game_date', end)
        .order('game_date', { ascending: true })
        .returns();
    if (error) {
        throw error;
    }
    return data ?? [];
};
const fetchTeamResultsForGames = async (gameIds) => {
    if (gameIds.length === 0) {
        return [];
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('results_team')
        .select('*')
        .in('game_id', gameIds)
        .returns();
    if (error) {
        throw error;
    }
    return data ?? [];
};
const fetchPlayerResultsForGames = async (gameIds) => {
    if (gameIds.length === 0) {
        return [];
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('results_players')
        .select('*')
        .in('game_id', gameIds)
        .returns();
    if (error) {
        throw error;
    }
    return data ?? [];
};
const fetchHighlightResultsForDate = async (dateNY) => {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('results_highlights')
        .select('player_id, rank')
        .eq('result_date', dateNY);
    if (error) {
        throw error;
    }
    return (data ?? []);
};
const fetchPlayerRecordsByIds = async (playerIds) => {
    if (playerIds.length === 0) {
        return new Map();
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('player')
        .select('id, first_name, last_name, position, provider_player_id, team:team_id (abbr)')
        .in('id', Array.from(new Set(playerIds)));
    if (error) {
        throw error;
    }
    const rows = (data ?? []);
    return new Map(rows.map((player) => [
        player.id,
        {
            first_name: player.first_name,
            last_name: player.last_name,
            position: player.position,
            provider_player_id: player.provider_player_id,
            team_abbr: (() => {
                const abbr = player.team?.abbr;
                return abbr ? abbr.toUpperCase() : null;
            })(),
        },
    ]));
};
async function fetchRosterOptionsForTeams(teamIds) {
    if (teamIds.length === 0) {
        return new Map();
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('player')
        .select('id, provider_player_id, first_name, last_name, position, team_id, team:team_id (abbr)')
        .in('team_id', Array.from(new Set(teamIds)));
    if (error) {
        throw error;
    }
    const rows = (data ?? []);
    const byTeam = new Map();
    rows.forEach((player) => {
        if (!player.team_id) {
            return;
        }
        const teamAbbr = (() => {
            const abbr = player.team?.abbr;
            return abbr ? abbr.toUpperCase() : null;
        })();
        const option = {
            value: player.id,
            label: buildPlayerLabel(player, player.provider_player_id ?? player.id, teamAbbr),
            meta: {
                position: player.position ?? null,
                providerPlayerId: player.provider_player_id ?? null,
                teamAbbr,
            },
        };
        const existing = byTeam.get(player.team_id) ?? [];
        existing.push(option);
        byTeam.set(player.team_id, existing);
    });
    byTeam.forEach((options) => options.sort((a, b) => a.label.localeCompare(b.label)));
    return byTeam;
}
async function fetchAllPlayerOptions() {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('player')
        .select('id, provider, provider_player_id, first_name, last_name, position, team:team_id (abbr)')
        .limit(6000);
    if (error) {
        throw error;
    }
    const dedup = new Map();
    (data ?? []).forEach((player) => {
        const key = normalizeProviderId(player.provider_player_id) || player.provider_player_id || player.id;
        const existing = dedup.get(key);
        // Prefer local-rosters, poi espn, altrimenti tieni il primo
        const preferCurrent = !existing ||
            (existing.provider !== 'local-rosters' && player.provider === 'local-rosters') ||
            (existing.provider !== 'local-rosters' && existing.provider !== 'espn' && player.provider === 'espn');
        if (preferCurrent)
            dedup.set(key, player);
    });
    const options = Array.from(dedup.values()).map((player) => {
        const teamAbbr = (() => {
            const abbr = player.team?.abbr;
            return abbr ? abbr.toUpperCase() : null;
        })();
        return {
            value: player.id,
            label: buildPlayerLabel(player, player.provider_player_id ?? player.id, teamAbbr),
            meta: {
                position: player.position ?? null,
                providerPlayerId: player.provider_player_id ?? null,
                teamAbbr,
            },
        };
    });
    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
}
const buildPlayerLabel = (record, fallback, teamAbbr) => {
    const first = record?.first_name ?? '';
    const last = record?.last_name ?? '';
    const label = `${first} ${last}`.trim() || fallback;
    if (teamAbbr) {
        return `${label} — ${teamAbbr.toUpperCase()}`;
    }
    return label;
};
const applySettlementForDate = async (dateNY) => {
    const pickDate = DATE_SCHEMA.parse(dateNY);
    const reason = settlementReason(pickDate);
    const [teamPicksResponse, playerPicksResponse, highlightPicksResponse, ledgerResponse] = await Promise.all([
        supabase_1.supabaseAdmin
            .from('picks_teams')
            .select('user_id, game_id, selected_team_id, pick_date')
            .eq('pick_date', pickDate),
        supabase_1.supabaseAdmin
            .from('picks_players')
            .select('user_id, game_id, category, player_id, pick_date, player:player_id (provider_player_id)')
            .eq('pick_date', pickDate),
        supabase_1.supabaseAdmin
            .from('picks_highlights')
            .select('user_id, player_id, rank, pick_date, player:player_id (provider_player_id)')
            .eq('pick_date', pickDate),
        supabase_1.supabaseAdmin
            .from('anima_points_ledger')
            .select('user_id, delta')
            .eq('reason', reason),
    ]);
    if (teamPicksResponse.error ||
        playerPicksResponse.error ||
        highlightPicksResponse.error ||
        ledgerResponse.error) {
        throw (teamPicksResponse.error ??
            playerPicksResponse.error ??
            highlightPicksResponse.error ??
            ledgerResponse.error ??
            new Error('Failed to load settlement context'));
    }
    const teamPicks = (teamPicksResponse.data ?? []);
    const playerPicks = (playerPicksResponse.data ?? []);
    const highlightPicks = (highlightPicksResponse.data ?? []);
    const previousLedger = (ledgerResponse.data ?? []);
    const gameIds = Array.from(new Set([...teamPicks, ...playerPicks].map((pick) => pick.game_id).filter(Boolean)));
    const safeGameIds = gameIds.length > 0 ? gameIds : [SAFE_UUID];
    const [teamResults, playerResults, highlightResults] = await Promise.all([
        fetchTeamResultsForGames(safeGameIds),
        fetchPlayerResultsForGames(safeGameIds),
        fetchHighlightResultsForDate(pickDate),
    ]);
    const previousDeltaByUser = new Map();
    previousLedger.forEach((entry) => {
        previousDeltaByUser.set(entry.user_id, (previousDeltaByUser.get(entry.user_id) ?? 0) + (entry.delta ?? 0));
    });
    const userIds = new Set();
    teamPicks.forEach((pick) => userIds.add(pick.user_id));
    playerPicks.forEach((pick) => userIds.add(pick.user_id));
    highlightPicks.forEach((pick) => userIds.add(pick.user_id));
    previousLedger.forEach((entry) => userIds.add(entry.user_id));
    const userIdList = Array.from(userIds);
    const identitiesByPlayerId = new Map();
    const allPlayerIds = new Set();
    playerResults.forEach((row) => {
        if (row.player_id)
            allPlayerIds.add(row.player_id);
    });
    highlightResults.forEach((row) => {
        if (row.player_id)
            allPlayerIds.add(row.player_id);
    });
    playerPicks.forEach((row) => {
        if (row.player_id)
            allPlayerIds.add(row.player_id);
    });
    highlightPicks.forEach((row) => {
        if (row.player_id)
            allPlayerIds.add(row.player_id);
    });
    if (allPlayerIds.size > 0) {
        const { data: playerLookup, error: playerLookupError } = await supabase_1.supabaseAdmin
            .from('player')
            .select('id, provider_player_id, first_name, last_name')
            .in('id', Array.from(allPlayerIds));
        if (playerLookupError) {
            throw playerLookupError;
        }
        (playerLookup ?? []).forEach((row) => {
            const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || null;
            identitiesByPlayerId.set(row.id, {
                providerId: row.provider_player_id ?? null,
                name: fullName,
            });
        });
    }
    const resolveIdentity = (playerId) => playerId ? identitiesByPlayerId.get(playerId) ?? { providerId: null, name: null } : { providerId: null, name: null };
    const usersResponse = userIdList.length > 0
        ? await supabase_1.supabaseAdmin
            .from('users')
            .select('id, email, anima_points_balance')
            .in('id', userIdList)
        : { data: [], error: null };
    if (usersResponse.error) {
        throw usersResponse.error;
    }
    const userMap = new Map((usersResponse.data ?? []).map((user) => [user.id, user]));
    const teamResultsFormatted = (teamResults ?? []).map((result) => ({
        gameId: result.game_id,
        winnerTeamId: result.winner_team_id,
    }));
    const playerResultsFormatted = (playerResults ?? []).map((result) => ({
        gameId: result.game_id,
        category: result.category,
        playerId: result.player_id,
        providerPlayerId: resolveIdentity(result.player_id).providerId,
        playerName: resolveIdentity(result.player_id).name,
    }));
    const highlightResultsFormatted = (highlightResults ?? []).map((result) => ({
        playerId: result.player_id,
        providerPlayerId: resolveIdentity(result.player_id).providerId,
        playerName: resolveIdentity(result.player_id).name,
        rank: result.rank,
    }));
    const teamPicksByUser = new Map();
    teamPicks.forEach((pick) => {
        const list = teamPicksByUser.get(pick.user_id);
        if (list) {
            list.push(pick);
        }
        else {
            teamPicksByUser.set(pick.user_id, [pick]);
        }
    });
    const playerPicksByUser = new Map();
    playerPicks.forEach((pick) => {
        const list = playerPicksByUser.get(pick.user_id);
        if (list) {
            list.push(pick);
        }
        else {
            playerPicksByUser.set(pick.user_id, [pick]);
        }
    });
    const highlightPicksByUser = new Map();
    highlightPicks.forEach((pick) => {
        const list = highlightPicksByUser.get(pick.user_id);
        if (list) {
            list.push(pick);
        }
        else {
            highlightPicksByUser.set(pick.user_id, [pick]);
        }
    });
    const nowIso = new Date().toISOString();
    const ledgerInserts = [];
    const userUpserts = [];
    userIdList.forEach((userId) => {
        const score = (0, scoring_1.computeDailyScore)({
            teamPicks: (teamPicksByUser.get(userId) ?? []).map((pick) => ({
                gameId: pick.game_id,
                selectedTeamId: pick.selected_team_id,
            })),
            teamResults: teamResultsFormatted,
            playerPicks: (playerPicksByUser.get(userId) ?? []).map((pick) => ({
                gameId: pick.game_id,
                category: pick.category,
                playerId: pick.player_id,
                providerPlayerId: pick.player?.provider_player_id ??
                    resolveIdentity(pick.player_id).providerId,
                playerName: resolveIdentity(pick.player_id).name,
            })),
            playerResults: playerResultsFormatted,
            highlightPicks: (highlightPicksByUser.get(userId) ?? []).map((pick) => ({
                playerId: pick.player_id,
                providerPlayerId: pick.player?.provider_player_id ??
                    resolveIdentity(pick.player_id).providerId,
                playerName: resolveIdentity(pick.player_id).name,
                rank: pick.rank,
            })),
            highlightResults: highlightResultsFormatted,
        });
        const newDelta = score.totalPoints;
        const previousDelta = previousDeltaByUser.get(userId) ?? 0;
        const userRow = userMap.get(userId);
        const currentBalance = userRow?.anima_points_balance ?? 0;
        const newBalance = currentBalance - previousDelta + newDelta;
        if (userRow) {
            userUpserts.push({
                id: userRow.id,
                email: userRow.email,
                anima_points_balance: newBalance,
                updated_at: nowIso,
            });
        }
        if (newDelta > 0) {
            ledgerInserts.push({
                user_id: userId,
                delta: newDelta,
                balance_after: newBalance,
                reason,
                created_at: nowIso,
            });
        }
    });
    const { error: deleteLedgerError } = await supabase_1.supabaseAdmin
        .from(LEDGER_TABLE)
        .delete()
        .eq('reason', reason);
    if (deleteLedgerError) {
        throw deleteLedgerError;
    }
    if (userUpserts.length > 0) {
        const { error: userUpdateError } = await supabase_1.supabaseAdmin
            .from('users')
            .upsert(userUpserts, { onConflict: 'id' });
        if (userUpdateError) {
            throw userUpdateError;
        }
    }
    if (ledgerInserts.length > 0) {
        const { error: ledgerInsertError } = await supabase_1.supabaseAdmin
            .from(LEDGER_TABLE)
            .insert(ledgerInserts);
        if (ledgerInsertError) {
            throw ledgerInsertError;
        }
    }
    return {
        processed: ledgerInserts.length,
        users: userUpserts.length,
    };
};
const adjustUserBalanceAction = async ({ userId, delta = POINT_STEP, reason = 'manual_adjustment', locale, }) => {
    const now = new Date().toISOString();
    const { data: user, error: userError } = await supabase_1.supabaseAdmin
        .from(USERS_TABLE)
        .select('anima_points_balance')
        .eq('id', userId)
        .maybeSingle();
    if (userError) {
        throw userError;
    }
    const currentBalance = user?.anima_points_balance ?? 0;
    const nextBalance = currentBalance + delta;
    const ledgerEntry = {
        user_id: userId,
        delta,
        balance_after: nextBalance,
        reason,
    };
    const userUpdate = {
        anima_points_balance: nextBalance,
        updated_at: now,
    };
    const [{ error: ledgerError }, { error: updateError }] = await Promise.all([
        supabase_1.supabaseAdmin.from(LEDGER_TABLE).insert(ledgerEntry),
        supabase_1.supabaseAdmin.from(USERS_TABLE).update(userUpdate).eq('id', userId),
    ]);
    if (ledgerError || updateError) {
        throw ledgerError ?? updateError ?? new Error('Failed to update balance');
    }
    (0, cache_1.revalidatePath)(`/${locale}/admin`);
};
exports.adjustUserBalanceAction = adjustUserBalanceAction;
const assignCardAction = async ({ userId, cardId, locale }) => {
    const cardInsert = {
        user_id: userId,
        card_id: cardId,
    };
    const { error } = await supabase_1.supabaseAdmin
        .from(USER_CARDS_TABLE)
        .insert(cardInsert);
    if (error) {
        throw error;
    }
    (0, cache_1.revalidatePath)(`/${locale}/admin`);
};
exports.assignCardAction = assignCardAction;
const revokeCardAction = async ({ userId, cardId, locale }) => {
    const { error } = await supabase_1.supabaseAdmin
        .from(USER_CARDS_TABLE)
        .delete()
        .match({ user_id: userId, card_id: cardId });
    if (error) {
        throw error;
    }
    (0, cache_1.revalidatePath)(`/${locale}/admin`);
};
exports.revokeCardAction = revokeCardAction;
const saveHighlightsAction = async ({ date, highlights, locale, }) => {
    const now = new Date().toISOString();
    const resolved = await Promise.all(highlights
        .filter((entry) => entry.player)
        .map(async (entry) => ({
        rank: entry.rank,
        playerId: await ensurePlayerUuid(entry.player),
    })));
    const upsertPayload = resolved.map((entry) => ({
        player_id: entry.playerId,
        rank: entry.rank,
        result_date: date,
        settled_at: now,
    }));
    if (upsertPayload.length > 0) {
        const { error } = await supabase_1.supabaseAdmin
            .from(RESULTS_HIGHLIGHTS_TABLE)
            .upsert(upsertPayload, {
            onConflict: 'result_date,rank',
        });
        if (error) {
            throw error;
        }
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    try {
        await fetch(`${baseUrl}/api/settle?date=${date}`, {
            method: 'POST',
            cache: 'no-store',
        });
    }
    catch (err) {
        console.error('Failed to trigger settlement after highlights save', err);
    }
    (0, cache_1.revalidatePath)(`/${locale}/admin`);
};
exports.saveHighlightsAction = saveHighlightsAction;
const loadTeamWinners = async (dateNY) => {
    await ensureAdminUser();
    const pickDate = DATE_SCHEMA.parse(dateNY);
    const games = await fetchGamesForDate(pickDate);
    const teamResults = await fetchTeamResultsForGames(games.map((game) => game.id));
    const resultsMap = new Map(teamResults.map((result) => [result.game_id, result]));
    const gamesPayload = games.map((game) => {
        const result = resultsMap.get(game.id);
        return {
            id: game.id,
            status: game.status,
            homeTeam: {
                id: game.home_team_id,
                abbr: game.home_team_abbr,
                name: game.home_team_name,
            },
            awayTeam: {
                id: game.away_team_id,
                abbr: game.away_team_abbr,
                name: game.away_team_name,
            },
            winnerTeamId: result?.winner_team_id ?? null,
            settledAt: result?.settled_at ?? null,
        };
    });
    return {
        date: pickDate,
        games: gamesPayload,
    };
};
exports.loadTeamWinners = loadTeamWinners;
const loadPlayerWinners = async (dateNY) => {
    await ensureAdminUser();
    const pickDate = DATE_SCHEMA.parse(dateNY);
    const games = await fetchGamesForDate(pickDate);
    const gameIds = games.map((game) => game.id);
    const teamIds = games
        .flatMap((game) => [game.home_team_id, game.away_team_id])
        .filter((value) => Boolean(value));
    const [{ data: playerPicksRaw, error: playerPicksError }, playerResults, rosterOptionsByTeamId, allPlayerOptions,] = await Promise.all([
        supabase_1.supabaseAdmin
            .from('picks_players')
            .select([
            'game_id',
            'category',
            'player_id',
            'player:player_id(first_name,last_name,position,provider_player_id,team:team_id (abbr))',
        ].join(', '))
            .eq('pick_date', pickDate)
            .returns(),
        fetchPlayerResultsForGames(gameIds),
        fetchRosterOptionsForTeams(teamIds),
        fetchAllPlayerOptions(),
    ]);
    if (playerPicksError) {
        throw playerPicksError;
    }
    const playerInfoMap = new Map();
    const playerPicks = playerPicksRaw ?? [];
    const optionsByGameCategory = new Map();
    const optionTracker = new Map();
    const categoriesByGame = new Map();
    playerPicks.forEach((entry) => {
        const key = `${entry.game_id}:${entry.category}`;
        const optionsForGame = optionsByGameCategory.get(entry.game_id) ?? new Map();
        if (!optionsByGameCategory.has(entry.game_id)) {
            optionsByGameCategory.set(entry.game_id, optionsForGame);
        }
        const existing = optionsForGame.get(entry.category) ?? [];
        if (!optionsForGame.has(entry.category)) {
            optionsForGame.set(entry.category, existing);
        }
        const tracker = optionTracker.get(key) ?? new Set();
        if (!optionTracker.has(key)) {
            optionTracker.set(key, tracker);
        }
        const existingCategories = categoriesByGame.get(entry.game_id);
        if (existingCategories) {
            existingCategories.add(entry.category);
        }
        else {
            categoriesByGame.set(entry.game_id, new Set([entry.category]));
        }
        const info = entry.player ??
            {
                first_name: null,
                last_name: null,
                position: null,
                provider_player_id: null,
                team: { abbr: null },
            };
        const teamAbbr = info?.team?.abbr ? info.team.abbr.toUpperCase() : null;
        playerInfoMap.set(entry.player_id, {
            first_name: info?.first_name ?? null,
            last_name: info?.last_name ?? null,
            position: info?.position ?? null,
            provider_player_id: info?.provider_player_id ?? null,
            team_abbr: teamAbbr,
        });
        if (!tracker.has(entry.player_id)) {
            tracker.add(entry.player_id);
            existing.push({
                value: entry.player_id,
                label: buildPlayerLabel(info, entry.player_id, teamAbbr),
                meta: {
                    position: info?.position ?? null,
                    providerPlayerId: info?.provider_player_id ?? null,
                    teamAbbr,
                },
            });
        }
    });
    const resultMap = new Map();
    playerResults.forEach((result) => {
        const key = `${result.game_id}:${result.category}`;
        const existing = resultMap.get(key);
        if (existing) {
            existing.push(result);
        }
        else {
            resultMap.set(key, [result]);
        }
        const set = categoriesByGame.get(result.game_id) ??
            (() => {
                const created = new Set();
                categoriesByGame.set(result.game_id, created);
                return created;
            })();
        set.add(result.category);
    });
    const missingPlayerIds = playerResults
        .map((result) => result.player_id)
        .filter((playerId) => !playerInfoMap.has(playerId));
    const additionalPlayers = await fetchPlayerRecordsByIds(missingPlayerIds);
    additionalPlayers.forEach((info, playerId) => {
        playerInfoMap.set(playerId, info);
    });
    const gamesPayload = games.map((game) => {
        let categorySet = categoriesByGame.get(game.id);
        if (!categorySet) {
            categorySet = new Set();
            categoriesByGame.set(game.id, categorySet);
        }
        DEFAULT_PLAYER_CATEGORIES.forEach((category) => categorySet.add(category));
        const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b));
        const rosterOptions = [
            ...(game.home_team_id ? rosterOptionsByTeamId.get(game.home_team_id) ?? [] : []),
            ...(game.away_team_id ? rosterOptionsByTeamId.get(game.away_team_id) ?? [] : []),
        ];
        const mergeOptions = (...lists) => {
            const seen = new Set();
            const merged = [];
            lists.forEach((list) => {
                list.forEach((option) => {
                    if (!seen.has(option.value)) {
                        seen.add(option.value);
                        merged.push(option);
                    }
                });
            });
            return merged;
        };
        const perCategory = categories.map((category) => {
            const key = `${game.id}:${category}`;
            const winners = resultMap.get(key) ?? [];
            const baseOptions = optionsByGameCategory.get(game.id)?.get(category)?.slice() ?? [];
            const options = mergeOptions(baseOptions, rosterOptions, allPlayerOptions);
            winners.forEach((winner) => {
                if (!options.some((option) => option.value === winner.player_id)) {
                    const info = playerInfoMap.get(winner.player_id) ?? null;
                    options.push({
                        value: winner.player_id,
                        label: buildPlayerLabel(info ?? undefined, winner.player_id, info?.team_abbr ?? null),
                        meta: {
                            position: info?.position ?? null,
                            providerPlayerId: info?.provider_player_id ?? null,
                            teamAbbr: info?.team_abbr ?? null,
                        },
                    });
                }
            });
            options.sort((a, b) => a.label.localeCompare(b.label));
            const winnerIds = winners.map((winner) => winner.player_id).sort((a, b) => a.localeCompare(b));
            const settledAt = winners.reduce((latest, entry) => {
                if (!entry.settled_at) {
                    return latest;
                }
                if (!latest || entry.settled_at > latest) {
                    return entry.settled_at;
                }
                return latest;
            }, null);
            return {
                category,
                winnerPlayerIds: winnerIds,
                settledAt,
                options,
            };
        });
        return {
            id: game.id,
            status: game.status,
            homeTeam: {
                id: game.home_team_id,
                abbr: game.home_team_abbr,
                name: game.home_team_name,
            },
            awayTeam: {
                id: game.away_team_id,
                abbr: game.away_team_abbr,
                name: game.away_team_name,
            },
            categories: perCategory,
        };
    });
    return {
        date: pickDate,
        games: gamesPayload,
    };
};
exports.loadPlayerWinners = loadPlayerWinners;
const publishTeamWinners = async (dateNY, winners, locale) => {
    await ensureAdminUser();
    const pickDate = DATE_SCHEMA.parse(dateNY);
    const validWinners = winners.filter((entry) => entry.gameId && entry.winnerTeamId);
    if (validWinners.length > 0) {
        const now = new Date().toISOString();
        const upsertPayload = validWinners.map((entry) => ({
            game_id: entry.gameId,
            winner_team_id: entry.winnerTeamId,
            settled_at: now,
        }));
        const { error } = await supabase_1.supabaseAdmin
            .from('results_team')
            .upsert(upsertPayload, { onConflict: 'game_id' });
        if (error) {
            throw error;
        }
    }
    const settlement = await applySettlementForDate(pickDate);
    if (locale) {
        (0, cache_1.revalidatePath)(`/${locale}/admin`);
    }
    return {
        ok: true,
        updated: settlement.processed,
    };
};
exports.publishTeamWinners = publishTeamWinners;
const publishPlayerWinners = async (dateNY, winners, locale) => {
    await ensureAdminUser();
    const pickDate = DATE_SCHEMA.parse(dateNY);
    const normalized = winners
        .filter((entry) => entry.gameId && entry.category)
        .map((entry) => ({
        gameId: entry.gameId,
        category: entry.category,
        players: (entry.players ?? []).filter((player) => Boolean(player)),
    }));
    const now = new Date().toISOString();
    for (const entry of normalized) {
        const deleteResult = await supabase_1.supabaseAdmin
            .from('results_players')
            .delete()
            .eq('game_id', entry.gameId)
            .eq('category', entry.category);
        if (deleteResult.error) {
            throw deleteResult.error;
        }
        if (entry.players.length === 0) {
            continue;
        }
        const resolvedIds = await Promise.all(entry.players.map(async (player) => ensurePlayerUuid(player)));
        const uniqueIds = Array.from(new Set(resolvedIds));
        if (uniqueIds.length === 0) {
            continue;
        }
        const insertPayload = uniqueIds.map((playerId) => ({
            game_id: entry.gameId,
            category: entry.category,
            player_id: playerId,
            settled_at: now,
        }));
        const insertResult = await supabase_1.supabaseAdmin
            .from('results_players')
            .insert(insertPayload);
        if (insertResult.error) {
            throw insertResult.error;
        }
    }
    const settlement = await applySettlementForDate(pickDate);
    if (locale) {
        (0, cache_1.revalidatePath)(`/${locale}/admin`);
    }
    return {
        ok: true,
        updated: settlement.processed,
    };
};
exports.publishPlayerWinners = publishPlayerWinners;
