import { workItemQueryEntries, workItemQueryFields, workItemQueryFieldPolicy, type WorkItemQuery, type WorkItemHierarchyFilter, type WorkItemQueryScope } from '@worktrail/contracts';
import { unassignedAssigneeValue } from './work-item-filter-options';
import type { ProjectWorkItemFilterFormValue, WorkspaceWorkItemFilterFormValue } from './work-item-filter-state';

export type { WorkItemQueryScope } from '@worktrail/contracts';
export type ProjectWorkItemFilters = Omit<WorkItemQuery, 'projectId' | 'archivedProjects'>;
export type RouterQueryParams = Record<string, string | null>;
export type RouterLinkQueryParams = Record<string, string>;
export interface QueryParamReader { get(name: string): string | null; }

export function optionalFilterValue(value: string): string | undefined { return value.trim() || undefined; }

export function projectFiltersFromFormValue(formValue: ProjectWorkItemFilterFormValue): ProjectWorkItemFilters {
  return projectQueryFromFormValue(formValue);
}
export function projectQueryFromFormValue(formValue: ProjectWorkItemFilterFormValue): WorkItemQuery {
  const hierarchy = normalizeHierarchy(formValue.hierarchy);
  const status = optionalFilterValue(formValue.status);
  const assigneeId = optionalFilterValue(formValue.assigneeId);
  const assigneeState = assigneeId === unassignedAssigneeValue ? 'unassigned' : optionalFilterValue(formValue.assigneeState);
  const query: WorkItemQuery = {
    search: optionalFilterValue(formValue.search),
    status: status as WorkItemQuery['status'],
    workState: status === undefined ? optionalFilterValue(formValue.workState) as WorkItemQuery['workState'] : undefined,
    assigneeId: assigneeId === unassignedAssigneeValue ? undefined : assigneeId,
    assigneeState: assigneeId && assigneeId !== unassignedAssigneeValue && assigneeState === 'unassigned' ? undefined : assigneeState as WorkItemQuery['assigneeState'],
    reporterId: optionalFilterValue(formValue.reporterId),
    type: optionalFilterValue(formValue.type) as WorkItemQuery['type'],
    labelId: optionalFilterValue(formValue.labelId), milestoneId: optionalFilterValue(formValue.milestoneId),
    cycleId: optionalFilterValue(formValue.cycleId), priority: optionalFilterValue(formValue.priority) as WorkItemQuery['priority'],
    dueDateState: optionalFilterValue(formValue.dueDateState) as WorkItemQuery['dueDateState'],
    estimateState: normalizeEstimateState(formValue.estimateState),
    blocked: formValue.blocked === '' ? undefined : formValue.blocked === 'true',
    dependency: optionalFilterValue(formValue.dependency) as WorkItemQuery['dependency'],
    workRisk: optionalFilterValue(formValue.workRisk) as WorkItemQuery['workRisk'],
    hierarchy, parentKey: hierarchy === undefined ? normalizeParentKey(formValue.parentKey) : undefined,
    sort: formValue.sort as WorkItemQuery['sort']
  };
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined));
}
export function workspaceQueryFromFormValue(formValue: WorkspaceWorkItemFilterFormValue): WorkItemQuery {
  const query = projectQueryFromFormValue(formValue);
  if (query.sort === 'updated_desc') delete query.sort;
  return { ...query, ...Object.fromEntries([
    ['projectId', optionalFilterValue(formValue.projectId)],
    ['archivedProjects', formValue.archivedProjects === 'exclude' ? undefined : optionalFilterValue(formValue.archivedProjects)]
  ].filter(([, value]) => value !== undefined)) };
}

function routerParams(query: WorkItemQuery, scope: WorkItemQueryScope): RouterQueryParams {
  const canonical = projectQueryFromFormValue(projectFormValueFromQuery(query));
  if (scope === 'workspace') {
    canonical.projectId = query.projectId;
    canonical.archivedProjects = query.archivedProjects;
  }
  const empty = Object.fromEntries(workItemQueryFields.filter(key => scope === 'workspace' || workItemQueryFieldPolicy[key].scope === 'both').map(key => [key, null]));
  return { ...empty, ...Object.fromEntries(workItemQueryEntries(canonical, scope)) };
}
export function projectQueryParamsFromFilters(filters: ProjectWorkItemFilters): RouterQueryParams { return projectRouterQueryParamsFromQuery(filters); }
export function projectRouterQueryParamsFromQuery(query: WorkItemQuery): RouterQueryParams { return routerParams(query, 'project'); }
export function workspaceRouterQueryParamsFromQuery(query: WorkItemQuery): RouterQueryParams { return routerParams(query, 'workspace'); }
export function workspaceQueryParamsFromFormValue(value: WorkspaceWorkItemFilterFormValue): RouterQueryParams { return workspaceRouterQueryParamsFromQuery(workspaceQueryFromFormValue(value)); }

