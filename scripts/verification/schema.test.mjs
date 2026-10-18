import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { verifySchemaGeneration } from './schema.mjs';

async function fixture(check) {
  const checkout = await mkdtemp(join(tmpdir(), 'worktrail-schema-test-'));
  try {
    const root = join(checkout, 'apps/api/drizzle');
    const migration = join(root, '20261018000000_example');
    await mkdir(migration, { recursive: true });
    await writeFile(join(migration, 'migration.sql'), 'create table example(id integer);');
    await writeFile(join(migration, 'snapshot.json'), '{"id":"original"}');
    await check({ checkout, root, migration });
  } finally { await rm(checkout, { recursive: true, force: true }); }
}

test('schema generation accepts an unchanged recursive migration inventory', async () => {
  await fixture(({ checkout }) => verifySchemaGeneration(checkout, async () => {}));
});

for (const name of ['migration.sql', 'snapshot.json']) {
  test(`schema generation rejects modified ${name}`, async () => {
    await fixture(({ checkout, migration }) => assert.rejects(
      verifySchemaGeneration(checkout, () => writeFile(join(migration, name), 'changed')), /inventory/
    ));
  });
  test(`schema generation rejects deleted ${name}`, async () => {
    await fixture(({ checkout, migration }) => assert.rejects(
      verifySchemaGeneration(checkout, () => rm(join(migration, name))), /inventory/
    ));
  });
}

test('schema generation rejects added migrations and unknown nested metadata', async () => {
  for (const path of ['20261018000001_next/migration.sql', '20261018000000_example/meta/new.json']) {
    await fixture(({ checkout, root }) => assert.rejects(verifySchemaGeneration(checkout, async () => {
      const parts = path.split('/');
      await mkdir(join(root, ...parts.slice(0, -1)), { recursive: true });
      await writeFile(join(root, path), '{}');
    }), /inventory/));
  }
});

test('schema generation preserves generator failures', async () => {
  const failure = new Error('generator failed');
  await fixture(({ checkout }) => assert.rejects(verifySchemaGeneration(checkout, async () => {
    throw failure;
  }), (error) => error === failure));
});

test('schema inventory refuses unsupported symlink entries before and after generation', async () => {
  for (const before of [true, false]) {
    await fixture(async ({ checkout, root, migration }) => {
      const addLink = () => symlink(join(migration, 'snapshot.json'), join(root, 'linked.json'));
      if (before) await addLink();
      let generated = false;
      await assert.rejects(verifySchemaGeneration(checkout, async () => {
        generated = true;
        if (!before) await addLink();
      }), /non-file migration entries/);
      assert.equal(generated, !before);
    });
  }
});
