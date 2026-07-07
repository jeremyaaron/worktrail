import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';
import type { APIRequestContext, Download, Locator, Page } from '@playwright/test';

const demoProjectId = '10000000-0000-4000-8000-000000000201';

interface CreatedWorkItem {
  id: string;
  displayKey: string;
  title: string;
}

interface CreateWorkItemInput {
  title: string;
  description: string;
  status: 'ready' | 'in_progress';
  priority: 'medium' | 'high';
}

function apiBaseURL(): string {
  const apiPort = Number.parseInt(process.env.API_PORT ?? '3000', 10);
  const host = process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1';
  return `http://${host}:${apiPort}`;
}

async function createProjectWorkItem(
  request: APIRequestContext,
  input: CreateWorkItemInput
): Promise<CreatedWorkItem> {
  const response = await request.post(`${apiBaseURL()}/api/projects/${demoProjectId}/work-items`, {
    data: {
      title: input.title,
      description: input.description,
      type: 'task',
      status: input.status,
      priority: input.priority
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to create e2e work item: ${response.status()} ${await response.text()}`);
  }

  return (await response.json()) as CreatedWorkItem;
}

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

async function expectFocused(locator: Locator): Promise<void> {
  await expect
    .poll(async () =>
      locator.evaluate((element) => element === element.ownerDocument.activeElement)
    )
    .toBe(true);
}

function projectShellHeading(page: Page, name: string): Locator {
  return page.locator('.project-shell__header').getByRole('heading', { name });
}

async function openSavedViewManager(page: Page): Promise<void> {
  const manager = page.locator('details.saved-view-manager');

  await expect(manager).toBeVisible();

  if (!(await manager.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await manager.locator('summary').click();
  }
}

async function downloadText(download: Download): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'worktrail-download-'));
  const filePath = join(directory, download.suggestedFilename());

  try {
    await download.saveAs(filePath);
    return await readFile(filePath, 'utf8');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runNpmScript(script: string): void {
  execFileSync('npm', ['run', script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });
}

test.afterAll(() => {
  if (process.env.WORKTRAIL_E2E_SKIP_DB_RESTORE === 'true') {
    return;
  }

  runNpmScript('db:reset');
  runNpmScript('db:migrate');
  runNpmScript('db:seed');
});

test('completes the v0.0.4 workspace governance workflow', async ({ page }) => {
  test.setTimeout(90_000);

  const suffix = Date.now().toString(36).slice(-5).toUpperCase();
  const memberName = `E2E Governance ${suffix}`;
  const memberEmail = `governance-${suffix.toLowerCase()}@example.com`;
  const projectKey = `E2E${suffix}`.slice(0, 8);
  const projectName = `E2E Governance Project ${suffix}`;

  await page.goto('/workspace/settings');
  await expect(page.getByRole('heading', { name: 'Worktrail Demo' })).toBeVisible();
  await expect(page.getByText('Avery Owner is acting as owner.')).toBeVisible();

  await page.locator('#member-name').fill(memberName);
  await page.locator('#member-email').fill(memberEmail);
  await page.locator('#member-role').selectOption('contributor');
  await page.getByRole('button', { name: 'Create member' }).click();
  await expect(page.getByText('Member created.')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(memberName) })).toBeVisible();
  await expect(page.locator('#current-member')).toContainText(`${memberName} · contributor`);

  const memberRow = page.getByRole('row', { name: new RegExp(memberName) });
  await memberRow.locator('select').selectOption('maintainer');
  await memberRow.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Member saved.')).toBeVisible();
  await expect(page.locator('#current-member')).toContainText(`${memberName} · maintainer`);

  await page.locator('#current-member').selectOption({ label: `${memberName} · maintainer` });
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Project workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create project' })).toBeEnabled();
  await expect(page.getByText('Owners and maintainers can create projects.')).toHaveCount(0);

  await page.locator('#project-key').fill(projectKey);
  await page.locator('#project-name').fill(projectName);
  await page.locator('#project-description').fill('Created by the v0.0.4 governance smoke test.');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText('Project created.')).toBeVisible();
  await expect(page.getByRole('link', { name: projectName })).toBeVisible();
  await expect(page.getByText(projectKey)).toBeVisible();

  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });
  await page.goto('/workspace/settings');
  await expect(page.getByText('Avery Owner is acting as owner.')).toBeVisible();

  const promotedMemberRow = page.getByRole('row', { name: new RegExp(memberName) });
  await promotedMemberRow.getByRole('button', { name: 'Deactivate' }).click();
  await promotedMemberRow.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Member deactivated.')).toBeVisible();
  await expect(page.locator('#current-member')).not.toContainText(memberName);

  const deactivatedMemberRow = page.getByRole('row', { name: new RegExp(memberName) });
  await expect(deactivatedMemberRow.getByText('Inactive')).toBeVisible();
  await deactivatedMemberRow.getByRole('button', { name: 'Reactivate' }).click();
  await deactivatedMemberRow.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Member reactivated.')).toBeVisible();
  await expect(page.locator('#current-member')).toContainText(`${memberName} · maintainer`);

  await expect(page.getByText(`${memberName} added to the workspace as contributor.`)).toBeVisible();
  await expect(
    page.getByText(`${memberName} role changed from contributor to maintainer.`)
  ).toBeVisible();
  await expect(page.getByText(`${memberName} deactivated.`)).toBeVisible();
  await expect(page.getByText(`${memberName} reactivated.`)).toBeVisible();
});

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
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();

  await page.locator('.project-actions').getByRole('link', { name: 'Planning' }).click();
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Planning dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Milestone progress' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blocked work', exact: true })).toBeVisible();
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

  await page.getByRole('button', { name: 'Milestones' }).click();
  await page.locator('#milestone-name').fill(milestone);
  await page.locator('#milestone-description').fill('Created by the v0.0.3 Playwright smoke test.');
  await page.getByRole('button', { name: 'Create milestone' }).click();
  await expect(page.getByText('Milestone created.')).toBeVisible();
  await expect(page.getByRole('heading', { name: milestone })).toBeVisible();

  await page.getByLabel('Project sections').getByRole('link', { name: 'Settings' }).click();
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();
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

  await page.getByLabel('Project sections').getByRole('link', { name: 'Overview' }).click();
  await page.locator('.project-actions').getByRole('link', { name: 'Create work item' }).click();
  await expect(page.getByRole('heading', { name: 'New project work item' })).toBeVisible();

  await page.locator('select[formcontrolname="type"]').selectOption('story');
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

  await expect(page.getByLabel('Work item created')).toContainText(title);
  await page.getByRole('link', { name: 'Open work item' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(/WT-\d+/)).toBeVisible();
  await expect(page.getByLabel('Metadata').getByText(milestone)).toBeVisible();
  await expect(page.getByLabel('Work item summary').getByText(label)).toBeVisible();
  await expect(page.getByText('Work item created.')).toBeVisible();

  await page.goto(`/projects/${demoProjectId}/work-items`);
  await page.getByText('Advanced filters').click();
  await page.getByLabel('Milestone').selectOption({ label: milestone });
  await expect(page.getByText(`Milestone: ${milestone}`)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(title) })).toBeVisible();

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

test('completes the v0.0.5 daily workspace workflow', async ({ page }) => {
  test.setTimeout(90_000);

  const runId = Date.now();
  const savedViewName = `E2E daily owner work ${runId}`;
  const title = `E2E quick capture ${runId}`;
  const description = `Created by the v0.0.5 daily workflow smoke test ${runId}.`;

  await page.goto('/my-work');
  await expect(page.getByRole('heading', { name: 'My work' })).toBeVisible();
  await expect(page.locator('main').getByText('Avery Owner · Owner', { exact: true })).toBeVisible();
  await expect(page.getByLabel('My Work summary')).toContainText('Assigned open');

  await page.locator('.summary-card').filter({ hasText: 'Assigned open' }).click();
  await expect(page.getByLabel('Active My Work filter')).toContainText('Queue focus: Assigned open');
  await page.getByRole('link', { name: 'Open full list' }).click();
  await expect(page).toHaveURL(/\/work-items\?/);
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await expect(page.getByText('Assignee: Avery Owner')).toBeVisible();
  await expect(page.getByRole('row', { name: /Document future S3 and API Gateway deployment path/ })).toBeVisible();

  const filterSearch = page.locator('form.filters').getByLabel('Search');
  await filterSearch.focus();
  await expectFocused(filterSearch);

  const savedViewNameInput = page.locator('form.saved-view-form').getByLabel('Name');
  await savedViewNameInput.fill(savedViewName);
  await expectFocused(savedViewNameInput);
  await page.getByRole('button', { name: 'Save personal view' }).click();
  await expect(page.getByRole('region', { name: 'Saved views' })).toContainText(
    /5 shared · \d+ personal/
  );

  await openSavedViewManager(page);
  const savedViewRow = page.locator('article.saved-view-row').filter({ hasText: savedViewName });
  await expect(savedViewRow).toBeVisible();
  await expect(savedViewRow).toContainText(/applied filters/);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await openSavedViewManager(page);
  const reloadedSavedViewRow = page.locator('article.saved-view-row').filter({ hasText: savedViewName });
  await expect(reloadedSavedViewRow).toBeVisible();
  const openSavedView = reloadedSavedViewRow.getByRole('button', { name: 'Open' });
  await openSavedView.focus();
  await expectFocused(openSavedView);
  await openSavedView.click();
  await expect(page.getByText('Assignee: Avery Owner')).toBeVisible();
  await expect(page.getByRole('row', { name: /Document future S3 and API Gateway deployment path/ })).toBeVisible();

  await page.goto('/work-items/new');
  await expect(page.getByRole('heading', { name: 'New work item' })).toBeVisible();

  const projectSelect = page.getByLabel('Project');
  await projectSelect.focus();
  await expectFocused(projectSelect);
  await projectSelect.selectOption({ label: 'WT · Worktrail App' });

  await page.locator('#work-item-title').focus();
  await expectFocused(page.locator('#work-item-title'));
  await page.locator('#work-item-title').fill(title);
  await page.locator('#work-item-description').fill(description);
  await page.locator('select[formcontrolname="type"]').selectOption('task');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByLabel('Assignee').selectOption({ label: 'Avery Owner' });
  await page.getByLabel('Due date').fill('2026-07-18');
  await page.getByLabel('Estimate').fill('1');
  await expect(page.getByLabel('backend')).toBeVisible();
  await page.getByLabel('backend').check();
  await page.getByRole('button', { name: 'Create work item' }).click();

  await expect(page.getByLabel('Work item created')).toContainText(title);
  await expect(page.getByText(/WT-\d+ created/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open work item' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create another' })).toBeVisible();

  await page.goto('/work-items');
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await page.locator('form.filters').getByLabel('Search').fill(title);
  await expect(page).toHaveURL(/search=/);
  await expect(page.getByText(`Search: ${title}`)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(title) })).toBeVisible();
});

test('persists v0.1.2 workspace filters through URL reloads', async ({ page, request }) => {
  test.setTimeout(60_000);

  const runId = Date.now();
  const title = `E2E filtered URL ${runId}`;

  await createProjectWorkItem(request, {
    title,
    description: 'Created by the v0.1.2 filtered URL Playwright smoke test.',
    status: 'ready',
    priority: 'high'
  });

  await page.goto('/work-items');
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();

  await page.locator('form.filters').getByLabel('Search').fill(title);
  await expect(page).toHaveURL(/search=/);
  await expect(page.getByText(`Search: ${title}`)).toBeVisible();

  await page.locator('form.filters').getByLabel('Status').selectOption('ready');
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByText('Status: Ready')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(title) })).toBeVisible();

  const filteredUrl = page.url();

  await page.reload();
  await expect(page).toHaveURL(filteredUrl);
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await expect(page.getByText(`Search: ${title}`)).toBeVisible();
  await expect(page.getByText('Status: Ready')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(title) })).toBeVisible();
});

test('opens v0.1.3 shared views as owner and contributor', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/work-items');
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });
  const savedViewsRegion = page.getByRole('region', { name: 'Saved views' });
  await expect(savedViewsRegion).toContainText('5 shared');
  await expect(page.getByRole('button', { name: 'Save shared view' })).toBeVisible();

  await openSavedViewManager(page);
  const ownerSharedViewRow = page
    .getByLabel('Shared views')
    .locator('article.saved-view-row')
    .filter({ hasText: 'Dependency risks' });
  await expect(ownerSharedViewRow).toBeVisible();
  await expect(ownerSharedViewRow.getByRole('button', { name: 'Rename' })).toBeVisible();
  await expect(ownerSharedViewRow.getByRole('button', { name: 'Update query' })).toBeVisible();
  await expect(ownerSharedViewRow.getByRole('button', { name: 'Delete' })).toBeVisible();

  await ownerSharedViewRow.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveURL(/dependency=dependency_blocked/);
  await expect(page.getByText('Dependency: Blocked by open work')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto('/work-items');
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await expect(savedViewsRegion).toContainText('5 shared');
  await expect(page.getByText('Owners and maintainers manage shared saved views.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save shared view' })).toHaveCount(0);

  await openSavedViewManager(page);
  const contributorSharedViewRow = page
    .getByLabel('Shared views')
    .locator('article.saved-view-row')
    .filter({ hasText: 'Dependency risks' });
  await expect(contributorSharedViewRow).toBeVisible();
  await expect(contributorSharedViewRow.getByRole('button', { name: 'Open' })).toBeVisible();
  await expect(contributorSharedViewRow.getByRole('button', { name: 'Rename' })).toHaveCount(0);
  await expect(contributorSharedViewRow.getByRole('button', { name: 'Update query' })).toHaveCount(0);
  await expect(contributorSharedViewRow.getByRole('button', { name: 'Delete' })).toHaveCount(0);

  await contributorSharedViewRow.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveURL(/dependency=dependency_blocked/);
  await expect(page.getByText('Dependency: Blocked by open work')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();
});

test('opens and saves v0.1.4 project saved views as owner and contributor', async ({ page }) => {
  test.setTimeout(60_000);

  const runId = Date.now();
  const personalViewName = `E2E project ready ${runId}`;

  await page.goto(`/projects/${demoProjectId}/work-items`);
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });

  const savedViewsRegion = page.getByRole('region', { name: 'Saved views' });
  await expect(savedViewsRegion).toContainText(/5 shared · \d+ personal/);
  await expect(page.getByRole('button', { name: 'Save shared view' })).toBeVisible();

  await openSavedViewManager(page);
  const ownerReadyForQaRow = page
    .getByLabel('Shared project views')
    .locator('article.saved-view-row')
    .filter({ hasText: 'Ready for QA' });
  await expect(ownerReadyForQaRow).toBeVisible();
  await expect(ownerReadyForQaRow).toContainText('2 applied filters');
  await expect(ownerReadyForQaRow.getByRole('button', { name: 'Rename' })).toBeVisible();
  await expect(ownerReadyForQaRow.getByRole('button', { name: 'Update query' })).toBeVisible();
  await expect(ownerReadyForQaRow.getByRole('button', { name: 'Delete' })).toBeVisible();

  await ownerReadyForQaRow.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/projects\/10000000-0000-4000-8000-000000000201\/work-items\?/);
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByText('Status: ready')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();

  await page.locator('form.saved-view-form').getByLabel('Name').fill(personalViewName);
  await page.getByRole('button', { name: 'Save personal view' }).click();
  await expect(savedViewsRegion).toContainText(/5 shared · \d+ personal/);

  const personalSavedViewRow = page
    .getByLabel('Personal project views')
    .locator('article.saved-view-row')
    .filter({ hasText: personalViewName });
  await expect(personalSavedViewRow).toBeVisible();
  await expect(personalSavedViewRow).toContainText('2 applied filters');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await openSavedViewManager(page);
  const reloadedPersonalSavedViewRow = page
    .getByLabel('Personal project views')
    .locator('article.saved-view-row')
    .filter({ hasText: personalViewName });
  await expect(reloadedPersonalSavedViewRow).toBeVisible();
  await reloadedPersonalSavedViewRow.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByText('Status: ready')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto(`/projects/${demoProjectId}/work-items`);
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await expect(savedViewsRegion).toContainText('5 shared');
  await expect(page.getByText('Owners and maintainers manage shared project views.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save shared view' })).toHaveCount(0);
  await openSavedViewManager(page);

  const contributorReadyForQaRow = page
    .getByLabel('Shared project views')
    .locator('article.saved-view-row')
    .filter({ hasText: 'Ready for QA' });
  await expect(contributorReadyForQaRow).toBeVisible();
  await expect(contributorReadyForQaRow.getByText('Shared by Avery Owner')).toBeVisible();
  await expect(contributorReadyForQaRow.getByRole('button', { name: 'Open' })).toBeVisible();
  await expect(contributorReadyForQaRow.getByRole('button', { name: 'Rename' })).toHaveCount(0);
  await expect(contributorReadyForQaRow.getByRole('button', { name: 'Update query' })).toHaveCount(0);
  await expect(contributorReadyForQaRow.getByRole('button', { name: 'Delete' })).toHaveCount(0);

  await contributorReadyForQaRow.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByText('Status: ready')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();
});

test('opens seeded v0.1.5 pinned workspace and project saved views', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/work-items');
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });

  await expect(page.getByRole('heading', { name: 'Pinned views' })).toBeVisible();
  await expect(page.getByLabel('Pinned saved view shortcuts')).toContainText('Dependency risks');
  await expect(page.getByLabel('Pinned saved view shortcuts')).toContainText('Ready for pickup');

  await page.getByRole('button', { name: 'Open pinned shared view Dependency risks' }).click();
  await expect(page).toHaveURL(/dependency=dependency_blocked/);
  await expect(page.getByText('Dependency: Blocked by open work')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto('/work-items');
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open pinned shared view Dependency risks' })).toBeVisible();
  await openSavedViewManager(page);

  const contributorWorkspacePinnedRow = page
    .getByLabel('Shared views')
    .locator('article.saved-view-row')
    .filter({ hasText: 'Dependency risks' });
  await expect(contributorWorkspacePinnedRow).toBeVisible();
  await expect(contributorWorkspacePinnedRow.getByRole('button', { name: 'Open' })).toBeVisible();
  await expect(contributorWorkspacePinnedRow.getByRole('button', { name: 'Pin' })).toHaveCount(0);
  await expect(contributorWorkspacePinnedRow.getByRole('button', { name: 'Unpin' })).toHaveCount(0);

  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });
  await page.goto(`/projects/${demoProjectId}/work-items`);
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project pinned views' })).toBeVisible();
  await expect(page.getByLabel('Pinned saved view shortcuts')).toContainText('Ready for QA');
  await expect(page.getByLabel('Pinned saved view shortcuts')).toContainText('Release blockers');

  await page.getByRole('button', { name: 'Open pinned shared view Ready for QA' }).click();
  await expect(page).toHaveURL(/\/projects\/10000000-0000-4000-8000-000000000201\/work-items\?/);
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByText('Status: ready')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto(`/projects/${demoProjectId}/work-items`);
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open pinned shared view Ready for QA' })).toBeVisible();
  await openSavedViewManager(page);

  const contributorProjectPinnedRow = page
    .getByLabel('Shared project views')
    .locator('article.saved-view-row')
    .filter({ hasText: 'Ready for QA' });
  await expect(contributorProjectPinnedRow).toBeVisible();
  await expect(contributorProjectPinnedRow.getByRole('button', { name: 'Open' })).toBeVisible();
  await expect(contributorProjectPinnedRow.getByRole('button', { name: 'Pin' })).toHaveCount(0);
  await expect(contributorProjectPinnedRow.getByRole('button', { name: 'Unpin' })).toHaveCount(0);
});

test('bulk triages seeded project work and hides controls for contributors', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto(`/projects/${demoProjectId}/work-items`);
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });

  const wt2Row = page.getByRole('row', { name: /Add filter controls to work item list/ });
  const wt3Row = page.getByRole('row', {
    name: /Implement transport-neutral API handler contract/
  });
  await expect(wt2Row).toBeVisible();
  await expect(wt3Row).toBeVisible();
  await expect(wt2Row).not.toContainText('design');
  await expect(wt3Row).not.toContainText('design');

  const workItemTable = page.locator('.work-item-table');
  await workItemTable.getByLabel('Select WT-2').check();
  await workItemTable.getByLabel('Select WT-3').check();
  const bulkActions = page.getByLabel('Bulk work item actions');
  await expect(bulkActions).toContainText('2 selected');

  await bulkActions.locator('select[formcontrolname="actionType"]').selectOption('add_labels');
  await bulkActions.getByLabel('Add label design').check();
  await bulkActions.getByRole('button', { name: 'Apply' }).click();

  const resultCounts = page.getByLabel('Bulk update result counts');
  await expect(page.getByText('Bulk update complete')).toBeVisible();
  await expect(resultCounts).toContainText('Updated');
  await expect(resultCounts).toContainText('2');
  await expect(resultCounts).toContainText('Unchanged');
  await expect(resultCounts).toContainText('0');
  await expect(resultCounts).toContainText('Failed');
  await expect(resultCounts).toContainText('0');

  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toContainText(
    'design'
  );
  await expect(
    page.getByRole('row', { name: /Implement transport-neutral API handler contract/ })
  ).toContainText('design');

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto(`/projects/${demoProjectId}/work-items`);
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await expect(page.getByLabel('Select WT-2')).toHaveCount(0);
  await expect(page.getByLabel('Select all visible work items')).toHaveCount(0);
  await expect(page.getByLabel('Bulk work item actions')).toHaveCount(0);
});

test('creates and opens a v0.1.5 pinned personal workspace saved view shortcut', async ({ page }) => {
  test.setTimeout(60_000);

  const savedViewName = `E2E pinned personal ${Date.now()}`;

  await page.goto('/work-items');
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });
  await page.getByText('Advanced filters').click();
  await page.locator('form.filters').getByLabel('Assignee').selectOption({ label: 'Avery Owner' });
  await expect(page).toHaveURL(/assigneeId=10000000-0000-4000-8000-000000000101/);
  await expect(page.getByText('Assignee: Avery Owner')).toBeVisible();

  await openSavedViewManager(page);
  const seededSavedViewRow = page
    .getByLabel('Personal views')
    .locator('article.saved-view-row')
    .filter({ hasText: 'My open work' });
  await expect(seededSavedViewRow).toBeVisible();
  await seededSavedViewRow.getByRole('button', { name: 'Pin' }).click();
  await expect(page.getByRole('button', { name: 'Open pinned personal view My open work' })).toBeVisible();

  await page.locator('form.saved-view-form').getByLabel('Name').fill(savedViewName);
  await page.getByRole('button', { name: 'Save personal view' }).click();
  await expect(page.getByRole('region', { name: 'Saved views' })).toContainText(
    /5 shared · \d+ personal/
  );

  await openSavedViewManager(page);
  const savedViewRow = page
    .getByLabel('Personal views')
    .locator('article.saved-view-row')
    .filter({ hasText: savedViewName });
  await expect(savedViewRow).toBeVisible();
  await savedViewRow.getByRole('button', { name: 'Pin' }).click();

  await expect(
    page.getByRole('button', { name: `Open pinned personal view ${savedViewName}` })
  ).toBeVisible();
  await page.goto('/work-items');
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Open pinned personal view ${savedViewName}` })
  ).toBeVisible();

  await page.getByRole('button', { name: `Open pinned personal view ${savedViewName}` }).click();
  await expect(page).toHaveURL(/assigneeId=10000000-0000-4000-8000-000000000101/);
  await expect(page.getByText('Assignee: Avery Owner')).toBeVisible();
  await expect(page.getByRole('row', { name: /Document future S3 and API Gateway deployment path/ })).toBeVisible();
});

