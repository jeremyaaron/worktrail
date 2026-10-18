import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { childEnvironment, saveManifest } from './ownership.mjs';
import { processIdentity, runCommand } from './processes.mjs';
import { browserPortRequest, selectPort } from './ports.mjs';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function launchServer(command, args, { manifest, env, cwd, signal }) {
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const state = { record: null, exited: false, error: null };
  const finished = runCommand(command, args, {
    manifest, env, cwd, signal: combined, inherit: true, timeoutMs: 12 * 60 * 60 * 1000,
    onStarted: (record) => { state.record = record; }
  }).then(() => { state.exited = true; }, (error) => { state.exited = true; state.error = error; });
  return {
    state,
    async stop() {
      controller.abort();
      await finished;
      if (state.record && manifest.processes.some((record) => record.pid === state.record.pid)) {
        throw new Error('Owned server cleanup is incomplete; resources retained for inspection.');
      }
    },
    async assertRunning() {
      if (state.exited) throw state.error ?? new Error('Owned verification server exited.');
      if (state.record && await processIdentity(state.record.pid) !== state.record.identity) throw new Error('Owned verification server identity changed.');
    }
  };
}

export async function waitForReadiness(server, url, expected, { signal, timeoutMs = 180_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    await server.assertRunning();
    if (server.state.record) {
      let response;
      try { response = await fetch(url, { signal: AbortSignal.timeout(1500), cache: 'no-store' }); }
      catch { /* A started child is not necessarily listening yet. */ }
      if (response?.ok) {
        const identity = await response.json().catch(() => null);
        if (identity?.runId !== expected.runId || identity?.token !== expected.token) throw new Error('Readiness identity mismatch; refusing to reuse the port occupant.');
        await server.assertRunning();
        return;
      }
    }
    await delay(200);
  }
  throw new Error('Owned verification server did not become ready before its deadline.');
}

