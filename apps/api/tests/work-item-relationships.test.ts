import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import type { ActorContext } from '../src/domain/actor.js';
import type { MemberRole, WorkItemStatus } from '../src/domain/constants.js';
import { AppError } from '../src/errors/app-error.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { WorkItemRelationshipService } from '../src/services/work-item-relationship-service.js';
import { WorkItemService } from '../src/services/work-item-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;

function now() {
  return new Date('2026-07-03T12:00:00.000Z');
}

function actor(input: { workspaceId: string; memberId: string; role: MemberRole }): ActorContext {
  return {
    workspaceId: input.workspaceId,
    memberId: input.memberId,
    role: input.role
  };
}

async function cleanupWorkspace(workspaceId: string) {
  await pool.query('delete from notifications where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comment_mentions where workspace_id = $1', [workspaceId]);
  await pool.query('delete from activity_events where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comments where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_item_watchers where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_item_relationships where workspace_id = $1', [workspaceId]);
  await pool.query(
    'delete from work_item_labels where work_item_id in (select id from work_items where workspace_id = $1)',
    [workspaceId]
  );
  await pool.query('delete from labels where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_items where workspace_id = $1', [workspaceId]);
  await pool.query('delete from milestones where workspace_id = $1', [workspaceId]);
  await pool.query('delete from projects where workspace_id = $1', [workspaceId]);
  await pool.query('delete from members where workspace_id = $1', [workspaceId]);
  await pool.query('delete from workspaces where id = $1', [workspaceId]);
}

async function cleanupAllWorkspaces() {
  for (const workspaceId of workspaceIds) {
    await cleanupWorkspace(workspaceId);
  }
  workspaceIds.clear();
}

