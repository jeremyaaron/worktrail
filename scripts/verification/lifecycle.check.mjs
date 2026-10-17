import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import {
  assertOwnedDatabase, childEnvironment, createManifest, createVerificationPool,
  databaseMarker, readCleanupManifest, repositoryRoot, saveManifest
} from './ownership.mjs';
import { processIdentity, runCommand } from './processes.mjs';
import { cleanupRun, prepareApiDatabase, provisionDatabase } from './resources.mjs';
import { parseArguments } from './arguments.mjs';
import { runBrowser } from './browser.mjs';
import { readBrowserContext } from './browser-context.mjs';
import { selectPort } from './ports.mjs';
import { prepareWorkspace } from './workspace.mjs';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { escapeIdentifier, escapeLiteral } = require('pg');
let host;
let admin;

before(async () => {
  host = await createManifest('docker');
  await provisionDatabase(host);
  admin = createVerificationPool(host.databaseUrl);
});
after(async () => {
  await admin?.end();
  if (host) await cleanupRun(host);
});

async function databaseExists(name) {
  return (await admin.query('select 1 from pg_database where datname = $1', [name])).rows.length > 0;
}

async function runCli({ signal, failNpm = false } = {}) {
  const env = { ...process.env, WORKTRAIL_VERIFY_ADMIN_DATABASE_URL: host.databaseUrl };
  delete env.WORKTRAIL_VERIFY_MANIFEST;
  delete env.WORKTRAIL_VERIFY_NONCE;
  if (failNpm) {
    const bin = join(host.root, 'failing-npm');
    await mkdir(bin, { recursive: true });
    await writeFile(join(bin, 'npm'), '#!/bin/sh\nexit 42\n', { mode: 0o700 });
    env.PATH = `${bin}:${env.PATH}`;
  }
  const child = spawn(process.execPath, ['scripts/verify.mjs', '--mode=api', '--database=service'], {
    cwd: repositoryRoot, env, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  let path;
  let manifest;
  let signaled = false;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 90_000);
  const complete = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code));
  });
  child.stdout.on('data', (chunk) => {
    output += chunk;
    path ??= /Ownership manifest: ([^\n]+)/.exec(output)?.[1];
    if (signal && !signaled && output.includes('Database migrations applied.')) {
      signaled = true;
      child.kill(signal);
    }
  });
  child.stderr.on('data', (chunk) => { output += chunk; });
  // Capture the private identity before the successful runner removes its directory.
  const capture = setInterval(async () => {
    if (path) {
      try {
        const candidate = JSON.parse(await readFile(path, 'utf8'));
        if (candidate.databaseUrl) manifest = candidate;
      } catch { /* Creation/cleanup boundary. */ }
    }
  }, 5);
  try {
    const code = await complete;
    assert.equal(timedOut, false, 'CLI lifecycle timed out');
    assert.ok(manifest, 'CLI ownership was captured before cleanup');
    assert.ok(!output.includes(host.databaseUrl), 'Administrative credentials were not logged');
    assert.ok(!output.includes(manifest.nonce), 'Run nonce was not logged');
    assert.ok(!output.includes(new URL(manifest.databaseUrl).password), 'Database password was not logged');
    assert.equal(await databaseExists(manifest.databaseName), false);
    assert.equal(await stat(manifest.root).then(() => true, () => false), false);
    return { code, output, signaled };
  } finally {
    clearInterval(capture);
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    if (path && await stat(path).then(() => true, () => false)) await cleanupRun(await readCleanupManifest(path));
  }
}

