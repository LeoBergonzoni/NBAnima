import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLastNDatesEastern,
  getEasternNow,
  getSlateBoundsUtc,
  isSameEasternSlate,
  toEasternYYYYMMDD,
  yesterdayInEastern,
} from '../date-us-eastern';

describe('date-us-eastern utilities', () => {
  it('returns yyyy-mm-dd when converting UTC midnight to Eastern slate', () => {
    const input = new Date(Date.UTC(2024, 0, 1, 5, 0, 0)); // 00:00 Eastern
    assert.equal(toEasternYYYYMMDD(input), '2024-01-01');
  });

  it('handles previous Eastern day when UTC < 05:00 during standard time', () => {
    const input = new Date(Date.UTC(2024, 0, 1, 4, 59, 0)); // 23:59 Dec 31 Eastern
    assert.equal(toEasternYYYYMMDD(input), '2023-12-31');
  });

  it('provides a fallback chain of distinct dates for recent slates', () => {
    const dates = buildLastNDatesEastern(5);
    assert.equal(dates.length, 5);
    const fallback = toEasternYYYYMMDD(yesterdayInEastern());
    assert.equal(dates[0], fallback);
    assert.equal(new Set(dates).size, dates.length);
  });

  it('compares slate identifiers safely', () => {
    assert.equal(isSameEasternSlate('2024-02-10', '2024-02-10'), true);
    assert.equal(isSameEasternSlate('2024-02-10', '2024-02-11'), false);
    assert.equal(isSameEasternSlate('2024-02-10', undefined), false);
  });

  it('computes UTC bounds for a slate respecting DST offsets', () => {
    const standard = getSlateBoundsUtc('2024-01-15');
    assert.equal(standard.start, '2024-01-15T05:00:00.000Z'); // EST offset -05:00
    assert.equal(standard.end, '2024-01-16T05:00:00.000Z');

    const dst = getSlateBoundsUtc('2024-07-04');
    assert.equal(dst.start, '2024-07-04T04:00:00.000Z'); // EDT offset -04:00
    assert.equal(dst.end, '2024-07-05T04:00:00.000Z');
  });

  it('produces Eastern now close to system now', () => {
    const easternNow = getEasternNow();
    const delta = Math.abs(easternNow.getTime() - Date.now());
    assert.ok(delta < 1000);
  });
});
