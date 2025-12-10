"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visibleWeekStartET = exports.weeklyXpWeekContext = exports.mondayFromSundayWeekStart = exports.weekStartMondayET = exports.weekStartSundayET = exports.toET = exports.isBetween = exports.isWithinLockWindow = exports.getNextUsNightWindow = void 0;
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
const constants_1 = require("./constants");
const date_us_eastern_1 = require("./date-us-eastern");
const getNextUsNightWindow = (reference = new Date()) => {
    const easternNow = (0, date_fns_tz_1.toZonedTime)(reference, constants_1.TIMEZONES.US_EASTERN);
    let start = (0, date_fns_1.set)(easternNow, { hours: 18, minutes: 0, seconds: 0, milliseconds: 0 });
    let end = (0, date_fns_1.addHours)(start, 12);
    if ((0, date_fns_1.isAfter)(easternNow, end)) {
        start = (0, date_fns_1.addDays)(start, 1);
        end = (0, date_fns_1.addHours)(start, 12);
    }
    return {
        start: (0, date_fns_tz_1.fromZonedTime)(start, constants_1.TIMEZONES.US_EASTERN),
        end: (0, date_fns_tz_1.fromZonedTime)(end, constants_1.TIMEZONES.US_EASTERN),
    };
};
exports.getNextUsNightWindow = getNextUsNightWindow;
const isWithinLockWindow = (gameDate, now = new Date(), bufferMinutes = constants_1.LOCK_WINDOW_BUFFER_MINUTES) => {
    const lockStart = (0, date_fns_1.addHours)(gameDate, -bufferMinutes / 60);
    return (0, date_fns_1.isAfter)(now, lockStart);
};
exports.isWithinLockWindow = isWithinLockWindow;
const isBetween = (date, [start, end]) => ((0, date_fns_1.isAfter)(date, start) || date.getTime() === start.getTime()) &&
    ((0, date_fns_1.isBefore)(date, end) || date.getTime() === end.getTime());
exports.isBetween = isBetween;
const MILLISECONDS_PER_MINUTE = 60_000;
const formatEtDate = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const toET = (date) => {
    const offsetMinutes = (0, date_us_eastern_1.getEasternOffsetMinutes)(date);
    return new Date(date.getTime() + offsetMinutes * MILLISECONDS_PER_MINUTE);
};
exports.toET = toET;
const startOfDayET = (date) => {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return start;
};
const weekStartSundayET = (date) => {
    const easternDate = (0, exports.toET)(date);
    const start = startOfDayET(easternDate);
    const dayOfWeek = easternDate.getUTCDay();
    start.setUTCDate(start.getUTCDate() - dayOfWeek);
    return formatEtDate(start);
};
exports.weekStartSundayET = weekStartSundayET;
const weekStartMondayET = (date) => {
    const easternDate = (0, exports.toET)(date);
    const start = startOfDayET(easternDate);
    const dayOfWeek = easternDate.getUTCDay();
    const offsetDays = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start.setUTCDate(start.getUTCDate() - offsetDays);
    return formatEtDate(start);
};
exports.weekStartMondayET = weekStartMondayET;
const parseUtcDateFromIso = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
};
const mondayFromSundayWeekStart = (weekStartSunday) => {
    const sundayUtc = parseUtcDateFromIso(weekStartSunday);
    const mondayUtc = (0, date_fns_1.addDays)(sundayUtc, 1);
    return formatEtDate(mondayUtc);
};
exports.mondayFromSundayWeekStart = mondayFromSundayWeekStart;
const weeklyXpWeekContext = (now = new Date(), options) => {
    const easternNow = (0, exports.toET)(now);
    const dayOfWeek = easternNow.getUTCDay();
    if (dayOfWeek === 0 && options?.sundayResetAt) {
        const thisSunday = (0, exports.weekStartSundayET)(easternNow);
        const previousSunday = formatEtDate((0, date_fns_1.addDays)(parseUtcDateFromIso(thisSunday), -7));
        const hasReset = now.getTime() >= options.sundayResetAt.getTime();
        const storageWeekStart = hasReset ? thisSunday : previousSunday;
        return {
            storageWeekStart,
            displayWeekStart: (0, exports.weekStartMondayET)(parseUtcDateFromIso(storageWeekStart)),
        };
    }
    const storageReference = dayOfWeek === 0 ? (0, date_fns_1.addDays)(easternNow, -1) : easternNow;
    return {
        storageWeekStart: (0, exports.weekStartSundayET)(storageReference),
        rolloverWeekStart: dayOfWeek === 0 ? (0, exports.weekStartSundayET)(easternNow) : undefined,
        displayWeekStart: (0, exports.weekStartMondayET)(easternNow),
    };
};
exports.weeklyXpWeekContext = weeklyXpWeekContext;
const visibleWeekStartET = (now = new Date()) => (0, exports.weeklyXpWeekContext)(now).storageWeekStart;
exports.visibleWeekStartET = visibleWeekStartET;
