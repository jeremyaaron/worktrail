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
  const { manifest, env = process.env, cwd, inherit = false, signal, timeoutMs = inherit ? 300_000 : 60_000 } = options;
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
  try {
    if (!record.identity && child.pid && child.exitCode === null && child.signalCode === null) {
      stop();
      await completion;
      throw new Error('Could not record verification child identity.');
    }
    if (manifest && record.identity) { manifest.processes.push(record); await saveManifest(manifest); }
    const result = await completion;
    if (signal?.aborted) throw new Error('Verification interrupted.');
    if (timedOut) throw new Error(`Verification command timed out (${command}).`);
    if (result.code !== 0) throw new Error(`Verification command failed (${command}, exit ${result.code}).`);
    return stdout.trim();
  } finally {
    signal?.removeEventListener('abort', stop);
    clearTimeout(deadline);
    if (killTimer) clearTimeout(killTimer);
    if (record.identity) await stopOwnedProcess(record, { allowMissingLeader: true });
    if (manifest) { manifest.processes = manifest.processes.filter((item) => item.pid !== record.pid); await saveManifest(manifest); }
  }
}
