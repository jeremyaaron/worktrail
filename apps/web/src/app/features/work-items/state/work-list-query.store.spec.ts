import { WorkListQueryStore } from './work-list-query.store';

describe('WorkListQueryStore', () => {
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
      jasmine.objectContaining({
        search: 'release',
        status: 'blocked',
        labelId: 'label-1',
        sort: 'priority_desc'
      })
    );
    expect(store.activeQuery()).toEqual(
      jasmine.objectContaining({
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
      jasmine.objectContaining({
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
      sort: null
    });
  });
});
