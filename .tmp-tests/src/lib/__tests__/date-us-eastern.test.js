"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const date_us_eastern_1 = require("../date-us-eastern");
(0, node_test_1.describe)('date-us-eastern utilities', () => {
    (0, node_test_1.it)('returns yyyy-mm-dd when converting UTC midnight to Eastern slate', () => {
        const input = new Date(Date.UTC(2024, 0, 1, 5, 0, 0)); // 00:00 Eastern
        strict_1.default.equal((0, date_us_eastern_1.toEasternYYYYMMDD)(input), '2024-01-01');
    });
    (0, node_test_1.it)('handles previous Eastern day when UTC < 05:00 during standard time', () => {
        const input = new Date(Date.UTC(2024, 0, 1, 4, 59, 0)); // 23:59 Dec 31 Eastern
        strict_1.default.equal((0, date_us_eastern_1.toEasternYYYYMMDD)(input), '2023-12-31');
    });
    (0, node_test_1.it)('provides a fallback chain of distinct dates for recent slates', () => {
        const dates = (0, date_us_eastern_1.buildLastNDatesEastern)(5);
        strict_1.default.equal(dates.length, 5);
        const fallback = (0, date_us_eastern_1.toEasternYYYYMMDD)((0, date_us_eastern_1.yesterdayInEastern)());
        strict_1.default.equal(dates[0], fallback);
        strict_1.default.equal(new Set(dates).size, dates.length);
    });
    (0, node_test_1.it)('compares slate identifiers safely', () => {
        strict_1.default.equal((0, date_us_eastern_1.isSameEasternSlate)('2024-02-10', '2024-02-10'), true);
        strict_1.default.equal((0, date_us_eastern_1.isSameEasternSlate)('2024-02-10', '2024-02-11'), false);
        strict_1.default.equal((0, date_us_eastern_1.isSameEasternSlate)('2024-02-10', undefined), false);
    });
    (0, node_test_1.it)('computes UTC bounds for a slate respecting DST offsets', () => {
        const standard = (0, date_us_eastern_1.getSlateBoundsUtc)('2024-01-15');
        strict_1.default.equal(standard.start, '2024-01-15T05:00:00.000Z'); // EST offset -05:00
        strict_1.default.equal(standard.end, '2024-01-16T05:00:00.000Z');
        const dst = (0, date_us_eastern_1.getSlateBoundsUtc)('2024-07-04');
        strict_1.default.equal(dst.start, '2024-07-04T04:00:00.000Z'); // EDT offset -04:00
        strict_1.default.equal(dst.end, '2024-07-05T04:00:00.000Z');
    });
    (0, node_test_1.it)('produces Eastern now close to system now', () => {
        const easternNow = (0, date_us_eastern_1.getEasternNow)();
        const delta = Math.abs(easternNow.getTime() - Date.now());
        strict_1.default.ok(delta < 1000);
    });
});
