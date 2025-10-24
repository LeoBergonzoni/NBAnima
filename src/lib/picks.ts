import { isAfter } from 'date-fns';
import { z } from 'zod';

import { LOCK_WINDOW_BUFFER_MINUTES } from './constants';
import { supabaseAdmin } from './supabase';
import { playerCategorySchema, type PicksPayload } from './validators/picks';

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

export const getDailyChangeCount = async (userId: string, pickDate: string) => {
  const [team, players, highlights] = await Promise.all([
    supabaseAdmin
      .from('picks_teams')
      .select('changes_count')
      .eq('user_id', userId)
      .gte('pick_date', pickDate)
      .lte('pick_date', pickDate),
    supabaseAdmin
      .from('picks_players')
      .select('changes_count')
      .eq('user_id', userId)
      .gte('pick_date', pickDate)
      .lte('pick_date', pickDate),
    supabaseAdmin
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

export const assertLockWindowOpen = async (pickDate: string) => {
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

export const validatePicksPayload = (payload: unknown): PicksPayload => {
  const picks = z
    .object({
      pickDate: isoDateSchema,
      teams: z.array(
        z.object({
          gameId: z.string().min(1),
          teamId: z.string().min(1),
        }),
      ),
      players: z.array(
        z.object({
          gameId: z.string().min(1),
          category: playerCategorySchema,
          playerId: z.string().min(1),
        }),
      ),
      highlights: z
        .array(
          z.object({
            playerId: z.string().min(1),
            rank: z.number().int().min(1).max(10),
          }),
        )
        .length(5),
    })
    .superRefine((val, ctx) => {
      const categories = new Set<string>();
      val.players.forEach((pick) => {
        const key = `${pick.gameId}-${pick.category}`;
        if (categories.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate category ${pick.category} for game ${pick.gameId}`,
          });
        }
        categories.add(key);
      });

      const ranks = val.highlights.map((h) => h.rank);
      const uniqueRanks = new Set(ranks);
      if (uniqueRanks.size !== val.highlights.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Highlight ranks must be unique.',
        });
      }

      const highlightPlayers = new Set<string>();
      val.highlights.forEach((highlight) => {
        if (highlightPlayers.has(highlight.playerId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Highlight players must be unique.',
          });
        }
        highlightPlayers.add(highlight.playerId);
      });
    });

  return picks.parse(payload);
};
