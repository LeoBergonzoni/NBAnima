import { notFound, redirect } from 'next/navigation';

import { GamesSummaryClient } from './GamesSummaryClient';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase';
import { getDictionary, type Dictionary } from '@/locales/dictionaries';

export default async function GamesSummaryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(rawLocale as Locale) ? (rawLocale as Locale) : undefined;
  if (!locale) {
    notFound();
  }

  const dictionary: Dictionary = await getDictionary(locale);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}`);
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role !== 'admin') {
    redirect(`/${locale}`);
  }

  return <GamesSummaryClient locale={locale} dictionary={dictionary} />;
}
