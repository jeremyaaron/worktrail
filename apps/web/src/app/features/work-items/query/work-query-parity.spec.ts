import { workItemQueryEntries } from '@worktrail/contracts';
import { queryParityFixtures } from '../../../../../../../packages/contracts/src/fixtures/work-query-fixtures';
import { workItemQueryToHttpParams } from '../../../shared/work-items/work-item-query-params';
import { WorkListQueryStore } from '../state/work-list-query.store';
import { workItemFilterChips } from './work-item-filter-labels';
import { projectFormValueFromQuery, projectQueryFromFormValue, workspaceFormValueFromQuery, workspaceQueryFromFormValue, routerLinkQueryParamsFromWorkItemQuery, returnUrlFromWorkItemQuery } from './work-item-query-serialization';

describe('complete live-query round trips', () => {
  for (const fixture of queryParityFixtures) {
    for (const scope of ['project', 'workspace'] as const) {
      it(`${scope}: preserves ${fixture.name} through form, URL, HTTP, copy/return, saved and pinned state`, () => {
        const query = fixture.query;
        const expected = Object.fromEntries(workItemQueryEntries(query, scope));
        const formQuery = scope === 'project' ? projectQueryFromFormValue(projectFormValueFromQuery(query)) : workspaceQueryFromFormValue(workspaceFormValueFromQuery(query));
        expect(Object.fromEntries(workItemQueryEntries(formQuery, scope))).toEqual(expected);
        expect(routerLinkQueryParamsFromWorkItemQuery(formQuery, scope) ?? {}).toEqual(expected);
        const http = workItemQueryToHttpParams(formQuery);
        for (const [key, value] of Object.entries(expected)) expect(http.get(key)).toBe(value);
        const store = scope === 'project' ? WorkListQueryStore.project() : WorkListQueryStore.workspace();
        store.applyQuery(query);
        store.activePageQuery.set({ page: 2, pageSize: 50 });
        const copied = new URL(store.filteredViewUrl('/work-items', 'http://worktrail.test'));
        expect(copied.searchParams.get('page')).toBe('2');
        const saved = structuredClone(store.activeQuery());
        expect(saved).not.toEqual(jasmine.objectContaining({ page: 2 }));
        store.applyQuery(saved);
        expect(store.activePageQuery()).toEqual({ page: 1, pageSize: 25 });
        expect(Object.fromEntries(workItemQueryEntries(store.activeQuery(), scope))).toEqual(expected);
        const returned = new URL(returnUrlFromWorkItemQuery('/work-items', store.activeQuery(), scope), 'http://worktrail.test');
        expect(Object.fromEntries(returned.searchParams)).toEqual(expected);
        const chips = workItemFilterChips(store.activeQuery(), scope, { members: [], labels: [], milestones: [], cycles: [], projectSummaries: [] });
        expect(chips.map(chip => String(chip.key)).sort()).toEqual(Object.keys(expected).sort());
      });
    }
  }
  it('keeps pending estimate changes out of applied queries and chips until Apply', () => {
    const store = WorkListQueryStore.project();
    store.applyQuery({ status: 'ready' });
    store.setPendingFilterValues({ ...store.activeFilterValues(), estimateState: 'unestimated' });
    expect(store.pendingQuery().estimateState).toBe('unestimated');
    expect(store.activeQuery().estimateState).toBeUndefined();
    expect(workItemFilterChips(store.activeQuery(), 'project', { members: [], labels: [], milestones: [], cycles: [] }).map(chip => chip.key)).toEqual(['status']);
    const params = Object.entries(store.pendingRouterQueryParams()).filter((entry): entry is [string, string] => entry[1] !== null);
    store.applyRouteQueryParams(new URLSearchParams(params));
    expect(store.activeQuery().estimateState).toBe('unestimated');
  });
});