test('service provision, live mismatch refusal, marker-protected cleanup and idempotence', async () => {
  const manifest = await createManifest('service');
  try {
    await provisionDatabase(manifest, { env: { WORKTRAIL_VERIFY_ADMIN_DATABASE_URL: host.databaseUrl } });
    await assertOwnedDatabase(childEnvironment(manifest));
    const pool = createVerificationPool(manifest.databaseUrl);
    try {
      await pool.query('create table sentinel(value integer)');
      await pool.query('insert into sentinel values (7)');
      await assert.rejects(assertOwnedDatabase(childEnvironment(host), pool), /identity/);
      const unownedEnv = { ...childEnvironment(manifest) };
      delete unownedEnv.WORKTRAIL_VERIFY_MANIFEST;
      delete unownedEnv.WORKTRAIL_VERIFY_NONCE;
      for (const script of ['db:reset', 'db:migrate', 'db:seed', 'storage:reset', 'db:performance-evidence', 'db:quick-find-performance-evidence']) {
        await assert.rejects(runCommand('npm', ['run', script], { env: unownedEnv, cwd: repositoryRoot }), /failed/);
      }
      for (const module of ['global-setup', 'global-teardown', 'reset-demo-database']) {
        const expression = module === 'reset-demo-database'
          ? "import { resetDemoDatabase } from './e2e/reset-demo-database.ts'; resetDemoDatabase();"
          : `import action from './e2e/${module}.ts'; await action();`;
        await assert.rejects(runCommand(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', expression], {
          cwd: repositoryRoot,
          env: { ...unownedEnv, WORKTRAIL_E2E_SKIP_DB_RESET: 'true', WORKTRAIL_E2E_SKIP_DB_RESTORE: 'true' }
        }), /failed/);
      }
      assert.equal((await pool.query('select value from sentinel')).rows[0].value, 7);
      assert.equal((await pool.query("select to_regclass('public.work_items') as name")).rows[0].name, null);
    } finally { await pool.end(); }
    await admin.query(`comment on database ${escapeIdentifier(manifest.databaseName)} is 'not this run'`);
    await assert.rejects(cleanupRun(manifest), /marker/);
    assert.equal((await admin.query('select datallowconn from pg_database where datname = $1', [manifest.databaseName])).rows[0].datallowconn, true);
    await admin.query(`comment on database ${escapeIdentifier(manifest.databaseName)} is ${escapeLiteral(databaseMarker(manifest))}`);
    await cleanupRun(manifest);
    await cleanupRun(manifest);
    assert.equal(await databaseExists(manifest.databaseName), false);
  } finally {
    if (await databaseExists(manifest.databaseName)) {
      await admin.query(`comment on database ${escapeIdentifier(manifest.databaseName)} is ${escapeLiteral(databaseMarker(manifest))}`);
      await cleanupRun(manifest);
    }
  }
});

test('verified migration, repeated seed and resets preserve ownership outside resettable roots', async () => {
  const manifest = await createManifest('service');
  try {
    await provisionDatabase(manifest, { env: { WORKTRAIL_VERIFY_ADMIN_DATABASE_URL: host.databaseUrl } });
    await prepareApiDatabase(manifest);
    for (const script of ['db:seed', 'db:seed', 'storage:reset', 'db:reset', 'db:migrate', 'db:seed']) {
      await runCommand('npm', ['run', script], { cwd: repositoryRoot, env: childEnvironment(manifest) });
      await assertOwnedDatabase(childEnvironment(manifest));
    }
  } finally { await cleanupRun(manifest); }
});

test('actual Docker creation interrupted before startup removes the labeled container and anonymous volume', async () => {
  const manifest = await createManifest('docker');
  const controller = new AbortController();
  try {
    await assert.rejects(provisionDatabase(manifest, { signal: controller.signal, run: async (command, args, options) => {
      const result = await runCommand(command, args, options);
      if (args[0] === 'create') controller.abort();
      return result;
    } }), /interrupted/);
  } finally { await cleanupRun(manifest); }
  assert.equal(await runCommand('docker', ['container', 'ls', '--all', '--filter', `label=worktrail.verify.run=${manifest.runId}`, '--format', '{{.Names}}']), '');
});

test('explicit cleanup CLI removes a marker-validated abandoned service run', async () => {
  const manifest = await createManifest('service');
  try {
    await provisionDatabase(manifest, { env: { WORKTRAIL_VERIFY_ADMIN_DATABASE_URL: host.databaseUrl } });
    manifest.owner = { pid: 99999999, identity: '0'.repeat(64) };
    await saveManifest(manifest);
    await runCommand(process.execPath, ['scripts/verify.mjs', '--cleanup', join(manifest.root, 'manifest.json')], { cwd: repositoryRoot });
    await runCommand(process.execPath, ['scripts/verify.mjs', '--cleanup', join(manifest.root, 'manifest.json')], { cwd: repositoryRoot });
    assert.equal(await databaseExists(manifest.databaseName), false);
  } finally { await cleanupRun(manifest); }
});

test('API command failure preserves failure exit and cleans service resources', async () => {
  const result = await runCli({ failNpm: true });
  assert.equal(result.code, 1);
  assert.match(result.output, /exit 42/);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`${signal} after migration cleans child processes, database and storage`, async () => {
    const result = await runCli({ signal });
    assert.equal(result.signaled, true);
    assert.equal(result.code, signal === 'SIGINT' ? 130 : 143);
  });
}

