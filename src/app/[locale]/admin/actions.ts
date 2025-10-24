'use server';

import { revalidatePath } from 'next/cache';

import type { Locale } from '@/lib/constants';
import { supabaseAdmin } from '@/lib/supabase';

interface BalanceInput {
  userId: string;
  delta: number;
  reason?: string;
  locale: Locale;
}

export const adjustUserBalanceAction = async ({
  userId,
  delta,
  reason = 'manual_adjustment',
  locale,
}: BalanceInput) => {
  const now = new Date().toISOString();
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('anima_points_balance')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  const currentBalance = user?.anima_points_balance ?? 0;
  const nextBalance = currentBalance + delta;

  const [{ error: ledgerError }, { error: updateError }] = await Promise.all([
    supabaseAdmin.from('anima_points_ledger').insert({
      user_id: userId,
      delta,
      balance_after: nextBalance,
      reason,
      created_at: now,
    }),
    supabaseAdmin
      .from('users')
      .update({ anima_points_balance: nextBalance, updated_at: now })
      .eq('id', userId),
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
  const { error } = await supabaseAdmin.from('user_cards').insert({
    user_id: userId,
    card_id: cardId,
  });
  if (error) {
    throw error;
  }
  revalidatePath(`/${locale}/admin`);
};

export const revokeCardAction = async ({ userId, cardId, locale }: CardInput) => {
  const { error } = await supabaseAdmin
    .from('user_cards')
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
  const upsertPayload = highlights.map((entry) => ({
    player_id: entry.playerId,
    rank: entry.rank,
    result_date: date,
    settled_at: now,
  }));

  const { error } = await supabaseAdmin
    .from('results_highlights')
    .upsert(upsertPayload, { onConflict: 'result_date,rank' });

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
