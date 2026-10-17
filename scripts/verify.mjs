import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseArguments } from './verification/arguments.mjs';
import {
  assertOwnedDatabase, childEnvironment, createManifest, readCleanupManifest, repositoryRoot, saveManifest
} from './verification/ownership.mjs';
import { processIdentity, runCommand } from './verification/processes.mjs';
import { cleanupRun, prepareApiDatabase, provisionDatabase } from './verification/resources.mjs';

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log('Phase 1: npm run verify -- --mode=api [--database=docker|service]\nService provisioning requires WORKTRAIL_VERIFY_ADMIN_DATABASE_URL.\nAbandoned run: npm run verify -- --cleanup /absolute/run/manifest.json\nOther verification modes arrive in Phase 2.');
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
  try {
    manifest = await createManifest(options.database);
    const identity = await processIdentity(process.pid);
    if (!identity) throw new Error('Could not record verification owner identity.');
    manifest.owner = { pid: process.pid, identity };
    await saveManifest(manifest);
    console.log(`Verification run ${manifest.runId}\nOwnership manifest: ${join(manifest.root, 'manifest.json')}`);
    await provisionDatabase(manifest, { signal: controller.signal });
    await assertOwnedDatabase(childEnvironment(manifest));
    await prepareApiDatabase(manifest, { signal: controller.signal });
    const env = childEnvironment(manifest);
    await runCommand('npm', ['run', 'test:verification'], {
      manifest, env, cwd: repositoryRoot, inherit: true, signal: controller.signal
    });
    await runCommand('npm', ['run', 'test', '--workspace', '@worktrail/api'], {
      manifest, env, cwd: repositoryRoot, inherit: true, signal: controller.signal
    });
  } catch (error) { failure = error; }
  finally {
    if (manifest) {
      try { await cleanupRun(manifest, { allowOwner: true }); cleaned = true; }
      catch (error) {
        console.error('Cleanup could not safely remove every resource. Retain the private manifest and use --cleanup after resolving the cause.');
        failure ??= error;
      }
      try {
        const output = join(repositoryRoot, 'test-results', 'verification', manifest.runId);
        await mkdir(output, { recursive: true });
        await writeFile(join(output, 'summary.json'), JSON.stringify({
          runId: manifest.runId, mode: options.mode, database: options.database,
          passed: !failure && !interrupted, cleaned, interrupted
        }, null, 2) + '\n');
      } catch {
        failure ??= new Error('Could not write verification summary.');
      }
    }
    process.removeListener('SIGINT', sigint);
    process.removeListener('SIGTERM', sigterm);
  }
  if (interrupted) { process.exitCode = interrupted === 'SIGINT' ? 130 : 143; return; }
  if (failure) throw failure;
  console.log('API verification passed; owned resources removed.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
