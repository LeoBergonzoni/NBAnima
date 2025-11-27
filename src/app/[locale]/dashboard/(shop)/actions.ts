'use server';

import { revalidatePath } from 'next/cache';

import {
  createServerSupabase,
  supabaseAdmin,
} from '@/lib/supabase';
import { PACK_DEFINITION_MAP, type PackDefinition, type PackId } from '@/config/trading-packs';
import type { ShopCard } from '@/types/shop-card';

type BuyCardActionInput = {
  cardId: string;
  locale: string;
};

type BuyCardActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHORIZED' | 'CARD_NOT_FOUND' | 'INSUFFICIENT_FUNDS' | 'ALREADY_OWNED' | 'USER_CARDS_FAIL' | 'LEDGER_OR_USER_UPDATE_FAIL' | 'UNKNOWN' };

type BuyPackActionInput = {
  packId: PackId;
  locale: string;
  adminOverride?: boolean;
};

type BuyPackActionResult =
  | { ok: true; cards: ShopCard[]; newBalance: number }
  | {
      ok: false;
      error:
        | 'UNAUTHORIZED'
        | 'PACK_NOT_FOUND'
        | 'INSUFFICIENT_FUNDS'
        | 'NOT_ADMIN_FOR_OVERRIDE'
        | 'NO_CARDS_FOR_RARITY'
        | 'NO_CARDS_AVAILABLE'
        | 'USER_CARDS_FAIL'
        | 'LEDGER_OR_USER_UPDATE_FAIL'
        | 'UNKNOWN';
    };

type ClaimDailyPearlPackResult =
  | { ok: true; cards: ShopCard[]; newBalance: number; nextAvailableAt: string }
  | {
      ok: false;
      nextAvailableAt?: string;
      error:
        | 'UNAUTHORIZED'
        | 'DAILY_LIMIT'
        | 'NO_CARDS_FOR_RARITY'
        | 'NO_CARDS_AVAILABLE'
        | 'USER_CARDS_FAIL'
        | 'LEDGER_OR_USER_UPDATE_FAIL'
        | 'UNKNOWN';
    };

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

type SupportedRarity = 'common' | 'rare' | 'legendary';

const drawRarity = (odds: PackDefinition['odds']): SupportedRarity => {
  const roll = Math.random();
  if (roll <= odds.common) {
    return 'common';
  }
  if (roll <= odds.common + odds.rare) {
    return 'rare';
  }
  return 'legendary';
};

const selectRandomCard = (pool: ShopCard[]): ShopCard | null => {
  if (!pool.length) {
    return null;
  }
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
};

const drawCardsForPack = async (
  pack: PackDefinition,
): Promise<{ ok: true; cards: ShopCard[] } | { ok: false; error: 'NO_CARDS_FOR_RARITY' | 'NO_CARDS_AVAILABLE' }> => {
  const { data: cards, error: cardsError } = await supabaseAdmin
    .from('shop_cards')
    .select('id, name, description, rarity, price, image_url, accent_color, category, conference');

  if (cardsError || !cards?.length) {
    return { ok: false, error: 'NO_CARDS_AVAILABLE' };
  }

  const rarityPools: Record<SupportedRarity, ShopCard[]> = {
    common: (cards as ShopCard[]).filter((card) => card.rarity === 'common'),
    rare: (cards as ShopCard[]).filter((card) => card.rarity === 'rare' || card.rarity === 'epic'),
    legendary: (cards as ShopCard[]).filter((card) => card.rarity === 'legendary'),
  };

  if (!rarityPools.common.length) {
    return { ok: false, error: 'NO_CARDS_AVAILABLE' };
  }

  const desiredRarities: SupportedRarity[] = ['common'];
  for (let index = 0; index < 3; index += 1) {
    desiredRarities.push(drawRarity(pack.odds));
  }

  const selectedCards: ShopCard[] = [];
  for (const rarity of desiredRarities) {
    const card = selectRandomCard(rarityPools[rarity]);
    if (!card) {
      return { ok: false, error: 'NO_CARDS_FOR_RARITY' };
    }
    selectedCards.push(card);
  }

  return { ok: true, cards: selectedCards };
};

