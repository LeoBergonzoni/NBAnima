import clsx from 'clsx';
import { UserRound } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import type { Locale } from '@/lib/constants';

type UserNavButtonProps = {
  locale: Locale;
  label: string;
  avatarUrl?: string | null;
  className?: string;
  iconClassName?: string;
};

export const UserNavButton = ({
  locale,
  label,
  avatarUrl,
  className,
  iconClassName,
}: UserNavButtonProps) => (
  <Link
    href={`/${locale}/user`}
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:border-accent-gold/50 hover:text-accent-gold',
      className,
    )}
    aria-label={label}
  >
    {avatarUrl ? (
      <span className="relative h-6 w-6 overflow-hidden rounded-full border border-white/20">
        <Image src={avatarUrl} alt="" fill sizes="24px" className="object-cover" />
      </span>
    ) : (
      <UserRound className={clsx('h-4 w-4', iconClassName)} />
    )}
    <span className="hidden md:inline">{label}</span>
    <span className="sr-only">{label}</span>
  </Link>
);
