import type { WorkItemChildSummaryDto } from '@worktrail/contracts';

export function workItemChildSummaryLabel(summary: WorkItemChildSummaryDto): string {
  const childLabel = summary.totalCount === 1 ? 'child' : 'children';
  const completedCount = summary.doneCount + summary.canceledCount;

  return `${summary.totalCount} ${childLabel} · ${completedCount}/${summary.totalCount} complete`;
}
