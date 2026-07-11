import type {
  DeliveryHealthSeverity,
  DeliveryHealthState,
  PortfolioAttentionItemDto,
  PortfolioAttentionSectionsDto,
  PortfolioDto,
  PortfolioLinkDto,
  PortfolioProjectRowDto,
  PortfolioSummaryDto,
  WorkItemQuery
} from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import {
  addDays,
  isOpenWorkItemStatus,
  isStaleInProgressStatus,
  staleInProgressDays,
  toDateString
} from '../domain/work-risk-policy.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type {
  Member,
  Milestone,
  Project,
  ProjectCycle,
  ProjectStatusReport,
  WorkItem
} from '../repositories/types.js';
import { parseStoredProjectStatusReportSnapshot } from '../validation/project-status-report-snapshot.js';
import { DeliveryHealthService } from './delivery-health-service.js';
import { toProjectDto, toProjectStatusReportSummaryDto } from './dto.js';

const reportFreshnessThresholdDays = 14;
const attentionLimit = 5;
const projectHealthRank: Record<DeliveryHealthState, number> = {
  blocked: 0,
  at_risk: 1,
  healthy: 2,
  complete: 3,
  inactive: 4
};
const severityRank: Record<DeliveryHealthSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2
};

export interface PortfolioServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
}

interface ProjectCollections {
  workItems: WorkItem[];
  dependencyBlockedWorkItems: WorkItem[];
  blockingOpenWorkItems: WorkItem[];
  milestones: Milestone[];
  activeCycle: ProjectCycle | null;
  latestReport: ProjectStatusReport | null;
}

export class PortfolioService {
  private readonly clock: () => Date;

  constructor(private readonly context: PortfolioServiceContext) {
    this.clock = context.clock ?? (() => new Date());
  }

  async getPortfolio(): Promise<PortfolioDto> {
    const generatedAt = this.clock();
    const workspaceId = this.context.actor.workspaceId;
    const allProjects = await this.context.repositories.projects.listByWorkspace(workspaceId);
    const activeProjects = allProjects.filter((project) => project.status === 'active');
    const [workRecords, dependencyBlockedRecords, blockingOpenRecords, members] = await Promise.all([
      this.context.repositories.workItems.listByWorkspace(workspaceId, {
        archivedProjects: 'exclude',
        sort: 'updated_desc'
      }),
      this.context.repositories.workItems.listByWorkspace(workspaceId, {
        archivedProjects: 'exclude',
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      }),
      this.context.repositories.workItems.listByWorkspace(workspaceId, {
        archivedProjects: 'exclude',
        dependency: 'blocking_open_work',
        sort: 'priority_desc'
      }),
      this.context.repositories.members.listByWorkspace(workspaceId)
    ]);
    const workItemsByProject = groupByProject(workRecords.map((record) => record.workItem));
    const dependencyBlockedByProject = groupByProject(
      dependencyBlockedRecords.map((record) => record.workItem)
    );
    const blockingOpenByProject = groupByProject(blockingOpenRecords.map((record) => record.workItem));
    const membersById = new Map(members.map((member) => [member.id, member]));
    const rows = await Promise.all(
      activeProjects.map(async (project) => {
        const collections = await this.loadProjectCollections(project, {
          workItemsByProject,
          dependencyBlockedByProject,
          blockingOpenByProject
        });
        return this.toPortfolioProjectRow(project, collections, membersById, generatedAt);
      })
    );
    const sortedRows = rows.sort(comparePortfolioRows);

    return {
      generatedAt: generatedAt.toISOString(),
      reportFreshnessThresholdDays,
      summary: createSummary(sortedRows),
      attention: createAttentionSections(sortedRows),
      projects: sortedRows
    };
  }

