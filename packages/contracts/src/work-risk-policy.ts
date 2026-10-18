import type { WorkItemStatus } from './work-items.js';
const openWorkItemStatuses = ['backlog', 'ready', 'in_progress', 'blocked'] as const;
const terminalWorkItemStatuses = ['done', 'canceled'] as const;

export const dueSoonWindowDays = 7;
export const staleInProgressDays = 7;
export const activeUnassignedWorkItemStatuses = ['ready', 'in_progress'] as const satisfies readonly WorkItemStatus[];
export const riskOpenWorkItemStatuses = openWorkItemStatuses;
export const riskTerminalWorkItemStatuses = terminalWorkItemStatuses;

const openStatusSet = new Set<WorkItemStatus>(openWorkItemStatuses);
const terminalStatusSet = new Set<WorkItemStatus>(terminalWorkItemStatuses);
const activeUnassignedStatusSet = new Set<WorkItemStatus>(activeUnassignedWorkItemStatuses);

export function isTerminalWorkItemStatus(status: WorkItemStatus): boolean {
  return terminalStatusSet.has(status);
}

export function isOpenWorkItemStatus(status: WorkItemStatus): boolean {
  return openStatusSet.has(status) && !terminalStatusSet.has(status);
}

export function isActiveUnassignedWorkItemStatus(status: WorkItemStatus): boolean {
  return activeUnassignedStatusSet.has(status);
}

export function isOverdueDueDate(dueDate: string | null, today: string): boolean {
  return dueDate !== null && dueDate < today;
}

export function isDueSoonDueDate(
  dueDate: string | null,
  today: string,
  dueSoonEnd: string
): boolean {
  return dueDate !== null && dueDate >= today && dueDate <= dueSoonEnd;
}

export function isStaleInProgressStatus(
  status: WorkItemStatus,
  updatedAt: Date,
  staleCutoff: Date
): boolean {
  return status === 'in_progress' && updatedAt.getTime() < staleCutoff.getTime();
}

export function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createRiskTimeWindow(now: Date): { today: string; dueSoonEnd: string; staleCutoff: Date } {
  return { today: toDateString(now), dueSoonEnd: toDateString(addDays(now, dueSoonWindowDays)), staleCutoff: addDays(now, -staleInProgressDays) };
}

export function distinctWorkItems<T extends { id: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map(item => [item.id, item])).values()];
}
