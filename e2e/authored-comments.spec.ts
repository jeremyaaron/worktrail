import { expect, test } from '@playwright/test';
import type { CommentDto, NotificationListResponse, WorkItemDetailDto } from '@worktrail/contracts';
import { resetDemoDatabase } from './reset-demo-database';

test.afterAll(resetDemoDatabase);

const projectId = '10000000-0000-4000-8000-000000000201';
const workspaceId = '10000000-0000-4000-8000-000000000001';
const ownerId = '10000000-0000-4000-8000-000000000101';
const contributorId = '10000000-0000-4000-8000-000000000103';
const headers = { 'x-worktrail-workspace-id': workspaceId, 'x-worktrail-member-id': ownerId };
const contributorHeaders = { ...headers, 'x-worktrail-member-id': contributorId };
const apiURL = `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? '3000'}/api`;

test('authors, previews, edits and deletes formatted comments without changing mention or no-op behavior', async ({
  page,
  request
}, testInfo) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const createdResponse = await request.post(`${apiURL}/projects/${projectId}/work-items`, {
    headers,
    data: { title: `Authored discussion ${suffix}`, type: 'task', priority: 'medium' }
  });
  expect(createdResponse.ok()).toBe(true);
  const item = (await createdResponse.json()) as WorkItemDetailDto;
  const watch = await request.put(`${apiURL}/work-items/${item.id}/watch`, {
    headers: contributorHeaders,
    data: {}
  });
  expect(watch.ok()).toBe(true);
  const notifications = async () => {
    const response = await request.get(`${apiURL}/notifications?state=all`, {
      headers: contributorHeaders
    });
    expect(response.ok()).toBe(true);
    return ((await response.json()) as NotificationListResponse).items.filter(
      (notification) => notification.workItem?.id === item.id
    );
  };
  const readDetail = async () => {
    const response = await request.get(`${apiURL}/work-items/${item.id}`, { headers });
    expect(response.ok()).toBe(true);
    return (await response.json()) as WorkItemDetailDto;
  };
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/work-items/${item.id}`);
  const composer = page.locator('form.comment-form');
  await expect(page.locator('#comment-body-format')).toHaveValue('markdown_v1');
  const source =
    `  ## Comment ${suffix}\n\n**Decision** @Avery Owner WT-3\n\n- [Reference](https://example.com/guide)\n` +
    '- `<not HTML>`\n';
  await composer.getByRole('textbox', { name: 'Add comment', exact: true }).fill(source);
  await page.getByLabel('Mention members', { exact: true }).selectOption(contributorId);
  await composer.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(composer.locator('app-authored-content-viewer strong')).toHaveText('Decision');
  const previewHTML = await composer.locator('app-authored-content-viewer').innerHTML();
  const posted = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/work-items/${item.id}/comments`)
  );
  await composer.getByRole('button', { name: 'Add comment', exact: true }).click();
  const post = await posted;
  expect(post.ok()).toBe(true);
  expect(post.request().postDataJSON()).toEqual({
    body: source,
    bodyFormat: 'markdown_v1',
    mentionMemberIds: [contributorId]
  });
  const comment = (await post.json()) as CommentDto;
  expect(comment.body).toBe(source);
  expect(comment.bodyFormat).toBe('markdown_v1');
  const row = page.locator('article.comment').filter({ hasText: `Comment ${suffix}` });
  await expect(row.locator('app-authored-content-viewer strong')).toHaveText('Decision');
  expect(await row.locator('app-authored-content-viewer').innerHTML()).toBe(previewHTML);
  await expect(row.getByLabel('Mentioned members', { exact: true })).toContainText(
    '@Casey Contributor'
  );
  await expect(page.locator('#comment-body')).toHaveValue('');
  await expect(page.getByLabel('Selected mentions', { exact: true })).toHaveCount(0);
  const initialNotifications = await notifications();
  expect(initialNotifications).toHaveLength(1);
  expect(initialNotifications[0].type).toBe('mention');

  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  const edit = page.locator('form.comment-edit-form');
  await expect(edit.getByRole('textbox', { name: 'Edit comment', exact: true })).toHaveValue(
    source
  );
  const editedSource = source.replace('**Decision**', '**Updated decision**');
  await edit.getByRole('textbox', { name: 'Edit comment', exact: true }).fill(editedSource);
  await edit.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(edit.locator('app-authored-content-viewer strong')).toHaveText('Updated decision');
  const patchResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url().endsWith(`/comments/${comment.id}`)
  );
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  const patch = await patchResponse;
  expect(patch.request().postDataJSON()).toEqual({ body: editedSource, bodyFormat: 'markdown_v1' });
  await expect(row.locator('app-authored-content-viewer strong')).toHaveText('Updated decision');
  await expect(row).toContainText('Edited');
  expect((await notifications()).map((notification) => notification.id)).toEqual(
    initialNotifications.map((notification) => notification.id)
  );
  const beforeNoOp = await readDetail();
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  const noOpResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url().endsWith(`/comments/${comment.id}`)
  );
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await noOpResponse).ok()).toBe(true);
  await expect(edit).toHaveCount(0);
  const afterNoOp = await readDetail();
  expect(afterNoOp.activity).toEqual(beforeNoOp.activity);
  expect(afterNoOp.comments[0].updatedAt).toBe(beforeNoOp.comments[0].updatedAt);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await row.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`comment-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await row.getByRole('button', { name: 'Delete comment', exact: true }).click();
  await expect(page.locator('article.comment')).toContainText('Comment deleted');
  await expect(
    page.locator(
      'article.comment app-authored-content-viewer, article.comment app-authored-content-editor'
    )
  ).toHaveCount(0);
  expect(await notifications()).toHaveLength(1);

  const legacySource = `  # Legacy note ${suffix}\n**literal punctuation**\n`;
  const legacyResponse = await request.post(`${apiURL}/work-items/${item.id}/comments`, {
    headers,
    data: { body: legacySource, bodyFormat: 'plain_text' }
  });
  expect(legacyResponse.ok()).toBe(true);
  const legacy = (await legacyResponse.json()) as CommentDto;
  await page.reload();
  const legacyRow = page.locator('article.comment').filter({ hasText: `Legacy note ${suffix}` });
  await expect(legacyRow.locator('app-authored-content-viewer')).toHaveText(legacySource);
  await expect(
    legacyRow.locator('app-authored-content-viewer h3, app-authored-content-viewer strong')
  ).toHaveCount(0);
  await legacyRow.getByRole('button', { name: 'Edit', exact: true }).click();
  await edit.getByLabel('Format', { exact: true }).selectOption('markdown_v1');
  await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Discard', exact: true }).click();
  expect((await readDetail()).comments.find((entry) => entry.id === legacy.id)?.bodyFormat).toBe(
    'plain_text'
  );
  await legacyRow.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(edit.getByRole('textbox', { name: 'Edit comment', exact: true })).toHaveValue(
    legacySource
  );
  await edit.getByLabel('Format', { exact: true }).selectOption('markdown_v1');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(legacyRow.locator('app-authored-content-viewer strong')).toHaveText(
    'literal punctuation'
  );
  const savedLegacy = (await readDetail()).comments.find((entry) => entry.id === legacy.id)!;
  expect(savedLegacy.body).toBe(legacySource);
  expect(savedLegacy.bodyFormat).toBe('markdown_v1');
  expect(await notifications()).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('retains comment source, preview and mentions after a failed post and edit', async ({
  page,
  request
}, testInfo) => {
  test.setTimeout(60_000);
  const response = await request.post(`${apiURL}/projects/${projectId}/work-items`, {
    headers,
    data: { title: `Comment recovery ${Date.now()}`, type: 'task', priority: 'medium' }
  });
  expect(response.ok()).toBe(true);
  const item = (await response.json()) as WorkItemDetailDto;
  await page.goto(`/work-items/${item.id}`);
  const composer = page.locator('form.comment-form');
  const source = '  **Retained draft**\n\n[Reference](https://example.com)\n';
  await page.locator('#comment-body').fill(source);
  await page.getByLabel('Mention members', { exact: true }).selectOption(contributorId);
  await composer.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.route(`**/api/work-items/${item.id}/comments`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
  );
  await composer.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(page.getByText('The comment could not be added.', { exact: true })).toBeVisible();
  await expect(composer.getByRole('region', { name: 'Add comment preview' })).toContainText(
    'Retained draft'
  );
  await expect(page.getByLabel('Selected mentions', { exact: true })).toContainText(
    'Casey Contributor'
  );
  await page.unroute(`**/api/work-items/${item.id}/comments`);
  const posted = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' && res.url().endsWith(`/work-items/${item.id}/comments`)
  );
  await composer.getByRole('button', { name: 'Add comment', exact: true }).click();
  const comment = (await (await posted).json()) as CommentDto;
  expect(comment.body).toBe(source);
  expect(comment.mentions.map((member) => member.id)).toEqual([contributorId]);
  const row = page.locator('article.comment');
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  const edit = page.locator('form.comment-edit-form');
  const editedSource = '  # Retained edit\n**after rejection**\n';
  await edit.getByRole('textbox', { name: 'Edit comment', exact: true }).fill(editedSource);
  await edit.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.route(`**/api/comments/${comment.id}`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
  );
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('The comment could not be updated.', { exact: true })).toBeVisible();
  await expect(edit.getByRole('region', { name: 'Edit comment preview' })).toContainText(
    'after rejection'
  );
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await edit.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`comment-edit-preview-${width}.png`) });
  }
  await page.unroute(`**/api/comments/${comment.id}`);
  await edit.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(edit.getByRole('textbox', { name: 'Edit comment', exact: true })).toHaveValue(
    editedSource
  );
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(row.locator('app-authored-content-viewer strong')).toHaveText('after rejection');
  await expect(row.getByLabel('Mentioned members', { exact: true })).toContainText(
    'Casey Contributor'
  );
});
