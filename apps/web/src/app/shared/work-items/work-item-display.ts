import type {
  ProjectDto,
  WorkItemListItemDto,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType
} from '@worktrail/contracts';

const priorityLabels: Record<WorkItemPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
};

const statusLabels: Record<WorkItemStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  canceled: 'Canceled'
};

const typeLabels: Record<WorkItemType, string> = {
  task: 'Task',
  bug: 'Bug',
  story: 'Story',
  chore: 'Chore'
};

export function projectBadge(project: Pick<ProjectDto, 'key' | 'status'>): string {
  return project.status === 'archived' ? `${project.key} archived` : project.key;
}

export function projectTitle(project: Pick<ProjectDto, 'key' | 'name'>): string {
  return `${project.key} · ${project.name}`;
}

export function workItemMetadata(
  item: Pick<WorkItemListItemDto, 'priority' | 'status' | 'type'>
): string {
  return `${typeLabels[item.type]} · ${statusLabels[item.status]} · ${priorityLabels[item.priority]}`;
}

export function filterPillLabel(label: string, value: string): string {
  return `${label}: ${value}`;
}

export function workItemStatusLabel(status: WorkItemStatus): string {
  return statusLabels[status];
}

export function workItemPriorityLabel(priority: WorkItemPriority): string {
  return priorityLabels[priority];
}
