import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  mondayFromSundayWeekStart,
  toET,
  visibleWeekStartET,
  weekStartMondayET,
  weekStartSundayET,
  weeklyXpWeekContext,
} from '../time';

describe('time helpers (Eastern weeks)', () => {
  it('converts instants to Eastern wall time via toET', () => {
    const utc = new Date('2024-03-04T15:00:00.000Z'); // 10:00 ET
    const eastern = toET(utc);
    assert.equal(eastern.getUTCFullYear(), 2024);
    assert.equal(eastern.getUTCMonth(), 2); // March
    assert.equal(eastern.getUTCDate(), 4);
    assert.equal(eastern.getUTCHours(), 10);
  });

  it('computes the Sunday start for an Eastern week', () => {
    const monday = new Date('2024-03-04T12:00:00.000Z'); // Monday morning ET
    assert.equal(weekStartSundayET(monday), '2024-03-03');

    const sunday = new Date('2024-03-03T20:00:00.000Z'); // Sunday evening ET
    assert.equal(weekStartSundayET(sunday), '2024-03-03');
  });

  it('keeps the visible week start anchored to the stored Sunday start', () => {
    const monday = new Date('2024-03-04T12:00:00.000Z');
    assert.equal(visibleWeekStartET(monday), '2024-03-03');

    const sunday = new Date('2024-03-03T12:00:00.000Z');
    assert.equal(visibleWeekStartET(sunday), '2024-02-25');
  });

  it('computes Monday-based week starts', () => {
    const monday = new Date('2024-03-04T12:00:00.000Z');
    assert.equal(weekStartMondayET(monday), '2024-03-04');

    const sunday = new Date('2024-03-10T12:00:00.000Z');
    assert.equal(weekStartMondayET(sunday), '2024-03-04');
  });

  it('provides weekly XP context with Sunday rollover handling', () => {
    const sunday = new Date('2024-03-10T12:00:00.000Z');
    const sundayContext = weeklyXpWeekContext(sunday);
    assert.equal(sundayContext.storageWeekStart, '2024-03-03');
    assert.equal(sundayContext.rolloverWeekStart, '2024-03-10');
    assert.equal(sundayContext.displayWeekStart, '2024-03-04');

    const tuesday = new Date('2024-03-12T12:00:00.000Z');
    const weekdayContext = weeklyXpWeekContext(tuesday);
    assert.equal(weekdayContext.storageWeekStart, '2024-03-10');
    assert.equal(weekdayContext.rolloverWeekStart, undefined);
    assert.equal(weekdayContext.displayWeekStart, '2024-03-11');
  });

  it('derives Monday labels from stored Sunday week starts', () => {
    assert.equal(mondayFromSundayWeekStart('2024-03-03'), '2024-03-04');
    assert.equal(mondayFromSundayWeekStart('2024-03-10'), '2024-03-11');
  });
});
