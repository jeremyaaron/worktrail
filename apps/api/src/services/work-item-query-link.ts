import type { WorkItemQuery } from '@worktrail/contracts';

type ProjectWorkItemQueryKey =
  | 'search'
  | 'status'
  | 'workState'
  | 'assigneeId'
  | 'reporterId'
  | 'type'
  | 'labelId'
  | 'milestoneId'
  | 'cycleId'
  | 'priority'
  | 'dueDateState'
  | 'dependency'
  | 'workRisk'
  | 'sort';

const projectWorkItemQueryKeys: ProjectWorkItemQueryKey[] = [
  'search',
  'status',
  'workState',
  'assigneeId',
  'reporterId',
  'type',
  'labelId',
  'milestoneId',
  'cycleId',
  'priority',
  'dueDateState',
  'dependency',
  'workRisk',
  'sort'
];

const defaultSort = 'updated_desc';

export function projectWorkItemPathFromQuery(projectId: string, query: WorkItemQuery = {}): string {
  const searchParams = new URLSearchParams();

  for (const key of projectWorkItemQueryKeys) {
    const value = query[key];

    if (typeof value !== 'string' || value.trim().length === 0) {
      continue;
    }

    if (key === 'sort' && value === defaultSort) {
      continue;
    }

    searchParams.set(key, value);
  }

  const queryString = searchParams.toString();
  const path = `/projects/${encodeURIComponent(projectId)}/work-items`;

  return queryString.length === 0 ? path : `${path}?${queryString}`;
}
