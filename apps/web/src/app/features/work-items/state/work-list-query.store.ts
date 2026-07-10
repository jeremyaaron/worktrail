import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import type { WorkItemQuery } from '@worktrail/contracts';

import type {
  ProjectWorkItemFilterFormValue,
  WorkspaceWorkItemFilterFormValue
} from '../query/work-item-filter-state';
import {
  meaningfulWorkItemQueryFieldCount,
  projectFormValueFromQuery,
  projectFormValueFromQueryParams,
  projectQueryFromFormValue,
  projectRouterQueryParamsFromQuery,
  returnUrlFromWorkItemQuery,
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
  readonly pendingQuery: Signal<WorkItemQuery>;
  readonly pendingRouterQueryParams: Signal<RouterQueryParams>;

  private constructor(private readonly config: WorkListQueryStoreConfig<TFormValue>) {
    this.activeFilterValues = signal<TFormValue>({ ...this.config.defaultFilterValues });
    this.pendingFilterValues = signal<TFormValue>({ ...this.config.defaultFilterValues });
    this.activeQuery = computed(() => this.config.queryFromFormValue(this.activeFilterValues()));
    this.pendingQuery = computed(() => this.config.queryFromFormValue(this.pendingFilterValues()));
    this.pendingRouterQueryParams = computed(() =>
      this.config.queryParamsFromQuery(this.pendingQuery())
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
    return nextFilterValues;
  }

  applyQuery(query: WorkItemQuery): TFormValue {
    const nextFilterValues = this.config.formValueFromQuery(query);
    this.activeFilterValues.set(nextFilterValues);
    this.pendingFilterValues.set(nextFilterValues);
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
    return this.config.queryParamsFromQuery(this.config.queryFromFormValue(formValue));
  }

  routerQueryParamsFromQuery(query: WorkItemQuery): RouterQueryParams {
    return this.config.queryParamsFromQuery(query);
  }

  returnUrl(path: string): string {
    return returnUrlFromWorkItemQuery(path, this.activeQuery(), this.config.scope);
  }

  filteredViewUrl(path: string, origin: string): string {
    return new URL(this.returnUrl(path), origin).toString();
  }

  meaningfulFieldCount(query: WorkItemQuery): number {
    return meaningfulWorkItemQueryFieldCount(query, this.config.scope);
  }
}
