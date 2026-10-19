import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';

import { createManifest, readCleanupManifest, repositoryRoot } from './ownership.mjs';
import { processIdentity, runCommand } from './processes.mjs';
import { cleanupRun } from './resources.mjs';
import { parseWebArguments, runWebTests } from './web.mjs';
import { prepareWorkspace } from './workspace.mjs';

const spec = 'src/testing/runner-lifecycle.spec.ts';
const fixture = (name, expected = '2') => `import { afterAll, beforeAll, expect, it } from 'vitest';
const content = document.createElement('main');
beforeAll(() => { content.textContent = 'Lifecycle assertion control'; document.body.appendChild(content); });
afterAll(() => content.remove());
it('${name}', () => expect(2).toBe(${expected}));
`;
const sentinel = createServer((_request, response) => response.end('unrelated server'));
let sentinelURL;
before(async () => {
  await new Promise(resolve => sentinel.listen(0, '127.0.0.1', resolve));
  sentinelURL = `http://127.0.0.1:${sentinel.address().port}`;
});
after(() => new Promise(resolve => sentinel.close(resolve)));

async function assertClosed(manifest) {
  await assert.rejects(fetch(`http://127.0.0.1:${manifest.ports.vitest}/`, { signal: AbortSignal.timeout(5000) }));
  for (const child of manifest.processes) assert.notEqual(await processIdentity(child.pid), child.identity, `Owned child ${child.pid} exited`);
  assert.equal(await (await fetch(sentinelURL)).text(), 'unrelated server');
}

async function reportWhen(path, predicate, signal) {
  await mkdir(dirname(path), { recursive: true });
  return new Promise((resolve, reject) => {
    let reading = false;
    let changed = false;
    const finish = (error, report) => {
      watcher.close(); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(report);
    };
    const abort = () => finish(signal.reason);
    const inspect = async () => {
      changed = true;
      if (reading) return;
      reading = true;
      do {
        changed = false;
        try {
          const report = JSON.parse(await readFile(path, 'utf8'));
          if (predicate(report)) { finish(null, report); break; }
        } catch (error) {
          if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) { finish(error); break; }
        }
      } while (changed);
      reading = false;
    };
    const watcher = watch(dirname(path), () => { void inspect(); });
    watcher.on('error', finish);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else void inspect();
  });
}

test('a real failing browser spec preserves failure, report and cleanup without touching another server', { timeout: 120_000 }, async () => {
  const manifest = await createManifest('none');
  try {
    const checkout = await prepareWorkspace(manifest);
    await writeFile(join(checkout, 'apps/web', spec), fixture('intentional assertion control', '3'));
    await assert.rejects(runWebTests(manifest, checkout, {
      options: parseWebArguments([`--include=${spec}`]), signal: AbortSignal.timeout(90_000)
    }), /failed/);
    const report = JSON.parse(await readFile(join(manifest.resultsRoot, 'web/report.json'), 'utf8'));
    assert.equal(report.numFailedTests, 1);
    assert.equal(report.numPassedTests, 0);
    const artifacts = await readdir(join(manifest.resultsRoot, 'web'), { recursive: true });
    assert.ok(artifacts.some(path => path.startsWith('screenshots/') && path.endsWith('.png')), 'Retains the real failure screenshot outside the disposable checkout');
    assert.equal(manifest.processes.length, 0);
    await assertClosed(manifest);
  } finally { await cleanupRun(manifest); }
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGKILL']) {
  test(`ordinary live watch ${signal === 'SIGKILL' ? 'abandoned-run cleanup' : signal} stops owned Chromium and preserves unrelated service`, { timeout: 120_000 }, async () => {
    const outer = await createManifest('none');
    const controller = new AbortController();
    const deadline = AbortSignal.any([AbortSignal.timeout(90_000), controller.signal]);
    let child;
    let finished;
    let manifestPath;
    let manifest;
    try {
      const checkout = await prepareWorkspace(outer);
      const file = join(checkout, 'apps/web', spec);
      await writeFile(file, fixture('live revision one'));
      child = spawn(process.execPath, [join(checkout, 'scripts/test-web.mjs'), '--watch', `--include=${spec}`], {
        cwd: checkout, env: { ...process.env, DATABASE_URL: 'postgres://unavailable@127.0.0.1:1/no_database',
          WORKTRAIL_VERIFY_ADMIN_DATABASE_URL: 'postgres://unavailable@127.0.0.1:1/no_database', DOCKER_HOST: 'unix:///no-docker.sock' },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let output = '';
      finished = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, stoppedBy) => resolve({ code, stoppedBy })); });
      const owned = new Promise((resolve, reject) => {
        const abort = () => reject(deadline.reason);
        deadline.addEventListener('abort', abort, { once: true });
        child.stdout.on('data', chunk => {
          output = (output + chunk).slice(-1024 * 1024);
          const path = /Ownership manifest: ([^\n]+)/.exec(output)?.[1];
          if (path) { manifestPath = path; deadline.removeEventListener('abort', abort); resolve(path); }
        });
        child.stderr.on('data', chunk => { output = (output + chunk).slice(-1024 * 1024); });
        finished.then(() => { deadline.removeEventListener('abort', abort); reject(new Error(output)); }, reject);
      });
      await owned;
      manifest = await readCleanupManifest(manifestPath);
      const reportPath = join(manifest.resultsRoot, 'web/report.json');
      const observe = predicate => Promise.race([
        reportWhen(reportPath, predicate, deadline),
        finished.then(() => { throw new Error(`Watch exited before its report: ${output}`); })
      ]);
      await observe(report => report.numPassedTests === 1);
      if (signal === 'SIGINT') {
        await writeFile(file, fixture('live revision two'));
        await observe(report => report.testResults.some(file => file.assertionResults.some(test => test.fullName.includes('live revision two') && test.status === 'passed')));
      }
      manifest = await readCleanupManifest(manifestPath);
      assert.ok(manifest.processes.length > 1, 'Tracks real detached Chromium descendants as well as the runner');
      assert.equal(child.kill(signal), true);
      const result = await finished;
      if (signal === 'SIGKILL') {
        assert.equal(result.stoppedBy, 'SIGKILL');
        await runCommand(process.execPath, ['scripts/verify.mjs', '--cleanup', manifestPath], { cwd: repositoryRoot });
        await runCommand(process.execPath, ['scripts/verify.mjs', '--cleanup', manifestPath], { cwd: repositoryRoot });
      } else {
        assert.equal(result.code, signal === 'SIGINT' ? 130 : 143, output);
        const summary = JSON.parse(await readFile(join(manifest.resultsRoot, 'web-summary.json'), 'utf8'));
        assert.equal(summary.interactive, true); assert.equal(summary.passed, null); assert.equal(summary.cleaned, true);
      }
      assert.equal(await stat(manifest.root).then(() => true, () => false), false);
      await assertClosed(manifest);
    } finally {
      controller.abort();
      if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await finished; }
      if (manifestPath && await stat(manifestPath).then(() => true, () => false)) await cleanupRun(await readCleanupManifest(manifestPath));
      await cleanupRun(outer);
    }
  });
}
