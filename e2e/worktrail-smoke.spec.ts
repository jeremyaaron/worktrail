import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';
import type { APIRequestContext, Download, Locator, Page } from '@playwright/test';

const demoProjectId = '10000000-0000-4000-8000-000000000201';
const childEnv: NodeJS.ProcessEnv = { ...process.env };

delete childEnv.NO_COLOR;
delete childEnv.FORCE_COLOR;

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

function milestoneRiskSection(page: Page, name: string): Locator {
  return page.locator('section.risk-section').filter({
    has: page.getByRole('heading', { name, exact: true })
  });
}

function savedViewsRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Saved views', exact: true });
}

async function openSaveViewForm(page: Page): Promise<void> {
  const saveView = page.locator('details.saved-view-save');

  await expect(saveView).toBeVisible();

  if (!(await saveView.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await saveView.locator('summary').click();
  }
}

async function openSavedViewManager(page: Page): Promise<void> {
  const manager = page.locator('details.saved-view-manager');

  await expect(manager).toBeVisible();

  if (!(await manager.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await manager.locator('summary').click();
  }
}

async function selectSavedViewOptionByName(select: Locator, savedViewName: string): Promise<void> {
  await expect
    .poll(
      async () =>
        select.evaluate((element, name) => {
          return [...(element as HTMLSelectElement).options].some((candidate) =>
            candidate.text.trim().startsWith(name)
          );
        }, savedViewName),
      { message: `saved view option "${savedViewName}" should be available` }
    )
    .toBe(true);

  const value = await select.evaluate((element, name) => {
    const option = [...(element as HTMLSelectElement).options].find((candidate) =>
      candidate.text.trim().startsWith(name)
    );

    return option?.value ?? null;
  }, savedViewName);

  if (value === null) {
    throw new Error(`Could not find saved view option starting with "${savedViewName}".`);
  }

  await select.selectOption(value);
}

async function openSavedViewFromCompactControl(page: Page, savedViewName: string): Promise<void> {
  const savedViews = savedViewsRegion(page);

  await selectSavedViewOptionByName(savedViews.getByLabel('Open saved view'), savedViewName);
  await savedViews.getByRole('button', { name: 'Open selected saved view' }).click();
  await expect(savedViews.getByText(`Opened "${savedViewName}". Results updated below.`)).toBeVisible();
}

async function selectManagedSavedView(page: Page, savedViewName: string): Promise<Locator> {
  const savedViews = savedViewsRegion(page);

  await openSavedViewManager(page);
  await selectSavedViewOptionByName(savedViews.getByLabel('Manage saved view'), savedViewName);

  const panel = savedViews.locator('.saved-view-management-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(savedViewName);

  return panel;
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
    env: childEnv,
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

  await page.getByLabel('Project sections').getByRole('link', { name: 'Planning' }).click();
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
  await page.locator('.project-shell__actions').getByRole('link', { name: 'Create' }).click();
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
  await page.locator('form.filters').getByLabel('Milestone').selectOption({ label: milestone });
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

  await openSaveViewForm(page);
  const savedViewNameInput = page.locator('form.saved-view-form').getByLabel('Name');
  await savedViewNameInput.fill(savedViewName);
  await expectFocused(savedViewNameInput);
  await page.getByRole('button', { name: 'Save personal view' }).click();
  await expect(savedViewsRegion(page)).toContainText(/5 shared · \d+ personal/);

  await selectManagedSavedView(page, savedViewName);
  await expect(savedViewsRegion(page).locator('.saved-view-management-panel')).toContainText(
    /applied filters/
  );

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await selectManagedSavedView(page, savedViewName);
  const openSavedView = savedViewsRegion(page).getByRole('button', {
    name: `Open ${savedViewName}`
  });
  await openSavedView.focus();
  await expectFocused(openSavedView);
  await openSavedViewFromCompactControl(page, savedViewName);
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
  const savedViews = savedViewsRegion(page);
  await expect(savedViews).toContainText('5 shared');
  await openSaveViewForm(page);
  await expect(page.getByRole('button', { name: 'Save shared view' })).toBeVisible();

  const ownerDependencyPanel = await selectManagedSavedView(page, 'Dependency risks');
  await expect(ownerDependencyPanel.getByRole('button', { name: 'Rename Dependency risks' })).toBeVisible();
  await expect(
    ownerDependencyPanel.getByRole('button', { name: 'Update query for Dependency risks' })
  ).toBeVisible();
  await expect(ownerDependencyPanel.getByRole('button', { name: 'Delete Dependency risks' })).toBeVisible();

  await openSavedViewFromCompactControl(page, 'Dependency risks');
  await expect(page).toHaveURL(/dependency=dependency_blocked/);
  await expect(page.getByText('Dependency: Blocked by open work')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto('/work-items');
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await expect(savedViews).toContainText('5 shared');
  await expect(page.getByText('Owners and maintainers manage shared saved views.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save shared view' })).toHaveCount(0);

  const contributorDependencyPanel = await selectManagedSavedView(page, 'Dependency risks');
  await expect(contributorDependencyPanel.getByRole('button', { name: 'Open Dependency risks' })).toBeVisible();
  await expect(contributorDependencyPanel).toContainText('This saved view is read-only for your current role.');
  await expect(contributorDependencyPanel.getByRole('button', { name: /Rename/ })).toHaveCount(0);
  await expect(contributorDependencyPanel.getByRole('button', { name: /Update query/ })).toHaveCount(0);
  await expect(contributorDependencyPanel.getByRole('button', { name: /Delete/ })).toHaveCount(0);

  await openSavedViewFromCompactControl(page, 'Dependency risks');
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

  const savedViews = savedViewsRegion(page);
  await expect(savedViews).toContainText(/6 shared · \d+ personal/);
  await openSaveViewForm(page);
  await expect(page.getByRole('button', { name: 'Save shared view' })).toBeVisible();

  const ownerReadyForQaPanel = await selectManagedSavedView(page, 'Ready for QA');
  await expect(ownerReadyForQaPanel).toContainText('2 applied filters');
  await expect(ownerReadyForQaPanel.getByRole('button', { name: 'Rename Ready for QA' })).toBeVisible();
  await expect(
    ownerReadyForQaPanel.getByRole('button', { name: 'Update query for Ready for QA' })
  ).toBeVisible();
  await expect(ownerReadyForQaPanel.getByRole('button', { name: 'Delete Ready for QA' })).toBeVisible();

  await openSavedViewFromCompactControl(page, 'Ready for QA');
  await expect(page).toHaveURL(/\/projects\/10000000-0000-4000-8000-000000000201\/work-items\?/);
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByText('Status: ready')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();

  await openSaveViewForm(page);
  await page.locator('form.saved-view-form').getByLabel('Name').fill(personalViewName);
  await page.getByRole('button', { name: 'Save personal view' }).click();
  await expect(savedViews).toContainText(/6 shared · \d+ personal/);

  await selectManagedSavedView(page, personalViewName);
  await expect(savedViews.locator('.saved-view-management-panel')).toContainText('2 applied filters');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await selectManagedSavedView(page, personalViewName);
  await openSavedViewFromCompactControl(page, personalViewName);
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByText('Status: ready')).toBeVisible();
  await expect(page.getByRole('row', { name: /Add filter controls to work item list/ })).toBeVisible();

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto(`/projects/${demoProjectId}/work-items`);
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await expect(savedViews).toContainText('6 shared');
  await expect(page.getByText('Owners and maintainers manage shared project views.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save shared view' })).toHaveCount(0);

  const contributorReadyForQaPanel = await selectManagedSavedView(page, 'Ready for QA');
  await expect(contributorReadyForQaPanel).toContainText('Shared by Avery Owner');
  await expect(contributorReadyForQaPanel.getByRole('button', { name: 'Open Ready for QA' })).toBeVisible();
  await expect(contributorReadyForQaPanel).toContainText('This saved view is read-only for your current role.');
  await expect(contributorReadyForQaPanel.getByRole('button', { name: /Rename/ })).toHaveCount(0);
  await expect(contributorReadyForQaPanel.getByRole('button', { name: /Update query/ })).toHaveCount(0);
  await expect(contributorReadyForQaPanel.getByRole('button', { name: /Delete/ })).toHaveCount(0);

  await openSavedViewFromCompactControl(page, 'Ready for QA');
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

  const contributorWorkspacePinnedPanel = await selectManagedSavedView(page, 'Dependency risks');
  await expect(contributorWorkspacePinnedPanel.getByRole('button', { name: 'Open Dependency risks' })).toBeVisible();
  await expect(contributorWorkspacePinnedPanel.getByRole('button', { name: /Pin/ })).toHaveCount(0);
  await expect(contributorWorkspacePinnedPanel.getByRole('button', { name: /Unpin/ })).toHaveCount(0);

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

  const contributorProjectPinnedPanel = await selectManagedSavedView(page, 'Ready for QA');
  await expect(contributorProjectPinnedPanel.getByRole('button', { name: 'Open Ready for QA' })).toBeVisible();
  await expect(contributorProjectPinnedPanel.getByRole('button', { name: /Pin/ })).toHaveCount(0);
  await expect(contributorProjectPinnedPanel.getByRole('button', { name: /Unpin/ })).toHaveCount(0);
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
  await expect(workItemTable.getByLabel('Select WT-2')).toHaveCount(0);
  await page.getByRole('button', { name: 'Bulk edit' }).click();
  await expect(page.getByRole('button', { name: 'Exit bulk edit' })).toBeVisible();
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

  const seededSavedViewPanel = await selectManagedSavedView(page, 'My open work');
  await seededSavedViewPanel.getByRole('button', { name: 'Pin My open work' }).click();
  await expect(page.getByRole('button', { name: 'Open pinned personal view My open work' })).toBeVisible();

  await openSaveViewForm(page);
  await page.locator('form.saved-view-form').getByLabel('Name').fill(savedViewName);
  await page.getByRole('button', { name: 'Save personal view' }).click();
  await expect(savedViewsRegion(page)).toContainText(/5 shared · \d+ personal/);

  const savedViewPanel = await selectManagedSavedView(page, savedViewName);
  await savedViewPanel.getByRole('button', { name: `Pin ${savedViewName}` }).click();

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

  await openSaveViewForm(page);
  await page.locator('form.saved-view-form').getByLabel('Name').fill(savedViewName);
  await page.getByRole('button', { name: 'Save personal view' }).click();
  await expect(savedViewsRegion(page)).toContainText(/5 shared · \d+ personal/);

  await selectManagedSavedView(page, savedViewName);
  await expect(savedViewsRegion(page).locator('.saved-view-management-panel')).toContainText(
    /applied filters/
  );

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
  await selectManagedSavedView(page, savedViewName);
  await openSavedViewFromCompactControl(page, savedViewName);
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

test('reviews seeded milestone delivery risks and preserves permission-sensitive work links', async ({ page }) => {
  test.setTimeout(60_000);

  const planningMilestoneId = '10000000-0000-4000-8000-000000000351';

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/projects/${demoProjectId}/planning`);
  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Planning dashboard' })).toBeVisible();

  await page
    .locator('.progress-list')
    .getByRole('link', { name: 'v0.0.3 Planning', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/projects/${demoProjectId}/milestones/${planningMilestoneId}$`));
  await expect(page.getByRole('heading', { name: 'v0.0.3 Planning' })).toBeVisible();
  await expect(page.getByText('Planning target for milestones, board ordering, discovery, and dashboard work.')).toBeVisible();
  await expect(page.getByLabel('Milestone progress summary')).toContainText('Open');
  await expect(page.getByRole('heading', { name: 'Breakdown' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blocked work' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unassigned active work' })).toBeVisible();
  await expect(
    milestoneRiskSection(page, 'Unassigned active work').getByRole('link', {
      name: /WT-7 .*Triage unassigned onboarding feedback/
    })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recently changed work' })).toBeVisible();
  await expectNoPageOverflow(page);

  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoPageOverflow(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  await milestoneRiskSection(page, 'Unassigned active work')
    .getByRole('link', { name: 'Open work' })
    .click();
  await expect(page).toHaveURL(/workRisk=unassigned_active/);
  await expect(page).toHaveURL(new RegExp(`milestoneId=${planningMilestoneId}`));
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await expect(page.getByText('Milestone: v0.0.3 Planning')).toBeVisible();
  await expect(page.getByText('Risk: Unassigned active')).toBeVisible();
  await expect(
    page.getByRole('row', { name: /Triage unassigned onboarding feedback.*WT-7/ })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bulk edit' }).click();
  await expect(page.getByRole('checkbox', { name: 'Select WT-7' }).first()).toBeVisible();

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto(`/projects/${demoProjectId}/milestones/${planningMilestoneId}`);
  await expect(page.getByRole('heading', { name: 'v0.0.3 Planning' })).toBeVisible();
  await expect(milestoneRiskSection(page, 'Blocked work')).toContainText('Choose status transition copy');
  await expect(page.getByLabel('Bulk work item actions')).toHaveCount(0);

  await milestoneRiskSection(page, 'Blocked work')
    .getByRole('link', { name: 'Open work' })
    .click();
  await expect(page).toHaveURL(/status=blocked/);
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await expect(page.getByText('Milestone: v0.0.3 Planning')).toBeVisible();
  await expect(page.getByText('Status: Blocked')).toBeVisible();
  await expect(page.getByLabel('Select WT-4')).toHaveCount(0);
  await expect(page.getByLabel('Bulk work item actions')).toHaveCount(0);
});

test('reviews v0.2.1 cycle planning, scoped work, and cycle assignment', async ({ page }) => {
  test.setTimeout(90_000);

  const activeCycleId = '10000000-0000-4000-8000-000000000371';
  const workItemTitle = `E2E cycle-assigned work ${Date.now()}`;

  await page.goto(`/projects/${demoProjectId}/planning`);
  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Planning dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Cycles' }).click();
  await expect(page.getByRole('heading', { name: 'Cycles' })).toBeVisible();
  const cycleForm = page.locator('form.cycle-form');
  await expect(cycleForm.getByLabel('Name')).toBeVisible();
  await expect(cycleForm.getByRole('button', { name: 'Create cycle' })).toBeVisible();

  const activeCycleRow = page.locator('article.cycle-row').filter({
    has: page.getByRole('heading', { name: 'v0.2.1 Cycle Planning' })
  });
  await activeCycleRow.getByRole('link', { name: 'Review' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${demoProjectId}/cycles/${activeCycleId}$`));
  await expect(page.getByRole('heading', { name: 'v0.2.1 Cycle Planning' })).toBeVisible();
  await expect(page.getByLabel('Cycle progress summary')).toContainText('Target');
  await expect(page.getByRole('heading', { name: 'Target progress' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Breakdown' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blocked work' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recently changed work' })).toBeVisible();
  await expectNoPageOverflow(page);

  await milestoneRiskSection(page, 'Blocked work').getByRole('link', { name: 'Open work' }).click();
  await expect(page).toHaveURL(/status=blocked/);
  await expect(page).toHaveURL(new RegExp(`cycleId=${activeCycleId}`));
  await expect(page.getByRole('heading', { name: 'Project work items' })).toBeVisible();
  await expect(page.getByText('Cycle: v0.2.1 Cycle Planning')).toBeVisible();
  await expect(page.getByText('Status: Blocked')).toBeVisible();

  await page.goto(`/projects/${demoProjectId}/work-items/new?cycleId=${activeCycleId}`);
  await expect(page.getByRole('heading', { name: 'New project work item' })).toBeVisible();
  await expect(page.locator('select[formcontrolname="cycleId"]')).toHaveValue(activeCycleId);
  await page.locator('#work-item-title').fill(workItemTitle);
  await page.locator('#work-item-description').fill('Created with an active cycle assignment.');
  await page.locator('select[formcontrolname="priority"]').selectOption('high');
  await page.locator('input[formcontrolname="estimatePoints"]').fill('2');
  await page.getByRole('button', { name: 'Create work item' }).click();
  await expect(page.getByRole('region', { name: 'Work item created' })).toContainText(
    workItemTitle
  );
  await page.getByRole('link', { name: 'Open work item' }).click();
  await expect(page.getByRole('heading', { name: workItemTitle })).toBeVisible();
  await expect(page.getByLabel('Metadata')).toContainText('v0.2.1 Cycle Planning');
});

test('publishes and reads v0.1.8 project status reports from seeded project state', async ({ page }) => {
  test.setTimeout(90_000);

  const planningMilestoneId = '10000000-0000-4000-8000-000000000351';
  const seededReportId = '10000000-0000-4000-8000-000000000651';
  const reportTitle = `E2E status report ${Date.now()}`;
  const reportSummary = 'E2E summary updated before publishing the generated report.';

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/projects/${demoProjectId}/status`);
  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });
  await expect(projectShellHeading(page, 'Worktrail App')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Published snapshots' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create report' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Worktrail App weekly status' })).toBeVisible();

  await page.goto(`/projects/${demoProjectId}/status/${seededReportId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Worktrail App weekly status' })).toBeVisible();
  await expect(page.getByLabel('Published snapshot notice')).toContainText('Links open current project data');
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'v0.2.1 Cycle Planning' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open current cycle work' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Milestones' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Risk sections' })).toBeVisible();
  await expect(page.getByRole('link', { name: /v0\.0\.3 Planning/ })).toBeVisible();
  await expectNoPageOverflow(page);

  await page.getByRole('link', { name: /v0\.0\.3 Planning/ }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${demoProjectId}/milestones/${planningMilestoneId}$`));
  await expect(page.getByRole('heading', { name: 'v0.0.3 Planning' })).toBeVisible();

  await page.goto(`/projects/${demoProjectId}/status/new`);
  await expect(page.getByRole('heading', { name: 'Draft report' })).toBeVisible();
  await expect(page.getByLabel('Generated snapshot')).toContainText('Worktrail App');
  await expect(page.getByLabel('Generated snapshot')).toContainText('Active cycle');
  await expect(page.getByLabel('Generated snapshot')).toContainText('v0.2.1 Cycle Planning');
  await expect(page.getByRole('button', { name: 'Publish report' })).toBeEnabled();
  await page.locator('#report-title').fill(reportTitle);
  await page.locator('#report-summary').fill(reportSummary);
  await page.locator('#report-next-steps').fill('Continue validating the published report detail flow.');
  await page.getByRole('button', { name: 'Publish report' }).click();

  await expect(page.getByRole('heading', { level: 1, name: reportTitle })).toBeVisible();
  await expect(page.getByText(reportSummary)).toBeVisible();
  await expect(page.getByLabel('Published snapshot notice')).toContainText('Values reflect the report as published');
  await expect(page.getByRole('heading', { name: 'v0.2.1 Cycle Planning' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/projects/${demoProjectId}/status/[0-9a-f-]+$`));

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole('heading', { level: 1, name: reportTitle })).toBeVisible();
  await expectNoPageOverflow(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto(`/projects/${demoProjectId}/status`);
  await expect(page.getByRole('heading', { name: 'Published snapshots' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create report' })).toHaveCount(0);
  await expect(page.getByText('Only owners and maintainers can publish reports.')).toBeVisible();
  await expect(page.getByRole('link', { name: reportTitle })).toBeVisible();
  await page.getByRole('link', { name: reportTitle }).click();
  await expect(page.getByRole('heading', { level: 1, name: reportTitle })).toBeVisible();
});

test('shares v0.1.9 project status reports from seeded report data', async ({ page }) => {
  test.setTimeout(90_000);

  const planningMilestoneId = '10000000-0000-4000-8000-000000000351';
  const seededReportId = '10000000-0000-4000-8000-000000000651';
  const seededReportPath = `/projects/${demoProjectId}/status/${seededReportId}`;
  const seededReportTitle = 'Worktrail App weekly status';

  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.resolve()
      }
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(seededReportPath);
  await page.locator('#current-member').selectOption({ label: 'Avery Owner · owner' });
  await expect(page.getByRole('heading', { level: 1, name: seededReportTitle })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy Markdown' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Markdown' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();

  await page.getByRole('button', { name: 'Copy Markdown' }).click();
  await expect(page.getByText('Markdown copied.')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    'worktrail-wt-2026-07-03-worktrail-app-weekly-status.md'
  );

  const markdown = await downloadText(download);
  expect(markdown).toContain(`# ${seededReportTitle}`);
  expect(markdown).toContain('> Published snapshot.');
  expect(markdown).toContain('## Snapshot Counts');
  expect(markdown).toContain(
    `[v0.0.3 Planning](/projects/${demoProjectId}/milestones/${planningMilestoneId})`
  );
  expect(markdown).toContain(
    `[Open current work](/projects/${demoProjectId}/work-items?status=blocked&sort=priority_desc)`
  );

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(seededReportPath);
  await expect(page.getByRole('heading', { level: 1, name: seededReportTitle })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy Markdown' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Markdown' })).toBeVisible();
  await expectNoPageOverflow(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });
  await page.goto(`/projects/${demoProjectId}/status`);
  await expect(page.getByRole('heading', { name: 'Published snapshots' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create report' })).toHaveCount(0);
  await expect(page.getByText('Only owners and maintainers can publish reports.')).toBeVisible();
  await expect(page.getByRole('link', { name: seededReportTitle })).toBeVisible();

  await page.goto(seededReportPath);
  await expect(page.getByRole('heading', { level: 1, name: seededReportTitle })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy Markdown' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Markdown' })).toBeVisible();
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
    `/projects/${demoProjectId}/status`,
    `/projects/${demoProjectId}/status/10000000-0000-4000-8000-000000000651`,
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
