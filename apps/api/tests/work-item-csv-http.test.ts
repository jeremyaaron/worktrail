import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';

import { stringify } from 'csv-stringify/sync';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonBodyLimits } from '../src/adapters/express/body-parsing.js';
import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { createRepositories } from '../src/repositories/index.js';
import { createPersistence } from '../src/repositories/persistence.js';
import request from './support/local-http.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';

let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
const workspaces = new Set<string>();
const rawCsvLimit = 1_048_576;
const columns = ['title', 'type', 'priority', 'description'];

beforeAll(() => { pool = createPool(); db = createDb(pool); });
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(async () => {
  for (const id of workspaces) await cleanupWorkspace(pool, id);
  workspaces.clear();
  vi.restoreAllMocks();
});
afterAll(async () => pool.end());

async function fixture() {
  const workspaceId = randomUUID();
  const memberId = randomUUID();
  const projectId = randomUUID();
  workspaces.add(workspaceId);
  const timestamps = { createdAt: new Date(), updatedAt: new Date() };
  await db.insert(schema.workspaces).values({ id: workspaceId, name: 'Import HTTP boundary', ...timestamps });
  await db.insert(schema.members).values({ id: memberId, workspaceId, name: 'Import Owner',
    email: 'import@example.test', role: 'owner', isActive: true, ...timestamps });
  await db.insert(schema.projects).values({ id: projectId, workspaceId, name: 'Import HTTP', key: 'CSV', status: 'active', ...timestamps });
  const repositories = createRepositories(db);
  return {
    workspaceId, projectId, repositories,
    app: createExpressApp({ repositories, persistence: createPersistence(db) }),
    headers: { 'x-worktrail-member-id': memberId, 'x-worktrail-workspace-id': workspaceId },
    path: `/api/projects/${projectId}/work-items/imports`
  };
}

async function expectNoWrites(f: Awaited<ReturnType<typeof fixture>>) {
  for (const table of ['work_items', 'activity_events', 'notifications', 'work_item_watchers']) {
    const result = await pool.query(`select count(*)::int as count from ${table} where workspace_id = $1`, [f.workspaceId]);
    expect(result.rows[0].count).toBe(0);
  }
  expect((await pool.query('select next_work_item_number from projects where id = $1', [f.projectId])).rows[0].next_work_item_number).toBe(1);
}

function csvWithBytes(bytes: number, count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({ title: `Imported ${i + 1}`, type: 'task', priority: 'medium',
    description: 'Quote " slash \\\nUnicode \u00e9 \ud83d\ude80 '.repeat(40) }));
  let remaining = bytes - Buffer.byteLength(stringify(rows, { header: true, columns }), 'utf8');
  expect(remaining).toBeGreaterThanOrEqual(0);
  // ASCII padding changes the CSV byte size one-for-one, without exceeding the source field limit.
  for (const row of rows) {
    const padding = Math.min(remaining, 10_000 - row.description.length);
    row.description += 'a'.repeat(padding);
    remaining -= padding;
  }
  expect(remaining).toBe(0);
  const csv = stringify(rows, { header: true, columns });
  expect(Buffer.byteLength(csv, 'utf8')).toBe(bytes);
  return { csv, rows };
}

function escapedEnvelope(csv: string): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < csv.length; offset += 8192) {
    const chunk = csv.slice(offset, offset + 8192);
    chunks.push(Array.from({ length: chunk.length }, (_, index) => `\\u${chunk.charCodeAt(index).toString(16).padStart(4, '0')}`).join(''));
  }
  return `{"csv":"${chunks.join('')}"}`;
}

