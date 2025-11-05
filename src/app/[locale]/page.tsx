import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import HowToPlay from '@/components/home/how-to-play';
import { OnboardingShowcase } from '@/components/home/onboarding-showcase';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { ONBOARDING_STEPS } from '@/config/onboarding';
import { getDictionary } from '@/locales/dictionaries';
import { createServerSupabase } from '@/lib/supabase';

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

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(`/${locale}/dashboard`);
  }

  const dictionary = await getDictionary(locale);
  // Update the image paths inside `src/config/onboarding.ts` (or swap the files in `/public`)
  // to change the visuals rendered in the onboarding carousel.
  const onboardingCards = dictionary.home.onboarding.map((card, index) => ({
    title: card.title,
    description: card.description,
    image: ONBOARDING_STEPS[index]?.img ?? '/logo.png',
  }));

  return (
    <main className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 text-white">
      <section className="relative isolate mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pb-16 pt-8 text-center sm:px-6 lg:px-8 md:pt-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_55%)]" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-b from-transparent via-navy-950/60 to-navy-950" />
        <Image
          src="/NBAnimasfondo.png"
          alt="NBAnima logo"
          width={1000}
          height={1000}
          priority
          className="mx-auto h-auto w-full max-w-[680px] rounded-3xl border border-accent-gold/40 bg-navy-900/60 p-4 shadow-card backdrop-blur"
        />
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-5xl">
            {dictionary.home.heroTitle}
          </h1>
        </div>
        <div className="space-y-2 text-slate-300 sm:max-w-2xl">
          <p className="text-base sm:text-lg">{dictionary.home.heroSubtitle}</p>
        </div>
        <div className="mt-4 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/${locale}/signup`}
            className="inline-flex min-h-[44px] min-w-[180px] items-center justify-center rounded-2xl bg-gradient-to-r from-accent-gold via-accent-coral to-accent-gold px-6 py-2.5 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110"
          >
            {dictionary.home.ctaRegister}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="inline-flex min-h-[44px] min-w-[180px] items-center justify-center rounded-2xl border border-white/15 bg-navy-900/80 px-6 py-2.5 text-sm font-semibold text-white shadow-card transition hover:border-accent-gold/60"
          >
            {dictionary.home.ctaLogin}
          </Link>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8 md:pb-16">
        <div className="mb-8 space-y-2">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            NBAnima Onboarding
          </h2>
          <p className="text-sm text-slate-400">
            Scopri come funziona il gioco e preparati a dominare la stagione NBA.
          </p>
        </div>
        <OnboardingShowcase cards={onboardingCards} />
      </section>

      <HowToPlay
        content={dictionary.home.howToPlay}
        signupHref={`/${locale}/signup`}
      />

      <section
        id="auth-cta"
        className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/${locale}/signup`}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent-gold via-accent-coral to-accent-gold px-6 py-2.5 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110 sm:w-auto"
          >
            {dictionary.home.ctaRegister}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-white/15 bg-navy-900/70 px-6 py-2.5 text-sm font-semibold text-white shadow-card transition hover:border-accent-gold/60 sm:w-auto"
          >
            {dictionary.home.ctaLogin}
          </Link>
        </div>
      </section>
    </main>
  );
}
