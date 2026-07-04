import type { WorkItemQuery } from '@worktrail/contracts';
import { z } from 'zod';

import {
  workItemPriorities,
  workItemStatuses,
  workItemTypes
} from '../domain/constants.js';
import { ValidationError } from '../errors/app-error.js';
import { parseWithSchema } from './parse.js';

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
  dueDateState: z.enum(['overdue', 'due_soon', 'none']).optional(),
  blocked: queryBooleanSchema,
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

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

export function parseWorkItemQuery(query: Record<string, string | string[] | undefined>): WorkItemQuery {
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
    dueDateState: emptyToUndefined(firstQueryValue(query.dueDateState)),
    blocked: emptyToUndefined(firstQueryValue(query.blocked)),
    archivedProjects: emptyToUndefined(firstQueryValue(query.archivedProjects)),
    search: emptyToUndefined(firstQueryValue(query.search)),
    sort: emptyToUndefined(firstQueryValue(query.sort))
  });

  validateWorkItemQuery(parsed);

  return parsed;
}

export function normalizeWorkItemQuery(input: WorkItemQuery): WorkItemQuery {
  const parsed = parseWithSchema(workItemQuerySchema, {
    ...input,
    search: input.search?.trim() === '' ? undefined : input.search?.trim()
  });
  validateWorkItemQuery(parsed);
  return parsed;
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
}
