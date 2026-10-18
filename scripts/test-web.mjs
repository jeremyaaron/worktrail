import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createManifest, saveManifest } from './verification/ownership.mjs';
import { processIdentity } from './verification/processes.mjs';
import { cleanupRun } from './verification/resources.mjs';
import { parseWebArguments, runWebTests } from './verification/web.mjs';
import { prepareWorkspace } from './verification/workspace.mjs';

async function main() {
  const options = parseWebArguments(process.argv.slice(2));
  if (options.help) {
    console.log('npm test --workspace @worktrail/web -- [--runner=all|karma|vitest] [--include=src/...spec.ts]\nDefault: both nonempty partitions, serially, in an owned snapshot without PostgreSQL.\nVitest only: --filter=expression. Install browsers with: npx playwright install chromium');
    return;
  }
  const controller = new AbortController();
  let interrupted;
  const sigint = () => { interrupted = 130; controller.abort(); };
  const sigterm = () => { interrupted = 143; controller.abort(); };
  process.on('SIGINT', sigint);
  process.on('SIGTERM', sigterm);
  let manifest;
  let failure;
  let cleaned = false;
  const results = [];
  try {
    manifest = await createManifest('none');
    const identity = await processIdentity(process.pid);
    if (!identity) throw new Error('Could not record web-test owner.');
    manifest.owner = { pid: process.pid, identity };
    await saveManifest(manifest);
    console.log(`Web test run ${manifest.runId}\nOwnership manifest: ${join(manifest.root, 'manifest.json')}`);
    const checkout = await prepareWorkspace(manifest);
    await runWebTests(manifest, checkout, { options, signal: controller.signal, gate: async (name, run) => {
      const result = { name, passed: false, durationMs: 0 };
      results.push(result);
      const start = Date.now();
      try { await run(); result.passed = true; }
      finally { result.durationMs = Date.now() - start; }
    } });
  } catch (error) { failure = error; }
  finally {
    if (manifest) {
      try { await cleanupRun(manifest, { allowOwner: true }); cleaned = true; }
      catch (error) { failure ??= error; }
      try {
        await mkdir(manifest.resultsRoot, { recursive: true });
        await writeFile(join(manifest.resultsRoot, 'web-summary.json'), JSON.stringify({
          passed: !failure && !interrupted,
          cleaned, options, results, interrupted: interrupted ?? null
        }, null, 2) + '\n');
      } catch { failure ??= new Error('Could not write web-test summary.'); }
    }
    process.removeListener('SIGINT', sigint);
    process.removeListener('SIGTERM', sigterm);
  }
  if (interrupted) { process.exitCode = interrupted; return; }
  if (failure) throw failure;
  console.log('Web tests passed; owned resources removed.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
