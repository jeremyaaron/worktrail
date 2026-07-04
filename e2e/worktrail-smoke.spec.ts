import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const demoProjectId = '10000000-0000-4000-8000-000000000201';

async function dragCardToColumn(page: Page, card: Locator, column: Locator): Promise<void> {
  const handleBox = await card.getByRole('button', { name: /Drag WT-/ }).boundingBox();
  const targetBox = await column.locator('.card-stack').boundingBox();

  if (handleBox === null || targetBox === null) {
    throw new Error('Could not locate draggable card handle or target column.');
  }

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 24, { steps: 12 });
  await page.mouse.up();
}

test('completes the v0.0.2 adoption workflow', async ({ page }) => {
  test.setTimeout(90_000);

  const runId = Date.now();
  const title = `E2E smoke work item ${runId}`;
  const label = `e2e-${runId}`;
  const comment = `E2E smoke comment ${runId}`;
  const editedComment = `Edited E2E smoke comment ${runId}`;

  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Project workspace' })).toBeVisible();

  await page.getByRole('link', { name: 'Worktrail App' }).click();
  await expect(page.getByRole('heading', { name: 'Worktrail App' })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Worktrail App' })).toBeVisible();
  await page.locator('#label-name').fill(label);
  await page.locator('#label-color').fill('#0f8a63');
  await page.getByRole('button', { name: 'Create label' }).click();
  await expect(page.getByText('Label created.')).toBeVisible();
  await expect
    .poll(async () =>
      page
        .locator('.label-row input[type="text"]')
        .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))
    )
    .toContain(label);

  await page.getByRole('link', { name: 'Overview' }).click();
  await page.getByRole('link', { name: 'Create work item' }).click();
  await expect(page.getByRole('heading', { name: 'New project work item' })).toBeVisible();

  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill('Created by the v0.0.2 Playwright smoke test.');
  await page.getByLabel('Type').selectOption('story');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByLabel('Assignee').selectOption({ label: 'Morgan Maintainer' });
  await page.getByLabel('Estimate').fill('2');
  await page.getByLabel(label).check();
  await page.getByRole('button', { name: 'Create work item' }).click();

  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(/WT-\d+/)).toBeVisible();
  await expect(page.getByText(label)).toBeVisible();
  await expect(page.getByText('Work item created.')).toBeVisible();

  await page.goto(`/projects/${demoProjectId}/board`);
  await expect(page.getByRole('heading', { name: 'Project board' })).toBeVisible();

  const card = page.locator('article.work-card').filter({
    has: page.getByRole('link', { name: title })
  });
  await expect(card).toBeVisible();

  const backlogColumn = page.locator('section.board-column[aria-label="backlog"]');
  const readyColumn = page.locator('section.board-column[aria-label="ready"]');
  await expect(backlogColumn.getByRole('link', { name: title })).toBeVisible();

  await dragCardToColumn(page, card, readyColumn);
  await expect(readyColumn.getByRole('link', { name: title })).toBeVisible();

  const readyCard = readyColumn.locator('article.work-card').filter({
    has: page.getByRole('link', { name: title })
  });

  const inProgressColumn = page.locator('section.board-column[aria-label="in progress"]');
  await dragCardToColumn(page, readyCard, inProgressColumn);
  await expect(inProgressColumn.getByRole('link', { name: title })).toBeVisible();

  await inProgressColumn.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByLabel('Current status')).toHaveValue('in_progress');

  await page.getByLabel('Add comment').fill(comment);
  await page.getByRole('button', { name: 'Add comment' }).click();

  await expect(page.getByText(comment)).toBeVisible();
  await expect(page.getByText('Comment added.')).toBeVisible();

  const commentCard = page.locator('article.comment').filter({ hasText: comment });
  await commentCard.getByRole('button', { name: 'Edit' }).click();
  await page.locator('form.comment-edit-form').getByLabel('Edit comment').fill(editedComment);
  await page.locator('form.comment-edit-form').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(editedComment)).toBeVisible();
  await expect(page.getByText('Comment edited.')).toBeVisible();

  await page.locator('article.comment').filter({ hasText: editedComment }).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete comment' }).click();

  await expect(page.getByText('Comment deleted by Avery Owner')).toBeVisible();
  await expect(page.getByText('Comment deleted.')).toBeVisible();
  await expect(page.getByText('Status changed from ready to in_progress.')).toBeVisible();
});
