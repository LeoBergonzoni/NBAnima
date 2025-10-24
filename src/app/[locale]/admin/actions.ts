'use server';

import { revalidatePath } from 'next/cache';

import type { Locale } from '@/lib/constants';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

interface BalanceInput {
  userId: string;
  delta: number;
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

export const adjustUserBalanceAction = async ({
  userId,
  delta,
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
  playerId: string;
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
  const upsertPayload: ResultsHighlightsInsert[] = highlights.map((entry) => ({
    player_id: entry.playerId,
    rank: entry.rank,
    result_date: date,
    settled_at: now,
  }));

  const { error } = await supabaseAdmin
    .from(RESULTS_HIGHLIGHTS_TABLE)
    .upsert(upsertPayload, {
      onConflict: 'result_date,rank',
    });

  if (error) {
    throw error;
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