export async function buyPackAction({
  packId,
  locale,
  adminOverride = false,
}: BuyPackActionInput): Promise<BuyPackActionResult> {
  const pack = PACK_DEFINITION_MAP[packId];
  if (!pack) {
    return { ok: false, error: 'PACK_NOT_FOUND' };
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

    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('anima_points_balance, role')
      .eq('id', user.id)
      .maybeSingle();

    if (userError || !userRow) {
      return { ok: false, error: 'UNKNOWN' };
    }

    if (adminOverride && userRow.role !== 'admin') {
      return { ok: false, error: 'NOT_ADMIN_FOR_OVERRIDE' };
    }

    const packCost = adminOverride ? 0 : pack.price;
    const balance = userRow.anima_points_balance ?? 0;
    if (packCost > balance) {
      return { ok: false, error: 'INSUFFICIENT_FUNDS' };
    }

    const drawResult = await drawCardsForPack(pack);
    if (!drawResult.ok) {
      return { ok: false, error: drawResult.error };
    }
    const selectedCards = drawResult.cards;

    const { error: userCardsError } = await supabaseAdmin.from('user_cards').insert(
      selectedCards.map((card) => ({
        user_id: user.id,
        card_id: card.id,
      })),
    );

    if (userCardsError) {
      return { ok: false, error: 'USER_CARDS_FAIL' };
    }

    const nextBalance = balance - packCost;
    if (packCost > 0) {
      const [{ error: ledgerError }, { error: userUpdateError }] = await Promise.all([
        supabaseAdmin.from('anima_points_ledger').insert({
          user_id: user.id,
          delta: -packCost,
          balance_after: nextBalance,
          reason: `purchase_pack_${pack.id}`,
        }),
        supabaseAdmin.from('users').update({ anima_points_balance: nextBalance }).eq('id', user.id),
      ]);

      if (ledgerError || userUpdateError) {
        return { ok: false, error: 'LEDGER_OR_USER_UPDATE_FAIL' };
      }
    }

    const dashboardPath = formatDashboardPath(locale);
    revalidatePath(dashboardPath);
    revalidatePath(`${dashboardPath}/trading-cards`);

    return { ok: true, cards: selectedCards, newBalance: nextBalance };
  } catch (error) {
    console.error('[buyPackAction]', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

export async function claimDailyPearlPackAction({
  locale,
}: {
  locale: string;
}): Promise<ClaimDailyPearlPackResult> {
  const pack = PACK_DEFINITION_MAP.pearl;
  const now = Date.now();

  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, error: 'UNAUTHORIZED' };
    }

    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('anima_points_balance')
      .eq('id', user.id)
      .maybeSingle();

    if (userError || !userRow) {
      return { ok: false, error: 'UNKNOWN' };
    }

    const { data: lastClaim, error: lastClaimError } = await supabaseAdmin
      .from('anima_points_ledger')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('reason', 'daily_pearl_pack')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastClaimError) {
      return { ok: false, error: 'UNKNOWN' };
    }

    const lastClaimAt = lastClaim?.created_at ? new Date(lastClaim.created_at).getTime() : null;
    const nextAvailableAt = lastClaimAt ? lastClaimAt + 24 * 60 * 60 * 1000 : null;

    if (nextAvailableAt && nextAvailableAt > now) {
      return { ok: false, error: 'DAILY_LIMIT', nextAvailableAt: new Date(nextAvailableAt).toISOString() };
    }

    const drawResult = await drawCardsForPack(pack);
    if (!drawResult.ok) {
      return { ok: false, error: drawResult.error };
    }

    const selectedCards = drawResult.cards;

    const { error: userCardsError } = await supabaseAdmin.from('user_cards').insert(
      selectedCards.map((card) => ({
        user_id: user.id,
        card_id: card.id,
      })),
    );

    if (userCardsError) {
      return { ok: false, error: 'USER_CARDS_FAIL' };
    }

    const balance = userRow.anima_points_balance ?? 0;
    const [{ error: ledgerError }] = await Promise.all([
      supabaseAdmin.from('anima_points_ledger').insert({
        user_id: user.id,
        delta: 0,
        balance_after: balance,
        reason: 'daily_pearl_pack',
      }),
    ]);

    if (ledgerError) {
      return { ok: false, error: 'LEDGER_OR_USER_UPDATE_FAIL' };
    }

    const dashboardPath = formatDashboardPath(locale);
    revalidatePath(dashboardPath);
    revalidatePath(`${dashboardPath}/trading-cards`);

    const availableAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();

    return { ok: true, cards: selectedCards, newBalance: balance, nextAvailableAt: availableAt };
  } catch (error) {
    console.error('[claimDailyPearlPackAction]', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
