import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { promisify } from 'node:util';

import { saveManifest } from './ownership.mjs';

const execute = promisify(execFile);
export async function processIdentity(pid) {
  try {
    const { stdout } = await execute('ps', ['-p', String(pid), '-o', 'lstart='], { timeout: 5_000 });
    return stdout.trim() ? createHash('sha256').update(stdout.trim()).digest('hex') : null;
  } catch { return null; }
}

function groupExists(pid) {
  try { process.kill(-pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

async function descendantGroups(root) {
  if (await processIdentity(root.pid) !== root.identity) return [];
  const { stdout } = await execute('ps', ['-axo', 'pid=,ppid=,pgid='], { timeout: 5_000 });
  const rows = stdout.trim().split('\n').map((line) => line.trim().split(/\s+/).map(Number));
  const owned = new Set([root.pid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const [pid, parent] of rows) if (owned.has(parent) && !owned.has(pid)) { owned.add(pid); changed = true; }
  }
  // A detached group is owned only after its leader was observed in this child's ancestry tree.
  // Never infer ownership from a browser executable name or an unrelated port.
  return rows.filter(([pid, , group]) => pid === group && pid !== root.pid && owned.has(pid)).map(([pid]) => pid);
}

export async function stopOwnedProcess(record, { allowMissingLeader = false } = {}) {
  const identity = await processIdentity(record.pid);
  if (!identity && !groupExists(record.pid)) return;
  if ((!identity && !allowMissingLeader) || (identity && identity !== record.identity)) throw new Error('Refusing cleanup: process identity cannot be verified.');
  try { process.kill(-record.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!groupExists(record.pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const latest = await processIdentity(record.pid);
  if (latest && latest !== record.identity) throw new Error('Refusing cleanup: process identity changed.');
  try { process.kill(-record.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!groupExists(record.pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Owned process group has not exited; resources retained for inspection.');
}

export async function runCommand(command, args, options = {}) {
  const { manifest, env = process.env, cwd, inherit = false, signal, timeoutMs = inherit ? 300_000 : 60_000, onStarted, trackDescendants = false } = options;
  if (signal?.aborted) throw new Error('Verification interrupted.');
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const completion = new Promise((resolve) => {
    child.once('error', () => resolve({ code: -1 }));
    child.once('close', (code) => resolve({ code: code ?? -1 }));
  });
  let stdout = '';
  const secrets = [env.DATABASE_URL, env.WORKTRAIL_VERIFY_ADMIN_DATABASE_URL, env.WORKTRAIL_VERIFY_NONCE, env.POSTGRES_PASSWORD]
    .filter(Boolean);
  for (const value of [...secrets]) {
    try { secrets.push(decodeURIComponent(new URL(value).password)); } catch { /* Non-URL nonce/password. */ }
  }
  const redact = (text) => secrets.filter(Boolean).reduce((value, secret) => value.split(secret).join('[redacted]'), text);
  child.stdout.on('data', (chunk) => { stdout = (stdout + chunk).slice(-1024 * 1024); });
  if (inherit) {
    for (const [source, target] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      const decoder = new StringDecoder('utf8');
      let pending = '';
      source.on('data', (chunk) => {
        pending += decoder.write(chunk);
        const end = pending.lastIndexOf('\n');
        if (end !== -1) { target.write(redact(pending.slice(0, end + 1))); pending = pending.slice(end + 1); }
      });
      source.on('end', () => { target.write(redact(pending + decoder.end())); });
    }
  } else child.stderr.resume();
  const record = { pid: child.pid, identity: await processIdentity(child.pid) };
  let killTimer;
  const stop = () => {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    killTimer ??= setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
    }, 5_000);
  };
  signal?.addEventListener('abort', stop, { once: true });
  let timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
  if (signal?.aborted) stop();
  let failure;
  let scanTimer;
  let scanning = Promise.resolve();
  let busy = false;
  let trackingFailure;
  const subgroups = new Map();
  try {
    if (!record.identity && child.pid && child.exitCode === null && child.signalCode === null) {
      stop();
      await completion;
      throw new Error('Could not record verification child identity.');
    }
    if (manifest && record.identity) { manifest.processes.push(record); await saveManifest(manifest); }
    onStarted?.(record);
    if (trackDescendants && record.identity) {
      const scan = async () => {
        if (busy) return;
        busy = true;
        scanning = (async () => {
          for (const pid of await descendantGroups(record)) {
            if (subgroups.has(pid)) continue;
            const identity = await processIdentity(pid);
            if (!identity) continue;
            const subgroup = { pid, identity };
            subgroups.set(pid, subgroup);
            if (manifest) { manifest.processes.push(subgroup); await saveManifest(manifest); }
          }
        })().catch(() => { trackingFailure = new Error('Could not track owned browser descendants.'); }).finally(() => { busy = false; });
        await scanning;
      };
      scanTimer = setInterval(scan, 200);
    }
    const result = await completion;
    if (signal?.aborted) throw new Error('Verification interrupted.');
    if (timedOut) throw new Error(`Verification command timed out (${command}).`);
    if (result.code !== 0) throw new Error(`Verification command failed (${command}, exit ${result.code}).`);
  } catch (error) {
    failure = error;
  } finally {
    signal?.removeEventListener('abort', stop);
    clearTimeout(deadline);
    clearInterval(scanTimer);
    await scanning;
    failure ??= trackingFailure;
    if (killTimer) clearTimeout(killTimer);
    try {
      for (const subgroup of [...subgroups.values()].reverse()) await stopOwnedProcess(subgroup, { allowMissingLeader: true });
      if (record.identity) await stopOwnedProcess(record, { allowMissingLeader: true });
      if (manifest) {
        manifest.processes = manifest.processes.filter((item) => item.pid !== record.pid && !subgroups.has(item.pid));
        await saveManifest(manifest);
      }
    } catch (cleanupError) {
      if (failure) console.error('Child cleanup failed; retaining its manifest record without replacing the command failure.');
      failure ??= cleanupError;
    }
  }
  if (failure) throw failure;
  return stdout.trim();
}
