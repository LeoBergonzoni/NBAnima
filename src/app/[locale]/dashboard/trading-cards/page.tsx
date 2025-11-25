import { notFound, redirect } from 'next/navigation';

import { TradingCardsClient } from '@/components/trading-cards/trading-cards-client';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { ensureUserProfile, type UserProfileRow } from '@/lib/server/ensureUserProfile';
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';
import type { ShopCard } from '@/types/shop-card';

export default async function TradingCardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(rawLocale as Locale) ? (rawLocale as Locale) : undefined;
  if (!locale) {
    notFound();
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  let profile: UserProfileRow | null = null;
  try {
    profile = await ensureUserProfile(user.id, user.email);
  } catch (error) {
    console.error('[trading-cards] failed to ensure profile', error);
    redirect(`/${locale}/login`);
  }

  const [{ data: userCards, error: cardsError }, { data: shopCards, error: shopError }] =
    await Promise.all([
      supabaseAdmin.from('user_cards').select('card_id').eq('user_id', user.id),
      supabaseAdmin.from('shop_cards').select('*').order('price', { ascending: true }),
    ]);

  if (cardsError || shopError || !profile) {
    console.error('[trading-cards] failed to load profile context', cardsError || shopError);
    redirect(`/${locale}/login`);
  }

  type UserCardRecord = { card_id: string | null };

  const ownedCardCounts = ((userCards ?? []) as UserCardRecord[]).reduce<Record<string, number>>(
    (acc, entry) => {
      const cardId = entry.card_id;
      if (cardId) {
        acc[cardId] = (acc[cardId] ?? 0) + 1;
      }
      return acc;
    },
    {},
  );

  return (
    <TradingCardsClient
      locale={locale}
      balance={profile.anima_points_balance}
      shopCards={(shopCards ?? []) as ShopCard[]}
      ownedCardCounts={ownedCardCounts}
    />
  );
}