describe('registered CSV import HTTP routes', () => {
  it('previews and applies valid CSV above 100 KiB, preserving authored source and keys', async () => {
    const f = await fixture();
    const { csv, rows } = csvWithBytes(150_000, 20);
    const preview = await request(f.app).post(`${f.path}/preview`).set(f.headers).send({ csv }).expect(200);
    expect(preview.body).toMatchObject({ totalRows: 20, validRows: 20, errors: [] });
    await expectNoWrites(f);
    const applied = await request(f.app).post(f.path).set(f.headers).type('json').send(escapedEnvelope(csv)).expect(201);
    expect(applied.body.createdCount).toBe(20);
    expect(applied.body.workItems.map((item: { displayKey: string }) => item.displayKey))
      .toEqual(rows.map((_, index) => `CSV-${index + 1}`));
    const stored = await pool.query('select title, description from work_items where project_id = $1 order by item_number', [f.projectId]);
    expect(stored.rows).toEqual(rows.map(({ title, description }) => ({ title, description })));
  });

  it('accepts exactly 1 MiB of valid raw CSV with every JSON code unit escaped', async () => {
    const f = await fixture();
    const { csv } = csvWithBytes(rawCsvLimit, 150);
    const envelope = escapedEnvelope(csv);
    expect(Buffer.byteLength(envelope)).toBeGreaterThan(5 * rawCsvLimit);
    expect(Buffer.byteLength(envelope)).toBeLessThanOrEqual(jsonBodyLimits.csvImport);
    const preview = await request(f.app).post(`${f.path}/preview`).set(f.headers).type('json').send(envelope).expect(200);
    expect(preview.body).toMatchObject({ totalRows: 150, validRows: 150, errors: [] });
    await expectNoWrites(f);
  });

  it('accepts the exact import transport envelope limit, independently of the raw CSV limit', async () => {
    const f = await fixture();
    const envelope = JSON.stringify({ csv: 'title,type,priority\nExact,task,medium\n' });
    const body = envelope + ' '.repeat(jsonBodyLimits.csvImport - Buffer.byteLength(envelope));
    const preview = await request(f.app).post(`${f.path}/preview`).set(f.headers).type('json').send(body).expect(200);
    expect(preview.body).toMatchObject({ validRows: 1, errors: [] });
    await expectNoWrites(f);
  });

  it.each(['', '/preview'])('rejects oversized transport on imports%s before actor/domain work', async (suffix) => {
    const f = await fixture();
    const actorLookup = vi.spyOn(f.repositories.members, 'findById');
    const envelope = JSON.stringify({ csv: 'private-csv' });
    const body = envelope + ' '.repeat(jsonBodyLimits.csvImport + 1 - Buffer.byteLength(envelope));
    const rejected = await request(f.app).post(`${f.path}${suffix}?secret=private-query`).set(f.headers).type('json').send(body).expect(413);
    expect(rejected.body.error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', details: { limitBytes: 6_295_552 } });
    expect(actorLookup).not.toHaveBeenCalled();
    const logs = vi.mocked(console.log).mock.calls;
    expect(logs).toEqual([[expect.stringMatching(/^POST \[body_too_large\] 413 \d+ms$/)]]);
    expect(JSON.stringify([rejected.body, logs])).not.toMatch(/private-csv|private-query/);
    expect(console.error).not.toHaveBeenCalled();
    await expectNoWrites(f);
  });

  it.each(['', '/preview'])('rejects malformed JSON on imports%s without reflecting source or writing', async (suffix) => {
    const f = await fixture();
    const actorLookup = vi.spyOn(f.repositories.members, 'findById');
    const rejected = await request(f.app).post(`${f.path}${suffix}`).set(f.headers).type('json')
      .send('{"csv":"private-csv",').expect(400);
    expect(rejected.body.error).toMatchObject({ code: 'VALIDATION_ERROR', details: { reason: 'invalid_json' } });
    expect(actorLookup).not.toHaveBeenCalled();
    expect(JSON.stringify([rejected.body, vi.mocked(console.log).mock.calls])).not.toContain('private-csv');
    expect(console.error).not.toHaveBeenCalled();
    await expectNoWrites(f);
  });

  it.each(['', '/preview'])('counts raw CSV in UTF-8 bytes on imports%s, not JS characters', async (suffix) => {
    const f = await fixture();
    const csv = '\u00e9'.repeat(rawCsvLimit / 2 + 1);
    expect(csv.length).toBeLessThan(rawCsvLimit);
    const rejected = await request(f.app).post(`${f.path}${suffix}`).set(f.headers).send({ csv }).expect(400);
    expect(rejected.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'CSV import payload cannot exceed 1 MiB.' });
    await expectNoWrites(f);
  });

  it('still rejects field/row policy violations after transport acceptance, with atomic apply', async () => {
    const f = await fixture();
    const rows = [
      { title: 'Valid row must not commit', type: 'task', priority: 'medium', description: '' },
      { title: 'Invalid row', type: 'task', priority: 'medium', description: '' }
    ];
    rows[1]!.description = 'a'.repeat(rawCsvLimit - Buffer.byteLength(stringify(rows, { header: true, columns })));
    const csv = stringify(rows, { header: true, columns });
    expect(Buffer.byteLength(csv)).toBe(rawCsvLimit);
    const preview = await request(f.app).post(`${f.path}/preview`).set(f.headers).send({ csv }).expect(200);
    expect(preview.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'description' })]));
    await request(f.app).post(f.path).set(f.headers).send({ csv }).expect(400);
    const tooMany = stringify(Array.from({ length: 251 }, (_, i) => ({ title: `Row ${i}`, type: 'task', priority: 'medium', description: '' })), { header: true, columns });
    const rejected = await request(f.app).post(f.path).set(f.headers).send({ csv: tooMany }).expect(400);
    expect(rejected.body.error.message).toBe('CSV imports can include at most 250 data rows.');
    await expectNoWrites(f);
  });

  it('rejects compressed import JSON before actor/domain work', async () => {
    const f = await fixture();
    const actorLookup = vi.spyOn(f.repositories.members, 'findById');
    for (const suffix of ['', '/preview']) {
      const rejected = await request(f.app).post(`${f.path}${suffix}`).set(f.headers).type('json')
        .set('Content-Encoding', 'gzip').send(gzipSync(JSON.stringify({ csv: 'private-csv' }))).expect(415);
      expect(rejected.body.error.details).toEqual({ reason: 'unsupported_encoding' });
    }
    expect(actorLookup).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toMatch(/private-csv|gzip/);
    await expectNoWrites(f);
  });

  it('does not widen ordinary JSON, wrong-method import requests, or import-prefix neighbors', async () => {
    const f = await fixture();
    const body = JSON.stringify({ csv: 'a'.repeat(jsonBodyLimits.ordinary) });
    const ordinary = await request(f.app).post(`/api/projects/${f.projectId}/work-items`).set(f.headers).type('json').send(body).expect(413);
    expect(ordinary.body.error.details.limitBytes).toBe(102_400);
    await request(f.app).patch(f.path).set(f.headers).type('json').send(body).expect(413);
    await request(f.app).post(`${f.path}/preview/private-suffix`).set(f.headers).type('json').send(body).expect(413);
    await expectNoWrites(f);
  });
});
