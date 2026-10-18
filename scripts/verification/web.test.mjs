import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import { createManifest, repositoryRoot, saveManifest } from './ownership.mjs';
import { cleanupRun } from './resources.mjs';
import { prepareWorkspace } from './workspace.mjs';
import {
  parseWebArguments, readWebTestContext, runWebTests, selectWebTests,
  validateWebConfiguration, validateWebReport
} from './web.mjs';

const files = ['src/a.spec.ts', 'src/b.spec.ts', 'src/c.test.ts'];

test('single-runner discovery is complete and focused selections cannot silently pass empty', () => {
  assert.deepEqual(selectWebTests(files), files);
  assert.deepEqual(selectWebTests(files, parseWebArguments(['--include=src/b.spec.ts'])), ['src/b.spec.ts']);
  for (const bad of [[], [...files, files[0]], ['../escape.spec.ts']]) assert.throws(() => selectWebTests(bad));
  assert.throws(() => selectWebTests(files, parseWebArguments(['--include=src/missing.spec.ts'])));
});

test('arguments reject unsafe paths and retired runner flags; watch/headed mode is explicitly interactive', () => {
  for (const args of [
    ['--include='], ['--include=/tmp/a.spec.ts'], ['--include=src/../a.spec.ts'],
    ['--include=src/*.spec.ts'], ['--include=src/a.spec.ts', '--include=src/a.spec.ts'],
    ['--runner=karma'], ['--runner=vitest'], ['--filter='], ['--filter=['], ['--retries=1'], ['--headed']
  ]) assert.throws(() => parseWebArguments(args));
  assert.equal(parseWebArguments(['--filter=HTTP']).filter, 'HTTP');
  assert.equal(parseWebArguments(['--watch', '--headed']).headed, true);
  assert.equal(parseWebArguments([]).watch, false);
});

test('structured acceptance rejects empty, incomplete, skipped and failed reports', () => {
  const root = '/scratch/apps/web';
  const report = {
    success: true, numPassedTests: 3, numFailedTests: 0, numPendingTests: 0,
    testResults: files.map(file => ({ name: join(root, file), assertionResults: [{ status: 'passed' }] }))
  };
  const options = parseWebArguments([]);
  assert.deepEqual(validateWebReport(report, root, files, options), { files: 3, passed: 3, failed: 0, skipped: 0 });
  for (const bad of [
    { ...report, success: false }, { ...report, numPassedTests: 0 }, { ...report, numFailedTests: 1 },
    { ...report, testResults: report.testResults.slice(1) },
    { ...report, testResults: report.testResults.map(file => ({ ...file, assertionResults: [] })) },
    { ...report, testResults: report.testResults.map(file => ({ ...file, assertionResults: [{ status: 'pending' }] })) }
  ]) assert.throws(() => validateWebReport(bad, root, files, options));
  const filtered = structuredClone(report);
  filtered.testResults[0].assertionResults = [{ status: 'pending' }];
  assert.doesNotThrow(() => validateWebReport(filtered, root, files, parseWebArguments(['--filter=HTTP'])));
});

test('the committed editor scope covers every discovered spec with one Angular runtime', async () => {
  const { inventory } = await validateWebConfiguration(repositoryRoot);
  assert.equal(selectWebTests(inventory).length, inventory.length);
});

test('both public commands enter the owned runner without npm consuming selection arguments', async () => {
  const root = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'));
  const web = JSON.parse(await readFile(join(repositoryRoot, 'apps/web/package.json'), 'utf8'));
  assert.equal(root.scripts['test:web'], 'node scripts/test-web.mjs');
  assert.equal(web.scripts.test, 'node ../../scripts/test-web.mjs');
});

test('automated runner refuses working-checkout writes and validates port ownership and output isolation', async () => {
  const manifest = await createManifest('none');
  try {
    await assert.rejects(runWebTests(manifest, repositoryRoot), /owned source snapshot/);
    manifest.ports.vitest = 4321;
    manifest.web = { checkout: join(manifest.root, 'checkout'), watch: false };
    await saveManifest(manifest);
    const env = {
      WORKTRAIL_VERIFY_MANIFEST: join(manifest.root, 'manifest.json'),
      WORKTRAIL_VERIFY_NONCE: manifest.nonce, WORKTRAIL_VERIFY_VITEST_PORT: '4321'
    };
    assert.deepEqual(await readWebTestContext(env), {
      port: 4321, cacheDir: join(manifest.root, 'vitest-cache'),
      reportPath: join(manifest.resultsRoot, 'web/report.json'), screenshotDirectory: join(manifest.root, 'checkout/apps/web/.vitest-screenshots')
    });
    await assert.rejects(readWebTestContext({ ...env, WORKTRAIL_VERIFY_VITEST_PORT: '4322' }), /owned port/);
    await assert.rejects(readWebTestContext({}), /ownership/);
    manifest.web.checkout = '/unowned'; await saveManifest(manifest);
    await assert.rejects(readWebTestContext(env), /owned source context/);
    manifest.web.checkout = join(manifest.root, 'checkout');
    for (const port of [0, 65536, 4.5, '4321']) {
      manifest.ports.vitest = port; await saveManifest(manifest);
      await assert.rejects(readWebTestContext({ ...env, WORKTRAIL_VERIFY_VITEST_PORT: String(port) }), /ownership|owned port/);
    }
  } finally {
    manifest.ports.vitest = 4321;
    await saveManifest(manifest);
    await cleanupRun(manifest);
  }
});

test('an excluded spec or ambient test types fail configuration validation', async () => {
  const manifest = await createManifest('none');
  try {
    const checkout = await prepareWorkspace(manifest);
    const path = join(checkout, 'apps/web/tsconfig.spec.json');
    const source = await readFile(path, 'utf8');
    const original = JSON.parse(source.slice(source.indexOf('{')));
    for (const config of [
      { ...original, exclude: ['src/app/app.spec.ts'] },
      { ...original, compilerOptions: { ...original.compilerOptions, types: ['vitest/globals'] } }
    ]) {
      await writeFile(path, JSON.stringify(config));
      await assert.rejects(validateWebConfiguration(checkout), /out of sync/);
    }
  } finally { await cleanupRun(manifest); }
});
