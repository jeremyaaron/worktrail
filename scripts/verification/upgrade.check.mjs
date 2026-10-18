import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { createManifest, readCleanupManifest, repositoryRoot } from './ownership.mjs';
import { cleanupRun } from './resources.mjs';
import { runCommand } from './processes.mjs';

async function runCli({ signal, failInstall = false }) {
  const fixture = await createManifest('none');
  const env = { ...process.env };
  let child, completion, output = '', timedOut = false, signaled = false;
  const paths = new Set();
  let timer;
  try {
    if (failInstall) {
      const bin = join(fixture.root, 'bin');
      await mkdir(bin);
      env.WORKTRAIL_LIFECYCLE_NPM = join(dirname(process.execPath), 'npm');
      await writeFile(join(bin, 'npm'), [
        '#!/bin/sh',
        'if [ "$1" = ci ] && [ ! -f apps/api/drizzle/meta/_journal.json ]; then exit 42; fi',
        'exec "$WORKTRAIL_LIFECYCLE_NPM" "$@"',
        ''
      ].join('\n'), { mode: 0o700 });
      env.PATH = `${bin}:${env.PATH}`;
    }
    child = spawn(process.execPath, ['scripts/verify-upgrade.mjs'], {
      cwd: repositoryRoot, env, stdio: ['ignore', 'pipe', 'pipe']
    });
    completion = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => resolve(code));
    });
    const collect = chunk => {
      output += chunk;
      for (const match of output.matchAll(/Owned (?:none|docker|service) resource: ([^\n]+)/g)) paths.add(match[1]);
      if (signal && !signaled && output.includes('=== baseline:independent-install ===')) {
        signaled = true;
        child.kill(signal);
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 90_000);
    const code = await completion;
    assert.equal(timedOut, false, 'Upgrade CLI lifecycle deadline exceeded.');
    const summaryPath = /Retained upgrade summary: ([^\n]+)/.exec(output)?.[1];
    assert.ok(summaryPath, output);
    const summary = JSON.parse(await readFile(summaryPath));
    assert.equal(summary.passed, false);
    assert.ok(paths.size > 0);
    assert.equal(summary.cleanup.length, paths.size);
    assert.ok(summary.cleanup.every(row => row.removed));
    if (failInstall) {
      assert.equal(paths.size, 3, 'Failure must occur after both owned databases are provisioned.');
      assert.ok(summary.gates.find(row => row.name === 'database:separate-upgrade-target')?.passed);
      const container = await runCommand('docker', ['container', 'ls', '--all',
        '--filter', `label=worktrail.verify.run=${summary.cleanup[1].runId}`, '--format', '{{.Names}}']);
      assert.equal(container, '', 'Failed upgrade left its database container behind.');
    }
    for (const path of paths) assert.equal(await stat(path).then(() => true, () => false), false);
    return { code, summaryPath, signaled, output };
  } finally {
    clearTimeout(timer);
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    if (completion) await completion;
    for (const path of paths) {
      const manifest = await readCleanupManifest(path);
      if (manifest) await cleanupRun(manifest);
    }
    await cleanupRun(fixture);
  }
}

test('upgrade CLI preserves a child failure after provisioning and removes databases/installations', async () => {
  const result = await runCli({ failInstall: true });
  assert.equal(result.code, 1);
  assert.match(result.output, /exit 42/);
  console.log(`Expected child failure evidence: ${result.summaryPath}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`upgrade CLI cleans an installation interrupted by ${signal}`, async () => {
    const result = await runCli({ signal });
    assert.equal(result.signaled, true);
    assert.equal(result.code, signal === 'SIGINT' ? 130 : 143);
    console.log(`Expected interruption evidence: ${result.summaryPath}`);
  });
}
