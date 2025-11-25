import clsx from 'clsx';
import { UserRound } from 'lucide-react';
import Link from 'next/link';

import type { Locale } from '@/lib/constants';

type UserNavButtonProps = {
  locale: Locale;
  label: string;
  className?: string;
  iconClassName?: string;
};

export const UserNavButton = ({ locale, label, className, iconClassName }: UserNavButtonProps) => (
  <Link
    href={`/${locale}/user`}
    className={clsx(
      'inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:border-accent-gold/50 hover:text-accent-gold',
      className,
    )}
    aria-label={label}
  >
    <UserRound className={clsx('h-4 w-4', iconClassName)} />
    <span className="sr-only">{label}</span>
  </Link>
);
