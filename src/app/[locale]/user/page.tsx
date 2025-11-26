import { notFound, redirect } from 'next/navigation';

import { UserProfileClient } from '@/components/user/user-profile-client';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { DashboardMobileNav } from '@/components/dashboard/dashboard-mobile-nav';
import { ensureUserProfile } from '@/lib/server/ensureUserProfile';
import { createServerSupabase } from '@/lib/supabase';

export default async function UserPage({
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

  try {
    const profile = await ensureUserProfile(user.id, user.email);

    return (
      <div className="relative pb-24 sm:pb-0">
        <UserProfileClient
          userId={user.id}
          email={user.email ?? ''}
          fullName={profile.full_name}
          avatarUrl={profile.avatar_url ?? null}
          locale={locale}
        />
        <DashboardMobileNav locale={locale} />
      </div>
    );
  } catch (error) {
    console.error('[user] failed to load profile', error);
    redirect(`/${locale}/login`);
  }
}
