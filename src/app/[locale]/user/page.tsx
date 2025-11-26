import { notFound, redirect } from 'next/navigation';

import { UserProfileClient } from '@/components/user/user-profile-client';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { DashboardMobileNav } from '@/components/dashboard/dashboard-mobile-nav';
import { ensureUserProfile, type UserProfileRow } from '@/lib/server/ensureUserProfile';
import { createServerSupabase } from '@/lib/supabase';
import type { PageProps } from 'next';

export default async function UserPage({
  params,
}: PageProps<{ locale: string }>) {
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
    console.error('[user] failed to load profile', error);
    redirect(`/${locale}/login`);
  }

  if (!profile) {
    redirect(`/${locale}/login`);
  }

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
}
