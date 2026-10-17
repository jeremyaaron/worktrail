import { randomBytes, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, open, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { Pool } = require('pg');
export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const markerFile = '.worktrail-verification';

export function databaseMarker(manifest) {
  return `worktrail-verification:v1:${manifest.runId}:${manifest.nonce}`;
}

export function parseDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.hash) throw new Error();
    for (const key of url.searchParams.keys()) {
      if (key !== 'sslmode') throw new Error();
    }
    if (url.searchParams.has('sslmode') && !['disable', 'require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))) throw new Error();
    return url;
  } catch {
    throw new Error('Verification requires an explicit PostgreSQL URL without connection-target overrides.');
  }
}

export function createVerificationPool(url) {
  parseDatabaseUrl(url);
  return new Pool({ connectionString: url, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 1_000, query_timeout: 15_000, max: 2 });
}

async function readPrivateJson(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || (stats.mode & 0o077) !== 0 || stats.size > 64 * 1024) throw new Error();
    return JSON.parse(await handle.readFile('utf8'));
  } finally {
    await handle.close();
  }
}

export async function saveManifest(manifest) {
  const temporary = join(manifest.root, `manifest-${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, join(manifest.root, 'manifest.json'));
}

export async function createManifest(databaseMode) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'worktrail-verify-'));
  await chmod(root, 0o700);
  const runId = randomUUID();
  const manifest = {
    version: 1, runId, nonce: randomBytes(32).toString('hex'), root,
    databaseMode, databaseName: `worktrail_verify_${runId.replaceAll('-', '')}`,
    databaseUrl: null, adminUrl: null, databaseState: 'none', containerName: null,
    processes: [], owner: null, prepared: false,
    storageRoot: join(root, 'attachments')
  };
  try {
    await writeFile(join(root, markerFile), databaseMarker(manifest), { mode: 0o600, flag: 'wx' });
    await mkdir(manifest.storageRoot, { mode: 0o700 });
    await saveManifest(manifest);
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  return manifest;
}

export async function readManifest(path, nonce) {
  try {
    if (!path || !nonce) throw new Error();
    const absolute = resolve(path);
    const root = dirname(absolute);
    const stats = await lstat(root);
    if (!stats.isDirectory() || stats.isSymbolicLink() || (stats.mode & 0o077) !== 0) throw new Error();
    if (basename(absolute) !== 'manifest.json' || !basename(root).startsWith('worktrail-verify-')) throw new Error();
    if (await realpath(root) !== root || dirname(root) !== await realpath(tmpdir())) throw new Error();
    const manifest = await readPrivateJson(absolute);
    if (manifest.version !== 1 || !uuidPattern.test(manifest.runId) || !/^[0-9a-f]{64}$/.test(manifest.nonce)) throw new Error();
    if (manifest.nonce !== nonce || manifest.root !== root || manifest.storageRoot !== join(root, 'attachments')) throw new Error();
    if (manifest.databaseName !== `worktrail_verify_${manifest.runId.replaceAll('-', '')}`) throw new Error();
    if (!['docker', 'service'].includes(manifest.databaseMode) || !['none', 'pending', 'owned', 'removed'].includes(manifest.databaseState)) throw new Error();
    if (manifest.containerName !== null && manifest.containerName !== `worktrail-verify-${manifest.runId}`) throw new Error();
    const validProcess = (item) => item && Number.isSafeInteger(item.pid) && item.pid > 1 && /^[0-9a-f]{64}$/.test(item.identity);
    if (!Array.isArray(manifest.processes) || manifest.processes.some((item) => !validProcess(item))) throw new Error();
    if (manifest.owner !== null && !validProcess(manifest.owner)) throw new Error();
    if (typeof manifest.prepared !== 'boolean') throw new Error();
    const marker = await open(join(root, markerFile), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if (await marker.readFile('utf8') !== databaseMarker(manifest)) throw new Error();
    } finally { await marker.close(); }
    const storage = await lstat(manifest.storageRoot).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (storage && (!storage.isDirectory() || storage.isSymbolicLink() || await realpath(manifest.storageRoot) !== manifest.storageRoot)) throw new Error();
    if (manifest.databaseUrl && decodeURIComponent(parseDatabaseUrl(manifest.databaseUrl).pathname.slice(1)) !== manifest.databaseName) throw new Error();
    if (manifest.adminUrl && decodeURIComponent(parseDatabaseUrl(manifest.adminUrl).pathname.slice(1)) === manifest.databaseName) throw new Error();
    return manifest;
  } catch {
    throw new Error('Refusing verification: missing or invalid run ownership. Use npm run verify -- --mode=api.');
  }
}

export async function readEnvironmentManifest(env = process.env) {
  const manifest = await readManifest(env.WORKTRAIL_VERIFY_MANIFEST, env.WORKTRAIL_VERIFY_NONCE);
  if (!manifest.databaseUrl || env.DATABASE_URL !== manifest.databaseUrl || env.WORKTRAIL_ATTACHMENT_STORAGE_PATH !== manifest.storageRoot) {
    throw new Error('Refusing verification: database or attachment target differs from the owned run.');
  }
  return manifest;
}

export async function assertOwnedDatabase(env = process.env, queryable) {
  const manifest = await readEnvironmentManifest(env);
  if (manifest.databaseState !== 'owned') throw new Error('Refusing verification: database ownership is not established.');
  const connection = queryable ?? createVerificationPool(manifest.databaseUrl);
  try {
    const result = await connection.query(`select current_database() as database_name,
      shobj_description(oid, 'pg_database') as marker from pg_database where datname = current_database()`);
    const row = result.rows[0];
    if (row?.database_name !== manifest.databaseName || row.marker !== databaseMarker(manifest)) {
      throw new Error('Refusing verification: live database identity or ownership marker does not match.');
    }
    return manifest;
  } finally {
    if (!queryable) await connection.end();
  }
}

export function childEnvironment(manifest) {
  return {
    ...process.env, NODE_ENV: 'test', DATABASE_URL: manifest.databaseUrl,
    WORKTRAIL_VERIFY_MANIFEST: join(manifest.root, 'manifest.json'),
    WORKTRAIL_VERIFY_NONCE: manifest.nonce,
    WORKTRAIL_ATTACHMENT_STORAGE_PATH: manifest.storageRoot
  };
}

export async function removeRunDirectory(manifest) {
  await readManifest(join(manifest.root, 'manifest.json'), manifest.nonce);
  await rm(manifest.root, { recursive: true });
}

export async function readCleanupManifest(path) {
  let value;
  try { value = await readPrivateJson(resolve(path)); }
  catch (error) {
    const absolute = resolve(path);
    const root = dirname(absolute);
    if (error.code === 'ENOENT' && basename(absolute) === 'manifest.json' &&
        basename(root).startsWith('worktrail-verify-') && dirname(root) === await realpath(tmpdir()) &&
        !await lstat(root).catch((failure) => { if (failure.code === 'ENOENT') return null; throw failure; })) return null;
    throw new Error('Refusing cleanup: invalid private manifest.');
  }
  return readManifest(path, value.nonce);
}
