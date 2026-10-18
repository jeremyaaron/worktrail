import type { ProjectCycleCloseoutSnapshotDto } from '@worktrail/contracts';
import { z } from 'zod';
import { ConflictError, ValidationError } from '../errors/app-error.js';
import {
  projectCycleCloseoutSnapshotV1Schema, closeoutSnapshotShapeSchema, refineProjectCycleCloseoutSnapshotV1
} from './project-cycle-closeout-snapshot-v1.js';
import { snapshotHealthReasonV2Schema } from './snapshot-query-v2.js';

export { projectCycleCloseoutSnapshotV1Schema, assertProjectCycleCloseoutSnapshotMatchesRecord } from './project-cycle-closeout-snapshot-v1.js';

export const projectCycleCloseoutSnapshotV2Schema = closeoutSnapshotShapeSchema.extend({
  snapshotVersion: z.literal(2),
  health: closeoutSnapshotShapeSchema.shape.health.extend({ reasons: z.array(snapshotHealthReasonV2Schema) })
}).superRefine(refineProjectCycleCloseoutSnapshotV1);

export const projectCycleCloseoutSnapshotSchema = z.discriminatedUnion('snapshotVersion', [
  projectCycleCloseoutSnapshotV1Schema, projectCycleCloseoutSnapshotV2Schema
]) satisfies z.ZodType<ProjectCycleCloseoutSnapshotDto>;

export function parseProjectCycleCloseoutSnapshot(value: unknown, source: 'request' | 'stored'): ProjectCycleCloseoutSnapshotDto {
  const result = projectCycleCloseoutSnapshotSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.flatten();
    if (source === 'stored') throw new ConflictError('Stored cycle closeout snapshot is invalid.', details);
    throw new ValidationError('Cycle closeout snapshot is invalid.', details);
  }
  return result.data;
}
export function parseStoredProjectCycleCloseoutSnapshot(value: unknown): ProjectCycleCloseoutSnapshotDto {
  return parseProjectCycleCloseoutSnapshot(value, 'stored');
}
export function parseRequestedProjectCycleCloseoutSnapshot(value: unknown): ProjectCycleCloseoutSnapshotDto {
  return parseProjectCycleCloseoutSnapshot(value, 'request');
}
