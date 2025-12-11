'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { Locale } from '@/lib/constants';
import { getSlateBoundsUtc } from '@/lib/date-us-eastern';
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';
import { computeDailyScore } from '@/lib/scoring';
import { ADMIN_POINT_STEP } from '@/lib/admin';
import { upsertPlayers, type UpsertablePlayer } from '@/lib/db/upsertPlayers';
import { getEspnPlayersForTeams } from '@/server/services/players.service';
import { getWeeklyRankingCurrent } from '@/server/services/xp.service';

interface BalanceInput {
  userId: string;
  delta?: number;
  reason?: string;
  locale: Locale;
}

const LEDGER_TABLE =
  'anima_points_ledger' as keyof Database['public']['Tables'] & string;
const USERS_TABLE =
  'users' as keyof Database['public']['Tables'] & string;
const USER_CARDS_TABLE =
  'user_cards' as keyof Database['public']['Tables'] & string;
const RESULTS_HIGHLIGHTS_TABLE =
  'results_highlights' as keyof Database['public']['Tables'] & string;

type LedgerInsert =
  Database['public']['Tables']['anima_points_ledger']['Insert'];
type UsersUpdate = Database['public']['Tables']['users']['Update'];
type UsersInsert = Database['public']['Tables']['users']['Insert'];
type UserBalanceRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'anima_points_balance'
>;
type UserCardsInsert = Database['public']['Tables']['user_cards']['Insert'];
type ResultsHighlightsInsert =
  Database['public']['Tables']['results_highlights']['Insert'];

const DATE_SCHEMA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

const dayRangeForDate = (dateNY: string) => getSlateBoundsUtc(dateNY);

const settlementReason = (dateNY: string) => `settlement:${dateNY}`;

const SAFE_UUID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_PLAYER_CATEGORIES = [
  'top_scorer',
  'top_assist',
  'top_rebound',
] as const;

const POINT_STEP = ADMIN_POINT_STEP;

type GameRow = Database['public']['Tables']['games']['Row'];
type TeamResultRow = Database['public']['Tables']['results_team']['Row'];
type PlayerResultRow = Database['public']['Tables']['results_players']['Row'];
type TeamPickRow = Database['public']['Tables']['picks_teams']['Row'];
type PlayerPickRow = Database['public']['Tables']['picks_players']['Row'];
type HighlightPickRow = Database['public']['Tables']['picks_highlights']['Row'];
type HighlightResultRow =
  Database['public']['Tables']['results_highlights']['Row'];
type LedgerRow = Database['public']['Tables']['anima_points_ledger']['Row'];
type UserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'email' | 'anima_points_balance'
>;
type PlayerCategoryEnum = Database['public']['Enums']['player_category'];

export type TeamWinnerRow = {
  id: string;
  status: string;
  homeTeam: {
    id: string;
    abbr: string | null;
    name: string | null;
  };
  awayTeam: {
    id: string;
    abbr: string | null;
    name: string | null;
  };
  winnerTeamId: string | null;
  settledAt: string | null;
};

export type LoadTeamWinnersResult = {
  date: string;
  games: TeamWinnerRow[];
};

export type PlayerWinnerOption = {
  value: string;
  label: string;
  meta?: {
    position?: string | null;
    providerPlayerId?: string | null;
    teamAbbr?: string | null;
  };
};

export type PlayerWinnerCategoryRow = {
  category: string;
  winnerPlayerIds: string[];
  settledAt: string | null;
  options: PlayerWinnerOption[];
};

export type PlayerWinnerGameRow = {
  id: string;
  status: string;
  homeTeam: {
    id: string;
    abbr: string | null;
    name: string | null;
  };
  awayTeam: {
    id: string;
    abbr: string | null;
    name: string | null;
  };
  categories: PlayerWinnerCategoryRow[];
};

export type LoadPlayerWinnersResult = {
  date: string;
  games: PlayerWinnerGameRow[];
};

type AdminPlayerSelection = {
  id: string;
  label?: string;
  source?: 'supabase' | 'roster';
  providerPlayerId?: string | null;
  teamAbbr?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  supabaseId?: string | null;
};

const PLAYER_PROVIDER = 'local-rosters';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const teamIdCache = new Map<string, string>();
const providerPlayerIdCache = new Map<string, string>();

const isUuid = (value: string | null | undefined) =>
  Boolean(value && UUID_REGEX.test(value));

const extractTeamAbbr = (label?: string | null): string | null => {
  if (!label) {
    return null;
  }
  const [namePart, teamPart] = label.split('—').map((part) => part.trim());
  if (!teamPart) {
    return null;
  }
  const cleaned = teamPart.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (cleaned.length >= 3) {
    return cleaned.slice(0, 3);
  }
  if (namePart) {
    const parts = namePart.split(/\s+/).filter(Boolean);
    if (parts.length >= 1) {
      return parts[0]!.slice(0, 3).toUpperCase();
    }
  }
  return null;
};

