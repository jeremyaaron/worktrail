import type {
  CloseProjectCycleRequest,
  CreateProjectCycleRequest,
  ProjectCycleStatus,
  UpdateProjectCycleRequest
} from '@worktrail/contracts';
import { z } from 'zod';

import {
  creatableProjectCycleStatuses,
  mutableProjectCycleStatuses,
  projectCycleStatuses
} from '../domain/constants.js';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createProjectCycleSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    goal: z.string().trim().max(2000).optional(),
    status: z.enum(creatableProjectCycleStatuses).optional(),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    targetPoints: z.number().int().positive().max(999).nullable().optional()
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: 'Cycle start date must be on or before end date.',
    path: ['endDate']
  }) satisfies z.ZodType<CreateProjectCycleRequest>;

export const updateProjectCycleSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    goal: z.string().trim().max(2000).optional(),
    status: z.enum(mutableProjectCycleStatuses).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    targetPoints: z.number().int().positive().max(999).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one cycle field must be provided.'
  }) satisfies z.ZodType<UpdateProjectCycleRequest>;

export const projectCycleListQuerySchema = z.object({
  includeArchived: z.boolean().optional(),
  status: z.enum(projectCycleStatuses).optional()
});

export interface ProjectCycleListQuery {
  includeArchived?: boolean;
  status?: ProjectCycleStatus;
}

export const closeProjectCycleSchema = z
  .object({
    destinationCycleId: z.string().uuid().nullable()
  })
  .strict() satisfies z.ZodType<CloseProjectCycleRequest>;
