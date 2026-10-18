import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';
import { demoIds } from '../apps/api/src/db/demo-ids';
import { readBrowserContext } from '../scripts/verification/browser-context.mjs';

test.use({ viewport: null, deviceScaleFactor: undefined });

test('cross-surface acceptance uses actual 200 percent browser zoom', async ({ baseURL }, info) => {
  const owner = await readBrowserContext('e2e');
  expect(baseURL).toBe(owner.baseURL);
  const extension = fileURLToPath(new URL('./support/zoom-extension', import.meta.url));
  const context = await chromium.launchPersistentContext(join(dirname(owner.checkout), 'native-zoom-profile'), {
    channel: 'chromium', headless: true, viewport: null, deviceScaleFactor: undefined,
    args: ['--window-size=1440,960', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const page = context.pages()[0] ?? await context.newPage();
    const cdp = await context.newCDPSession(page);
    // Native zoom changes DPR without Playwright's viewport override; capture the whole surface.
    const screenshot = async (name: string) => {
      const capture = await cdp.send('Page.captureScreenshot', { fromSurface: true });
      await info.attach(name, { contentType: 'image/png', body: Buffer.from(capture.data, 'base64') });
    };
    await page.goto(baseURL + '/portfolio');
    await expect(page.getByRole('heading', { level: 1, name: 'Portfolio review', exact: true })).toBeVisible();
    await expect(page.locator('article.project-row').first()).toBeVisible();
    const metrics = () => page.evaluate(() => ({ width: innerWidth, outerWidth, dpr: devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom }));
    const before = await metrics();
    const zoom = await worker.evaluate(async url => {
      const api = (globalThis as unknown as { chrome: { tabs: {
        query(options: object): Promise<Array<{ id?: number; url?: string }>>;
        setZoom(id: number, factor: number): Promise<void>;
        getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tab = (await api.query({})).find(tab => tab.url === url);
      if (tab?.id === undefined) throw new Error('Owned zoom tab was not found.');
      await api.setZoom(tab.id, 2);
      return api.getZoom(tab.id);
    }, page.url());
    expect(zoom).toBe(2);
    await expect.poll(async () => (await metrics()).dpr / before.dpr).toBe(2);
    const after = await metrics();
    expect(after.outerWidth).toBe(before.outerWidth);
    expect(Math.abs(after.width - before.width / 2)).toBeLessThanOrEqual(1);
    expect(after.cssZoom).toBe(before.cssZoom);
    await info.attach('actual-browser-zoom', { contentType: 'application/json', body: JSON.stringify({ zoom, before, after }) });
    for (const [name, path] of [
      ['my-work', '/my-work'],
      ['portfolio', '/portfolio'],
      ['work', '/work-items'],
      ['planning', `/projects/${demoIds.projects.app}/planning`],
      ['detail', `/work-items/${demoIds.workItems.backlog}`]
    ]) {
      await page.goto(baseURL + path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (name === 'my-work') await expect(page.locator('.work-row').first()).toBeVisible();
      if (name === 'portfolio') await expect(page.locator('article.project-row').first()).toBeVisible();
      if (name === 'planning') await expect(page.locator('app-planning-review')).toBeVisible();
      if (name === 'detail') await expect(page.locator('app-work-item-detail-summary')).toBeVisible();
      if (name === 'work') await expect(page.getByRole('status', { name: 'Work item results status', exact: true })).toContainText('Results updated:');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await screenshot(`${name}-native-200-percent`);
    }
    await page.getByRole('button', { name: 'Open Quick Find', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Quick Find', exact: true });
    await expect(dialog.getByRole('combobox', { name: 'Search Worktrail', exact: true })).toBeFocused();
    await dialog.getByRole('combobox', { name: 'Search Worktrail', exact: true }).fill('work');
    await expect(dialog.locator('.quick-find__result').first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close Quick Find', exact: true })).toBeInViewport();
    expect(await dialog.evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
    })).toBe(true);
    await screenshot('quick-find-native-200-percent');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open Quick Find', exact: true })).toBeFocused();
  } finally { await context.close(); }
});
