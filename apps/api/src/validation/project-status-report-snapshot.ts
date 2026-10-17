import type { ProjectStatusReportSnapshotDto } from '@worktrail/contracts';
import { z } from 'zod';
import { ConflictError, ValidationError } from '../errors/app-error.js';
import {
  projectStatusReportSnapshotV1Schema, deliveryHealthSchema, milestoneSnapshotSchema,
  riskSnapshotSchema, statusReportLinkSchema, cycleSnapshotSchema
} from './project-status-report-snapshot-v1.js';
import { snapshotHealthReasonV2Schema, snapshotWorkItemQueryV2Schema } from './snapshot-query-v2.js';

export { projectStatusReportSnapshotV1Schema } from './project-status-report-snapshot-v1.js';

export const projectStatusReportSnapshotV2Schema = projectStatusReportSnapshotV1Schema.extend({
  snapshotVersion: z.literal(2),
  health: deliveryHealthSchema.extend({ reasons: z.array(snapshotHealthReasonV2Schema) }),
  milestones: z.array(milestoneSnapshotSchema.extend({ reasons: z.array(snapshotHealthReasonV2Schema) })),
  risks: z.array(riskSnapshotSchema.extend({ query: snapshotWorkItemQueryV2Schema, countUnit: z.literal('work_items') })),
  cycle: z.union([cycleSnapshotSchema.extend({
    reasons: z.array(snapshotHealthReasonV2Schema),
    links: z.array(statusReportLinkSchema.extend({ query: snapshotWorkItemQueryV2Schema.optional() }))
  }), z.null()]).optional()
});

export const projectStatusReportSnapshotSchema = z.discriminatedUnion('snapshotVersion', [
  projectStatusReportSnapshotV1Schema, projectStatusReportSnapshotV2Schema
]) satisfies z.ZodType<ProjectStatusReportSnapshotDto>;

export function parseProjectStatusReportSnapshot(value: unknown, source: 'request' | 'stored'): ProjectStatusReportSnapshotDto {
  const result = projectStatusReportSnapshotSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.flatten();
    if (source === 'stored') throw new ConflictError('Stored status report snapshot is invalid.', details);
    throw new ValidationError('Status report snapshot is invalid.', details);
  }
  return result.data;
}

export function parseStoredProjectStatusReportSnapshot(value: unknown): ProjectStatusReportSnapshotDto {
  return parseProjectStatusReportSnapshot(value, 'stored');
}
export function parseRequestedProjectStatusReportSnapshot(value: unknown): ProjectStatusReportSnapshotDto {
  return parseProjectStatusReportSnapshot(value, 'request');
}
export function assertProjectStatusReportSnapshotMatchesRecord(snapshot: ProjectStatusReportSnapshotDto, record: { projectId: string }): void {
  if (snapshot.project.id !== record.projectId) throw new ConflictError('Stored status report snapshot is invalid.', {
    formErrors: [], fieldErrors: { record: ['Snapshot does not match: projectId.'] }
  });
}
