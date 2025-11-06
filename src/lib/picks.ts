import { isAfter } from 'date-fns';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import { LOCK_WINDOW_BUFFER_MINUTES } from './constants';
import type { Database } from './supabase.types';
import { picksPayloadSchema, type PicksPayload } from './validators/picks';

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

const getDateRange = (pickDate: string) => {
  const parsed = isoDateSchema.parse(pickDate);
  return {
    start: `${parsed}T00:00:00Z`,
    end: `${parsed}T23:59:59Z`,
  };
};

export const getDailyChangeCount = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  pickDate: string,
) => {
  const [team, players, highlights] = await Promise.all([
    supabase
      .from('picks_teams')
      .select('changes_count')
      .eq('user_id', userId)
      .gte('pick_date', pickDate)
      .lte('pick_date', pickDate),
    supabase
      .from('picks_players')
      .select('changes_count')
      .eq('user_id', userId)
      .gte('pick_date', pickDate)
      .lte('pick_date', pickDate),
    supabase
      .from('picks_highlights')
      .select('changes_count')
      .eq('user_id', userId)
      .gte('pick_date', pickDate)
      .lte('pick_date', pickDate),
  ]);

  const counts = [
    ...(team.data ?? []),
    ...(players.data ?? []),
    ...(highlights.data ?? []),
  ].map((row) => row.changes_count ?? 0);

  return counts.length > 0 ? Math.max(...counts) : 0;
};

export const assertLockWindowOpen = async (
  supabaseAdmin: SupabaseClient<Database>,
  pickDate: string,
) => {
  const { start, end } = getDateRange(pickDate);
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('game_date')
    .gte('game_date', start)
    .lte('game_date', end);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return;
  }

  const sorted = data
    .map((game) => new Date(game.game_date))
    .sort((a, b) => a.getTime() - b.getTime());

  const firstGame = sorted[0];

  const bufferMs = LOCK_WINDOW_BUFFER_MINUTES * 60 * 1000;

  if (isAfter(new Date(), new Date(firstGame.getTime() - bufferMs))) {
    throw new Error('Lock window active. Picks can no longer be modified today.');
  }
};

export const validatePicksPayload = (payload: unknown): PicksPayload =>
  picksPayloadSchema.parse(payload);