const normalizeNameParts = (selection: AdminPlayerSelection) => {
  const first = selection.firstName?.trim();
  const last = selection.lastName?.trim();

  if (first || last) {
    return {
      first: first && first.length > 0 ? first : last ?? 'N.',
      last: last && last.length > 0 ? last : first ?? 'N.',
    };
  }

  const base = selection.label
    ? selection.label.split('—')[0]?.trim()
    : selection.providerPlayerId ?? selection.id;

  if (!base) {
    return { first: 'N.', last: 'N.' };
  }

  const tokens = base.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { first: 'N.', last: 'N.' };
  }
  if (tokens.length === 1) {
    return { first: tokens[0]!, last: tokens[0]! };
  }
  const [firstToken, ...rest] = tokens;
  const lastToken = rest.join(' ') || firstToken;
  return { first: firstToken, last: lastToken };
};

const getTeamIdByAbbr = async (abbr: string): Promise<string> => {
  const key = abbr.trim().toUpperCase();
  if (teamIdCache.has(key)) {
    return teamIdCache.get(key)!;
  }
  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('abbr', key)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error(`Nessuna squadra trovata per l'abbreviazione "${key}"`);
  }

  teamIdCache.set(key, data.id);
  return data.id;
};

const ensurePlayerUuid = async (
  selection: AdminPlayerSelection,
): Promise<string> => {
  if (!selection) {
    throw new Error('Player selection is required');
  }

  const immediate = selection.supabaseId ?? selection.id;
  if (isUuid(immediate)) {
    return immediate!;
  }

  const providerId = selection.providerPlayerId ?? selection.id;
  if (!providerId) {
    throw new Error('Missing providerPlayerId for player selection');
  }

  if (providerPlayerIdCache.has(providerId)) {
    return providerPlayerIdCache.get(providerId)!;
  }

  const teamAbbr =
    selection.teamAbbr?.toUpperCase() ?? extractTeamAbbr(selection.label);

  if (!teamAbbr) {
    throw new Error(
      `Impossibile determinare la squadra per il giocatore "${providerId}"`,
    );
  }

  const teamId = await getTeamIdByAbbr(teamAbbr);
  const { first, last } = normalizeNameParts(selection);
  const position = selection.position
    ? selection.position.toUpperCase()
    : null;
  const upsertPayload: UpsertablePlayer = {
    provider: PLAYER_PROVIDER,
    provider_player_id: providerId,
    team_id: teamId,
    first_name: first || 'N.',
    last_name: last || 'N.',
    position,
  };
  const { data, error } = await upsertPlayers(supabaseAdmin, [upsertPayload]);
  if (error) {
    throw error;
  }
  const created = data?.find(
    (entry) =>
      entry.provider === PLAYER_PROVIDER &&
      entry.provider_player_id === providerId,
  );
  if (!created?.id) {
    throw new Error(`Creazione giocatore non riuscita per "${providerId}"`);
  }
  providerPlayerIdCache.set(providerId, created.id);
  return created.id;
};

const ensureAdminUser = async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!data || data.role !== 'admin') {
    throw new Error('Forbidden');
  }

  return user;
};

const fetchGamesForDate = async (dateNY: string): Promise<GameRow[]> => {
  const { start, end } = dayRangeForDate(dateNY);

  const { data, error } = await supabaseAdmin
    .from('games')
    .select('*')
    .gte('game_date', start)
    .lt('game_date', end)
    .order('game_date', { ascending: true })
    .returns<GameRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
};

