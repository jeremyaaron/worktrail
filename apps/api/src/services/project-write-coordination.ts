import { NotFoundError } from '../errors/app-error.js';
import type { ProjectLockMode } from '../repositories/locks.js';
import type { PersistenceScope } from '../repositories/persistence.js';
import type { WorkItem } from '../repositories/types.js';

export async function coordinateProjects(
  scope: PersistenceScope, workspaceId: string, projectIds: readonly string[], mode: ProjectLockMode
): Promise<void> {
  if (projectIds.length === 0) return;
  await scope.locks.projects(projectIds.map((projectId) => ({ workspaceId, projectId, mode })));
}

// These reads discover immutable project IDs only. Command bodies reread authoritative state after the gate.
export async function coordinateWorkItems(
  scope: PersistenceScope, workspaceId: string, workItemIds: readonly string[]
): Promise<WorkItem[]> {
  const located = new Map<string, WorkItem>();
  for (const id of new Set(workItemIds)) {
    const item = await scope.repositories.workItems.findById(id);
    if (item === null || item.workspaceId !== workspaceId) throw new NotFoundError('Work item not found.');
    located.set(item.id, item);
  }
  const items = [...located.values()];
  await coordinateProjects(scope, workspaceId, items.map(({ projectId }) => projectId), 'shared');
  return items;
}

export async function coordinateComment(scope: PersistenceScope, workspaceId: string, commentId: string): Promise<void> {
  const comment = await scope.repositories.comments.findById(commentId);
  if (comment === null || comment.workspaceId !== workspaceId) throw new NotFoundError('Comment not found.');
  await coordinateWorkItems(scope, workspaceId, [comment.workItemId]);
}

export async function coordinateReference(
  scope: PersistenceScope, workspaceId: string, owner: 'labels' | 'milestones' | 'savedWorkViews',
  id: string, mode: ProjectLockMode
): Promise<void> {
  const reference = await scope.repositories[owner].findById(id);
  const name = { labels: 'Label', milestones: 'Milestone', savedWorkViews: 'Saved view' }[owner];
  if (reference === null || reference.workspaceId !== workspaceId) throw new NotFoundError(`${name} not found.`);
  if (reference.projectId !== null) await coordinateProjects(scope, workspaceId, [reference.projectId], mode);
}

export async function coordinateRelationship(
  scope: PersistenceScope, workspaceId: string, workItemId: string, relationshipId: string
): Promise<WorkItem[]> {
  const relationship = await scope.repositories.workItemRelationships.findById(relationshipId);
  if (relationship === null || relationship.workspaceId !== workspaceId ||
    (relationship.sourceWorkItemId !== workItemId && relationship.targetWorkItemId !== workItemId)) {
    throw new NotFoundError('Relationship not found.');
  }
  return coordinateWorkItems(scope, workspaceId, [relationship.sourceWorkItemId, relationship.targetWorkItemId]);
}
