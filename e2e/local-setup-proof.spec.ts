import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { demoIds } from '../apps/api/src/db/demo-ids';
import { deterministicSeedAttachments } from '../apps/api/src/db/demo-attachments';

test('independent local setup serves deep links and exact seeded bytes', async ({ page }, info) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto(`/work-items/${demoIds.workItems.inProgress}#files`);
  await expect(page.getByRole('heading', { level: 1, name: 'Implement transport-neutral API handler contract', exact: true })).toBeVisible();
  await page.reload();
  for (const attachment of deterministicSeedAttachments) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${attachment.fileName}`, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(attachment.fileName);
    const path = await download.path();
    expect(path).not.toBeNull();
    expect(await readFile(path!)).toEqual(Buffer.from(attachment.bytes));
  }
  const preview = process.env.WORKTRAIL_VERIFY_STAGE === 'preview';
  expect(requests.some(url => url.includes('/@vite/client'))).toBe(!preview);
  if (preview) expect(requests.some(url => /\/main-[^/]+\.js$/.test(url))).toBe(true);
  await page.setViewportSize({ width: 1600, height: 960 });
  await page.goto('/portfolio');
  await expect(page.locator('article.project-row')).toHaveCount(4);
  await page.screenshot({ path: info.outputPath('worktrail-portfolio.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('article.project-row').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('worktrail-portfolio-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/work-items/${demoIds.workItems.backlog}`);
  await expect(page.locator('app-work-item-detail-summary app-authored-content-viewer h3')).toHaveText('Project summary requirements');
  await expect(page.locator('#detail-description')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('worktrail-detail.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('worktrail-detail-mobile.png') });
  expect(errors).toEqual([]);
});
