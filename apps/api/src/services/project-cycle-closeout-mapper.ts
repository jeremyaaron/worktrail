import type { ProjectCycleCloseoutDto } from '@worktrail/contracts';

import { ConflictError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { ProjectCycleCloseout } from '../repositories/types.js';
import {
  assertProjectCycleCloseoutSnapshotMatchesRecord,
  parseStoredProjectCycleCloseoutSnapshot
} from '../validation/project-cycle-closeout-snapshot.js';
import { toMemberDto } from './dto.js';

export async function toProjectCycleCloseoutDto(input: {
  closeout: ProjectCycleCloseout;
  repositories: Repositories;
  expected: {
    workspaceId: string;
    projectId: string;
    cycleId: string;
  };
}): Promise<ProjectCycleCloseoutDto> {
  const { closeout, expected, repositories } = input;

  if (
    closeout.workspaceId !== expected.workspaceId ||
    closeout.projectId !== expected.projectId ||
    closeout.cycleId !== expected.cycleId
  ) {
    throw new ConflictError('Stored cycle closeout is inconsistent with the source cycle.');
  }

  const snapshot = parseStoredProjectCycleCloseoutSnapshot(closeout.snapshot);
  assertProjectCycleCloseoutSnapshotMatchesRecord(snapshot, closeout);
  const closedBy = await repositories.members.findById(closeout.closedByMemberId);

  if (closedBy === null || closedBy.workspaceId !== closeout.workspaceId) {
    throw new ConflictError('Stored cycle closeout references a missing member.');
  }

  return {
    id: closeout.id,
    workspaceId: closeout.workspaceId,
    projectId: closeout.projectId,
    cycleId: closeout.cycleId,
    closedAt: closeout.closedAt.toISOString(),
    closedBy: toMemberDto(closedBy),
    destinationCycleId: closeout.destinationCycleId,
    snapshot
  };
}
