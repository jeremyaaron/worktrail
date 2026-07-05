import type { WorktrailDb } from '../db/client.js';
import { createActivityEventRepository } from './activity-event-repository.js';
import { createCommentRepository } from './comment-repository.js';
import { createLabelRepository } from './label-repository.js';
import { createMemberRepository } from './member-repository.js';
import { createMilestoneRepository } from './milestone-repository.js';
import { createProjectRepository } from './project-repository.js';
import { createSavedWorkViewRepository } from './saved-work-view-repository.js';
import { createWorkItemRelationshipRepository } from './work-item-relationship-repository.js';
import { createWorkItemRepository } from './work-item-repository.js';
import { createWorkspaceActivityEventRepository } from './workspace-activity-event-repository.js';
import { createWorkspaceRepository } from './workspace-repository.js';

export function createRepositories(db: WorktrailDb) {
  return {
    workspaces: createWorkspaceRepository(db),
    members: createMemberRepository(db),
    projects: createProjectRepository(db),
    milestones: createMilestoneRepository(db),
    savedWorkViews: createSavedWorkViewRepository(db),
    workItems: createWorkItemRepository(db),
    workItemRelationships: createWorkItemRelationshipRepository(db),
    labels: createLabelRepository(db),
    comments: createCommentRepository(db),
    activityEvents: createActivityEventRepository(db),
    workspaceActivityEvents: createWorkspaceActivityEventRepository(db)
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export async function withRepositoriesTransaction<T>(
  db: WorktrailDb,
  callback: (repositories: Repositories) => Promise<T>
): Promise<T> {
  return db.transaction((tx) => callback(createRepositories(tx as unknown as WorktrailDb)));
}
