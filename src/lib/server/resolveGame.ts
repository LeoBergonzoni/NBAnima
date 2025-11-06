import { fromZonedTime } from 'date-fns-tz';

import { createAdminSupabaseClient } from '@/lib/supabase';
import { TIMEZONES } from '@/lib/constants';

type SupabaseAdminClient = ReturnType<typeof createAdminSupabaseClient>;

export type ClientGameDTO = {
  provider: 'bdl';
  providerGameId: string;
  season: string;
  status: string;
  dateNY: string;
  startTimeUTC?: string | null;
  home: { abbr?: string; providerTeamId?: string; name?: string };
  away: { abbr?: string; providerTeamId?: string; name?: string };
};

const BDL_PROVIDER = 'bdl';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value?: string | null): value is string =>
  Boolean(value && UUID_REGEX.test(value));

const normalizeAbbr = (abbr?: string | null) =>
  typeof abbr === 'string' ? abbr.trim().toUpperCase() : '';

const parseStartTime = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const computeGameDate = (dto: ClientGameDTO) => {
  const startIso = parseStartTime(dto.startTimeUTC);
  if (startIso) {
    return startIso;
  }
  // Fallback: convert la mezzanotte US/Eastern in UTC, così game_date mantiene origine America/New_York.
  const midnightNy = fromZonedTime(`${dto.dateNY}T00:00:00`, TIMEZONES.US_EASTERN);
  return midnightNy.toISOString();
};

const fetchTeamId = async (
  supabaseAdmin: SupabaseAdminClient,
  team: ClientGameDTO['home'],
): Promise<string> => {
  if (!team) {
    throw new Error('TEAM_NOT_FOUND');
  }

  const providerTeamId = team.providerTeamId?.trim();
  if (providerTeamId) {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('provider', BDL_PROVIDER)
      .eq('provider_team_id', providerTeamId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (data?.id) {
      return data.id;
    }
  }

  const abbr = normalizeAbbr(team.abbr);
  if (abbr) {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('provider', BDL_PROVIDER)
      .eq('abbr', abbr)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (data?.id) {
      return data.id;
    }
  }

  throw new Error('TEAM_NOT_FOUND');
};

export async function resolveOrUpsertGame({
  supabaseAdmin,
  gameId,
  gameProvider,
  providerGameId,
  dto,
}: {
  supabaseAdmin: SupabaseAdminClient;
  gameId?: string;
  gameProvider?: 'bdl';
  providerGameId?: string;
  dto?: ClientGameDTO;
}): Promise<{ id: string }> {
  const provider = gameProvider ?? dto?.provider ?? BDL_PROVIDER;

  if (gameId && isUuid(gameId)) {
    const { data, error } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('id', gameId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (data?.id) {
      return { id: data.id };
    }
  }

  if (provider === BDL_PROVIDER && providerGameId) {
    const { data, error } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('provider', BDL_PROVIDER)
      .eq('provider_game_id', providerGameId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (data?.id) {
      return { id: data.id };
    }
  }

  if (dto && provider === BDL_PROVIDER) {
    const safeProviderGameId = dto.providerGameId || providerGameId;
    if (!safeProviderGameId) {
      throw new Error('GAME_NOT_FOUND');
    }

    const homeTeamId = await fetchTeamId(supabaseAdmin, dto.home);
    const awayTeamId = await fetchTeamId(supabaseAdmin, dto.away);

    const gameDate = computeGameDate(dto);
    const nowIso = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('games')
      .upsert(
        {
          provider: BDL_PROVIDER,
          provider_game_id: safeProviderGameId,
          season: dto.season,
          status: dto.status,
          game_date: gameDate,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_team_abbr: dto.home.abbr ?? null,
          home_team_name: dto.home.name ?? null,
          away_team_abbr: dto.away.abbr ?? null,
          away_team_name: dto.away.name ?? null,
          updated_at: nowIso,
        },
        { onConflict: 'provider,provider_game_id' },
      )
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return { id: data.id };
  }

  throw new Error('GAME_NOT_FOUND');
}
