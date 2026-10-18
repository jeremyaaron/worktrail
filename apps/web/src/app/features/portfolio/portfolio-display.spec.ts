import { formatDate } from './portfolio-display';

describe('Portfolio date display', () => {
  it('formats calendar dates in UTC without changing timestamp presentation', () => {
    const formatter = spyOn(Intl, 'DateTimeFormat').and.callThrough();
    formatDate('2026-07-01');
    expect(formatter.calls.mostRecent().args[1]?.timeZone).toBe('UTC');
    formatDate('2026-07-01T12:00:00.000Z');
    expect(formatter.calls.mostRecent().args[1]?.timeZone).toBeUndefined();
    expect(formatDate(null)).toBe('No date');
  });
});