export async function runBrowser(manifest, checkout, kind, options, { signal, gate, allocatePort = selectPort, startServer = launchServer, portEnvironment = process.env } = {}) {
  const desired = (name) => browserPortRequest(name, options.ports, portEnvironment);
  const names = kind === 'e2e' ? ['api', 'web'] : [kind];
  const explicit = names.some((name) => desired(name) !== undefined);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const servers = [];
    const ports = {};
    let started = false;
    let completed = false;
    let failure;
    let retryable = false;
    try {
      for (const name of names) {
        if (desired(name) !== undefined && Object.values(ports).includes(desired(name))) throw new Error('Requested verification ports must be distinct.');
        const candidate = desired(name) ?? (attempt === 0 ? manifest.ports?.[name] : undefined);
        ports[name] = candidate ?? 0;
        do { ports[name] = await allocatePort(candidate); }
        while (Object.entries(ports).some(([other, value]) => other !== name && value === ports[name]));
      }
      const port = ports[kind === 'e2e' ? 'web' : kind];
      const token = randomBytes(32).toString('hex');
      manifest.browser = { kind, checkout, port, apiPort: ports.api, token, baseURL: `http://127.0.0.1:${port}` };
      manifest.ports = { ...manifest.ports, ...ports };
      await saveManifest(manifest);
      const env = {
        ...childEnvironment(manifest), WORKTRAIL_VERIFY_STAGE: kind,
        API_PORT: String(ports.api ?? port), WORKTRAIL_E2E_HOST: '127.0.0.1',
        WORKTRAIL_E2E_WEB_PORT: String(port), WORKTRAIL_E2E_BASE_URL: manifest.browser.baseURL,
        WORKTRAIL_EDITOR_TEST_PORT: String(port),
        TSX_TSCONFIG_PATH: join(checkout, 'apps/api/tsconfig.json'),
        WORKTRAIL_ATTACHMENT_STORAGE_DRIVER: 'local',
        WORKTRAIL_SERVE_STATIC: kind === 'preview' ? 'true' : 'false',
        WORKTRAIL_STATIC_ASSETS_PATH: join(checkout, 'apps/web/dist/worktrail-web/browser'),
        NODE_ENV: kind === 'preview' ? 'production' : 'test'
      };
      const launch = (args) => {
        const server = startServer(process.execPath, args, { manifest, env, cwd: checkout, signal });
        servers.push(server);
        return server;
      };
      if (kind === 'e2e' || kind === 'preview') {
        const server = launch([...(kind === 'e2e' ? ['--import', 'tsx'] : []), 'scripts/verification/serve-api.mjs']);
        await waitForReadiness(server, `http://127.0.0.1:${ports.api ?? port}/__worktrail_verification`, { runId: manifest.runId, token }, { signal });
        const ready = await fetch(`http://127.0.0.1:${ports.api ?? port}/api/health/ready`, { signal: AbortSignal.timeout(5000) });
        if (!ready.ok) throw new Error('Owned API failed its database readiness check.');
      }
      if (kind === 'e2e') {
        const proxy = join(manifest.root, 'proxy.json');
        await writeFile(proxy, JSON.stringify({ '/api': { target: `http://127.0.0.1:${ports.api}`, secure: false, changeOrigin: true } }), { mode: 0o600 });
        await writeFile(join(checkout, 'apps/web/public/__worktrail_verification.json'), JSON.stringify({ runId: manifest.runId, token }), { mode: 0o600 });
        const web = startServer(process.execPath, [join(checkout, 'node_modules/@angular/cli/bin/ng.js'), 'serve', '--host', '127.0.0.1', '--port', String(port), '--proxy-config', proxy], {
          manifest, env, cwd: join(checkout, 'apps/web'), signal
        });
        servers.push(web);
        await waitForReadiness(web, `${manifest.browser.baseURL}/__worktrail_verification.json`, { runId: manifest.runId, token }, { signal });
      } else if (kind === 'editor') {
        const editor = launch(['scripts/serve-authored-content-editor.mjs']);
        await waitForReadiness(editor, `${manifest.browser.baseURL}/__worktrail_verification`, { runId: manifest.runId, token }, { signal });
      } else if (kind === 'site') {
        const site = launch(['scripts/verification/serve-site.mjs']);
        await waitForReadiness(site, `${manifest.browser.baseURL}/__worktrail_verification`, { runId: manifest.runId, token }, { signal });
      }
      started = true;
      console.log(`Owned ${kind} ready on ${manifest.browser.baseURL}`);
      const config = kind === 'e2e' ? 'playwright.config.ts' : kind === 'editor' ? 'playwright.editor.config.ts' : kind === 'site' ? 'playwright.site.config.ts' : 'playwright.production.config.ts';
      await mkdir(join(manifest.resultsRoot, kind), { recursive: true });
      const args = ['node_modules/@playwright/test/cli.js', 'test', '--config', config];
      if (options.ui) args.push('--ui');
      if (options.grep !== null) args.push('--grep', options.grep);
      await gate(`browser:${kind}`, () => runCommand(process.execPath, args, {
        manifest, env, cwd: checkout, signal, inherit: true, trackDescendants: true,
        timeoutMs: options.ui ? 12 * 60 * 60 * 1000 : 30 * 60 * 1000
      }));
      for (const server of servers) await server.assertRunning();
      completed = true;
    } catch (error) {
      failure = error;
      if (!started && !explicit && !signal?.aborted && attempt < 2) {
        for (const port of Object.values(ports)) {
          try { await selectPort(port); } catch { retryable = true; }
        }
      }
    } finally {
      for (const server of servers.reverse()) {
        try { await server.stop(); }
        catch (error) {
          if (failure) console.error('Server cleanup failed without replacing the original verification failure.');
          failure ??= error;
          retryable = false;
        }
      }
    }
    if (completed && !failure) return;
    if (!retryable) throw failure;
    console.error('Owned server startup failed; retrying with newly allocated ports (no test retry).');
  }
}