test('validates the v0.0.8 dependency workflow', async ({ page, request }) => {
  test.setTimeout(90_000);

  const runId = Date.now();
  const blockerTitle = `E2E dependency blocker ${runId}`;
  const blockedTitle = `E2E dependency target ${runId}`;
  const savedViewName = `E2E dependency blocked ${runId}`;

  const blocker = await createProjectWorkItem(request, {
    title: blockerTitle,
    description: 'Created by the v0.0.8 dependency workflow smoke test.',
    status: 'in_progress',
    priority: 'high'
  });
  const blocked = await createProjectWorkItem(request, {
    title: blockedTitle,
    description: 'Created by the v0.0.8 dependency workflow smoke test.',
    status: 'ready',
    priority: 'medium'
  });

  await page.goto(`/work-items/${blocked.id}`);
  await expect(page.getByRole('heading', { name: blockedTitle })).toBeVisible();

  const relationshipPanel = page.locator('.relationship-panel');
  await relationshipPanel.getByLabel('Relationship').selectOption('blocked_by');
  await relationshipPanel.getByLabel('Find work item').fill(blockerTitle);
  await relationshipPanel.getByRole('button', { name: 'Search' }).click();

  const blockerCandidate = page
    .getByLabel('Relationship candidates')
    .getByRole('button', { name: new RegExp(blockerTitle) });
  await expect(blockerCandidate).toBeVisible();
  await blockerCandidate.click();
  await relationshipPanel.getByRole('button', { name: 'Add blocker' }).click();

  await expect(relationshipPanel.getByRole('region', { name: 'Blocked by' })).toContainText(
    blockerTitle
  );

  await page.goto(`/work-items?dependency=dependency_blocked&search=${encodeURIComponent(blockedTitle)}`);
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await expect(page.getByText('Dependency: Blocked by open work')).toBeVisible();
  await expect(page.getByText(`Search: ${blockedTitle}`)).toBeVisible();

  const dependencyRow = page.getByRole('row', { name: new RegExp(blockedTitle) });
  await expect(dependencyRow).toBeVisible();
  await expect(dependencyRow).toContainText('Blocked by 1');

  await page.locator('form.saved-view-form').getByLabel('Name').fill(savedViewName);
  await page.getByRole('button', { name: 'Save personal view' }).click();
  await expect(page.getByRole('region', { name: 'Saved views' })).toContainText(
    /5 shared · \d+ personal/
  );

  await openSavedViewManager(page);
  const savedViewRow = page.locator('article.saved-view-row').filter({ hasText: savedViewName });
  await expect(savedViewRow).toBeVisible();
  await expect(savedViewRow).toContainText(/applied filters/);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await openSavedViewManager(page);
  const reloadedSavedViewRow = page.locator('article.saved-view-row').filter({ hasText: savedViewName });
  await expect(reloadedSavedViewRow).toBeVisible();
  await reloadedSavedViewRow.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByText('Dependency: Blocked by open work')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(blockedTitle) })).toBeVisible();

  await page.goto(`/work-items/${blocker.id}`);
  await expect(page.getByRole('heading', { name: blockerTitle })).toBeVisible();
  await page.getByLabel('Current status').selectOption('done');
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.getByLabel('Current status')).toHaveValue('done');
  await expect(page.getByText('Status changed from in_progress to done.')).toBeVisible();

  await page.goto(`/work-items?dependency=dependency_blocked&search=${encodeURIComponent(blockedTitle)}`);
  await expect(page.getByText('Dependency: Blocked by open work')).toBeVisible();
  await expect(page.getByText(`Search: ${blockedTitle}`)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(blockedTitle) })).toHaveCount(0);
  await expect(page.getByText('No work items match these filters')).toBeVisible();
});

