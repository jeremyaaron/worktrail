import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import type { WorkItemDetailDto } from '@worktrail/contracts';
import { resetDemoDatabase } from './reset-demo-database';

test.afterAll(resetDemoDatabase);

const projectId = '10000000-0000-4000-8000-000000000201';
const ownerId = '10000000-0000-4000-8000-000000000101';
const contributorId = '10000000-0000-4000-8000-000000000103';
const headers = { 'x-worktrail-workspace-id': '10000000-0000-4000-8000-000000000001', 'x-worktrail-member-id': ownerId };
const apiURL = `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? '3000'}/api`;

async function createItem(request: APIRequestContext, title: string): Promise<WorkItemDetailDto> {
  const response = await request.post(`${apiURL}/projects/${projectId}/work-items`, {
    headers, data: { title, type: 'task', priority: 'medium', description: 'Original source', descriptionFormat: 'plain_text' }
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<WorkItemDetailDto>;
}

function decision(page: Page) { return page.getByRole('dialog', { name: 'Discard unsaved changes?' }); }
function primary(page: Page) { return page.getByRole('navigation', { name: 'Primary navigation' }); }

test('draft departure protects independent editors, actor storage, native unload and Quick Find route reuse', async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  const a = await createItem(request, `Departure A ${Date.now()}`);
  const b = await createItem(request, `Departure B ${Date.now()}`);
  const link = await request.post(`${apiURL}/work-items/${a.id}/relationships`, {
    headers, data: { relationshipType: 'blocks', targetWorkItemId: b.id }
  });
  expect(link.ok()).toBe(true);
  await page.goto(`/work-items/${a.id}`);
  await expect(page.locator('#detail-title')).toHaveValue(a.title);
  await page.locator('#detail-description').fill('  # Keep source\n**Description draft**\n');
  await page.locator('#detail-description-format').selectOption('markdown_v1');
  await page.locator('#comment-body').fill('**Comment draft**');
  await page.getByLabel('Mention members', { exact: true }).selectOption(contributorId);
  await page.locator('.comment-form').getByRole('button', { name: 'Preview', exact: true }).click();
  await page.locator(`#detail-description`).evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(4, 12));
  await page.locator(`a[href="/work-items/${b.id}"]`).filter({ hasText: b.title }).click();
  await expect(decision(page)).toBeVisible();
  await expect(decision(page).getByRole('button', { name: 'Stay', exact: true })).toBeFocused();
  await expect(decision(page)).toContainText('Work item details, New comment');
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`departure-${width}.png`) });
  }
  await page.keyboard.press('Escape');
  await expect(decision(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/work-items/${a.id}$`));
  await expect(page.locator('#detail-description')).toHaveValue('  # Keep source\n**Description draft**\n');
  await expect(page.locator('.comment-form app-authored-content-viewer strong')).toHaveText('Comment draft');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#current-member').selectOption(contributorId);
  await expect(decision(page)).toBeVisible();
  await expect(page.locator('#current-member')).toHaveValue(ownerId);
  expect(await page.evaluate(() => localStorage.getItem('worktrail.selectedMemberId'))).toBe(ownerId);
  await decision(page).getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(page.locator('#current-member')).toBeFocused();
  expect(await page.locator('#detail-description').evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([4, 12]);

  const nativeWarning = page.waitForEvent('dialog', { timeout: 5000 });
  await page.close({ runBeforeUnload: true });
  const warning = await nativeWarning;
  expect(warning.type()).toBe('beforeunload');
  await warning.dismiss();
  await expect(page.locator('#detail-description')).toHaveValue('  # Keep source\n**Description draft**\n');

  await page.getByRole('button', { name: 'Open Quick Find', exact: true }).click();
  const quickFind = page.getByRole('dialog', { name: 'Quick Find', exact: true });
  await quickFind.locator('#quick-find-query').fill(b.displayKey);
  const result = quickFind.getByRole('option').filter({ hasText: b.title });
  await result.click();
  await decision(page).getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(quickFind).toBeVisible();
  await expect(quickFind.locator('#quick-find-query')).toHaveValue(b.displayKey);
  await expect(quickFind.locator('#quick-find-query')).toBeFocused();
  await result.click();
  await decision(page).getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/work-items/${b.id}$`));
  await expect(quickFind).toBeHidden();
  await expect(page.locator('#detail-title')).toHaveValue(b.title);
  await expect(page.locator('#detail-description')).toHaveValue('Original source');
  await expect(page.locator('#comment-body')).toHaveValue('');
});

test('draft departure protects creation project changes and blocks departure during an unresolved create', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/work-items/new');
  await page.locator('#work-item-project').selectOption(projectId);
  await page.locator('#work-item-title').fill('Creation draft');
  await page.locator('#work-item-description').fill('  **Keep creation source**\n');
  const otherProject = await page.locator('#work-item-project option').evaluateAll((options, current) =>
    options.map((option) => (option as HTMLOptionElement).value).find((value) => value !== '' && value !== current), projectId);
  expect(otherProject).toBeTruthy();
  await page.locator('#work-item-project').selectOption(otherProject!);
  await decision(page).getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(page.locator('#work-item-project')).toHaveValue(projectId);
  await expect(page.locator('#work-item-title')).toHaveValue('Creation draft');
  await page.locator('#work-item-project').selectOption(otherProject!);
  await decision(page).getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.locator('#work-item-project')).toHaveValue(otherProject!);
  await expect(page.locator('#work-item-title')).toHaveValue('');
  await page.locator('#work-item-title').fill('Pending creation');
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/projects/*/work-items', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await wait;
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Expected failure' } }) });
  });
  await page.getByRole('button', { name: 'Create work item', exact: true }).click();
  await expect(page.locator('#work-item-title')).toBeDisabled();
  await primary(page).getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Draft departure status' })).toContainText('save to finish');
  await expect(decision(page)).toBeHidden();
  await expect(page).toHaveURL(/\/work-items\/new$/);
  release();
  await expect(page.getByText('Expected failure', { exact: true })).toBeVisible();
  await expect(page.locator('#work-item-title')).toBeEnabled();
  await expect(page.locator('#work-item-title')).toHaveValue('Pending creation');
  await primary(page).getByRole('link', { name: 'Projects', exact: true }).click();
  await decision(page).getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
});

test('draft departure preserves report narratives on Stay and failure, then publishes without another prompt', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(`/projects/${projectId}/status/new`);
  await expect(page.locator('#report-summary')).not.toHaveValue('');
  const summary = 'My narrative survives rejected departures and a failed publish.';
  await page.locator('#report-summary').fill(summary);
  await primary(page).getByRole('link', { name: 'My Work', exact: true }).click();
  await decision(page).getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(page.locator('#report-summary')).toHaveValue(summary);
  await page.route(`**/api/projects/${projectId}/status-reports`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Expected publish failure' } }) });
  });
  await page.getByRole('button', { name: 'Publish report', exact: true }).click();
  await expect(page.getByText('Expected publish failure', { exact: true })).toBeVisible();
  await expect(page.locator('#report-summary')).toHaveValue(summary);
  await page.unroute(`**/api/projects/${projectId}/status-reports`);
  await page.getByRole('button', { name: 'Publish report', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/status/[0-9a-f-]+$`));
  await expect(decision(page)).toBeHidden();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
});
