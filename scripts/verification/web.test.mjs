import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import { createManifest, repositoryRoot, saveManifest } from './ownership.mjs';
import { cleanupRun } from './resources.mjs';
import { prepareWorkspace } from './workspace.mjs';
import {
  executeWebPartitions, parseWebArguments, partitionWebTests, readWebTestContext,
  runWebTests, validateWebConfiguration
} from './web.mjs';

const files = ['src/a.spec.ts', 'src/b.spec.ts', 'src/c.test.ts'];
const migration = { schemaVersion: 1, migrated: ['src/b.spec.ts'] };

test('web discovery is exhaustive and disjoint, with focused selections that cannot silently pass empty', () => {
  assert.deepEqual(partitionWebTests(files, migration), [
    { runner: 'karma', files: ['src/a.spec.ts', 'src/c.test.ts'] },
    { runner: 'vitest', files: ['src/b.spec.ts'] }
  ]);
  assert.deepEqual(partitionWebTests(files, migration, parseWebArguments(['--include=src/b.spec.ts'])), [
    { runner: 'vitest', files: ['src/b.spec.ts'] }
  ]);
  for (const bad of [
    { ...migration, schemaVersion: 2 }, { ...migration, migrated: ['src/missing.spec.ts'] },
    { ...migration, migrated: ['src/b.spec.ts', 'src/b.spec.ts'] }, { ...migration, migrated: ['../escape.spec.ts'] }
  ]) assert.throws(() => partitionWebTests(files, bad));
  assert.throws(() => partitionWebTests([], migration));
  assert.throws(() => partitionWebTests([...files, files[0]], migration));
  assert.throws(() => partitionWebTests(files, migration, parseWebArguments(['--include=src/missing.spec.ts'])));
  assert.throws(() => partitionWebTests(files, migration, parseWebArguments(['--runner=karma', '--include=src/b.spec.ts'])));
  assert.throws(() => partitionWebTests(files, { schemaVersion: 1, migrated: [] }, parseWebArguments(['--runner=vitest'])));
});

test('web arguments reject unsafe paths, unsupported watch/filter modes, and unknown flags', () => {
  for (const args of [
    ['--include='], ['--include=/tmp/a.spec.ts'], ['--include=src/../a.spec.ts'],
    ['--include=src/*.spec.ts'], ['--include=src/a.spec.ts', '--include=src/a.spec.ts'],
    ['--runner=unknown'], ['--watch'], ['--filter=x'], ['--runner=vitest', '--filter='],
    ['--runner=vitest', '--watch'], ['--runner=vitest', '--filter=['], ['--retries=1']
  ]) assert.throws(() => parseWebArguments(args));
  assert.equal(parseWebArguments(['--runner=vitest', '--filter=HTTP']).filter, 'HTTP');
});

test('a completed migration runs only Vitest and rejects explicit legacy selections', () => {
  const complete = { schemaVersion: 1, migrated: files };
  assert.deepEqual(partitionWebTests(files, complete), [{ runner: 'vitest', files }]);
  assert.throws(() => partitionWebTests(files, complete, parseWebArguments(['--runner=karma'])), /No specs match/);
  assert.throws(() => partitionWebTests(files, complete,
    parseWebArguments(['--runner=karma', '--include=src/a.spec.ts'])), /No specs match/);
});

test('either failed partition preserves independent results and the aggregate failure', async () => {
  for (const failing of [['karma'], ['vitest'], ['karma', 'vitest']]) {
    const observed = [];
    await assert.rejects(executeWebPartitions(partitionWebTests(files, migration), async part => {
      observed.push(part.runner);
      if (failing.includes(part.runner)) throw new Error(`${part.runner} failed`);
    }), error => error instanceof AggregateError && error.errors.length === failing.length);
    assert.deepEqual(observed, ['karma', 'vitest']);
  }
  const successful = [];
  await executeWebPartitions(partitionWebTests(files, migration), async part => successful.push(part.runner));
  assert.deepEqual(successful, ['karma', 'vitest']);
});

test('interruption or failed cleanup prevents starting the next partition', async () => {
  let stopped = false;
  const observed = [];
  await assert.rejects(executeWebPartitions(partitionWebTests(files, migration), async part => {
    observed.push(part.runner); stopped = true; throw new Error('interrupted');
  }, () => stopped), /interrupted/);
  assert.deepEqual(observed, ['karma']);
});

test('the committed type scopes and runtime identity match the migration manifest', async () => {
  const { inventory, migration: actual } = await validateWebConfiguration(repositoryRoot);
  const partitions = partitionWebTests(inventory, actual);
  assert.equal(partitions.flatMap(part => part.files).length, inventory.length);
  assert.equal(new Set(partitions.flatMap(part => part.files)).size, inventory.length);
});

test('web runner refuses working-checkout writes and validates its port ownership', async () => {
  const manifest = await createManifest('none');
  try {
    await assert.rejects(runWebTests(manifest, repositoryRoot), /owned source snapshot/);
    manifest.ports.vitest = 4321;
    await saveManifest(manifest);
    const env = {
      WORKTRAIL_VERIFY_MANIFEST: join(manifest.root, 'manifest.json'),
      WORKTRAIL_VERIFY_NONCE: manifest.nonce, WORKTRAIL_VERIFY_VITEST_PORT: '4321'
    };
    assert.deepEqual(await readWebTestContext(env), {
      port: 4321, cacheDir: join(manifest.root, 'vitest-cache'), reportPath: join(manifest.root, 'vitest-results.json')
    });
    await assert.rejects(readWebTestContext({ ...env, WORKTRAIL_VERIFY_VITEST_PORT: '4322' }), /owned port/);
    await assert.rejects(readWebTestContext({}), /ownership/);
  } finally { await cleanupRun(manifest); }
});

test('a stale editor type scope fails rather than excluding newly migrated specs', async () => {
  const manifest = await createManifest('none');
  try {
    const checkout = await prepareWorkspace(manifest);
    const path = join(checkout, 'apps/web/tsconfig.vitest.json');
    const config = JSON.parse(await readFile(path, 'utf8'));
    config.include = config.include.filter(file => file !== 'src/app/app.spec.ts');
    await writeFile(path, JSON.stringify(config));
    await assert.rejects(validateWebConfiguration(checkout), /out of sync/);
  } finally { await cleanupRun(manifest); }
});
