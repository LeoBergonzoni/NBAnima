import { createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';

import {
  createAdminSupabaseClient,
  createServerSupabase,
} from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stableUuidFromString = (value: string) => {
  const hash = createHash('sha1').update(value).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
};

const ensureAdminUser = async () => {
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
    return { supabaseAdmin, user: null, role: null };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return {
    supabaseAdmin,
    user,
    role: profile?.role ?? 'user',
  };
};

const fetchBalldontlieGames = async (date: string) => {
  const perPage = 100;
  let page = 1;
  let totalPages = 1;
  const games: any[] = [];

  while (page <= totalPages) {
    const response = await fetch(
      `https://www.balldontlie.io/api/v1/games?start_date=${date}&end_date=${date}&per_page=${perPage}&page=${page}`,
      {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body?.message ?? `Failed to fetch games from balldontlie (status ${response.status})`,
      );
    }

    const payload = await response.json();
    totalPages = Number(payload?.meta?.total_pages ?? 1);
    games.push(...(payload?.data ?? []));
    page += 1;
  }

  return games;
};

const formatGameDate = (dateIso: string, fallbackDate: string) => {
  const parsed = new Date(dateIso);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  const fallback = new Date(`${fallbackDate}T00:00:00Z`);
  return Number.isNaN(fallback.getTime())
    ? new Date().toISOString()
    : fallback.toISOString();
};

const normalizeTeamId = (abbr?: string | null, fallbackId?: number | string | null) => {
  const key = (abbr ?? fallbackId ?? '').toString().trim().toLowerCase();
  if (!key) {
    throw new Error('Missing team identifier from balldontlie payload');
  }
  return stableUuidFromString(`team:${key}`);
};

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Missing or invalid date parameter (expected YYYY-MM-DD)' },
        { status: 400 },
      );
    }

    const { supabaseAdmin, user, role } = await ensureAdminUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const games = await fetchBalldontlieGames(date);
    if (games.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    const upserts: Database['public']['Tables']['games']['Insert'][] = games.map((game) => {
      const providerGameId = String(game?.id ?? '');
      if (!providerGameId) {
        throw new Error('Missing balldontlie game id');
      }

      const homeAbbr = game?.home_team?.abbreviation ?? null;
      const awayAbbr = game?.visitor_team?.abbreviation ?? null;
      const homeName = game?.home_team?.full_name ?? game?.home_team?.name ?? null;
      const awayName = game?.visitor_team?.full_name ?? game?.visitor_team?.name ?? null;

      return {
        provider: 'balldontlie',
        provider_game_id: providerGameId,
        season: String(game?.season ?? ''),
        status: String(game?.status ?? ''),
        game_date: formatGameDate(String(game?.date ?? ''), date),
        locked_at: null,
        home_team_id: normalizeTeamId(homeAbbr, game?.home_team?.id),
        away_team_id: normalizeTeamId(awayAbbr, game?.visitor_team?.id),
        home_team_abbr: homeAbbr,
        away_team_abbr: awayAbbr,
        home_team_name: homeName,
        away_team_name: awayName,
      };
    });

    const { error: upsertError } = await supabaseAdmin
      .from('games')
      .upsert(upserts, { onConflict: 'provider,provider_game_id' });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ synced: upserts.length });
  } catch (error) {
    console.error('[api/admin/sync-games][GET]', error);
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to sync games' },
      { status: 500 },
    );
  }
}
