import { readFile } from 'node:fs/promises';

import { collectAudit, evaluateAudits, installedDependencyRoot, verifyDependencyGraph } from './verification/audit.mjs';

try {
  const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
  const lock = await json('package-lock.json');
  const policy = await json('docs/security/development-audit-exceptions.json');
  const { version: currentVersion } = await json('package.json');
  await verifyDependencyGraph(await installedDependencyRoot(process.cwd()));
  console.log('Installed dependency graph: valid (including workspace peer ranges).');
  const production = await collectAudit(process.cwd(), true);
  console.log(`Production audit: ${production.metadata.vulnerabilities.total} findings (no exceptions permitted).`);
  const full = await collectAudit(process.cwd(), false);
  console.log(`Full audit: ${JSON.stringify(full.metadata.vulnerabilities)} (includes development/optional peers).`);
  const result = evaluateAudits({ production, full, lock, policy, currentVersion });
  console.log(`Development audit gate passed: ${result.advisories} bounded advisories, ${result.accountedPaths} exact advisory/package/path/version/severity records.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
