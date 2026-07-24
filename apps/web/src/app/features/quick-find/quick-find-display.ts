import type {
  QuickFindAttachmentResultDto,
  QuickFindCycleResultDto,
  QuickFindGroupDto,
  QuickFindMilestoneResultDto,
  QuickFindProjectResultDto,
  QuickFindReportResultDto,
  QuickFindResponseDto,
  QuickFindResultDto,
  QuickFindWorkItemResultDto
} from '@worktrail/contracts';

import { quickFindResultOptionId } from './quick-find-navigation';

export interface QuickFindResultRow {
  id: string;
  result: QuickFindResultDto;
  identity: string;
  title: string;
  context: string | null;
  metadata: readonly string[];
  lifecycle: readonly string[];
  excerpt: string | null;
}

export interface QuickFindResultGroup {
  key: keyof QuickFindResponseDto['groups'];
  label: string;
  rows: readonly QuickFindResultRow[];
  hasMore: boolean;
  hasWorkItemOverflow: boolean;
}

export function quickFindResultGroups(
  response: QuickFindResponseDto | null
): readonly QuickFindResultGroup[] {
  if (response === null) {
    return [];
  }

  return [
    toGroup('workItems', 'Work items', response.groups.workItems),
    toGroup('projects', 'Projects', response.groups.projects),
    toGroup('milestones', 'Milestones', response.groups.milestones),
    toGroup('cycles', 'Cycles', response.groups.cycles),
    toGroup('reports', 'Reports', response.groups.reports),
    toGroup('attachments', 'Attachments', response.groups.attachments)
  ].filter((group) => group.rows.length > 0);
}

export function quickFindHasResults(response: QuickFindResponseDto | null): boolean {
  return response !== null && Object.values(response.groups).some((group) => group.items.length > 0);
}

function toGroup<TItem extends QuickFindResultDto>(
  key: keyof QuickFindResponseDto['groups'],
  label: string,
  group: QuickFindGroupDto<TItem>
): QuickFindResultGroup {
  return {
    key,
    label,
    rows: group.items.map(toRow),
    hasMore: group.hasMore,
    hasWorkItemOverflow: key === 'workItems' && group.hasMore
  };
}

function toRow(result: QuickFindResultDto): QuickFindResultRow {
  const common = {
    id: quickFindResultOptionId(result),
    result,
    excerpt: result.match.excerpt
  };

  switch (result.kind) {
    case 'project':
      return projectRow(result, common);
    case 'work_item':
      return workItemRow(result, common);
    case 'milestone':
      return milestoneRow(result, common);
    case 'cycle':
      return cycleRow(result, common);
    case 'report':
      return reportRow(result, common);
    case 'attachment':
      return attachmentRow(result, common);
    default:
      return assertNever(result);
  }
}

function projectRow(
  result: QuickFindProjectResultDto,
  common: Pick<QuickFindResultRow, 'id' | 'result' | 'excerpt'>
): QuickFindResultRow {
  return {
    ...common,
    identity: result.project.key,
    title: result.project.name,
    context: null,
    metadata: ['Project'],
    lifecycle: projectLifecycle(result.project.status)
  };
}

function workItemRow(
  result: QuickFindWorkItemResultDto,
  common: Pick<QuickFindResultRow, 'id' | 'result' | 'excerpt'>
): QuickFindResultRow {
  return {
    ...common,
    identity: result.workItem.displayKey,
    title: result.workItem.title,
    context: projectContext(result),
    metadata: [formatToken(result.workItem.type), formatToken(result.workItem.status)],
    lifecycle: [
      ...projectLifecycle(result.project.status),
      ...terminalLifecycle(result.workItem.status, 'work item')
    ]
  };
}

function milestoneRow(
  result: QuickFindMilestoneResultDto,
  common: Pick<QuickFindResultRow, 'id' | 'result' | 'excerpt'>
): QuickFindResultRow {
  return {
    ...common,
    identity: 'Milestone',
    title: result.milestone.name,
    context: projectContext(result),
    metadata: [
      formatToken(result.milestone.status),
      result.milestone.targetDate === null
        ? 'No target date'
        : `Target ${formatDate(result.milestone.targetDate)}`
    ],
    lifecycle: [
      ...projectLifecycle(result.project.status),
      ...(result.milestone.isArchived ? ['Archived milestone'] : []),
      ...terminalLifecycle(result.milestone.status, 'milestone')
    ]
  };
}

function cycleRow(
  result: QuickFindCycleResultDto,
  common: Pick<QuickFindResultRow, 'id' | 'result' | 'excerpt'>
): QuickFindResultRow {
  return {
    ...common,
    identity: 'Cycle',
    title: result.cycle.name,
    context: projectContext(result),
    metadata: [
      formatToken(result.cycle.status),
      `${formatDate(result.cycle.startDate)} to ${formatDate(result.cycle.endDate)}`
    ],
    lifecycle: [
      ...projectLifecycle(result.project.status),
      ...(result.cycle.isArchived ? ['Archived cycle'] : []),
      ...terminalLifecycle(result.cycle.status, 'cycle')
    ]
  };
}

function reportRow(
  result: QuickFindReportResultDto,
  common: Pick<QuickFindResultRow, 'id' | 'result' | 'excerpt'>
): QuickFindResultRow {
  return {
    ...common,
    identity: 'Status report',
    title: result.report.title,
    context: projectContext(result),
    metadata: [
      formatToken(result.report.health),
      `Status ${formatDate(result.report.statusDate)}`,
      `Published ${formatDate(result.report.publishedAt)}`
    ],
    lifecycle: projectLifecycle(result.project.status)
  };
}

function attachmentRow(
  result: QuickFindAttachmentResultDto,
  common: Pick<QuickFindResultRow, 'id' | 'result' | 'excerpt'>
): QuickFindResultRow {
  return {
    ...common,
    identity: 'Attachment',
    title: result.attachment.fileName,
    context: `${result.workItem.displayKey} · ${result.workItem.title} · ${projectContext(result)}`,
    metadata: [
      formatBytes(result.attachment.byteSize),
      `Added ${formatDate(result.attachment.createdAt)}`
    ],
    lifecycle: [
      ...projectLifecycle(result.project.status),
      ...terminalLifecycle(result.workItem.status, 'work item')
    ]
  };
}

function projectContext(
  result: Exclude<QuickFindResultDto, QuickFindProjectResultDto>
): string {
  return `${result.project.key} · ${result.project.name}`;
}

function projectLifecycle(status: QuickFindResultDto['project']['status']): readonly string[] {
  return status === 'archived' ? ['Archived project'] : [];
}

function terminalLifecycle(status: string, entity: string): readonly string[] {
  if (status === 'completed' || status === 'done') {
    return [`Completed ${entity}`];
  }

  return status === 'canceled' ? [`Canceled ${entity}`] : [];
}

function formatToken(value: string): string {
  const readable = value.replaceAll('_', ' ');
  return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}`;
}

function formatDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? dateOnly(value)
    : new Date(value);

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function dateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Quick Find result kind: ${String(value)}`);
}
