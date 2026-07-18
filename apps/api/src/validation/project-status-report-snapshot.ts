import type { ProjectStatusReportSnapshotDto } from '@worktrail/contracts';
import { z } from 'zod';

import {
  memberRoles,
  milestoneStatuses,
  projectCycleStatuses,
  projectStatuses,
  workItemPriorities,
  workItemStatuses
} from '../domain/constants.js';
import { ConflictError, ValidationError } from '../errors/app-error.js';

type SnapshotSource = 'request' | 'stored';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const workItemQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  status: z.enum(workItemStatuses).optional(),
  workState: z.enum(['open', 'terminal']).optional(),
  assigneeId: z.string().min(1).optional(),
  assigneeState: z.enum(['assigned', 'unassigned']).optional(),
  reporterId: z.string().min(1).optional(),
  type: z.enum(['task', 'bug', 'story', 'chore']).optional(),
  priority: z.enum(workItemPriorities).optional(),
  labelId: z.string().min(1).optional(),
  milestoneId: z.string().min(1).optional(),
  cycleId: z.string().min(1).optional(),
  dueDateState: z.enum(['overdue', 'due_soon', 'none']).optional(),
  blocked: z.boolean().optional(),
  dependency: z.enum(['dependency_blocked', 'blocking_open_work']).optional(),
  workRisk: z.enum(['unassigned_active', 'stale_in_progress']).optional(),
  archivedProjects: z.enum(['exclude', 'include', 'only']).optional(),
  search: z.string().optional(),
  sort: z
    .enum([
      'updated_desc',
      'updated_asc',
      'priority_desc',
      'priority_asc',
      'due_date_asc',
      'created_desc',
      'board_order'
    ])
    .optional()
});

const deliveryHealthReasonSchema = z.object({
  key: z.enum([
    'all_work_done',
    'blocked_work',
    'blocking_open_work',
    'completed_with_open_work',
    'dependency_blocked',
    'due_soon',
    'empty_active_milestone',
    'inactive_milestone',
    'open_work',
    'overdue_work',
    'stale_in_progress',
    'target_date_past',
    'unassigned_active',
    'unestimated_work',
    'cycle_over_target',
    'unmilestoned_risk'
  ]),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  count: z.number().int().nonnegative(),
  query: z.union([workItemQuerySchema, z.null()])
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

const memberSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string(),
  email: z.string(),
  role: z.enum(memberRoles),
  isActive: z.boolean(),
  deactivatedAt: z.union([z.string(), z.null()]),
  createdAt: z.string(),
  updatedAt: z.string()
});

const milestoneSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string(),
  description: z.string(),
  status: z.enum(milestoneStatuses),
  targetDate: z.union([z.string().regex(isoDatePattern), z.null()]),
  isArchived: z.boolean(),
  archivedAt: z.union([z.string(), z.null()]),
  createdAt: z.string(),
  updatedAt: z.string()
});

const workItemParentSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  displayKey: z.string(),
  title: z.string(),
  type: z.enum(['task', 'bug', 'story', 'chore']),
  status: z.enum(workItemStatuses)
});

const planningRiskItemSchema = z.object({
  id: z.string().min(1),
  displayKey: z.string(),
  title: z.string(),
  status: z.enum(workItemStatuses),
  priority: z.enum(workItemPriorities),
  assignee: z.union([memberSchema, z.null()]),
  dueDate: z.union([z.string().regex(isoDatePattern), z.null()]),
  milestone: z.union([milestoneSchema, z.null()]),
  updatedAt: z.string(),
  parent: z.union([workItemParentSchema, z.null()]).optional()
});

const milestoneSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  status: z.enum(milestoneStatuses),
  targetDate: z.union([z.string().regex(isoDatePattern), z.null()]),
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

const statusReportLinkSchema = z.object({
  type: z.enum(['project_work', 'milestone_review', 'cycle_review', 'work_item']),
  label: z.string(),
  projectId: z.string().min(1),
  query: workItemQuerySchema.optional(),
  milestoneId: z.string().min(1).optional(),
  cycleId: z.string().min(1).optional(),
  workItemId: z.string().min(1).optional()
});

const cycleSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  goal: z.string(),
  status: z.enum(projectCycleStatuses),
  startDate: z.string().regex(isoDatePattern),
  endDate: z.string().regex(isoDatePattern),
  targetPoints: z.union([z.number().int().positive(), z.null()]),
  committedEstimatePoints: z.number().int().nonnegative(),
  completedEstimatePoints: z.number().int().nonnegative(),
  openWorkCount: z.number().int().nonnegative(),
  blockedWorkCount: z.number().int().nonnegative(),
  dependencyBlockedWorkCount: z.number().int().nonnegative(),
  unestimatedWorkCount: z.number().int().nonnegative(),
  health: z.enum(['healthy', 'at_risk', 'blocked', 'complete', 'inactive']),
  reasons: z.array(deliveryHealthReasonSchema),
  links: z.array(statusReportLinkSchema)
});

export const projectStatusReportSnapshotSchema = z.object({
  snapshotVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  project: z.object({
    id: z.string().min(1),
    key: z.string(),
    name: z.string(),
    status: z.enum(projectStatuses)
  }),
  health: deliveryHealthSchema,
  counts: countSnapshotSchema,
  milestones: z.array(milestoneSnapshotSchema),
  cycle: z.union([cycleSnapshotSchema, z.null()]).optional(),
  risks: z.array(riskSnapshotSchema),
  recentWork: z.array(planningRiskItemSchema)
}) satisfies z.ZodType<ProjectStatusReportSnapshotDto>;

export function parseProjectStatusReportSnapshot(
  value: unknown,
  source: SnapshotSource
): ProjectStatusReportSnapshotDto {
  const result = projectStatusReportSnapshotSchema.safeParse(value);

  if (!result.success) {
    const details = result.error.flatten();

    if (source === 'stored') {
      throw new ConflictError('Stored status report snapshot is invalid.', details);
    }

    throw new ValidationError('Status report snapshot is invalid.', details);
  }

  return result.data;
}

export function parseStoredProjectStatusReportSnapshot(
  value: unknown
): ProjectStatusReportSnapshotDto {
  return parseProjectStatusReportSnapshot(value, 'stored');
}

export function parseRequestedProjectStatusReportSnapshot(
  value: unknown
): ProjectStatusReportSnapshotDto {
  return parseProjectStatusReportSnapshot(value, 'request');
}
