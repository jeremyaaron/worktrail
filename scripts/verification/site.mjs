import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function checkSite(checkout) {
  const require = createRequire(join(checkout, 'apps/web/package.json'));
  const { parse } = await import(pathToFileURL(require.resolve('parse5')).href);
  const site = join(checkout, 'site');
  const html = await readFile(join(site, 'index.html'), 'utf8');
  const ids = new Set();
  const links = [];
  const images = [];
  function walk(node) {
    const attributes = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    if (attributes.id) { assert.ok(!ids.has(attributes.id), 'Site IDs must be unique'); ids.add(attributes.id); }
    for (const name of ['href', 'src']) if (attributes[name]) links.push(attributes[name]);
    if (node.tagName === 'img') { assert.ok('alt' in attributes, 'Site images need an alt attribute'); images.push(attributes.src); }
    for (const child of node.childNodes ?? []) walk(child);
  }
  walk(parse(html));
  assert.ok(images.length > 0, 'Site must retain product images');
  for (const value of links) {
    const url = new URL(value, 'https://worktrail.invalid/');
    if (url.origin !== 'https://worktrail.invalid') continue;
    const target = resolve(site, `.${decodeURIComponent(url.pathname)}`);
    assert.ok(!relative(site, target).startsWith('..'), 'Site asset escapes its root');
    if (url.pathname !== '/') await access(target);
    if (url.hash && ['/', '/index.html'].includes(url.pathname)) assert.ok(ids.has(decodeURIComponent(url.hash.slice(1))), `Missing site fragment ${url.hash}`);
  }
  console.log(`Site checks passed: ${images.length} images, ${links.length} links/assets, ${ids.size} IDs.`);
}
