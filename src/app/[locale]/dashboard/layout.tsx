import { redirect } from 'next/navigation';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { DashboardMobileNav } from '@/components/dashboard/dashboard-mobile-nav';
import type { Locale } from '@/lib/constants';
import { createServerSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale: rawLocale } = params;
  const locale = rawLocale as Locale;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return (
    <AuthProvider>
      <div className="relative pb-24 sm:pb-0">
        {children}
        <DashboardMobileNav locale={locale} />
      </div>
    </AuthProvider>
  );
}
