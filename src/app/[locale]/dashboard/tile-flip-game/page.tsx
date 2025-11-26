import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TileFlipGameNBAnima } from '@/components/TileFlipGame';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { getDictionary } from '@/locales/dictionaries';

export default async function TileFlipGamePage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale: rawLocale } = params;
  const locale = SUPPORTED_LOCALES.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : undefined;
  if (!locale) {
    notFound();
  }
  const dictionary = await getDictionary(locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-navy-900/70 p-4 md:p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-accent-gold/70">
            {dictionary.tileGame.rewardPointsLabel}
          </p>
          <h1 className="text-3xl font-semibold text-white">
            {dictionary.tileGame.sectionTitle}
          </h1>
          <p className="text-sm text-slate-300">
            {dictionary.tileGame.sectionDescription}
          </p>
        </div>
        <Link
          href={`/${locale}/dashboard`}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-accent-gold/50"
        >
          ← {dictionary.dashboard.playTab}
        </Link>
      </div>
      <TileFlipGameNBAnima />
    </div>
  );
}
