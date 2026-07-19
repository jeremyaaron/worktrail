import { describe, expect, it } from 'vitest';

import { resolveWorkItemPage } from '../src/services/work-item-page.js';

describe('work item page resolution', () => {
  it('resolves exact metadata and offset', () => {
    expect(resolveWorkItemPage({ page: 2, pageSize: 25 }, 63)).toEqual({
      metadata: {
        page: 2,
        pageSize: 25,
        totalCount: 63,
        totalPages: 3,
        hasPreviousPage: true,
        hasNextPage: true
      },
      offset: 25
    });
  });

  it('normalizes empty and stale pages', () => {
    expect(resolveWorkItemPage({ page: 8, pageSize: 10 }, 0)).toEqual({
      metadata: {
        page: 1,
        pageSize: 10,
        totalCount: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false
      },
      offset: 0
    });
    expect(resolveWorkItemPage({ page: 8, pageSize: 10 }, 23)).toEqual({
      metadata: {
        page: 3,
        pageSize: 10,
        totalCount: 23,
        totalPages: 3,
        hasPreviousPage: true,
        hasNextPage: false
      },
      offset: 20
    });
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY])('rejects invalid total count %s', (totalCount) => {
    expect(() => resolveWorkItemPage({ page: 1, pageSize: 25 }, totalCount)).toThrow(RangeError);
  });
});