test('surfaces v0.0.9 delivery health on project overview and planning', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto(`/projects/${demoProjectId}`);
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();
  await expect(page.getByText('Delivery health', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blocked', exact: true })).toBeVisible();
  await expect(page.getByLabel('Delivery health metrics')).toContainText('Active milestones');
  await expect(page.getByLabel('Delivery health reasons')).toContainText(/blocked work items?/);

  await page.getByRole('link', { name: 'Open planning' }).click();
  await expect(page.getByRole('heading', { name: 'Planning dashboard' })).toBeVisible();
  await expect(page.getByText('Delivery health', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blocked', exact: true })).toBeVisible();
  await expect(page.getByLabel('Delivery health counts')).toContainText('Open work');
  await expect(page.getByRole('heading', { name: 'Milestone progress' })).toBeVisible();
  await expect(
    page.locator('.progress-list').getByRole('link', { name: 'v0.0.3 Planning', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recently changed' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /WT-4 .*Choose status transition copy/ }).first()
  ).toBeVisible();

  await page.getByRole('link', { name: /^\d+ blocked work items?$/ }).first().click();
  await expect(page).toHaveURL(/\/projects\/10000000-0000-4000-8000-000000000201\/work-items\?/);
  await expect(page).toHaveURL(/status=blocked/);
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await expect(page.getByText('Status: Blocked')).toBeVisible();
  await expect(
    page.getByRole('row', { name: /Choose status transition copy.*WT-4/ })
  ).toBeVisible();
});

test('completes the v0.1.1 inbox mention workflow', async ({ page }) => {
  test.setTimeout(90_000);

  const comment = `E2E mention notification ${Date.now()}`;
  const wt3Id = '10000000-0000-4000-8000-000000000403';

  await page.goto('/inbox');
  await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ unread notifications?\./)).toBeVisible();
  await expect(page.getByText('WT-3 moved from ready to in_progress.')).toBeVisible();

  await page.goto(`/work-items/${wt3Id}`);
  await expect(
    page.getByRole('heading', { name: 'Implement transport-neutral API handler contract' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Watchers' })).toBeVisible();
  await expect(page.locator('.watch-panel')).toContainText('3 watching');

  const watchPanel = page.locator('.watch-panel');
  await watchPanel.getByRole('button', { name: 'Unwatch' }).click();
  await expect(watchPanel.getByRole('button', { name: 'Watch' })).toBeVisible();
  await watchPanel.getByRole('button', { name: 'Watch' }).click();
  await expect(watchPanel.getByRole('button', { name: 'Unwatch' })).toBeVisible();

  await page.getByLabel('Add comment').fill(comment);
  await page.getByLabel('Mention members').selectOption({ label: 'Casey Contributor' });
  await expect(page.getByLabel('Selected mentions')).toContainText('Casey Contributor');
  await page.getByRole('button', { name: 'Add comment' }).click();

  const createdComment = page.locator('article.comment').filter({ hasText: comment });
  await expect(createdComment).toBeVisible();
  await expect(createdComment.getByLabel('Mentioned members')).toContainText('@Casey Contributor');
  await expect(page.getByText('Comment added.')).toBeVisible();

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto('/inbox');
  await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible();

  const mentionCard = page
    .locator('article.notification-card')
    .filter({ hasText: 'You were mentioned on WT-3.' })
    .filter({ hasText: 'Avery Owner' });
  await expect(mentionCard).toBeVisible();
  await expect(mentionCard).toContainText('Mention');
  await expect(
    mentionCard.getByRole('link', { name: /WT-3.*Implement transport-neutral API handler contract/ })
  ).toBeVisible();

  await mentionCard.getByRole('button', { name: 'Mark read' }).click();
  await expect(mentionCard).toHaveCount(0);

  await page.getByLabel('Inbox views').getByRole('button', { name: 'All', exact: true }).click();
  const readMentionCard = page
    .locator('article.notification-card')
    .filter({ hasText: 'You were mentioned on WT-3.' })
    .filter({ hasText: 'Avery Owner' });
  await expect(readMentionCard).toBeVisible();
  await expect(readMentionCard.getByRole('button', { name: 'Mark unread' })).toBeVisible();
});

test('imports project work items from CSV and exports filtered results', async ({ page }) => {
  test.setTimeout(90_000);

  const runId = Date.now();
  const firstTitle = `E2E imported backlog ${runId}`;
  const secondTitle = `E2E imported ready ${runId}`;
  const csv = [
    'title,description,type,status,priority,assignee_email,reporter_email,label_names,milestone_name,due_date,estimate_points',
    `"${firstTitle}","Imported through the v0.0.7 Playwright workflow.",task,backlog,medium,morgan.maintainer@example.com,avery.owner@example.com,backend,v0.0.3 Planning,2026-07-20,2`,
    `"${secondTitle}","Second imported row.",story,ready,high,casey.contributor@example.com,avery.owner@example.com,design,v0.0.3 Planning,2026-07-21,3`
  ].join('\n');

  await page.goto(`/projects/${demoProjectId}/work-items/import`);
  await expect(page.getByRole('heading', { name: 'Import work items' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import work items' })).toBeDisabled();

  await page.getByLabel('Choose CSV').setInputFiles({
    name: `worktrail-import-${runId}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv)
  });

  await expect(page.getByText(`worktrail-import-${runId}.csv`)).toBeVisible();
  await expect(page.getByLabel('Import summary')).toContainText('Valid rows');
  await expect(page.getByLabel('Import summary')).toContainText('2');
  await expect(page.getByRole('row', { name: new RegExp(firstTitle) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(secondTitle) })).toBeVisible();

  await page.getByRole('button', { name: 'Import work items' }).click();

  await expect(page.getByLabel('Import complete')).toContainText('2 work items imported');
  await expect(page.getByRole('link', { name: /WT-\d+/ }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Project list' }).click();
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await page.getByLabel('Search').fill(firstTitle);
  await expect(page.getByText(`Search: ${firstTitle}`)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(firstTitle) })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export applied project filters as CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('worktrail-wt-work-items.csv');
  expect(await downloadText(download)).toContain(firstTitle);

  await page.goto(`/projects/${demoProjectId}/board`);
  await expect(page.getByRole('heading', { name: 'Project board' })).toBeVisible();
  await expect(
    page.locator('section.board-column[aria-label="backlog"]').getByRole('link', {
      name: firstTitle
    })
  ).toBeVisible();
  await expect(
    page.locator('section.board-column[aria-label="ready"]').getByRole('link', {
      name: secondTitle
    })
  ).toBeVisible();
});

test('keeps core pages usable at common desktop widths', async ({ page }) => {
  test.setTimeout(60_000);

  const checks = [
    '/my-work',
    '/work-items',
    '/work-items/new',
    '/projects',
    '/workspace/settings',
    `/projects/${demoProjectId}/planning`,
    `/projects/${demoProjectId}/work-items`,
    `/projects/${demoProjectId}/board`,
    `/projects/${demoProjectId}/work-items/new`,
    `/projects/${demoProjectId}/settings`,
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
