import { cp, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

import { childEnvironment, readManifest, repositoryRoot, saveManifest } from './ownership.mjs';
import { runCommand } from './processes.mjs';
import { selectPort } from './ports.mjs';

function specPath(value) {
  return typeof value === 'string' && /^src\/[a-zA-Z0-9_./-]+\.(spec|test)\.ts$/.test(value) &&
    !value.split('/').includes('..');
}

export function parseWebArguments(args) {
  const options = { include: [], filter: null, watch: false, headed: false, help: false };
  for (const argument of args) {
    if (argument === '--help') options.help = true;
    else if (argument === '--watch') options.watch = true;
    else if (argument === '--headed') options.headed = true;
    else if (argument.startsWith('--include=')) options.include.push(argument.slice(10));
    else if (argument.startsWith('--filter=')) options.filter = argument.slice(9);
    else throw new Error('Unknown web-test argument. Use --help.');
  }
  if (!options.include.every(specPath) || new Set(options.include).size !== options.include.length) {
    throw new Error('--include requires distinct literal src/...spec.ts or src/...test.ts paths.');
  }
  if (options.filter !== null) {
    if (!options.filter) throw new Error('--filter requires a nonempty expression.');
    try { new RegExp(options.filter); } catch { throw new Error('Invalid web-test filter expression.'); }
  }
  if (options.headed && !options.watch) throw new Error('--headed requires --watch; interactive debugging is not acceptance evidence.');
  return options;
}

export function selectWebTests(inventory, options = parseWebArguments([])) {
  if (!inventory.length || new Set(inventory).size !== inventory.length || !inventory.every(specPath)) {
    throw new Error('Web-test discovery is empty or invalid.');
  }
  for (const file of options.include) if (!inventory.includes(file)) throw new Error(`Requested spec is missing: ${file}`);
  return inventory.filter(file => !options.include.length || options.include.includes(file));
}

async function discover(root, prefix = 'src') {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await discover(join(root, entry.name), path));
    else if (entry.isSymbolicLink()) throw new Error('Web-test discovery refuses source symlinks.');
    else if (/\.(spec|test)\.ts$/.test(entry.name)) files.push(path);
  }
  return files.sort();
}

export async function validateWebConfiguration(checkout) {
  const root = join(checkout, 'apps/web');
  const require = createRequire(join(root, 'package.json'));
  const { readConfigFile, parseJsonConfigFileContent, sys } = require('typescript');
  const inventory = await discover(join(root, 'src'));
  selectWebTests(inventory);
  const config = readConfigFile(join(root, 'tsconfig.spec.json'), sys.readFile);
  if (config.error) throw new Error('Cannot read tsconfig.spec.json.');
  const parsed = parseJsonConfigFileContent(config.config, sys, root);
  if (parsed.errors.length) throw new Error('Invalid tsconfig.spec.json.');
  const actual = parsed.fileNames.filter(name => /\.(spec|test)\.ts$/.test(name)).map(name => relative(root, name)).sort();
  if (JSON.stringify(actual) !== JSON.stringify(inventory) || JSON.stringify(parsed.options.types ?? []) !== '[]') {
    throw new Error('tsconfig.spec.json is out of sync with discovery or enables ambient test types.');
  }
  const iconRequire = createRequire(require.resolve('@lucide/angular'));
  if (await realpath(require.resolve('@angular/core')) !== await realpath(iconRequire.resolve('@angular/core'))) {
    throw new Error('Application and icon package resolve different Angular runtimes.');
  }
  return { inventory };
}

export async function readWebTestContext(env = process.env) {
  const manifest = await readManifest(env.WORKTRAIL_VERIFY_MANIFEST, env.WORKTRAIL_VERIFY_NONCE);
  const port = manifest.ports?.vitest;
  if (!Number.isInteger(port) || port < 1 || port > 65535 || String(port) !== env.WORKTRAIL_VERIFY_VITEST_PORT) {
    throw new Error('Vitest requires an assigned owned port.');
  }
  const context = manifest.web;
  if (!context || typeof context.watch !== 'boolean' ||
      (context.checkout !== join(manifest.root, 'checkout') &&
       !(context.watch && context.checkout === await realpath(repositoryRoot)))) {
    throw new Error('Vitest requires an owned source context.');
  }
  return {
    port, cacheDir: join(manifest.root, 'vitest-cache'), reportPath: join(manifest.resultsRoot, 'web/report.json'),
    screenshotDirectory: context.watch ? join(manifest.resultsRoot, 'web/screenshots')
      : join(context.checkout, 'apps/web/.vitest-screenshots')
  };
}

