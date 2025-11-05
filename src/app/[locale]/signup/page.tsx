import { notFound, redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth/AuthForm';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { getDictionary } from '@/locales/dictionaries';
import { createServerSupabase } from '@/lib/supabase';

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : undefined;

  if (!locale) {
    notFound();
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(`/${locale}/dashboard`);
  }

  const dictionary = await getDictionary(locale);

  return (
    <AuthForm
      mode="signup"
      locale={locale}
      copy={{
        title: dictionary.auth.signup.title,
        subtitle: dictionary.auth.signup.subtitle,
        submit: dictionary.auth.signup.submit,
        switchPrompt: dictionary.auth.signup.switchPrompt,
        switchCta: dictionary.auth.signup.switchCta,
        emailLabel: dictionary.auth.fields.email,
        passwordLabel: dictionary.auth.fields.password,
        confirmPasswordLabel: dictionary.auth.fields.confirmPassword,
        passwordMismatch: dictionary.auth.errors.mismatch,
        genericError: dictionary.auth.errors.generic,
      }}
      switchHref={`/${locale}/login`}
    />
  );
}
