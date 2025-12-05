import { NextResponse, type NextRequest } from 'next/server';

import { createAdminSupabaseClient, createServerSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ESPN_BASE = 'https://www.espn.com';
const TEAMS_URL = `${ESPN_BASE}/nba/teams`;

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

const stripTags = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const decodeEntities = (value: string) => {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&#38;': '&',
    '&apos;': "'",
    '&#x27;': "'",
    '&#39;': "'",
    '&quot;': '"',
    '&#34;': '"',
    '&lt;': '<',
    '&#60;': '<',
    '&gt;': '>',
    '&#62;': '>',
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match) => entities[match.toLowerCase()] ?? match);
};

const normalizeName = (raw: string) => {
  const decoded = decodeEntities(raw).trim();
  // Se il numero di maglia è attaccato al cognome, inserisci uno spazio (es. Walter14 -> Walter 14)
  const spaced = decoded.replace(/([A-Za-z])(\d{1,3})$/, '$1 $2');
  return spaced;
};

const extractRosterLinks = (html: string): string[] => {
  const links = new Set<string>();
  const regex = /href="([^"]*?\/team\/roster\/[^"]*?)"[^>]*>Roster</gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const absolute = href.startsWith('http') ? href : `${ESPN_BASE}${href}`;
    links.add(absolute);
  }
  return Array.from(links);
};

type ParsedRoster = {
  team: { name: string; abbr: string; id: string };
  players: Array<{ id: string; fullName: string; position: string | null; jersey: string | null }>;
};

const parseRosterPage = (html: string, url: string): ParsedRoster => {
  // Team abbr dal path
  const abbrMatch = /\/name\/([a-z0-9-]+)/i.exec(url);
  const abbr = abbrMatch ? abbrMatch[1]?.toUpperCase().replace(/-/g, '') : '';

  // Team name dall'h1
  let teamName = '';
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1Match) {
    teamName = stripTags(h1Match[1]).replace(/Roster\s+\d{4}-\d{2}/, '').trim();
  }

  // Prima tabella nel markup
  const tableMatch = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!tableMatch) {
    return { team: { name: teamName, abbr, id: abbr }, players: [] };
  }

  const tableHtml = tableMatch[1];
  const headerCells = Array.from(tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map((m) =>
    stripTags(m[1]),
  );

  const colIndex = (name: string) => {
    const idx = headerCells.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return idx >= 0 ? idx : null;
  };

  const idxName = colIndex('Name');
  const idxPos = colIndex('POS');

  const rows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
  const players: ParsedRoster['players'] = [];

  rows.forEach((rowMatch) => {
    const rowHtml = rowMatch[1];
    const cells = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) =>
      stripTags(m[1]),
    );
    if (!cells.length) return;
    const name = idxName !== null ? cells[idxName] ?? '' : cells[0] ?? '';
    const pos = idxPos !== null ? cells[idxPos] ?? '' : '';
    if (!name) return;
    const cleanName = normalizeName(name);
    players.push({
      id: cleanName.toLowerCase().replace(/\s+/g, '-'),
      fullName: cleanName,
      position: pos || null,
      jersey: null,
    });
  });

  return { team: { name: teamName, abbr, id: abbr }, players };
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

    const teamsPage = await fetch(TEAMS_URL, { cache: 'no-store' });
    if (!teamsPage.ok) {
      const text = await teamsPage.text().catch(() => '');
      throw new Error(`Failed to fetch teams page: ${teamsPage.status} ${text || teamsPage.statusText}`);
    }
    const teamsHtml = await teamsPage.text();
    const rosterLinks = extractRosterLinks(teamsHtml);

    if (!rosterLinks.length) {
      throw new Error('No roster links found on ESPN teams page');
    }

    const results = await Promise.all(
      rosterLinks.map(async (link) => {
        try {
          const res = await fetch(link, { cache: 'no-store' });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Roster fetch failed ${res.status}: ${text || res.statusText}`);
          }
          const html = await res.text();
          return parseRosterPage(html, link);
        } catch (error) {
          return { team: { name: link, abbr: '', id: '' }, players: [], error: (error as Error).message };
        }
      }),
    );

    const successes = results.filter((r) => !(r as { error?: string }).error);
    const errors = results
      .filter((r) => (r as { error?: string }).error)
      .map((r) => ({ team: (r as ParsedRoster).team, error: (r as { error: string }).error }));

    return NextResponse.json({
      season: 'current',
      teams: successes,
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
