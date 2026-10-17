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
import { runCommand } from './processes.mjs';
import { cleanupRun, prepareApiDatabase, provisionDatabase } from './resources.mjs';

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
  assert.equal(result.code, 0);
  assert.match(result.output, /API verification passed/);
});
