import { NextResponse, type NextRequest } from 'next/server';

import { fetchEspnRosters } from '@/lib/espn/rosters';
import { createAdminSupabaseClient, createServerSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ensureAdmin = async () => {
  const supabaseAdmin = createAdminSupabaseClient();
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }
  if (!user) {
    return { supabaseAdmin, role: null };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  if (profileError) {
    throw profileError;
  }

  return { supabaseAdmin, role: profile?.role ?? 'user' };
};

export async function GET(request: NextRequest) {
  try {
    const { role } = await ensureAdmin();
    const isProduction = process.env.NODE_ENV === 'production';

    if (role !== 'admin') {
      if (isProduction) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      console.warn('[espn-rosters] proceeding without admin (dev mode)');
    }

    const { teams, errors } = await fetchEspnRosters();

    return NextResponse.json({
      season: 'current',
      teams,
      errors,
    });
  } catch (error) {
    console.error('[api/admin/rosters/espn][GET]', error);
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to fetch ESPN rosters' },
      { status: 500 },
    );
  }
}
