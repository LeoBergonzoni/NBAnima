import { NextResponse, type NextRequest } from 'next/server';

import { listTeamPlayers } from '@/lib/providers';
import { upsertPlayers, type UpsertablePlayer } from '@/lib/db/upsertPlayers';
import { createAdminSupabaseClient, createServerSupabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TeamRow = Pick<
  Database['public']['Tables']['teams']['Row'],
  'id' | 'provider_team_id' | 'abbr' | 'name'
>;

type ExistingPlayer = Pick<
  Database['public']['Tables']['player']['Row'],
  'id' | 'provider_player_id' | 'team_id' | 'active'
>;

const SYNC_SOURCE = 'balldontlie:rosters';
const FOUR_DIGIT_YEAR = /^\d{4}$/;

const parseSeason = (sp: URLSearchParams) => {
  const param = sp.get('season');
  if (param && FOUR_DIGIT_YEAR.test(param)) {
    return Number(param);
  }
  const now = new Date();
  return now.getFullYear();
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

const startSyncRun = async (supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>) => {
  const { data, error } = await supabaseAdmin
    .from('sync_runs')
    .insert({ source: SYNC_SOURCE })
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
};

const finishSyncRun = async (
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  runId: string | null,
  payload: Partial<Database['public']['Tables']['sync_runs']['Row']>,
) => {
  if (!runId) {
    return;
  }

  await supabaseAdmin
    .from('sync_runs')
    .update({
      ...payload,
      run_finished_at: new Date().toISOString(),
    })
    .eq('id', runId);
};

export async function POST(request: NextRequest) {
  const season = parseSeason(request.nextUrl.searchParams);
  let supabaseAdmin: ReturnType<typeof createAdminSupabaseClient> | null = null;
  let syncRunId: string | null = null;

  try {
    const ensure = await ensureAdminUser();
    supabaseAdmin = ensure.supabaseAdmin;
    const { user, role } = ensure;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!user) {
      if (isProduction) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.warn('[sync-rosters] no session found (non-production), proceeding for debug');
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    syncRunId = await startSyncRun(supabaseAdmin);

    const { data: teams, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id, provider_team_id, abbr, name')
      .eq('provider', 'balldontlie')
      .not('provider_team_id', 'is', null);

    if (teamError) {
      throw teamError;
    }

    if (!teams || teams.length === 0) {
      throw new Error('No teams found with provider=balldontlie (check provider/provider_team_id)');
    }

    const { data: existingPlayers, error: existingError } = await supabaseAdmin
      .from('player')
      .select('id, provider_player_id, team_id, active')
      .eq('provider', 'balldontlie');

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
    let teamFailures = 0;
    let zeroRosters = 0;

    for (const team of teams ?? []) {
      const providerTeamId = Number(team.provider_team_id);
      if (!Number.isFinite(providerTeamId)) {
        teamFailures += 1;
        console.warn('[sync-rosters] skip team (invalid provider_team_id)', {
          teamId: team.id,
          provider_team_id: team.provider_team_id,
        });
        continue;
      }

      try {
        const roster = await listTeamPlayers(providerTeamId, season);
        const ids = new Set<string>();

        if (!roster || roster.length === 0) {
          zeroRosters += 1;
          console.warn('[sync-rosters] empty roster from provider', {
            teamId: team.id,
            provider_team_id: providerTeamId,
            season,
          });
          continue; // non deattiva nessuno, salta la squadra
        }

        roster.forEach((player) => {
          if (!player?.id) {
            return;
          }
          ids.add(player.id);
          upserts.push({
            provider: 'balldontlie',
            provider_player_id: player.id,
            team_id: team.id,
            first_name: player.firstName ?? player.fullName ?? 'N.',
            last_name: player.lastName ?? player.fullName ?? 'N.',
            position: player.position ?? null,
            active: true,
          });
        });

        rosterIdsByTeam.set(team.id, ids);
      } catch (error) {
        teamFailures += 1;
        console.warn('[sync-rosters] failed roster fetch for team', {
          teamId: team.id,
          provider_team_id: providerTeamId,
          error: (error as Error).message,
        });
      }
    }

    const deduped = Array.from(
      upserts.reduce<Map<string, UpsertablePlayer>>((map, player) => {
        map.set(`${player.provider}:${player.provider_player_id}`, player);
        return map;
      }, new Map()),
    ).map(([, player]) => player);

    const moveCandidates = deduped.filter((player) => {
      const existing = existingByProvider.get(player.provider_player_id);
      return existing && existing.team_id !== player.team_id;
    });

    const { data: upserted, error: upsertError } = await upsertPlayers(
      supabaseAdmin,
      deduped,
    );

    if (upsertError) {
      throw upsertError;
    }

    const idByProviderPlayer = new Map<string, string>();
    upserted?.forEach((row) => {
      idByProviderPlayer.set(row.provider_player_id, row.id);
    });

    // Log team changes
    const historyRows =
      moveCandidates
        .map((player) => {
          const existing = existingByProvider.get(player.provider_player_id);
          const playerId =
            idByProviderPlayer.get(player.provider_player_id) ?? existing?.id;
          if (!playerId || !existing) {
            return null;
          }
          return {
            player_id: playerId,
            from_team_id: existing.team_id,
            to_team_id: player.team_id,
          };
        })
        .filter(Boolean) ?? [];

    if (historyRows.length > 0) {
      const { error: historyError } = await supabaseAdmin
        .from('player_team_history')
        .insert(historyRows);

      if (historyError) {
        console.warn('[sync-rosters] failed to insert team history', historyError);
      }
    }

    // Deactivate players missing from each roster
    let deactivatedCount = 0;
    for (const [teamId, ids] of rosterIdsByTeam.entries()) {
      const existing = existingByTeam.get(teamId) ?? [];
      const missing = existing
        .filter((row) => !ids.has(row.provider_player_id))
        .map((row) => row.provider_player_id);

      if (missing.length === 0) {
        continue;
      }

      const { error: deactivateError, count } = await supabaseAdmin
        .from('player')
        .update({ active: false })
        .eq('provider', 'balldontlie')
        .eq('team_id', teamId)
        .in('provider_player_id', missing)
        .select('id', { count: 'exact', head: true });

      if (deactivateError) {
        console.warn('[sync-rosters] failed to deactivate players', {
          teamId,
          missingCount: missing.length,
          error: deactivateError.message,
        });
      } else if (typeof count === 'number') {
        deactivatedCount += count;
      }
    }

    await finishSyncRun(supabaseAdmin, syncRunId, {
      status: 'ok',
      success_count: deduped.length,
      failure_count: teamFailures,
      note: `season=${season}; moves=${historyRows.length}; deactivated=${deactivatedCount}; zeroRosters=${zeroRosters}`,
    });

    return NextResponse.json({
      season,
      teamsProcessed: teams?.length ?? 0,
      teamFailures,
      playersUpserted: deduped.length,
      playersMoved: historyRows.length,
      deactivated: deactivatedCount,
      syncRunId,
    });
  } catch (error) {
    if (supabaseAdmin && syncRunId) {
      await finishSyncRun(supabaseAdmin, syncRunId, {
        status: 'error',
        note: (error as Error).message,
      });
    }
    console.error('[api/admin/sync-rosters][POST]', error);
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to sync rosters' },
      { status: 500 },
    );
  }
}
