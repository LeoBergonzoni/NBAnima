// NOTE: Utility helpers to operate consistently on US/Eastern slate dates.

const EASTERN_TZ = 'America/New_York';

type TimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  offsetMinutes: number;
};

const easternFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'shortOffset',
});

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EASTERN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const resolveParts = (input: Date): TimeParts => {
  const parts = easternFormatter.formatToParts(input);
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`Missing ${type} in date parts for Eastern conversion`);
    }
    return Number.parseInt(value, 10);
  };

  const timeZoneName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT-05';
  const match = timeZoneName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    throw new Error(`Unable to parse Eastern timezone offset from "${timeZoneName}"`);
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] ?? '0', 10);
  const sign = Math.sign(hours) || (match[1].startsWith('-') ? -1 : 1);
  const offsetMinutes = hours * 60 + sign * minutes;

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    offsetMinutes,
  };
};

export const getEasternOffsetMinutes = (input: Date): number => resolveParts(input).offsetMinutes;

export const getEasternNow = (): Date => {
  const now = new Date();
  const parts = resolveParts(now);
  const utcMillis = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return new Date(utcMillis - parts.offsetMinutes * 60_000);
};

export const toEasternYYYYMMDD = (input: Date): string => {
  return dateFormatter
    .format(input)
    .split('/')
    .join('-'); // Intl en-CA yields YYYY-MM-DD
};

export const yesterdayInEastern = (): Date => {
  const easternNow = getEasternNow();
  return new Date(easternNow.getTime() - 24 * 60 * 60 * 1000);
};

export const buildLastNDatesEastern = (count: number): string[] => {
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }

  const results: string[] = [];
  let cursor = yesterdayInEastern();
  for (let i = 0; i < count; i += 1) {
    const slate = toEasternYYYYMMDD(cursor);
    if (!results.includes(slate)) {
      results.push(slate);
    }
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return results;
};

export const isSameEasternSlate = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b) && a === b;

export const EASTERN_TIMEZONE = EASTERN_TZ;

export const getSlateBoundsUtc = (slate: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(slate);
  if (!match) {
    throw new Error(`Invalid slate date format: ${slate}`);
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const sample = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetMinutes = getEasternOffsetMinutes(sample);
  const startMillis = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60_000;
  const endMillis = startMillis + 24 * 60 * 60 * 1000;

  return {
    start: new Date(startMillis).toISOString(),
    end: new Date(endMillis).toISOString(),
  };
};
