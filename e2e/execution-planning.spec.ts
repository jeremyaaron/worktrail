import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import type { ProjectCycleDto, ProjectDto } from '@worktrail/contracts';
import { addDays, toDateString } from '../packages/contracts/src/work-risk-policy';
import { resetDemoDatabase } from './reset-demo-database';

test.afterEach(resetDemoDatabase);

const ownerId = '10000000-0000-4000-8000-000000000101';
const contributorId = '10000000-0000-4000-8000-000000000103';
const headers = { 'x-worktrail-workspace-id': '10000000-0000-4000-8000-000000000001', 'x-worktrail-member-id': ownerId };

function apiBase(): string {
  if (!process.env.API_PORT) throw new Error('Owned API port is required.');
  return `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT}/api`;
}

async function post<T>(request: APIRequestContext, path: string, data: unknown): Promise<T> {
  const response = await request.post(apiBase() + path, { headers, data });
  expect(response.ok(), await response.text()).toBe(true);
  return await response.json() as T;
}

async function projectFixture(request: APIRequestContext): Promise<ProjectDto> {
  return post(request, '/projects', { key: `EP${Date.now().toString(36).slice(-6).toUpperCase()}`, name: 'Execution planning' });
}

async function screenshot(page: Page, info: TestInfo, target: string, label: string): Promise<void> {
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(target).scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`${label}-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test('execution-first planning corrects exact unestimated cycle work and refreshes the same review', async ({ page, request }, info) => {
  test.setTimeout(90_000);
  const project = await projectFixture(request);
  const cycle = await post<ProjectCycleDto>(request, `/projects/${project.id}/cycles`, {
    name: 'Current delivery', goal: 'Finish the committed work', status: 'active',
    startDate: toDateString(new Date()), endDate: toDateString(addDays(new Date(), 14)), targetPoints: 10
  });
  for (const [title, estimatePoints] of [['Estimate remaining delivery work', null], ['Already estimated at zero', 0]] as const) {
    await post(request, `/projects/${project.id}/work-items`, {
      title, estimatePoints, type: 'task', status: 'ready', priority: 'medium', assigneeId: ownerId, cycleId: cycle.id
    });
  }
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/projects/${project.id}/planning`);
  const active = page.getByRole('article', { name: 'Active cycle execution', exact: true });
  await expect(active).toContainText('Current delivery');
  await expect(active.getByRole('status', { name: 'Closeout readiness' })).toContainText('2 unfinished work items · 1 unestimated');
  await expect(page.locator('.planning-report-bridge')).toHaveCount(0);
  await expect(page.locator('app-planning-review form')).toHaveCount(0);
  const order = await page.locator('app-planning-review').evaluate(node => {
    const health = node.querySelector('app-planning-health-summary')!;
    const cycle = node.querySelector('app-cycle-summary-panel')!;
    const targets = node.querySelector('app-milestone-targets')!;
    return !!(health.compareDocumentPosition(cycle) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      !!(cycle.compareDocumentPosition(targets) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  await screenshot(page, info, '.cycle-summary-card--active', 'execution');
  const reviewLoaded = page.waitForResponse(response => response.request().method() === 'GET' &&
    new URL(response.url()).pathname === `/api/projects/${project.id}/cycles/${cycle.id}/review`);
  await active.getByRole('link', { name: 'Review', exact: true }).click();
  const reviewResponse = await reviewLoaded;
  expect(reviewResponse.ok()).toBe(true);
  expect(await reviewResponse.finished()).toBeNull();
  const risk = page.locator('section.risk-section').filter({ has: page.getByRole('heading', { name: 'Unestimated work', exact: true }) });
  await expect(risk).toContainText('1 work item');
  await risk.getByRole('link', { name: 'Open work', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`cycleId=${cycle.id}`));
  await expect(page).toHaveURL(/workState=open/);
  await expect(page).toHaveURL(/estimateState=unestimated/);
  await expect(page.getByRole('link', { name: 'Already estimated at zero', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Estimate remaining delivery work', exact: true }).click();
  await page.locator('button[aria-controls="edit-work-item"]').click();
  await page.locator('#detail-estimate').fill('0');
  const saved = page.waitForResponse(response => response.request().method() === 'PATCH' && /\/api\/work-items\/[\w-]+$/.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.locator('app-work-item-detail-summary')).toContainText('0');
  await page.goBack();
  await expect(page).toHaveURL(/estimateState=unestimated/);
  await expect(page.getByRole('status', { name: 'Work item results status', exact: true })).toContainText('0-0 of 0');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/cycles/${cycle.id}$`));
  await page.reload();
  await expect(page.locator('section[aria-labelledby="risk-sections-heading"]')).toContainText('No cycle risks found');
  await expect(page.locator('section.risk-section')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to Planning', exact: true }).click();
  await expect(active.getByRole('status', { name: 'Closeout readiness' })).toContainText('2 unfinished work items · 0 unestimated');
  expect(errors).toEqual([]);
});

test('execution-first planning discloses management, retains independent drafts and handles read-only recovery', async ({ page, request }, info) => {
  test.setTimeout(90_000);
  const project = await projectFixture(request);
  let failSummary = true;
  await page.route(`**/api/projects/${project.id}/planning-summary`, route => {
    if (failSummary) {
      failSummary = false;
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Expected summary failure' } }) });
    }
    return route.continue();
  });
  await page.goto(`/projects/${project.id}/planning`);
  await expect(page.getByRole('alert')).toContainText('Planning dashboard could not be loaded');
  await page.getByRole('alert').getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.no-active-cycle')).toContainText('No active cycle');
  await expect(page.locator('app-planning-review')).toContainText('No project work risks found.');
  await expect(page.locator('.risk-section-list section')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cycles', exact: true }).click();
  const create = page.locator('app-cycle-manager .create-disclosure');
  await expect(create).not.toHaveAttribute('open', '');
  await create.locator('summary').click();
  const form = create.locator('form');
  await form.getByLabel('Name', { exact: true }).fill('First planned cycle');
  await form.getByLabel('Start date', { exact: true }).fill(toDateString(new Date()));
  await form.getByLabel('End date', { exact: true }).fill(toDateString(addDays(new Date(), 7)));
  await form.getByLabel('Target points', { exact: true }).fill('7');
  await form.getByRole('button', { name: 'Create cycle', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cycle created.' })).toBeVisible();
  const first = page.locator('article.cycle-row').filter({ has: page.getByRole('heading', { name: 'First planned cycle', exact: true }) });
  await expect(first.locator('.record-edit')).not.toHaveAttribute('open', '');
  await first.locator('.record-edit > summary').click();
  await expect(first.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('planned');
  await first.getByLabel('Goal', { exact: true }).fill('Independent first goal');
  await create.locator('summary').click();
  await form.getByLabel('Name', { exact: true }).fill('Second planned cycle');
  await form.getByLabel('Start date', { exact: true }).fill(toDateString(addDays(new Date(), 10)));
  await form.getByLabel('End date', { exact: true }).fill(toDateString(addDays(new Date(), 17)));
  await form.getByRole('button', { name: 'Create cycle', exact: true }).click();
  const second = page.locator('article.cycle-row').filter({ has: page.getByRole('heading', { name: 'Second planned cycle', exact: true }) });
  await expect(second).toBeVisible();
  await expect(first.getByLabel('Goal', { exact: true })).toHaveValue('Independent first goal');
  await second.locator('.record-edit > summary').click();
  await second.getByLabel('Goal', { exact: true }).fill('Independent second goal');
  const cycleId = new URL((await first.getByRole('link', { name: 'Review', exact: true }).getAttribute('href'))!, page.url()).pathname.split('/').at(-1)!;
  let release!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/projects/${project.id}/cycles/${cycleId}`, async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    await pause;
    return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Expected cycle conflict' } }) });
  });
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(second.getByLabel('Goal', { exact: true })).toBeDisabled();
  release();
  await expect(first.getByRole('alert')).toContainText('Expected cycle conflict');
  await expect(second.getByRole('alert')).toHaveCount(0);
  await expect(first.getByLabel('Goal', { exact: true })).toHaveValue('Independent first goal');
  await expect(second.getByLabel('Goal', { exact: true })).toHaveValue('Independent second goal');
  await page.unroute(`**/api/projects/${project.id}/cycles/${cycleId}`);
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByRole('status')).toContainText('Cycle saved.');
  await first.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(first.getByRole('status')).toContainText('Cycle archived.');
  await first.getByRole('button', { name: 'Reactivate', exact: true }).click();
  await expect(first.getByRole('status')).toContainText('Cycle reactivated.');
  await screenshot(page, info, 'app-cycle-manager', 'cycle-management');
  await page.getByRole('button', { name: 'Milestones', exact: true }).click();
  const milestones = page.locator('app-milestone-manager');
  await milestones.locator('.create-disclosure > summary').click();
  await milestones.locator('form').getByLabel('Name', { exact: true }).fill('Delivery target');
  await milestones.locator('form').getByRole('button', { name: 'Create milestone', exact: true }).click();
  const milestone = milestones.locator('article.milestone-row');
  await expect(milestone).toContainText('Delivery target');
  await milestone.locator('.record-edit > summary').click();
  await milestone.getByLabel('Name', { exact: true }).fill('Revised delivery target');
  await milestone.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(milestone.getByRole('status')).toContainText('Milestone saved.');
  await milestone.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(milestone.getByRole('status')).toContainText('Milestone archived.');
  await milestone.getByRole('button', { name: 'Reactivate', exact: true }).click();
  await expect(milestone.getByRole('status')).toContainText('Milestone reactivated.');
  await screenshot(page, info, 'app-milestone-manager', 'milestone-management');
  await page.locator('#current-member').selectOption(contributorId);
  await expect(milestones.locator('form, .record-edit')).toHaveCount(0);
  await expect(milestones.getByRole('link', { name: 'Revised delivery target', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cycles', exact: true }).click();
  await expect(page.locator('app-cycle-manager form, app-cycle-manager .record-edit')).toHaveCount(0);
  await expect(page.locator('app-cycle-manager').getByRole('link', { name: 'Review', exact: true })).toHaveCount(2);
  const archived = await request.post(`${apiBase()}/projects/${project.id}/archive`, { headers });
  expect(archived.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Archived project', exact: true })).toBeVisible();
  await expect(page.locator('app-cycle-manager form, app-cycle-manager .record-edit')).toHaveCount(0);
});