export function projectFormValueFromQuery(query: WorkItemQuery): ProjectWorkItemFilterFormValue {
  const hierarchy = normalizeHierarchy(query.hierarchy);
  return {
    search: query.search ?? '', status: query.status ?? '',
    workState: query.status === undefined ? query.workState ?? '' : '',
    assigneeId: query.assigneeId ?? (query.assigneeState === 'unassigned' ? unassignedAssigneeValue : ''),
    assigneeState: query.assigneeState ?? '', reporterId: query.reporterId ?? '',
    type: query.type ?? '', labelId: query.labelId ?? '', milestoneId: query.milestoneId ?? '', cycleId: query.cycleId ?? '',
    priority: query.priority ?? '', dueDateState: query.dueDateState ?? '', estimateState: normalizeEstimateState(query.estimateState) ?? '',
    blocked: query.blocked === undefined ? '' : String(query.blocked),
    dependency: query.dependency ?? '', workRisk: query.workRisk ?? '',
    hierarchy: hierarchy ?? '', parentKey: hierarchy === undefined ? normalizeParentKey(query.parentKey) ?? '' : '',
    sort: query.sort ?? 'updated_desc'
  };
}
export function workspaceFormValueFromQuery(query: WorkItemQuery): WorkspaceWorkItemFilterFormValue {
  return { ...projectFormValueFromQuery(query), projectId: query.projectId ?? '', archivedProjects: query.archivedProjects ?? 'exclude' };
}
function queryFromParams(params: QueryParamReader): WorkItemQuery {
  const query = Object.fromEntries(workItemQueryFields.map(key => [key, params.get(key) ?? undefined])) as WorkItemQuery;
  query.blocked = params.get('blocked') === null || params.get('blocked') === '' ? undefined : params.get('blocked') === 'true';
  return query;
}
export function projectFormValueFromQueryParams(params: QueryParamReader): ProjectWorkItemFilterFormValue { return projectFormValueFromQuery(queryFromParams(params)); }
export function workspaceFormValueFromQueryParams(params: QueryParamReader): WorkspaceWorkItemFilterFormValue { return workspaceFormValueFromQuery(queryFromParams(params)); }

export function routerLinkQueryParamsFromWorkItemQuery(query: WorkItemQuery | null, scope: WorkItemQueryScope): RouterLinkQueryParams | null {
  if (query === null) return null;
  const params = Object.fromEntries(Object.entries(routerParams(query, scope)).filter((entry): entry is [string, string] => entry[1] !== null));
  return Object.keys(params).length ? params : null;
}
export function returnUrlFromWorkItemQuery(path: string, query: WorkItemQuery, scope: WorkItemQueryScope): string {
  const params = routerLinkQueryParamsFromWorkItemQuery(query, scope);
  return params === null ? path : `${path}?${new URLSearchParams(params)}`;
}
export function meaningfulWorkItemQueryFieldCount(query: WorkItemQuery, scope: WorkItemQueryScope): number {
  return Object.keys(routerLinkQueryParamsFromWorkItemQuery(query, scope) ?? {}).length;
}
function normalizeHierarchy(value: string | null | undefined): WorkItemHierarchyFilter | undefined {
  return value === 'top_level' || value === 'children' || value === 'parents' ? value : undefined;
}
function normalizeParentKey(value: string | null | undefined): string | undefined {
  const key = value?.trim().toUpperCase();
  return key && /^[A-Z0-9]{2,8}-[1-9]\d*$/.test(key) ? key : undefined;
}
function normalizeEstimateState(value: string | null | undefined): WorkItemQuery['estimateState'] {
  return value === 'estimated' || value === 'unestimated' ? value : undefined;
}
