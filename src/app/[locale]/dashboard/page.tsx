import { notFound, redirect } from 'next/navigation';

import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

interface ShopCard {
  id: string;
  name: string;
  description: string;
  rarity: string;
  price: number;
  image_url: string;
  accent_color: string | null;
}

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

  const [{ data: profile, error: profileError }, { data: userCards, error: cardsError }, { data: shopCards, error: shopError }] =
    await Promise.all([
      supabaseAdmin
        .from('users')
        .select('full_name, anima_points_balance, role')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('user_cards')
        .select('card:shop_cards(id, name, description, rarity, price, image_url, accent_color)')
        .eq('user_id', user.id),
      supabaseAdmin.from('shop_cards').select('*').order('price', { ascending: true }),
    ]);

  if (profileError || cardsError || shopError || !profile) {
    console.error('[dashboard] failed to load profile context', profileError || cardsError || shopError);
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