export function validateWebReport(report, root, files, options) {
  if (!report.success || !Number.isSafeInteger(report.numPassedTests) || report.numPassedTests < 1 ||
      report.numFailedTests !== 0 || !Array.isArray(report.testResults)) {
    throw new Error('Vitest selection did not complete successfully with passing tests. Check the file/name selection.');
  }
  const observed = report.testResults.map(file => relative(root, file.name)).sort();
  if (JSON.stringify(observed) !== JSON.stringify([...files].sort())) throw new Error('Vitest report does not cover the selected files.');
  if (options.filter === null && report.testResults.some(file =>
    !file.assertionResults?.length || file.assertionResults.some(test => test.status !== 'passed'))) {
    throw new Error('Vitest acceptance includes empty, skipped or incomplete specs.');
  }
  return { files: files.length, passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests };
}

export async function runWebTests(manifest, checkout, { options = parseWebArguments([]), signal, gate = async (_name, run) => run() } = {}) {
  await readManifest(join(manifest.root, 'manifest.json'), manifest.nonce);
  const source = await realpath(checkout);
  if (source !== join(manifest.root, 'checkout') && !(options.watch && source === await realpath(repositoryRoot))) {
    throw new Error('Automated web tests require their owned source snapshot.');
  }
  const { inventory } = await validateWebConfiguration(checkout);
  const files = selectWebTests(inventory, options);
  const configPath = join(manifest.root, 'tsconfig.web-run.json');
  const root = join(checkout, 'apps/web');
  await writeFile(configPath, JSON.stringify({
    extends: join(root, 'tsconfig.spec.json'),
    files: [...files, 'src/testing/providers.ts'].map(file => join(root, file)),
    include: [join(root, 'src/**/*.d.ts')], exclude: []
  }, null, 2));
  manifest.ports.vitest = await selectPort();
  manifest.web = { checkout: source, watch: options.watch };
  await saveManifest(manifest);
  const { reportPath, screenshotDirectory } = await readWebTestContext({
    WORKTRAIL_VERIFY_MANIFEST: join(manifest.root, 'manifest.json'), WORKTRAIL_VERIFY_NONCE: manifest.nonce,
    WORKTRAIL_VERIFY_VITEST_PORT: String(manifest.ports.vitest)
  });
  await mkdir(join(manifest.resultsRoot, 'web'), { recursive: true });
  const env = { ...childEnvironment(manifest), WORKTRAIL_VERIFY_VITEST_PORT: String(manifest.ports.vitest) };
  // Live watch reads the working source; CI semantics disable Angular's shared local disk cache.
  if (options.watch) env.CI = 'true';
  const args = ['run', 'ng', '--workspace', '@worktrail/web', '--', 'run', 'worktrail-web:test',
    `--watch=${options.watch}`, '--ts-config', relative(root, configPath), ...files.flatMap(file => ['--include', file])];
  if (options.filter !== null) args.push('--filter', options.filter);
  if (options.headed) args.push('--headless=false');
  let result;
  let failure;
  try {
    await gate('test:web:vitest', async () => {
      await runCommand('npm', args, {
        manifest, env, cwd: checkout, inherit: true, signal,
        timeoutMs: options.watch ? 12 * 60 * 60 * 1000 : 600_000, trackDescendants: true
      });
      if (!options.watch) result = validateWebReport(JSON.parse(await readFile(reportPath, 'utf8')), root, files, options);
    });
  } catch (error) { failure = error; }
  // Capture within Vite's workspace boundary, then retain images before private-checkout cleanup.
  if (!options.watch) {
    try { await cp(screenshotDirectory, join(manifest.resultsRoot, 'web/screenshots'), { recursive: true }); }
    catch (error) { if (error.code !== 'ENOENT') failure ??= error; }
  }
  if (failure) throw failure;
  return result;
}
