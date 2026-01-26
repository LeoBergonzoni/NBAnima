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
    title: 'Privacy Policy',
    intro:
      'NBAnima (“il Servizio”) è una web app in fase di beta testing dedicata a giochi, picks e collezione di carte virtuali a tema NBA.',
    sections: [
      {
        title: '1. Titolare del trattamento',
        paragraphs: [
          'Il titolare del trattamento dei dati è il proprietario del progetto NBAnima.',
          'Per qualsiasi richiesta è possibile contattare: support@stru-menti.com',
        ],
      },
      {
        title: '2. Dati raccolti',
        paragraphs: ['Durante la registrazione e l’utilizzo del Servizio possono essere raccolti:'],
        bullets: [
          'Email',
          'Nome utente',
          'Password (gestita in forma criptata tramite Supabase)',
          'Dati di utilizzo interni all’app (picks effettuate, carte collezionate, progressi di gioco)',
        ],
      },
      {
        title: '3. Finalità del trattamento',
        paragraphs: ['I dati vengono utilizzati esclusivamente per:'],
        bullets: [
          'Consentire la creazione e gestione dell’account',
          'Salvare e sincronizzare picks e collezioni',
          'Migliorare il Servizio durante la fase di beta testing',
          'Fornire supporto tecnico agli utenti',
        ],
      },
      {
        title: '4. Base giuridica',
        paragraphs: [
          'Il trattamento dei dati avviene sulla base del consenso dell’utente e dell’esecuzione del Servizio richiesto.',
        ],
      },
      {
        title: '5. Conservazione dei dati',
        paragraphs: [
          'I dati vengono conservati finché l’account rimane attivo.',
          'L’utente può richiedere la cancellazione dell’account e dei dati associati scrivendo a support@stru-menti.com.',
        ],
      },
      {
        title: '6. Condivisione dei dati',
        paragraphs: [
          'I dati non vengono venduti né condivisi con terze parti, ad eccezione dei servizi tecnici necessari al funzionamento dell’app (es. Supabase).',
        ],
      },
      {
        title: '7. Diritti dell’utente',
        paragraphs: ['L’utente può in qualsiasi momento:'],
        bullets: ['Accedere ai propri dati', 'Chiederne la modifica o cancellazione', 'Revocare il consenso'],
      },
      {
        title: '8. Modifiche',
        paragraphs: [
          'La presente Privacy Policy può essere aggiornata. In caso di modifiche rilevanti gli utenti verranno informati.',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    intro:
      'NBAnima (the “Service”) is a web app in beta testing dedicated to games, picks, and a collection of virtual NBA-themed cards.',
    sections: [
      {
        title: '1. Data Controller',
        paragraphs: [
          'The data controller is the owner of the NBAnima project.',
          'For any request you can contact: support@stru-menti.com',
        ],
      },
      {
        title: '2. Data collected',
        paragraphs: ['During registration and use of the Service we may collect:'],
        bullets: [
          'Email',
          'Username',
          'Password (handled in encrypted form via Supabase)',
          'In-app usage data (picks made, collected cards, game progress)',
        ],
      },
      {
        title: '3. Purpose of processing',
        paragraphs: ['Data are used exclusively to:'],
        bullets: [
          'Enable account creation and management',
          'Save and sync picks and collections',
          'Improve the Service during beta testing',
          'Provide technical support to users',
        ],
      },
      {
        title: '4. Legal basis',
        paragraphs: [
          'Data are processed on the basis of user consent and execution of the requested Service.',
        ],
      },
      {
        title: '5. Data retention',
        paragraphs: [
          'Data are stored as long as the account remains active.',
          'Users can request deletion of the account and related data by writing to support@stru-menti.com.',
        ],
      },
      {
        title: '6. Data sharing',
        paragraphs: [
          'Data are not sold or shared with third parties, except for technical services necessary to operate the app (e.g., Supabase).',
        ],
      },
      {
        title: '7. User rights',
        paragraphs: ['Users can at any time:'],
        bullets: ['Access their data', 'Request modification or deletion', 'Withdraw consent'],
      },
      {
        title: '8. Changes',
        paragraphs: [
          'This Privacy Policy may be updated. In case of significant changes, users will be informed.',
        ],
      },
    ],
  },
};

export default async function PrivacyPolicyPage({
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
            <Link href={`/${locale}/privacy`} className="font-semibold text-white">
              {dictionary.common.privacyPolicy}
            </Link>
            <Link
              href={`/${locale}/terms`}
              className="font-semibold text-accent-gold hover:underline"
            >
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
