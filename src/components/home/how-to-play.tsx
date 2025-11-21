'use client';

import Image from 'next/image';
import Link from 'next/link';

import { FEATURES } from '@/lib/constants';
import type { Dictionary } from '@/locales/dictionaries';

type HowToPlayProps = {
  content: Dictionary['home']['howToPlay'];
  signupHref: string;
};

export default function HowToPlay({ content, signupHref }: HowToPlayProps) {
  const { title, subtitle, play, cards, cta } = content;
  const highlightsEnabled = FEATURES.HIGHLIGHTS_ENABLED;

  const highlightsCard = (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-navy-950/60 p-5 shadow-inner">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-accent-gold">
          {play.label}
        </p>
        <h4 className="text-lg font-semibold">{play.highlights.title}</h4>
      </div>
      <p className="text-sm text-slate-200">{play.highlights.description}</p>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100 shadow-inner">
        <p className="mb-2 font-medium">{play.highlights.scoreTitle}</p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5 sm:text-sm">
          {play.highlights.scores.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-slate-400">{play.highlights.note}</p>
    </div>
  );

  const multipliersCard = (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-navy-950/60 p-5 shadow-inner">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-accent-gold">
          {play.label}
        </p>
        <h4 className="text-lg font-semibold">{play.multipliers.title}</h4>
      </div>
      <p className="text-sm text-slate-200">{play.multipliers.description}</p>
    </div>
  );

  const tileGameCard = (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-navy-950/60 p-5 shadow-inner">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-accent-gold">
          {play.label}
        </p>
        <h4 className="text-lg font-semibold">{play.tileGame.title}</h4>
      </div>
      <p className="text-sm text-slate-200">{play.tileGame.description}</p>
      <div className="flex justify-center">
        <Image
          src={play.tileGame.imageSrc}
          alt={play.tileGame.imageAlt}
          width={2360}
          height={2200}
          className="h-60 w-auto max-w-xs rounded-xl border border-white/10 bg-navy-900/40 p-4"
        />
      </div>
    </div>
  );

  return (
    <section
      id="how-to-play"
      className="mx-auto max-w-6xl scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8 md:py-16"
    >
      <header className="mb-10 text-center md:text-left">
        <p className="text-sm uppercase tracking-[0.4em] text-accent-gold/80">{play.label}</p>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
      </header>

      <div className="space-y-10 text-slate-100">
        <article className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-card backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex-1 space-y-3">
              <h3 className="text-2xl font-semibold">{play.label}</h3>
              <p className="text-base leading-relaxed text-slate-200">{play.description}</p>
            </div>
            <div className="flex flex-1 justify-center">
              <Image
                src={play.imageSrc}
                alt={play.imageAlt}
                width={520}
                height={260}
                className="h-50 w-50 max-w-md rounded-2xl border border-white/10 bg-navy-950/40 p-4 shadow-inner"
                priority
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-navy-950/60 p-5 shadow-inner">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-accent-gold">
                  {play.label}
                </p>
                <h4 className="text-lg font-semibold">{play.teams.title}</h4>
              </div>
              <p className="text-sm text-slate-200">{play.teams.description}</p>
              <div className="flex justify-center">
                <Image
                  src={play.teams.imageSrc}
                  alt={play.teams.imageAlt}
                  width={520}
                  height={240}
                  className="h-40 w-55 max-w-md rounded-xl border border-white/10 bg-navy-900/40 p-4"
                />
              </div>
              <p className="text-sm font-semibold text-accent-gold">
                {play.teams.reward}
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-navy-950/60 p-5 shadow-inner">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-accent-gold">
                  {play.label}
                </p>
                <h4 className="text-lg font-semibold">{play.players.title}</h4>
              </div>
              <p className="text-sm text-slate-200">{play.players.description}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                {play.players.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <div className="flex justify-center">
                <Image
                  src={play.players.imageSrc}
                  alt={play.players.imageAlt}
                  width={520}
                  height={240}
                  className="h-50 w-55 max-w-md rounded-xl border border-white/10 bg-navy-900/40 p-4"
                />
              </div>
              <p className="text-sm font-semibold text-accent-gold">
                {play.players.reward}
              </p>
            </div>
          </div>

          {highlightsEnabled ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {highlightsCard}
              {tileGameCard}
              {multipliersCard}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {tileGameCard}
              {multipliersCard}
            </div>
          )}
        </article>

        <article className="space-y-6 rounded-3xl border border-accent-coral/30 bg-gradient-to-br from-accent-coral/10 via-accent-gold/10 to-transparent p-6 shadow-card">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex-1 space-y-3">
              <p className="text-xs uppercase tracking-[0.4em] text-accent-coral">
                {cards.label}
              </p>
              <h3 className="text-2xl font-semibold">{cards.description}</h3>
              <p className="text-sm text-slate-200">{cards.note}</p>
            </div>
            <div className="flex flex-1 justify-center">
              <Image
                src={cards.imageSrc}
                alt={cards.imageAlt}
                width={520}
                height={320}
                className="h-auto w-full max-w-md rounded-2xl border border-white/10 bg-navy-950/40 p-4 shadow-inner"
              />
            </div>
          </div>
        </article>

        <div className="mx-auto mt-8 max-w-2xl rounded-3xl bg-gradient-to-r from-accent-gold via-accent-coral to-accent-gold p-8 text-center text-navy-900 shadow-xl">
          <p className="text-2xl font-bold">{cta.title}</p>
          <p className="mt-2 text-sm text-navy-900/80">{cta.subtitle}</p>
          <Link
            href={signupHref}
            className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-navy-900 px-8 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-navy-900/90"
          >
            {cta.button}
          </Link>
        </div>
      </div>
    </section>
  );
}
