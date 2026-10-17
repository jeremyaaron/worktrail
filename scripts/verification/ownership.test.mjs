import assert from 'node:assert/strict';
import { lstat, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  assertOwnedDatabase, childEnvironment, createManifest, databaseMarker,
  parseDatabaseUrl, readEnvironmentManifest, readManifest, removeRunDirectory, saveManifest
} from './ownership.mjs';

async function fixture(t) {
  const manifest = await createManifest('service');
  t.after(() => rm(manifest.root, { recursive: true, force: true }));
  manifest.databaseUrl = `postgres://user:secret@127.0.0.1:5432/${manifest.databaseName}`;
  manifest.databaseState = 'owned';
  await saveManifest(manifest);
  return manifest;
}

test('creates private ownership outside resettable attachment objects', async (t) => {
  const manifest = await fixture(t);
  assert.equal((await lstat(join(manifest.root, 'manifest.json'))).mode & 0o777, 0o600);
  assert.equal((await lstat(manifest.root)).mode & 0o777, 0o700);
  await rm(manifest.storageRoot, { recursive: true });
  assert.equal((await readEnvironmentManifest(childEnvironment(manifest))).runId, manifest.runId);
  assert.equal(await readFile(join(manifest.root, '.worktrail-verification'), 'utf8'), databaseMarker(manifest));
});

test('locality, CI and skip flags do not authorize a database', async () => {
  await assert.rejects(assertOwnedDatabase({ DATABASE_URL: 'postgres://x:x@localhost/worktrail', CI: 'true', WORKTRAIL_E2E_SKIP_DB_RESET: 'true' }), /ownership/);
});

test('requires matching manifest, environment, live database and nonce', async (t) => {
  const manifest = await fixture(t);
  const env = childEnvironment(manifest);
  const pool = { query: async () => ({ rows: [{ database_name: manifest.databaseName, marker: databaseMarker(manifest) }] }) };
  await assertOwnedDatabase(env, pool);
  await assert.rejects(assertOwnedDatabase({ ...env, WORKTRAIL_VERIFY_NONCE: '0'.repeat(64) }, pool), /ownership/);
  await assert.rejects(assertOwnedDatabase({ ...env, DATABASE_URL: 'postgres://user:secret@localhost/worktrail' }, pool), /target/);
  await assert.rejects(assertOwnedDatabase({ ...env, WORKTRAIL_ATTACHMENT_STORAGE_PATH: '/tmp/unowned' }, pool), /target/);
  for (const row of [{ database_name: 'worktrail', marker: databaseMarker(manifest) }, { database_name: manifest.databaseName, marker: null }]) {
    await assert.rejects(assertOwnedDatabase(env, { query: async () => ({ rows: [row] }) }), /identity/);
  }
});

test('rejects manifest/store symlinks and forged directory markers', async (t) => {
  const manifest = await fixture(t);
  const path = join(manifest.root, 'manifest.json');
  await rm(manifest.storageRoot, { recursive: true });
  await symlink(manifest.root, manifest.storageRoot);
  await assert.rejects(readManifest(path, manifest.nonce), /ownership/);
  await rm(manifest.storageRoot);
  await writeFile(join(manifest.root, '.worktrail-verification'), 'not this run');
  await assert.rejects(removeRunDirectory(manifest), /ownership/);
  assert.equal((await lstat(manifest.root)).isDirectory(), true);
});

test('rejects connection-string target overrides and exposes no credential in errors', () => {
  for (const url of ['postgres://u:secret@localhost/run?host=remote', 'postgres://u:secret@localhost/run?database=worktrail', 'mysql://u:secret@localhost/run']) {
    assert.throws(() => parseDatabaseUrl(url), (error) => !error.message.includes('secret'));
  }
});
