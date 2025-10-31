import { NextRequest, NextResponse } from 'next/server';
import { fromZonedTime } from 'date-fns-tz';
import { z } from 'zod';

import { supabaseAdmin } from '@/lib/supabase';
import { TIMEZONES } from '@/lib/constants';
import type { TablesInsert } from '@/lib/supabase.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ClientTeamDTO = {
  abbr?: string | null;
  providerTeamId?: string | null;
  name?: string | null;
};

type ClientGameDTO = {
  provider: 'bdl';
  providerGameId: string;
  season: string;
  status: string;
  dateNY: string;
  startTimeUTC?: string | null;
  home: ClientTeamDTO;
  away: ClientTeamDTO;
};

const clientTeamSchema = z.object({
  abbr: z.string().min(1).optional(),
  providerTeamId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
});

const clientGameSchema: z.ZodType<ClientGameDTO> = z.object({
  provider: z.literal('bdl'),
  providerGameId: z.string().min(1),
  season: z.string().min(1),
  status: z.string().min(1),
  dateNY: z
    .string()
    .regex(DATE_REGEX, { message: 'dateNY must be YYYY-MM-DD' }),
  startTimeUTC: z
    .union([z.string().min(1), z.null()])
    .optional(),
  home: clientTeamSchema,
  away: clientTeamSchema,
});

const requestSchema = z.object({
  date: z.string().regex(DATE_REGEX, { message: 'date must be YYYY-MM-DD' }),
  games: z.array(clientGameSchema),
});

const isUuidLike = (value: unknown): value is string =>
  typeof value === 'string' && UUID_REGEX.test(value);

const normalizeTeamAbbr = (abbr?: string | null) =>
  typeof abbr === 'string' ? abbr.trim().toUpperCase() : '';

const parseIsoDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getGameDateIso = (game: ClientGameDTO) => {
  const startTimeIso = parseIsoDate(game.startTimeUTC ?? null);
  if (startTimeIso) {
    return startTimeIso;
  }

  const zoned = fromZonedTime(`${game.dateNY}T00:00:00`, TIMEZONES.US_EASTERN);
  return zoned.toISOString();
};

const collectTeamLookup = async (games: ClientGameDTO[]) => {
  const providerTeamIds = new Set<string>();
  const abbrs = new Set<string>();

  const registerTeam = (team: ClientTeamDTO | undefined | null) => {
    if (!team) {
      return;
    }

    const providerTeamId = team.providerTeamId?.trim();
    if (providerTeamId && !isUuidLike(providerTeamId)) {
      providerTeamIds.add(providerTeamId);
    }

    const abbr = normalizeTeamAbbr(team.abbr);
    if (abbr) {
      abbrs.add(abbr);
    }
  };

  games.forEach((game) => {
    registerTeam(game.home);
    registerTeam(game.away);
  });

  const byProviderTeamId = new Map<string, string>();
  const byAbbr = new Map<string, string>();

  if (providerTeamIds.size > 0) {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('id, provider_team_id, abbr')
      .eq('provider', 'bdl')
      .in('provider_team_id', Array.from(providerTeamIds));

    if (error) {
      throw error;
    }

    (data ?? []).forEach((team) => {
      if (team.provider_team_id) {
        byProviderTeamId.set(team.provider_team_id, team.id);
      }
      if (team.abbr) {
        byAbbr.set(normalizeTeamAbbr(team.abbr), team.id);
      }
    });
  }

  const abbrsToFetch = Array.from(abbrs).filter((abbr) => !byAbbr.has(abbr));
  if (abbrsToFetch.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('id, provider_team_id, abbr')
      .eq('provider', 'bdl')
      .in('abbr', abbrsToFetch);

    if (error) {
      throw error;
    }

    (data ?? []).forEach((team) => {
      if (team.provider_team_id) {
        byProviderTeamId.set(team.provider_team_id, team.id);
      }
      if (team.abbr) {
        byAbbr.set(normalizeTeamAbbr(team.abbr), team.id);
      }
    });
  }

  return { byProviderTeamId, byAbbr };
};

const resolveTeamId = (
  team: ClientTeamDTO | undefined | null,
  lookup: Awaited<ReturnType<typeof collectTeamLookup>>,
) => {
  if (!team) {
    return null;
  }

  const providerTeamId = team.providerTeamId?.trim();
  if (providerTeamId) {
    if (isUuidLike(providerTeamId)) {
      return providerTeamId;
    }

    const mapped = lookup.byProviderTeamId.get(providerTeamId);
    if (mapped) {
      return mapped;
    }
  }

  const abbr = normalizeTeamAbbr(team.abbr);
  if (abbr) {
    const mapped = lookup.byAbbr.get(abbr);
    if (mapped) {
      return mapped;
    }
  }

  return null;
};

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { games } = parsed.data;

    if (games.length === 0) {
      return NextResponse.json({ ok: true, count: 0, games: [], warnings: [] });
    }

    const lookup = await collectTeamLookup(games);
    const warnings: { providerGameId: string; reason: string }[] = [];
    const nowIso = new Date().toISOString();

    const upserts: TablesInsert<'games'>[] = [];

    games.forEach((game) => {
      const homeTeamId = resolveTeamId(game.home, lookup);
      const awayTeamId = resolveTeamId(game.away, lookup);

      if (!homeTeamId || !awayTeamId) {
        const missingSides: string[] = [];
        if (!homeTeamId) {
          missingSides.push('home');
        }
        if (!awayTeamId) {
          missingSides.push('away');
        }

        warnings.push({
          providerGameId: game.providerGameId,
          reason: `Unable to resolve ${missingSides.join(' & ')} team`,
        });
        return;
      }

      upserts.push({
        provider: game.provider,
        provider_game_id: game.providerGameId,
        season: game.season,
        status: game.status,
        game_date: getGameDateIso(game),
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_team_abbr: game.home.abbr ?? null,
        home_team_name: game.home.name ?? null,
        away_team_abbr: game.away.abbr ?? null,
        away_team_name: game.away.name ?? null,
        updated_at: nowIso,
      });
    });

    let rows:
      | {
          id: string;
          provider_game_id: string;
          home_team_abbr: string | null;
          away_team_abbr: string | null;
          game_date: string;
          status: string;
        }[]
      | null = [];

    if (upserts.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('games')
        .upsert(upserts, { onConflict: 'provider,provider_game_id' })
        .select('id, provider_game_id, home_team_abbr, away_team_abbr, game_date, status');

      if (error) {
        throw error;
      }

      rows = data;
    }

    const responseGames = (rows ?? []).map((row) => ({
      id: row.id,
      providerGameId: row.provider_game_id,
      home_abbr: row.home_team_abbr,
      away_abbr: row.away_team_abbr,
      game_date: row.game_date,
      status: row.status,
    }));

    const status = warnings.length > 0 ? 207 : 200;

    return NextResponse.json(
      {
        ok: true,
        count: responseGames.length,
        games: responseGames,
        warnings,
      },
      { status },
    );
  } catch (error) {
    console.error('[api/games/upsert-batch][POST]', error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message ?? 'Failed to upsert games' },
      { status: 500 },
    );
  }
}