  private async loadProjectCollections(
    project: Project,
    input: {
      workItemsByProject: Map<string, WorkItem[]>;
      dependencyBlockedByProject: Map<string, WorkItem[]>;
      blockingOpenByProject: Map<string, WorkItem[]>;
    }
  ): Promise<ProjectCollections> {
    const [milestones, activeCycle, latestReport] = await Promise.all([
      this.context.repositories.milestones.listByProject(project.id, { includeArchived: true }),
      this.context.repositories.projectCycles.findActiveByProject(project.id),
      this.context.repositories.projectStatusReports.findLatestByProject(project.id)
    ]);

    return {
      workItems: input.workItemsByProject.get(project.id) ?? [],
      dependencyBlockedWorkItems: input.dependencyBlockedByProject.get(project.id) ?? [],
      blockingOpenWorkItems: input.blockingOpenByProject.get(project.id) ?? [],
      milestones,
      activeCycle,
      latestReport
    };
  }

  private toPortfolioProjectRow(
    project: Project,
    collections: ProjectCollections,
    membersById: Map<string, Member>,
    generatedAt: Date
  ): PortfolioProjectRowDto {
    const delivery = new DeliveryHealthService().derive({
      project,
      workItems: collections.workItems,
      dependencyBlockedWorkItems: collections.dependencyBlockedWorkItems,
      blockingOpenWorkItems: collections.blockingOpenWorkItems,
      milestones: collections.milestones,
      now: generatedAt
    });
    const projectDto = toProjectDto(project);
    const primaryMilestone = selectPrimaryMilestone(delivery.milestoneProgress);
    const activeCycle = collections.activeCycle;
    const report = createReportSummary(collections.latestReport, membersById, generatedAt);
    const updatedAt = latestUpdatedAt(project, collections.workItems);

    return {
      project: projectDto,
      deliveryHealth: delivery.deliveryHealth,
      openWorkItemCount: delivery.deliveryHealth.openWorkCount,
      blockedWorkItemCount: delivery.deliveryHealth.blockedWorkCount,
      dependencyBlockedWorkItemCount: delivery.deliveryHealth.dependencyBlockedWorkCount,
      blockingOpenWorkItemCount: delivery.deliveryHealth.blockingOpenWorkCount,
      overdueWorkItemCount: delivery.deliveryHealth.overdueWorkCount,
      staleInProgressWorkItemCount: delivery.deliveryHealth.staleInProgressWorkCount,
      updatedAt: updatedAt.toISOString(),
      report,
      planning: {
        activeMilestone:
          primaryMilestone === null
            ? null
            : {
                id: primaryMilestone.milestone.id,
                name: primaryMilestone.milestone.name,
                status: primaryMilestone.milestone.status,
                health: primaryMilestone.health,
                openCount: primaryMilestone.openCount,
                targetDate: primaryMilestone.milestone.targetDate
              },
        activeCycle:
          activeCycle === null
            ? null
            : {
                id: activeCycle.id,
                name: activeCycle.name,
                health: deriveCycleHealth(activeCycle, collections, generatedAt),
                openWorkCount: collections.workItems.filter(
                  (workItem) =>
                    workItem.cycleId === activeCycle.id && isOpenWorkItemStatus(workItem.status)
                ).length,
                endDate: activeCycle.endDate,
                targetPoints: activeCycle.targetPoints
              }
      },
      links: createLinks(project, primaryMilestone?.milestone.id ?? null, activeCycle?.id ?? null, report)
    };
  }
}

function groupByProject(workItems: WorkItem[]): Map<string, WorkItem[]> {
  const grouped = new Map<string, WorkItem[]>();

  for (const workItem of workItems) {
    grouped.set(workItem.projectId, [...(grouped.get(workItem.projectId) ?? []), workItem]);
  }

  return grouped;
}

function latestUpdatedAt(project: Project, workItems: WorkItem[]): Date {
  return workItems.reduce(
    (latest, workItem) => (workItem.updatedAt.getTime() > latest.getTime() ? workItem.updatedAt : latest),
    project.updatedAt
  );
}

