import type { ProjectCycleCloseoutSnapshotDto } from '@worktrail/contracts';
import { z } from 'zod';

import {
  workItemPriorities,
  workItemStatuses,
  workItemTypes
} from '../domain/constants.js';
import { ConflictError, ValidationError } from '../errors/app-error.js';

type SnapshotSource = 'request' | 'stored';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const terminalStatusSet = new Set(['done', 'canceled']);

const workItemQuerySchema = z
  .object({
    projectId: z.string().uuid().optional(),
    status: z.enum(workItemStatuses).optional(),
    workState: z.enum(['open', 'terminal']).optional(),
    assigneeId: z.string().uuid().optional(),
    assigneeState: z.enum(['assigned', 'unassigned']).optional(),
    reporterId: z.string().uuid().optional(),
    type: z.enum(workItemTypes).optional(),
    priority: z.enum(workItemPriorities).optional(),
    labelId: z.string().uuid().optional(),
    milestoneId: z.string().uuid().optional(),
    cycleId: z.string().uuid().optional(),
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
  })
  .strict();

const deliveryHealthReasonSchema = z
  .object({
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
  })
  .strict();

const closeoutItemSchema = z
  .object({
    id: z.string().uuid(),
    displayKey: z.string().min(1),
    title: z.string(),
    status: z.enum(workItemStatuses),
    priority: z.enum(workItemPriorities),
    assignee: z.union([
      z.object({ id: z.string().uuid(), name: z.string() }).strict(),
      z.null()
    ]),
    estimatePoints: z.union([z.number().int().nonnegative(), z.null()]),
    dependencyBlocked: z.boolean()
  })
  .strict();

const closeoutCountsSchema = z
  .object({
    totalCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    canceledCount: z.number().int().nonnegative(),
    unfinishedCount: z.number().int().nonnegative(),
    retainedCount: z.number().int().nonnegative(),
    movedCount: z.number().int().nonnegative(),
    committedEstimatePoints: z.number().int().nonnegative(),
    completedEstimatePoints: z.number().int().nonnegative(),
    unfinishedEstimatePoints: z.number().int().nonnegative(),
    unestimatedUnfinishedCount: z.number().int().nonnegative()
  })
  .strict();

const destinationCycleSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    startDate: z.string().regex(isoDatePattern),
    endDate: z.string().regex(isoDatePattern)
  })
  .strict();

const closeoutDestinationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cycle'), cycle: destinationCycleSchema }).strict(),
  z.object({ kind: z.literal('unplanned'), cycle: z.null() }).strict(),
  z.object({ kind: z.literal('none'), cycle: z.null() }).strict()
]);

const closeoutSnapshotShapeSchema = z
  .object({
    snapshotVersion: z.literal(1),
    project: z
      .object({
        id: z.string().uuid(),
        key: z.string(),
        name: z.string()
      })
      .strict(),
    cycle: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        goal: z.string(),
        status: z.literal('active'),
        startDate: z.string().regex(isoDatePattern),
        endDate: z.string().regex(isoDatePattern),
        targetPoints: z.union([z.number().int().positive(), z.null()])
      })
      .strict(),
    closedAt: z.string().datetime({ offset: true }),
    closedBy: z
      .object({
        id: z.string().uuid(),
        name: z.string()
      })
      .strict(),
    health: z
      .object({
        health: z.enum(['healthy', 'at_risk', 'blocked', 'complete', 'inactive']),
        reasons: z.array(deliveryHealthReasonSchema)
      })
      .strict(),
    counts: closeoutCountsSchema,
    destination: closeoutDestinationSchema,
    items: z
      .object({
        completed: z.array(closeoutItemSchema),
        canceled: z.array(closeoutItemSchema),
        unfinished: z.array(closeoutItemSchema)
      })
      .strict()
  })
  .strict();

