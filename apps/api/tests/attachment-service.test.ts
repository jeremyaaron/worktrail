import { createHash, randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import type { ActorContext } from '../src/domain/actor.js';
import { attachmentPolicy } from '../src/domain/attachment-policy.js';
import {
  AttachmentStorageUnavailableError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError
} from '../src/errors/app-error.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import type { AttachmentOperationalLogger } from '../src/services/attachment-operational-logger.js';
import {
  AttachmentService,
  type AttachmentUploadInput
} from '../src/services/attachment-service.js';
import type { AttachmentObjectStore } from '../src/storage/attachment-object-store.js';
import { InMemoryAttachmentObjectStore } from '../src/storage/in-memory-attachment-object-store.js';

const workspaceIds = new Set<string>();
const uploadBytes = new TextEncoder().encode('# Upload evidence\n');
const uploadInput: AttachmentUploadInput = {
  fileName: 'evidence.md',
  declaredMediaType: 'text/plain',
  bytes: uploadBytes
};
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;

function now(): Date {
  return new Date('2026-07-21T12:00:00.000Z');
}

function storageKey(): string {
  return `${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`;
}

async function cleanupWorkspace(workspaceId: string): Promise<void> {
  await pool.query('delete from notifications where workspace_id = $1', [workspaceId]);
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

async function createFixture() {
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const workItemId = randomUUID();
  const members = {
    owner: { id: randomUUID(), role: 'owner' as const },
    maintainer: { id: randomUUID(), role: 'maintainer' as const },
    contributor: { id: randomUUID(), role: 'contributor' as const },
    otherContributor: { id: randomUUID(), role: 'contributor' as const },
    inactive: { id: randomUUID(), role: 'contributor' as const }
  };
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Attachment Service Workspace',
    createdAt: now(),
    updatedAt: now()
  });

  for (const [name, member] of Object.entries(members)) {
    await repositories.members.create({
      id: member.id,
      workspaceId,
      name,
      email: `${member.id}@example.com`,
      role: member.role,
      isActive: name !== 'inactive',
      deactivatedAt: name === 'inactive' ? now() : null,
      deactivatedById: name === 'inactive' ? members.owner.id : null,
      createdAt: now(),
      updatedAt: now()
    });
  }

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'ATT',
    nextWorkItemNumber: 2,
    name: 'Attachment Service Project',
    description: 'Attachment service integration fixture.',
    status: 'active',
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.workItems.create({
    id: workItemId,
    workspaceId,
    projectId,
    itemNumber: 1,
    displayKey: 'ATT-1',
    title: 'Attachment service work item',
    description: '',
    type: 'task',
    status: 'ready',
    priority: 'medium',
    assigneeId: members.contributor.id,
    reporterId: members.owner.id,
    dueDate: null,
    estimatePoints: null,
    createdAt: now(),
    updatedAt: now()
  });

  const actor = (member: keyof typeof members): ActorContext => ({
    memberId: members[member].id,
    workspaceId,
    role: members[member].role
  });

  return { workspaceId, projectId, workItemId, members, actor };
}

async function createAttachmentMetadata(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    id?: string;
    uploaderMemberId?: string;
    fileName?: string;
    byteSize?: number;
    createdAt?: Date;
    key?: string;
  } = {}
) {
  return repositories.workItemAttachments.create({
    id: input.id ?? randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    workItemId: fixture.workItemId,
    uploaderMemberId: input.uploaderMemberId ?? fixture.members.contributor.id,
    fileName: input.fileName ?? 'existing.txt',
    mediaType: 'text/plain',
    byteSize: input.byteSize ?? 1,
    checksumSha256: 'a'.repeat(64),
    storageKey: input.key ?? storageKey(),
    createdAt: input.createdAt ?? now()
  });
}

function createService(
  input: {
    objectStore?: AttachmentObjectStore;
    ids?: string[];
    key?: string;
    logger?: AttachmentOperationalLogger;
  } = {}
) {
  const objectStore = input.objectStore ?? new InMemoryAttachmentObjectStore();
  const ids = [...(input.ids ?? [])];
  const logger = input.logger ?? {
    warn: vi.fn(),
    error: vi.fn()
  };
  const service = new AttachmentService({
    repositories,
    db,
    objectStore,
    now,
    ...(ids.length === 0 ? {} : { createId: () => ids.shift()! }),
    ...(input.key === undefined ? {} : { createStorageKey: () => input.key! }),
    logger
  });

  return { service, objectStore, logger };
}

beforeAll(async () => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
  await cleanupAllWorkspaces();
});

