import type {
  DeliveryHealthReasonDto,
  PlanningRiskItemDto,
  ProjectStatusReportDetailDto,
  ProjectStatusReportCycleSnapshotDto,
  ProjectStatusReportMilestoneSnapshotDto,
  ProjectStatusReportRiskSnapshotDto
} from '@worktrail/contracts';

import { projectWorkItemPathFromQuery } from './work-item-query-link.js';

export interface StatusReportMarkdownRenderOptions {
  appBasePath?: string;
}

const slugMaxLength = 60;

export function renderStatusReportMarkdown(
  report: ProjectStatusReportDetailDto,
  options: StatusReportMarkdownRenderOptions = {}
): string {
  const basePath = normalizeBasePath(options.appBasePath);
  const sections = [
    renderTitle(report),
    renderSnapshotNotice(),
    renderMetadata(report, basePath),
    renderNarrativeSection('Summary', report.summary, 'No summary provided.'),
    renderNarrativeSection('Highlights', report.highlights, 'No highlights provided.'),
    renderNarrativeSection('Risks', report.risks, 'No narrative risks provided.'),
    renderNarrativeSection('Next Steps', report.nextSteps, 'No next steps provided.'),
    renderCounts(report),
    renderHealthReasons(report.snapshot.health.reasons),
    renderMilestones(report, basePath),
    renderCycle(report, basePath),
    renderRiskSections(report, basePath),
    renderRecentWork(report.snapshot.recentWork, basePath)
  ];

  return `${sections.join('\n\n')}\n`;
}

export function statusReportMarkdownFileName(report: ProjectStatusReportDetailDto): string {
  const projectKey = slugify(report.project.key, 'project');
  const title = slugify(report.title, 'status-report');

  return `worktrail-${projectKey}-${report.statusDate}-${title}.md`;
}

function renderTitle(report: ProjectStatusReportDetailDto): string {
  return `# ${escapeMarkdownText(report.title)}`;
}

function renderSnapshotNotice(): string {
  return [
    '> Published snapshot.',
    'Values reflect the report as published. Links open current Worktrail data.'
  ].join(' ');
}

function renderMetadata(report: ProjectStatusReportDetailDto, basePath: string): string {
  const projectLink = markdownLink(
    `${report.project.key} - ${report.project.name}`,
    `${basePath}/projects/${encodeURIComponent(report.projectId)}`
  );

  return [
    '## Metadata',
    `- Project: ${projectLink}`,
    `- Status date: ${formatDate(report.statusDate)}`,
    `- Health: ${formatToken(report.health)}`,
    `- Author: ${escapeMarkdownInline(report.author.name)}`,
    `- Published: ${formatDateTime(report.publishedAt)}`,
    `- Snapshot generated: ${formatDateTime(report.snapshot.generatedAt)}`
  ].join('\n');
}

function renderNarrativeSection(title: string, value: string, emptyState: string): string {
  const normalized = value.trim();

  return [`## ${title}`, normalized.length === 0 ? emptyState : escapeMarkdownText(normalized)].join(
    '\n\n'
  );
}

function renderCounts(report: ProjectStatusReportDetailDto): string {
  const counts = report.snapshot.counts;
  const rows: Array<[string, number]> = [
    ['Open work', counts.openWorkCount],
    ['Blocked work', counts.blockedWorkCount],
    ['Dependency-blocked work', counts.dependencyBlockedWorkCount],
    ['Blocking open work', counts.blockingOpenWorkCount],
    ['Overdue work', counts.overdueWorkCount],
    ['Due soon work', counts.dueSoonWorkCount],
    ['Unassigned active work', counts.unassignedActiveWorkCount],
    ['Stale in-progress work', counts.staleInProgressWorkCount]
  ];

  return [
    '## Snapshot Counts',
    '| Count | Value |',
    '| --- | ---: |',
    ...rows.map(([label, value]) => `| ${escapeMarkdownTableCell(label)} | ${value} |`)
  ].join('\n');
}

function renderHealthReasons(reasons: DeliveryHealthReasonDto[]): string {
  if (reasons.length === 0) {
    return ['## Health Reasons', 'No delivery-health reasons recorded.'].join('\n\n');
  }

  return [
    '## Health Reasons',
    ...reasons.map(
      (reason) =>
        `- ${escapeMarkdownInline(reason.message)} (${formatToken(reason.severity)}, ${reason.count})`
    )
  ].join('\n');
}

function renderMilestones(report: ProjectStatusReportDetailDto, basePath: string): string {
  if (report.snapshot.milestones.length === 0) {
    return ['## Milestones', 'No active or planned milestones captured.'].join('\n\n');
  }

  return [
    '## Milestones',
    '| Milestone | Status | Target | Health | Open | Done | Blocked |',
    '| --- | --- | --- | --- | ---: | ---: | ---: |',
    ...report.snapshot.milestones.map((milestone) => renderMilestoneRow(report, milestone, basePath))
  ].join('\n');
}

function renderMilestoneRow(
  report: ProjectStatusReportDetailDto,
  milestone: ProjectStatusReportMilestoneSnapshotDto,
  basePath: string
): string {
  const link = markdownTableLink(
    milestone.name,
    `${basePath}/projects/${encodeURIComponent(report.projectId)}/milestones/${encodeURIComponent(
      milestone.id
    )}`
  );

  return [
    `| ${link}`,
    escapeMarkdownTableCell(formatToken(milestone.status)),
    escapeMarkdownTableCell(formatDateOrNone(milestone.targetDate)),
    escapeMarkdownTableCell(formatToken(milestone.health)),
    milestone.openCount,
    milestone.doneCount,
    `${milestone.blockedCount} |`
  ].join(' | ');
}

