'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { Home, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import type { Locale } from '@/lib/constants';

type DashboardMobileNavProps = {
  locale: Locale;
};

export const DashboardMobileNav = ({ locale }: DashboardMobileNavProps) => {
  const pathname = usePathname();

  const isCards = pathname?.startsWith(`/${locale}/dashboard/trading-cards`);
  const isUser = pathname?.startsWith(`/${locale}/user`);
  const isHome = pathname?.startsWith(`/${locale}/dashboard`) && !isCards;

  const items: Array<{
    key: 'cards' | 'home' | 'user';
    href: string;
    label: string;
    active: boolean;
    render: (active: boolean) => ReactNode;
  }> = [
    {
      key: 'cards',
      href: `/${locale}/dashboard/trading-cards`,
      label: locale === 'it' ? 'Carte' : 'Cards',
      active: isCards,
      render: (active: boolean) => (
        <span
          className={clsx(
            'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[7px] border',
            active ? 'border-navy-900/70 bg-white/10' : 'border-white/15 bg-white/5',
          )}
          aria-hidden
        >
          <Image
            src="/NBAnimaTradingCards.png"
            alt=""
            fill
            sizes="24px"
            className="object-cover"
            priority={false}
          />
        </span>
      ),
    },
    {
      key: 'home',
      href: `/${locale}/dashboard`,
      label: 'Home',
      active: isHome,
      render: (active: boolean) => (
        <Home className={clsx('h-5 w-5', active ? 'stroke-[2.5]' : 'stroke-[2]')} />
      ),
    },
    {
      key: 'user',
      href: `/${locale}/user`,
      label: locale === 'it' ? 'Profilo' : 'User',
      active: isUser,
      render: (active: boolean) => (
        <UserRound className={clsx('h-5 w-5', active ? 'stroke-[2.5]' : 'stroke-[2]')} />
      ),
    },
  ];

  const navLabel = locale === 'it' ? 'Navigazione dashboard' : 'Dashboard navigation';

  return (
    <nav
      className="fixed inset-x-4 bottom-4 z-30 sm:hidden"
      aria-label={navLabel}
    >
      <div className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-white/10 bg-navy-900/90 px-2.5 py-2 shadow-card backdrop-blur-md">
        {items.map(({ key, href, label, active, render }) => (
          <Link
            key={key}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'group relative flex items-center justify-center rounded-xl transition',
              key === 'home' ? 'p-3.5' : 'p-3',
              active
                ? 'bg-accent-gold text-navy-900 shadow-[0_10px_40px_rgba(212,175,55,0.28)]'
                : 'text-slate-300 hover:text-white',
            )}
          >
            {render(active)}
            <span className="sr-only">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};
