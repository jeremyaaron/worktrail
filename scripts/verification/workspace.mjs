import { cp, mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

import { repositoryRoot } from './ownership.mjs';

const excluded = new Set(['node_modules', 'dist', '.angular', 'out-tsc', 'coverage', 'test-results', '.worktrail', '.git']);

async function linkDependencies(source, target) {
  let entries;
  try { entries = await readdir(source, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  await mkdir(target, { recursive: true });
  for (const entry of entries) {
    if (entry.name === '@worktrail') continue;
    await symlink(join(source, entry.name), join(target, entry.name));
  }
}

export async function prepareWorkspace(manifest, { linkInstalledDependencies = true } = {}) {
  const checkout = join(manifest.root, 'checkout');
  await mkdir(checkout);
  // Snapshot source/configuration and isolate every build/cache output. Normal runs share installed
  // dependencies read-only; explicit fresh-setup runs install their own lockfile dependencies.
  for (const name of ['apps', 'packages', 'scripts', 'e2e', 'site', 'docs', '.github', 'README.md', '.nvmrc', 'package.json', 'package-lock.json',
    'tsconfig.base.json', 'tsconfig.verification.json', 'eslint.config.js',
    'playwright.config.ts', 'playwright.editor.config.ts', 'playwright.production.config.ts', 'playwright.site.config.ts']) {
    await cp(join(repositoryRoot, name), join(checkout, name), {
      recursive: true,
      filter: (path) => !excluded.has(basename(path)) && !basename(path).startsWith('.env')
    });
  }
  if (linkInstalledDependencies) {
    await linkDependencies(join(repositoryRoot, 'node_modules'), join(checkout, 'node_modules'));
    for (const name of ['apps/api', 'apps/web', 'packages/contracts']) {
      await linkDependencies(join(repositoryRoot, name, 'node_modules'), join(checkout, name, 'node_modules'));
    }
    await mkdir(join(checkout, 'node_modules/@worktrail'));
    for (const [name, directory] of [['api', 'apps/api'], ['web', 'apps/web'], ['contracts', 'packages/contracts']]) {
      await symlink(join(checkout, directory), join(checkout, 'node_modules/@worktrail', name));
    }
  }
  const angularPath = join(checkout, 'apps/web/angular.json');
  const angular = JSON.parse(await readFile(angularPath, 'utf8'));
  angular.cli.cache = { enabled: false };
  const serve = angular.projects['worktrail-web'].architect.serve;
  serve.options = { ...serve.options, prebundle: false };
  await writeFile(angularPath, JSON.stringify(angular, null, 2));
  return checkout;
}
