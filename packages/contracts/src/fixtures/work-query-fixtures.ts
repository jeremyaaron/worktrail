import type { WorkItemQuery } from '../work-items.js';

export const queryFieldExamples = {
  search: 'release: readiness', projectId: '10000000-0000-4000-8000-000000000201',
  status: 'blocked', workState: 'open', assigneeId: '10000000-0000-4000-8000-000000000101',
  assigneeState: 'assigned', reporterId: '10000000-0000-4000-8000-000000000102',
  type: 'task', priority: 'high', labelId: '10000000-0000-4000-8000-000000000301',
  milestoneId: '10000000-0000-4000-8000-000000000601', cycleId: '10000000-0000-4000-8000-000000000701',
  dueDateState: 'overdue', estimateState: 'unestimated', blocked: false,
  dependency: 'dependency_blocked', workRisk: 'stale_in_progress', hierarchy: 'children',
  parentKey: 'WT-42', archivedProjects: 'include', sort: 'priority_desc'
} as const satisfies Required<WorkItemQuery>;

export const queryParityFixtures: Array<{ name: string; query: WorkItemQuery }> = [
  ...Object.entries(queryFieldExamples).map(([name, value]) => ({ name, query: { [name]: value } })),
  { name: 'blocked true', query: { blocked: true } },
  { name: 'unassigned', query: { assigneeState: 'unassigned' } },
  { name: 'estimated zero is included', query: { estimateState: 'estimated', workState: 'open', cycleId: queryFieldExamples.cycleId } },
  { name: 'exact unestimated risk', query: { cycleId: queryFieldExamples.cycleId, workState: 'open', estimateState: 'unestimated', sort: 'priority_desc' } },
  { name: 'exact parent with false', query: { parentKey: 'WT-42', blocked: false, workRisk: 'stale_in_progress' } },
  { name: 'old saved defaults', query: { sort: 'updated_desc', archivedProjects: 'exclude' } }
];
