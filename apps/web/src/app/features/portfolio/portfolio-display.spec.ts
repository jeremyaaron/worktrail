import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatDate } from './portfolio-display';

describe('Portfolio date display', () => {
  it('formats calendar dates in UTC without changing timestamp presentation', () => {
    const DateTimeFormat = Intl.DateTimeFormat;
    const formatter = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (locales, options) {
      return new DateTimeFormat(locales, options);
    });
    formatDate('2026-07-01');
    expect(formatter.mock.lastCall![1]?.timeZone).toBe('UTC');
    formatDate('2026-07-01T12:00:00.000Z');
    expect(formatter.mock.lastCall![1]?.timeZone).toBeUndefined();
    expect(formatDate(null)).toBe('No date');
  });
});


afterEach(() => vi.restoreAllMocks());
