import type { WorkItemQuery } from '@worktrail/contracts';
import { z } from 'zod';

import {
  workItemPriorities,
  workItemStatuses,
  workItemTypes
} from '../domain/constants.js';
import { ValidationError } from '../errors/app-error.js';
import { parseWithSchema } from './parse.js';
import { emptyToUndefined, firstQueryValue } from './query-value.js';

const queryBooleanSchema = z
  .union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')])
  .optional();

const workItemQuerySchema = z.object({
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
  blocked: queryBooleanSchema,
  dependency: z.enum(['dependency_blocked', 'blocking_open_work']).optional(),
  workRisk: z.enum(['unassigned_active', 'stale_in_progress']).optional(),
  hierarchy: z.enum(['top_level', 'children', 'parents']).optional(),
  parentKey: z
    .string()
    .trim()
    .max(80)
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z0-9]{2,8}-[1-9]\d*$/.test(value), {
      message: 'Parent key must be a valid work item key.'
    })
    .optional(),
  archivedProjects: z.enum(['exclude', 'include', 'only']).default('exclude'),
  search: z.string().trim().max(120).optional(),
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
    .default('updated_desc')
}) satisfies z.ZodType<WorkItemQuery>;

export function parseWorkItemQuery(query: Record<string, string | string[] | undefined>): WorkItemQuery {
  return parseWorkspaceWorkItemQuery(query);
}

export function parseWorkspaceWorkItemQuery(
  query: Record<string, string | string[] | undefined>
): WorkItemQuery {
  const parsed = parseWithSchema(workItemQuerySchema, {
    projectId: emptyToUndefined(firstQueryValue(query.projectId)),
    status: emptyToUndefined(firstQueryValue(query.status)),
    workState: emptyToUndefined(firstQueryValue(query.workState)),
    assigneeId: emptyToUndefined(firstQueryValue(query.assigneeId)),
    assigneeState: emptyToUndefined(firstQueryValue(query.assigneeState)),
    reporterId: emptyToUndefined(firstQueryValue(query.reporterId)),
    type: emptyToUndefined(firstQueryValue(query.type)),
    priority: emptyToUndefined(firstQueryValue(query.priority)),
    labelId: emptyToUndefined(firstQueryValue(query.labelId)),
    milestoneId: emptyToUndefined(firstQueryValue(query.milestoneId)),
    cycleId: emptyToUndefined(firstQueryValue(query.cycleId)),
    dueDateState: emptyToUndefined(firstQueryValue(query.dueDateState)),
    blocked: emptyToUndefined(firstQueryValue(query.blocked)),
    dependency: emptyToUndefined(firstQueryValue(query.dependency)),
    workRisk: emptyToUndefined(firstQueryValue(query.workRisk)),
    hierarchy: emptyToUndefined(firstQueryValue(query.hierarchy)),
    parentKey: emptyToUndefined(firstQueryValue(query.parentKey)),
    archivedProjects: emptyToUndefined(firstQueryValue(query.archivedProjects)),
    search: emptyToUndefined(firstQueryValue(query.search)),
    sort: emptyToUndefined(firstQueryValue(query.sort))
  });

  validateWorkItemQuery(parsed);

  return stripUndefinedValues(parsed);
}

export function parseProjectWorkItemQuery(
  query: Record<string, string | string[] | undefined>
): WorkItemQuery {
  const parsed = parseWithSchema(workItemQuerySchema, {
    status: emptyToUndefined(firstQueryValue(query.status)),
    workState: emptyToUndefined(firstQueryValue(query.workState)),
    assigneeId: emptyToUndefined(firstQueryValue(query.assigneeId)),
    assigneeState: emptyToUndefined(firstQueryValue(query.assigneeState)),
    reporterId: emptyToUndefined(firstQueryValue(query.reporterId)),
    type: emptyToUndefined(firstQueryValue(query.type)),
    priority: emptyToUndefined(firstQueryValue(query.priority)),
    labelId: emptyToUndefined(firstQueryValue(query.labelId)),
    milestoneId: emptyToUndefined(firstQueryValue(query.milestoneId)),
    cycleId: emptyToUndefined(firstQueryValue(query.cycleId)),
    dueDateState: emptyToUndefined(firstQueryValue(query.dueDateState)),
    blocked: emptyToUndefined(firstQueryValue(query.blocked)),
    dependency: emptyToUndefined(firstQueryValue(query.dependency)),
    workRisk: emptyToUndefined(firstQueryValue(query.workRisk)),
    hierarchy: emptyToUndefined(firstQueryValue(query.hierarchy)),
    parentKey: emptyToUndefined(firstQueryValue(query.parentKey)),
    search: emptyToUndefined(firstQueryValue(query.search)),
    sort: emptyToUndefined(firstQueryValue(query.sort))
  });
  validateWorkItemQuery(parsed);

  const { archivedProjects, projectId, ...projectQuery } = parsed;
  void archivedProjects;
  void projectId;
  return stripUndefinedValues(projectQuery);
}

export function normalizeWorkItemQuery(input: WorkItemQuery): WorkItemQuery {
  const parsed = parseWithSchema(workItemQuerySchema, emptyStringsToUndefined(input));
  validateWorkItemQuery(parsed);
  return stripUndefinedValues(parsed);
}

function emptyStringsToUndefined(input: WorkItemQuery): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim() === '' ? undefined : value
    ])
  );
}

function stripUndefinedValues(query: WorkItemQuery): WorkItemQuery {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined)
  ) as WorkItemQuery;
}

function validateWorkItemQuery(query: WorkItemQuery): void {
  if (query.blocked === true && query.status !== undefined && query.status !== 'blocked') {
    throw new ValidationError('Blocked work item queries cannot specify another status.');
  }

  if (query.status !== undefined && query.workState !== undefined) {
    throw new ValidationError('Work item queries cannot specify both status and work state.');
  }

  if (query.assigneeId !== undefined && query.assigneeState === 'unassigned') {
    throw new ValidationError('Unassigned work item queries cannot specify an assignee.');
  }

  if (query.hierarchy !== undefined && query.parentKey !== undefined) {
    throw new ValidationError('Work item queries cannot specify both hierarchy and parent key.');
  }
}
