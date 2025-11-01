'use client';

import clsx from 'clsx';

import { TIMEZONES } from '@/lib/constants';

const DATE_NY = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONES.US_EASTERN,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATETIME_NY = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONES.US_EASTERN,
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const normalizeInput = (value?: string | number | Date | null) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const byNumber = new Date(value);
    return Number.isNaN(byNumber.getTime()) ? null : byNumber;
  }
  const stringValue = (value ?? '').toString().trim();
  if (!stringValue) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    const parsed = new Date(`${stringValue}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateNy = (value?: string | number | Date | null, fallback = '—') => {
  const date = normalizeInput(value);
  return date ? DATE_NY.format(date) : fallback;
};

export const formatDateTimeNy = (
  value?: string | number | Date | null,
  fallback = '—',
) => {
  const date = normalizeInput(value);
  return date ? DATETIME_NY.format(date) : fallback;
};

const normalizeId = (value?: string | null) => (value ?? '').trim().toLowerCase();

export const matchesTeamIdentity = (
  left?: { id?: string | null; abbr?: string | null },
  right?: { id?: string | null; abbr?: string | null },
) => {
  if (!left || !right) {
    return false;
  }
  const leftId = normalizeId(left.id);
  const rightId = normalizeId(right.id);
  if (leftId && rightId && leftId === rightId) {
    return true;
  }
  const leftAbbr = normalizeId(left.abbr);
  const rightAbbr = normalizeId(right.abbr);
  return Boolean(leftAbbr && rightAbbr && leftAbbr === rightAbbr);
};

export const combineName = (
  first?: string | null,
  last?: string | null,
  fallback = '—',
) => {
  const value = [first ?? '', last ?? ''].join(' ').trim();
  return value || fallback;
};

export const TeamAbbrPill = ({
  abbr,
  variant = 'neutral',
}: {
  abbr?: string | null;
  variant?: 'neutral' | 'home' | 'away';
}) => (
  <span
    className={clsx(
      'inline-flex min-w-[2.5rem] items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
      variant === 'home'
        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
        : variant === 'away'
          ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
          : 'border-white/15 bg-white/5 text-slate-200',
    )}
  >
    {abbr ?? '—'}
  </span>
);

export const TeamSideBadge = ({ side }: { side: 'home' | 'away' }) => (
  <span
    className={clsx(
      'ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
      side === 'home'
        ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30'
        : 'bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30',
    )}
  >
    {side}
  </span>
);
