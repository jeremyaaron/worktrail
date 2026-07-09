import type {
  CreateProjectStatusReportRequest,
  MilestoneProgressDto,
  ProjectStatusReportCountSnapshotDto,
  ProjectStatusReportDetailDto,
  ProjectStatusReportDraftDto,
  ProjectStatusReportMilestoneSnapshotDto,
  ProjectStatusReportSnapshotDto,
  ProjectStatusReportSummaryDto
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { canManageProject } from '../domain/permissions.js';
import { toDateString } from '../domain/work-risk-policy.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { Member, Milestone, Project, ProjectStatusReport } from '../repositories/types.js';
import { DeliveryHealthService } from './delivery-health-service.js';
import {
  toProjectDto,
  toProjectStatusReportDetailDto,
  toProjectStatusReportSummaryDto
} from './dto.js';
import {
  renderStatusReportMarkdown,
  statusReportMarkdownFileName
} from './status-report-markdown-renderer.js';
import {
  createProjectStatusReportRiskSnapshots,
  createWorkRiskEvaluationContext,
  toPlanningRiskItems
} from './work-risk-sections.js';
import {
  parseRequestedProjectStatusReportSnapshot,
  parseStoredProjectStatusReportSnapshot
} from '../validation/project-status-report-snapshot.js';

const recentWorkLimit = 8;
const milestoneSnapshotStatuses = new Set<Milestone['status']>(['planned', 'active']);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export interface ProjectStatusReportServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

interface SnapshotInput {
  project: Project;
  repositories: Repositories;
  generatedAt: Date;
}

interface NormalizedPublishInput {
  title: string;
  statusDate: string;
  summary: string;
  highlights: string;
  risks: string;
  nextSteps: string;
  snapshot?: ProjectStatusReportSnapshotDto;
}

export interface ProjectStatusReportMarkdownExport {
  markdown: string;
  fileName: string;
}

export class ProjectStatusReportService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: ProjectStatusReportServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listProjectStatusReports(projectId: string): Promise<ProjectStatusReportSummaryDto[]> {
    await this.requireProject(projectId, this.context.repositories);
    const reports = await this.context.repositories.projectStatusReports.listByProject(projectId);
    const authors = await this.hydrateAuthors(reports, this.context.repositories);

    return reports.map((report) => {
      const parsedReport = this.withParsedStoredSnapshot(report);
      const author = authors.get(report.authorMemberId);

      if (author === undefined) {
        throw new NotFoundError('Status report author not found.');
      }

      return toProjectStatusReportSummaryDto(parsedReport, author);
    });
  }

  async getProjectStatusReport(
    projectId: string,
    reportId: string
  ): Promise<ProjectStatusReportDetailDto> {
    const project = await this.requireProject(projectId, this.context.repositories);
    const report = await this.requireReport(projectId, reportId, this.context.repositories);
    const author = await this.requireReportAuthor(report, this.context.repositories);
    const parsedReport = this.withParsedStoredSnapshot(report);

    return toProjectStatusReportDetailDto(parsedReport, project, author);
  }

  async exportProjectStatusReportMarkdown(
    projectId: string,
    reportId: string
  ): Promise<ProjectStatusReportMarkdownExport> {
    const report = await this.getProjectStatusReport(projectId, reportId);

    return {
      markdown: renderStatusReportMarkdown(report),
      fileName: statusReportMarkdownFileName(report)
    };
  }

  async getProjectStatusReportDraft(projectId: string): Promise<ProjectStatusReportDraftDto> {
    const project = await this.requireProject(projectId, this.context.repositories);
    this.assertCanPublish(project);

    const generatedAt = this.clock();
    const snapshot = await this.createSnapshot({
      project,
      repositories: this.context.repositories,
      generatedAt
    });
    const narrative = createDraftNarrative(snapshot);

    return {
      project: toProjectDto(project),
      title: `Status update - ${toDateString(generatedAt)}`,
      statusDate: toDateString(generatedAt),
      summary: narrative.summary,
      highlights: '',
      risks: narrative.risks,
      nextSteps: '',
      snapshot
    };
  }

  async publishProjectStatusReport(
    projectId: string,
    input: CreateProjectStatusReportRequest
  ): Promise<ProjectStatusReportDetailDto> {
    return this.withWriteRepositories(async (repositories) => {
      const project = await this.requireProject(projectId, repositories);
      this.assertCanPublish(project);

      const timestamp = this.clock();
      const normalized = this.normalizePublishInput(input);
      const snapshot =
        normalized.snapshot === undefined
          ? parseRequestedProjectStatusReportSnapshot(
              await this.createSnapshot({ project, repositories, generatedAt: timestamp })
            )
          : this.validateSnapshot(project, normalized.snapshot);

      const report = await repositories.projectStatusReports.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        authorMemberId: this.context.actor.memberId,
        title: normalized.title,
        statusDate: normalized.statusDate,
        summary: normalized.summary,
        highlights: normalized.highlights,
        risks: normalized.risks,
        nextSteps: normalized.nextSteps,
        snapshot,
        publishedAt: timestamp,
        createdAt: timestamp
      });

      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'status_report.published',
        summary: `Status report "${report.title}" published.`,
        previousValue: null,
        newValue: { reportId: report.id, title: report.title, statusDate: report.statusDate },
        metadata: { projectId: project.id, reportId: report.id },
        createdAt: timestamp
      });

      const author = await this.requireReportAuthor(report, repositories);
      return toProjectStatusReportDetailDto(report, project, author);
    });
  }

  private async requireProject(projectId: string, repositories: Repositories): Promise<Project> {
    const project = await repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private async requireReport(
    projectId: string,
    reportId: string,
    repositories: Repositories
  ): Promise<ProjectStatusReport> {
    const report = await repositories.projectStatusReports.findById(reportId);

    if (
      report === null ||
      report.workspaceId !== this.context.actor.workspaceId ||
      report.projectId !== projectId
    ) {
      throw new NotFoundError('Status report not found.');
    }

    return report;
  }

  private assertCanPublish(project: Project): void {
    if (!canManageProject(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can publish project status reports.');
    }

    if (project.status === 'archived') {
      throw new ConflictError('Archived projects cannot publish status reports.');
    }
  }

  private async requireReportAuthor(report: ProjectStatusReport, repositories: Repositories): Promise<Member> {
    const author = await repositories.members.findById(report.authorMemberId);

    if (author === null || author.workspaceId !== report.workspaceId) {
      throw new NotFoundError('Status report author not found.');
    }

    return author;
  }

  private async hydrateAuthors(
    reports: ProjectStatusReport[],
    repositories: Repositories
  ): Promise<Map<string, Member>> {
    const authors = new Map<string, Member>();
    const authorIds = new Set(reports.map((report) => report.authorMemberId));

    await Promise.all(
      [...authorIds].map(async (authorId) => {
        const author = await repositories.members.findById(authorId);

        if (author !== null && author.workspaceId === this.context.actor.workspaceId) {
          authors.set(author.id, author);
        }
      })
    );

    return authors;
  }

  private withParsedStoredSnapshot(report: ProjectStatusReport): ProjectStatusReport {
    return {
      ...report,
      snapshot: parseStoredProjectStatusReportSnapshot(report.snapshot)
    };
  }

  private async createSnapshot(input: SnapshotInput): Promise<ProjectStatusReportSnapshotDto> {
    const workItems = await input.repositories.workItems.listByProject(input.project.id, {
      sort: 'board_order'
    });
    const dependencyBlockedWorkItems = await input.repositories.workItems.listByProject(
      input.project.id,
      {
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      }
    );
    const blockingOpenWorkItems = await input.repositories.workItems.listByProject(input.project.id, {
      dependency: 'blocking_open_work',
      sort: 'priority_desc'
    });
    const milestones = await input.repositories.milestones.listByProject(input.project.id, {
      includeArchived: true
    });
    const members = await input.repositories.members.listByWorkspace(this.context.actor.workspaceId);
    const healthSummary = new DeliveryHealthService().derive({
      project: input.project,
      workItems,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems,
      milestones,
      now: input.generatedAt
    });
    const memberById = new Map(members.map((member) => [member.id, member]));
    const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
    const evaluationContext = createWorkRiskEvaluationContext({
      now: input.generatedAt,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems
    });

    return {
      snapshotVersion: 1,
      generatedAt: input.generatedAt.toISOString(),
      project: {
        id: input.project.id,
        key: input.project.key,
        name: input.project.name,
        status: input.project.status
      },
      health: healthSummary.deliveryHealth,
      counts: toCountSnapshot(healthSummary.deliveryHealth),
      milestones: healthSummary.milestoneProgress
        .filter((progress) => milestoneSnapshotStatuses.has(progress.milestone.status))
        .map(toMilestoneSnapshot),
      risks: createProjectStatusReportRiskSnapshots({
        workItems,
        memberById,
        milestoneById,
        context: evaluationContext
      }),
      recentWork: toPlanningRiskItems(
        [...workItems]
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
          .slice(0, recentWorkLimit),
        memberById,
        milestoneById
      )
    };
  }

  private normalizePublishInput(input: CreateProjectStatusReportRequest): NormalizedPublishInput {
    const title = input.title.trim();
    const statusDate = input.statusDate.trim();
    const summary = input.summary.trim();
    const highlights = input.highlights?.trim() ?? '';
    const risks = input.risks?.trim() ?? '';
    const nextSteps = input.nextSteps?.trim() ?? '';

    if (title === '') {
      throw new ValidationError('Status report title is required.');
    }

    if (title.length > 120) {
      throw new ValidationError('Status report title must be 120 characters or less.');
    }

    if (!isoDatePattern.test(statusDate)) {
      throw new ValidationError('Status report date must be an ISO date.');
    }

    if (summary === '') {
      throw new ValidationError('Status report summary is required.');
    }

    for (const [label, value] of [
      ['summary', summary],
      ['highlights', highlights],
      ['risks', risks],
      ['next steps', nextSteps]
    ] as const) {
      if (value.length > 4000) {
        throw new ValidationError(`Status report ${label} must be 4000 characters or less.`);
      }
    }

    return {
      title,
      statusDate,
      summary,
      highlights,
      risks,
      nextSteps,
      snapshot: input.snapshot
    };
  }

  private validateSnapshot(
    project: Project,
    snapshot: ProjectStatusReportSnapshotDto
  ): ProjectStatusReportSnapshotDto {
    const parsed = parseRequestedProjectStatusReportSnapshot(snapshot);

    if (parsed.project.id !== project.id || parsed.project.key !== project.key) {
      throw new ValidationError('Status report snapshot does not match the project.');
    }

    for (const risk of parsed.risks) {
      if (risk.query.projectId !== undefined && risk.query.projectId !== project.id) {
        throw new ValidationError('Status report snapshot includes a query for another project.');
      }
    }

    return parsed;
  }

  private async withWriteRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    if (this.context.db === undefined) {
      return callback(this.context.repositories);
    }

    return withRepositoriesTransaction(this.context.db, callback);
  }
}