test('service-mode CLI runs the complete API suite and cleans successfully', async () => {
  const result = await runCli();
  assert.equal(result.code, 0, result.output.slice(-8000));
  assert.match(result.output, /API verification passed/);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}

test('simultaneous browser runs isolate proxy, builds, results, data and storage; interruption leaves the other usable', { timeout: 240_000 }, async () => {
  const runs = [];
  let browser;
  try {
    const selected = new Set();
    for (let index = 0; index < 2; index += 1) {
      const manifest = await createManifest('service');
      const run = { manifest, controller: new AbortController(), ready: deferred(), proceed: deferred() };
      runs.push(run);
      await provisionDatabase(manifest, { env: { WORKTRAIL_VERIFY_ADMIN_DATABASE_URL: host.databaseUrl } });
      run.checkout = await prepareWorkspace(manifest);
      await prepareApiDatabase(manifest, { cwd: run.checkout });
      await runCommand('npm', ['run', 'db:seed'], { cwd: run.checkout, env: childEnvironment(manifest) });
      await writeFile(join(manifest.storageRoot, 'isolation-sentinel'), manifest.runId);
      const pool = createVerificationPool(manifest.databaseUrl);
      try {
        await pool.query('create table verification_sentinel(value text)');
        await pool.query('insert into verification_sentinel values ($1)', [manifest.runId]);
      } finally { await pool.end(); }
      const ports = [];
      for (let count = 0; count < 2; count += 1) {
        let port;
        do { port = await selectPort(); } while (selected.has(port) || [3000, 4200, 4317, 4319].includes(port));
        selected.add(port); ports.push(port);
      }
      run.options = parseArguments(['--mode=e2e', '--grep=persists v0.1.2', `--api-port=${ports[0]}`, `--web-port=${ports[1]}`]);
    }
    for (const run of runs) {
      run.finished = runBrowser(run.manifest, run.checkout, 'e2e', run.options, {
        signal: run.controller.signal,
        gate: async (_name, operation) => {
          run.ready.resolve();
          const abort = () => run.proceed.reject(new Error('browser run interrupted'));
          run.controller.signal.addEventListener('abort', abort, { once: true });
          if (run.controller.signal.aborted) abort();
          try { await run.proceed.promise; await operation(); }
          finally { run.controller.signal.removeEventListener('abort', abort); }
        }
      }).then(() => null, (error) => { run.ready.reject(error); return error; });
    }
    for (const run of runs) await run.ready.promise;
    const [first, second] = runs;
    assert.notEqual(first.manifest.browser.port, second.manifest.browser.port);
    assert.notEqual(first.manifest.resultsRoot, second.manifest.resultsRoot);
    for (const run of runs) {
      const env = { ...childEnvironment(run.manifest), WORKTRAIL_VERIFY_STAGE: 'e2e',
        API_PORT: String(run.manifest.browser.apiPort), WORKTRAIL_E2E_HOST: '127.0.0.1',
        WORKTRAIL_E2E_WEB_PORT: String(run.manifest.browser.port) };
      await readBrowserContext('e2e', env);
      await assert.rejects(readBrowserContext('e2e', { ...env, API_PORT: undefined }), /HTTP target fallback/);
      await assert.rejects(readBrowserContext('e2e', { ...env, API_PORT: '3000' }), /HTTP target fallback/);
      await assert.rejects(readBrowserContext('e2e', { ...env, WORKTRAIL_E2E_HOST: 'localhost' }), /HTTP target fallback/);
      const proxy = JSON.parse(await readFile(join(run.manifest.root, 'proxy.json'), 'utf8'));
      assert.equal(proxy['/api'].target, `http://127.0.0.1:${run.manifest.browser.apiPort}`);
      assert.equal((await fetch(`${run.manifest.browser.baseURL}/api/health/ready`)).status, 200);
    }
    const { chromium } = require('@playwright/test');
    browser = await chromium.launch();
    for (const run of runs) {
      run.page = await browser.newPage();
      await run.page.goto(`${run.manifest.browser.baseURL}/work-items`);
      await run.page.getByRole('heading', { level: 1 }).waitFor();
      assert.match(await run.page.getByRole('heading', { level: 1 }).textContent(), /work items/i);
    }
    first.controller.abort();
    assert.match((await first.finished).message, /interrupted/);
    await cleanupRun(first.manifest);
    assert.equal(await databaseExists(first.manifest.databaseName), false);
    assert.equal(await stat(first.manifest.root).then(() => true, () => false), false);
    await second.page.reload();
    await second.page.getByRole('heading', { level: 1 }).waitFor();
    assert.equal((await fetch(`${second.manifest.browser.baseURL}/api/health/ready`)).status, 200);
    assert.equal(await readFile(join(second.manifest.storageRoot, 'isolation-sentinel'), 'utf8'), second.manifest.runId);
    const pool = createVerificationPool(second.manifest.databaseUrl);
    try {
      assert.equal((await pool.query('select value from verification_sentinel')).rows[0].value, second.manifest.runId);
      await assertOwnedDatabase(childEnvironment(second.manifest), pool);
    } finally { await pool.end(); }
    second.proceed.resolve();
    assert.equal(await second.finished, null);
    const report = JSON.parse(await readFile(join(second.manifest.resultsRoot, 'e2e/report.json'), 'utf8'));
    assert.equal(report.stats.unexpected, 0);
    assert.equal(report.stats.expected, 1);
  } finally {
    await browser?.close();
    for (const run of runs) {
      run.controller.abort();
      if (run.finished) await run.finished;
      await cleanupRun(run.manifest);
    }
  }
});

test('editor CLI needs no database or Docker and stops its real browser descendants on SIGTERM', { timeout: 120_000 }, async () => {
  const sentinel = join(host.storageRoot, 'editor-must-not-touch');
  await writeFile(sentinel, 'keep');
  const child = spawn(process.execPath, ['scripts/verify.mjs', '--mode=editor'], {
    cwd: repositoryRoot,
    env: { ...process.env, DOCKER_HOST: 'unix:///no-verification-docker.sock',
      DATABASE_URL: 'postgres://unavailable:unavailable@127.0.0.1:1/no_database',
      WORKTRAIL_VERIFY_ADMIN_DATABASE_URL: 'postgres://unavailable:unavailable@127.0.0.1:1/no_database',
      WORKTRAIL_ATTACHMENT_STORAGE_PATH: host.storageRoot },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const complete = new Promise((resolve, reject) => { child.once('close', resolve); child.once('error', reject); });
  let output = '';
  let path;
  let signaled = false;
  let signaling;
  let signalingFailure;
  let timedOut = false;
  const descendants = [];
  const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 90_000);
  const signalAfterBrowser = async () => {
    const listing = await runCommand('ps', ['-axo', 'pid=,ppid=,command=']);
    const records = listing.split('\n').map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)).filter(Boolean)
      .map((match) => ({ pid: Number(match[1]), parent: Number(match[2]), command: match[3] }));
    const owned = new Set([child.pid]);
    for (let changed = true; changed;) {
      changed = false;
      for (const record of records) if (owned.has(record.parent) && !owned.has(record.pid)) { owned.add(record.pid); changed = true; }
    }
    for (const record of records.filter((item) => owned.has(item.pid) && item.pid !== child.pid)) {
      const identity = await processIdentity(record.pid);
      if (identity) descendants.push({ ...record, identity });
    }
    signaled = child.kill('SIGTERM');
  };
  child.stdout.on('data', (chunk) => {
    output += chunk;
    path ??= /Ownership manifest: ([^\n]+)/.exec(output)?.[1];
    if (!signaling && output.includes('preserves native typing undo')) signaling = signalAfterBrowser().catch((error) => { signalingFailure = error; child.kill('SIGTERM'); });
  });
  child.stderr.on('data', (chunk) => { output += chunk; });
  try {
    const code = await complete;
    await signaling;
    if (signalingFailure) throw signalingFailure;
    assert.equal(timedOut, false);
    assert.equal(signaled, true);
    assert.equal(code, 143);
    assert.ok(descendants.some((record) => /chrome-headless-shell|headless_shell|Chromium|Chrome/.test(record.command)), 'Captured a real owned Chromium descendant');
    for (const record of descendants) assert.notEqual(await processIdentity(record.pid), record.identity, `Owned child ${record.pid} has exited`);
    assert.equal(await readFile(sentinel, 'utf8'), 'keep');
    assert.equal(await stat(path).then(() => true, () => false), false);
    assert.ok(!output.includes('database:provision'));
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await complete; }
    if (path && await stat(path).then(() => true, () => false)) await cleanupRun(await readCleanupManifest(path));
  }
});
