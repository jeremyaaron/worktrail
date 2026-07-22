import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  deterministicSeedAttachments,
  seedDeterministicAttachments,
  type AttachmentSeedReferences,
  type DeterministicSeedAttachment
} from '../src/db/attachment-seed.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { AttachmentService } from '../src/services/attachment-service.js';
import { InMemoryAttachmentObjectStore } from '../src/storage/in-memory-attachment-object-store.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;

function now(): Date {
  return new Date('2026-07-22T12:00:00.000Z');
}

async function cleanupWorkspace(workspaceId: string): Promise<void> {
  await pool.query('delete from activity_events where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_item_attachments where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_items where workspace_id = $1', [workspaceId]);
  await pool.query('delete from projects where workspace_id = $1', [workspaceId]);
  await pool.query('delete from members where workspace_id = $1', [workspaceId]);
  await pool.query('delete from workspaces where id = $1', [workspaceId]);
}

async function cleanupAllWorkspaces(): Promise<void> {
  for (const workspaceId of workspaceIds) {
    await cleanupWorkspace(workspaceId);
  }
  workspaceIds.clear();
}

async function createFixture(): Promise<{
  references: AttachmentSeedReferences;
  attachments: readonly DeterministicSeedAttachment[];
}> {
  const references = {
    workspaceId: randomUUID(),
    projectId: randomUUID(),
    workItemId: randomUUID(),
    ownerMemberId: randomUUID(),
    maintainerMemberId: randomUUID()
  };
  workspaceIds.add(references.workspaceId);

  await repositories.workspaces.create({
    id: references.workspaceId,
    name: 'Attachment Seed Workspace',
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.members.create({
    id: references.ownerMemberId,
    workspaceId: references.workspaceId,
    name: 'Avery Owner',
    email: `${references.ownerMemberId}@example.com`,
    role: 'owner',
    isActive: true,
    deactivatedAt: null,
    deactivatedById: null,
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.members.create({
    id: references.maintainerMemberId,
    workspaceId: references.workspaceId,
    name: 'Morgan Maintainer',
    email: `${references.maintainerMemberId}@example.com`,
    role: 'maintainer',
    isActive: true,
    deactivatedAt: null,
    deactivatedById: null,
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.projects.create({
    id: references.projectId,
    workspaceId: references.workspaceId,
    key: 'SEED',
    nextWorkItemNumber: 2,
    name: 'Attachment Seed Project',
    description: 'Deterministic attachment seed fixture.',
    status: 'active',
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.workItems.create({
    id: references.workItemId,
    workspaceId: references.workspaceId,
    projectId: references.projectId,
    itemNumber: 1,
    displayKey: 'SEED-1',
    title: 'Verify attachment seeding',
    description: '',
    type: 'task',
    status: 'in_progress',
    priority: 'medium',
    assigneeId: references.maintainerMemberId,
    reporterId: references.ownerMemberId,
    dueDate: null,
    estimatePoints: null,
    createdAt: now(),
    updatedAt: now()
  });

  return {
    references,
    attachments: deterministicSeedAttachments.map((attachment) => ({
      ...attachment,
      id: randomUUID(),
      activityEventId: randomUUID(),
      storageKey: randomBytes(32).toString('hex')
    }))
  };
}

beforeAll(async () => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
});

afterEach(cleanupAllWorkspaces);

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('seedDeterministicAttachments', () => {
  it('is rerunnable, repairs differing objects, and serves exact bytes', async () => {
    const fixture = await createFixture();
    const objectStore = new InMemoryAttachmentObjectStore();
    const input = { db, objectStore, ...fixture };

    await seedDeterministicAttachments(input);
    await seedDeterministicAttachments(input);

    const corrupted = fixture.attachments[0]!;
    await objectStore.remove(corrupted.storageKey);
    await objectStore.put(corrupted.storageKey, Uint8Array.from([9, 9, 9]));
    await seedDeterministicAttachments(input);

    const metadata = await repositories.workItemAttachments.listByWorkItem(
      fixture.references.workItemId
    );
    const activity = await repositories.activityEvents.findByWorkItem(fixture.references.workItemId);
    expect(metadata).toHaveLength(2);
    expect(activity.filter((event) => event.eventType === 'work_item.attachment_uploaded')).toHaveLength(
      2
    );

    const service = new AttachmentService({ repositories, db, objectStore });
    const actor = {
      memberId: fixture.references.ownerMemberId,
      workspaceId: fixture.references.workspaceId,
      role: 'owner' as const
    };

    for (const attachment of fixture.attachments) {
      await expect(objectStore.get(attachment.storageKey)).resolves.toEqual(attachment.bytes);
      const download = await service.download(actor, attachment.id);
      expect(download).toMatchObject({
        fileName: attachment.fileName,
        mediaType: attachment.mediaType,
        byteSize: attachment.byteSize
      });
      expect(download.bytes).toEqual(attachment.bytes);
    }
  });

  it('does not insert metadata when object initialization fails', async () => {
    const fixture = await createFixture();
    const objectStore = new InMemoryAttachmentObjectStore();
    objectStore.failNext('put');

    await expect(
      seedDeterministicAttachments({ db, objectStore, ...fixture })
    ).rejects.toMatchObject({ operation: 'put' });
    await expect(
      repositories.workItemAttachments.listByWorkItem(fixture.references.workItemId)
    ).resolves.toEqual([]);
    await expect(
      repositories.activityEvents.findByWorkItem(fixture.references.workItemId)
    ).resolves.toEqual([]);
  });
});