function createReportSummary(
  report: ProjectStatusReport | null,
  membersById: Map<string, Member>,
  generatedAt: Date
): PortfolioProjectRowDto['report'] {
  if (report === null) {
    return {
      freshness: 'missing',
      thresholdDays: reportFreshnessThresholdDays,
      latestReport: null,
      daysSincePublished: null
    };
  }

  const author = membersById.get(report.authorMemberId);

  if (author === undefined) {
    throw new NotFoundError('Status report author not found.');
  }

  const parsedReport = {
    ...report,
    snapshot: parseStoredProjectStatusReportSnapshot(report.snapshot)
  };
  const daysSincePublished = daysBetweenUtcDates(report.publishedAt, generatedAt);

  return {
    freshness: daysSincePublished > reportFreshnessThresholdDays ? 'stale' : 'fresh',
    thresholdDays: reportFreshnessThresholdDays,
    latestReport: toProjectStatusReportSummaryDto(parsedReport, author),
    daysSincePublished
  };
}

function daysBetweenUtcDates(start: Date, end: Date): number {
  const startDate = Date.parse(`${toDateString(start)}T00:00:00.000Z`);
  const endDate = Date.parse(`${toDateString(end)}T00:00:00.000Z`);
  return Math.max(0, Math.floor((endDate - startDate) / 86_400_000));
}

function selectPrimaryMilestone(
  milestoneProgress: ReturnType<DeliveryHealthService['derive']>['milestoneProgress']
) {
  const candidates = milestoneProgress.filter((progress) =>
    ['blocked', 'at_risk', 'healthy'].includes(progress.health)
  );

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const healthDelta = projectHealthRank[left.health] - projectHealthRank[right.health];

    if (healthDelta !== 0) {
      return healthDelta;
    }

    const leftTarget = left.milestone.targetDate ?? '9999-12-31';
    const rightTarget = right.milestone.targetDate ?? '9999-12-31';
    const targetDelta = leftTarget.localeCompare(rightTarget);

    if (targetDelta !== 0) {
      return targetDelta;
    }

    return left.milestone.name.localeCompare(right.milestone.name);
  })[0]!;
}

function deriveCycleHealth(
  cycle: ProjectCycle,
  collections: ProjectCollections,
  generatedAt: Date
): DeliveryHealthState {
  const cycleWork = collections.workItems.filter((workItem) => workItem.cycleId === cycle.id);
  const openCycleWork = cycleWork.filter((workItem) => isOpenWorkItemStatus(workItem.status));

  if (openCycleWork.length === 0) {
    return cycle.status === 'completed' ? 'complete' : 'healthy';
  }

  const dependencyBlockedIds = new Set(collections.dependencyBlockedWorkItems.map((workItem) => workItem.id));

  if (
    openCycleWork.some(
      (workItem) => workItem.status === 'blocked' || dependencyBlockedIds.has(workItem.id)
    )
  ) {
    return 'blocked';
  }

  const staleCutoff = addDays(generatedAt, -staleInProgressDays);
  const completedEstimatePoints = cycleWork
    .filter((workItem) => workItem.status === 'done')
    .reduce((total, workItem) => total + (workItem.estimatePoints ?? 0), 0);
  const committedEstimatePoints = cycleWork.reduce(
    (total, workItem) => total + (workItem.estimatePoints ?? 0),
    0
  );

  if (
    openCycleWork.some((workItem) => isStaleInProgressStatus(workItem.status, workItem.updatedAt, staleCutoff)) ||
    openCycleWork.some((workItem) => workItem.assigneeId === null) ||
    (cycle.targetPoints !== null && committedEstimatePoints > cycle.targetPoints && completedEstimatePoints < committedEstimatePoints)
  ) {
    return 'at_risk';
  }

  return 'healthy';
}

