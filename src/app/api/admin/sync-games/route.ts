import { createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabaseClient, createServerSupabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// UUID stabile da stringa (per team_id derivati da abbr/id di balldontlie)
const stableUuidFromString = (value: string) => {
  const hash = createHash('sha1').update(value).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
};

const ensureAdminUser = async () => {
  const supabaseAdmin = createAdminSupabaseClient();
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;

  if (!user) return { supabaseAdmin, user: null, role: null };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  return { supabaseAdmin, user, role: profile?.role ?? 'user' };
};

// Fetch unico con fallback: prima dates[]=, se 404 passa a start_date/end_date
async function fetchBalldontlieGamesForDate(date: string) {
  const BL = 'https://www.balldontlie.io/api/v1/games';
  const all: any[] = [];
  let page = 1;

  while (true) {
    // 1) prefer dates[] (official)
    let url = `${BL}?per_page=100&page=${page}&dates[]=${encodeURIComponent(date)}`;
    let r = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });

    // 2) fallback to start/end if the API/proxy returns 404/422/etc
    if (!r.ok) {
      url = `${BL}?per_page=100&page=${page}&start_date=${date}&end_date=${date}`;
      r = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
    }

    if (!r.ok) {
      throw new Error(`Failed to fetch games from balldontlie (status ${r.status})`);
    }

    const j = await r.json();
    all.push(...(j?.data ?? []));

    const next = j?.meta?.next_page;
    if (!next) break;
    page = Number(next);
  }

  return all;
}

const formatGameDate = (dateIso: string, fallbackDate: string) => {
  const parsed = new Date(dateIso);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const fallback = new Date(`${fallbackDate}T00:00:00Z`);
  return Number.isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
};

const normalizeTeamId = (abbr?: string | null, fallbackId?: number | string | null) => {
  const key = (abbr ?? fallbackId ?? '').toString().trim().toLowerCase();
  if (!key) throw new Error('Missing team identifier from balldontlie payload');
  return stableUuidFromString(`team:${key}`);
};

export async function GET(request: NextRequest) {
  try {
    // ?date=YYYY-MM-DD
    const sp = request.nextUrl.searchParams;
const date = sp.get('date') ?? sp.get('dates') ?? sp.get('dates[]'); // accept all
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  return NextResponse.json(
    { error: 'Missing or invalid date parameter (expected YYYY-MM-DD)' },
    { status: 400 },
      );
    }

    const { supabaseAdmin, user, role } = await ensureAdminUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // fetch con fallback
    const games = await fetchBalldontlieGamesForDate(date);
    if (games.length === 0) return NextResponse.json({ synced: 0 });

    // Prepara upsert verso la tabella public.games (assumi colonne extra già create)
    const upserts: Database['public']['Tables']['games']['Insert'][] = games.map((g: any) => {
      const providerGameId = String(g?.id ?? '');
      if (!providerGameId) throw new Error('Missing balldontlie game id');

      const homeAbbr = g?.home_team?.abbreviation ?? null;
      const awayAbbr = g?.visitor_team?.abbreviation ?? null;
      const homeName = g?.home_team?.full_name ?? g?.home_team?.name ?? null;
      const awayName = g?.visitor_team?.full_name ?? g?.visitor_team?.name ?? null;

      return {
        provider: 'balldontlie',
        provider_game_id: providerGameId,
        season: String(g?.season ?? ''),
        status: String(g?.status ?? ''),
        game_date: formatGameDate(String(g?.date ?? ''), date),
        locked_at: null,
        home_team_id: normalizeTeamId(homeAbbr, g?.home_team?.id),
        away_team_id: normalizeTeamId(awayAbbr, g?.visitor_team?.id),
        home_team_abbr: homeAbbr,
        away_team_abbr: awayAbbr,
        home_team_name: homeName,
        away_team_name: awayName,
      };
    });

    // ATTENZIONE: deve esistere un vincolo UNIQUE su (provider, provider_game_id)
    const { error: upsertError } = await supabaseAdmin
      .from('games')
      .upsert(upserts, { onConflict: 'provider,provider_game_id' });

    if (upsertError) throw upsertError;

    return NextResponse.json({ synced: upserts.length });
  } catch (error) {
    console.error('[api/admin/sync-games][GET]', error);
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to sync games' },
      { status: 500 },
    );
  }
}