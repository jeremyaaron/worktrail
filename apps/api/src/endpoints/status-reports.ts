import type {
  CreateProjectStatusReportRequest,
  ProjectStatusReportDetailDto,
  ProjectStatusReportDraftDto,
  ProjectStatusReportSnapshotDto,
  ProjectStatusReportSummaryDto,
  WorkItemQuery
} from '@worktrail/contracts';
import { z } from 'zod';

import type { WorktrailDb } from '../db/client.js';
import { milestoneStatuses, projectStatuses, workItemPriorities, workItemStatuses } from '../domain/constants.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { ProjectStatusReportService } from '../services/project-status-report-service.js';
import { parseWithSchema } from '../validation/parse.js';

export interface StatusReportHandlerOptions {
  repositories: Repositories;
  db?: WorktrailDb;
}

const projectParamSchema = z.object({
  projectId: z.string().uuid()
});

const reportParamSchema = z.object({
  projectId: z.string().uuid(),
  reportId: z.string().uuid()
});

const isoDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const narrativeSchema = z.string().trim().max(4000);
const workItemQuerySchema = z.record(z.string(), z.unknown()) as z.ZodType<WorkItemQuery>;
const deliveryHealthReasonSchema = z.object({
  key: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  count: z.number().int().nonnegative(),
  query: workItemQuerySchema.nullable()
});
const deliveryHealthSchema = z.object({
  health: z.enum(['healthy', 'at_risk', 'blocked', 'complete', 'inactive']),
  activeMilestoneCount: z.number().int().nonnegative(),
  healthyMilestoneCount: z.number().int().nonnegative(),
  atRiskMilestoneCount: z.number().int().nonnegative(),
  blockedMilestoneCount: z.number().int().nonnegative(),
  completeMilestoneCount: z.number().int().nonnegative(),
  inactiveMilestoneCount: z.number().int().nonnegative(),
  openWorkCount: z.number().int().nonnegative(),
  blockedWorkCount: z.number().int().nonnegative(),
  dependencyBlockedWorkCount: z.number().int().nonnegative(),
  blockingOpenWorkCount: z.number().int().nonnegative(),
  overdueWorkCount: z.number().int().nonnegative(),
  dueSoonWorkCount: z.number().int().nonnegative(),
  unassignedActiveWorkCount: z.number().int().nonnegative(),
  staleInProgressWorkCount: z.number().int().nonnegative(),
  unmilestonedActiveRiskCount: z.number().int().nonnegative(),
  reasons: z.array(deliveryHealthReasonSchema)
});
const countSnapshotSchema = z.object({
  openWorkCount: z.number().int().nonnegative(),
  blockedWorkCount: z.number().int().nonnegative(),
  dependencyBlockedWorkCount: z.number().int().nonnegative(),
  blockingOpenWorkCount: z.number().int().nonnegative(),
  overdueWorkCount: z.number().int().nonnegative(),
  dueSoonWorkCount: z.number().int().nonnegative(),
  unassignedActiveWorkCount: z.number().int().nonnegative(),
  staleInProgressWorkCount: z.number().int().nonnegative()
});
const memberSchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    role: z.enum(['owner', 'maintainer', 'contributor']),
    isActive: z.boolean(),
    deactivatedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .passthrough();
const milestoneSchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string(),
    description: z.string(),
    status: z.enum(milestoneStatuses),
    targetDate: isoDateSchema.nullable(),
    isArchived: z.boolean(),
    archivedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .passthrough();
const planningRiskItemSchema = z.object({
  id: z.string().uuid(),
  displayKey: z.string(),
  title: z.string(),
  status: z.enum(workItemStatuses),
  priority: z.enum(workItemPriorities),
  assignee: memberSchema.nullable(),
  dueDate: isoDateSchema.nullable(),
  milestone: milestoneSchema.nullable(),
  updatedAt: z.string()
});
const milestoneSnapshotSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(milestoneStatuses),
  targetDate: isoDateSchema.nullable(),
  totalCount: z.number().int().nonnegative(),
  openCount: z.number().int().nonnegative(),
  doneCount: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
  dependencyBlockedCount: z.number().int().nonnegative(),
  overdueCount: z.number().int().nonnegative(),
  dueSoonCount: z.number().int().nonnegative(),
  unassignedActiveCount: z.number().int().nonnegative(),
  staleInProgressCount: z.number().int().nonnegative(),
  health: z.enum(['healthy', 'at_risk', 'blocked', 'complete', 'inactive']),
  reasons: z.array(deliveryHealthReasonSchema)
});
const riskSnapshotSchema = z.object({
  type: z.enum([
    'blocked',
    'dependency_blocked',
    'overdue',
    'due_soon',
    'unassigned_active',
    'stale_in_progress',
    'blocking_open_work'
  ]),
  title: z.string(),
  count: z.number().int().nonnegative(),
  query: workItemQuerySchema,
  items: z.array(planningRiskItemSchema)
});
const snapshotSchema = z.object({
  snapshotVersion: z.literal(1),
  generatedAt: z.string(),
  project: z.object({
    id: z.string().uuid(),
    key: z.string(),
    name: z.string(),
    status: z.enum(projectStatuses)
  }),
  health: deliveryHealthSchema,
  counts: countSnapshotSchema,
  milestones: z.array(milestoneSnapshotSchema),
  risks: z.array(riskSnapshotSchema),
  recentWork: z.array(planningRiskItemSchema)
}) as z.ZodType<ProjectStatusReportSnapshotDto>;

const createStatusReportSchema = z.object({
  title: z.string().trim().min(1).max(120),
  statusDate: isoDateSchema,
  summary: narrativeSchema.min(1),
  highlights: narrativeSchema.optional(),
  risks: narrativeSchema.optional(),
  nextSteps: narrativeSchema.optional(),
  snapshot: snapshotSchema.optional()
}) satisfies z.ZodType<CreateProjectStatusReportRequest>;

export function listProjectStatusReportsHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<ProjectStatusReportSummaryDto[]> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectParamSchema, request.params);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });

    return {
      status: 200,
      body: await service.listProjectStatusReports(projectId)
    };
  };
}

export function getProjectStatusReportDraftHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<ProjectStatusReportDraftDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectParamSchema, request.params);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });

    return {
      status: 200,
      body: await service.getProjectStatusReportDraft(projectId)
    };
  };
}

export function publishProjectStatusReportHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<ProjectStatusReportDetailDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectParamSchema, request.params);
    const body = parseWithSchema(createStatusReportSchema, request.body);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });

    return {
      status: 201,
      body: await service.publishProjectStatusReport(projectId, body)
    };
  };
}

export function getProjectStatusReportHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<ProjectStatusReportDetailDto> {
  return async (request) => {
    const { projectId, reportId } = parseWithSchema(reportParamSchema, request.params);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });

    return {
      status: 200,
      body: await service.getProjectStatusReport(projectId, reportId)
    };
  };
}

export function exportProjectStatusReportMarkdownHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<string> {
  return async (request) => {
    const { projectId, reportId } = parseWithSchema(reportParamSchema, request.params);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });
    const exportResult = await service.exportProjectStatusReportMarkdown(projectId, reportId);

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportResult.fileName}"`
      },
      body: exportResult.markdown
    };
  };
}