function createLinks(
  project: Project,
  milestoneId: string | null,
  cycleId: string | null,
  report: PortfolioProjectRowDto['report']
): PortfolioProjectRowDto['links'] {
  const projectRoot = `/projects/${project.id}`;

  return {
    overview: { label: 'Overview', route: projectRoot },
    work: { label: 'Work', route: `${projectRoot}/work-items` },
    planning: { label: 'Planning', route: `${projectRoot}/planning` },
    reports: { label: 'Reports', route: `${projectRoot}/status` },
    ...(report.latestReport === null
      ? {}
      : {
          latestReport: {
            label: 'Latest report',
            route: `${projectRoot}/status/${report.latestReport.id}`
          }
        }),
    ...(milestoneId === null
      ? {}
      : {
          activeMilestone: {
            label: 'Review milestone',
            route: `${projectRoot}/milestones/${milestoneId}`
          }
        }),
    ...(cycleId === null
      ? {}
      : {
          activeCycle: {
            label: 'Review cycle',
            route: `${projectRoot}/cycles/${cycleId}`
          }
        }),
    blockedWork: projectWorkLink(project, 'Blocked work', { status: 'blocked', sort: 'priority_desc' }),
    dependencyBlockedWork: projectWorkLink(project, 'Dependency-blocked work', {
      dependency: 'dependency_blocked',
      sort: 'priority_desc'
    }),
    overdueWork: projectWorkLink(project, 'Overdue work', {
      dueDateState: 'overdue',
      workState: 'open',
      sort: 'due_date_asc'
    }),
    staleWork: projectWorkLink(project, 'Stale work', {
      workRisk: 'stale_in_progress',
      sort: 'updated_asc'
    })
  };
}

function projectWorkLink(project: Project, label: string, query: WorkItemQuery): PortfolioLinkDto {
  return {
    label,
    route: `/projects/${project.id}/work-items`,
    query,
    queryScope: 'project'
  };
}

function createSummary(rows: PortfolioProjectRowDto[]): PortfolioSummaryDto {
  return {
    activeProjectCount: rows.length,
    blockedProjectCount: rows.filter((row) => row.deliveryHealth.health === 'blocked').length,
    atRiskProjectCount: rows.filter((row) => row.deliveryHealth.health === 'at_risk').length,
    onTrackProjectCount: rows.filter((row) => row.deliveryHealth.health === 'healthy').length,
    overdueProjectCount: rows.filter((row) => row.overdueWorkItemCount > 0).length,
    dependencyPressureProjectCount: rows.filter(
      (row) => row.dependencyBlockedWorkItemCount > 0 || row.blockingOpenWorkItemCount > 0
    ).length,
    missingOrStaleReportProjectCount: rows.filter((row) => row.report.freshness !== 'fresh').length
  };
}

function createAttentionSections(rows: PortfolioProjectRowDto[]): PortfolioAttentionSectionsDto {
  return {
    needsAttention: rows
      .filter((row) => ['blocked', 'at_risk'].includes(row.deliveryHealth.health))
      .map(createDeliveryRiskItem)
      .sort(compareAttentionItems)
      .slice(0, attentionLimit),
    communicationFreshness: rows
      .filter((row) => row.report.freshness !== 'fresh')
      .map(createCommunicationFreshnessItem)
      .sort(compareAttentionItems)
      .slice(0, attentionLimit),
    currentExecution: rows
      .filter((row) => row.planning.activeCycle !== null || row.planning.activeMilestone !== null)
      .map(createCurrentExecutionItem)
      .sort(compareAttentionItems)
      .slice(0, attentionLimit),
    dependencyPressure: rows
      .filter((row) => row.dependencyBlockedWorkItemCount > 0 || row.blockingOpenWorkItemCount > 0)
      .map(createDependencyPressureItem)
      .sort(compareAttentionItems)
      .slice(0, attentionLimit)
  };
}

function createDeliveryRiskItem(row: PortfolioProjectRowDto): PortfolioAttentionItemDto {
  const reason = row.deliveryHealth.reasons[0];

  return {
    type: 'delivery_risk',
    project: row.project,
    title: `${row.project.key} delivery ${humanizeHealth(row.deliveryHealth.health)}`,
    message: reason?.message ?? 'Project delivery health needs review.',
    severity: row.deliveryHealth.health === 'blocked' ? 'critical' : 'warning',
    link: reason?.query === null || reason?.query === undefined ? row.links.planning : {
      label: reason.message,
      route: row.links.work.route,
      query: reason.query,
      queryScope: 'project'
    }
  };
}

