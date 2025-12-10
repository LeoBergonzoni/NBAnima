"use strict";
// NOTE: Utility helpers to operate consistently on US/Eastern slate dates.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSlateBoundsUtc = exports.EASTERN_TIMEZONE = exports.isSameEasternSlate = exports.buildLastNDatesEastern = exports.yesterdayInEastern = exports.toEasternYYYYMMDD = exports.getEasternNow = exports.getEasternOffsetMinutes = void 0;
const EASTERN_TZ = 'America/New_York';
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
const resolveParts = (input) => {
    const parts = easternFormatter.formatToParts(input);
    const get = (type) => {
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
const getEasternOffsetMinutes = (input) => resolveParts(input).offsetMinutes;
exports.getEasternOffsetMinutes = getEasternOffsetMinutes;
const getEasternNow = () => {
    const now = new Date();
    const parts = resolveParts(now);
    const utcMillis = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return new Date(utcMillis - parts.offsetMinutes * 60_000);
};
exports.getEasternNow = getEasternNow;
const toEasternYYYYMMDD = (input) => {
    return dateFormatter
        .format(input)
        .split('/')
        .join('-'); // Intl en-CA yields YYYY-MM-DD
};
exports.toEasternYYYYMMDD = toEasternYYYYMMDD;
const yesterdayInEastern = () => {
    const easternNow = (0, exports.getEasternNow)();
    return new Date(easternNow.getTime() - 24 * 60 * 60 * 1000);
};
exports.yesterdayInEastern = yesterdayInEastern;
const buildLastNDatesEastern = (count) => {
    if (!Number.isFinite(count) || count <= 0) {
        return [];
    }
    const results = [];
    let cursor = (0, exports.yesterdayInEastern)();
    for (let i = 0; i < count; i += 1) {
        const slate = (0, exports.toEasternYYYYMMDD)(cursor);
        if (!results.includes(slate)) {
            results.push(slate);
        }
        cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    }
    return results;
};
exports.buildLastNDatesEastern = buildLastNDatesEastern;
const isSameEasternSlate = (a, b) => Boolean(a && b) && a === b;
exports.isSameEasternSlate = isSameEasternSlate;
exports.EASTERN_TIMEZONE = EASTERN_TZ;
const getSlateBoundsUtc = (slate) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(slate);
    if (!match) {
        throw new Error(`Invalid slate date format: ${slate}`);
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    const sample = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const offsetMinutes = (0, exports.getEasternOffsetMinutes)(sample);
    const startMillis = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60_000;
    const endMillis = startMillis + 24 * 60 * 60 * 1000;
    return {
        start: new Date(startMillis).toISOString(),
        end: new Date(endMillis).toISOString(),
    };
};
exports.getSlateBoundsUtc = getSlateBoundsUtc;
