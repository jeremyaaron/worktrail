import { expect, test } from '@playwright/test';

test('serves compiled assets and deep links with formatted read and preview behavior', async ({
  page,
  request
}, testInfo) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/work-items/10000000-0000-4000-8000-000000000401');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Define project home summary cards' })
  ).toBeVisible();
  await expect(
    page.locator('app-work-item-detail-summary app-authored-content-viewer h3')
  ).toHaveText('Project summary requirements');
  await page.reload();
  await page.locator('button[aria-controls="edit-work-item"]').click();
  await expect(page.locator('#detail-description-format')).toHaveValue('markdown_v1');
  const editor = page.locator('app-authored-content-editor[formcontrolname="descriptionContent"]');
  await page.locator('#detail-description').fill('## Production preview\n\n**Compiled content**');
  await editor.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(editor.locator('app-authored-content-viewer strong')).toHaveText('Compiled content');
  for (const width of [1440, 1024, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await editor.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`production-${width}.png`) });
  }
  await page.locator('app-work-item-detail-editor').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Discard', exact: true }).click();
  const planning = '/projects/10000000-0000-4000-8000-000000000201/planning?view=cycles#cycles-heading';
  await page.goto(`/work-items/10000000-0000-4000-8000-000000000401?returnUrl=${encodeURIComponent(planning)}#history`);
  await expect(page.locator('#history')).toBeFocused();
  await expect(page.locator('#history > details')).toHaveAttribute('open', '');
  await page.reload();
  await expect(page.locator('#history')).toBeFocused();
  await page.getByRole('link', { name: 'Back to Planning', exact: true }).click();
  await expect(page).toHaveURL(planning);
  await expect(page.locator('#cycles-heading')).toBeFocused();
  await page.goto('/work-items/10000000-0000-4000-8000-000000000427');
  await expect(page.locator('app-work-item-detail-summary strong')).toHaveText('original source');
  await expect(page.locator('#detail-description')).toHaveCount(0);
  await expect(page.locator('button[aria-controls="edit-work-item"]')).toBeDisabled();
  await page.goto('/projects/10000000-0000-4000-8000-000000000201/board');
  await expect(page.getByRole('heading', { name: 'Project board', exact: true })).toBeVisible();
  const missing = await request.get('/api/no-such-endpoint');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).not.toMatch(/<app-root|\/main-[^/]+\.js/);
  expect(requests.some((url) => /\/main-[^/]+\.js$/.test(url))).toBe(true);
  expect(requests.some((url) => url.includes('/@vite/client'))).toBe(false);
  expect(errors).toEqual([]);
});
