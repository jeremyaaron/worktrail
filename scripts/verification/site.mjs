import assert from 'node:assert/strict';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Confirmed through GitHub's Pages API; no custom domain is configured.
export const publishedSiteUrl = 'https://jeremyaaron.github.io/worktrail/';
const repositoryUrl = 'https://github.com/jeremyaaron/worktrail';

export async function checkSite(checkout, { quiet = false } = {}) {
  const require = createRequire(join(checkout, 'apps/web/package.json'));
  const { parse } = await import(pathToFileURL(require.resolve('parse5')).href);
  const markdown = require('markdown-it')();
  const site = join(checkout, 'site');
  const html = await readFile(join(site, 'index.html'), 'utf8');
  const { version } = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
  const ids = new Set();
  const elements = [];
  function walk(node) {
    const attrs = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    if (attrs.id) { assert.ok(!ids.has(attrs.id), 'Site IDs must be unique'); ids.add(attrs.id); }
    if (node.tagName) elements.push({ tag: node.tagName, attrs, node });
    for (const child of node.childNodes ?? []) walk(child);
  }
  walk(parse(html));
  const meta = property => elements.find(e => e.tag === 'meta' && e.attrs.property === property)?.attrs.content;
  const canonical = elements.find(e => e.tag === 'link' && e.attrs.rel === 'canonical')?.attrs.href;
  assert.equal(canonical, publishedSiteUrl, 'Canonical URL must match the confirmed Pages base');
  assert.equal(meta('og:url'), publishedSiteUrl, 'Share URL must match canonical');
  assert.ok(meta('og:image:alt'), 'Share image needs descriptive alternative text');
  assert.equal(meta('og:image'), new URL('assets/worktrail-portfolio.png', publishedSiteUrl).href, 'Share image must use the deployed subpath');
  const releases = elements.filter(e => 'data-release' in e.attrs);
  assert.equal(releases.length, 1, 'Keep one compact release identity');
  assert.equal(releases[0].attrs['data-release'], version, 'Site release identity must match package version');
  const releaseText = releases[0].node.childNodes.filter(n => n.nodeName === '#text').map(n => n.value).join('');
  assert.equal(releaseText.trim(), `Published release v${version}`, 'Visible release label must match');
  const releaseLinks = elements.filter(e => 'data-release-link' in e.attrs);
  assert.ok(releaseLinks.length > 0, 'Published release evidence must remain linked');
  for (const link of releaseLinks) assert.ok(link.attrs.href.startsWith(`${repositoryUrl}/blob/v${version}/docs/v${version}/`), 'Release evidence must use the matching fixed tag');
  const root = await realpath(checkout);
  async function localFile(directory, path) {
    const target = resolve(directory, path);
    const actual = await realpath(target);
    const within = relative(await realpath(directory), actual);
    assert.ok(within !== '..' && !within.startsWith('../'), 'Local reference escapes its root');
    assert.ok((await stat(actual)).isFile(), `Expected a file: ${path}`);
    return actual;
  }
  const headingCache = new Map();
  async function assertMarkdownAnchor(target, fragment) {
    if (!fragment || !target.endsWith('.md')) return;
    if (!headingCache.has(target)) {
      const tokens = markdown.parse(await readFile(target, 'utf8'), {});
      const headings = new Set();
      const duplicates = new Map();
      for (let i = 0; i < tokens.length; i++) if (tokens[i].type === 'heading_open') {
        const slug = tokens[i + 1].content.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
        const count = duplicates.get(slug) ?? 0;
        duplicates.set(slug, count + 1);
        headings.add(slug + (count ? `-${count}` : ''));
      }
      headingCache.set(target, headings);
    }
    assert.ok(headingCache.get(target).has(decodeURIComponent(fragment.slice(1))), `Missing repository fragment ${fragment}`);
  }
  const references = [];
  for (const element of elements) {
    for (const name of ['href', 'src']) if (element.attrs[name]) references.push(element.attrs[name]);
    if (element.attrs.srcset) {
      for (const entry of element.attrs.srcset.split(',')) references.push(entry.trim().split(/\s+/)[0]);
    }
    if (element.tag === 'img') assert.ok('alt' in element.attrs, 'Site images need an alt attribute');
    if (['img', 'source'].includes(element.tag)) {
      assert.ok(Number(element.attrs.width) > 0 && Number(element.attrs.height) > 0, 'Image renditions need stable dimensions');
      const path = element.attrs.src ?? element.attrs.srcset;
      if (path?.endsWith('.png')) {
        const bytes = await readFile(await localFile(site, path));
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Expected PNG proof asset');
        assert.equal(bytes.readUInt32BE(16), Number(element.attrs.width), 'Proof image width must match asset');
        assert.equal(bytes.readUInt32BE(20), Number(element.attrs.height), 'Proof image height must match asset');
      }
    }
  }
  references.push(meta('og:image'));
  let repositoryLinks = 0;
  for (const value of references) {
    const url = new URL(value, publishedSiteUrl);
    if (url.origin === new URL(publishedSiteUrl).origin) {
      assert.ok(url.pathname.startsWith('/worktrail/'), 'Local asset must preserve the Pages repository subpath');
      const path = decodeURIComponent(url.pathname.slice('/worktrail/'.length)) || 'index.html';
      await localFile(site, path);
      if (url.hash && path === 'index.html') assert.ok(ids.has(decodeURIComponent(url.hash.slice(1))), `Missing site fragment ${url.hash}`);
    } else if (url.origin === 'https://github.com' && url.pathname.startsWith('/jeremyaaron/worktrail/')) {
      const parts = url.pathname.split('/');
      if (parts[3] === 'blob') {
        assert.ok(['main', `v${version}`].includes(parts[4]), 'Repository document must follow main or the published release');
        const target = await localFile(root, decodeURIComponent(parts.slice(5).join('/')));
        await assertMarkdownAnchor(target, url.hash);
        repositoryLinks++;
      }
    }
  }
  assert.equal(elements.filter(e => e.tag === 'h1').length, 1, 'Site needs one product H1');
  assert.equal(elements.filter(e => e.tag === 'article' && e.attrs.class === 'workflow').length, 4, 'Keep four product workflows');
  assert.equal(elements.filter(e => e.tag === 'figure').length, 2, 'Keep two complementary product proof points');
  const result = { references: references.length, repositoryLinks, ids: ids.size, version };
  if (!quiet) console.log('Site checks passed: ' + JSON.stringify(result));
  return result;
}