function createCommunicationFreshnessItem(row: PortfolioProjectRowDto): PortfolioAttentionItemDto {
  const missing = row.report.freshness === 'missing';

  return {
    type: 'communication_freshness',
    project: row.project,
    title: missing ? `${row.project.key} has no report` : `${row.project.key} report is stale`,
    message: missing
      ? 'No published status report is available.'
      : `Latest report is ${row.report.daysSincePublished ?? 0} days old.`,
    severity: missing ? 'warning' : 'info',
    link: row.links.reports
  };
}

function createCurrentExecutionItem(row: PortfolioProjectRowDto): PortfolioAttentionItemDto {
  const cycle = row.planning.activeCycle;
  const milestone = row.planning.activeMilestone;

  if (cycle !== null) {
    return {
      type: 'current_execution',
      project: row.project,
      title: `${row.project.key} active cycle`,
      message: `${cycle.name} has ${cycle.openWorkCount} open work item${plural(cycle.openWorkCount)}.`,
      severity: cycle.health === 'blocked' ? 'critical' : cycle.health === 'at_risk' ? 'warning' : 'info',
      link: row.links.activeCycle ?? row.links.planning
    };
  }

  return {
    type: 'current_execution',
    project: row.project,
    title: `${row.project.key} active milestone`,
    message:
      milestone === null
        ? 'Current planning context is available.'
        : `${milestone.name} has ${milestone.openCount} open work item${plural(milestone.openCount)}.`,
    severity: milestone?.health === 'blocked' ? 'critical' : milestone?.health === 'at_risk' ? 'warning' : 'info',
    link: row.links.activeMilestone ?? row.links.planning
  };
}

function createDependencyPressureItem(row: PortfolioProjectRowDto): PortfolioAttentionItemDto {
  const blockedCount = row.dependencyBlockedWorkItemCount;
  const blockingCount = row.blockingOpenWorkItemCount;

  return {
    type: 'dependency_pressure',
    project: row.project,
    title: `${row.project.key} dependency pressure`,
    message: `${blockedCount} blocked by dependencies, ${blockingCount} blocking downstream work.`,
    severity: blockedCount > 0 ? 'critical' : 'warning',
    link: row.links.dependencyBlockedWork ?? row.links.work
  };
}

function comparePortfolioRows(left: PortfolioProjectRowDto, right: PortfolioProjectRowDto): number {
  const rankDelta = portfolioUrgencyRank(left) - portfolioUrgencyRank(right);

  if (rankDelta !== 0) {
    return rankDelta;
  }

  return (
    right.blockedWorkItemCount - left.blockedWorkItemCount ||
    right.dependencyBlockedWorkItemCount - left.dependencyBlockedWorkItemCount ||
    right.overdueWorkItemCount - left.overdueWorkItemCount ||
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.project.name.localeCompare(right.project.name)
  );
}

function portfolioUrgencyRank(row: PortfolioProjectRowDto): number {
  if (row.deliveryHealth.health === 'blocked') {
    return 0;
  }

  if (row.dependencyBlockedWorkItemCount > 0) {
    return 1;
  }

  if (row.overdueWorkItemCount > 0) {
    return 2;
  }

  if (row.deliveryHealth.health === 'at_risk') {
    return 3;
  }

  if (row.report.freshness !== 'fresh') {
    return 4;
  }

  if (row.deliveryHealth.health === 'healthy') {
    return 5;
  }

  return 6;
}

function compareAttentionItems(
  left: PortfolioAttentionItemDto,
  right: PortfolioAttentionItemDto
): number {
  return (
    severityRank[left.severity] - severityRank[right.severity] ||
    left.project.name.localeCompare(right.project.name)
  );
}

function humanizeHealth(health: DeliveryHealthState): string {
  return health.replace('_', ' ');
}

function plural(count: number): string {
  return count === 1 ? '' : 's';
}
