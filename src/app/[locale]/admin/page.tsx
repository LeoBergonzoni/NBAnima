import { notFound, redirect } from 'next/navigation';

import { AdminClient } from '@/components/admin/admin-client';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';
import { getDictionary } from '@/locales/dictionaries';

export default async function AdminPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale: rawLocale } = params;
  const locale = SUPPORTED_LOCALES.includes(rawLocale as Locale) ? (rawLocale as Locale) : undefined;
  if (!locale) {
    notFound();
  }
  const dictionary = await getDictionary(locale);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}`);
  }

  type UserRoleRow = Pick<
    Database['public']['Tables']['users']['Row'],
    'role'
  >;
  type ShopCardRow = Database['public']['Tables']['shop_cards']['Row'];
  type HighlightRow = Database['public']['Tables']['results_highlights']['Row'];

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<UserRoleRow>();

  if (profileError || profile?.role !== 'admin') {
    redirect(`/${locale}`);
  }

  const [{ data: users }, { data: shopCards }, { data: highlights }] =
    await Promise.all([
      supabaseAdmin
        .from('users')
        .select(
          'id, email, full_name, anima_points_balance, role, user_cards(id, card:shop_cards(id, name, rarity, price))',
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
      shopCards={(shopCards ?? []) as ShopCardRow[]}
      highlights={(highlights ?? []) as HighlightRow[]}
    />
  );
}
