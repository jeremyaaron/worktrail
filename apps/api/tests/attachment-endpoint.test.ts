import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { attachmentPolicy } from '../src/domain/attachment-policy.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { InMemoryAttachmentObjectStore } from '../src/storage/in-memory-attachment-object-store.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;

function now(): Date {
  return new Date('2026-07-21T15:00:00.000Z');
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
  const uploaderId = randomUUID();
  const otherContributorId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Attachment Endpoint Workspace',
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.members.create({
    id: uploaderId,
    workspaceId,
    name: 'Casey Contributor',
    email: `${uploaderId}@example.com`,
    role: 'contributor',
    isActive: true,
    deactivatedAt: null,
    deactivatedById: null,
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.members.create({
    id: otherContributorId,
    workspaceId,
    name: 'Taylor Contributor',
    email: `${otherContributorId}@example.com`,
    role: 'contributor',
    isActive: true,
    deactivatedAt: null,
    deactivatedById: null,
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'HTTP',
    nextWorkItemNumber: 2,
    name: 'Attachment Endpoint Project',
    description: 'HTTP attachment lifecycle fixture.',
    status: 'active',
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.workItems.create({
    id: workItemId,
    workspaceId,
    projectId,
    itemNumber: 1,
    displayKey: 'HTTP-1',
    title: 'Exercise attachment endpoints',
    description: '',
    type: 'task',
    status: 'ready',
    priority: 'medium',
    assigneeId: uploaderId,
    reporterId: uploaderId,
    dueDate: null,
    estimatePoints: null,
    createdAt: now(),
    updatedAt: now()
  });

  const objectStore = new InMemoryAttachmentObjectStore();
  const app = createExpressApp({
    repositories,
    db,
    attachmentObjectStore: objectStore
  });
  const headers = (memberId: string) => ({
    'x-worktrail-member-id': memberId,
    'x-worktrail-workspace-id': workspaceId
  });

  return {
    workspaceId,
    projectId,
    workItemId,
    uploaderId,
    otherContributorId,
    objectStore,
    app,
    headers
  };
}

async function uploadText(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: { fileName?: string; bytes?: Uint8Array } = {}
) {
  return request(fixture.app)
    .post(`/api/work-items/${fixture.workItemId}/attachments`)
    .set(fixture.headers(fixture.uploaderId))
    .set('Content-Type', 'application/octet-stream')
    .set('X-Worktrail-Filename', encodeURIComponent(input.fileName ?? 'evidence.txt'))
    .set('X-Worktrail-Media-Type', 'text/plain')
    .send(Buffer.from(input.bytes ?? new TextEncoder().encode('endpoint evidence')));
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

describe('attachment HTTP endpoints', () => {
  it('uploads, lists, downloads, and removes one attachment without exposing internal fields', async () => {
    const fixture = await createFixture();
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const fileName = 'Résumé "Q3".png';
    const upload = await request(fixture.app)
      .post(`/api/work-items/${fixture.workItemId}/attachments`)
      .set(fixture.headers(fixture.uploaderId))
      .set('Content-Type', 'application/octet-stream')
      .set('X-Worktrail-Filename', encodeURIComponent(fileName))
      .set('X-Worktrail-Media-Type', 'image/png')
      .send(Buffer.from(bytes))
      .expect(201);

    expect(upload.body).toMatchObject({
      workItemId: fixture.workItemId,
      fileName,
      mediaType: 'image/png',
      byteSize: bytes.byteLength,
      uploader: { id: fixture.uploaderId },
      permissions: { canRemove: true }
    });
    expect(upload.body).not.toHaveProperty('workspaceId');
    expect(upload.body).not.toHaveProperty('projectId');
    expect(JSON.stringify(upload.body)).not.toMatch(/storageKey|checksumSha256/);

    const listed = await request(fixture.app)
      .get(`/api/work-items/${fixture.workItemId}/attachments`)
      .set(fixture.headers(fixture.uploaderId))
      .expect(200);
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0]).toEqual(upload.body);
    expect(listed.body.usage).toMatchObject({
      attachmentCount: 1,
      aggregateBytes: bytes.byteLength
    });
    expect(listed.body.policy.maxFileBytes).toBe(attachmentPolicy.maxFileBytes);
    expect(listed.body.items[0]).not.toHaveProperty('workspaceId');
    expect(listed.body.items[0]).not.toHaveProperty('projectId');
    expect(JSON.stringify(listed.body)).not.toMatch(/storageKey|checksumSha256/);

    const downloaded = await request(fixture.app)
      .get(`/api/attachments/${upload.body.id}/content`)
      .set(fixture.headers(fixture.uploaderId))
      .expect(200)
      .expect('Content-Type', 'image/png')
      .expect('Content-Length', String(bytes.byteLength))
      .expect('Cache-Control', 'private, no-store')
      .expect('X-Content-Type-Options', 'nosniff');
    expect(downloaded.headers['content-disposition']).toBe(
      `attachment; filename="Resume _Q3_.png"; filename*=UTF-8''R%C3%A9sum%C3%A9%20%22Q3%22.png`
    );
    expect(downloaded.body).toEqual(Buffer.from(bytes));

    const removed = await request(fixture.app)
      .delete(`/api/attachments/${upload.body.id}`)
      .set(fixture.headers(fixture.uploaderId))
      .expect(204);
    expect(removed.text).toBe('');
    expect(removed.headers['content-type']).toBeUndefined();
    expect(removed.headers['content-length']).toBeUndefined();

    const emptyList = await request(fixture.app)
      .get(`/api/work-items/${fixture.workItemId}/attachments`)
      .set(fixture.headers(fixture.uploaderId))
      .expect(200);
    expect(emptyList.body.items).toEqual([]);
  });

  it('accepts an exact 4 MiB raw upload', async () => {
    const fixture = await createFixture();
    const bytes = new Uint8Array(attachmentPolicy.maxFileBytes).fill('a'.charCodeAt(0));

    const response = await uploadText(fixture, { fileName: 'boundary.txt', bytes });

    expect(response.status).toBe(201);
    expect(response.body.byteSize).toBe(attachmentPolicy.maxFileBytes);
  });

  it('returns structured 413 before storage for an oversized raw upload', async () => {
    const fixture = await createFixture();
    const putSpy = vi.spyOn(fixture.objectStore, 'put');
    const bytes = Buffer.alloc(attachmentPolicy.maxFileBytes + 1, 'a');

    const response = await request(fixture.app)
      .post(`/api/work-items/${fixture.workItemId}/attachments`)
      .set(fixture.headers(fixture.uploaderId))
      .set('Content-Type', 'application/octet-stream')
      .set('X-Worktrail-Filename', 'oversized.txt')
      .set('X-Worktrail-Media-Type', 'text/plain')
      .send(bytes)
      .expect(413);

    expect(response.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body exceeds the 4 MiB limit.',
        details: { limitBytes: attachmentPolicy.maxFileBytes }
      }
    });
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for transport metadata failures', async () => {
    const fixture = await createFixture();
    const route = `/api/work-items/${fixture.workItemId}/attachments`;

    const wrongType = await request(fixture.app)
      .post(route)
      .set(fixture.headers(fixture.uploaderId))
      .set('Content-Type', 'application/json')
      .send({ value: 'not raw bytes' })
      .expect(400);
    expect(wrongType.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { field: 'content-type', reason: 'invalid_content_type' }
    });

    const missingFileName = await request(fixture.app)
      .post(route)
      .set(fixture.headers(fixture.uploaderId))
      .set('Content-Type', 'application/octet-stream')
      .set('X-Worktrail-Media-Type', 'text/plain')
      .send(Buffer.from('missing filename'))
      .expect(400);
    expect(missingFileName.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { field: 'x-worktrail-filename', reason: 'required' }
    });

    const malformedFileName = await request(fixture.app)
      .post(route)
      .set(fixture.headers(fixture.uploaderId))
      .set('Content-Type', 'application/octet-stream')
      .set('X-Worktrail-Filename', '%E0%A4%A')
      .set('X-Worktrail-Media-Type', 'text/plain')
      .send(Buffer.from('malformed filename'))
      .expect(400);
    expect(malformedFileName.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { field: 'x-worktrail-filename', reason: 'malformed_encoding' }
    });
  });

  it('preserves authorization and archived-project behavior through HTTP', async () => {
    const fixture = await createFixture();
    const uploaded = await uploadText(fixture);
    expect(uploaded.status).toBe(201);

    const forbidden = await request(fixture.app)
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set(fixture.headers(fixture.otherContributorId))
      .expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(forbidden.body)).not.toMatch(/storageKey|checksumSha256|\.worktrail/);

    await repositories.projects.updateStatus(fixture.projectId, 'archived', now());

    await request(fixture.app)
      .get(`/api/attachments/${uploaded.body.id}/content`)
      .set(fixture.headers(fixture.otherContributorId))
      .expect(200);

    const conflict = await request(fixture.app)
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set(fixture.headers(fixture.uploaderId))
      .expect(409);
    expect(conflict.body.error.code).toBe('CONFLICT');
  });

  it('maps authorized object read failures to a safe structured response', async () => {
    const fixture = await createFixture();
    const uploaded = await uploadText(fixture);
    expect(uploaded.status).toBe(201);
    fixture.objectStore.failNext('get');

    const response = await request(fixture.app)
      .get(`/api/attachments/${uploaded.body.id}/content`)
      .set(fixture.headers(fixture.uploaderId))
      .expect(503);

    expect(response.body).toEqual({
      error: {
        code: 'ATTACHMENT_STORAGE_UNAVAILABLE',
        message: 'Attachment storage is temporarily unavailable.'
      }
    });
    expect(JSON.stringify(response.body)).not.toMatch(/storageKey|checksumSha256|\.worktrail/);
  });
});
