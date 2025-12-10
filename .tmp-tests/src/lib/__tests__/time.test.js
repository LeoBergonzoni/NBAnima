"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const time_1 = require("../time");
(0, node_test_1.describe)('time helpers (Eastern weeks)', () => {
    (0, node_test_1.it)('converts instants to Eastern wall time via toET', () => {
        const utc = new Date('2024-03-04T15:00:00.000Z'); // 10:00 ET
        const eastern = (0, time_1.toET)(utc);
        strict_1.default.equal(eastern.getUTCFullYear(), 2024);
        strict_1.default.equal(eastern.getUTCMonth(), 2); // March
        strict_1.default.equal(eastern.getUTCDate(), 4);
        strict_1.default.equal(eastern.getUTCHours(), 10);
    });
    (0, node_test_1.it)('computes the Sunday start for an Eastern week', () => {
        const monday = new Date('2024-03-04T12:00:00.000Z'); // Monday morning ET
        strict_1.default.equal((0, time_1.weekStartSundayET)(monday), '2024-03-03');
        const sunday = new Date('2024-03-03T20:00:00.000Z'); // Sunday evening ET
        strict_1.default.equal((0, time_1.weekStartSundayET)(sunday), '2024-03-03');
    });
    (0, node_test_1.it)('keeps the visible week start anchored to the stored Sunday start', () => {
        const monday = new Date('2024-03-04T12:00:00.000Z');
        strict_1.default.equal((0, time_1.visibleWeekStartET)(monday), '2024-03-03');
        const sunday = new Date('2024-03-03T12:00:00.000Z');
        strict_1.default.equal((0, time_1.visibleWeekStartET)(sunday), '2024-02-25');
    });
    (0, node_test_1.it)('computes Monday-based week starts', () => {
        const monday = new Date('2024-03-04T12:00:00.000Z');
        strict_1.default.equal((0, time_1.weekStartMondayET)(monday), '2024-03-04');
        const sunday = new Date('2024-03-10T12:00:00.000Z');
        strict_1.default.equal((0, time_1.weekStartMondayET)(sunday), '2024-03-04');
    });
    (0, node_test_1.it)('provides weekly XP context with Sunday rollover handling', () => {
        const sunday = new Date('2024-03-10T12:00:00.000Z');
        const sundayContext = (0, time_1.weeklyXpWeekContext)(sunday);
        strict_1.default.equal(sundayContext.storageWeekStart, '2024-03-03');
        strict_1.default.equal(sundayContext.rolloverWeekStart, '2024-03-10');
        strict_1.default.equal(sundayContext.displayWeekStart, '2024-03-04');
        const tuesday = new Date('2024-03-12T12:00:00.000Z');
        const weekdayContext = (0, time_1.weeklyXpWeekContext)(tuesday);
        strict_1.default.equal(weekdayContext.storageWeekStart, '2024-03-10');
        strict_1.default.equal(weekdayContext.rolloverWeekStart, undefined);
        strict_1.default.equal(weekdayContext.displayWeekStart, '2024-03-11');
    });
    (0, node_test_1.it)('resets on Sunday at the provided lock threshold', () => {
        const lockAt = new Date('2024-03-10T17:00:00.000Z'); // 13:00 ET
        const sundayBefore = new Date('2024-03-10T16:00:00.000Z'); // before lock
        const beforeContext = (0, time_1.weeklyXpWeekContext)(sundayBefore, { sundayResetAt: lockAt });
        strict_1.default.equal(beforeContext.storageWeekStart, '2024-03-03');
        strict_1.default.equal(beforeContext.displayWeekStart, '2024-03-04');
        const sundayAfter = new Date('2024-03-10T17:05:00.000Z'); // after lock
        const afterContext = (0, time_1.weeklyXpWeekContext)(sundayAfter, { sundayResetAt: lockAt });
        strict_1.default.equal(afterContext.storageWeekStart, '2024-03-10');
        strict_1.default.equal(afterContext.displayWeekStart, '2024-03-11');
    });
    (0, node_test_1.it)('derives Monday labels from stored Sunday week starts', () => {
        strict_1.default.equal((0, time_1.mondayFromSundayWeekStart)('2024-03-03'), '2024-03-04');
        strict_1.default.equal((0, time_1.mondayFromSundayWeekStart)('2024-03-10'), '2024-03-11');
    });
});
