import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { OnboardingShowcase } from '@/components/home/onboarding-showcase';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { ONBOARDING_STEPS } from '@/config/onboarding';
import { getDictionary } from '@/locales/dictionaries';

export default async function LocaleHomePage({
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
  // Update the image paths inside `src/config/onboarding.ts` to swap the visuals shown here.
  const onboardingCards = dictionary.home.onboarding.map((card, index) => ({
    title: card.title,
    description: card.description,
    image: ONBOARDING_STEPS[index]?.image ?? '/logo.png',
    imageAlt: ONBOARDING_STEPS[index]?.imageAlt ?? card.title,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 text-white">
      <section className="relative isolate flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 pb-20 pt-28 text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_55%)]" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-b from-transparent via-navy-950/60 to-navy-950" />
        <Image
          src="/logo.png"
          alt="NBAnima logo"
          width={300}
          height={300}
          priority
          className="h-40 w-40 rounded-3xl border border-accent-gold/40 bg-navy-900/60 p-6 shadow-card backdrop-blur"
        />
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-5xl">
            {dictionary.home.heroTitle}
          </h1>
        </div>
        <div className="space-y-2 text-slate-300 sm:max-w-2xl">
          <p className="text-base sm:text-lg">{dictionary.home.heroSubtitle}</p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/${locale}/signup`}
            className="inline-flex min-w-[180px] items-center justify-center rounded-2xl bg-gradient-to-r from-accent-gold via-accent-coral to-accent-gold px-6 py-3 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110"
          >
            {dictionary.home.ctaRegister}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="inline-flex min-w-[180px] items-center justify-center rounded-2xl border border-white/15 bg-navy-900/80 px-6 py-3 text-sm font-semibold text-white shadow-card transition hover:border-accent-gold/60"
          >
            {dictionary.home.ctaLogin}
          </Link>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8 space-y-2">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            NBAnima Onboarding
          </h2>
          <p className="text-sm text-slate-400">
            Scopri come funziona il gioco e preparati a dominare la stagione NBA.
          </p>
        </div>
        <OnboardingShowcase cards={onboardingCards} />
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/${locale}/signup`}
            className="inline-flex min-w-[200px] items-center justify-center rounded-2xl bg-gradient-to-r from-accent-gold via-accent-coral to-accent-gold px-6 py-3 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110"
          >
            {dictionary.home.ctaRegister}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="inline-flex min-w-[200px] items-center justify-center rounded-2xl border border-white/15 bg-navy-900/70 px-6 py-3 text-sm font-semibold text-white shadow-card transition hover:border-accent-gold/60"
          >
            {dictionary.home.ctaLogin}
          </Link>
        </div>
      </section>
    </main>
  );
}