async function createFixture(input: { role?: MemberRole } = {}) {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const ownerId = input.role === 'owner' ? actorId : randomUUID();
  const maintainerId = input.role === 'maintainer' ? actorId : randomUUID();
  const contributorId = input.role === 'contributor' ? actorId : randomUUID();
  const projectId = randomUUID();
  const secondProjectId = randomUUID();
  const archivedProjectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Relationship Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  for (const member of [
    { id: ownerId, role: 'owner' as const, name: 'Relationship Owner' },
    { id: maintainerId, role: 'maintainer' as const, name: 'Relationship Maintainer' },
    { id: contributorId, role: 'contributor' as const, name: 'Relationship Contributor' }
  ]) {
    await repositories.members.create({
      id: member.id,
      workspaceId,
      name: member.name,
      email: `${member.id}@example.com`,
      role: member.role,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'REL',
    nextWorkItemNumber: 10,
    name: 'Relationship Project',
    description: 'Relationship service test project.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.projects.create({
    id: secondProjectId,
    workspaceId,
    key: 'XREL',
    nextWorkItemNumber: 10,
    name: 'Cross Project',
    description: 'Cross-project relationship service test project.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.projects.create({
    id: archivedProjectId,
    workspaceId,
    key: 'OLDREL',
    nextWorkItemNumber: 10,
    name: 'Archived Relationship Project',
    description: 'Archived relationship service test project.',
    status: 'archived',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    ownerId,
    maintainerId,
    contributorId,
    projectId,
    secondProjectId,
    archivedProjectId,
    actor: actor({
      workspaceId,
      memberId: actorId,
      role: input.role ?? 'owner'
    })
  };
}

async function createWorkItem(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    itemNumber: number;
    projectId?: string;
    status?: WorkItemStatus;
    assigneeId?: string | null;
    title?: string;
  }
) {
  const timestamp = now();
  const projectId = input.projectId ?? fixture.projectId;

  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId,
    itemNumber: input.itemNumber,
    displayKey: `REL-${input.itemNumber}`,
    title: input.title ?? `Relationship work ${input.itemNumber}`,
    description: 'Created by relationship service tests.',
    type: 'task',
    status: input.status ?? 'ready',
    priority: 'medium',
    assigneeId: input.assigneeId === undefined ? fixture.contributorId : input.assigneeId,
    reporterId: fixture.ownerId,
    dueDate: null,
    estimatePoints: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function relationshipService(actorContext: ActorContext) {
  return new WorkItemRelationshipService({
    actor: actorContext,
    repositories,
    db,
    clock: now
  });
}

function workItemService(actorContext: ActorContext) {
  return new WorkItemService({
    actor: actorContext,
    repositories,
    db,
    clock: now
  });
}

async function expectAppError(
  promise: Promise<unknown>,
  input: { status: number; message: string }
) {
  await expect(promise).rejects.toMatchObject({
    status: input.status,
    message: input.message
  } satisfies Partial<AppError>);
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
});

afterEach(async () => {
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('work item relationship service', () => {
  it('creates blocking relationships, groups summaries, enriches list DTOs, and records activity', async () => {
    const fixture = await createFixture({ role: 'owner' });
    const source = await createWorkItem(fixture, { itemNumber: 1, status: 'in_progress' });
    const target = await createWorkItem(fixture, { itemNumber: 2, status: 'ready' });
    await repositories.workItemWatchers.watch({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      workItemId: source.id,
      memberId: fixture.maintainerId,
      watchedAt: now(),
      unwatchedAt: null,
      createdAt: now(),
      updatedAt: now()
    });

    const created = await relationshipService(fixture.actor).createRelationship(source.id, {
      relationshipType: 'blocks',
      targetWorkItemId: target.id
    });

    expect(created).toMatchObject({
      relationshipType: 'blocks',
      sourceWorkItemId: source.id,
      targetWorkItemId: target.id,
      sourceWorkItem: { id: source.id, displayKey: source.displayKey },
      targetWorkItem: { id: target.id, displayKey: target.displayKey },
      createdBy: { id: fixture.ownerId }
    });

    const sourceSummary = await relationshipService(fixture.actor).getRelationshipSummary(source.id);
    expect(sourceSummary).toMatchObject({
      dependencyBlocked: false,
      openBlockerCount: 0,
      openBlockedWorkCount: 1
    });
    expect(sourceSummary.blocks).toHaveLength(1);
    expect(sourceSummary.blocks[0]?.workItem.id).toBe(target.id);

    const targetDetail = await workItemService(fixture.actor).getWorkItem(target.id);
    expect(targetDetail.relationships.blockedBy).toHaveLength(1);
    expect(targetDetail.dependencyBlocked).toBe(true);
    expect(targetDetail.openBlockerCount).toBe(1);

    const list = await workItemService(fixture.actor).listWorkItems(fixture.projectId);
    expect(list.find((item) => item.id === source.id)).toMatchObject({
      openBlockedWorkCount: 1,
      dependencyBlocked: false
    });
    expect(list.find((item) => item.id === target.id)).toMatchObject({
      openBlockerCount: 1,
      dependencyBlocked: true
    });
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.maintainerId,
        state: 'all'
      })
    ).resolves.toEqual([
      expect.objectContaining({
        notificationType: 'watched_relationship_change',
        workItemId: source.id,
        metadata: expect.objectContaining({
          relationshipId: created.id,
          action: 'added'
        })
      })
    ]);
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.contributorId,
        state: 'all'
      })
    ).resolves.toEqual([
      expect.objectContaining({
        notificationType: 'dependency_blocker_added',
        workItemId: target.id,
        metadata: expect.objectContaining({
          relationshipId: created.id,
          sourceWorkItemId: source.id,
          targetWorkItemId: target.id
        })
      })
    ]);

    const activity = await repositories.activityEvents.findByWorkItem(source.id);
    expect(activity.at(-1)).toMatchObject({
      eventType: 'work_item.relationship_added',
      summary: `Marked this work as blocking ${target.displayKey}.`
    });
  });

  it('creates cross-project related links canonically and rejects reverse duplicates', async () => {
    const fixture = await createFixture({ role: 'owner' });
    const first = await createWorkItem(fixture, { itemNumber: 1 });
    const second = await createWorkItem(fixture, {
      itemNumber: 2,
      projectId: fixture.secondProjectId
    });

    const created = await relationshipService(fixture.actor).createRelationship(first.id, {
      relationshipType: 'relates_to',
      targetWorkItemId: second.id
    });
    const [expectedSourceId, expectedTargetId] = [first.id, second.id].sort();

    expect(created).toMatchObject({
      relationshipType: 'relates_to',
      sourceWorkItemId: expectedSourceId,
      targetWorkItemId: expectedTargetId
    });

    const summary = await relationshipService(fixture.actor).getRelationshipSummary(second.id);
    expect(summary.related).toHaveLength(1);
    expect(summary.related[0]?.workItem.id).toBe(first.id);
    expect(summary.related[0]?.workItem.project.id).toBe(first.projectId);

    await expectAppError(
      relationshipService(fixture.actor).createRelationship(second.id, {
        relationshipType: 'relates_to',
        targetWorkItemId: first.id
      }),
      {
        status: 409,
        message: 'That relationship already exists.'
      }
    );
  });

  it('rejects self relationships, duplicate blockers, cycles, and cross-workspace targets', async () => {
    const fixture = await createFixture({ role: 'owner' });
    const source = await createWorkItem(fixture, { itemNumber: 1 });
    const middle = await createWorkItem(fixture, { itemNumber: 2 });
    const target = await createWorkItem(fixture, { itemNumber: 3 });

    await expectAppError(
      relationshipService(fixture.actor).createRelationship(source.id, {
        relationshipType: 'blocks',
        targetWorkItemId: source.id
      }),
      {
        status: 400,
        message: 'Cannot relate a work item to itself.'
      }
    );

    await relationshipService(fixture.actor).createRelationship(source.id, {
      relationshipType: 'blocks',
      targetWorkItemId: middle.id
    });
    await relationshipService(fixture.actor).createRelationship(middle.id, {
      relationshipType: 'blocks',
      targetWorkItemId: target.id
    });

    await expectAppError(
      relationshipService(fixture.actor).createRelationship(source.id, {
        relationshipType: 'blocks',
        targetWorkItemId: middle.id
      }),
      {
        status: 409,
        message: 'That relationship already exists.'
      }
    );
    await expectAppError(
      relationshipService(fixture.actor).createRelationship(target.id, {
        relationshipType: 'blocks',
        targetWorkItemId: source.id
      }),
      {
        status: 400,
        message: 'This relationship would create a blocking cycle.'
      }
    );

    const otherWorkspace = await createFixture({ role: 'owner' });
    const otherWorkItem = await createWorkItem(otherWorkspace, { itemNumber: 1 });

    await expectAppError(
      relationshipService(fixture.actor).createRelationship(source.id, {
        relationshipType: 'blocks',
        targetWorkItemId: otherWorkItem.id
      }),
      {
        status: 404,
        message: 'Work item not found.'
      }
    );
  });

  it('rejects archived-project writes and contributor writes outside the current edit policy', async () => {
    const fixture = await createFixture({ role: 'owner' });
    const source = await createWorkItem(fixture, { itemNumber: 1 });
    const archivedTarget = await createWorkItem(fixture, {
      itemNumber: 2,
      projectId: fixture.archivedProjectId
    });

    await expectAppError(
      relationshipService(fixture.actor).createRelationship(source.id, {
        relationshipType: 'blocks',
        targetWorkItemId: archivedTarget.id
      }),
      {
        status: 409,
        message: 'Relationships cannot be changed for archived projects.'
      }
    );

    const contributorFixture = await createFixture({ role: 'contributor' });
    const assigned = await createWorkItem(contributorFixture, {
      itemNumber: 1,
      assigneeId: contributorFixture.actorId
    });
    const unassignedToActor = await createWorkItem(contributorFixture, {
      itemNumber: 2,
      assigneeId: contributorFixture.ownerId
    });
    const terminalAssigned = await createWorkItem(contributorFixture, {
      itemNumber: 3,
      status: 'done',
      assigneeId: contributorFixture.actorId
    });
    const target = await createWorkItem(contributorFixture, { itemNumber: 4 });

    await expect(
      relationshipService(contributorFixture.actor).createRelationship(assigned.id, {
        relationshipType: 'blocks',
        targetWorkItemId: target.id
      })
    ).resolves.toMatchObject({ sourceWorkItemId: assigned.id, targetWorkItemId: target.id });

    await expectAppError(
      relationshipService(contributorFixture.actor).createRelationship(unassignedToActor.id, {
        relationshipType: 'blocks',
        targetWorkItemId: target.id
      }),
      {
        status: 403,
        message: 'You do not have permission to update this work item.'
      }
    );
    await expectAppError(
      relationshipService(contributorFixture.actor).createRelationship(terminalAssigned.id, {
        relationshipType: 'blocks',
        targetWorkItemId: target.id
      }),
      {
        status: 403,
        message: 'You do not have permission to update this work item.'
      }
    );
  });

  it('deletes relationships with context-aware activity', async () => {
    const fixture = await createFixture({ role: 'owner' });
    const source = await createWorkItem(fixture, { itemNumber: 1, status: 'in_progress' });
    const target = await createWorkItem(fixture, { itemNumber: 2, status: 'ready' });
    const created = await relationshipService(fixture.actor).createRelationship(source.id, {
      relationshipType: 'blocks',
      targetWorkItemId: target.id
    });

    await relationshipService(fixture.actor).deleteRelationship(target.id, created.id);

    await expect(repositories.workItemRelationships.findById(created.id)).resolves.toBeNull();
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.contributorId,
        state: 'all'
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notificationType: 'dependency_blocker_added',
          workItemId: target.id
        }),
        expect.objectContaining({
          notificationType: 'dependency_blocker_removed',
          workItemId: target.id,
          metadata: expect.objectContaining({ action: 'removed' })
        })
      ])
    );
    const targetActivity = await repositories.activityEvents.findByWorkItem(target.id);
    expect(targetActivity.at(-1)).toMatchObject({
      eventType: 'work_item.relationship_removed',
      summary: `Removed blocker ${source.displayKey}.`
    });
  });
});
