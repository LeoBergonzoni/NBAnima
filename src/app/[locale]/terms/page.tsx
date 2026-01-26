import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { getDictionary } from '@/locales/dictionaries';

type Section = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const contentByLocale: Record<Locale, { title: string; intro: string; sections: Section[] }> = {
  it: {
    title: 'Termini di utilizzo',
    intro:
      'NBAnima è una web app in fase di beta testing. Utilizzando il Servizio accetti i seguenti termini.',
    sections: [
      {
        title: '1. Natura del servizio',
        paragraphs: [
          'NBAnima è un gioco a scopo ludico.',
          'Non prevede scommesse con denaro reale, premi in denaro o valore economico reale.',
        ],
      },
      {
        title: '2. Account',
        paragraphs: [
          'L’utente è responsabile delle credenziali del proprio account.',
          'NBAnima non è responsabile per accessi non autorizzati dovuti a negligenza dell’utente.',
        ],
      },
      {
        title: '3. Utilizzo corretto',
        paragraphs: ['È vietato:'],
        bullets: [
          'Usare bot o sistemi automatici',
          'Tentare di aggirare le regole di gioco',
          'Sfruttare bug o comportamenti anomali',
        ],
      },
      {
        title: 'Sanzioni',
        paragraphs: ['In caso di violazioni, l’account può essere sospeso o eliminato.'],
      },
      {
        title: '4. Beta testing',
        paragraphs: ['Essendo una versione beta:'],
        bullets: [
          'Alcune funzionalità potrebbero cambiare',
          'I dati potrebbero essere azzerati o modificati',
          'Potrebbero verificarsi bug o malfunzionamenti',
        ],
      },
      {
        title: '5. Limitazione di responsabilità',
        paragraphs: [
          'Il Servizio è fornito “così com’è”.',
          'NBAnima non garantisce continuità o assenza di errori.',
        ],
      },
      {
        title: '6. Modifiche ai termini',
        paragraphs: [
          'I termini possono essere aggiornati in qualsiasi momento.',
          'L’uso continuato del Servizio implica l’accettazione delle modifiche.',
        ],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    intro:
      'NBAnima is a web app in beta testing. By using the Service you accept the following terms.',
    sections: [
      {
        title: '1. Nature of the service',
        paragraphs: [
          'NBAnima is a game for entertainment purposes.',
          'It does not involve real money betting, cash prizes, or real economic value.',
        ],
      },
      {
        title: '2. Account',
        paragraphs: [
          'Users are responsible for their account credentials.',
          'NBAnima is not responsible for unauthorized access due to user negligence.',
        ],
      },
      {
        title: '3. Proper use',
        paragraphs: ['It is forbidden to:'],
        bullets: [
          'Use bots or automated systems',
          'Attempt to bypass game rules',
          'Exploit bugs or abnormal behavior',
        ],
      },
      {
        title: 'Sanctions',
        paragraphs: ['In case of violations, the account may be suspended or removed.'],
      },
      {
        title: '4. Beta testing',
        paragraphs: ['As a beta version:'],
        bullets: [
          'Some features may change',
          'Data may be reset or modified',
          'Bugs or malfunctions may occur',
        ],
      },
      {
        title: '5. Limitation of liability',
        paragraphs: [
          'The Service is provided “as is”.',
          'NBAnima does not guarantee continuity or error-free operation.',
        ],
      },
      {
        title: '6. Changes to terms',
        paragraphs: [
          'The terms may be updated at any time.',
          'Continued use of the Service implies acceptance of changes.',
        ],
      },
    ],
  },
};

export default async function TermsOfUsePage({
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
  const content = contentByLocale[locale];

  return (
    <main className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 text-white">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/${locale}`}
            className="text-sm font-semibold text-accent-gold hover:underline"
          >
            NBAnima
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <Link
              href={`/${locale}/privacy`}
              className="font-semibold text-accent-gold hover:underline"
            >
              {dictionary.common.privacyPolicy}
            </Link>
            <Link href={`/${locale}/terms`} className="font-semibold text-white">
              {dictionary.common.termsOfUse}
            </Link>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-accent-gold/40 bg-navy-900/80 p-6 shadow-card backdrop-blur sm:p-8">
          <header className="space-y-3">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              {content.title}
            </h1>
            <p className="text-sm text-slate-300 sm:text-base">{content.intro}</p>
          </header>

          <div className="mt-6 space-y-6">
            {content.sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-lg font-semibold text-white sm:text-xl">
                  {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-sm text-slate-200 sm:text-base">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200 sm:text-base">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
