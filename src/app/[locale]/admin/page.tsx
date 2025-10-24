import { redirect } from 'next/navigation';

import { AdminClient } from '@/components/admin/admin-client';
import type { Locale } from '@/lib/constants';
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase';
import { getDictionary } from '@/locales/dictionaries';

export default async function AdminPage({
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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    redirect(`/${locale}`);
  }

  const [{ data: users }, { data: shopCards }, { data: highlights }] =
    await Promise.all([
      supabaseAdmin
        .from('users')
        .select(
          'id, email, full_name, anima_points_balance, role, user_cards(card:shop_cards(id, name, rarity, price))',
        ),
      supabaseAdmin
        .from('shop_cards')
        .select('*')
        .order('price', { ascending: true }),
      supabaseAdmin
        .from('results_highlights')
        .select('player_id, rank, result_date')
        .order('rank', { ascending: true })
        .eq('result_date', new Date().toISOString().slice(0, 10)),
    ]);

  return (
    <AdminClient
      locale={locale}
      dictionary={dictionary}
      users={users ?? []}
      shopCards={shopCards ?? []}
      highlights={highlights ?? []}
    />
  );
}
