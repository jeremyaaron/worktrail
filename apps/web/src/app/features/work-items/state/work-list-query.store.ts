import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import type {
  ResolvedWorkItemPageQuery,
  WorkItemPageSize,
  WorkItemQuery
} from '@worktrail/contracts';

import type {
  ProjectWorkItemFilterFormValue,
  WorkspaceWorkItemFilterFormValue
} from '../query/work-item-filter-state';
import {
  defaultWorkItemPageQuery,
  isCanonicalWorkItemPageQuery,
  mergeWorkItemRouteParams,
  workItemPageQueryForPage,
  workItemPageQueryForPageSize,
  workItemPageQueryFromParams
} from '../query/work-item-page-query-serialization';
import {
  meaningfulWorkItemQueryFieldCount,
  projectFormValueFromQuery,
  projectFormValueFromQueryParams,
  projectQueryFromFormValue,
  projectRouterQueryParamsFromQuery,
  type RouterQueryParams,
  workspaceFormValueFromQuery,
  workspaceFormValueFromQueryParams,
  workspaceQueryFromFormValue,
  workspaceRouterQueryParamsFromQuery,
  type QueryParamReader,
  type WorkItemQueryScope
} from '../query/work-item-query-serialization';

export type WorkListFilterFormValue =
  | ProjectWorkItemFilterFormValue
  | WorkspaceWorkItemFilterFormValue;

interface WorkListQueryStoreConfig<TFormValue extends WorkListFilterFormValue> {
  readonly defaultFilterValues: TFormValue;
  readonly formValueFromQuery: (query: WorkItemQuery) => TFormValue;
  readonly formValueFromQueryParams: (params: QueryParamReader) => TFormValue;
  readonly queryFromFormValue: (formValue: TFormValue) => WorkItemQuery;
  readonly queryParamsFromQuery: (query: WorkItemQuery) => RouterQueryParams;
  readonly scope: WorkItemQueryScope;
}

export class WorkListQueryStore<TFormValue extends WorkListFilterFormValue> {
  readonly activeFilterValues: WritableSignal<TFormValue>;
  readonly pendingFilterValues: WritableSignal<TFormValue>;
  readonly activeQuery: Signal<WorkItemQuery>;
  readonly activePageQuery: WritableSignal<ResolvedWorkItemPageQuery>;
  readonly pendingQuery: Signal<WorkItemQuery>;
  readonly pendingRouterQueryParams: Signal<RouterQueryParams>;

  private constructor(private readonly config: WorkListQueryStoreConfig<TFormValue>) {
    this.activeFilterValues = signal<TFormValue>({ ...this.config.defaultFilterValues });
    this.pendingFilterValues = signal<TFormValue>({ ...this.config.defaultFilterValues });
    this.activePageQuery = signal<ResolvedWorkItemPageQuery>({ ...defaultWorkItemPageQuery });
    this.activeQuery = computed(() => this.config.queryFromFormValue(this.activeFilterValues()));
    this.pendingQuery = computed(() => this.config.queryFromFormValue(this.pendingFilterValues()));
    this.pendingRouterQueryParams = computed(() =>
      mergeWorkItemRouteParams(
        this.config.queryParamsFromQuery(this.pendingQuery()),
        defaultWorkItemPageQuery
      )
    );
  }

  static project(): WorkListQueryStore<ProjectWorkItemFilterFormValue> {
    return new WorkListQueryStore<ProjectWorkItemFilterFormValue>({
      defaultFilterValues: {
        search: '',
        status: '',
        assigneeId: '',
        reporterId: '',
        type: '',
        labelId: '',
        milestoneId: '',
        cycleId: '',
        priority: '',
        dueDateState: '',
        dependency: '',
        workRisk: '',
        hierarchy: '',
        parentKey: '',
        sort: 'updated_desc'
      },
      formValueFromQuery: projectFormValueFromQuery,
      formValueFromQueryParams: projectFormValueFromQueryParams,
      queryFromFormValue: projectQueryFromFormValue,
      queryParamsFromQuery: projectRouterQueryParamsFromQuery,
      scope: 'project'
    });
  }

