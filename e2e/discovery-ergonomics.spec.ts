import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { PortfolioDto, ProjectDto, QuickFindResponseDto, WorkItemDetailDto } from '@worktrail/contracts';
import { resetDemoDatabase } from './reset-demo-database';

test.afterEach(resetDemoDatabase);
const ownerId = '10000000-0000-4000-8000-000000000101';
const contributorId = '10000000-0000-4000-8000-000000000103';
const headers = { 'x-worktrail-workspace-id': '10000000-0000-4000-8000-000000000001', 'x-worktrail-member-id': ownerId };

function apiBase(): string {
  if (!process.env.API_PORT) throw new Error('Owned API port required.');
  return `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT}/api`;
}

async function post<T>(request: APIRequestContext, path: string, data: unknown): Promise<T> {
  const response = await request.post(apiBase() + path, { headers, data });
  expect(response.ok(), await response.text()).toBe(true);
  return await response.json() as T;
}

async function fits(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const failures = await page.locator('.comparison-filters input, .comparison-filters select, .comparison-filters button, .comparison-primary > *, .secondary-details summary, .row-actions a').evaluateAll(elements => elements.filter(element => {
    const parent = element.closest('.project-panel')!.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return box.width > 0 && (box.left < parent.left - 1 || box.right > parent.right + 1 || element.scrollWidth > element.clientWidth + 1);
  }).map(element => element.textContent));
  expect(failures).toEqual([]);
}

async function screenshot(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.screenshot({ path: info.outputPath(name + '.png') });
}

test('discovery ergonomics compares fifteen projects in actual constrained containers with complete local filters', async ({ page, request }, info) => {
  test.setTimeout(90_000);
  const baseline = await request.get(apiBase() + '/portfolio', { headers });
  const count = (await baseline.json() as PortfolioDto).projects.length;
  for (let index = count; index < 15; index++) {
    const project = await post<ProjectDto>(request, '/projects', { key: 'P18' + index, name: 'Comparison project ' + index + ' with a long stakeholder coordination name' });
    if (index === count) await post(request, `/projects/${project.id}/work-items`, { title: 'Blocked comparison commitment', type: 'task', status: 'blocked', priority: 'high', assigneeId: ownerId });
  }
  const response = await request.get(apiBase() + '/portfolio', { headers });
  const portfolio = await response.json() as PortfolioDto;
  expect(portfolio.projects).toHaveLength(15);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/portfolio');
  await expect(page.getByRole('status', { name: 'Project comparison results' })).toHaveText('15 of 15 active projects');
  await expect(page.locator('article.project-row')).toHaveCount(15);
  await expect(page.locator('.attention-disclosure')).not.toHaveAttribute('open');
  await fits(page);
  await screenshot(page, info, 'portfolio-wide');
  await page.getByRole('combobox', { name: 'Health', exact: true }).selectOption('blocked');
  await expect(page.locator('article.project-row')).toHaveCount(portfolio.projects.filter(row => row.deliveryHealth.health === 'blocked').length);
  await page.getByRole('combobox', { name: 'Report freshness', exact: true }).selectOption('missing');
  await expect(page.locator('article.project-row')).toHaveCount(portfolio.projects.filter(row => row.deliveryHealth.health === 'blocked' && row.report.freshness === 'missing').length);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  const last = portfolio.projects.at(-1)!;
  await page.getByRole('searchbox', { name: 'Project', exact: true }).fill(last.project.key);
  await expect(page.locator('article.project-row')).toHaveCount(1);
  await expect(page.locator('article.project-row')).toContainText(last.project.name);
  await expect(page.getByRole('status', { name: 'Project comparison results' })).toHaveText('1 of 15 active projects');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('article.project-row')).toHaveCount(15);
  const inspected = page.getByRole('article', { name: portfolio.projects[0]!.project.name, exact: true });
  await inspected.locator('summary').click();
  await expect(inspected.locator('details')).toHaveAttribute('open', '');
  await expect(inspected.getByRole('navigation', { name: 'Portfolio project links' })).toBeVisible();
  await page.locator('.content-shell').evaluate(element => { (element as HTMLElement).style.width = '760px'; });
  await fits(page);
  expect(await page.locator('.comparison-primary').first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);
  await screenshot(page, info, 'portfolio-constrained');
  await page.locator('.content-shell').evaluate(element => { (element as HTMLElement).style.removeProperty('width'); });
  await page.setViewportSize({ width: 390, height: 844 });
  await fits(page);
  await screenshot(page, info, 'portfolio-mobile');
  await inspected.scrollIntoViewIfNeeded();
  await screenshot(page, info, 'portfolio-mobile-rows');
  await page.locator('.attention-disclosure > summary').click();
  await expect(page.locator('.preview-note')).toContainText('Bounded project previews');
  await fits(page);
});

