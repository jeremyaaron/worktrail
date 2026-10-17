import type { ActorContext } from '../domain/actor.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/app-error.js';
import type { PersistenceScope } from '../repositories/persistence.js';
import type { WorkItem } from '../repositories/types.js';
import { coordinateProjects } from './project-write-coordination.js';

export async function prepareWorkCreation(scope: PersistenceScope, actor: ActorContext, projectId: string): Promise<void> {
  await coordinateProjects(scope, actor.workspaceId, [projectId], 'shared');
  await scope.locks.operation({ workspaceId: actor.workspaceId, resourceId: projectId, namespace: 'hierarchy' });
  await scope.locks.operation({ workspaceId: actor.workspaceId, resourceId: projectId, namespace: 'board' });
}

export interface WorkCommandLocks {
  hierarchy?: boolean;
  board?: boolean;
  cycleId?: string | null;
  parentWorkItemId?: string | null;
  completeColumn?: WorkItem['status'];
}

export async function lockWorkCommand(
  scope: PersistenceScope, actor: ActorContext, workItemId: string, options: WorkCommandLocks = {}
): Promise<WorkItem> {
  const requireItem = async () => {
    const item = await scope.repositories.workItems.findById(workItemId);
    if (item === null || item.workspaceId !== actor.workspaceId) throw new NotFoundError('Work item not found.');
    return item;
  };
  const located = await requireItem();
  await coordinateProjects(scope, actor.workspaceId, [located.projectId], 'shared');
  if (options.hierarchy) await scope.locks.operation({ workspaceId: actor.workspaceId, resourceId: located.projectId, namespace: 'hierarchy' });
  if (options.board) await scope.locks.operation({ workspaceId: actor.workspaceId, resourceId: located.projectId, namespace: 'board' });

  const discovered = await requireItem();
  if (discovered.projectId !== located.projectId) throw new ConflictError('Work item project changed. Retry the command.');
  if (options.cycleId !== undefined) {
    await scope.repositories.projectCycles.findManyByIdsForUpdate(
      [discovered.cycleId, options.cycleId].filter((id): id is string => id !== null)
    );
  }
  const ids = [located.id];
  if (options.hierarchy) {
    if (discovered.parentWorkItemId !== null) ids.push(discovered.parentWorkItemId);
    if (options.parentWorkItemId != null) {
      const parent = await scope.repositories.workItems.findById(options.parentWorkItemId);
      if (parent === null || parent.workspaceId !== actor.workspaceId) throw new NotFoundError('Parent work item not found.');
      if (parent.projectId !== located.projectId) throw new ValidationError('Parent work must belong to the same project.');
      ids.push(parent.id);
    }
  }
  // Compaction may update every target-column row. Lock the complete set before the moving row too.
  if (options.completeColumn !== undefined) {
    ids.push(...(await scope.repositories.workItems.listByProjectAndStatusForBoard(located.projectId, options.completeColumn)).map(({ id }) => id));
  }
  const rows = await scope.repositories.workItems.findManyByIdsForUpdate(ids);
  const current = rows.find(({ id }) => id === located.id);
  if (current === undefined || current.workspaceId !== actor.workspaceId) throw new NotFoundError('Work item not found.');
  if (current.projectId !== located.projectId ||
    (options.cycleId !== undefined && current.cycleId !== discovered.cycleId) ||
    (options.hierarchy && current.parentWorkItemId !== discovered.parentWorkItemId)) {
    throw new ConflictError('Work item references changed while waiting. Retry the command.');
  }
  return current;
}
