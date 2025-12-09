import { NextResponse, type NextRequest } from 'next/server';

import { fetchEspnRosters } from '@/lib/espn/rosters';
import { upsertPlayers, type UpsertablePlayer } from '@/lib/db/upsertPlayers';
import { createAdminSupabaseClient, createServerSupabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TeamRow = Pick<Database['public']['Tables']['teams']['Row'], 'id' | 'abbr'>;
type ExistingPlayer = Pick<
  Database['public']['Tables']['player']['Row'],
  'id' | 'provider_player_id' | 'team_id' | 'active'
>;

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
    .maybeSingle<{ role: string | null }>();

  if (profileError) {
    throw profileError;
  }

  return { supabaseAdmin, user, role: profile?.role ?? 'user' };
};

const splitFullName = (fullName: string) => {
  const cleaned = fullName.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { firstName: 'N.', lastName: 'N.' };
  }
  const tokens = cleaned.split(' ').filter(Boolean);
  if (tokens.length === 1) {
    return { firstName: tokens[0], lastName: tokens[0] };
  }
  const [first, ...rest] = tokens;
  return { firstName: first, lastName: rest.join(' ') || first };
};

const ABBR_FIXES: Record<string, string> = {
  NY: 'NYK',
  GS: 'GSW',
  WSH: 'WAS',
  NO: 'NOP',
  SA: 'SAS',
  UTAH: 'UTA',
};

export async function POST(request: NextRequest) {
  let supabaseAdmin: ReturnType<typeof createAdminSupabaseClient> | null = null;

  try {
    const ensure = await ensureAdminUser();
    supabaseAdmin = ensure.supabaseAdmin;
    const { user, role } = ensure;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!user) {
      if (isProduction) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.warn('[espn-rosters-sync] no session found (non-production), proceeding for debug');
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { teams: espnTeams, errors: fetchErrors } = await fetchEspnRosters();

    const { data: teamRows, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id, abbr');

    if (teamError) {
      throw teamError;
    }

    const teamByAbbr = new Map<string, TeamRow>();
    (teamRows ?? []).forEach((row) => {
      if (row.abbr) {
        teamByAbbr.set(row.abbr.toUpperCase(), row);
      }
    });

    const { data: existingPlayers, error: existingError } = await supabaseAdmin
      .from('player')
      .select('id, provider_player_id, team_id, active')
      .eq('provider', 'espn');

    if (existingError) {
      throw existingError;
    }

    const existingByProvider = new Map<string, ExistingPlayer>();
    const existingByTeam = new Map<string, ExistingPlayer[]>();

    (existingPlayers ?? []).forEach((row) => {
      existingByProvider.set(row.provider_player_id, row);
      const list = existingByTeam.get(row.team_id) ?? [];
      list.push(row);
      existingByTeam.set(row.team_id, list);
    });

    const upserts: UpsertablePlayer[] = [];
    const rosterIdsByTeam = new Map<string, Set<string>>();
    const missingTeams: string[] = [];

    espnTeams.forEach((team) => {
      const rawAbbr = (team.team.abbr || '').toUpperCase();
      const abbr = ABBR_FIXES[rawAbbr] ?? rawAbbr;
      const teamRow = teamByAbbr.get(abbr);
      if (!teamRow) {
        missingTeams.push(abbr || team.team.name || 'unknown');
        return;
      }

      const ids = new Set<string>();

      team.players.forEach((player) => {
        const providerPlayerId = player.id || `${abbr}-${player.fullName.replace(/\s+/g, '-')}`;
        ids.add(providerPlayerId);
        const { firstName, lastName } = splitFullName(player.fullName || providerPlayerId);
        upserts.push({
          provider: 'espn',
          provider_player_id: providerPlayerId,
          team_id: teamRow.id,
          first_name: firstName,
          last_name: lastName,
          position: player.position ?? null,
          active: true,
        });
      });

      rosterIdsByTeam.set(teamRow.id, ids);
    });

    const moveCandidates = upserts.filter((player) => {
      const existing = existingByProvider.get(player.provider_player_id);
      return existing && existing.team_id !== player.team_id;
    });

    const { data: upserted, error: upsertError } = await upsertPlayers(supabaseAdmin, upserts);

    if (upsertError) {
      throw upsertError;
    }

    const idByProviderPlayer = new Map<string, string>();
    upserted?.forEach((row) => {
      idByProviderPlayer.set(row.provider_player_id, row.id);
    });

    const historyRows = moveCandidates
      .map((player) => {
        const existing = existingByProvider.get(player.provider_player_id);
        const playerId = idByProviderPlayer.get(player.provider_player_id) ?? existing?.id;
        if (!playerId || !existing) {
          return null;
        }
        return {
          player_id: playerId,
          from_team_id: existing.team_id,
          to_team_id: player.team_id,
        };
      })
      .filter((row): row is { player_id: string; from_team_id: string; to_team_id: string } => Boolean(row));

    if (historyRows.length > 0) {
      const { error: historyError } = await supabaseAdmin.from('player_team_history').insert(historyRows);
      if (historyError) {
        console.warn('[espn-rosters-sync] failed to insert team history', historyError);
      }
    }

    let deactivatedCount = 0;
    for (const [teamId, ids] of rosterIdsByTeam.entries()) {
      const existing = existingByTeam.get(teamId) ?? [];
      const missing = existing
        .filter((row) => !ids.has(row.provider_player_id))
        .map((row) => row.provider_player_id);

      if (missing.length === 0) {
        continue;
      }

      const { data: deactivatedRows, error: deactivateError } = await supabaseAdmin
        .from('player')
        .update({ active: false })
        .eq('provider', 'espn')
        .eq('team_id', teamId)
        .in('provider_player_id', missing)
        .select('id');

      if (deactivateError) {
        console.warn('[espn-rosters-sync] failed to deactivate players', {
          teamId,
          missingCount: missing.length,
          error: deactivateError.message,
        });
      } else if (Array.isArray(deactivatedRows)) {
        deactivatedCount += deactivatedRows.length;
      }
    }

    return NextResponse.json({
      teamsProcessed: espnTeams.length,
      fetchErrors,
      missingTeams,
      playersUpserted: upserted?.length ?? 0,
      playersMoved: historyRows.length,
      deactivated: deactivatedCount,
    });
  } catch (error) {
    console.error('[api/admin/rosters/espn/sync][POST]', error);
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to sync ESPN rosters' },
      { status: 500 },
    );
  }
}
