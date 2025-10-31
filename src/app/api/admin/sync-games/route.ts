import { createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabaseClient, createServerSupabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type BalldontlieHost = {
  baseUrl: string;
  requiresKey: boolean;
};

const BDL_HOSTS: BalldontlieHost[] = [
  { baseUrl: 'https://api.balldontlie.io/api/v1', requiresKey: true },
  { baseUrl: 'https://www.balldontlie.io/api/v1', requiresKey: false },
  { baseUrl: 'https://balldontlie.io/api/v1', requiresKey: false },
];

const DATE_REGEXP = /^\d{4}-\d{2}-\d{2}$/;

const stableUuidFromString = (value: string) => {
  const hash = createHash('sha1').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

const normalizeTeamId = (abbr?: string | null, fallbackId?: number | string | null) => {
  const key = (abbr ?? fallbackId ?? '').toString().trim().toLowerCase();
  if (!key) {
    throw new Error('Missing team identifier from balldontlie payload');
  }
  return stableUuidFromString(`team:${key}`);
};

const formatGameDate = (dateIso: string, fallbackDate: string) => {
  const parsed = new Date(dateIso);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  const fallback = new Date(`${fallbackDate}T00:00:00Z`);
  return Number.isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
};

const getDateParam = (sp: URLSearchParams) => {
  const directDate = sp.get('date');
  if (directDate !== null) {
    if (!DATE_REGEXP.test(directDate)) {
      throw new Error('Missing or invalid date parameter (expected YYYY-MM-DD)');
    }
    return directDate;
  }

  const datesArrayValues = sp.getAll('dates[]');
  if (datesArrayValues.length > 0) {
    const value = datesArrayValues[0];
    if (!DATE_REGEXP.test(value)) {
      throw new Error('Missing or invalid date parameter (expected YYYY-MM-DD)');
    }
    return value;
  }

  const singleDates = sp.getAll('dates');
  if (singleDates.length > 0) {
    const value = singleDates[0];
    if (!DATE_REGEXP.test(value)) {
      throw new Error('Missing or invalid date parameter (expected YYYY-MM-DD)');
    }
    return value;
  }

  return null;
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

  return { supabaseAdmin, user, role: profile?.role ?? 'user' };
};

const warnHostFailure = (host: BalldontlieHost, url: string, status?: number, error?: Error) => {
  if (error) {
    console.warn('[sync-games] host request failed', {
      host: host.baseUrl,
      url,
      error: error.message,
    });
    return;
  }

  console.warn('[sync-games] host response not ok', {
    host: host.baseUrl,
    url,
    status,
  });
};

async function fetchFromAnyHost(
  path: string,
  options: { preferredHost?: BalldontlieHost; acceptStatuses?: number[] } = {},
) {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  const acceptStatuses = new Set(options.acceptStatuses ?? []);
  const attempted = new Set<string>();

  const preferredHost = options.preferredHost;
  const orderedHosts = preferredHost
    ? [preferredHost, ...BDL_HOSTS.filter((host) => host.baseUrl !== preferredHost.baseUrl)]
    : [...BDL_HOSTS];

  let lastError: Error | null = null;

  for (const host of orderedHosts) {
    if (attempted.has(host.baseUrl)) {
      continue;
    }
    attempted.add(host.baseUrl);

    if (host.requiresKey && !apiKey) {
      console.warn('[sync-games] skipping host (missing API key)', {
        host: host.baseUrl,
        path,
      });
      continue;
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    if (host.requiresKey && apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const url = `${host.baseUrl}${path}`;
    let response: Response;

    try {
      response = await fetch(url, { headers, cache: 'no-store' });
    } catch (fetchError) {
      warnHostFailure(host, url, undefined, fetchError as Error);
      lastError = fetchError as Error;
      continue;
    }

    if (response.ok) {
      return { host, response };
    }

    warnHostFailure(host, url, response.status);

    if (acceptStatuses.has(response.status)) {
      return { host, response };
    }

    lastError = new Error(`Host ${host.baseUrl} returned ${response.status}`);
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`All balldontlie hosts failed for path ${path}`);
}

const parseNextPage = (value: unknown, currentPage: number) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > currentPage) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && numeric > currentPage) {
      return numeric;
    }
  }
  return null;
};

async function fetchGamesForDate(date: string) {
  const games: any[] = [];
  let page = 1;
  let activeHost: BalldontlieHost | undefined;

  while (true) {
    const pathWithDates = `/games?per_page=100&page=${page}&dates[]=${encodeURIComponent(date)}`;
    const primary = await fetchFromAnyHost(pathWithDates, {
      preferredHost: activeHost,
      acceptStatuses: [404, 422],
    });

    let { host, response } = primary;
    activeHost = host;

    if (response.status === 404 || response.status === 422) {
      const fallbackPath = `/games?per_page=100&page=${page}&start_date=${date}&end_date=${date}`;
      try {
        const fallback = await fetchFromAnyHost(fallbackPath, {
          preferredHost: host,
          acceptStatuses: [404],
        });
        host = fallback.host;
        response = fallback.response;
        activeHost = host;
      } catch (sameHostError) {
        const fallback = await fetchFromAnyHost(fallbackPath, {
          acceptStatuses: [404],
        });
        host = fallback.host;
        response = fallback.response;
        activeHost = host;
      }
    }

    if (response.status === 404) {
      console.warn('[sync-games] no games found for date', {
        host: host.baseUrl,
        date,
        page,
      });
      break;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch games from balldontlie (status ${response.status})`);
    }

    const payload = await response.json();
    const data = Array.isArray(payload?.data) ? payload.data : [];
    games.push(...data);

    const nextPage = parseNextPage(payload?.meta?.next_page, page);
    if (!nextPage) {
      break;
    }
    page = nextPage;
  }

  return games;
}

export async function GET(request: NextRequest) {
  try {
    const date = getDateParam(request.nextUrl.searchParams);
    if (!date) {
      return NextResponse.json(
        { error: 'Missing or invalid date parameter (expected YYYY-MM-DD)' },
        { status: 400 },
      );
    }

    const { supabaseAdmin, user, role } = await ensureAdminUser();
    const isProduction = process.env.NODE_ENV === 'production';

    if (!user) {
      if (isProduction) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      console.warn('[sync-games] no session found in non-production environment, proceeding for debug');
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const games = await fetchGamesForDate(date);
    if (games.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    const upserts: Database['public']['Tables']['games']['Insert'][] = games.map((game: any) => {
      const providerGameId = game?.id;
      if (!providerGameId) {
        throw new Error('Missing balldontlie game id');
      }

      const homeTeam = game?.home_team ?? {};
      const visitorTeam = game?.visitor_team ?? {};

      const homeAbbr = homeTeam?.abbreviation ?? null;
      const awayAbbr = visitorTeam?.abbreviation ?? null;
      const homeName = homeTeam?.full_name ?? homeTeam?.name ?? null;
      const awayName = visitorTeam?.full_name ?? visitorTeam?.name ?? null;

      return {
        provider: 'balldontlie',
        provider_game_id: String(providerGameId),
        season: String(game?.season ?? ''),
        status: String(game?.status ?? ''),
        game_date: formatGameDate(String(game?.date ?? ''), date),
        locked_at: null,
        home_team_id: normalizeTeamId(homeAbbr, homeTeam?.id),
        away_team_id: normalizeTeamId(awayAbbr, visitorTeam?.id),
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
