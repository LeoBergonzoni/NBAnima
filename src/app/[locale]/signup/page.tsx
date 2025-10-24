import { notFound } from 'next/navigation';

import { AuthForm } from '@/components/auth/AuthForm';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { getDictionary } from '@/locales/dictionaries';

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
