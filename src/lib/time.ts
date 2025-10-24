import {
  addDays,
  addHours,
  isAfter,
  isBefore,
  set as setTimeParts,
} from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

import { LOCK_WINDOW_BUFFER_MINUTES, TIMEZONES } from './constants';

export interface NightWindow {
  start: Date;
  end: Date;
}

export const getNextUsNightWindow = (reference = new Date()): NightWindow => {
  const easternNow = utcToZonedTime(reference, TIMEZONES.US_EASTERN);
  let start = setTimeParts(easternNow, { hours: 18, minutes: 0, seconds: 0, milliseconds: 0 });
  let end = addHours(start, 12);

  if (isAfter(easternNow, end)) {
    start = addDays(start, 1);
    end = addHours(start, 12);
  }

  return {
    start: zonedTimeToUtc(start, TIMEZONES.US_EASTERN),
    end: zonedTimeToUtc(end, TIMEZONES.US_EASTERN),
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
