'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { Locale } from '@/lib/constants';
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';
import { computeDailyScore } from '@/lib/scoring';
import { ADMIN_POINT_STEP } from '@/lib/admin';

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

const dayRangeForDate = (dateNY: string) => ({
  start: `${dateNY}T00:00:00Z`,
  end: `${dateNY}T23:59:59Z`,
});

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
  };
};

export type PlayerWinnerCategoryRow = {
  category: string;
  winnerPlayerId: string | null;
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

  const { data: existing, error: selectError } = await supabaseAdmin
    .from('player')
    .select('id')
    .eq('provider', PLAYER_PROVIDER)
    .eq('provider_player_id', providerId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing?.id) {
    providerPlayerIdCache.set(providerId, existing.id);
    return existing.id;
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

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('player')
    .insert({
      provider: PLAYER_PROVIDER,
      provider_player_id: providerId,
      team_id: teamId,
      first_name: first || 'N.',
      last_name: last || 'N.',
      position,
    })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  if (!inserted?.id) {
    throw new Error(`Creazione giocatore non riuscita per "${providerId}"`);
  }

  providerPlayerIdCache.set(providerId, inserted.id);
  return inserted.id;
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

const fetchGamesForDate = async (dateNY: string) => {
  const { start, end } = dayRangeForDate(dateNY);

  const { data, error } = await supabaseAdmin
    .from('games')
    .select(
      [
        'id',
        'status',
        'home_team_id',
        'away_team_id',
        'home_team_abbr',
        'away_team_abbr',
        'home_team_name',
        'away_team_name',
      ].join(', '),
    )
    .gte('game_date', start)
    .lte('game_date', end)
    .order('game_date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as GameRow[];
};

const fetchTeamResultsForGames = async (gameIds: string[]) => {
  if (gameIds.length === 0) {
    return [] as TeamResultRow[];
  }

  const { data, error } = await supabaseAdmin
    .from('results_team')
    .select('game_id, winner_team_id, settled_at')
    .in('game_id', gameIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as TeamResultRow[];
};

const fetchPlayerResultsForGames = async (gameIds: string[]) => {
  if (gameIds.length === 0) {
    return [] as PlayerResultRow[];
  }

  const { data, error } = await supabaseAdmin
    .from('results_players')
    .select('game_id, category, player_id, settled_at')
    .in('game_id', gameIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as PlayerResultRow[];
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
    }
  >
> => {
  if (playerIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from('player')
    .select('id, first_name, last_name, position')
    .in('id', Array.from(new Set(playerIds)));

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((player) => [
      player.id,
      {
        first_name: player.first_name,
        last_name: player.last_name,
        position: player.position,
      },
    ]),
  );
};

const buildPlayerLabel = (
  record:
    | {
        first_name?: string | null;
        last_name?: string | null;
      }
    | null
    | undefined,
  fallback: string,
) => {
  const first = record?.first_name ?? '';
  const last = record?.last_name ?? '';
  const label = `${first} ${last}`.trim();
  return label || fallback;
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

  const [{ data: playerPicksRaw, error: playerPicksError }, playerResults] =
    await Promise.all([
      supabaseAdmin
        .from('picks_players')
        .select(
          [
            'game_id',
            'category',
            'player_id',
            'player:player_id(first_name,last_name,position)',
          ].join(', '),
        )
        .eq('pick_date', pickDate),
      fetchPlayerResultsForGames(gameIds),
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
    }
  >();

  type PlayerPickWithMeta = PlayerPickRow & {
    player?: {
      first_name?: string | null;
      last_name?: string | null;
      position?: string | null;
    } | null;
  };

  const playerPicks = (playerPicksRaw ?? []) as PlayerPickWithMeta[];

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
      } as const);

    playerInfoMap.set(entry.player_id, {
      first_name: info?.first_name ?? null,
      last_name: info?.last_name ?? null,
      position: info?.position ?? null,
    });

    if (!tracker.has(entry.player_id)) {
      tracker.add(entry.player_id);
      existing.push({
        value: entry.player_id,
        label: buildPlayerLabel(info, entry.player_id),
        meta: {
          position: info?.position ?? null,
        },
      });
    }
  });

  const resultMap = new Map<string, PlayerResultRow>();
  playerResults.forEach((result) => {
    resultMap.set(`${result.game_id}:${result.category}`, result);
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

    const perCategory: PlayerWinnerCategoryRow[] = categories.map((category) => {
      const key = `${game.id}:${category}`;
      const winner = resultMap.get(key);
      const options =
        optionsByGameCategory.get(game.id)?.get(category)?.slice() ?? [];

      if (winner && !options.some((option) => option.value === winner.player_id)) {
        const info = playerInfoMap.get(winner.player_id) ?? null;
        options.push({
          value: winner.player_id,
          label: buildPlayerLabel(info ?? undefined, winner.player_id),
          meta: {
            position: info?.position ?? null,
          },
        });
      }

      options.sort((a, b) => a.label.localeCompare(b.label));

      return {
        category,
        winnerPlayerId: winner?.player_id ?? null,
        settledAt: winner?.settled_at ?? null,
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
    player: AdminPlayerSelection;
    category: string;
  }>,
  locale?: Locale,
) => {
  await ensureAdminUser();
  const pickDate = DATE_SCHEMA.parse(dateNY);

  const validWinners = winners.filter(
    (entry) => entry.gameId && entry.category && entry.player,
  );

  if (validWinners.length > 0) {
    const now = new Date().toISOString();
    const resolved = await Promise.all(
      validWinners.map(async (entry) => ({
        gameId: entry.gameId,
        category: entry.category,
        playerId: await ensurePlayerUuid(entry.player),
      })),
    );
    const upsertPayload = resolved.map((entry) => ({
      game_id: entry.gameId,
      category: entry.category,
      player_id: entry.playerId,
      settled_at: now,
    }));

    const { error } = await supabaseAdmin
      .from('results_players')
      .upsert(upsertPayload, {
        onConflict: 'game_id,category',
      });

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
