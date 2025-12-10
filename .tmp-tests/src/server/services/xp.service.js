"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeeklyTotalsByWeek = exports.getWeeklyRankingCurrent = exports.getMyWeeklyXPVisible = exports.resolveWeeklyXpContext = exports.resolveWeeklyXpContextWithClient = void 0;
const date_fns_tz_1 = require("date-fns-tz");
const constants_1 = require("../../lib/constants");
const supabase_1 = require("../../lib/supabase");
const time_1 = require("../../lib/time");
const WEEK_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const ensureWeekStart = (weekStart, fallback) => {
    if (weekStart && WEEK_FORMAT.test(weekStart)) {
        return weekStart;
    }
    return fallback ?? (0, time_1.weeklyXpWeekContext)().storageWeekStart;
};
const resolveSundayResetInstant = async (supabaseAdmin, reference = new Date()) => {
    const sundayEt = (0, time_1.weekStartSundayET)(reference);
    const sundayStartUtc = (0, date_fns_tz_1.fromZonedTime)(`${sundayEt}T00:00:00`, constants_1.TIMEZONES.US_EASTERN);
    const sundayEndUtc = (0, date_fns_tz_1.fromZonedTime)(`${sundayEt}T23:59:59`, constants_1.TIMEZONES.US_EASTERN);
    const { data, error } = await supabaseAdmin
        .from('games')
        .select('game_date')
        .gte('game_date', sundayStartUtc.toISOString())
        .lte('game_date', sundayEndUtc.toISOString())
        .order('game_date', { ascending: true })
        .limit(1);
    if (error) {
        throw error;
    }
    const firstGameIso = data?.[0]?.game_date;
    if (!firstGameIso) {
        return undefined;
    }
    let firstGameUtc = new Date(firstGameIso);
    if (Number.isNaN(firstGameUtc.getTime())) {
        return undefined;
    }
    const rawIsMidnightUtc = firstGameUtc.getUTCHours() === 0 &&
        firstGameUtc.getUTCMinutes() === 0 &&
        firstGameUtc.getUTCSeconds() === 0;
    if (rawIsMidnightUtc) {
        firstGameUtc = (0, date_fns_tz_1.fromZonedTime)(`${sundayEt}T23:59:00`, constants_1.TIMEZONES.US_EASTERN);
    }
    const bufferMs = constants_1.LOCK_WINDOW_BUFFER_MINUTES * 60_000;
    return new Date(firstGameUtc.getTime() - bufferMs);
};
const resolveWeeklyXpContextWithClient = async (supabaseAdmin, reference = new Date()) => {
    const easternNow = (0, time_1.toET)(reference);
    if (easternNow.getUTCDay() !== 0) {
        return (0, time_1.weeklyXpWeekContext)(reference);
    }
    try {
        const sundayResetAt = await resolveSundayResetInstant(supabaseAdmin, reference);
        return (0, time_1.weeklyXpWeekContext)(reference, { sundayResetAt });
    }
    catch (error) {
        console.error('[weekly-xp] failed to resolve Sunday reset instant', error);
        return (0, time_1.weeklyXpWeekContext)(reference);
    }
};
exports.resolveWeeklyXpContextWithClient = resolveWeeklyXpContextWithClient;
const resolveWeeklyXpContext = async (reference = new Date()) => {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    return (0, exports.resolveWeeklyXpContextWithClient)(supabaseAdmin, reference);
};
exports.resolveWeeklyXpContext = resolveWeeklyXpContext;
const getMyWeeklyXPVisible = async (userId) => {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    const { storageWeekStart, rolloverWeekStart } = await (0, exports.resolveWeeklyXpContextWithClient)(supabaseAdmin);
    const weekStarts = rolloverWeekStart && rolloverWeekStart !== storageWeekStart
        ? [storageWeekStart, rolloverWeekStart]
        : [storageWeekStart];
    let query = supabaseAdmin
        .from('weekly_xp_totals')
        .select('week_start_monday, weekly_xp')
        .eq('user_id', userId);
    query =
        weekStarts.length === 1
            ? query.eq('week_start_monday', weekStarts[0])
            : query.in('week_start_monday', weekStarts);
    const { data, error } = await query;
    if (error) {
        throw error;
    }
    return (data ?? []).reduce((sum, row) => sum + (row.weekly_xp ?? 0), 0);
};
exports.getMyWeeklyXPVisible = getMyWeeklyXPVisible;
const getWeeklyRankingCurrent = async () => {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    const { displayWeekStart } = await (0, exports.resolveWeeklyXpContextWithClient)(supabaseAdmin);
    const { data, error } = await supabaseAdmin
        .from('weekly_xp_ranking_current')
        .select('user_id, full_name, week_start_monday, weekly_xp')
        .order('weekly_xp', { ascending: false });
    if (error) {
        throw error;
    }
    const ranking = (data ?? []);
    const userIds = Array.from(new Set(ranking.map((row) => row.user_id))).filter(Boolean);
    let avatarMap = new Map();
    if (userIds.length > 0) {
        const { data: avatarsData, error: avatarsError } = await supabaseAdmin
            .from('users')
            .select('id, avatar_url')
            .in('id', userIds);
        if (!avatarsError && avatarsData) {
            avatarMap = new Map(avatarsData.map((entry) => [entry.id, entry.avatar_url ?? null]));
        }
    }
    const rankingWithAvatars = ranking.map((row) => ({
        ...row,
        avatar_url: avatarMap.get(row.user_id) ?? row.avatar_url ?? null,
    }));
    return {
        weekStart: ranking[0]?.week_start_monday ?? displayWeekStart,
        ranking: rankingWithAvatars,
    };
};
exports.getWeeklyRankingCurrent = getWeeklyRankingCurrent;
const getWeeklyTotalsByWeek = async (weekStart, additionalWeekStart) => {
    const supabaseAdmin = (0, supabase_1.createAdminSupabaseClient)();
    const { storageWeekStart, rolloverWeekStart } = await (0, exports.resolveWeeklyXpContextWithClient)(supabaseAdmin);
    const resolvedWeekStart = ensureWeekStart(weekStart, storageWeekStart);
    const additional = additionalWeekStart && WEEK_FORMAT.test(additionalWeekStart)
        ? additionalWeekStart
        : rolloverWeekStart;
    const weekStarts = additional ? [resolvedWeekStart, additional] : [resolvedWeekStart];
    let query = supabaseAdmin
        .from('weekly_xp_totals')
        .select('user_id, week_start_monday, weekly_xp');
    query =
        weekStarts.length === 1
            ? query.eq('week_start_monday', weekStarts[0]).order('weekly_xp', { ascending: false })
            : query.in('week_start_monday', weekStarts);
    const { data, error } = await query;
    if (error) {
        throw error;
    }
    if (weekStarts.length === 1) {
        return (data ?? []);
    }
    const totalsMap = new Map();
    (data ?? []).forEach((row) => {
        const current = totalsMap.get(row.user_id) ?? 0;
        totalsMap.set(row.user_id, current + (row.weekly_xp ?? 0));
    });
    const merged = Array.from(totalsMap.entries()).map(([user_id, weekly_xp]) => ({
        user_id,
        week_start_monday: resolvedWeekStart,
        weekly_xp,
    }));
    merged.sort((a, b) => b.weekly_xp - a.weekly_xp);
    return merged;
};
exports.getWeeklyTotalsByWeek = getWeeklyTotalsByWeek;