test('discovery ergonomics keeps creation deliberate, Planning ownership visible, and contributor settings reachable', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.goto('/projects');
  await expect(page.locator('.create-panel')).not.toHaveAttribute('open');
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.locator('#project-name')).toBeFocused();
  await page.locator('#project-name').fill('Directory creation result');
  await page.locator('#project-key').fill('DIR18');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Project created.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Directory creation result', exact: true })).toBeFocused();
  await expect(page.locator('.create-panel')).not.toHaveAttribute('open');
  const projectId = '10000000-0000-4000-8000-000000000201';
  for (const path of [`/projects/${projectId}/milestones/10000000-0000-4000-8000-000000000351`, `/projects/${projectId}/cycles/10000000-0000-4000-8000-000000000371`, '/projects/10000000-0000-4000-8000-000000000205/cycles/10000000-0000-4000-8000-000000000374/closeout']) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Project sections', exact: true }).getByRole('link', { name: 'Planning', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.project-shell__name')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await screenshot(page, info, 'planning-navigation-mobile');
  await page.locator('#current-member').selectOption(contributorId);
  const utility = page.locator('.topbar-tools').getByRole('link', { name: 'Workspace Settings', exact: true });
  await expect(utility).toBeVisible();
  await expect.poll(() => utility.locator('img').evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('combobox', { name: 'Acting as', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Workspace Settings', exact: true })).toHaveCount(0);
  await utility.click();
  await expect(page).toHaveURL('/workspace/settings');
  await expect(utility).toHaveAttribute('aria-current', 'page');
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toHaveCount(0);
  await expect(page.locator('.create-panel')).toHaveCount(0);
});

test('discovery ergonomics refreshes successive Quick Find inspections with bounded refinement and authorized detail context', async ({ page, request }, info) => {
  test.setTimeout(120_000);
  const project = await post<ProjectDto>(request, '/projects', { key: 'FIND18', name: 'Successive inspection project' });
  const items: WorkItemDetailDto[] = [];
  for (let index = 1; index <= 2; index++) items.push(await post<WorkItemDetailDto>(request, `/projects/${project.id}/work-items`, { title: 'Successive review ' + index, type: 'task', status: 'ready', priority: 'medium', assigneeId: ownerId }));
  for (let index = 1; index <= 6; index++) await post(request, `/projects/${project.id}/milestones`, { name: 'Discovery release 0' + index });
  const other = await post<ProjectDto>(request, '/projects', { key: 'OTHER18', name: 'Another discovery project' });
  await post(request, `/projects/${other.id}/milestones`, { name: 'Discovery release 00' });
  const preview = await post<QuickFindResponseDto>(request, '/quick-find', { query: 'Discovery release' });
  const previewProjectMatches = preview.groups.milestones.items.filter(item => item.project.id === project.id).length;
  await page.goto(`/projects/${project.id}/work-items`);
  const open = async () => {
    await page.getByRole('button', { name: 'Open Quick Find', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Quick Find', exact: true });
    await expect(dialog).toBeVisible();
    return dialog;
  };
  let dialog = await open();
  const input = () => dialog.getByRole('combobox', { name: 'Search Worktrail', exact: true });
  let releaseLate!: () => void;
  let requestStarted!: () => void;
  let requestSettled!: () => void;
  const lateGate = new Promise<void>(resolve => { releaseLate = resolve; });
  const started = new Promise<void>(resolve => { requestStarted = resolve; });
  const settled = new Promise<void>(resolve => { requestSettled = resolve; });
  await page.route('**/api/quick-find', async route => {
    if (route.request().postDataJSON().query !== 'Superseded preview') return route.continue();
    requestStarted();
    await lateGate;
    try {
      await route.fulfill({ json: { ...preview, query: 'Superseded preview', groups: { ...preview.groups, milestones: { ...preview.groups.milestones, items: [] } } } });
    } finally { requestSettled(); }
  });
  try {
    await input().fill('Superseded preview');
    await started;
    await input().fill('Discovery release');
    await expect(dialog.locator('.quick-find__result')).toHaveCount(5);
  } finally { releaseLate(); }
  await settled;
  await expect(input()).toHaveValue('Discovery release');
  await expect(dialog.locator('.quick-find__result')).toHaveCount(5);
  await expect(dialog.getByText('More matches outside this preview.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('option', { name: /View all/ })).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'Result type', exact: true }).selectOption('milestones');
  await dialog.getByRole('combobox', { name: 'Project in preview', exact: true }).selectOption(project.id);
  await expect(dialog.locator('.quick-find__result')).toHaveCount(previewProjectMatches);
  await input().fill('Discovery release 06');
  await expect(dialog.getByRole('option', { name: /Discovery release 06/ })).toBeVisible();
  await expect(dialog.locator('.quick-find__result')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Close Quick Find', exact: true }).click();
  dialog = await open();
  await expect(input()).toHaveValue('Discovery release 06');
  await expect(dialog.getByRole('combobox', { name: 'Result type', exact: true })).toHaveValue('milestones');
  await expect(dialog.getByRole('option', { name: /Discovery release 06/ })).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Result type', exact: true }).selectOption('workItems');
  await input().fill('Successive review');
  await expect(dialog.getByRole('option', { name: /Successive review/ })).toHaveCount(2);
  await dialog.getByRole('option', { name: new RegExp(items[0]!.displayKey + ',') }).click();
  await expect(page.getByRole('heading', { level: 1, name: items[0]!.title, exact: true })).toBeVisible();
  const changed = await request.patch(apiBase() + '/work-items/' + items[1]!.id, { headers, data: { title: 'Successive review 2 refreshed' } });
  expect(changed.ok()).toBe(true);
  dialog = await open();
  await expect(input()).toHaveValue('Successive review');
  await expect(dialog.getByRole('option', { name: /Successive review 2 refreshed/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Current project', exact: true })).toBeVisible();
  await expect(dialog.getByRole('option', { name: 'Planning', exact: true })).toBeVisible();
  await input().fill('Successive review');
  await expect(dialog.getByRole('option', { name: /Successive review 2 refreshed/ })).toBeVisible();
  await input().press('ArrowDown');
  await input().press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Successive review 2 refreshed', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('returnUrl')).toBe(`/projects/${project.id}/work-items`);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/work-items/' + items[0]!.id);
  dialog = await open();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole('option', { name: /Successive review 2 refreshed/ })).toBeVisible();
  await screenshot(page, info, 'quick-find-refinement-mobile');
  await dialog.getByRole('button', { name: 'Close Quick Find', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Successive review 2 refreshed', exact: true })).toBeVisible();
  dialog = await open();
  await expect(input()).toHaveValue('');
  await input().fill('Successive review');
  await expect(dialog.getByRole('option', { name: /Successive review 2 refreshed/ })).toBeVisible();
  await page.locator('#current-member').selectOption(contributorId);
  await expect(dialog).toBeHidden();
  dialog = await open();
  await expect(input()).toHaveValue('');
  await dialog.getByRole('button', { name: 'Close Quick Find', exact: true }).click();
  await page.route('**/api/work-items/' + items[0]!.id, route => route.fulfill({ status: 404, json: { error: { message: 'Unavailable current record' } } }));
  await page.goto('/work-items/' + items[0]!.id);
  await expect(page.getByRole('alert')).toContainText('Work item detail could not be loaded');
  dialog = await open();
  await expect(dialog.getByRole('heading', { name: 'Current project', exact: true })).toHaveCount(0);
});
