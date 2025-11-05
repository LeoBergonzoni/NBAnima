import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { toET, visibleWeekStartET, weekStartSundayET } from '../time';

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

  it('applies the visible week rule (Sunday shows previous week)', () => {
    const monday = new Date('2024-03-04T12:00:00.000Z');
    assert.equal(visibleWeekStartET(monday), '2024-03-03');

    const sunday = new Date('2024-03-03T12:00:00.000Z');
    assert.equal(visibleWeekStartET(sunday), '2024-02-25');
  });
});
