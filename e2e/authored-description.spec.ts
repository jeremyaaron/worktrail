import { expect, test } from '@playwright/test';
import type { WorkItemDetailDto } from '@worktrail/contracts';
import { resetDemoDatabase } from './reset-demo-database';

test.afterAll(resetDemoDatabase);

const projectId = '10000000-0000-4000-8000-000000000201';
const headers = {
  'x-worktrail-workspace-id': '10000000-0000-4000-8000-000000000001',
  'x-worktrail-member-id': '10000000-0000-4000-8000-000000000101'
};
const apiURL = `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? '3000'}/api`;

test('authors descriptions across creation paths, preserves legacy text and drafts, and reuses detail routes', async ({
  page,
  request
}, testInfo) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const source = '  # Shipping notes\n\n**Important** and `literal <code>`\n\n- First\n- Second\n';
  const editor = page.locator('app-authored-content-editor[formcontrolname="descriptionContent"]');
  const summary = page.locator('app-work-item-detail-summary');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/projects/${projectId}/work-items/new`);
  await expect(page.locator('#work-item-description-format')).toHaveValue('markdown_v1');
  await page.locator('#work-item-title').fill(`Formatted description ${suffix}`);
  await page.locator('#work-item-description').fill(source);
  await editor.getByRole('button', { name: 'Preview', exact: true }).click();
  const preview = editor.locator('app-authored-content-viewer');
  await expect(preview.locator('strong')).toHaveText('Important');
  const previewHTML = await preview.innerHTML();
  const createdResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/projects/${projectId}/work-items`)
  );
  await page.getByRole('button', { name: 'Create work item', exact: true }).click();
  const created = (await (await createdResponse).json()) as WorkItemDetailDto;
  expect(created.description).toBe(source);
  expect(created.descriptionFormat).toBe('markdown_v1');
  await page.getByRole('link', { name: 'Open work item', exact: true }).click();
  await expect(summary.locator('strong')).toHaveText('Important');
  expect(await summary.locator('app-authored-content-viewer').innerHTML()).toBe(previewHTML);
  await expect(summary.getByRole('heading', { name: 'Description', level: 2 })).toBeVisible();
  await expect(page.locator('#detail-description')).toHaveValue(source);

  await page.locator('#detail-title').fill(`Renamed description ${suffix}`);
  const patchRequest = page.waitForRequest(
    (req) => req.method() === 'PATCH' && req.url().endsWith(`/work-items/${created.id}`)
  );
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  const patch = (await patchRequest).postDataJSON();
  expect(patch).not.toHaveProperty('description');
  expect(patch).not.toHaveProperty('descriptionFormat');
  await expect(summary.getByRole('heading', { level: 1 })).toHaveText(
    `Renamed description ${suffix}`
  );

  const draft = '  ## Keep this draft\n\n**after failure**\n';
  await page.locator('#detail-description').fill(draft);
  await editor.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.route(`**/api/work-items/${created.id}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Verification failure' } })
      });
    } else {
      await route.continue();
    }
  });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByText('The work item could not be updated.', { exact: true })
  ).toBeVisible();
  await expect(editor.getByRole('region', { name: 'Description preview' })).toContainText(
    'after failure'
  );
  await page.unroute(`**/api/work-items/${created.id}`);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(summary.locator('strong')).toHaveText('after failure');
  await expect(page.locator('#detail-description')).toHaveValue(draft);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1);
    await summary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`summary-${width}.png`) });
    await editor.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`description-${width}.png`) });
    await editor.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`preview-${width}.png`) });
    await editor.getByRole('button', { name: 'Edit', exact: true }).click();
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole('link', { name: 'Add child work item', exact: true }).click();
  await expect(page.locator('#work-item-description')).toHaveValue('');
  await expect(page.locator('#work-item-description-format')).toHaveValue('markdown_v1');
  await page.locator('#work-item-title').fill(`Child description ${suffix}`);
  const childResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/projects/${projectId}/work-items`)
  );
  await page.getByRole('button', { name: 'Create work item', exact: true }).click();
  const child = (await (await childResponse).json()) as WorkItemDetailDto;
  expect(child.description).toBe('');
  expect(child.descriptionFormat).toBe('markdown_v1');
  expect(child.parent?.id).toBe(created.id);

  await page.goto('/work-items/new');
  await page.locator('#work-item-project').selectOption(projectId);
  await expect(page.locator('#work-item-description-format')).toHaveValue('markdown_v1');
  await page.locator('#work-item-title').fill(`Plain description ${suffix}`);
  const legacySource = '  # Literal heading\n**not bold yet**\n';
  await page.locator('#work-item-description-format').selectOption('plain_text');
  await page.locator('#work-item-description').fill(legacySource);
  const plainResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/projects/${projectId}/work-items`)
  );
  await page.getByRole('button', { name: 'Create work item', exact: true }).click();
  const plain = (await (await plainResponse).json()) as WorkItemDetailDto;
  expect(plain.description).toBe(legacySource);
  expect(plain.descriptionFormat).toBe('plain_text');
  await page.getByRole('link', { name: 'Open work item', exact: true }).click();
  await expect(summary.locator('app-authored-content-viewer')).toHaveText(legacySource);
  await expect(summary.locator('strong, h3')).toHaveCount(0);
  await page.locator('#detail-description-format').selectOption('markdown_v1');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.locator('#detail-description-format')).toHaveValue('plain_text');
  await expect(page.locator('#detail-description')).toHaveValue(legacySource);
  await page.locator('#detail-description-format').selectOption('markdown_v1');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(summary.locator('strong')).toHaveText('not bold yet');
  const persisted = await request.get(`${apiURL}/work-items/${plain.id}`, { headers });
  expect(persisted.ok()).toBe(true);
  expect(await persisted.json()).toMatchObject({
    description: legacySource,
    descriptionFormat: 'markdown_v1'
  });

  const relationship = await request.post(`${apiURL}/work-items/${plain.id}/relationships`, {
    headers,
    data: { relationshipType: 'blocks', targetWorkItemId: created.id }
  });
  expect(relationship.ok()).toBe(true);
  await page.reload();
  await page.locator('#detail-description').fill('Unsaved source on old item');
  await page
    .locator(`a[href="/work-items/${created.id}"]`)
    .filter({ hasText: `Renamed description ${suffix}` })
    .click();
  await expect(summary.getByRole('heading', { level: 1 })).toHaveText(
    `Renamed description ${suffix}`
  );
  await expect(page.locator('#detail-description')).toHaveValue(draft);
  await expect(page.locator('#detail-description-format')).toHaveValue('markdown_v1');
  expect(errors).toEqual([]);
});
