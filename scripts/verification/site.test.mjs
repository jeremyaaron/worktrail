import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { createManifest, repositoryRoot } from './ownership.mjs';
import { cleanupRun } from './resources.mjs';
import { checkSite } from './site.mjs';
import { prepareWorkspace } from './workspace.mjs';

test('site validates assets, fragments, repository paths and release identity', async t => {
  const manifest = await createManifest('none');
  try {
    const checkout = await prepareWorkspace(manifest);
    const path = join(checkout, 'site/index.html');
    const original = await readFile(path, 'utf8');
    const { version } = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
    assert.equal((await checkSite(checkout, { quiet: true })).version, version);
    const cases = [
      ['missing asset', html => html.replace('src="assets/worktrail-mark.svg"', 'src="assets/missing.svg"')],
      ['missing fragment', html => html.replace('href="#app"', 'href="#missing"')],
      ['missing repository file', html => html.replace('docs/operations.md', 'docs/missing.md')],
      ['missing repository anchor', html => html.replace('#composition-and-persistence', '#missing-anchor')],
      ['wrong release identity', html => html.replace(`data-release="${version}"`, 'data-release="9.9.9"')],
      ['wrong visible release', html => html.replace(`Published release v${version}`, 'Published release v9.9.9')],
      ['wrong release tag', html => html.replace(`/blob/v${version}/`, '/blob/v9.9.9/')],
      ['wrong canonical subpath', html => html.replace('rel="canonical" href="https://jeremyaaron.github.io/worktrail/"', 'rel="canonical" href="https://jeremyaaron.github.io/"')],
      ['wrong share image subpath', html => html.replace('content="https://jeremyaaron.github.io/worktrail/assets/', 'content="https://jeremyaaron.github.io/assets/')],
      ['wrong image dimensions', html => html.replace('width="1600"', 'width="1601"')]
    ];
    for (const [name, transform] of cases) await t.test(name, async () => {
      await writeFile(path, transform(original));
      await assert.rejects(checkSite(checkout, { quiet: true }));
      await writeFile(path, original);
    });
  } finally { await cleanupRun(manifest); }
});

test('fresh setup workspace does not link installed dependencies or inherit runtime env files', async () => {
  const manifest = await createManifest('none');
  try {
    const checkout = await prepareWorkspace(manifest, { linkInstalledDependencies: false });
    assert.equal(await stat(join(checkout, 'node_modules')).then(() => true, () => false), false);
    assert.equal(await stat(join(checkout, '.env')).then(() => true, () => false), false);
    assert.equal(await stat(join(checkout, 'apps/api/.env')).then(() => true, () => false), false);
    assert.equal(await stat(join(checkout, 'playwright.site.config.ts')).then(() => true, () => false), true);
  } finally { await cleanupRun(manifest); }
});

test('demo identities and bytes import without a database or executable seed entry point', async () => {
  const code = `import assert from 'node:assert/strict';
    import {demoIds} from './apps/api/src/db/demo-ids.ts';
    import {deterministicSeedAttachments} from './apps/api/src/db/demo-attachments.ts';
    assert.equal(demoIds.workItems.inProgress,'10000000-0000-4000-8000-000000000403');
    assert.equal(deterministicSeedAttachments.length,2);
    assert.equal(deterministicSeedAttachments[0].byteSize,deterministicSeedAttachments[0].bytes.byteLength);`;
  const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
    cwd: repositoryRoot, env: { ...process.env, DATABASE_URL: 'not-a-database-url' }
  });
  assert.equal(result.stdout, '');
});