  static workspace(): WorkListQueryStore<WorkspaceWorkItemFilterFormValue> {
    return new WorkListQueryStore<WorkspaceWorkItemFilterFormValue>({
      defaultFilterValues: {
        search: '',
        status: '',
        assigneeId: '',
        reporterId: '',
        type: '',
        labelId: '',
        milestoneId: '',
        cycleId: '',
        priority: '',
        dueDateState: '',
        dependency: '',
        workRisk: '',
        hierarchy: '',
        parentKey: '',
        sort: 'updated_desc',
        projectId: '',
        workState: '',
        blocked: '',
        archivedProjects: 'exclude'
      },
      formValueFromQuery: workspaceFormValueFromQuery,
      formValueFromQueryParams: workspaceFormValueFromQueryParams,
      queryFromFormValue: workspaceQueryFromFormValue,
      queryParamsFromQuery: workspaceRouterQueryParamsFromQuery,
      scope: 'workspace'
    });
  }

  applyRouteQueryParams(params: QueryParamReader): TFormValue {
    const nextFilterValues = this.config.formValueFromQueryParams(params);
    this.activeFilterValues.set(nextFilterValues);
    this.pendingFilterValues.set(nextFilterValues);
    this.activePageQuery.set(workItemPageQueryFromParams(params));
    return nextFilterValues;
  }

  applyQuery(query: WorkItemQuery): TFormValue {
    const nextFilterValues = this.config.formValueFromQuery(query);
    this.activeFilterValues.set(nextFilterValues);
    this.pendingFilterValues.set(nextFilterValues);
    this.activePageQuery.set({ ...defaultWorkItemPageQuery });
    return nextFilterValues;
  }

  setPendingFilterValues(formValue: TFormValue): void {
    this.pendingFilterValues.set(formValue);
  }

  resetPendingFilterValues(): TFormValue {
    const nextFilterValues = { ...this.config.defaultFilterValues };
    this.pendingFilterValues.set(nextFilterValues);
    return nextFilterValues;
  }

  routerQueryParamsFromFormValue(formValue: TFormValue): RouterQueryParams {
    return mergeWorkItemRouteParams(
      this.config.queryParamsFromQuery(this.config.queryFromFormValue(formValue)),
      defaultWorkItemPageQuery
    );
  }

  routerQueryParamsFromQuery(query: WorkItemQuery): RouterQueryParams {
    return mergeWorkItemRouteParams(
      this.config.queryParamsFromQuery(query),
      defaultWorkItemPageQuery
    );
  }

  routerQueryParamsForPage(page: number): RouterQueryParams {
    return mergeWorkItemRouteParams(
      this.config.queryParamsFromQuery(this.activeQuery()),
      workItemPageQueryForPage(this.activePageQuery(), page)
    );
  }

  routerQueryParamsForPageSize(pageSize: WorkItemPageSize): RouterQueryParams {
    return mergeWorkItemRouteParams(
      this.config.queryParamsFromQuery(this.activeQuery()),
      workItemPageQueryForPageSize(pageSize)
    );
  }

  routerQueryParamsForResolvedPage(
    pageQuery: ResolvedWorkItemPageQuery
  ): RouterQueryParams {
    return mergeWorkItemRouteParams(
      this.config.queryParamsFromQuery(this.activeQuery()),
      pageQuery
    );
  }

  activeRouterQueryParams(): RouterQueryParams {
    return mergeWorkItemRouteParams(
      this.config.queryParamsFromQuery(this.activeQuery()),
      this.activePageQuery()
    );
  }

  isCanonicalPageQuery(params: QueryParamReader): boolean {
    return isCanonicalWorkItemPageQuery(params);
  }

  returnUrl(path: string): string {
    const queryParams = Object.fromEntries(
      Object.entries(this.activeRouterQueryParams()).filter((entry): entry is [string, string] =>
        entry[1] !== null
      )
    );
    const queryString = new URLSearchParams(queryParams).toString();

    return queryString === '' ? path : `${path}?${queryString}`;
  }

  filteredViewUrl(path: string, origin: string): string {
    return new URL(this.returnUrl(path), origin).toString();
  }

  meaningfulFieldCount(query: WorkItemQuery): number {
    return meaningfulWorkItemQueryFieldCount(query, this.config.scope);
  }
}
