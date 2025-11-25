'use server';

import { revalidatePath } from 'next/cache';

import {
  createServerSupabase,
  supabaseAdmin,
} from '@/lib/supabase';

type BuyCardActionInput = {
  cardId: string;
  locale: string;
};

type BuyCardActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHORIZED' | 'CARD_NOT_FOUND' | 'INSUFFICIENT_FUNDS' | 'ALREADY_OWNED' | 'USER_CARDS_FAIL' | 'LEDGER_OR_USER_UPDATE_FAIL' | 'UNKNOWN' };

const formatDashboardPath = (locale: string) => {
  const normalized = locale && locale.length > 0 ? locale : 'it';
  return `/${normalized}/dashboard`;
};

export async function buyCardAction({
  cardId,
  locale,
}: BuyCardActionInput): Promise<BuyCardActionResult> {
  if (!cardId) {
    return { ok: false, error: 'CARD_NOT_FOUND' };
  }

  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, error: 'UNAUTHORIZED' };
    }

    const { data: card, error: cardError } = await supabaseAdmin
      .from('shop_cards')
      .select('id, price')
      .eq('id', cardId)
      .maybeSingle();

    if (cardError || !card) {
      return { ok: false, error: 'CARD_NOT_FOUND' };
    }

    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('anima_points_balance')
      .eq('id', user.id)
      .maybeSingle();

    if (userError || !userRow) {
      return { ok: false, error: 'UNKNOWN' };
    }

    const balance = userRow.anima_points_balance ?? 0;
    if (balance < card.price) {
      return { ok: false, error: 'INSUFFICIENT_FUNDS' };
    }

    const { error: userCardsError } = await supabaseAdmin.from('user_cards').insert({
      user_id: user.id,
      card_id: cardId,
    });

    if (userCardsError) {
      return { ok: false, error: 'USER_CARDS_FAIL' };
    }

    const nextBalance = balance - card.price;

    const [{ error: ledgerError }, { error: userUpdateError }] = await Promise.all([
      supabaseAdmin.from('anima_points_ledger').insert({
        user_id: user.id,
        delta: -card.price,
        balance_after: nextBalance,
        reason: 'purchase_card',
      }),
      supabaseAdmin
        .from('users')
        .update({ anima_points_balance: nextBalance })
        .eq('id', user.id),
    ]);

    if (ledgerError || userUpdateError) {
      return { ok: false, error: 'LEDGER_OR_USER_UPDATE_FAIL' };
    }

    const dashboardPath = formatDashboardPath(locale);
    revalidatePath(dashboardPath);
    revalidatePath(`${dashboardPath}/trading-cards`);

    return { ok: true };
  } catch (error) {
    console.error('[buyCardAction]', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
