import { readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { childEnvironment, readManifest, saveManifest } from './ownership.mjs';
import { runCommand } from './processes.mjs';
import { selectPort } from './ports.mjs';

function specPath(value) {
  return typeof value === 'string' && /^src\/[a-zA-Z0-9_./-]+\.(spec|test)\.ts$/.test(value) &&
    !value.split('/').includes('..');
}

export function parseWebArguments(args) {
  const options = { runner: 'all', include: [], filter: null, help: false };
  for (const argument of args) {
    if (argument === '--help') options.help = true;
    else if (argument.startsWith('--runner=')) options.runner = argument.slice(9);
    else if (argument.startsWith('--include=')) options.include.push(argument.slice(10));
    else if (argument.startsWith('--filter=')) options.filter = argument.slice(9);
    else throw new Error('Unknown web-test argument. Use --help.');
  }
  if (!['all', 'karma', 'vitest'].includes(options.runner)) throw new Error('Unknown web-test runner.');
  if (!options.include.every(specPath) || new Set(options.include).size !== options.include.length) {
    throw new Error('--include requires distinct literal src/...spec.ts or src/...test.ts paths.');
  }
  if (options.filter !== null) {
    if (options.runner !== 'vitest' || !options.filter) throw new Error('--filter requires --runner=vitest and a nonempty expression.');
    try { new RegExp(options.filter); } catch { throw new Error('Invalid web-test filter expression.'); }
  }
  return options;
}

export function partitionWebTests(inventory, migration, options = parseWebArguments([])) {
  if (migration.schemaVersion !== 1 || !Array.isArray(migration.migrated) ||
      !migration.migrated.every(specPath) || new Set(migration.migrated).size !== migration.migrated.length) {
    throw new Error('Invalid web-test migration manifest.');
  }
  if (!inventory.length || new Set(inventory).size !== inventory.length || !inventory.every(specPath)) {
    throw new Error('Web-test discovery is empty or invalid.');
  }
  const migrated = new Set(migration.migrated);
  for (const file of migrated) if (!inventory.includes(file)) throw new Error(`Migrated spec is missing: ${file}`);
  for (const file of options.include) if (!inventory.includes(file)) throw new Error(`Requested spec is missing: ${file}`);
  const selected = inventory.filter(file => !options.include.length || options.include.includes(file));
  const partitions = [
    { runner: 'karma', files: selected.filter(file => !migrated.has(file)) },
    { runner: 'vitest', files: selected.filter(file => migrated.has(file)) }
  ].filter(part => part.files.length && (options.runner === 'all' || options.runner === part.runner));
  if (!partitions.length) throw new Error('No specs match the selected web-test runner.');
  if (options.include.length && partitions.flatMap(part => part.files).length !== options.include.length) {
    throw new Error('Requested specs belong to a different web-test runner.');
  }
  return partitions;
}

async function discover(root, prefix = 'src') {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await discover(join(root, entry.name), relative));
    else if (entry.isSymbolicLink()) throw new Error('Web-test discovery refuses source symlinks.');
    else if (/\.(spec|test)\.ts$/.test(entry.name)) files.push(relative);
  }
  return files.sort();
}

export async function validateWebConfiguration(checkout) {
  const root = join(checkout, 'apps/web');
  const require = createRequire(join(root, 'package.json'));
  const { readConfigFile, parseJsonConfigFileContent, sys } = require('typescript');
  const inventory = await discover(join(root, 'src'));
  const migration = JSON.parse(await readFile(join(root, 'test-migration.json'), 'utf8'));
  partitionWebTests(inventory, migration);
  const expected = new Set(migration.migrated);
  for (const [file, migrated] of [['tsconfig.spec.json', false], ['tsconfig.vitest.json', true]]) {
    const config = readConfigFile(join(root, file), sys.readFile);
    if (config.error) throw new Error(`Cannot read ${file}.`);
    const parsed = parseJsonConfigFileContent(config.config, sys, root);
    if (parsed.errors.length) throw new Error(`Invalid ${file}.`);
    const actual = parsed.fileNames.filter(name => /\.(spec|test)\.ts$/.test(name)).map(name => name.slice(root.length + 1)).sort();
    const wanted = inventory.filter(name => expected.has(name) === migrated);
    if (JSON.stringify(actual) !== JSON.stringify(wanted) ||
        JSON.stringify(parsed.options.types ?? []) !== JSON.stringify(migrated ? [] : ['jasmine'])) {
      throw new Error(`${file} is out of sync with test-migration.json or mixes test types.`);
    }
  }
  const iconRequire = createRequire(require.resolve('@lucide/angular'));
  if (await realpath(require.resolve('@angular/core')) !== await realpath(iconRequire.resolve('@angular/core'))) {
    throw new Error('Application and icon package resolve different Angular runtimes.');
  }
  return { inventory, migration };
}

