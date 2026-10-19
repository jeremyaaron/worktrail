import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseArguments } from './verification/arguments.mjs';
import { runBrowser } from './verification/browser.mjs';
import { childEnvironment, createManifest, readCleanupManifest, saveManifest } from './verification/ownership.mjs';
import { processIdentity, runCommand } from './verification/processes.mjs';
import { planBrowserPorts } from './verification/ports.mjs';
import { cleanupRun, prepareApiDatabase, provisionDatabase } from './verification/resources.mjs';
import { verifySchemaGeneration } from './verification/schema.mjs';
import { checkSite } from './verification/site.mjs';
import { prepareWorkspace } from './verification/workspace.mjs';
import { runWebTests } from './verification/web.mjs';

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log('npm run verify [--mode=full|checks|api|web|e2e|preview|editor|site] [--database=docker|service]\nDefault: full with disposable Docker PostgreSQL 16. Checks mode verifies backend/contracts/tooling, audits, schema and API builds, without frontend/browser checks. Web/editor/site need no database. Web mode runs frontend lint/typecheck/Angular tests and production build.\nService provisioning requires WORKTRAIL_VERIFY_ADMIN_DATABASE_URL.\nAPI mode includes backend lint/typechecks. Select files: --mode=api --api-tests=server,work-item-csv-http\nBrowser options: --api-port=N --web-port=N --preview-port=N --editor-port=N\nFocused browser selection: --grep=expression. Isolated E2E shard: --mode=e2e --shard=1/3. Interactive application tests: --mode=e2e --ui\nAbandoned run: npm run verify -- --cleanup /absolute/run/manifest.json');
    return;
  }
  if (options.cleanup) {
    const abandoned = await readCleanupManifest(options.cleanup);
    if (!abandoned) { console.log('Run directory is already absent; no cleanup performed.'); return; }
    await cleanupRun(abandoned);
    console.log('Owned abandoned verification resources removed.');
    return;
  }
  const controller = new AbortController();
  let interrupted = null;
  const interrupt = (signal) => { interrupted ??= signal; controller.abort(); };
  const sigint = () => interrupt('SIGINT');
  const sigterm = () => interrupt('SIGTERM');
  process.on('SIGINT', sigint);
  process.on('SIGTERM', sigterm);
  let manifest;
  let failure;
  let cleaned = false;
  const gates = [];
  const gate = async (name, operation) => {
    console.log(`\n=== ${name} ===`);
    const start = Date.now();
    const record = { name, passed: false, durationMs: 0 };
    gates.push(record);
    try { await operation(); record.passed = options.ui && name.startsWith('browser:') ? null : true; }
    finally { record.durationMs = Date.now() - start; }
  };
  try {
    const database = ['web', 'editor', 'site'].includes(options.mode) ? 'none' : options.database;
    manifest = await createManifest(database);
    const identity = await processIdentity(process.pid);
    if (!identity) throw new Error('Could not record verification owner identity.');
    manifest.owner = { pid: process.pid, identity };
    await saveManifest(manifest);
    console.log(`Verification run ${manifest.runId}\nOwnership manifest: ${join(manifest.root, 'manifest.json')}`);
    manifest.ports = await planBrowserPorts(options.mode, options.ports);
    await saveManifest(manifest);
    const checkout = await prepareWorkspace(manifest);
    const apiTestFiles = options.apiTests?.map((name) => `tests/${name}.test.ts`) ?? [];
    for (const file of apiTestFiles) {
      if (!(await stat(join(checkout, 'apps/api', file)).catch(() => null))?.isFile()) {
        throw new Error(`API test selection does not exist: ${file}`);
      }
    }
    const npm = (args, env = childEnvironment(manifest), timeoutMs = 600_000) => runCommand('npm', args, {
      manifest, env, cwd: checkout, inherit: true, signal: controller.signal, timeoutMs, trackDescendants: true
    });
    const npmGate = (name, args, env) => gate(name, () => npm(args, env));
    if (options.mode === 'full') {
      await npmGate('audit:dependencies', ['run', 'audit:dependencies']);
      await npmGate('lint', ['run', 'lint']);
      await npmGate('typecheck', ['run', 'typecheck']);
    }
    if (options.mode === 'checks') {
      await npmGate('audit:dependencies', ['run', 'audit:dependencies']);
      await npmGate('lint:verification', ['run', 'lint:verification']);
      await npmGate('typecheck:verification', ['run', 'typecheck:verification']);
      for (const workspace of ['api', 'contracts']) {
        await npmGate(`lint:${workspace}`, ['run', 'lint', '--workspace', `@worktrail/${workspace}`]);
      }
      await npmGate('typecheck:contracts', ['run', 'typecheck', '--workspace', '@worktrail/contracts']);
    }
    if (options.mode === 'api') {
      await npmGate('lint:api', ['run', 'lint', '--workspace', '@worktrail/api']);
      await npmGate('lint:api-tests', ['exec', '--', 'eslint', 'apps/api/tests', 'apps/api/vitest.config.ts', '--max-warnings=0']);
      await npmGate('typecheck:api', ['run', 'typecheck', '--workspace', '@worktrail/api']);
    }
    if (options.mode === 'web') {
      await npmGate('lint:web', ['run', 'lint', '--workspace', '@worktrail/web']);
      await npmGate('typecheck:web', ['run', 'typecheck', '--workspace', '@worktrail/web']);
    }
    if (database !== 'none') {
      await gate('database:provision', () => provisionDatabase(manifest, { signal: controller.signal }));
      if (['full', 'checks'].includes(options.mode)) await gate('schema:generate', () => verifySchemaGeneration(checkout, () => npm(['run', 'db:generate'])));
      await gate('database:migrate', () => prepareApiDatabase(manifest, { signal: controller.signal, cwd: checkout }));
    }
    if (['api', 'full', 'checks'].includes(options.mode)) {
      await npmGate('test:resources', ['run', 'test:verification']);
      await npmGate('test:api', ['run', 'test', '--workspace', '@worktrail/api', '--', '--silent=passed-only', ...apiTestFiles]);
    }
    if (['full', 'checks'].includes(options.mode)) {
      await npmGate('test:contracts', ['run', 'test', '--workspace', '@worktrail/contracts']);
    }
    if (options.mode === 'checks') {
      for (const workspace of ['contracts', 'api']) {
        await npmGate(`build:${workspace}`, ['run', 'build', '--workspace', `@worktrail/${workspace}`]);
      }
    }
    if (['full', 'web'].includes(options.mode)) {
      await gate('test:web', () => runWebTests(manifest, checkout, { signal: controller.signal, gate }));
    }
    if (['full', 'preview'].includes(options.mode)) await npmGate('build:production', ['run', 'build']);
    if (options.mode === 'web') await npmGate('build:web', ['run', 'build', '--workspace', '@worktrail/web']);
    const browser = async (kind) => {
      if (kind !== 'editor') {
        const env = { ...childEnvironment(manifest), API_PORT: String(kind === 'preview' ? manifest.ports.preview : manifest.ports.api) };
        if (options.mode === 'full') await npmGate(`database:${kind}:reset`, ['run', 'db:reset'], env);
        if (options.mode === 'full') await npmGate(`database:${kind}:migrate`, ['run', 'db:migrate'], env);
        await gate(`storage:${kind}:initialize`, () => runCommand(process.execPath, ['--import', 'tsx', 'scripts/verification/prepare-storage.mjs'], {
          manifest, env, cwd: checkout, inherit: true, signal: controller.signal
        }));
        await npmGate(`storage:${kind}:reset`, ['run', 'storage:reset'], env);
        await npmGate(`database:${kind}:seed`, ['run', 'db:seed'], env);
      }
      await runBrowser(manifest, checkout, kind, options, { signal: controller.signal, gate });
    };
    if (options.mode === 'full' || options.mode === 'editor') await browser('editor');
    if (options.mode === 'full' || options.mode === 'e2e') await browser('e2e');
    if (options.mode === 'full' || options.mode === 'preview') await browser('preview');
    if (options.mode === 'full' || options.mode === 'site') {
      await gate('site:assets-links', () => checkSite(checkout));
      await runBrowser(manifest, checkout, 'site', options, { signal: controller.signal, gate });
    }
  } catch (error) { failure = error; }
  finally {
    if (manifest) {
      try { await cleanupRun(manifest, { allowOwner: true }); cleaned = true; }
      catch (error) {
        console.error('Cleanup could not safely remove every resource. Retain the private manifest and use --cleanup after resolving the cause.');
        failure ??= error;
      }
      try {
        await mkdir(manifest.resultsRoot, { recursive: true });
        await writeFile(join(manifest.resultsRoot, 'summary.json'), JSON.stringify({
          runId: manifest.runId, mode: options.mode, database: manifest.databaseMode,
          apiTests: options.apiTests, shard: options.shard,
          passed: failure || interrupted ? false : options.ui ? null : true,
          interactive: options.ui, cleaned, interrupted, gates
        }, null, 2) + '\n');
      } catch { failure ??= new Error('Could not write verification summary.'); }
    }
    process.removeListener('SIGINT', sigint);
    process.removeListener('SIGTERM', sigterm);
  }
  if (interrupted) { process.exitCode = interrupted === 'SIGINT' ? 130 : 143; return; }
  if (failure) throw failure;
  console.log(options.ui ? 'Interactive E2E session closed; owned resources removed.' :
    `${options.mode === 'api' ? 'API' : options.mode} verification passed; owned resources removed.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
