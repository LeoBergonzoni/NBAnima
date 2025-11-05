import {
  addDays,
  addHours,
  isAfter,
  isBefore,
  set as setTimeParts,
} from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

import { LOCK_WINDOW_BUFFER_MINUTES, TIMEZONES } from './constants';
import { getEasternOffsetMinutes } from './date-us-eastern';

export interface NightWindow {
  start: Date;
  end: Date;
}

export const getNextUsNightWindow = (reference = new Date()): NightWindow => {
  const easternNow = toZonedTime(reference, TIMEZONES.US_EASTERN);
  let start = setTimeParts(easternNow, { hours: 18, minutes: 0, seconds: 0, milliseconds: 0 });
  let end = addHours(start, 12);

  if (isAfter(easternNow, end)) {
    start = addDays(start, 1);
    end = addHours(start, 12);
  }

  return {
    start: fromZonedTime(start, TIMEZONES.US_EASTERN),
    end: fromZonedTime(end, TIMEZONES.US_EASTERN),
  };
};

export const isWithinLockWindow = (
  gameDate: Date,
  now = new Date(),
  bufferMinutes = LOCK_WINDOW_BUFFER_MINUTES,
) => {
  const lockStart = addHours(gameDate, -bufferMinutes / 60);
  return isAfter(now, lockStart);
};

export const isBetween = (date: Date, [start, end]: [Date, Date]) =>
  (isAfter(date, start) || date.getTime() === start.getTime()) &&
  (isBefore(date, end) || date.getTime() === end.getTime());

const MILLISECONDS_PER_MINUTE = 60_000;

const formatEtDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toET = (date: Date): Date => {
  const offsetMinutes = getEasternOffsetMinutes(date);
  return new Date(date.getTime() + offsetMinutes * MILLISECONDS_PER_MINUTE);
};

const startOfDayET = (date: Date): Date => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

export const weekStartSundayET = (date: Date): string => {
  const easternDate = toET(date);
  const start = startOfDayET(easternDate);
  const dayOfWeek = easternDate.getUTCDay();
  start.setUTCDate(start.getUTCDate() - dayOfWeek);
  return formatEtDate(start);
};

export const visibleWeekStartET = (now = new Date()): string => {
  const easternNow = toET(now);
  const start = startOfDayET(easternNow);
  const dayOfWeek = easternNow.getUTCDay();
  const offsetDays = dayOfWeek === 0 ? 7 : dayOfWeek;
  start.setUTCDate(start.getUTCDate() - offsetDays);
  return formatEtDate(start);
};
