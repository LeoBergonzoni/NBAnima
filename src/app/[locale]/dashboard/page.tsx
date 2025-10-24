import { redirect } from 'next/navigation';

import { DashboardClient } from '@/components/dashboard/dashboard-client';
import type { Locale } from '@/lib/constants';
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase';
import { getDictionary } from '@/locales/dictionaries';

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
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}`);
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
    redirect(`/${locale}`);
  }

  const ownedCards = (userCards ?? [])
    .map((entry) => entry.card as ShopCard | null)
    .filter((card): card is ShopCard => Boolean(card));

  return (
    <DashboardClient
      locale={locale}
      dictionary={dictionary}
      balance={profile.anima_points_balance}
      ownedCards={ownedCards}
      shopCards={(shopCards ?? []) as ShopCard[]}
      role={profile.role}
    />
  );
}