export async function executeWebPartitions(partitions, execute, stop = () => false) {
  const failures = [];
  for (const partition of partitions) {
    if (stop()) throw new Error('Web tests interrupted or previous child cleanup failed.');
    try { await execute(partition); }
    catch (error) {
      if (stop()) throw error;
      failures.push({ runner: partition.runner, error });
    }
  }
  if (failures.length) throw new AggregateError(failures.map(item => item.error),
    `Web test partitions failed:\n${failures.map(({ runner, error }) => `${runner}: ${error.message}`).join('\n')}`);
}

export async function readWebTestContext(env = process.env) {
  const manifest = await readManifest(env.WORKTRAIL_VERIFY_MANIFEST, env.WORKTRAIL_VERIFY_NONCE);
  const port = manifest.ports?.vitest;
  if (!port || String(port) !== env.WORKTRAIL_VERIFY_VITEST_PORT) throw new Error('Vitest requires an assigned owned port.');
  return { port, cacheDir: join(manifest.root, 'vitest-cache'), reportPath: join(manifest.root, 'vitest-results.json') };
}

export async function runWebTests(manifest, checkout, { options = parseWebArguments([]), signal, gate = async (_name, run) => run() } = {}) {
  await readManifest(join(manifest.root, 'manifest.json'), manifest.nonce);
  if (await realpath(checkout) !== join(manifest.root, 'checkout')) throw new Error('Web tests require their owned source snapshot.');
  const { inventory, migration } = await validateWebConfiguration(checkout);
  const partitions = partitionWebTests(inventory, migration, options);
  await executeWebPartitions(partitions, async ({ runner, files }) => {
    const configName = `tsconfig.web-run.${runner}.json`;
    await writeFile(join(checkout, 'apps/web', configName), JSON.stringify({
      extends: runner === 'karma' ? './tsconfig.spec.json' : './tsconfig.vitest.json',
      files: runner === 'vitest' ? [...files, 'src/testing/providers.ts'] : files,
      include: ['src/**/*.d.ts'], exclude: []
    }, null, 2));
    const port = await selectPort();
    manifest.ports[runner] = port;
    await saveManifest(manifest);
    const env = { ...childEnvironment(manifest) };
    const args = ['run', 'ng', '--workspace', '@worktrail/web', '--', 'run',
      `worktrail-web:${runner === 'karma' ? 'test' : 'test-vitest'}`, '--watch=false',
      '--ts-config', configName, ...files.flatMap(file => ['--include', file])];
    if (runner === 'karma') {
      env.WORKTRAIL_VERIFY_KARMA_PORT = String(port);
      args.push('--karma-config', join(checkout, 'scripts/verification/karma.config.cjs'));
    } else {
      env.WORKTRAIL_VERIFY_VITEST_PORT = String(port);
      if (options.filter !== null) args.push('--filter', options.filter);
    }
    await gate(`test:web:${runner}`, async () => {
      await runCommand('npm', args, {
        manifest, env, cwd: checkout, inherit: true, signal, timeoutMs: 600_000, trackDescendants: true
      });
      if (runner === 'vitest') {
        const report = JSON.parse(await readFile(join(manifest.root, 'vitest-results.json'), 'utf8'));
        if (!Number.isSafeInteger(report.numPassedTests) || report.numPassedTests < 1) {
          throw new Error('Vitest selection executed no passing tests. Check the file/name selection.');
        }
      }
    });
  }, () => Boolean(signal?.aborted || manifest.processes.length));
}
