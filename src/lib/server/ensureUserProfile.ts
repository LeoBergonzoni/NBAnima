import { createAdminSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

export type UserProfileRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'full_name' | 'anima_points_balance' | 'role' | 'avatar_url'
>;

export const ensureUserProfile = async (
  userId: string,
  email?: string | null,
): Promise<UserProfileRow> => {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('users')
    .select('full_name, anima_points_balance, role, avatar_url')
    .eq('id', userId)
    .maybeSingle<UserProfileRow>();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const fallbackEmail = email ?? `${userId}@nb-anima.local`;
  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from('users')
    .upsert(
      {
        id: userId,
        email: fallbackEmail,
        role: 'user',
        anima_points_balance: 0,
        full_name: null,
        avatar_url: null,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        onConflict: 'id',
      },
    )
    .select('full_name, anima_points_balance, role, avatar_url')
    .single<UserProfileRow>();

  if (insertError) {
    throw insertError;
  }

  if (inserted) {
    return inserted;
  }

  const { data: fetched, error: fetchError } = await admin
    .from('users')
    .select('full_name, anima_points_balance, role, avatar_url')
    .eq('id', userId)
    .maybeSingle<UserProfileRow>();

  if (fetchError || !fetched) {
    throw fetchError ?? new Error('Failed to read user profile');
  }

  return fetched;
};
