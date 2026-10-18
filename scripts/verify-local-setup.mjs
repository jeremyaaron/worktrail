import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArguments } from './verification/arguments.mjs';
import { runBrowser } from './verification/browser.mjs';
import { childEnvironment, createManifest, saveManifest } from './verification/ownership.mjs';
import { planBrowserPorts } from './verification/ports.mjs';
import { processIdentity, runCommand } from './verification/processes.mjs';
import { cleanupRun, prepareApiDatabase, provisionDatabase } from './verification/resources.mjs';
import { prepareWorkspace } from './verification/workspace.mjs';

const path = process.argv[2];
if (process.argv.length !== 3 || !['development', 'preview'].includes(path)) {
  throw new Error('Use npm run verify:setup -- development|preview. Each path installs into fresh owned resources.');
}
const controller = new AbortController();
let interrupted;
const interrupt = signal => { interrupted ??= signal; controller.abort(); };
const onInt = () => interrupt('SIGINT');
const onTerm = () => interrupt('SIGTERM');
process.on('SIGINT', onInt);
process.on('SIGTERM', onTerm);
const manifest = await createManifest('docker');
const gates = [];
let failure;
let cleaned = false;
const gate = async (name, operation) => {
  console.log(`\n=== ${name} ===`);
  const record = { name, passed: false };
  gates.push(record);
  await operation();
  record.passed = true;
};
console.log(`Fresh ${path} setup ${manifest.runId}\nOwnership manifest: ${join(manifest.root, 'manifest.json')}`);
try {
  const identity = await processIdentity(process.pid);
  if (!identity) throw new Error('Could not record setup verification owner identity.');
  manifest.owner = { pid: process.pid, identity };
  await saveManifest(manifest);
  const kind = path === 'development' ? 'e2e' : 'preview';
  const options = parseArguments([`--mode=${kind}`, '--grep=independent local setup']);
  manifest.ports = await planBrowserPorts(kind, {}, {});
  await saveManifest(manifest);
  const checkout = await prepareWorkspace(manifest, { linkInstalledDependencies: false });
  const npm = args => runCommand('npm', args, {
    manifest, cwd: checkout, env: childEnvironment(manifest), inherit: true,
    signal: controller.signal, timeoutMs: 600_000, trackDescendants: true
  });
  await gate('install:fresh-lockfile', () => npm(['ci']));
  await gate('database:fresh-owned', () => provisionDatabase(manifest, { signal: controller.signal }));
  await gate('database:migrate', () => prepareApiDatabase(manifest, { cwd: checkout, signal: controller.signal }));
  // One absolute owned attachment root is established before seed and reused by runtime.
  await gate('database:seed', () => npm(['run', 'db:seed']));
  if (kind === 'preview') await gate('build:production', () => npm(['run', 'build']));
  await runBrowser(manifest, checkout, kind, options, { gate, signal: controller.signal, portEnvironment: {} });
} catch (error) { failure = error; }
finally {
  try { await cleanupRun(manifest, { allowOwner: true }); cleaned = true; }
  catch (error) { failure ??= error; }
  try {
    await mkdir(manifest.resultsRoot, { recursive: true });
    await writeFile(join(manifest.resultsRoot, 'summary.json'), JSON.stringify({
      runId: manifest.runId, mode: `setup:${path}`, passed: !failure && !interrupted,
      cleaned, interrupted: interrupted ?? null, gates
    }, null, 2) + '\n');
  } catch (error) { failure ??= error; }
  process.removeListener('SIGINT', onInt);
  process.removeListener('SIGTERM', onTerm);
}
if (failure) console.error(failure.message);
process.exitCode = interrupted ? (interrupted === 'SIGINT' ? 130 : 143) : failure ? 1 : 0;
