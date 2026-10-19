import assert from 'node:assert/strict';
import { glob, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { childEnvironment, createManifest, repositoryRoot, saveManifest } from './verification/ownership.mjs';
import { selectPort } from './verification/ports.mjs';
import { processIdentity, runCommand } from './verification/processes.mjs';
import { cleanupRun, prepareApiDatabase, provisionDatabase } from './verification/resources.mjs';
import { prepareWorkspace } from './verification/workspace.mjs';
import {
  assertFullTestReport, assertLedgerAdopted, assertPopulatedBaseline, assertPreserved, assertReapplicationNoOp,
  captureApplicationState, convertedMigrations, sha256
} from './verification/upgrade.mjs';

if (process.argv.length !== 2) throw new Error('Use npm run verify:upgrade (no target URL or working-data options).');
const controller = new AbortController();
let interrupted = null;
const interrupt = signal => { interrupted ??= signal; controller.abort(); };
const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
process.on('SIGINT', onInt);
process.on('SIGTERM', onTerm);
const manifests = [], gates = [], cleanup = [];
let current, failure, result;
const gate = async (name, operation) => {
  console.log(`\n=== ${name} ===`);
  const record = { name, passed: false, durationMs: 0 }, started = Date.now();
  gates.push(record);
  try { const value = await operation(); record.passed = true; return value; }
  finally { record.durationMs = Date.now() - started; }
};
async function own(mode) {
  const manifest = await createManifest(mode);
  manifests.push(manifest);
  manifest.owner = { pid: process.pid, identity: await processIdentity(process.pid) };
  assert.ok(manifest.owner.identity, 'Could not identify upgrade verification owner.');
  await saveManifest(manifest);
  console.log(`Owned ${mode} resource: ${join(manifest.root, 'manifest.json')}`);
  return manifest;
}
const command = (manifest, cwd, executable, args, env = childEnvironment(manifest)) => runCommand(executable, args, {
  manifest, cwd, env, inherit: true, signal: controller.signal, timeoutMs: 600_000, trackDescendants: true
});
const npm = (manifest, cwd, args) => command(manifest, cwd, 'npm', args);
const readJson = async path => JSON.parse(await readFile(path));
const writeJson = (name, value) => writeFile(join(current.resultsRoot, name), JSON.stringify(value, null, 2) + '\n');
async function testInventory(checkout, pattern) {
  const files = [];
  for await (const file of glob(pattern, { cwd: checkout })) files.push(join(checkout, file));
  return files;
}
async function installation(checkout) {
  const require = createRequire(join(checkout, 'apps/api/package.json'));
  const entry = await realpath(require.resolve('drizzle-orm'));
  assert.ok(entry.startsWith(`${checkout}/`), 'Upgrade installations must not share dependencies.');
  return { orm: (await readJson(join(dirname(entry), 'package.json'))).version,
    lockSha256: sha256(await readFile(join(checkout, 'package-lock.json'))) };
}
try {
  const prior = await own('none');
  const priorCheckout = join(prior.root, 'checkout');
  await mkdir(priorCheckout);
  const commit = await runCommand('git', ['rev-parse', '--verify', 'v0.3.0^{commit}'], { cwd: repositoryRoot, signal: controller.signal })
    .catch(error => {
      if (controller.signal.aborted) throw error;
      throw new Error('Upgrade verification requires the local v0.3.0 tag. Fetch release tags before running; no working data was used.', { cause: error });
    });
  assert.match(commit, /^[a-f0-9]{40}$/);
  await gate('baseline:archive-v0.3.0', async () => {
    const archive = join(prior.root, 'baseline.tar');
    await command(prior, repositoryRoot, 'git', ['archive', '--format=tar', `--output=${archive}`, commit]);
    await command(prior, priorCheckout, 'tar', ['-xf', archive]);
    assert.equal((await readJson(join(priorCheckout, 'package.json'))).version, '0.3.0');
  });
  await gate('baseline:independent-install', () => npm(prior, priorCheckout, ['ci', '--no-audit', '--no-fund']));
  const fresh = await own('docker');
  await gate('database:disposable-postgres', () => provisionDatabase(fresh, { signal: controller.signal }));
  current = await own('service');
  await mkdir(current.resultsRoot, { recursive: true });
  console.log(`Upgrade evidence: ${current.resultsRoot}`);
  await gate('database:separate-upgrade-target', () => provisionDatabase(current, {
    signal: controller.signal, env: { ...process.env, WORKTRAIL_VERIFY_ADMIN_DATABASE_URL: fresh.databaseUrl }
  }));
  const checkout = await prepareWorkspace(current, { linkInstalledDependencies: false });
  await gate('candidate:independent-install', () => npm(current, checkout, ['ci', '--no-audit', '--no-fund']));
  const installations = { prior: { commit, ...(await installation(priorCheckout)) }, current: await installation(checkout) };
  const migrations = await convertedMigrations(checkout);
  await gate('history:sql-bytes-and-order', async () => {
    const journal = await readJson(join(priorCheckout, 'apps/api/drizzle/meta/_journal.json'));
    assert.equal(journal.entries.length, migrations.length);
    for (const [index, entry] of journal.entries.entries()) {
      assert.equal(migrations[index].hash, sha256(await readFile(join(priorCheckout, 'apps/api/drizzle', `${entry.tag}.sql`))));
      assert.equal(migrations[index].name.slice(15), entry.tag.slice(5));
    }
  });
  await gate('baseline:migrate', () => npm(current, priorCheckout, ['run', 'db:migrate']));
  await gate('baseline:seed-before-capture', () => npm(current, priorCheckout, ['run', 'db:seed']));
  const before = await gate('preservation:capture-populated-baseline', () => captureApplicationState(current));
  assertPopulatedBaseline(before);
  await writeJson('before.json', before);
  // From this point until all preservation comparisons finish, neither seed nor reset is invoked.
  await gate('upgrade:ordinary-migrate', () => npm(current, checkout, ['run', 'db:migrate']));
  current.prepared = true; await saveManifest(current);
  const after = await captureApplicationState(current);
  await gate('preservation:data-schema-storage-ledger', async () => {
    assertPreserved(before, after);
    assertLedgerAdopted(before.ledger, after.ledger, migrations);
  });
  await writeJson('after.json', after);
  await gate('upgrade:repeat-migrate', () => npm(current, checkout, ['run', 'db:migrate']));
  const repeated = await captureApplicationState(current);
  await gate('preservation:upgrade-no-op', async () => assertReapplicationNoOp(after, repeated));
  await gate('fresh:migrate', () => prepareApiDatabase(fresh, { cwd: checkout, signal: controller.signal }));
  const freshBefore = await captureApplicationState(fresh);
  await gate('preservation:fresh-schema', async () => {
    assert.deepEqual(freshBefore.schema, after.schema, 'Fresh and upgraded application schemas differ.');
    assert.deepEqual(freshBefore.ledger.map(row => ({ hash: row.hash, name: row.name })),
      after.ledger.map(row => ({ hash: row.hash, name: row.name })));
  });
  await gate('fresh:repeat-migrate', () => npm(fresh, checkout, ['run', 'db:migrate']));
  await gate('preservation:fresh-no-op', async () => assertReapplicationNoOp(freshBefore, await captureApplicationState(fresh)));
  for (const workspace of ['contracts', 'api']) {
    for (const task of ['lint', 'typecheck', 'build']) {
      await gate(`${task}:${workspace}`, () => npm(current, checkout, ['run', task, '--workspace', `@worktrail/${workspace}`]));
    }
  }
  await gate('lint:upgrade-and-api-tests', () => npm(current, checkout, ['exec', '--', 'eslint',
    'scripts/verify-upgrade.mjs', 'scripts/verification/upgrade*.mjs', 'apps/api/tests', 'apps/api/vitest.config.ts', '--max-warnings=0']));
  await gate('test:upgrade-schema-resource-helpers', () => command(current, checkout, process.execPath, ['--test',
    'scripts/verification/upgrade.test.mjs', 'scripts/verification/schema.test.mjs',
    'scripts/verification/resources.test.mjs', 'scripts/verification/ownership.test.mjs']));
  await gate('test:contracts', () => npm(fresh, checkout, ['run', 'test', '--workspace', '@worktrail/contracts', '--',
    '--reporter=default', '--reporter=json', `--outputFile=${join(current.resultsRoot, 'contracts-tests.json')}`]));
  await gate('test:full-api', () => npm(fresh, checkout, ['run', 'test', '--workspace', '@worktrail/api', '--',
    '--silent=passed-only', '--reporter=default', '--reporter=json', `--outputFile=${join(current.resultsRoot, 'api-tests.json')}`]));
  await gate('test:complete-report-inventory', async () => {
    assertFullTestReport(await readJson(join(current.resultsRoot, 'api-tests.json')),
      await testInventory(checkout, 'apps/api/tests/**/*.test.ts'));
    assertFullTestReport(await readJson(join(current.resultsRoot, 'contracts-tests.json')),
      await testInventory(checkout, 'packages/contracts/src/**/*.test.ts'));
  });
  current.ports = { api: await selectPort() }; await saveManifest(current);
  await gate('runtime:compiled-api', () => command(current, checkout, process.execPath, ['scripts/verification/upgrade-runtime.mjs'], {
    ...childEnvironment(current), NODE_ENV: 'production', WORKTRAIL_SERVE_STATIC: 'false', WORKTRAIL_ATTACHMENT_STORAGE_DRIVER: 'local'
  }));
  const runtimeState = await captureApplicationState(current);
  await gate('preservation:history-and-files-after-runtime', async () => {
    assert.deepEqual(runtimeState.data.project_status_reports, before.data.project_status_reports);
    assert.deepEqual(runtimeState.data.project_cycle_closeouts, before.data.project_cycle_closeouts);
    assert.deepEqual(runtimeState.storage, before.storage);
    assert.deepEqual(runtimeState.ledger, after.ledger);
  });
  result = {
    installations, migrationCount: migrations.length,
    rows: Object.fromEntries(Object.entries(before.data).map(([table, rows]) => [table, rows.length])),
    dataSha256: sha256(JSON.stringify(before.data)), schemaSha256: sha256(JSON.stringify(before.schema)),
    storage: before.storage, extensions: before.schema.extensions,
    ledgers: { before: before.ledger, after: after.ledger },
    preserved: { rows: true, schema: true, extensions: true, historicalJson: true, attachmentBytes: true,
      originalLedger: true, repeatedUpgradeNoOp: true, freshSchemaEquivalent: true, freshRepeatNoOp: true },
    runtime: await readJson(join(current.resultsRoot, 'compiled-runtime.json'))
  };
} catch (error) { failure = error; }
finally {
  for (const manifest of manifests.reverse()) {
    try { await cleanupRun(manifest, { allowOwner: true }); cleanup.push({ runId: manifest.runId, removed: true }); }
    catch (error) { failure ??= error; cleanup.push({ runId: manifest.runId, removed: false }); }
  }
  const resultsRoot = current?.resultsRoot ?? manifests[0]?.resultsRoot;
  if (resultsRoot) {
    await mkdir(resultsRoot, { recursive: true });
    await writeFile(join(resultsRoot, 'summary.json'), JSON.stringify({
      mode: 'upgrade', passed: !failure && !interrupted, interrupted, gates, result, cleanup,
      error: failure?.message ?? null
    }, null, 2) + '\n');
    console.log(`Retained upgrade summary: ${join(resultsRoot, 'summary.json')}`);
  }
  process.removeListener('SIGINT', onInt);
  process.removeListener('SIGTERM', onTerm);
}
if (failure) console.error(failure.message);
process.exitCode = interrupted ? (interrupted === 'SIGINT' ? 130 : 143) : failure ? 1 : 0;
