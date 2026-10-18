import type { SnapshotWorkItemQueryV1 } from '@worktrail/contracts';

type ProjectSnapshotWorkItemQueryV1Key =
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

const projectSnapshotWorkItemQueryV1Keys: ProjectSnapshotWorkItemQueryV1Key[] = [
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

export function snapshotV1WorkItemPathFromQuery(projectId: string, query: SnapshotWorkItemQueryV1 = {}): string {
  const searchParams = new URLSearchParams();

  for (const key of projectSnapshotWorkItemQueryV1Keys) {
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
