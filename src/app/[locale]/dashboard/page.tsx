import { notFound, redirect } from 'next/navigation';

import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { ensureUserProfile, type UserProfileRow } from '@/lib/server/ensureUserProfile';
import {
  createServerSupabase,
  supabaseAdmin,
} from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';
import type { ShopCard } from '@/types/shop-card';

export default async function DashboardPage({
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
    console.error('[dashboard] failed to ensure profile', error);
    redirect(`/${locale}/login`);
  }

  const [{ data: userCards, error: cardsError }, { data: shopCards, error: shopError }] =
    await Promise.all([
      supabaseAdmin
        .from('user_cards')
        .select('card:shop_cards(id, name, description, rarity, price, image_url, accent_color)')
        .eq('user_id', user.id),
      supabaseAdmin.from('shop_cards').select('*').order('price', { ascending: true }),
    ]);

  if (cardsError || shopError || !profile) {
    console.error('[dashboard] failed to load profile context', cardsError || shopError);
    redirect(`/${locale}/login`);
  }

  type ShopCardRow = Database['public']['Tables']['shop_cards']['Row'];
  type UserCardRecord = { card: ShopCardRow | null };

  const ownedCards = ((userCards ?? []) as UserCardRecord[])
    .map((entry) => entry.card as ShopCard | null)
    .filter((card): card is ShopCard => Boolean(card));

  return (
    <DashboardClient
      locale={locale}
      balance={profile.anima_points_balance}
      ownedCards={ownedCards}
      shopCards={(shopCards ?? []) as ShopCard[]}
      role={profile.role}
    />
  );
}
