import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function contained(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).overflowX)).not.toBe('hidden');
  const clipped = await page.locator('.topbar a, h1, h2, h3, .hero-actions a, .workflow, .architecture dd, .limits > div, .product-figure, pre, .footer a').evaluateAll(elements => elements.filter(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1);
  }).map(element => element.textContent?.trim()));
  expect(clipped).toEqual([]);
}

test('site reflows with legible product renditions and a first-viewport transition', async ({ page }, info) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080], [568, 320]]) {
    await page.setViewportSize({ width, height });
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'Worktrail', exact: true })).toBeVisible();
    const title = await page.locator('#hero-title').evaluate(element => ({
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight)
    }));
    expect(title.height, `${width}x${height} product name must stay on one line`).toBeLessThanOrEqual(title.lineHeight + 1);
    await expect(page.locator('.workflow')).toHaveCount(4);
    await contained(page);
    const transition = await page.locator('#app').evaluate(element => element.getBoundingClientRect().top);
    expect(transition, `${width}x${height} must show the next section`).toBeLessThan(height - 8);
    await page.screenshot({ path: info.outputPath(`site-${width}x${height}.png`) });
    for (const [index, figure] of (await page.locator('figure').all()).entries()) {
      await figure.scrollIntoViewIfNeeded();
      const img = figure.locator('img');
      await expect.poll(() => img.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
      const src = await img.evaluate(element => (element as HTMLImageElement).currentSrc);
      expect(src.endsWith('-mobile.png')).toBe(width <= 600);
      await contained(page);
      if (width === 390 || width === 1440) await page.screenshot({ path: info.outputPath(`proof-${index}-${width}.png`) });
    }
    if (width === 390 || width === 1440) {
      for (const section of ['architecture', 'scope', 'run']) {
        await page.locator('#' + section).scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`${section}-${width}.png`) });
      }
    }
  }
  expect(failures).toEqual([]);
});

test('site supports keyboard skip, visible focus, anchors and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await expect(skip).toBeFocused();
  expect(await skip.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).scrollBehavior)).toBe('auto');
  for (const target of ['app', 'architecture', 'scope', 'run']) {
    await page.locator(`.topbar a[href="#${target}"]`).click();
    const top = await page.locator('#' + target).evaluate(element => element.getBoundingClientRect().top);
    const headerBottom = await page.locator('.topbar').evaluate(element => element.getBoundingClientRect().bottom);
    expect(top).toBeGreaterThanOrEqual(headerBottom - 1);
    await expect(page).toHaveURL(new RegExp('#' + target + '$'));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#app');
  await contained(page);
  const original = page.getByRole('link', { name: 'Open full-size Portfolio screenshot', exact: true });
  await original.click();
  expect(page.url()).toMatch(/\/worktrail\/assets\/worktrail-portfolio\.png$/);
});
