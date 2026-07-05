import type {
  ArchivedProjectMode,
  AssigneeState,
  DependencyFilter,
  DueDateState,
  WorkItemPriority,
  WorkItemQuery,
  WorkItemSort,
  WorkItemState,
  WorkItemStatus,
  WorkItemType
} from '@worktrail/contracts';

import { unassignedAssigneeValue } from './work-item-filter-options';
import type {
  ProjectWorkItemFilterFormValue,
  WorkspaceWorkItemFilterFormValue
} from './work-item-filter-state';

export interface ProjectWorkItemFilters {
  status?: WorkItemStatus;
  assigneeId?: string;
  reporterId?: string;
  type?: WorkItemType;
  labelId?: string;
  milestoneId?: string;
  priority?: WorkItemPriority;
  dueDateState?: DueDateState;
  dependency?: DependencyFilter;
  search?: string;
  sort?: WorkItemSort;
}

export interface QueryParamReader {
  get(name: string): string | null;
}

export function optionalFilterValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function projectFiltersFromFormValue(
  formValue: ProjectWorkItemFilterFormValue
): ProjectWorkItemFilters {
  return {
    search: optionalFilterValue(formValue.search),
    status: optionalFilterValue(formValue.status) as WorkItemStatus | undefined,
    assigneeId: optionalFilterValue(formValue.assigneeId),
    reporterId: optionalFilterValue(formValue.reporterId),
    type: optionalFilterValue(formValue.type) as WorkItemType | undefined,
    labelId: optionalFilterValue(formValue.labelId),
    milestoneId: optionalFilterValue(formValue.milestoneId),
    priority: optionalFilterValue(formValue.priority) as WorkItemPriority | undefined,
    dueDateState: optionalFilterValue(formValue.dueDateState) as DueDateState | undefined,
    dependency: optionalFilterValue(formValue.dependency) as DependencyFilter | undefined,
    sort: formValue.sort as WorkItemSort
  };
}

export function projectQueryParamsFromFilters(
  filters: ProjectWorkItemFilters
): Record<string, string | null> {
  const sort = filters.sort ?? 'updated_desc';

  return {
    search: filters.search ?? null,
    status: filters.status ?? null,
    assigneeId: filters.assigneeId ?? null,
    reporterId: filters.reporterId ?? null,
    type: filters.type ?? null,
    labelId: filters.labelId ?? null,
    milestoneId: filters.milestoneId ?? null,
    priority: filters.priority ?? null,
    dueDateState: filters.dueDateState ?? null,
    dependency: filters.dependency ?? null,
    sort: sort === 'updated_desc' ? null : sort
  };
}

export function projectFormValueFromQueryParams(
  params: QueryParamReader
): ProjectWorkItemFilterFormValue {
  return {
    search: params.get('search') ?? '',
    status: params.get('status') ?? '',
    assigneeId: params.get('assigneeId') ?? '',
    reporterId: params.get('reporterId') ?? '',
    type: params.get('type') ?? '',
    labelId: params.get('labelId') ?? '',
    milestoneId: params.get('milestoneId') ?? '',
    priority: params.get('priority') ?? '',
    dueDateState: params.get('dueDateState') ?? '',
    dependency: params.get('dependency') ?? '',
    sort: params.get('sort') ?? 'updated_desc'
  };
}

export function workspaceQueryFromFormValue(
  formValue: WorkspaceWorkItemFilterFormValue
): WorkItemQuery {
  const assigneeId = optionalFilterValue(formValue.assigneeId);
  const blocked = optionalFilterValue(formValue.blocked);
  const archivedProjects = optionalFilterValue(formValue.archivedProjects);
  const sort = optionalFilterValue(formValue.sort);

  return {
    search: optionalFilterValue(formValue.search),
    projectId: optionalFilterValue(formValue.projectId),
    status: optionalFilterValue(formValue.status) as WorkItemStatus | undefined,
    workState: optionalFilterValue(formValue.status) === undefined
      ? (optionalFilterValue(formValue.workState) as WorkItemState | undefined)
      : undefined,
    assigneeId: assigneeId === unassignedAssigneeValue ? undefined : assigneeId,
    assigneeState:
      assigneeId === unassignedAssigneeValue ? ('unassigned' satisfies AssigneeState) : undefined,
    reporterId: optionalFilterValue(formValue.reporterId),
    type: optionalFilterValue(formValue.type) as WorkItemType | undefined,
    labelId: optionalFilterValue(formValue.labelId),
    milestoneId: optionalFilterValue(formValue.milestoneId),
    priority: optionalFilterValue(formValue.priority) as WorkItemPriority | undefined,
    dueDateState: optionalFilterValue(formValue.dueDateState) as DueDateState | undefined,
    blocked: blocked === undefined ? undefined : blocked === 'true',
    dependency: optionalFilterValue(formValue.dependency) as DependencyFilter | undefined,
    archivedProjects:
      archivedProjects === undefined || archivedProjects === 'exclude'
        ? undefined
        : (archivedProjects as ArchivedProjectMode),
    sort: sort === undefined || sort === 'updated_desc' ? undefined : (sort as WorkItemSort)
  };
}

