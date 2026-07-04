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

async function columnCardTitles(column: Locator): Promise<string[]> {
  return column.locator('article.work-card a').evaluateAll((links) =>
    links.map((link) => link.textContent?.trim() ?? '')
  );
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      })
    )
    .toBeLessThanOrEqual(1);
}

test('completes the v0.0.3 planning and adoption workflow', async ({ page }) => {
  test.setTimeout(90_000);

  const runId = Date.now();
  const milestone = `E2E milestone ${runId}`;
  const title = `E2E smoke work item ${runId}`;
  const label = `e2e-${runId}`;
  const comment = `E2E smoke comment ${runId}`;
  const editedComment = `Edited E2E smoke comment ${runId}`;

  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Project workspace' })).toBeVisible();

  await page.getByRole('link', { name: 'Worktrail App' }).click();
  await expect(page.getByRole('heading', { name: 'Worktrail App' })).toBeVisible();

  await page.locator('.project-actions').getByRole('link', { name: 'Planning' }).click();
  await expect(page.getByRole('heading', { name: 'Worktrail App' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Planning dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Milestone progress' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blocked work' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /WT-4 .*Choose status transition copy/ }).first()
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overdue work' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /WT-4 .*Choose status transition copy/ }).first()
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stale in-progress work' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /WT-3 .*Implement transport-neutral API handler contract/ }).first()
  ).toBeVisible();

  await page.locator('#milestone-name').fill(milestone);
  await page.locator('#milestone-description').fill('Created by the v0.0.3 Playwright smoke test.');
  await page.getByRole('button', { name: 'Create milestone' }).click();
  await expect(page.getByText('Milestone created.')).toBeVisible();
  await expect(page.getByRole('heading', { name: milestone })).toBeVisible();

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

  await page.getByLabel('Type').selectOption('story');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByLabel('Assignee').selectOption({ label: 'Morgan Maintainer' });
  await page.getByLabel('Milestone').selectOption({ label: milestone });
  await page.getByLabel('Due date').fill('2026-07-16');
  await page.getByLabel('Estimate').fill('2');
  await page.getByLabel(label).check();
  await page.locator('#work-item-title').fill(title);
  await page.locator('#work-item-description').fill('Created by the v0.0.3 Playwright smoke test.');
  await expect(page.locator('#work-item-title')).toHaveValue(title);
  await expect(page.locator('#work-item-description')).toHaveValue(
    'Created by the v0.0.3 Playwright smoke test.'
  );
  await page.getByRole('button', { name: 'Create work item' }).click();

  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(/WT-\d+/)).toBeVisible();
  await expect(page.getByLabel('Metadata').getByText(milestone)).toBeVisible();
  await expect(page.getByLabel('Labels').getByText(label)).toBeVisible();
  await expect(page.getByText('Work item created.')).toBeVisible();

  await page.goto(`/projects/${demoProjectId}/work-items`);
  await page.getByLabel('Milestone').selectOption({ label: milestone });
  await expect(page.getByText(`Milestone: ${milestone}`)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(title) })).toBeVisible();
  await expect(page.getByRole('row', { name: /Define project home summary cards/ })).toHaveCount(0);

  await page.goto(`/projects/${demoProjectId}/board`);
  await expect(page.getByRole('heading', { name: 'Project board' })).toBeVisible();

  const card = page.locator('article.work-card').filter({
    has: page.getByRole('link', { name: title })
  });
  await expect(card).toBeVisible();

  const backlogColumn = page.locator('section.board-column[aria-label="backlog"]');
  const readyColumn = page.locator('section.board-column[aria-label="ready"]');
  await expect(backlogColumn.getByRole('link', { name: title })).toBeVisible();
  await expect(backlogColumn.getByRole('link', { name: 'Define project home summary cards' })).toBeVisible();

  await expect
    .poll(async () => columnCardTitles(backlogColumn))
    .toEqual([title, 'Define project home summary cards']);

  const seededBacklogCard = backlogColumn.locator('article.work-card').filter({
    has: page.getByRole('link', { name: 'Define project home summary cards' })
  });
  await dragCardToColumn(page, seededBacklogCard, backlogColumn);
  await expect
    .poll(async () => columnCardTitles(backlogColumn))
    .toEqual(['Define project home summary cards', title]);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Project board' })).toBeVisible();
  await expect
    .poll(async () => columnCardTitles(page.locator('section.board-column[aria-label="backlog"]')))
    .toEqual(['Define project home summary cards', title]);

  await dragCardToColumn(page, card, readyColumn);
  await expect(readyColumn.getByRole('link', { name: title })).toBeVisible();

  const readyCard = readyColumn.locator('article.work-card').filter({
    has: page.getByRole('link', { name: title })
  });

  const inProgressColumn = page.locator('section.board-column[aria-label="in progress"]');
  await readyCard.getByLabel('Status').selectOption('in_progress');
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

  await page
    .locator('article.comment')
    .filter({ hasText: editedComment })
    .getByRole('button', { name: 'Delete' })
    .click();
  await page.getByRole('button', { name: 'Delete comment' }).click();

  await expect(page.getByText('Comment deleted by Avery Owner')).toBeVisible();
  await expect(page.getByText('Comment deleted.')).toBeVisible();
  await expect(page.getByText('Status changed from ready to in_progress.')).toBeVisible();
});

test('keeps v0.0.3 core pages usable at common desktop widths', async ({ page }) => {
  test.setTimeout(60_000);

  const checks = [
    `/projects/${demoProjectId}/planning`,
    `/projects/${demoProjectId}/work-items`,
    `/projects/${demoProjectId}/board`,
    `/projects/${demoProjectId}/work-items/new`,
    '/work-items/10000000-0000-4000-8000-000000000402'
  ];

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 }
  ]) {
    await page.setViewportSize(viewport);

    for (const path of checks) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText('app works');
      await expect(page.locator('body')).not.toContainText('Project placeholder');
      await expectNoPageOverflow(page);
    }
  }
});
