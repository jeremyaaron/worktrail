import type { ResolvedWorkItemPageQuery } from '@worktrail/contracts';

import {
  defaultWorkItemPageQuery,
  mergeWorkItemRouteParams,
  routerQueryParamsFromWorkItemPage,
  workItemPageQueryForPage,
  workItemPageQueryForPageSize,
  workItemPageQueryFromParams
} from './work-item-page-query-serialization';

describe('work item page query serialization', () => {
  it('uses defaults and omits them from canonical router params', () => {
    expect(workItemPageQueryFromParams(new URLSearchParams())).toEqual(
      defaultWorkItemPageQuery
    );
    expect(routerQueryParamsFromWorkItemPage(defaultWorkItemPageQuery)).toEqual({
      page: null,
      pageSize: null
    });
  });

  it('parses and serializes non-default page state', () => {
    const pageQuery = workItemPageQueryFromParams(
      new URLSearchParams({ page: '3', pageSize: '50' })
    );

    expect(pageQuery).toEqual({ page: 3, pageSize: 50 });
    expect(routerQueryParamsFromWorkItemPage(pageQuery)).toEqual({
      page: '3',
      pageSize: '50'
    });
  });

  it('normalizes invalid page values to page 1', () => {
    for (const page of ['0', '-1', '1.5', 'two', '', ' 2 ', '9007199254740992']) {
      expect(workItemPageQueryFromParams(new URLSearchParams({ page })).page).toBe(1);
    }
  });

  it('normalizes invalid page sizes while accepting every supported size', () => {
    for (const pageSize of ['0', '20', '26', '50.5', 'many', '', '025', ' 50 ']) {
      expect(workItemPageQueryFromParams(new URLSearchParams({ pageSize })).pageSize).toBe(25);
    }

    for (const pageSize of [10, 25, 50, 100] as const) {
      expect(
        workItemPageQueryFromParams(
          new URLSearchParams({ pageSize: String(pageSize) })
        ).pageSize
      ).toBe(pageSize);
    }
  });

  it('merges page params with durable filters without mutating the source', () => {
    const filters = {
      search: 'api',
      status: 'ready',
      page: '9',
      pageSize: null
    };

    expect(mergeWorkItemRouteParams(filters, { page: 2, pageSize: 50 })).toEqual({
      search: 'api',
      status: 'ready',
      page: '2',
      pageSize: '50'
    });
    expect(filters).toEqual({
      search: 'api',
      status: 'ready',
      page: '9',
      pageSize: null
    });
  });

  it('retains a non-default page size when page 1 is canonicalized', () => {
    expect(routerQueryParamsFromWorkItemPage({ page: 1, pageSize: 10 })).toEqual({
      page: null,
      pageSize: '10'
    });
  });

  it('changes page while preserving the current page size', () => {
    const current: ResolvedWorkItemPageQuery = { page: 2, pageSize: 50 };

    expect(workItemPageQueryForPage(current, 7)).toEqual({ page: 7, pageSize: 50 });
    expect(workItemPageQueryForPage(current, 0)).toEqual({ page: 1, pageSize: 50 });
  });

  it('resets to page 1 when page size changes', () => {
    expect(workItemPageQueryForPageSize(100)).toEqual({ page: 1, pageSize: 100 });
  });
});