export function workspaceQueryParamsFromFormValue(
  formValue: WorkspaceWorkItemFilterFormValue
): Record<string, string | null> {
  const assigneeId = optionalFilterValue(formValue.assigneeId);
  const sort = optionalFilterValue(formValue.sort) ?? 'updated_desc';
  const archivedProjects = optionalFilterValue(formValue.archivedProjects) ?? 'exclude';

  return {
    search: optionalFilterValue(formValue.search) ?? null,
    projectId: optionalFilterValue(formValue.projectId) ?? null,
    status: optionalFilterValue(formValue.status) ?? null,
    workState: optionalFilterValue(formValue.workState) ?? null,
    assigneeId: assigneeId === unassignedAssigneeValue ? null : assigneeId ?? null,
    assigneeState: assigneeId === unassignedAssigneeValue ? 'unassigned' : null,
    reporterId: optionalFilterValue(formValue.reporterId) ?? null,
    type: optionalFilterValue(formValue.type) ?? null,
    labelId: optionalFilterValue(formValue.labelId) ?? null,
    milestoneId: optionalFilterValue(formValue.milestoneId) ?? null,
    priority: optionalFilterValue(formValue.priority) ?? null,
    dueDateState: optionalFilterValue(formValue.dueDateState) ?? null,
    blocked: optionalFilterValue(formValue.blocked) ?? null,
    dependency: optionalFilterValue(formValue.dependency) ?? null,
    archivedProjects: archivedProjects === 'exclude' ? null : archivedProjects,
    sort: sort === 'updated_desc' ? null : sort
  };
}

export function workspaceFormValueFromQuery(query: WorkItemQuery): WorkspaceWorkItemFilterFormValue {
  return {
    search: query.search ?? '',
    projectId: query.projectId ?? '',
    status: query.status ?? '',
    workState: query.status === undefined ? query.workState ?? '' : '',
    assigneeId:
      query.assigneeId ?? (query.assigneeState === 'unassigned' ? unassignedAssigneeValue : ''),
    reporterId: query.reporterId ?? '',
    type: query.type ?? '',
    labelId: query.labelId ?? '',
    milestoneId: query.milestoneId ?? '',
    priority: query.priority ?? '',
    dueDateState: query.dueDateState ?? '',
    blocked: query.blocked === undefined ? '' : String(query.blocked),
    dependency: query.dependency ?? '',
    archivedProjects: query.archivedProjects ?? 'exclude',
    sort: query.sort ?? 'updated_desc'
  };
}

export function workspaceFormValueFromQueryParams(
  params: QueryParamReader
): WorkspaceWorkItemFilterFormValue {
  const status = params.get('status') ?? '';
  const assigneeId = params.get('assigneeId') ?? '';
  const assigneeState = params.get('assigneeState') ?? '';

  return {
    search: params.get('search') ?? '',
    projectId: params.get('projectId') ?? '',
    status,
    workState: status === '' ? params.get('workState') ?? '' : '',
    assigneeId:
      assigneeId !== '' ? assigneeId : assigneeState === 'unassigned' ? unassignedAssigneeValue : '',
    reporterId: params.get('reporterId') ?? '',
    type: params.get('type') ?? '',
    labelId: params.get('labelId') ?? '',
    milestoneId: params.get('milestoneId') ?? '',
    priority: params.get('priority') ?? '',
    dueDateState: params.get('dueDateState') ?? '',
    blocked: params.get('blocked') ?? '',
    dependency: params.get('dependency') ?? '',
    archivedProjects: params.get('archivedProjects') ?? 'exclude',
    sort: params.get('sort') ?? 'updated_desc'
  };
}
