import type { Metadata } from 'next';
import localFont from 'next/font/local';

import './globals.css';
import { RosterPreload } from '@/components/providers/roster-preload';
import { ServiceWorkerRegister } from '@/components/providers/service-worker-register';
import { APP_TITLE } from '@/lib/constants';

const geist = localFont({
  src: [
    {
      path: '../../public/fonts/geist/GeistVF.woff2',
      weight: '100 900',
      style: 'normal',
    },
  ],
  variable: '--font-geist',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Arial'],
  display: 'swap',
});

const geistMono = localFont({
  src: [
    {
      path: '../../public/fonts/geist/GeistMonoVF.woff2',
      weight: '100 900',
      style: 'normal',
    },
  ],
  variable: '--font-geist-mono',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${APP_TITLE} · NBA picks & cards platform`,
  description:
    'Gioca con le notti NBA, ottieni Anima Points e colleziona carte esclusive.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body
        className="antialiased bg-navy-950 text-slate-100"
      >
        <RosterPreload />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
