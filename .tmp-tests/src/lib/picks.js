"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePicksPayload = exports.assertLockWindowOpen = exports.getDailyChangeCount = void 0;
const date_fns_1 = require("date-fns");
const zod_1 = require("zod");
const constants_1 = require("./constants");
const picks_1 = require("./validators/picks");
const isoDateSchema = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');
const getETUtcRange = (pickDate) => {
    const parsed = isoDateSchema.parse(pickDate);
    const [year, month, day] = parsed.split('-').map(Number);
    const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const offsetMinutes = getNYOffsetMinutes(noonUtc);
    const startMs = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60_000;
    const endMs = Date.UTC(year, month - 1, day, 23, 59, 59) - offsetMinutes * 60_000;
    return {
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
    };
};
const getDailyChangeCount = async (supabaseAdmin, userId, pickDate) => {
    const [team, players, highlights] = await Promise.all([
        supabaseAdmin
            .from('picks_teams')
            .select('changes_count')
            .eq('user_id', userId)
            .gte('pick_date', pickDate)
            .lte('pick_date', pickDate),
        supabaseAdmin
            .from('picks_players')
            .select('changes_count')
            .eq('user_id', userId)
            .gte('pick_date', pickDate)
            .lte('pick_date', pickDate),
        supabaseAdmin
            .from('picks_highlights')
            .select('changes_count')
            .eq('user_id', userId)
            .gte('pick_date', pickDate)
            .lte('pick_date', pickDate),
    ]);
    const counts = [
        ...(team.data ?? []),
        ...(players.data ?? []),
        ...(highlights.data ?? []),
    ].map((row) => row.changes_count ?? 0);
    return counts.length > 0 ? Math.max(...counts) : 0;
};
exports.getDailyChangeCount = getDailyChangeCount;
/** Offset corrente di New York in minuti rispetto a UTC (es. EST=-300, EDT=-240) */
function getNYOffsetMinutes(d) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: constants_1.TIMEZONES.US_EASTERN,
        timeZoneName: 'shortOffset', // "GMT-05:00" / "GMT-04:00"
        hour: '2-digit',
        minute: '2-digit',
    }).formatToParts(d);
    const tz = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-05:00';
    const m = tz.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!m)
        return -300; // fallback prudente a EST
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}
/** Estrae componenti (Y-M-D H:M:S) dell’orologio NY per una certa Date */
function getEasternParts(value) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: constants_1.TIMEZONES.US_EASTERN,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(value);
    const pick = (type) => {
        const v = parts.find(p => p.type === type)?.value;
        if (!v)
            throw new Error(`Unable to extract "${type}" for Eastern comparison`);
        return Number.parseInt(v, 10);
    };
    return {
        year: pick('year'),
        month: pick('month'),
        day: pick('day'),
        hour: pick('hour'),
        minute: pick('minute'),
        second: pick('second'),
    };
}
/**
 * Converte un Date (istante UTC) nell’istante UTC corrispondente
 * allo stesso "wall clock" in America/New_York.
 *
 * Esempio: 2025-11-05 19:00 (NY, EST -05:00) => 2025-11-06 00:00:00Z
 */
function toEasternInstant(value) {
    const { year, month, day, hour, minute, second } = getEasternParts(value);
    const offMin = getNYOffsetMinutes(value); // es. -300 / -240
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offMin * 60_000;
    return new Date(utcMs);
}
/** Costruisce l’istante UTC per le 23:59 NY della pickDate (YYYY-MM-DD) */
function easternEndOfPickDateInstant(pickDate) {
    const [y, m, d] = pickDate.split('-').map(Number);
    // 12:00 UTC di quel giorno come base per ricavare l'offset NY corretto (EST/EDT)
    const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const offMin = getNYOffsetMinutes(noonUtc);
    const utcMs = Date.UTC(y, m - 1, d, 23, 59, 0) - offMin * 60_000;
    return new Date(utcMs);
}
const assertLockWindowOpen = async (supabaseAdmin, pickDate) => {
    // Diagnostica supporto TZ
    console.log('Intl TZ support:', new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' }).resolvedOptions().timeZone);
    const { start, end } = getETUtcRange(pickDate);
    console.log('[LOCK DEBUG] ET day UTC window:', { start, end });
    const { data, error } = await supabaseAdmin
        .from('games')
        .select('game_date')
        .gte('game_date', start)
        .lte('game_date', end);
    if (error)
        throw error;
    if (!data || data.length === 0)
        return;
    // LOG: elenco dei raw UTC ricevuti da Supabase
    const rawUtcList = data.map((g) => g.game_date);
    console.log('[LOCK DEBUG] raw game_date UTC list:', rawUtcList);
    // Converto ogni game_date al corrispondente istante UTC del "wall clock" NY
    const gamesEastern = data
        .map((game) => ({
        rawUtc: game.game_date,
        eastern: toEasternInstant(new Date(game.game_date)),
    }))
        .sort((a, b) => a.eastern.getTime() - b.eastern.getTime());
    const firstPair = gamesEastern[0];
    let firstGame = firstPair.eastern; // prima partita (istante UTC corrispondente a wall clock NY)
    // Se il valore RAW è a mezzanotte UTC, significa "solo data": forza lock a 23:59 NY della pickDate
    const firstPairDate = new Date(firstPair.rawUtc);
    const rawIsMidnightUTC = firstPairDate.getUTCHours() === 0 &&
        firstPairDate.getUTCMinutes() === 0 &&
        firstPairDate.getUTCSeconds() === 0;
    if (rawIsMidnightUTC) {
        const forced = easternEndOfPickDateInstant(pickDate);
        console.log('[LOCK DEBUG] RAW is midnight UTC -> forcing lock to 23:59 NY of pickDate:', forced.toISOString());
        firstGame = forced;
    }
    const nowEastern = toEasternInstant(new Date());
    // --- Guardia "mezzanotte" in wall-clock NY ---
    // Se dopo le conversioni la prima partita risulta 00:00:00 NY, imponi 23:59 NY della pickDate.
    const { hour: fgH, minute: fgM, second: fgS } = getEasternParts(firstGame);
    if (fgH === 0 && fgM === 0 && fgS === 0) {
        const forced = easternEndOfPickDateInstant(pickDate);
        console.log('[LOCK DEBUG] firstGameEastern appears midnight -> forcing lock to 23:59 NY of pickDate:', forced.toISOString());
        firstGame = forced;
    }
    // --- fine guardia ---
    const bufferMs = constants_1.LOCK_WINDOW_BUFFER_MINUTES * 60 * 1000;
    // LOG mirati prima del confronto
    console.log('[LOCK DEBUG] chosen raw game_date (UTC):', firstPair.rawUtc);
    console.log('[LOCK DEBUG] nowEastern ISO:', nowEastern.toISOString());
    console.log('[LOCK DEBUG] firstGameEastern ISO:', firstGame.toISOString());
    const threshold = new Date(firstGame.getTime() - bufferMs);
    console.log('[LOCK DEBUG] thresholdEastern ISO (firstGame - buffer):', threshold.toISOString());
    console.log('[LOCK DEBUG] firstGameEastern HMS:', firstGame.getUTCHours(), firstGame.getUTCMinutes(), firstGame.getUTCSeconds());
    if ((0, date_fns_1.isAfter)(nowEastern, threshold)) {
        throw new Error('Lock window active. Picks can no longer be modified today.');
    }
};
exports.assertLockWindowOpen = assertLockWindowOpen;
const validatePicksPayload = (payload) => picks_1.picksPayloadSchema.parse(payload);
exports.validatePicksPayload = validatePicksPayload;
