import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import { parseArguments } from './arguments.mjs';
import { readBrowserContext } from './browser-context.mjs';
import { launchServer, runBrowser, waitForReadiness } from './browser.mjs';
import { childEnvironment, createManifest, saveManifest } from './ownership.mjs';
import { planBrowserPorts, requestedPort, selectPort } from './ports.mjs';
import { cleanupRun } from './resources.mjs';
import { checkSite } from './site.mjs';
import { prepareWorkspace } from './workspace.mjs';

test('explicit occupied ports fail without stopping their occupants', async (t) => {
  const server = createServer((_request, response) => response.end('unrelated'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  await assert.rejects(selectPort(port), /occupant was not stopped/);
  assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'unrelated');
  assert.equal(requestedPort(String(port)), port);
  for (const value of ['0', '-1', '65536', '3x']) assert.throws(() => requestedPort(value));
});

test('readiness refuses a healthy unrelated server and notices child exit', async (t) => {
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ runId: 'unrelated', token: 'wrong' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const child = { state: { record: {} }, assertRunning: async () => undefined };
  await assert.rejects(waitForReadiness(child, url, { runId: 'ours', token: 'ours' }), /identity mismatch/);
  child.assertRunning = async () => { throw new Error('child exited'); };
  await assert.rejects(waitForReadiness(child, url, {}), /child exited/);
});

test('fixture and runtime environments share planned ports without provisioning editor/site data', async () => {
  const manifest = await createManifest('none');
  try {
    manifest.ports = await planBrowserPorts('full', {}, {});
    await saveManifest(manifest);
    const env = childEnvironment(manifest);
    assert.equal(env.API_PORT, String(manifest.ports.api));
    assert.equal(env.WORKTRAIL_E2E_WEB_PORT, String(manifest.ports.web));
    assert.equal(env.WORKTRAIL_EDITOR_TEST_PORT, String(manifest.ports.editor));
    assert.equal(env.WORKTRAIL_PREVIEW_PORT, String(manifest.ports.preview));
    assert.equal(env.WORKTRAIL_ATTACHMENT_STORAGE_PATH, manifest.storageRoot);
    assert.notEqual(manifest.ports.api, manifest.ports.web);
    assert.deepEqual(await planBrowserPorts('site', {}, {}), {});
    assert.deepEqual(await planBrowserPorts('api', {}, {}), {});
    await assert.rejects(planBrowserPorts('e2e', { api: manifest.ports.api, web: manifest.ports.api }, {}), /distinct/);
  } finally { await cleanupRun(manifest); }
});

test('private workspace isolates contracts, build/cache outputs, and browser artifacts without a database', async () => {
  const manifest = await createManifest('none');
  try {
    const checkout = await prepareWorkspace(manifest);
    assert.equal(await realpath(join(checkout, 'node_modules/@worktrail/contracts')), join(checkout, 'packages/contracts'));
    assert.equal(await stat(join(checkout, 'apps/web/dist')).then(() => true, () => false), false);
    assert.equal(await stat(join(checkout, 'packages/contracts/dist')).then(() => true, () => false), false);
    assert.equal(JSON.parse(await readFile(join(checkout, 'apps/web/angular.json'), 'utf8')).cli.cache.enabled, false);
    assert.equal(childEnvironment(manifest).DATABASE_URL, undefined);
    assert.equal(childEnvironment(manifest).WORKTRAIL_VERIFY_ADMIN_DATABASE_URL, undefined);
    manifest.browser = { kind: 'editor', checkout, port: 4317, baseURL: 'http://127.0.0.1:4317', token: 'a'.repeat(64) };
    await saveManifest(manifest);
    const env = { ...childEnvironment(manifest), WORKTRAIL_VERIFY_STAGE: 'editor', WORKTRAIL_EDITOR_TEST_PORT: '4317' };
    const context = await readBrowserContext('editor', env);
    assert.equal(context.outputDir, join(manifest.resultsRoot, 'editor'));
    await assert.rejects(readBrowserContext('e2e', env), /matching owned/);
    await assert.rejects(readBrowserContext('editor', { ...env, WORKTRAIL_VERIFY_NONCE: '0'.repeat(64) }), /ownership/);
    await assert.rejects(readBrowserContext('editor', { ...env, WORKTRAIL_EDITOR_TEST_PORT: undefined }), /HTTP target fallback/);
    await checkSite(checkout);
    const html = join(checkout, 'site/index.html');
    await writeFile(html, '<img alt="proof" src="missing.png"><a href="#missing">Missing</a>');
    await assert.rejects(checkSite(checkout));
    assert.equal(parseArguments(['--mode=editor']).mode, 'editor');
  } finally { await cleanupRun(manifest); }
});

test('owned long-running child is recorded and fully stopped before directory cleanup', async () => {
  const manifest = await createManifest('none');
  const port = await selectPort();
  const script = `require('node:http').createServer((q,s)=>{s.setHeader('Content-Type','application/json');s.end(JSON.stringify({runId:'ours',token:'ours'}))}).listen(${port},'127.0.0.1')`;
  const server = launchServer(process.execPath, ['-e', script], { manifest, env: childEnvironment(manifest), cwd: manifest.root });
  try {
    await waitForReadiness(server, `http://127.0.0.1:${port}`, { runId: 'ours', token: 'ours' }, { timeoutMs: 10_000 });
    const recorded = JSON.parse(await readFile(join(manifest.root, 'manifest.json'), 'utf8'));
    assert.ok(recorded.processes.some((record) => record.pid === server.state.record.pid));
  } finally { await server.stop(); await cleanupRun(manifest); }
  assert.equal(await selectPort(port), port);
});

test('automatic port handoff collisions retry startup, but browser failures never retry tests', async (t) => {
  const occupant = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ runId: 'unrelated', token: 'unrelated' }));
  });
  await new Promise((resolve) => occupant.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => occupant.close(resolve)));
  const port = occupant.address().port;
  for (const fail of [false, true]) {
    const manifest = await createManifest('none');
    const checkout = join(manifest.root, 'checkout');
    await mkdir(checkout);
    let allocations = 0;
    let tests = 0;
    const execution = runBrowser(manifest, checkout, 'editor', parseArguments(['--mode=editor']), {
      portEnvironment: {},
      allocatePort: () => ++allocations === 1 ? port : selectPort(),
      startServer: (_command, _args, options) => {
        const identity = { runId: manifest.runId, token: manifest.browser.token };
        const script = `const server=require('node:http').createServer((q,s)=>{s.setHeader('Content-Type','application/json');s.end(${JSON.stringify(JSON.stringify(identity))})});server.on('error',()=>process.exit(2));server.listen(${manifest.browser.port},'127.0.0.1')`;
        const server = launchServer(process.execPath, ['-e', script], options);
        if (fail && allocations > 1) return { ...server, stop: async () => { await server.stop(); throw new Error('secondary cleanup failure'); } };
        return server;
      },
      gate: async () => { tests++; if (fail) throw new Error('primary browser failure'); }
    });
    try {
      if (fail) await assert.rejects(execution, /primary browser failure/);
      else await execution;
      assert.equal(allocations, 2);
      assert.equal(tests, 1);
      assert.equal(await selectPort(manifest.browser.port), manifest.browser.port);
      assert.equal((await (await fetch(`http://127.0.0.1:${port}`)).json()).runId, 'unrelated');
    } finally { await cleanupRun(manifest); }
  }
});
