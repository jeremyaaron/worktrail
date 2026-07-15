import type {
  ArchivedProjectMode,
  DependencyFilter,
  DueDateState,
  WorkItemPriority,
  WorkItemHierarchyFilter,
  WorkItemSort,
  WorkItemState,
  WorkItemStatus,
  WorkItemType
} from '@worktrail/contracts';

import { dependencyFilterLabel } from '../../../shared/work-items/work-item-display';

export const unassignedAssigneeValue = '__unassigned';

export const workItemStatusOptions: WorkItemStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'done',
  'canceled'
];

export const workItemStateOptions: Array<{ label: string; value: WorkItemState }> = [
  { label: 'Open', value: 'open' },
  { label: 'Terminal', value: 'terminal' }
];

export const workItemTypeOptions: WorkItemType[] = ['task', 'bug', 'story', 'chore'];
export const workItemPriorityOptions: WorkItemPriority[] = ['low', 'medium', 'high', 'urgent'];

export const dueDateStateOptions: Array<{ label: string; value: DueDateState }> = [
  { label: 'Overdue', value: 'overdue' },
  { label: 'Due soon', value: 'due_soon' },
  { label: 'No due date', value: 'none' }
];

export const blockedFilterOptions: Array<{ label: string; value: string }> = [
  { label: 'Blocked only', value: 'true' },
  { label: 'Not blocked', value: 'false' }
];

export const dependencyFilterOptions: Array<{ label: string; value: DependencyFilter }> = [
  { label: dependencyFilterLabel('dependency_blocked'), value: 'dependency_blocked' },
  { label: dependencyFilterLabel('blocking_open_work'), value: 'blocking_open_work' }
];

export const workItemHierarchyOptions: Array<{
  label: string;
  value: WorkItemHierarchyFilter | '';
}> = [
  { label: 'All work', value: '' },
  { label: 'Top-level work', value: 'top_level' },
  { label: 'Child work', value: 'children' },
  { label: 'Parents with children', value: 'parents' }
];

export const archivedProjectModeOptions: Array<{ label: string; value: ArchivedProjectMode }> = [
  { label: 'Active projects', value: 'exclude' },
  { label: 'Active and archived', value: 'include' },
  { label: 'Archived only', value: 'only' }
];

export const workItemSortOptions: Array<{ label: string; value: WorkItemSort }> = [
  { label: 'Updated newest', value: 'updated_desc' },
  { label: 'Updated oldest', value: 'updated_asc' },
  { label: 'Priority high to low', value: 'priority_desc' },
  { label: 'Priority low to high', value: 'priority_asc' },
  { label: 'Due date', value: 'due_date_asc' },
  { label: 'Created newest', value: 'created_desc' },
  { label: 'Board order', value: 'board_order' }
];