const fetchTeamResultsForGames = async (
  gameIds: string[],
): Promise<TeamResultRow[]> => {
  if (gameIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('results_team')
    .select('*')
    .in('game_id', gameIds)
    .returns<TeamResultRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
};

const fetchPlayerResultsForGames = async (
  gameIds: string[],
): Promise<PlayerResultRow[]> => {
  if (gameIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('results_players')
    .select('*')
    .in('game_id', gameIds)
    .returns<PlayerResultRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
};

const fetchHighlightResultsForDate = async (dateNY: string) => {
  const { data, error } = await supabaseAdmin
    .from('results_highlights')
    .select('player_id, rank')
    .eq('result_date', dateNY);

  if (error) {
    throw error;
  }

  return (data ?? []) as HighlightResultRow[];
};

const fetchPlayerRecordsByIds = async (
  playerIds: string[],
): Promise<
  Map<
    string,
    {
      first_name: string | null;
      last_name: string | null;
      position: string | null;
      provider_player_id: string | null;
      team_abbr: string | null;
    }
  >
> => {
  if (playerIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from('player')
    .select('id, first_name, last_name, position, provider_player_id, team:team_id (abbr)')
    .in('id', Array.from(new Set(playerIds)));

  if (error) {
    throw error;
  }

  type PlayerRowWithTeam = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    provider_player_id: string | null;
    team?: { abbr?: string | null } | null;
  };
  const rows = (data ?? []) as PlayerRowWithTeam[];

  return new Map(
    rows.map((player) => [
      player.id,
      {
        first_name: player.first_name,
        last_name: player.last_name,
        position: player.position,
        provider_player_id: player.provider_player_id,
        team_abbr: (() => {
          const abbr = (player as { team?: { abbr?: string | null } | null }).team?.abbr;
          return abbr ? abbr.toUpperCase() : null;
        })(),
      },
    ]),
  );
};

async function fetchRosterOptionsForTeams(
  teamIds: string[],
): Promise<Map<string, PlayerWinnerOption[]>> {
  if (teamIds.length === 0) {
    return new Map();
  }

  // Source of truth: public.player rows with provider='espn'; key: player.id (UUID ESPN).
  const espnPlayers = await getEspnPlayersForTeams(
    supabaseAdmin,
    Array.from(new Set(teamIds)),
  );

  type PlayerRowWithTeam = {
    id: string;
    provider_player_id: string | null;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    team_id: string | null;
    team?: { abbr?: string | null } | null;
  };

  const rows = espnPlayers as PlayerRowWithTeam[];
  // Deduplicate by provider_player_id so the admin dropdown shows only canonical players.
  const canonicalByProvider = new Map<string, PlayerRowWithTeam>();
  rows.forEach((player) => {
    const providerKey = player.provider_player_id ?? player.id;
    if (!canonicalByProvider.has(providerKey)) {
      canonicalByProvider.set(providerKey, player);
    }
  });

  const byTeam = new Map<string, PlayerWinnerOption[]>();
  canonicalByProvider.forEach((player) => {
    if (!player.team_id) {
      return;
    }
    const teamAbbr = (() => {
      const abbr = (player as { team?: { abbr?: string | null } | null }).team?.abbr;
      return abbr ? abbr.toUpperCase() : null;
    })();
    const option: PlayerWinnerOption = {
      value: player.id,
      label: buildPlayerLabel(player, player.provider_player_id ?? player.id, teamAbbr),
      meta: {
        position: player.position ?? null,
        providerPlayerId: player.provider_player_id ?? null,
        teamAbbr,
      },
    };
    const existing = byTeam.get(player.team_id) ?? [];
    existing.push(option);
    byTeam.set(player.team_id, existing);
  });

  byTeam.forEach((options) => options.sort((a, b) => a.label.localeCompare(b.label)));
  return byTeam;
}

const buildPlayerLabel = (
  record:
    | {
        first_name?: string | null;
        last_name?: string | null;
      }
    | null
    | undefined,
  fallback: string,
  teamAbbr?: string | null,
) => {
  const first = record?.first_name ?? '';
  const last = record?.last_name ?? '';
  const label = `${first} ${last}`.trim() || fallback;
  if (teamAbbr) {
    return `${label} — ${teamAbbr.toUpperCase()}`;
  }
  return label;
};

const applySettlementForDate = async (dateNY: string) => {
  const pickDate = DATE_SCHEMA.parse(dateNY);
  const reason = settlementReason(pickDate);

  const [teamPicksResponse, playerPicksResponse, highlightPicksResponse, ledgerResponse] =
    await Promise.all([
      supabaseAdmin
        .from('picks_teams')
        .select('user_id, game_id, selected_team_id, pick_date')
        .eq('pick_date', pickDate),
      supabaseAdmin
        .from('picks_players')
        .select('user_id, game_id, category, player_id, pick_date')
        .eq('pick_date', pickDate),
      supabaseAdmin
        .from('picks_highlights')
        .select('user_id, player_id, rank, pick_date')
        .eq('pick_date', pickDate),
      supabaseAdmin
        .from('anima_points_ledger')
        .select('user_id, delta')
        .eq('reason', reason),
    ]);

  if (
    teamPicksResponse.error ||
    playerPicksResponse.error ||
    highlightPicksResponse.error ||
    ledgerResponse.error
  ) {
    throw (
      teamPicksResponse.error ??
      playerPicksResponse.error ??
      highlightPicksResponse.error ??
      ledgerResponse.error ??
      new Error('Failed to load settlement context')
    );
  }

  const teamPicks = (teamPicksResponse.data ?? []) as TeamPickRow[];
  const playerPicks = (playerPicksResponse.data ?? []) as PlayerPickRow[];
  const highlightPicks = (highlightPicksResponse.data ?? []) as HighlightPickRow[];
  const previousLedger = (ledgerResponse.data ?? []) as Pick<
    LedgerRow,
    'user_id' | 'delta'
  >[];

  const gameIds = Array.from(
    new Set(
      [...teamPicks, ...playerPicks].map((pick) => pick.game_id).filter(Boolean),
    ),
  );
  const safeGameIds = gameIds.length > 0 ? gameIds : [SAFE_UUID];

  const [teamResults, playerResults, highlightResults] = await Promise.all([
    fetchTeamResultsForGames(safeGameIds),
    fetchPlayerResultsForGames(safeGameIds),
    fetchHighlightResultsForDate(pickDate),
  ]);

  const previousDeltaByUser = new Map<string, number>();
  previousLedger.forEach((entry) => {
    previousDeltaByUser.set(
      entry.user_id,
      (previousDeltaByUser.get(entry.user_id) ?? 0) + (entry.delta ?? 0),
    );
  });

  const userIds = new Set<string>();
  teamPicks.forEach((pick) => userIds.add(pick.user_id));
  playerPicks.forEach((pick) => userIds.add(pick.user_id));
  highlightPicks.forEach((pick) => userIds.add(pick.user_id));
  previousLedger.forEach((entry) => userIds.add(entry.user_id));

  const userIdList = Array.from(userIds);

  const usersResponse =
    userIdList.length > 0
      ? await supabaseAdmin
          .from('users')
          .select('id, email, anima_points_balance')
          .in('id', userIdList)
      : { data: [] as UserRow[], error: null };

  if (usersResponse.error) {
    throw usersResponse.error;
  }

  const userMap = new Map<string, UserRow>(
    ((usersResponse.data ?? []) as UserRow[]).map((user) => [user.id, user]),
  );

  const teamResultsFormatted = (teamResults ?? []).map((result) => ({
    gameId: result.game_id,
    winnerTeamId: result.winner_team_id,
  }));
  const playerResultsFormatted = (playerResults ?? []).map((result) => ({
    gameId: result.game_id,
    category: result.category,
    playerId: result.player_id,
  }));
  const highlightResultsFormatted = (highlightResults ?? []).map((result) => ({
    playerId: result.player_id,
    rank: result.rank,
  }));

  const teamPicksByUser = new Map<string, TeamPickRow[]>();
  teamPicks.forEach((pick) => {
    const list = teamPicksByUser.get(pick.user_id);
    if (list) {
      list.push(pick);
    } else {
      teamPicksByUser.set(pick.user_id, [pick]);
    }
  });

  const playerPicksByUser = new Map<string, PlayerPickRow[]>();
  playerPicks.forEach((pick) => {
    const list = playerPicksByUser.get(pick.user_id);
    if (list) {
      list.push(pick);
    } else {
      playerPicksByUser.set(pick.user_id, [pick]);
    }
  });

  const highlightPicksByUser = new Map<string, HighlightPickRow[]>();
  highlightPicks.forEach((pick) => {
    const list = highlightPicksByUser.get(pick.user_id);
    if (list) {
      list.push(pick);
    } else {
      highlightPicksByUser.set(pick.user_id, [pick]);
    }
  });

  const nowIso = new Date().toISOString();

  const ledgerInserts: LedgerInsert[] = [];
  const userUpserts: Database['public']['Tables']['users']['Insert'][] = [];

  userIdList.forEach((userId) => {
    const score = computeDailyScore({
      teamPicks: (teamPicksByUser.get(userId) ?? []).map((pick) => ({
        gameId: pick.game_id,
        selectedTeamId: pick.selected_team_id,
      })),
      teamResults: teamResultsFormatted,
      playerPicks: (playerPicksByUser.get(userId) ?? []).map((pick) => ({
        gameId: pick.game_id,
        category: pick.category,
        playerId: pick.player_id,
      })),
      playerResults: playerResultsFormatted,
      highlightPicks: (highlightPicksByUser.get(userId) ?? []).map((pick) => ({
        playerId: pick.player_id,
        rank: pick.rank,
      })),
      highlightResults: highlightResultsFormatted,
    });

    const newDelta = score.totalPoints;
    const previousDelta = previousDeltaByUser.get(userId) ?? 0;

    const userRow = userMap.get(userId);
    const currentBalance = userRow?.anima_points_balance ?? 0;
    const newBalance = currentBalance - previousDelta + newDelta;

    if (userRow) {
      userUpserts.push({
        id: userRow.id,
        email: userRow.email,
        anima_points_balance: newBalance,
        updated_at: nowIso,
      });
    }

    if (newDelta > 0) {
      ledgerInserts.push({
        user_id: userId,
        delta: newDelta,
        balance_after: newBalance,
        reason,
        created_at: nowIso,
      });
    }
  });

  const { error: deleteLedgerError } = await supabaseAdmin
    .from(LEDGER_TABLE)
    .delete()
    .eq('reason', reason);

  if (deleteLedgerError) {
    throw deleteLedgerError;
  }

  if (userUpserts.length > 0) {
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .upsert(userUpserts, { onConflict: 'id' });

    if (userUpdateError) {
      throw userUpdateError;
    }
  }

  if (ledgerInserts.length > 0) {
    const { error: ledgerInsertError } = await supabaseAdmin
      .from(LEDGER_TABLE)
      .insert(ledgerInserts);

    if (ledgerInsertError) {
      throw ledgerInsertError;
    }
  }

  return {
    processed: ledgerInserts.length,
    users: userUpserts.length,
  };
};

export const adjustUserBalanceAction = async ({
  userId,
  delta = POINT_STEP,
  reason = 'manual_adjustment',
  locale,
}: BalanceInput) => {
  const now = new Date().toISOString();
  const { data: user, error: userError } = await supabaseAdmin
    .from(USERS_TABLE)
    .select('anima_points_balance')
    .eq('id', userId)
    .maybeSingle<UserBalanceRow>();

  if (userError) {
    throw userError;
  }

  const currentBalance = user?.anima_points_balance ?? 0;
  const nextBalance = currentBalance + delta;

  const ledgerEntry: LedgerInsert = {
    user_id: userId,
    delta,
    balance_after: nextBalance,
    reason,
  };

  const userUpdate: UsersUpdate = {
    anima_points_balance: nextBalance,
    updated_at: now,
  };

  const [{ error: ledgerError }, { error: updateError }] = await Promise.all([
    supabaseAdmin.from(LEDGER_TABLE).insert(ledgerEntry),
    supabaseAdmin.from(USERS_TABLE).update(userUpdate).eq('id', userId),
  ]);

  if (ledgerError || updateError) {
    throw ledgerError ?? updateError ?? new Error('Failed to update balance');
  }

  revalidatePath(`/${locale}/admin`);
};

interface CardInput {
  userId: string;
  cardId: string;
  locale: Locale;
}

export const assignCardAction = async ({ userId, cardId, locale }: CardInput) => {
  const cardInsert: UserCardsInsert = {
    user_id: userId,
    card_id: cardId,
  };
  const { error } = await supabaseAdmin
    .from(USER_CARDS_TABLE)
    .insert(cardInsert);
  if (error) {
    throw error;
  }
  revalidatePath(`/${locale}/admin`);
};

export const assignWeeklyXpPrizesAction = async ({ locale }: { locale: Locale }) => {
  await ensureAdminUser();
  const { ranking, weekStart } = await getWeeklyRankingCurrent();

  const prizes = [
    { position: 1, delta: 500 },
    { position: 2, delta: 300 },
    { position: 3, delta: 100 },
  ] as const;

  const winners = prizes
    .map((prize, index) => {
      const row = ranking[index];
      if (!row?.user_id) {
        return null;
      }
      return {
        ...prize,
        userId: row.user_id,
        fullName: row.full_name ?? null,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        position: number;
        delta: number;
        userId: string;
        fullName: string | null;
      } => Boolean(entry),
    );

  if (winners.length === 0) {
    throw new Error('Nessun utente in classifica weekly.');
  }

  const weekKey =
    weekStart && weekStart.trim().length > 0
      ? weekStart.trim()
      : new Date().toISOString().slice(0, 10);

  const reasonFor = (position: number) => `weekly_xp_prize:${weekKey}:pos${position}`;

  const reasons = winners.map((entry) => reasonFor(entry.position));
  const userIds = winners.map((entry) => entry.userId);

  const { data: existingLedger, error: existingLedgerError } = await supabaseAdmin
    .from(LEDGER_TABLE)
    .select('user_id, reason')
    .in('reason', reasons)
    .in('user_id', userIds);

  if (existingLedgerError) {
    throw existingLedgerError;
  }

  const alreadyAwarded = new Set((existingLedger ?? []).map((entry) => entry.reason));

  const { data: usersData, error: usersError } = await supabaseAdmin
    .from(USERS_TABLE)
    .select('id, email, anima_points_balance')
    .in('id', userIds)
    .returns<UserRow[]>();

  if (usersError) {
    throw usersError;
  }

  const usersMap = new Map<string, UserRow>();
  (usersData ?? []).forEach((user) => usersMap.set(user.id, user));

  const missing = userIds.filter((id) => !usersMap.has(id));
  if (missing.length > 0) {
    throw new Error(`Utenti mancanti per il premio weekly: ${missing.join(', ')}`);
  }

  const ledgerInserts: LedgerInsert[] = [];
  const userUpserts: UsersInsert[] = [];
  const now = new Date().toISOString();
  let awardedCount = 0;
  let skippedCount = 0;

  winners.forEach((winner) => {
    const reason = reasonFor(winner.position);
    if (alreadyAwarded.has(reason)) {
      skippedCount += 1;
      return;
    }

    const user = usersMap.get(winner.userId)!;
    const currentBalance = user.anima_points_balance ?? 0;
    const nextBalance = currentBalance + winner.delta;

    ledgerInserts.push({
      user_id: winner.userId,
      delta: winner.delta,
      balance_after: nextBalance,
      reason,
      created_at: now,
    });

    userUpserts.push({
      id: winner.userId,
      email: user.email,
      anima_points_balance: nextBalance,
      updated_at: now,
    });

    usersMap.set(winner.userId, {
      ...user,
      anima_points_balance: nextBalance,
    });
    alreadyAwarded.add(reason);
    awardedCount += 1;
  });

  if (ledgerInserts.length > 0) {
    const [{ error: ledgerError }, { error: userError }] = await Promise.all([
      supabaseAdmin.from(LEDGER_TABLE).insert(ledgerInserts),
      supabaseAdmin.from(USERS_TABLE).upsert(userUpserts),
    ]);

    if (ledgerError || userError) {
      throw ledgerError ?? userError ?? new Error('Failed to assign weekly prizes');
    }
  }

  revalidatePath(`/${locale}/admin`);

  return {
    weekStart: weekKey,
    awardedCount,
    skippedCount,
  };
};

export const revokeCardAction = async ({ userId, cardId, locale }: CardInput) => {
  const { error } = await supabaseAdmin
    .from(USER_CARDS_TABLE)
    .delete()
    .match({ user_id: userId, card_id: cardId });
  if (error) {
    throw error;
  }
  revalidatePath(`/${locale}/admin`);
};

interface HighlightEntry {
  rank: number;
  player: AdminPlayerSelection;
}

export const saveHighlightsAction = async ({
  date,
  highlights,
  locale,
}: {
  date: string;
  highlights: HighlightEntry[];
  locale: Locale;
}) => {
  const now = new Date().toISOString();
  const resolved = await Promise.all(
    highlights
      .filter((entry) => entry.player)
      .map(async (entry) => ({
        rank: entry.rank,
        playerId: await ensurePlayerUuid(entry.player),
      })),
  );

  const upsertPayload: ResultsHighlightsInsert[] = resolved.map((entry) => ({
    player_id: entry.playerId,
    rank: entry.rank,
    result_date: date,
    settled_at: now,
  }));

  if (upsertPayload.length > 0) {
    const { error } = await supabaseAdmin
      .from(RESULTS_HIGHLIGHTS_TABLE)
      .upsert(upsertPayload, {
        onConflict: 'result_date,rank',
      });

    if (error) {
      throw error;
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    await fetch(`${baseUrl}/api/settle?date=${date}`, {
      method: 'POST',
      cache: 'no-store',
    });
  } catch (err) {
    console.error('Failed to trigger settlement after highlights save', err);
  }

  revalidatePath(`/${locale}/admin`);
};

export const loadTeamWinners = async (
  dateNY: string,
): Promise<LoadTeamWinnersResult> => {
  await ensureAdminUser();
  const pickDate = DATE_SCHEMA.parse(dateNY);
  const games = await fetchGamesForDate(pickDate);
  const teamResults = await fetchTeamResultsForGames(games.map((game) => game.id));
  const resultsMap = new Map<string, TeamResultRow>(
    teamResults.map((result) => [result.game_id, result]),
  );

  const gamesPayload: TeamWinnerRow[] = games.map((game) => {
    const result = resultsMap.get(game.id);
    return {
      id: game.id,
      status: game.status,
      homeTeam: {
        id: game.home_team_id,
        abbr: game.home_team_abbr,
        name: game.home_team_name,
      },
      awayTeam: {
        id: game.away_team_id,
        abbr: game.away_team_abbr,
        name: game.away_team_name,
      },
      winnerTeamId: result?.winner_team_id ?? null,
      settledAt: result?.settled_at ?? null,
    };
  });

  return {
    date: pickDate,
    games: gamesPayload,
  };
};

export const loadPlayerWinners = async (
  dateNY: string,
): Promise<LoadPlayerWinnersResult> => {
  await ensureAdminUser();
  const pickDate = DATE_SCHEMA.parse(dateNY);
  const games = await fetchGamesForDate(pickDate);
  const gameIds = games.map((game) => game.id);
  const teamIds = games
    .flatMap((game) => [game.home_team_id, game.away_team_id])
    .filter((value): value is string => Boolean(value));

  const [{ data: playerPicksRaw, error: playerPicksError }, playerResults, rosterOptionsByTeamId] =
    await Promise.all([
      supabaseAdmin
        .from('picks_players')
        .select(
          [
            'game_id',
            'category',
            'player_id',
            'player:player_id(first_name,last_name,position,provider_player_id,team:team_id (abbr))',
          ].join(', '),
        )
        .eq('pick_date', pickDate)
        .returns<PlayerPickWithMeta[]>(),
      fetchPlayerResultsForGames(gameIds),
      fetchRosterOptionsForTeams(teamIds),
    ]);

  if (playerPicksError) {
    throw playerPicksError;
  }

  const playerInfoMap = new Map<
    string,
    {
      first_name: string | null;
      last_name: string | null;
      position: string | null;
      provider_player_id: string | null;
      team_abbr: string | null;
    }
  >();

  type PlayerPickWithMeta = PlayerPickRow & {
    player?: {
      first_name?: string | null;
      last_name?: string | null;
      position?: string | null;
      provider_player_id?: string | null;
      team?: { abbr?: string | null } | null;
    } | null;
  };

  const playerPicks = playerPicksRaw ?? [];

  const optionsByGameCategory = new Map<
    string,
    Map<string, PlayerWinnerOption[]>
  >();
  const optionTracker = new Map<string, Set<string>>();
  const categoriesByGame = new Map<string, Set<string>>();

  playerPicks.forEach((entry) => {
    const key = `${entry.game_id}:${entry.category}`;
    const optionsForGame =
      optionsByGameCategory.get(entry.game_id) ?? new Map<string, PlayerWinnerOption[]>();
    if (!optionsByGameCategory.has(entry.game_id)) {
      optionsByGameCategory.set(entry.game_id, optionsForGame);
    }

    const existing = optionsForGame.get(entry.category) ?? [];
    if (!optionsForGame.has(entry.category)) {
      optionsForGame.set(entry.category, existing);
    }

    const tracker = optionTracker.get(key) ?? new Set<string>();
    if (!optionTracker.has(key)) {
      optionTracker.set(key, tracker);
    }

    const existingCategories = categoriesByGame.get(entry.game_id);
    if (existingCategories) {
      existingCategories.add(entry.category);
    } else {
      categoriesByGame.set(entry.game_id, new Set([entry.category]));
    }

    const info =
      entry.player ??
      ({ 
        first_name: null,
        last_name: null,
        position: null,
        provider_player_id: null,
        team: { abbr: null },
      } as const);
    const teamAbbr = info?.team?.abbr ? info.team.abbr.toUpperCase() : null;

    playerInfoMap.set(entry.player_id, {
      first_name: info?.first_name ?? null,
      last_name: info?.last_name ?? null,
      position: info?.position ?? null,
      provider_player_id: info?.provider_player_id ?? null,
      team_abbr: teamAbbr,
    });

    if (!tracker.has(entry.player_id)) {
      tracker.add(entry.player_id);
      existing.push({
        value: entry.player_id,
        label: buildPlayerLabel(info, entry.player_id, teamAbbr),
        meta: {
          position: info?.position ?? null,
          providerPlayerId: info?.provider_player_id ?? null,
          teamAbbr,
        },
      });
    }
  });

  const resultMap = new Map<string, PlayerResultRow[]>();
  playerResults.forEach((result) => {
    const key = `${result.game_id}:${result.category}`;
    const existing = resultMap.get(key);
    if (existing) {
      existing.push(result);
    } else {
      resultMap.set(key, [result]);
    }
    const set =
      categoriesByGame.get(result.game_id) ??
      (() => {
        const created = new Set<string>();
        categoriesByGame.set(result.game_id, created);
        return created;
      })();
    set.add(result.category);
  });

  const missingPlayerIds = playerResults
    .map((result) => result.player_id)
    .filter((playerId) => !playerInfoMap.has(playerId));

  const additionalPlayers = await fetchPlayerRecordsByIds(missingPlayerIds);
  additionalPlayers.forEach((info, playerId) => {
    playerInfoMap.set(playerId, info);
  });

  const gamesPayload: PlayerWinnerGameRow[] = games.map((game) => {
    let categorySet = categoriesByGame.get(game.id);
    if (!categorySet) {
      categorySet = new Set<string>();
      categoriesByGame.set(game.id, categorySet);
    }
    DEFAULT_PLAYER_CATEGORIES.forEach((category) => categorySet!.add(category));

    const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b));

    const rosterOptions: PlayerWinnerOption[] = [
      ...(game.home_team_id ? rosterOptionsByTeamId.get(game.home_team_id) ?? [] : []),
      ...(game.away_team_id ? rosterOptionsByTeamId.get(game.away_team_id) ?? [] : []),
    ];
    const allowedIds = new Set(rosterOptions.map((option) => option.value));

    const mergeOptions = (...lists: PlayerWinnerOption[][]) => {
      const seen = new Set<string>();
      const merged: PlayerWinnerOption[] = [];
      lists.forEach((list) => {
        list.forEach((option) => {
          if (!seen.has(option.value)) {
            seen.add(option.value);
            merged.push(option);
          }
        });
      });
      return merged;
    };

    const perCategory: PlayerWinnerCategoryRow[] = categories.map((category) => {
      const key = `${game.id}:${category}`;
      const winners = resultMap.get(key) ?? [];
      const baseOptions =
        optionsByGameCategory.get(game.id)?.get(category)?.slice() ?? [];
      // ESPN-only dropdown: filter options to ids that exist in rosterOptions (provider='espn').
      const options = mergeOptions(baseOptions, rosterOptions).filter((option) =>
        allowedIds.has(option.value),
      );

      winners.forEach((winner) => {
        if (!options.some((option) => option.value === winner.player_id)) {
          if (!allowedIds.has(winner.player_id)) {
            return;
          }
          const info = playerInfoMap.get(winner.player_id) ?? null;
          options.push({
            value: winner.player_id,
            label: buildPlayerLabel(
              info ?? undefined,
              winner.player_id,
              info?.team_abbr ?? null,
            ),
            meta: {
              position: info?.position ?? null,
              providerPlayerId: info?.provider_player_id ?? null,
              teamAbbr: info?.team_abbr ?? null,
            },
          });
        }
      });

      options.sort((a, b) => a.label.localeCompare(b.label));

      const winnerIds = winners.map((winner) => winner.player_id).sort((a, b) => a.localeCompare(b));
      const settledAt = winners.reduce<string | null>((latest, entry) => {
        if (!entry.settled_at) {
          return latest;
        }
        if (!latest || entry.settled_at > latest) {
          return entry.settled_at;
        }
        return latest;
      }, null);

      return {
        category,
        winnerPlayerIds: winnerIds,
        settledAt,
        options,
      };
    });

    return {
      id: game.id,
      status: game.status,
      homeTeam: {
        id: game.home_team_id,
        abbr: game.home_team_abbr,
        name: game.home_team_name,
      },
      awayTeam: {
        id: game.away_team_id,
        abbr: game.away_team_abbr,
        name: game.away_team_name,
      },
      categories: perCategory,
    };
  });

  return {
    date: pickDate,
    games: gamesPayload,
  };
};

export const publishTeamWinners = async (
  dateNY: string,
  winners: Array<{ gameId: string; winnerTeamId: string }>,
  locale?: Locale,
) => {
  await ensureAdminUser();
  const pickDate = DATE_SCHEMA.parse(dateNY);

  const validWinners = winners.filter(
    (entry) => entry.gameId && entry.winnerTeamId,
  );

  if (validWinners.length > 0) {
    const now = new Date().toISOString();
    const upsertPayload = validWinners.map((entry) => ({
      game_id: entry.gameId,
      winner_team_id: entry.winnerTeamId,
      settled_at: now,
    }));

    const { error } = await supabaseAdmin
      .from('results_team')
      .upsert(upsertPayload, { onConflict: 'game_id' });

    if (error) {
      throw error;
    }
  }

  const settlement = await applySettlementForDate(pickDate);

  if (locale) {
    revalidatePath(`/${locale}/admin`);
  }

  return {
    ok: true,
    updated: settlement.processed,
  };
};

export const publishPlayerWinners = async (
  dateNY: string,
  winners: Array<{
    gameId: string;
    category: string;
    players: AdminPlayerSelection[];
  }>,
  locale?: Locale,
) => {
  await ensureAdminUser();
  const pickDate = DATE_SCHEMA.parse(dateNY);

  const normalized = winners
    .filter((entry) => entry.gameId && entry.category)
    .map((entry) => ({
      gameId: entry.gameId,
      category: entry.category as PlayerCategoryEnum,
      players: (entry.players ?? []).filter(
        (player): player is AdminPlayerSelection => Boolean(player),
      ),
    }));

  const now = new Date().toISOString();

  for (const entry of normalized) {
    const deleteResult = await supabaseAdmin
      .from('results_players')
      .delete()
      .eq('game_id', entry.gameId)
      .eq('category', entry.category);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    if (entry.players.length === 0) {
      continue;
    }

    const resolvedIds = await Promise.all(
      entry.players.map(async (player) => ensurePlayerUuid(player)),
    );
    const uniqueIds = Array.from(new Set(resolvedIds));
    if (uniqueIds.length === 0) {
      continue;
    }

    const insertPayload = uniqueIds.map((playerId) => ({
      game_id: entry.gameId,
      category: entry.category,
      player_id: playerId,
      settled_at: now,
    }));

    if (process.env.NODE_ENV !== 'production') {
      // Log canonical UUIDs used for admin winners publish to help verify joins with picks_players.
      // eslint-disable-next-line no-console
      console.debug('admin winners save', {
        gameId: entry.gameId,
        category: entry.category,
        playerIds: uniqueIds,
      });
    }

    const insertResult = await supabaseAdmin
      .from('results_players')
      .insert(insertPayload);

    if (insertResult.error) {
      throw insertResult.error;
    }
  }

  const settlement = await applySettlementForDate(pickDate);

  if (locale) {
    revalidatePath(`/${locale}/admin`);
  }

  return {
    ok: true,
    updated: settlement.processed,
  };
};
