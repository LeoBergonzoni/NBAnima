import { createAdminSupabaseClient } from '@/lib/supabase';
import { visibleWeekStartET } from '@/lib/time';
import type { WeeklyRankingRow, WeeklyXPTotal } from '@/types/database';

const WEEK_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const ensureWeekStart = (weekStart?: string): string => {
  if (weekStart && WEEK_FORMAT.test(weekStart)) {
    return weekStart;
  }
  return visibleWeekStartET();
};

export const getMyWeeklyXPVisible = async (userId: string): Promise<number> => {
  const supabaseAdmin = createAdminSupabaseClient();
  const weekStart = visibleWeekStartET();

  const { data, error } = await supabaseAdmin
    .from('weekly_xp_totals')
    .select('weekly_xp')
    .eq('user_id', userId)
    .eq('week_start_sunday', weekStart)
    .maybeSingle<{ weekly_xp: number }>();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data?.weekly_xp ?? 0;
};

export const getWeeklyRankingCurrent = async (): Promise<WeeklyRankingRow[]> => {
  const supabaseAdmin = createAdminSupabaseClient();

  const { data, error } = await supabaseAdmin
    .from('weekly_xp_ranking_current')
    .select('user_id, full_name, week_start_sunday, weekly_xp')
    .order('weekly_xp', { ascending: false });

  if (error) {
    throw error;
  }

  const rankingRows = (data ?? []) as WeeklyRankingRow[];
  const weekStart = rankingRows[0]?.week_start_sunday ?? visibleWeekStartET();

  const [{ data: totalsData, error: totalsError }, { data: usersData, error: usersError }] =
    await Promise.all([
      supabaseAdmin
        .from('weekly_xp_totals')
        .select('user_id, week_start_sunday, weekly_xp')
        .eq('week_start_sunday', weekStart),
      supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .order('full_name', { ascending: true, nullsFirst: true }),
    ]);

  if (totalsError) {
    throw totalsError;
  }

  if (usersError) {
    throw usersError;
  }

  const totalsMap = new Map<string, number>(
    (totalsData ?? []).map((row) => [row.user_id, row.weekly_xp ?? 0]),
  );

  rankingRows.forEach((row) => {
    if (!totalsMap.has(row.user_id)) {
      totalsMap.set(row.user_id, row.weekly_xp ?? 0);
    }
  });

  const augmentedRanking = (usersData ?? []).map((user) => {
    const xp = totalsMap.get(user.id) ?? 0;
    const baseRow = rankingRows.find((row) => row.user_id === user.id);
    return {
      user_id: user.id,
      full_name: baseRow?.full_name ?? user.full_name ?? user.email ?? '—',
      week_start_sunday: baseRow?.week_start_sunday ?? weekStart,
      weekly_xp: xp,
    };
  });

  const unmatched = rankingRows.filter(
    (row) => !(usersData ?? []).some((user) => user.id === row.user_id),
  );

  const combined = [...augmentedRanking, ...unmatched];

  combined.sort((a, b) => {
    if (b.weekly_xp !== a.weekly_xp) {
      return b.weekly_xp - a.weekly_xp;
    }
    return a.full_name.localeCompare(b.full_name);
  });

  return combined;
};

export const getWeeklyTotalsByWeek = async (
  weekStart?: string,
): Promise<WeeklyXPTotal[]> => {
  const supabaseAdmin = createAdminSupabaseClient();
  const resolvedWeekStart = ensureWeekStart(weekStart);

  const { data, error } = await supabaseAdmin
    .from('weekly_xp_totals')
    .select('user_id, week_start_sunday, weekly_xp')
    .eq('week_start_sunday', resolvedWeekStart)
    .order('weekly_xp', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as WeeklyXPTotal[];
};
