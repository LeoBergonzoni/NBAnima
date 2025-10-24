import { notFound } from 'next/navigation';

import { AuthForm } from '@/components/auth/AuthForm';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { getDictionary } from '@/locales/dictionaries';

export default async function LoginPage({
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
      mode="login"
      locale={locale}
      copy={{
        title: dictionary.auth.login.title,
        subtitle: dictionary.auth.login.subtitle,
        submit: dictionary.auth.login.submit,
        switchPrompt: dictionary.auth.login.switchPrompt,
        switchCta: dictionary.auth.login.switchCta,
        emailLabel: dictionary.auth.fields.email,
        passwordLabel: dictionary.auth.fields.password,
        passwordMismatch: dictionary.auth.errors.mismatch,
        genericError: dictionary.auth.errors.generic,
      }}
      switchHref={`/${locale}/signup`}
    />
  );
}
