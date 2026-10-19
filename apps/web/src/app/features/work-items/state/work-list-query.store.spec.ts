import { describe, expect, it } from 'vitest';

import { WorkListQueryStore } from './work-list-query.store';

describe('WorkListQueryStore', () => {
  for (const scope of ['project', 'workspace'] as const) {
    it(scope + ': announces only accepted latest query results and ignores pending form changes', () => {
      const store = scope === 'project' ? WorkListQueryStore.project() : WorkListQueryStore.workspace();
      const metadata = { page: 1, pageSize: 25 as const, totalCount: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
      store.applyQuery({ status: 'ready' });
      const old = store.beginResultsLoad();
      store.applyQuery({ status: 'blocked' });
      const current = store.beginResultsLoad();
      store.acceptResults(old, metadata, 2);
      expect(store.resultsSummary()).toBeNull();
      store.acceptResults(current, metadata, 2);
      expect(store.resultsSummary()).toBe('Results updated: 1-2 of 2 work items.');
      store.setPendingFilterValues({ ...store.pendingFilterValues(), projectId: '', archivedProjects: 'exclude', search: 'Unapplied' });
      expect(store.resultsSummary()).toBe('Results updated: 1-2 of 2 work items.');
      store.applyRouteQueryParams(new URLSearchParams({ status: 'blocked', page: '2' }));
      expect(store.resultsSummary()).toBeNull();
      store.acceptResults(current, metadata, 2);
      expect(store.resultsSummary()).toBeNull();
    });
  }
  it('derives project active and pending query state from route params', () => {
    const store = WorkListQueryStore.project();
    const params = new URLSearchParams({
      search: 'release',
      status: 'blocked',
      labelId: 'label-1',
      sort: 'priority_desc'
    });

    const filters = store.applyRouteQueryParams(params);

    expect(filters).toEqual(
      expect.objectContaining({
        search: 'release',
        status: 'blocked',
        labelId: 'label-1',
        sort: 'priority_desc'
      })
    );
    expect(store.activeQuery()).toEqual(
      expect.objectContaining({
        search: 'release',
        status: 'blocked',
        labelId: 'label-1',
        sort: 'priority_desc'
      })
    );
    expect(store.pendingFilterValues()).toEqual(store.activeFilterValues());
  });

  it('keeps pending filter edits separate from the active query until navigation applies them', () => {
    const store = WorkListQueryStore.workspace();

    store.applyRouteQueryParams(new URLSearchParams({ search: 'current' }));
    store.setPendingFilterValues({
      ...store.pendingFilterValues(),
      search: 'pending',
      projectId: 'project-1'
    });

    expect(store.activeQuery()).toEqual({ search: 'current' });
    expect(store.pendingQuery()).toEqual({ search: 'pending', projectId: 'project-1' });
    expect(store.pendingRouterQueryParams()).toEqual(
      expect.objectContaining({
        search: 'pending',
        projectId: 'project-1'
      })
    );
  });

  it('creates canonical workspace return URLs with default query values omitted', () => {
    const store = WorkListQueryStore.workspace();

    store.applyRouteQueryParams(
      new URLSearchParams({
        assigneeState: 'unassigned',
        archivedProjects: 'exclude',
        sort: 'updated_desc'
      })
    );

    expect(store.returnUrl('/work-items')).toBe('/work-items?assigneeState=unassigned');
    expect(store.filteredViewUrl('/work-items', 'https://worktrail.example')).toBe(
      'https://worktrail.example/work-items?assigneeState=unassigned'
    );
  });

  it('resets pending project filters to default values', () => {
    const store = WorkListQueryStore.project();

    store.setPendingFilterValues({
      ...store.pendingFilterValues(),
      search: 'bug',
      status: 'ready',
      sort: 'created_desc'
    });

    const nextFilters = store.resetPendingFilterValues();

    expect(nextFilters.search).toBe('');
    expect(nextFilters.status).toBe('');
    expect(nextFilters.sort).toBe('updated_desc');
    expect(store.pendingRouterQueryParams()).toEqual({
      search: null,
      workState: null,
      assigneeState: null,
      estimateState: null,
      blocked: null,
      status: null,
      assigneeId: null,
      reporterId: null,
      type: null,
      labelId: null,
      milestoneId: null,
      cycleId: null,
      priority: null,
      dueDateState: null,
      dependency: null,
      workRisk: null,
      hierarchy: null,
      parentKey: null,
      sort: null,
      page: null,
      pageSize: null
    });
  });

  it('keeps page state separate from durable filters and canonicalizes browser parameters', () => {
    const store = WorkListQueryStore.workspace();
    const params = new URLSearchParams({ status: 'ready', page: '3', pageSize: '50' });

    store.applyRouteQueryParams(params);

    expect(store.activeQuery()).toEqual({ status: 'ready' });
    expect(store.activePageQuery()).toEqual({ page: 3, pageSize: 50 });
    expect(store.isCanonicalPageQuery(params)).toBe(true);
    expect(store.returnUrl('/work-items')).toBe('/work-items?status=ready&page=3&pageSize=50');
    expect(store.routerQueryParamsForPage(2)).toEqual(
      expect.objectContaining({ status: 'ready', page: '2', pageSize: '50' })
    );
    expect(store.routerQueryParamsForPageSize(100)).toEqual(
      expect.objectContaining({ status: 'ready', page: null, pageSize: '100' })
    );
  });

  it('normalizes invalid page parameters and resets paging for applied queries', () => {
    const store = WorkListQueryStore.project();
    const invalidParams = new URLSearchParams({ search: 'risk', page: '-2', pageSize: '500' });

    store.applyRouteQueryParams(invalidParams);

    expect(store.activePageQuery()).toEqual({ page: 1, pageSize: 25 });
    expect(store.isCanonicalPageQuery(invalidParams)).toBe(false);

    store.applyRouteQueryParams(new URLSearchParams({ page: '4', pageSize: '10' }));
    store.applyQuery({ status: 'blocked' });

    expect(store.activePageQuery()).toEqual({ page: 1, pageSize: 25 });
    expect(store.routerQueryParamsFromQuery({ status: 'blocked' })).toEqual(
      expect.objectContaining({ status: 'blocked', page: null, pageSize: null })
    );
  });

  it('keeps exact-parent edits pending until applied and replaces them with visible hierarchy', () => {
    const store = WorkListQueryStore.project();

    store.applyRouteQueryParams(new URLSearchParams({ parentKey: 'wt-42', status: 'ready' }));
    store.setPendingFilterValues({
      ...store.pendingFilterValues(),
      hierarchy: 'parents'
    });

    expect(store.activeQuery()).toEqual({
      status: 'ready',
      parentKey: 'WT-42',
      sort: 'updated_desc'
    });
    expect(store.pendingQuery()).toEqual({
      status: 'ready',
      hierarchy: 'parents',
      sort: 'updated_desc'
    });
    expect(store.pendingRouterQueryParams()).toEqual(
      expect.objectContaining({ hierarchy: 'parents', parentKey: null })
    );
  });
});
