import { describe, expect, it } from 'vitest';
import { workItemQueryEntries, workItemQueryFieldPolicy } from './work-item-query-policy.js';
import { queryFieldExamples, queryParityFixtures } from './fixtures/work-query-fixtures.js';
import { addDays, createRiskTimeWindow, isDueSoonDueDate, isOverdueDueDate, isStaleInProgressStatus } from './work-risk-policy.js';
import { snapshotCountLabel } from './snapshot-policy.js';

describe('live query policy and UTC risk boundaries', () => {
  it('covers every field with scope, encoding, and a stable display key', () => {
    expect(Object.keys(workItemQueryFieldPolicy).sort()).toEqual(Object.keys(queryFieldExamples).sort());
    expect(workItemQueryFieldPolicy.blocked.encoding).toBe('boolean');
    expect(Object.entries(workItemQueryFieldPolicy).filter(([, value]) => value.scope === 'workspace').map(([key]) => key))
      .toEqual(['projectId', 'archivedProjects']);
  });
  it.each(queryParityFixtures)('serializes $name without truthiness omissions', ({ query }) => {
    const values = Object.fromEntries(workItemQueryEntries(query, 'workspace', false));
    expect(values).toEqual(Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])));
  });
  it('omits defaults and workspace fields only where intended', () => {
    expect(workItemQueryEntries({ archivedProjects: 'exclude', sort: 'updated_desc', blocked: false }, 'workspace')).toEqual([['blocked', 'false']]);
    expect(workItemQueryEntries({ projectId: queryFieldExamples.projectId, archivedProjects: 'include' }, 'project')).toEqual([]);
  });
  it.each(['2026-03-08T06:30:00Z', '2026-11-01T05:30:00Z', '2026-10-17T23:59:59Z', '2026-10-18T00:00:00Z'])(
    'uses UTC day arithmetic across DST and midnight at %s', (value) => {
      const now = new Date(value), window = createRiskTimeWindow(now);
      expect(addDays(now, 7).getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
      expect(now.getTime() - window.staleCutoff.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
      expect(isOverdueDueDate(window.today, window.today)).toBe(false);
      expect(isDueSoonDueDate(window.today, window.today, window.dueSoonEnd)).toBe(true);
      expect(isDueSoonDueDate(window.dueSoonEnd, window.today, window.dueSoonEnd)).toBe(true);
      expect(isDueSoonDueDate(addDays(now, 8).toISOString().slice(0, 10), window.today, window.dueSoonEnd)).toBe(false);
      expect(isStaleInProgressStatus('in_progress', window.staleCutoff, window.staleCutoff)).toBe(false);
      expect(isStaleInProgressStatus('in_progress', new Date(window.staleCutoff.getTime() - 1), window.staleCutoff)).toBe(true);
    }
  );
  it('does not fabricate a historical unit and distinguishes scope conditions from tickets', () => {
    expect(snapshotCountLabel({ count: 2 })).toBe('2');
    expect(snapshotCountLabel({ count: 1, countUnit: 'scope_conditions' })).toBe('1 scope condition');
    expect(snapshotCountLabel({ count: 2, countUnit: 'estimate_points' })).toBe('2 estimate points');
  });
});