function toCountSnapshot(
  deliveryHealth: ProjectStatusReportSnapshotDto['health']
): ProjectStatusReportCountSnapshotDto {
  return {
    openWorkCount: deliveryHealth.openWorkCount,
    blockedWorkCount: deliveryHealth.blockedWorkCount,
    dependencyBlockedWorkCount: deliveryHealth.dependencyBlockedWorkCount,
    blockingOpenWorkCount: deliveryHealth.blockingOpenWorkCount,
    overdueWorkCount: deliveryHealth.overdueWorkCount,
    dueSoonWorkCount: deliveryHealth.dueSoonWorkCount,
    unassignedActiveWorkCount: deliveryHealth.unassignedActiveWorkCount,
    staleInProgressWorkCount: deliveryHealth.staleInProgressWorkCount
  };
}

function toMilestoneSnapshot(progress: MilestoneProgressDto): ProjectStatusReportMilestoneSnapshotDto {
  return {
    id: progress.milestone.id,
    name: progress.milestone.name,
    status: progress.milestone.status,
    targetDate: progress.milestone.targetDate,
    totalCount: progress.totalCount,
    openCount: progress.openCount,
    doneCount: progress.doneCount,
    blockedCount: progress.blockedCount,
    dependencyBlockedCount: progress.dependencyBlockedCount,
    overdueCount: progress.overdueCount,
    dueSoonCount: progress.dueSoonCount,
    unassignedActiveCount: progress.unassignedActiveCount,
    staleInProgressCount: progress.staleInProgressCount,
    health: progress.health,
    reasons: progress.reasons
  };
}

function createDraftNarrative(snapshot: ProjectStatusReportSnapshotDto): {
  summary: string;
  risks: string;
} {
  const health = snapshot.health.health.replaceAll('_', ' ');
  const summary =
    `Project is ${health} with ${snapshot.counts.openWorkCount} open work item` +
    `${snapshot.counts.openWorkCount === 1 ? '' : 's'}, ${snapshot.counts.blockedWorkCount}` +
    ` blocked, and ${snapshot.counts.overdueWorkCount} overdue.`;
  const riskLines = snapshot.risks
    .filter((risk) => risk.count > 0)
    .slice(0, 3)
    .map((risk) => `${risk.title}: ${risk.count}`);

  return {
    summary,
    risks:
      riskLines.length === 0
        ? 'No major delivery risks are currently flagged.'
        : riskLines.join('\n')
  };
}
