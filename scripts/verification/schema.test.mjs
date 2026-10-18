import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { verifySchemaGeneration } from './schema.mjs';

test('schema generation accepts unchanged inventory and rejects added or changed SQL/metadata', async () => {
  const checkout = await mkdtemp(join(tmpdir(), 'worktrail-schema-test-'));
  try {
    const root = join(checkout, 'apps/api/drizzle');
    await mkdir(join(root, 'meta'), { recursive: true });
    await writeFile(join(root, '0000.sql'), 'create table example(id integer);');
    await writeFile(join(root, 'meta/_journal.json'), '{}');
    await verifySchemaGeneration(checkout, async () => {});
    await assert.rejects(verifySchemaGeneration(checkout, () => writeFile(join(root, 'meta/_journal.json'), '{"changed":true}')), /inventory/);
    await assert.rejects(verifySchemaGeneration(checkout, () => writeFile(join(root, '0001.sql'), 'alter table example add name text;')), /inventory/);
    await assert.rejects(verifySchemaGeneration(checkout, async () => { throw new Error('generator failed'); }), /generator failed/);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});
