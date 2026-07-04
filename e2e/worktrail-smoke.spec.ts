import { expect, test } from '@playwright/test';

const demoProjectId = '10000000-0000-4000-8000-000000000201';

test('completes the seeded MVP workflow', async ({ page }) => {
  const runId = Date.now();
  const title = `E2E smoke work item ${runId}`;
  const comment = `E2E smoke comment ${runId}`;

  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Project workspace' })).toBeVisible();

  await page.getByRole('link', { name: 'Worktrail App' }).click();
  await expect(page.getByRole('heading', { name: 'Worktrail App' })).toBeVisible();

  await page.getByRole('link', { name: 'Create work item' }).click();
  await expect(page.getByRole('heading', { name: 'New project work item' })).toBeVisible();

  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill('Created by the Phase 14 Playwright smoke test.');
  await page.getByLabel('Type').selectOption('story');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByLabel('Assignee').selectOption({ label: 'Morgan Maintainer' });
  await page.getByLabel('Estimate').fill('2');
  await page.getByRole('button', { name: 'Create work item' }).click();

  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText('Work item created.')).toBeVisible();

  await page.goto(`/projects/${demoProjectId}/board`);
  await expect(page.getByRole('heading', { name: 'Project board' })).toBeVisible();

  const card = page.locator('article.work-card').filter({
    has: page.getByRole('link', { name: title })
  });
  await expect(card).toBeVisible();

  await card.getByLabel('Status').selectOption('ready');

  const readyColumn = page.locator('section.board-column[aria-label="ready"]');
  await expect(readyColumn.getByRole('link', { name: title })).toBeVisible();

  await readyColumn
    .locator('article.work-card')
    .filter({ has: page.getByRole('link', { name: title }) })
    .getByLabel('Status')
    .selectOption('in_progress');

  const inProgressColumn = page.locator('section.board-column[aria-label="in progress"]');
  await expect(inProgressColumn.getByRole('link', { name: title })).toBeVisible();

  await inProgressColumn.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByLabel('Current status')).toHaveValue('in_progress');

  await page.getByLabel('Add comment').fill(comment);
  await page.getByRole('button', { name: 'Add comment' }).click();

  await expect(page.getByText(comment)).toBeVisible();
  await expect(page.getByText('Comment added.')).toBeVisible();
  await expect(page.getByText('Status changed from ready to in_progress.')).toBeVisible();
});
