import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase';

const REWARD_POINTS = 10;
const MAX_MOVES_FOR_REWARD = 15;
const REWARD_REASON = 'tile_flip_game_reward';

type RewardPayload = {
  moves?: number;
  locale?: string;
};

export async function POST(request: Request) {
  try {
    const { moves, locale }: RewardPayload = await request.json().catch(() => ({}));
    if (typeof moves !== 'number' || Number.isNaN(moves)) {
      return NextResponse.json({ error: 'INVALID_MOVES' }, { status: 400 });
    }
    if (moves > MAX_MOVES_FOR_REWARD) {
      return NextResponse.json({ error: 'TOO_MANY_MOVES' }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('anima_points_balance')
      .eq('id', user.id)
      .maybeSingle();

    if (userError || !userRow) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const currentBalance = userRow.anima_points_balance ?? 0;
    const nextBalance = currentBalance + REWARD_POINTS;

    const [{ error: ledgerError }, { error: updateError }] = await Promise.all([
      supabaseAdmin.from('anima_points_ledger').insert({
        user_id: user.id,
        delta: REWARD_POINTS,
        balance_after: nextBalance,
        reason: REWARD_REASON,
      }),
      supabaseAdmin
        .from('users')
        .update({ anima_points_balance: nextBalance })
        .eq('id', user.id),
    ]);

    if (ledgerError || updateError) {
      return NextResponse.json({ error: 'LEDGER_FAIL' }, { status: 500 });
    }

    const normalizedLocale =
      typeof locale === 'string' && SUPPORTED_LOCALES.includes(locale as Locale)
        ? (locale as Locale)
        : null;

    if (normalizedLocale) {
      revalidatePath(`/${normalizedLocale}/dashboard`);
      revalidatePath(`/${normalizedLocale}/dashboard/tile-flip-game`);
    }

    return NextResponse.json({ ok: true, balance: nextBalance, delta: REWARD_POINTS });
  } catch (error) {
    console.error('[tile-flip/reward] failed to assign reward', error);
    return NextResponse.json({ error: 'UNKNOWN' }, { status: 500 });
  }
}
