import type { SnapshotHealthReasonV2Dto, SnapshotWorkItemQueryV2 } from '@worktrail/contracts';
import { z } from 'zod';

import { deliveryHealthReasonSchema } from './project-status-report-snapshot-v1.js';

// This schema is frozen independently of HTTP/live query normalization and defaults.
export const snapshotWorkItemQueryV2Schema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['backlog', 'ready', 'in_progress', 'blocked', 'done', 'canceled']).optional(),
  workState: z.enum(['open', 'terminal']).optional(),
  assigneeId: z.string().uuid().optional(),
  assigneeState: z.enum(['assigned', 'unassigned']).optional(),
  reporterId: z.string().uuid().optional(),
  type: z.enum(['task', 'bug', 'story', 'chore']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  labelId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  cycleId: z.string().uuid().optional(),
  dueDateState: z.enum(['overdue', 'due_soon', 'none']).optional(),
  estimateState: z.enum(['estimated', 'unestimated']).optional(),
  blocked: z.boolean().optional(),
  dependency: z.enum(['dependency_blocked', 'blocking_open_work']).optional(),
  workRisk: z.enum(['unassigned_active', 'stale_in_progress']).optional(),
  hierarchy: z.enum(['top_level', 'children', 'parents']).optional(),
  parentKey: z.string().regex(/^[A-Z0-9]{2,8}-[1-9]\d*$/).max(80).optional(),
  archivedProjects: z.enum(['exclude', 'include', 'only']).optional(),
  search: z.string().max(120).optional(),
  sort: z.enum(['updated_desc', 'updated_asc', 'priority_desc', 'priority_asc', 'due_date_asc', 'created_desc', 'board_order']).optional()
}).strict().superRefine((query, context) => {
  if ((query.status !== undefined && query.workState !== undefined) ||
    (query.blocked === true && query.status !== undefined && query.status !== 'blocked') ||
    (query.assigneeId !== undefined && query.assigneeState === 'unassigned') ||
    (query.hierarchy !== undefined && query.parentKey !== undefined)) {
    context.addIssue({ code: 'custom', message: 'Snapshot query predicates conflict.' });
  }
}) satisfies z.ZodType<SnapshotWorkItemQueryV2>;

export const snapshotHealthReasonV2Schema = deliveryHealthReasonSchema.extend({
  query: z.union([snapshotWorkItemQueryV2Schema, z.null()]),
  countUnit: z.enum(['work_items', 'milestones', 'scope_conditions', 'estimate_points'])
}).strict().superRefine((reason, context) => {
  if (reason.key === 'unestimated_work' &&
    (reason.countUnit !== 'work_items' || reason.query?.estimateState !== 'unestimated' || reason.query.workState !== 'open')) {
    context.addIssue({ code: 'custom', message: 'Unestimated snapshot reasons require the exact open/unestimated work query.' });
  }
}) satisfies z.ZodType<SnapshotHealthReasonV2Dto>;