afterEach(cleanupAllWorkspaces);

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('AttachmentService', () => {
  it('lists metadata newest-first with batched uploaders, exact usage, and role capabilities', async () => {
    const fixture = await createFixture();
    const older = await createAttachmentMetadata(fixture, {
      uploaderMemberId: fixture.members.contributor.id,
      fileName: 'duplicate.txt',
      byteSize: 10,
      createdAt: new Date('2026-07-21T10:00:00.000Z')
    });
    const newer = await createAttachmentMetadata(fixture, {
      uploaderMemberId: fixture.members.otherContributor.id,
      fileName: 'duplicate.txt',
      byteSize: 20,
      createdAt: new Date('2026-07-21T11:00:00.000Z')
    });
    const { service, objectStore } = createService();
    const getSpy = vi.spyOn(objectStore, 'get');
    const uploaderSpy = vi.spyOn(repositories.members, 'listByIds');

    const result = await service.listForWorkItem(fixture.actor('contributor'), fixture.workItemId);

    expect(result.items.map((item) => item.id)).toEqual([newer!.id, older!.id]);
    expect(result.items.map((item) => item.fileName)).toEqual(['duplicate.txt', 'duplicate.txt']);
    expect(result.items.map((item) => item.permissions.canRemove)).toEqual([false, true]);
    expect(result.usage).toEqual({
      attachmentCount: 2,
      aggregateBytes: 30,
      remainingAttachmentSlots: attachmentPolicy.maxAttachmentsPerWorkItem - 2,
      remainingBytes: attachmentPolicy.maxAggregateBytesPerWorkItem - 30
    });
    expect(result.permissions).toEqual({ canUpload: true });
    expect(result.policy.maxFileBytes).toBe(attachmentPolicy.maxFileBytes);
    expect(uploaderSpy).toHaveBeenCalledOnce();
    expect(uploaderSpy).toHaveBeenCalledWith(
      expect.arrayContaining([fixture.members.contributor.id, fixture.members.otherContributor.id])
    );
    expect(getSpy).not.toHaveBeenCalled();
    expect(result.items[0]).not.toHaveProperty('storageKey');
    expect(result.items[0]).not.toHaveProperty('checksumSha256');
    expect(result.items[0]).not.toHaveProperty('workspaceId');
    expect(result.items[0]).not.toHaveProperty('projectId');

    const ownerView = await service.listForWorkItem(fixture.actor('owner'), fixture.workItemId);
    const maintainerView = await service.listForWorkItem(
      fixture.actor('maintainer'),
      fixture.workItemId
    );
    expect(ownerView.items.every((item) => item.permissions.canRemove)).toBe(true);
    expect(maintainerView.items.every((item) => item.permissions.canRemove)).toBe(true);

    await repositories.projects.updateStatus(fixture.projectId, 'archived', now());
    const archived = await service.listForWorkItem(fixture.actor('owner'), fixture.workItemId);
    expect(archived.permissions.canUpload).toBe(false);
    expect(archived.items.every((item) => !item.permissions.canRemove)).toBe(true);
  });

  it('uploads immutable bytes and commits safe metadata and one activity without touching work or notifications', async () => {
    const fixture = await createFixture();
    const attachmentId = randomUUID();
    const activityId = randomUUID();
    const key = storageKey();
    const { service, objectStore } = createService({
      ids: [attachmentId, activityId],
      key
    });
    const inputBytes = Uint8Array.from(uploadBytes);

    const result = await service.upload(fixture.actor('contributor'), fixture.workItemId, {
      ...uploadInput,
      fileName: ' folder\\evidence.md. ',
      bytes: inputBytes
    });
    inputBytes[0] = 0;

    expect(result).toMatchObject({
      id: attachmentId,
      workItemId: fixture.workItemId,
      fileName: 'folder_evidence.md',
      mediaType: 'text/markdown',
      byteSize: uploadBytes.byteLength,
      uploader: { id: fixture.members.contributor.id },
      permissions: { canRemove: true },
      createdAt: now().toISOString()
    });
    await expect(objectStore.get(key)).resolves.toEqual(uploadBytes);

    const metadata = await repositories.workItemAttachments.findById(attachmentId);
    expect(metadata).toMatchObject({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: fixture.workItemId,
      uploaderMemberId: fixture.members.contributor.id,
      checksumSha256: createHash('sha256').update(uploadBytes).digest('hex'),
      storageKey: key
    });
    const activity = (await repositories.activityEvents.findByWorkItem(fixture.workItemId)).filter(
      (event) => event.eventType === 'work_item.attachment_uploaded'
    );
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      id: activityId,
      actorId: fixture.members.contributor.id,
      summary: 'Uploaded attachment "folder_evidence.md".',
      previousValue: null,
      newValue: {
        attachment: {
          id: attachmentId,
          fileName: 'folder_evidence.md',
          mediaType: 'text/markdown',
          byteSize: uploadBytes.byteLength
        }
      },
      metadata: { attachmentId }
    });
    expect(JSON.stringify(activity[0])).not.toContain(key);
    expect(JSON.stringify(activity[0])).not.toContain(metadata!.checksumSha256);
    await expect(repositories.workItems.findById(fixture.workItemId)).resolves.toMatchObject({
      updatedAt: now()
    });
    const notificationCount = await pool.query<{ count: string }>(
      'select count(*)::text as count from notifications where workspace_id = $1',
      [fixture.workspaceId]
    );
    expect(notificationCount.rows[0]?.count).toBe('0');
  });

  it('accepts duplicate display names as independent attachments', async () => {
    const fixture = await createFixture();
    const { service } = createService();

    const first = await service.upload(fixture.actor('owner'), fixture.workItemId, uploadInput);
    const second = await service.upload(
      fixture.actor('maintainer'),
      fixture.workItemId,
      uploadInput
    );

    expect(first.id).not.toBe(second.id);
    const listed = await service.listForWorkItem(fixture.actor('owner'), fixture.workItemId);
    expect(listed.items).toHaveLength(2);
    expect(listed.items.every((item) => item.fileName === 'evidence.md')).toBe(true);
  });

  it('rejects invalid files before object storage', async () => {
    const fixture = await createFixture();
    const { service, objectStore } = createService();
    const putSpy = vi.spyOn(objectStore, 'put');

    await expect(
      service.upload(fixture.actor('owner'), fixture.workItemId, {
        fileName: 'evidence.json',
        declaredMediaType: 'application/json',
        bytes: new TextEncoder().encode('not json')
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('conceals cross-workspace work and rejects inactive or archived mutations before storage', async () => {
    const fixture = await createFixture();
    const other = await createFixture();
    const { service, objectStore } = createService();
    const putSpy = vi.spyOn(objectStore, 'put');

    await expect(
      service.upload(other.actor('owner'), fixture.workItemId, uploadInput)
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      service.upload(fixture.actor('owner'), randomUUID(), uploadInput)
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      service.upload(fixture.actor('inactive'), fixture.workItemId, uploadInput)
    ).rejects.toBeInstanceOf(ForbiddenError);
    await repositories.projects.updateStatus(fixture.projectId, 'archived', now());
    await expect(
      service.upload(fixture.actor('owner'), fixture.workItemId, uploadInput)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('maps object write failures to a safe storage error without metadata', async () => {
    const fixture = await createFixture();
    const objectStore = new InMemoryAttachmentObjectStore();
    const logger: AttachmentOperationalLogger = {
      warn: vi.fn(),
      error: vi.fn(() => {
        throw new Error('logger unavailable');
      })
    };
    objectStore.failNext('put');
    const { service } = createService({ objectStore, logger });

    await expect(
      service.upload(fixture.actor('owner'), fixture.workItemId, uploadInput)
    ).rejects.toBeInstanceOf(AttachmentStorageUnavailableError);
    await expect(
      repositories.workItemAttachments.getUsageByWorkItem(fixture.workItemId)
    ).resolves.toEqual({ attachmentCount: 0, aggregateBytes: 0 });
    expect(logger.error).toHaveBeenCalledWith({
      operation: 'upload_write',
      attachmentId: expect.any(String),
      outcome: 'failed',
      errorName: 'AttachmentObjectStoreError'
    });
  });

  it('rolls back metadata and removes the object when activity persistence fails', async () => {
    const fixture = await createFixture();
    const existingActivityId = randomUUID();
    await repositories.activityEvents.create({
      id: existingActivityId,
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: fixture.workItemId,
      actorId: fixture.members.owner.id,
      eventType: 'work_item.created',
      summary: 'Existing activity.',
      previousValue: null,
      newValue: null,
      metadata: {},
      createdAt: now()
    });
    const attachmentId = randomUUID();
    const key = storageKey();
    const { service, objectStore } = createService({
      ids: [attachmentId, existingActivityId],
      key
    });

    await expect(
      service.upload(fixture.actor('owner'), fixture.workItemId, uploadInput)
    ).rejects.toBeDefined();
    await expect(repositories.workItemAttachments.findById(attachmentId)).resolves.toBeNull();
    await expect(objectStore.get(key)).resolves.toBeNull();
    const activities = await repositories.activityEvents.findByWorkItem(fixture.workItemId);
    expect(
      activities.filter((event) => event.eventType === 'work_item.attachment_uploaded')
    ).toEqual([]);
  });

  it('preserves the transaction error and emits safe evidence when compensation fails', async () => {
    const fixture = await createFixture();
    const duplicateAttachmentId = randomUUID();
    await createAttachmentMetadata(fixture, { id: duplicateAttachmentId });
    const objectStore = new InMemoryAttachmentObjectStore();
    objectStore.failNext('remove');
    const key = storageKey();
    const logger: AttachmentOperationalLogger = { warn: vi.fn(), error: vi.fn() };
    const { service } = createService({
      objectStore,
      ids: [duplicateAttachmentId, randomUUID()],
      key,
      logger
    });

    await expect(
      service.upload(fixture.actor('owner'), fixture.workItemId, uploadInput)
    ).rejects.not.toBeInstanceOf(AttachmentStorageUnavailableError);
    await expect(objectStore.get(key)).resolves.toEqual(uploadBytes);
    expect(logger.error).toHaveBeenCalledWith({
      operation: 'upload_compensation',
      attachmentId: duplicateAttachmentId,
      outcome: 'failed',
      errorName: 'AttachmentObjectStoreError'
    });
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(key);
  });

  it('rechecks archived state after object write and compensates an archive race', async () => {
    const fixture = await createFixture();
    const delegate = new InMemoryAttachmentObjectStore();
    const key = storageKey();
    const objectStore: AttachmentObjectStore = {
      initialize: () => delegate.initialize(),
      async put(objectKey, bytes) {
        await delegate.put(objectKey, bytes);
        await repositories.projects.updateStatus(fixture.projectId, 'archived', now());
      },
      get: (objectKey) => delegate.get(objectKey),
      remove: (objectKey) => delegate.remove(objectKey)
    };
    const { service } = createService({ objectStore, key });

    await expect(
      service.upload(fixture.actor('owner'), fixture.workItemId, uploadInput)
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(delegate.get(key)).resolves.toBeNull();
    await expect(
      repositories.workItemAttachments.getUsageByWorkItem(fixture.workItemId)
    ).resolves.toEqual({ attachmentCount: 0, aggregateBytes: 0 });
  });

  it('enforces exact count and aggregate limits and compensates rejected bytes', async () => {
    const countFixture = await createFixture();
    for (let index = 0; index < attachmentPolicy.maxAttachmentsPerWorkItem; index += 1) {
      await createAttachmentMetadata(countFixture);
    }
    const countKey = storageKey();
    const countContext = createService({ key: countKey });

    await expect(
      countContext.service.upload(countFixture.actor('owner'), countFixture.workItemId, uploadInput)
    ).rejects.toMatchObject({
      code: 'ATTACHMENT_LIMIT_EXCEEDED',
      details: {
        limit: 'attachment_count',
        maximum: attachmentPolicy.maxAttachmentsPerWorkItem
      }
    });
    await expect(countContext.objectStore.get(countKey)).resolves.toBeNull();

    const aggregateFixture = await createFixture();
    for (let index = 0; index < 12; index += 1) {
      await createAttachmentMetadata(aggregateFixture, {
        byteSize: attachmentPolicy.maxFileBytes
      });
    }
    await createAttachmentMetadata(aggregateFixture, {
      byteSize: 2 * 1024 * 1024
    });
    const aggregateKey = storageKey();
    const aggregateContext = createService({ key: aggregateKey });

    await expect(
      aggregateContext.service.upload(
        aggregateFixture.actor('owner'),
        aggregateFixture.workItemId,
        uploadInput
      )
    ).rejects.toMatchObject({
      code: 'ATTACHMENT_LIMIT_EXCEEDED',
      details: {
        limit: 'aggregate_bytes',
        maximum: attachmentPolicy.maxAggregateBytesPerWorkItem
      }
    });
    await expect(aggregateContext.objectStore.get(aggregateKey)).resolves.toBeNull();
  });

  it('allows an upload that lands exactly on the aggregate byte limit', async () => {
    const fixture = await createFixture();
    const existingBytes = attachmentPolicy.maxAggregateBytesPerWorkItem - uploadBytes.byteLength;
    const fullFiles = Math.floor(existingBytes / attachmentPolicy.maxFileBytes);
    const remainder = existingBytes % attachmentPolicy.maxFileBytes;

    for (let index = 0; index < fullFiles; index += 1) {
      await createAttachmentMetadata(fixture, { byteSize: attachmentPolicy.maxFileBytes });
    }
    await createAttachmentMetadata(fixture, { byteSize: remainder });
    const { service } = createService();

    await expect(
      service.upload(fixture.actor('owner'), fixture.workItemId, uploadInput)
    ).resolves.toMatchObject({ byteSize: uploadBytes.byteLength });
    await expect(
      repositories.workItemAttachments.getUsageByWorkItem(fixture.workItemId)
    ).resolves.toEqual({
      attachmentCount: fullFiles + 2,
      aggregateBytes: attachmentPolicy.maxAggregateBytesPerWorkItem
    });
  });
});
