import { fromZonedTime } from 'date-fns-tz';

import { LOCK_WINDOW_BUFFER_MINUTES, TIMEZONES } from '@/lib/constants';
import { createAdminSupabaseClient } from '@/lib/supabase';
import { toET, weekStartSundayET, weeklyXpWeekContext } from '@/lib/time';
import type { WeeklyRankingRow, WeeklyXPTotal } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

const WEEK_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const ensureWeekStart = (weekStart?: string, fallback?: string): string => {
  if (weekStart && WEEK_FORMAT.test(weekStart)) {
    return weekStart;
  }
  return fallback ?? weeklyXpWeekContext().storageWeekStart;
};

const resolveSundayResetInstant = async (
  supabaseAdmin: SupabaseClient,
  reference = new Date(),
): Promise<Date | undefined> => {
  const sundayEt = weekStartSundayET(reference);
  const sundayStartUtc = fromZonedTime(`${sundayEt}T00:00:00`, TIMEZONES.US_EASTERN);
  const sundayEndUtc = fromZonedTime(`${sundayEt}T23:59:59`, TIMEZONES.US_EASTERN);

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

  const rawIsMidnightUtc =
    firstGameUtc.getUTCHours() === 0 &&
    firstGameUtc.getUTCMinutes() === 0 &&
    firstGameUtc.getUTCSeconds() === 0;

  if (rawIsMidnightUtc) {
    firstGameUtc = fromZonedTime(`${sundayEt}T23:59:00`, TIMEZONES.US_EASTERN);
  }

  const bufferMs = LOCK_WINDOW_BUFFER_MINUTES * 60_000;
  return new Date(firstGameUtc.getTime() - bufferMs);
};

export const resolveWeeklyXpContextWithClient = async (
  supabaseAdmin: SupabaseClient,
  reference = new Date(),
): Promise<ReturnType<typeof weeklyXpWeekContext>> => {
  const easternNow = toET(reference);
  if (easternNow.getUTCDay() !== 0) {
    return weeklyXpWeekContext(reference);
  }
  try {
    const sundayResetAt = await resolveSundayResetInstant(supabaseAdmin, reference);
    return weeklyXpWeekContext(reference, { sundayResetAt });
  } catch (error) {
    console.error('[weekly-xp] failed to resolve Sunday reset instant', error);
    return weeklyXpWeekContext(reference);
  }
};

export const resolveWeeklyXpContext = async (
  reference = new Date(),
): Promise<ReturnType<typeof weeklyXpWeekContext>> => {
  const supabaseAdmin = createAdminSupabaseClient();
  return resolveWeeklyXpContextWithClient(supabaseAdmin, reference);
};

export const getMyWeeklyXPVisible = async (userId: string): Promise<number> => {
  const supabaseAdmin = createAdminSupabaseClient();
  const { storageWeekStart, rolloverWeekStart } = await resolveWeeklyXpContextWithClient(
    supabaseAdmin,
  );
  const weekStarts =
    rolloverWeekStart && rolloverWeekStart !== storageWeekStart
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

export interface WeeklyRankingResult {
  weekStart: string;
  ranking: WeeklyRankingRow[];
}

export const getWeeklyRankingCurrent = async (): Promise<WeeklyRankingResult> => {
  const supabaseAdmin = createAdminSupabaseClient();
  const { displayWeekStart } = await resolveWeeklyXpContextWithClient(supabaseAdmin);

  const { data, error } = await supabaseAdmin
    .from('weekly_xp_ranking_current')
    .select('user_id, full_name, week_start_monday, weekly_xp')
    .order('weekly_xp', { ascending: false });

  if (error) {
    throw error;
  }

  const ranking = (data ?? []) as WeeklyRankingRow[];
  const userIds = Array.from(new Set(ranking.map((row) => row.user_id))).filter(Boolean);

  let avatarMap = new Map<string, string | null>();

  if (userIds.length > 0) {
    const { data: avatarsData, error: avatarsError } = await supabaseAdmin
      .from('users')
      .select('id, avatar_url')
      .in('id', userIds);

    if (!avatarsError && avatarsData) {
      avatarMap = new Map(
        avatarsData.map((entry) => [entry.id as string, (entry.avatar_url as string | null) ?? null]),
      );
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

export const getWeeklyTotalsByWeek = async (
  weekStart?: string,
  additionalWeekStart?: string,
): Promise<WeeklyXPTotal[]> => {
  const supabaseAdmin = createAdminSupabaseClient();
  const { storageWeekStart, rolloverWeekStart } = await resolveWeeklyXpContextWithClient(
    supabaseAdmin,
  );
  const resolvedWeekStart = ensureWeekStart(weekStart, storageWeekStart);
  const additional =
    additionalWeekStart && WEEK_FORMAT.test(additionalWeekStart)
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
    return (data ?? []) as WeeklyXPTotal[];
  }

  const totalsMap = new Map<string, number>();
  (data ?? []).forEach((row) => {
    const current = totalsMap.get(row.user_id) ?? 0;
    totalsMap.set(row.user_id, current + (row.weekly_xp ?? 0));
  });

  const merged = Array.from(totalsMap.entries()).map<WeeklyXPTotal>(
    ([user_id, weekly_xp]) => ({
      user_id,
      week_start_monday: resolvedWeekStart,
      weekly_xp,
    }),
  );

  merged.sort((a, b) => b.weekly_xp - a.weekly_xp);
  return merged;
};
