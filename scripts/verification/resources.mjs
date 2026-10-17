import { randomBytes } from 'node:crypto';
import { lstat, open, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import {
  childEnvironment, createVerificationPool, databaseMarker, parseDatabaseUrl,
  readManifest, removeRunDirectory, saveManifest
} from './ownership.mjs';
import { processIdentity, runCommand, stopOwnedProcess } from './processes.mjs';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { escapeIdentifier, escapeLiteral } = require('pg');
const runLabel = 'worktrail.verify.run';
const nonceLabel = 'worktrail.verify.nonce';

function checkInterrupted(signal) {
  if (signal?.aborted) throw new Error('Verification interrupted.');
}

async function waitForDatabase(pool, signal) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    checkInterrupted(signal);
    try { await pool.query('select 1'); return; } catch { /* PostgreSQL may still be initializing. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Disposable PostgreSQL did not become ready within 60 seconds.');
}

export async function provisionDatabase(manifest, { signal, env = process.env, run = runCommand } = {}) {
  if (manifest.databaseMode === 'service') {
    if (!env.WORKTRAIL_VERIFY_ADMIN_DATABASE_URL) throw new Error('Service mode requires WORKTRAIL_VERIFY_ADMIN_DATABASE_URL for provisioning a new database.');
    const admin = parseDatabaseUrl(env.WORKTRAIL_VERIFY_ADMIN_DATABASE_URL);
    if (!admin.pathname || admin.pathname === '/') throw new Error('Service mode requires an explicit administrative database name.');
    manifest.adminUrl = admin.toString();
    admin.pathname = `/${manifest.databaseName}`;
    manifest.databaseUrl = admin.toString();
    manifest.databaseState = 'pending';
    await saveManifest(manifest);
    const pool = createVerificationPool(manifest.adminUrl);
    try {
      checkInterrupted(signal);
      try { await pool.query(`create database ${escapeIdentifier(manifest.databaseName)}`); }
      catch (error) {
        if (['42P04', '42501'].includes(error.code)) { manifest.databaseState = 'none'; await saveManifest(manifest); }
        throw new Error('Could not provision a new verification database. Check service-mode CREATE DATABASE privileges.');
      }
      // Finish establishing the marker before honoring an interruption of provisioning.
      await pool.query(`comment on database ${escapeIdentifier(manifest.databaseName)} is ${escapeLiteral(databaseMarker(manifest))}`);
      manifest.databaseState = 'owned';
      await saveManifest(manifest);
    } finally { await pool.end(); }
    checkInterrupted(signal);
    return;
  }

  try { await run('docker', ['info', '--format', '{{.ServerVersion}}'], { signal, manifest }); }
  catch { throw new Error('Docker is unavailable. Start Docker Desktop or explicitly use --database=service. Working data was not used.'); }
  manifest.containerName = `worktrail-verify-${manifest.runId}`;
  manifest.databaseState = 'pending';
  await saveManifest(manifest);
  const password = randomBytes(32).toString('hex');
  const dockerEnvironment = {
    ...env, POSTGRES_DB: manifest.databaseName, POSTGRES_USER: 'worktrail_verify', POSTGRES_PASSWORD: password
  };
  await run('docker', ['create', '--name', manifest.containerName,
    '--label', `${runLabel}=${manifest.runId}`, '--label', `${nonceLabel}=${manifest.nonce}`,
    '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_DB', '--env', 'POSTGRES_USER', '--env', 'POSTGRES_PASSWORD',
    'postgres:16-alpine'], { signal, manifest, env: dockerEnvironment });
  await run('docker', ['start', manifest.containerName], { signal, manifest });
  const ports = JSON.parse(await run('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', manifest.containerName], { signal, manifest }));
  const port = ports['5432/tcp']?.find((item) => item.HostIp === '127.0.0.1')?.HostPort;
  if (!/^\d+$/.test(port ?? '')) throw new Error('Disposable PostgreSQL has no owned loopback port.');
  manifest.databaseUrl = `postgres://worktrail_verify:${password}@127.0.0.1:${port}/${manifest.databaseName}`;
  await saveManifest(manifest);
  const pool = createVerificationPool(manifest.databaseUrl);
  try {
    await waitForDatabase(pool, signal);
    await pool.query(`comment on database ${escapeIdentifier(manifest.databaseName)} is ${escapeLiteral(databaseMarker(manifest))}`);
    manifest.databaseState = 'owned';
    await saveManifest(manifest);
  } finally { await pool.end(); }
  checkInterrupted(signal);
}

export async function removeServiceDatabase(manifest, poolFactory = createVerificationPool) {
  if (['none', 'removed'].includes(manifest.databaseState)) return;
  const pool = poolFactory(manifest.adminUrl);
  try {
    const result = await pool.query(`select oid, shobj_description(oid, 'pg_database') as marker
      from pg_database where datname = $1`, [manifest.databaseName]);
    if (result.rows.length) {
      if (result.rows[0].marker !== databaseMarker(manifest)) throw new Error('Refusing cleanup: service database marker does not match. Resources retained for inspection.');
      await pool.query(`alter database ${escapeIdentifier(manifest.databaseName)} allow_connections false`);
      await pool.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()', [manifest.databaseName]);
      await pool.query(`drop database ${escapeIdentifier(manifest.databaseName)}`);
    }
    manifest.databaseState = 'removed';
    await saveManifest(manifest);
  } finally { await pool.end(); }
}

export async function cleanupRun(manifest, { allowOwner = false, run = runCommand } = {}) {
  if (!await lstat(manifest.root).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  })) return;
  manifest = await readManifest(join(manifest.root, 'manifest.json'), manifest.nonce);
  if (manifest.owner && !(allowOwner && manifest.owner.pid === process.pid)) {
    if (await processIdentity(manifest.owner.pid) === manifest.owner.identity) throw new Error('Refusing cleanup: verification owner is still running.');
  }
  const lock = await open(join(manifest.root, '.cleanup-lock'), 'wx', 0o600).catch(() => {
    throw new Error('Refusing cleanup: another cleanup is already in progress.');
  });
  await lock.close();
  try {
    for (const record of manifest.processes) await stopOwnedProcess(record);
    manifest.processes = [];
    await saveManifest(manifest);
    if (manifest.databaseMode === 'service') await removeServiceDatabase(manifest);
    else if (manifest.databaseMode === 'docker' && manifest.containerName) {
      const existing = await run('docker', ['container', 'ls', '--all', '--filter', `name=^/${manifest.containerName}$`, '--format', '{{.Names}}']);
      if (existing) {
        const labels = JSON.parse(await run('docker', ['inspect', '--format', '{{json .Config.Labels}}', manifest.containerName]));
        if (labels?.[runLabel] !== manifest.runId || labels?.[nonceLabel] !== manifest.nonce) throw new Error('Refusing cleanup: container ownership labels do not match.');
        await run('docker', ['rm', '--force', '--volumes', manifest.containerName]);
      }
    }
    await removeRunDirectory(manifest);
  } catch (error) {
    await unlink(join(manifest.root, '.cleanup-lock')).catch(() => undefined);
    throw error;
  }
}

export async function prepareApiDatabase(manifest, { signal, cwd = new URL('../../', import.meta.url) } = {}) {
  const env = childEnvironment(manifest);
  await runCommand('npm', ['run', 'db:migrate'], { manifest, env, cwd, inherit: true, signal });
  manifest.prepared = true;
  await saveManifest(manifest);
}