export const projectCycleCloseoutSnapshotSchema = closeoutSnapshotShapeSchema.superRefine(
  (snapshot, context) => {
    const { counts, destination, items } = snapshot;
    const itemCount = items.completed.length + items.canceled.length + items.unfinished.length;

    addEqualityIssue(context, counts.totalCount, itemCount, ['counts', 'totalCount'], 'item total');
    addEqualityIssue(
      context,
      counts.completedCount,
      items.completed.length,
      ['counts', 'completedCount'],
      'completed item count'
    );
    addEqualityIssue(
      context,
      counts.canceledCount,
      items.canceled.length,
      ['counts', 'canceledCount'],
      'canceled item count'
    );
    addEqualityIssue(
      context,
      counts.unfinishedCount,
      items.unfinished.length,
      ['counts', 'unfinishedCount'],
      'unfinished item count'
    );
    addEqualityIssue(
      context,
      counts.retainedCount,
      counts.completedCount + counts.canceledCount,
      ['counts', 'retainedCount'],
      'completed plus canceled count'
    );
    addEqualityIssue(
      context,
      counts.movedCount,
      counts.unfinishedCount,
      ['counts', 'movedCount'],
      'unfinished item count'
    );

    for (const [index, item] of items.completed.entries()) {
      if (item.status !== 'done') {
        addCustomIssue(context, ['items', 'completed', index, 'status'], 'Completed items must have done status.');
      }
    }

    for (const [index, item] of items.canceled.entries()) {
      if (item.status !== 'canceled') {
        addCustomIssue(context, ['items', 'canceled', index, 'status'], 'Canceled items must have canceled status.');
      }
    }

    for (const [index, item] of items.unfinished.entries()) {
      if (terminalStatusSet.has(item.status)) {
        addCustomIssue(context, ['items', 'unfinished', index, 'status'], 'Unfinished items must have non-terminal status.');
      }
    }

    const allItems = [...items.completed, ...items.canceled, ...items.unfinished];
    addEqualityIssue(
      context,
      counts.committedEstimatePoints,
      sumEstimatePoints(allItems),
      ['counts', 'committedEstimatePoints'],
      'snapshotted estimate total'
    );
    addEqualityIssue(
      context,
      counts.completedEstimatePoints,
      sumEstimatePoints(items.completed),
      ['counts', 'completedEstimatePoints'],
      'completed estimate total'
    );
    addEqualityIssue(
      context,
      counts.unfinishedEstimatePoints,
      sumEstimatePoints(items.unfinished),
      ['counts', 'unfinishedEstimatePoints'],
      'unfinished estimate total'
    );
    addEqualityIssue(
      context,
      counts.unestimatedUnfinishedCount,
      items.unfinished.filter((item) => item.estimatePoints === null).length,
      ['counts', 'unestimatedUnfinishedCount'],
      'unestimated unfinished item count'
    );

    if (counts.unfinishedCount === 0 && destination.kind !== 'none') {
      addCustomIssue(context, ['destination', 'kind'], 'A closeout without unfinished work must use destination kind none.');
    }

    if (counts.unfinishedCount > 0 && destination.kind === 'none') {
      addCustomIssue(context, ['destination', 'kind'], 'A closeout with unfinished work must use cycle or unplanned destination.');
    }
  }
) satisfies z.ZodType<ProjectCycleCloseoutSnapshotDto>;

export function parseProjectCycleCloseoutSnapshot(
  value: unknown,
  source: SnapshotSource
): ProjectCycleCloseoutSnapshotDto {
  const result = projectCycleCloseoutSnapshotSchema.safeParse(value);

  if (!result.success) {
    const details = result.error.flatten();

    if (source === 'stored') {
      throw new ConflictError('Stored cycle closeout snapshot is invalid.', details);
    }

    throw new ValidationError('Cycle closeout snapshot is invalid.', details);
  }

  return result.data;
}

export function parseStoredProjectCycleCloseoutSnapshot(
  value: unknown
): ProjectCycleCloseoutSnapshotDto {
  return parseProjectCycleCloseoutSnapshot(value, 'stored');
}

export function parseRequestedProjectCycleCloseoutSnapshot(
  value: unknown
): ProjectCycleCloseoutSnapshotDto {
  return parseProjectCycleCloseoutSnapshot(value, 'request');
}

export function assertProjectCycleCloseoutSnapshotMatchesRecord(
  snapshot: ProjectCycleCloseoutSnapshotDto,
  record: {
    projectId: string;
    cycleId: string;
    destinationCycleId: string | null;
  }
): void {
  const destinationCycleId =
    snapshot.destination.kind === 'cycle' ? snapshot.destination.cycle.id : null;
  const mismatches: string[] = [];

  if (snapshot.project.id !== record.projectId) {
    mismatches.push('projectId');
  }

  if (snapshot.cycle.id !== record.cycleId) {
    mismatches.push('cycleId');
  }

  if (destinationCycleId !== record.destinationCycleId) {
    mismatches.push('destinationCycleId');
  }

  if (mismatches.length > 0) {
    throw new ConflictError('Stored cycle closeout snapshot is invalid.', {
      formErrors: [],
      fieldErrors: { record: [`Snapshot does not match: ${mismatches.join(', ')}.`] }
    });
  }
}

function addEqualityIssue(
  context: z.RefinementCtx,
  actual: number,
  expected: number,
  path: PropertyKey[],
  expectedLabel: string
): void {
  if (actual !== expected) {
    addCustomIssue(context, path, `Value must equal ${expectedLabel} (${expected}).`);
  }
}

function addCustomIssue(context: z.RefinementCtx, path: PropertyKey[], message: string): void {
  context.addIssue({
    code: 'custom',
    path,
    message
  });
}

function sumEstimatePoints(items: Array<{ estimatePoints: number | null }>): number {
  return items.reduce((total, item) => total + (item.estimatePoints ?? 0), 0);
}
