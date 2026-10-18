import { expect, test } from '@playwright/test';
import type { WorkItemDetailDto } from '@worktrail/contracts';
import { resetDemoDatabase } from './reset-demo-database';

test.afterAll(resetDemoDatabase);

const projectId = '10000000-0000-4000-8000-000000000201';
const contributorId = '10000000-0000-4000-8000-000000000103';
const apiURL = `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? '3000'}/api`;
const headers = {
  'x-worktrail-workspace-id': '10000000-0000-4000-8000-000000000001',
  'x-worktrail-member-id': contributorId
};

test('read-first detail edits planning facts without resetting discussion or files', async ({ page, request }, testInfo) => {
  const created = await request.post(`${apiURL}/projects/${projectId}/work-items`, {
    headers,
    data: {
      title: `Read-first detail ${Date.now()}`, type: 'story', priority: 'high',
      description: '# Release readiness\n\n**Inspect** planning facts before replying.',
      descriptionFormat: 'markdown_v1', estimatePoints: 8, dueDate: '2028-02-29'
    }
  });
  expect(created.ok()).toBe(true);
  const item = await created.json() as WorkItemDetailDto;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/work-items/${item.id}`);
  await page.locator('#current-member').selectOption(contributorId);
  await expect(page.getByRole('heading', { level: 1, name: item.title })).toBeVisible();
  await expect(page.locator('.project-link')).toHaveText('Worktrail App');
  await expect(page.locator('#detail-title')).toHaveCount(0);
  await expect(page.getByLabel('Find a parent')).toBeHidden();
  await expect(page.getByLabel('Find work item')).toBeHidden();
  await expect(page.locator('#history details')).not.toHaveAttribute('open', '');
  const summary = page.locator('app-work-item-detail-summary');
  await expect(summary.locator('strong')).toHaveText('Inspect');

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await summary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`read-first-${width}.png`) });
  }

  await page.locator('a[href$="#discussion"]').click();
  await expect(page.locator('#comment-body')).toBeInViewport();
  await page.locator('#comment-body').fill('  **Keep this reply**\n');
  await page.getByLabel('Mention members', { exact: true }).selectOption('10000000-0000-4000-8000-000000000101');
  await page.locator('.comment-form').getByRole('button', { name: 'Preview', exact: true }).click();
  const fileOwner = await page.locator('app-work-item-attachments').elementHandle();
  await page.locator('button[aria-controls="edit-work-item"]').click();
  await expect(page.locator('#detail-title')).toBeFocused();
  await page.locator('#detail-estimate').fill('0');
  await page.locator('#detail-due-date').fill('');
  const patch = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/work-items/${item.id}`));
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect((await patch).ok()).toBe(true);
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved.' })).toBeVisible();
  await expect(summary).toContainText('0 points');
  await expect(summary).toContainText('No due date');
  await expect(page.locator('.comment-form app-authored-content-viewer strong')).toHaveText('Keep this reply');
  await expect(page.getByLabel('Selected mentions')).toContainText('Avery Owner');
  expect(await fileOwner!.evaluate(element => element.isConnected)).toBe(true);

  const beforeNoOp = await request.get(`${apiURL}/work-items/${item.id}`, { headers });
  const activityBefore = (await beforeNoOp.json() as WorkItemDetailDto).activity;
  const noOp = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/work-items/${item.id}`));
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect((await noOp).ok()).toBe(true);
  const afterNoOp = await request.get(`${apiURL}/work-items/${item.id}`, { headers });
  const saved = await afterNoOp.json() as WorkItemDetailDto;
  expect(saved.estimatePoints).toBe(0);
  expect(saved.dueDate).toBeNull();
  expect(saved.description).toBe(item.description);
  expect(saved.activity).toEqual(activityBefore);

  await page.locator('#detail-estimate').fill('13');
  await page.locator('#detail-due-date').fill('2028-03-01');
  await page.route(`**/api/work-items/${item.id}`, route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Expected failure' } }) })
    : route.continue());
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('The work item could not be updated.', { exact: true })).toBeVisible();
  await expect(page.locator('#detail-estimate')).toHaveValue('13');
  await expect(page.locator('#detail-due-date')).toHaveValue('2028-03-01');
  await page.unroute(`**/api/work-items/${item.id}`);
  await page.locator('app-work-item-detail-editor').getByRole('button', { name: 'Cancel', exact: true }).click();
  const decision = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await expect(decision).toContainText('Work item details');
  await expect(decision).not.toContainText('New comment');
  await decision.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.locator('#detail-title')).toHaveCount(0);
  await expect(page.locator('button[aria-controls="edit-work-item"]')).toBeFocused();
  await expect(page.locator('.comment-form app-authored-content-viewer strong')).toHaveText('Keep this reply');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(page.locator('article.comment strong').first()).toHaveText('Casey Contributor');
  await expect(page.locator('article.comment app-authored-content-viewer strong')).toHaveText('Keep this reply');
  await page.locator('#history summary').click();
  await expect(page.locator('#history app-activity-timeline')).toBeVisible();
  expect(errors).toEqual([]);
});

test('read-first hierarchy separates parent estimate from closed child totals', async ({ page }, testInfo) => {
  await page.goto('/work-items/10000000-0000-4000-8000-000000000420');
  const summary = page.locator('app-work-item-detail-summary');
  await expect(summary).toContainText('Parent estimate');
  const children = page.locator('app-work-item-child-work > details');
  await expect(children).not.toHaveAttribute('open', '');
  await expect(children.locator(':scope > summary')).toContainText('2 closed');
  await children.locator(':scope > summary').click();
  await expect(page.getByLabel('Direct child work summary')).toContainText(/Closed\s*2/);
  await expect(page.getByLabel('Direct child work summary')).toContainText(/Child total\s*13/);
  const continuation = children.getByRole('link', { name: 'View all child work' });
  await expect(continuation).toHaveAttribute('href', /parentKey=WT-12$/);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await children.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`hierarchy-${width}.png`) });
  }
  await continuation.click();
  await expect(page).toHaveURL(/parentKey=WT-12/);
  await expect(page.getByLabel('Active filters')).toContainText('Parent: WT-12');
});
