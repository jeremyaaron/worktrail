import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let app: ReturnType<typeof createExpressApp>;

function now() {
  return new Date('2026-07-03T12:00:00.000Z');
}

function actorHeaders(input: { workspaceId: string; memberId: string; role: string }) {
  return {
    'x-worktrail-workspace-id': input.workspaceId,
    'x-worktrail-member-id': input.memberId,
    'x-worktrail-role': input.role
  };
}

async function cleanupWorkspace(workspaceId: string) {
  await pool.query('delete from activity_events where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comments where workspace_id = $1', [workspaceId]);
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

async function createFixture(role: 'owner' | 'maintainer' | 'contributor' = 'owner') {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const contributorId = randomUUID();
  const projectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Comments Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  for (const member of [
    { id: actorId, role, name: 'Comment Actor' },
    { id: contributorId, role: 'contributor' as const, name: 'Comment Contributor' }
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
    key: 'CA',
    nextWorkItemNumber: 2,
    name: 'Comments Test Project',
    description: 'Project for comment and activity endpoint tests.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    contributorId,
    projectId,
    headers: actorHeaders({ workspaceId, memberId: actorId, role }),
    contributorHeaders: actorHeaders({
      workspaceId,
      memberId: contributorId,
      role: 'contributor'
    })
  };
}

async function createWorkItem(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    itemNumber: 1,
    displayKey: 'CA-1',
    title: 'Commented work item',
    description: 'Work item with collaboration history.',
    type: 'task',
    status: 'ready',
    priority: 'medium',
    assigneeId: fixture.contributorId,
    reporterId: fixture.actorId,
    dueDate: null,
    estimatePoints: null,
    createdAt: now(),
    updatedAt: now()
  });
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
  app = createExpressApp({ repositories, db });
});

afterEach(async () => {
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('comments and activity API', () => {
  it('adds comments with author details and records comment activity', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    const response = await request(app)
      .post(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .send({ body: '  This should be recorded.  ' })
      .expect(201);

    expect(response.body).toMatchObject({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      author: { id: fixture.actorId, name: 'Comment Actor' },
      body: 'This should be recorded.'
    });
    expect(response.body.createdAt).toEqual(expect.any(String));

    const comments = await repositories.comments.findByWorkItem(workItem.id);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toBe('This should be recorded.');

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      eventType: 'comment.added',
      actorId: fixture.actorId,
      metadata: { commentId: response.body.id }
    });
  });

  it('lists comments in creation order', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: 'First comment',
      createdAt: new Date('2026-07-03T12:01:00.000Z'),
      updatedAt: new Date('2026-07-03T12:01:00.000Z')
    });
    await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.contributorId,
      body: 'Second comment',
      createdAt: new Date('2026-07-03T12:02:00.000Z'),
      updatedAt: new Date('2026-07-03T12:02:00.000Z')
    });

    await request(app)
      .get(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((comment: { body: string }) => comment.body)).toEqual([
          'First comment',
          'Second comment'
        ]);
        expect(body[1]).toMatchObject({
          author: { id: fixture.contributorId, name: 'Comment Contributor' }
        });
      });
  });

  it('updates comments for owners and authors and records edit activity without body text', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.contributorId,
      body: 'Original body',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .send({ body: 'Owner edited body.' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: comment.id,
          body: 'Owner edited body.',
          isEdited: true,
          isDeleted: false,
          editedAt: expect.any(String),
          deletedAt: null,
          deletedBy: null
        });
      });

    const authorComment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.contributorId,
      body: 'Contributor body',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/comments/${authorComment.id}`)
      .set(fixture.contributorHeaders)
      .send({ body: 'Contributor edited own body.' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.body).toBe('Contributor edited own body.');
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    const editedEvents = activity.filter((event) => event.eventType === 'comment.edited');
    expect(editedEvents).toHaveLength(2);
    expect(editedEvents[0]).toMatchObject({
      previousValue: null,
      newValue: null,
      metadata: { commentId: expect.any(String) }
    });
    expect(JSON.stringify(editedEvents)).not.toContain('Owner edited body.');
    expect(JSON.stringify(editedEvents)).not.toContain('Original body');
  });

  it('rejects contributor edits to other members comments', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: 'Owner-authored comment',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/comments/${comment.id}`)
      .set(fixture.contributorHeaders)
      .send({ body: 'Unauthorized edit.' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('FORBIDDEN');
      });
  });

  it('soft-deletes comments as tombstones and rejects repeated lifecycle writes', async () => {
    const fixture = await createFixture('maintainer');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.contributorId,
      body: 'Sensitive body that should be hidden',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: comment.id,
          body: '',
          isDeleted: true,
          isEdited: false,
          deletedAt: expect.any(String),
          deletedBy: { id: fixture.actorId }
        });
      });

    await request(app)
      .get(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: comment.id,
            body: '',
            isDeleted: true,
            deletedBy: expect.objectContaining({ id: fixture.actorId })
          })
        ]);
      });

    await request(app)
      .patch(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .send({ body: 'Should not edit deleted comment.' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    const deletedEvent = activity.find((event) => event.eventType === 'comment.deleted');
    expect(deletedEvent).toMatchObject({
      previousValue: null,
      newValue: null,
      metadata: { commentId: comment.id }
    });
    expect(JSON.stringify(deletedEvent)).not.toContain('Sensitive body');
  });

  it('returns comments and activity on work item detail', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: 'Detail page comment',
      createdAt: now(),
      updatedAt: now()
    });
    await repositories.activityEvents.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      actorId: fixture.actorId,
      eventType: 'comment.added',
      summary: 'Comment added.',
      previousValue: null,
      newValue: null,
      metadata: { commentId: comment.id },
      createdAt: now()
    });

    await request(app)
      .get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.comments).toEqual([
          expect.objectContaining({
            id: comment.id,
            body: 'Detail page comment',
            author: expect.objectContaining({ id: fixture.actorId })
          })
        ]);
        expect(body.activity).toEqual([
          expect.objectContaining({
            eventType: 'comment.added',
            actor: expect.objectContaining({ id: fixture.actorId }),
            metadata: { commentId: comment.id }
          })
        ]);
      });
  });

  it('returns work item and project activity timelines', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const eventId = randomUUID();

    await repositories.activityEvents.create({
      id: eventId,
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      actorId: fixture.actorId,
      eventType: 'work_item.created',
      summary: 'Work item created.',
      previousValue: null,
      newValue: { status: 'ready' },
      metadata: {},
      createdAt: now()
    });

    for (const path of [
      `/api/work-items/${workItem.id}/activity`,
      `/api/projects/${fixture.projectId}/activity`
    ]) {
      await request(app)
        .get(path)
        .set(fixture.headers)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual([
            expect.objectContaining({
              id: eventId,
              eventType: 'work_item.created',
              actor: expect.objectContaining({ id: fixture.actorId }),
              newValue: { status: 'ready' }
            })
          ]);
        });
    }
  });

  it('rejects empty comments and scopes comment reads to the actor workspace', async () => {
    const fixture = await createFixture('owner');
    const otherFixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    await request(app)
      .post(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .send({ body: '   ' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

    await request(app).get(`/api/work-items/${workItem.id}/comments`).set(otherFixture.headers).expect(404);
    await request(app).get(`/api/work-items/${workItem.id}/activity`).set(otherFixture.headers).expect(404);
  });

  it('rejects comment writes under archived projects', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: 'Archived project comment',
      createdAt: now(),
      updatedAt: now()
    });

    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .send({ body: 'Should not be added.' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    await request(app)
      .patch(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .send({ body: 'Should not be edited.' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });
  });
});
