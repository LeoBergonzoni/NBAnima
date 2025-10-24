import Image from 'next/image';
import Link from 'next/link';

import type { Locale } from '@/lib/constants';
import { getDictionary } from '@/locales/dictionaries';

const HERO_IMAGE = '/anima-point.png';

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <section className="space-y-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-navy-800/60 px-4 py-2 text-xs uppercase tracking-widest text-accent-gold">
          NBAnima
        </span>
        <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
          {dictionary.home.heroTitle}
        </h1>
        <p className="max-w-2xl text-lg text-slate-300">
          {dictionary.home.heroSubtitle}
        </p>
        <ul className="space-y-3 text-sm text-slate-300">
          {dictionary.home.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-3 rounded-2xl border border-white/5 bg-navy-900/60 p-4 shadow-card"
            >
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent-gold" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/${locale}/register`}
            className="inline-flex items-center justify-center rounded-2xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-6 py-3 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-105"
          >
            {dictionary.home.ctaRegister}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-navy-800/80 px-6 py-3 text-sm font-semibold text-white shadow-card transition hover:border-accent-gold/50"
          >
            {dictionary.home.ctaLogin}
          </Link>
        </div>
      </section>
      <aside className="relative hidden h-full rounded-[2rem] border border-accent-gold/30 bg-navy-800/70 p-6 shadow-card lg:block">
        <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-accent-gold/10 via-transparent to-accent-ice/10" />
        <div className="relative flex h-full flex-col justify-center gap-6">
          <Image
            src={HERO_IMAGE}
            alt="Anima Points"
            width={520}
            height={520}
            className="mx-auto w-72 drop-shadow-2xl"
            priority
          />
          <p className="text-center text-sm text-slate-300">
            NBAnima combina strategia, passione e collezionismo digitale per rivoluzionare il tuo modo di vivere l&apos;NBA.
          </p>
        </div>
      </aside>
    </div>
  );
}
