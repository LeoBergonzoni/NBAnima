import { createAdminSupabaseClient } from '@/lib/supabase';
import { weeklyXpWeekContext } from '@/lib/time';
import type { WeeklyRankingRow, WeeklyXPTotal } from '@/types/database';

const WEEK_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const ensureWeekStart = (weekStart?: string): string => {
  if (weekStart && WEEK_FORMAT.test(weekStart)) {
    return weekStart;
  }
  return weeklyXpWeekContext().storageWeekStart;
};

export const getMyWeeklyXPVisible = async (userId: string): Promise<number> => {
  const supabaseAdmin = createAdminSupabaseClient();
  const { storageWeekStart, rolloverWeekStart } = weeklyXpWeekContext();
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
  const { displayWeekStart } = weeklyXpWeekContext();

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
  const resolvedWeekStart = ensureWeekStart(weekStart);
  const additional =
    additionalWeekStart && WEEK_FORMAT.test(additionalWeekStart)
      ? additionalWeekStart
      : undefined;
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