function renderCycle(report: ProjectStatusReportDetailDto, basePath: string): string {
  if (report.snapshot.cycle == null) {
    return ['## Active Cycle', 'No active cycle captured.'].join('\n\n');
  }

  const cycle = report.snapshot.cycle;
  const cycleLink = markdownLink(
    cycle.name,
    `${basePath}/projects/${encodeURIComponent(report.projectId)}/cycles/${encodeURIComponent(cycle.id)}`
  );
  const workLink = markdownLink(
    'Open current cycle work',
    `${basePath}${projectWorkItemPathFromQuery(report.projectId, {
      cycleId: cycle.id,
      workState: 'open',
      sort: 'priority_desc'
    })}`
  );

  return [
    '## Active Cycle',
    `- Cycle: ${cycleLink}`,
    `- Status: ${formatToken(cycle.status)}`,
    `- Window: ${formatDate(cycle.startDate)} to ${formatDate(cycle.endDate)}`,
    `- Health: ${formatToken(cycle.health)}`,
    `- Estimate: ${cycle.completedEstimatePoints}/${cycle.committedEstimatePoints}` +
      (cycle.targetPoints === null ? '' : ` of ${cycle.targetPoints} target points`),
    `- Open work: ${cycle.openWorkCount}`,
    `- Blocked work: ${cycle.blockedWorkCount}`,
    `- Dependency-blocked work: ${cycle.dependencyBlockedWorkCount}`,
    `- Unestimated open work: ${cycle.unestimatedWorkCount}`,
    `- ${workLink}`,
    renderCycleReasons(cycle)
  ].join('\n');
}

function renderCycleReasons(cycle: ProjectStatusReportCycleSnapshotDto): string {
  if (cycle.reasons.length === 0) {
    return '- Cycle reasons: none recorded.';
  }

  return [
    '- Cycle reasons:',
    ...cycle.reasons.map(
      (reason) =>
        `  - ${escapeMarkdownInline(reason.message)} (${formatToken(reason.severity)}, ${reason.count})`
    )
  ].join('\n');
}

function renderRiskSections(report: ProjectStatusReportDetailDto, basePath: string): string {
  if (report.snapshot.risks.length === 0) {
    return ['## Risk Sections', 'No risk sections captured.'].join('\n\n');
  }

  return [
    '## Risk Sections',
    ...report.snapshot.risks.map((risk) => renderRiskSection(report, risk, basePath))
  ].join('\n\n');
}

function renderRiskSection(
  report: ProjectStatusReportDetailDto,
  risk: ProjectStatusReportRiskSnapshotDto,
  basePath: string
): string {
  const workPath = `${basePath}${projectWorkItemPathFromQuery(report.projectId, risk.query)}`;
  const lines = [
    `### ${escapeMarkdownText(risk.title)}`,
    `${risk.count} matching ${risk.count === 1 ? 'item' : 'items'}.`,
    markdownLink('Open current work', workPath)
  ];

  if (risk.items.length === 0) {
    lines.push('No matching work items captured.');
  } else {
    lines.push(...risk.items.map((item) => `- ${renderWorkItemSummary(item, basePath)}`));
  }

  return lines.join('\n');
}

function renderRecentWork(items: PlanningRiskItemDto[], basePath: string): string {
  if (items.length === 0) {
    return ['## Recent Work', 'No recent work captured.'].join('\n\n');
  }

  return ['## Recent Work', ...items.map((item) => `- ${renderWorkItemSummary(item, basePath)}`)].join(
    '\n'
  );
}

function renderWorkItemSummary(item: PlanningRiskItemDto, basePath: string): string {
  const link = markdownLink(
    `${item.displayKey} - ${item.title}`,
    `${basePath}/work-items/${encodeURIComponent(item.id)}`
  );
  const assignee = item.assignee === null ? 'Unassigned' : item.assignee.name;
  const details = [
    formatToken(item.status),
    formatToken(item.priority),
    `assignee: ${assignee}`,
    `due: ${formatDateOrNone(item.dueDate)}`,
    `updated: ${formatDateTime(item.updatedAt)}`
  ];

  return `${link} - ${escapeMarkdownInline(details.join(', '))}`;
}

function markdownLink(label: string, href: string): string {
  return `[${escapeMarkdownInline(label)}](${encodeURI(href)})`;
}

function markdownTableLink(label: string, href: string): string {
  return markdownLink(label, href).replaceAll('|', '\\|');
}

function escapeMarkdownText(value: string): string {
  return normalizeLineEndings(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function escapeMarkdownInline(value: string): string {
  return escapeMarkdownText(value).replaceAll('\n', ' ');
}

function escapeMarkdownTableCell(value: string): string {
  return escapeMarkdownInline(value).replaceAll('|', '\\|');
}

function formatToken(value: string): string {
  const normalized = value.replaceAll('_', ' ').trim();

  if (normalized.length === 0) {
    return value;
  }

  return `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`;
}

function formatDateOrNone(value: string | null): string {
  return value === null ? 'None' : formatDate(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(value));
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, slugMaxLength)
    .replace(/-+$/g, '');

  return slug.length === 0 ? fallback : slug;
}

function normalizeBasePath(basePath: string | undefined): string {
  if (basePath === undefined || basePath.trim().length === 0 || basePath === '/') {
    return '';
  }

  return `/${basePath.replace(/^\/+|\/+$/g, '')}`;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}
