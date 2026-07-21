import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import type { ActorContext } from '../src/domain/actor.js';
import { attachmentPolicy } from '../src/domain/attachment-policy.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { AttachmentService } from '../src/services/attachment-service.js';
import { InMemoryAttachmentObjectStore } from '../src/storage/in-memory-attachment-object-store.js';

let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let workspaceId: string;

function now(): Date {
  return new Date('2026-07-21T13:00:00.000Z');
}

function storageKey(): string {
  return `${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`;
}

async function cleanup(): Promise<void> {
  if (workspaceId === undefined) {
    return;
  }

  await pool.query('delete from notifications where workspace_id = $1', [workspaceId]);
  await pool.query('delete from activity_events where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_item_attachments where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_items where workspace_id = $1', [workspaceId]);
  await pool.query('delete from projects where workspace_id = $1', [workspaceId]);
  await pool.query('delete from members where workspace_id = $1', [workspaceId]);
  await pool.query('delete from workspaces where id = $1', [workspaceId]);
}

beforeAll(async () => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
  workspaceId = randomUUID();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('attachment upload concurrency', () => {
  it('serializes quota checks so two uploads cannot consume one remaining slot', async () => {
    const projectId = randomUUID();
    const workItemId = randomUUID();
    const actor: ActorContext = {
      workspaceId,
      memberId: randomUUID(),
      role: 'owner'
    };
    await repositories.workspaces.create({
      id: workspaceId,
      name: 'Attachment Concurrency Workspace',
      createdAt: now(),
      updatedAt: now()
    });
    await repositories.members.create({
      id: actor.memberId,
      workspaceId,
      name: 'Concurrency Owner',
      email: `${actor.memberId}@example.com`,
      role: actor.role,
      isActive: true,
      createdAt: now(),
      updatedAt: now()
    });
    await repositories.projects.create({
      id: projectId,
      workspaceId,
      key: 'CON',
      nextWorkItemNumber: 2,
      name: 'Attachment Concurrency Project',
      description: '',
      status: 'active',
      createdAt: now(),
      updatedAt: now()
    });
    await repositories.workItems.create({
      id: workItemId,
      workspaceId,
      projectId,
      itemNumber: 1,
      displayKey: 'CON-1',
      title: 'Contended attachment capacity',
      description: '',
      type: 'task',
      status: 'ready',
      priority: 'medium',
      assigneeId: actor.memberId,
      reporterId: actor.memberId,
      dueDate: null,
      estimatePoints: null,
      createdAt: now(),
      updatedAt: now()
    });

    for (let index = 0; index < attachmentPolicy.maxAttachmentsPerWorkItem - 1; index += 1) {
      await repositories.workItemAttachments.create({
        id: randomUUID(),
        workspaceId,
        projectId,
        workItemId,
        uploaderMemberId: actor.memberId,
        fileName: `existing-${index}.txt`,
        mediaType: 'text/plain',
        byteSize: 1,
        checksumSha256: 'a'.repeat(64),
        storageKey: storageKey(),
        createdAt: now()
      });
    }

    const objectStore = new InMemoryAttachmentObjectStore();
    const keys = ['b'.repeat(64), 'c'.repeat(64)];
    const attachmentIds: string[] = [randomUUID(), randomUUID()];
    const createService = (index: number) => {
      const ids = [attachmentIds[index]!, randomUUID()];
      return new AttachmentService({
        repositories,
        db,
        objectStore,
        now,
        createId: () => ids.shift()!,
        createStorageKey: () => keys[index]!,
        logger: { warn: vi.fn(), error: vi.fn() }
      });
    };
    const bytes = new TextEncoder().encode('concurrent evidence');

    const outcomes = await Promise.allSettled([
      createService(0).upload(actor, workItemId, {
        fileName: 'first.txt',
        declaredMediaType: 'text/plain',
        bytes
      }),
      createService(1).upload(actor, workItemId, {
        fileName: 'second.txt',
        declaredMediaType: 'text/plain',
        bytes
      })
    ]);
    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: {
        code: 'ATTACHMENT_LIMIT_EXCEEDED',
        details: {
          limit: 'attachment_count',
          maximum: attachmentPolicy.maxAttachmentsPerWorkItem
        }
      }
    });
    await expect(repositories.workItemAttachments.getUsageByWorkItem(workItemId)).resolves.toEqual({
      attachmentCount: attachmentPolicy.maxAttachmentsPerWorkItem,
      aggregateBytes: attachmentPolicy.maxAttachmentsPerWorkItem - 1 + bytes.byteLength
    });
    const survivingRows = await repositories.workItemAttachments.listByWorkItem(workItemId);
    expect(
      survivingRows.filter((attachment) => attachmentIds.includes(attachment.id))
    ).toHaveLength(1);
    const storedObjects = await Promise.all(keys.map((key) => objectStore.get(key)));
    expect(storedObjects.filter((stored) => stored !== null)).toHaveLength(1);
    const activity = await repositories.activityEvents.findByWorkItem(workItemId);
    expect(
      activity.filter((event) => event.eventType === 'work_item.attachment_uploaded')
    ).toHaveLength(1);
    await expect(repositories.workItems.findById(workItemId)).resolves.toMatchObject({
      updatedAt: now()
    });
    const notifications = await pool.query<{ count: string }>(
      'select count(*)::text as count from notifications where workspace_id = $1',
      [workspaceId]
    );
    expect(notifications.rows[0]?.count).toBe('0');
  });
});
