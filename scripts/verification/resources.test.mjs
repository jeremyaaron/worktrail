import assert from 'node:assert/strict';
import { lstat, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { createManifest, databaseMarker, saveManifest } from './ownership.mjs';
import { processIdentity, runCommand, stopOwnedProcess } from './processes.mjs';
import { cleanupRun, provisionDatabase, removeServiceDatabase } from './resources.mjs';

async function fixture(t, mode = 'service') {
  const manifest = await createManifest(mode);
  t.after(() => rm(manifest.root, { recursive: true, force: true }));
  return manifest;
}

test('service mode has no implicit administrative/application fallback', async (t) => {
  const manifest = await fixture(t);
  await assert.rejects(provisionDatabase(manifest, { env: { DATABASE_URL: 'postgres://user:secret@localhost/worktrail' } }), /ADMIN_DATABASE_URL/);
  await cleanupRun(manifest);
  await cleanupRun(manifest);
});

test('partial Docker startup is cleaned only after matching both container labels', async (t) => {
  const manifest = await fixture(t, 'docker');
  const calls = [];
  const run = async (_command, args) => {
    calls.push(args);
    if (args[0] === 'start') throw new Error('Startup failed');
    if (args[0] === 'container') return manifest.containerName;
    if (args[0] === 'inspect') return JSON.stringify({ 'worktrail.verify.run': manifest.runId, 'worktrail.verify.nonce': manifest.nonce });
    return '';
  };
  await assert.rejects(provisionDatabase(manifest, { run }), /Startup failed/);
  await cleanupRun(manifest, { run });
  assert.ok(calls.some((args) => args[0] === 'rm'));
  await assert.rejects(lstat(manifest.root), { code: 'ENOENT' });
});

test('mismatched container identity never reaches docker rm', async (t) => {
  const manifest = await fixture(t, 'docker');
  manifest.containerName = `worktrail-verify-${manifest.runId}`;
  await saveManifest(manifest);
  const calls = [];
  await assert.rejects(cleanupRun(manifest, { run: async (_command, args) => {
    calls.push(args);
    return args[0] === 'container' ? manifest.containerName : '{}';
  } }), /labels/);
  assert.ok(!calls.some((args) => args[0] === 'rm'));
  assert.equal((await lstat(manifest.root)).isDirectory(), true);
});

test('service cleanup verifies marker before disabling connections, terminating sessions or dropping', async (t) => {
  const manifest = await fixture(t);
  manifest.databaseState = 'owned';
  const queries = [];
  const pool = { query: async (sql, values) => { queries.push({ sql, values }); return { rows: [{ marker: 'another run' }] }; }, end: async () => undefined };
  await assert.rejects(removeServiceDatabase(manifest, () => pool), /marker/);
  assert.equal(queries.length, 1);
  pool.query = async (sql, values) => { queries.push({ sql, values }); return { rows: [{ marker: databaseMarker(manifest) }] }; };
  await removeServiceDatabase(manifest, () => pool);
  assert.equal(queries[3].values[0], manifest.databaseName);
  assert.match(queries[4].sql, /^drop database/);
});

test('abandoned cleanup refuses a still-running owner', async (t) => {
  const manifest = await fixture(t);
  manifest.owner = { pid: process.pid, identity: await processIdentity(process.pid) };
  await saveManifest(manifest);
  await assert.rejects(cleanupRun(manifest), /owner is still running/);
});

test('command failure and interruption are bounded', async () => {
  await assert.rejects(runCommand(process.execPath, ['-e', 'process.exit(42)']), /exit 42/);
  const controller = new AbortController();
  const execution = runCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(execution, /interrupted/);
});

test('forwarded output redacts credentials split between stream chunks', async () => {
  const module = pathToFileURL(new URL('./processes.mjs', import.meta.url).pathname).href;
  const script = `import { runCommand } from ${JSON.stringify(module)};
    await runCommand(process.execPath, ['-e', "process.stdout.write('split-');setTimeout(()=>console.log('password'),25)"],
      { inherit: true, env: { ...process.env, DATABASE_URL: 'postgres://user:split-password@localhost/db' } });`;
  const output = await runCommand(process.execPath, ['--input-type=module', '-e', script]);
  assert.ok(!output.includes('split-password'));
  assert.match(output, /\[redacted\]/);
});

test('captured stderr is drained instead of blocking a child on a full pipe', async () => {
  assert.equal(await runCommand(process.execPath, ['-e', "process.stderr.write('x'.repeat(200000))"]), '');
});

test('command deadlines stop an owned child instead of hanging cleanup', async () => {
  await assert.rejects(runCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 100 }), /timed out/);
});

test('child cleanup failure does not replace the original command failure', async (t) => {
  const manifest = await fixture(t, 'none');
  const root = manifest.root;
  try {
    await assert.rejects(runCommand(process.execPath, ['-e', 'setTimeout(()=>process.exit(42),50)'], {
      manifest,
      onStarted: () => { manifest.root = join(root, 'unavailable'); }
    }), /exit 42/);
  } finally { manifest.root = root; }
});

test('interruption stops a recorded detached descendant even when it ignores TERM', async (t) => {
  const manifest = await fixture(t, 'none');
  const path = join(manifest.root, 'detached-child');
  const script = `const {spawn}=require('node:child_process');
    const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{detached:true,stdio:'ignore'});
    require('node:fs').writeFileSync(${JSON.stringify(path)},String(child.pid)); child.unref();setInterval(()=>{},1000);`;
  const controller = new AbortController();
  const execution = runCommand(process.execPath, ['-e', script], { manifest, trackDescendants: true, signal: controller.signal });
  execution.catch(() => undefined);
  let child;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      const pid = Number(await readFile(path, 'utf8').catch(() => '0'));
      if (pid && !child) child = { pid, identity: await processIdentity(pid) };
      const saved = JSON.parse(await readFile(join(manifest.root, 'manifest.json'), 'utf8'));
      if (child && saved.processes.some((record) => record.pid === child.pid)) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(child?.identity, 'Detached descendant was observed while its parent was owned');
    const saved = JSON.parse(await readFile(join(manifest.root, 'manifest.json'), 'utf8'));
    assert.ok(saved.processes.some((record) => record.pid === child.pid), 'Detached group was persisted before interruption');
    controller.abort();
    await assert.rejects(execution, /interrupted/);
    assert.equal(await processIdentity(child.pid), null);
  } finally {
    controller.abort();
    await execution.catch(() => undefined);
    if (child?.identity) await stopOwnedProcess(child);
  }
});
