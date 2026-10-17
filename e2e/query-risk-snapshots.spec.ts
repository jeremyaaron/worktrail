import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import type { ProjectDto, ProjectCycleDto, ProjectStatusReportDetailDto, ProjectStatusReportSnapshotV1Dto, SavedWorkViewDto, WorkItemDetailDto } from '@worktrail/contracts';
import { addDays, toDateString } from '../packages/contracts/src/work-risk-policy.js';
import { goldenReportV1 } from '../apps/api/tests/support/snapshot-fixtures.js';

const ownedProjectIds = new Set<string>();
test.afterEach(async ({ request }) => {
  for (const id of ownedProjectIds) {
    const response = await request.post(`${apiBase()}/projects/${id}/archive`);
    expect(response.ok()).toBe(true);
    ownedProjectIds.delete(id);
  }
});

function apiBase(): string {
  if (!process.env.API_PORT) throw new Error('Owned API port is required.');
  return `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT}/api`;
}

async function post<T>(request: APIRequestContext, path: string, data: unknown): Promise<T> {
  const response = await request.post(`${apiBase()}${path}`, { data });
  expect(response.ok(), await response.text()).toBe(true);
  return await response.json() as T;
}

async function estimateFixture(request: APIRequestContext) {
  const project = await post<ProjectDto>(request, '/projects', {
    key: `Q${Date.now().toString(36).slice(-6).toUpperCase()}`, name: 'Estimate query parity'
  });
  ownedProjectIds.add(project.id);
  const now = new Date();
  const cycle = await post<ProjectCycleDto>(request, `/projects/${project.id}/cycles`, {
    name: 'Estimate cycle', goal: 'Check precise estimate risk', status: 'active',
    startDate: toDateString(now), endDate: toDateString(addDays(now, 7)), targetPoints: 1
  });
  const items: WorkItemDetailDto[] = [];
  for (const [title, estimatePoints] of [['Null estimate', null], ['Zero estimate', 0], ['Positive estimate', 3]] as const) {
    items.push(await post<WorkItemDetailDto>(request, `/projects/${project.id}/work-items`, {
      title, type: 'task', priority: 'medium', status: 'ready', cycleId: cycle.id, estimatePoints
    }));
  }
  return { project, cycle, items, path: `/projects/${project.id}/work-items` };
}

async function expectFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  for (const control of await page.locator('form.filters input:visible, form.filters select:visible, form.filters button:visible').all()) {
    expect(await control.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
}

test('v0.3.0 estimate query survives Apply, saved pins, copy, return, reload and mobile', async ({ page, request, context }, testInfo) => {
  test.setTimeout(90_000);
  const f = await estimateFixture(request);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${f.path}?cycleId=${f.cycle.id}&workState=open`);
  await expect(page.getByRole('row', { name: /Null estimate/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Zero estimate/ })).toBeVisible();
  await page.locator('form.filters summary').click();
  await page.locator('form.filters').getByRole('combobox', { name: 'Estimate', exact: true }).selectOption('unestimated');
  await page.locator('form.filters').getByRole('combobox', { name: 'Blocked', exact: true }).selectOption('false');
  await expect(page).not.toHaveURL(/estimateState=/);
  await expect(page.getByLabel('Active filters')).not.toContainText('Estimate: Unestimated');
  await expect(page.getByRole('row', { name: /Zero estimate/ })).toBeVisible();
  await page.locator('form.filters').getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/estimateState=unestimated/);
  await expect(page).toHaveURL(/blocked=false/);
  await expect(page.getByRole('row', { name: /Null estimate/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Zero estimate/ })).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Positive estimate/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('estimateState=unestimated');
  expect(copied).toContain('blocked=false');
  const saved = await post<SavedWorkViewDto>(request, '/saved-work-views', {
    name: 'Precise estimate lens', scope: 'project', projectId: f.project.id,
    query: { cycleId: f.cycle.id, workState: 'open', estimateState: 'unestimated', blocked: false }
  });
  await page.reload();
  const views = page.getByRole('region', { name: 'Saved views', exact: true });
  await views.locator('details.saved-view-manager summary').click();
  await views.getByLabel('Manage saved view').selectOption(saved.id);
  await views.getByRole('button', { name: 'Pin Precise estimate lens', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open pinned personal view Precise estimate lens' })).toBeVisible();
  await page.locator('form.filters').getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page).not.toHaveURL(/estimateState=/);
  await page.getByRole('button', { name: 'Open pinned personal view Precise estimate lens' }).click();
  await expect(page).toHaveURL(/estimateState=unestimated/);
  await expect(page).toHaveURL(/blocked=false/);
  await page.getByRole('link', { name: 'Null estimate', exact: true }).click();
  await expect(page).toHaveURL(/\/work-items\/[0-9a-f-]+\?returnUrl=/);
  await expect(page.getByRole('heading', { name: 'Null estimate', level: 1, exact: true })).toBeVisible();
  const returnUrl = new URL(page.url()).searchParams.get('returnUrl');
  expect(returnUrl).toContain('estimateState=unestimated');
  expect(returnUrl).toContain('blocked=false');
  await page.goBack();
  await page.reload();
  await expect(page.getByLabel('Active filters')).toContainText('Estimate: Unestimated');
  await expect(page.getByRole('row', { name: /Zero estimate/ })).toHaveCount(0);
  await page.locator('form.filters summary').click();
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('estimate-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator('form.filters').getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.locator('form.filters').getByRole('combobox', { name: 'Estimate', exact: true })).toBeVisible();
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('estimate-mobile.png'), fullPage: true });
});

test('v0.3.0 versioned evidence shows units and precise current-work links in read, Markdown and print', async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  const f = await estimateFixture(request);
  await page.goto(`/projects/${f.project.id}/cycles/${f.cycle.id}`);
  const section = (name: string) => page.locator('section.risk-section').filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(section('Unestimated work')).toContainText('1 work item');
  await expect(section('Over target')).toContainText('1 scope condition');
  await section('Unestimated work').getByRole('link', { name: 'Open work', exact: true }).click();
  await expect(page).toHaveURL(/estimateState=unestimated/);
  await expect(page).toHaveURL(/workState=open/);
  await expect(page.getByRole('row', { name: /Null estimate/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Zero estimate/ })).toHaveCount(0);
  await page.goto(`/projects/${f.project.id}/status/new`);
  await expect(page.getByRole('heading', { name: 'Draft report', exact: true })).toBeVisible();
  await page.locator('#report-title').fill('Precise estimate evidence');
  await page.locator('#report-summary').fill('One null estimate; zero points is estimated.');
  await page.getByRole('button', { name: 'Publish report', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Precise estimate evidence', level: 1, exact: true })).toBeVisible();
  const reportPath = new URL(page.url()).pathname;
  const id = reportPath.split('/').at(-1)!;
  const response = await request.get(`${apiBase()}/projects/${f.project.id}/status-reports/${id}`);
  expect(response.ok()).toBe(true);
  const report = await response.json() as ProjectStatusReportDetailDto;
  expect(report.snapshot.snapshotVersion).toBe(2);
  expect(report.snapshot.cycle?.reasons.find(reason => reason.key === 'unestimated_work')).toMatchObject({
    count: 1, countUnit: 'work_items', query: { estimateState: 'unestimated', workState: 'open', cycleId: f.cycle.id }
  });
  const preciseLink = page.getByRole('link', { name: /^Open current work: .*unestimated/ });
  await preciseLink.click();
  await expect(page).toHaveURL(/estimateState=unestimated/);
  await expect(page.getByRole('row', { name: /Null estimate/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Zero estimate/ })).toHaveCount(0);
  await page.goto(reportPath);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown', exact: true }).click();
  const download = await downloaded;
  const path = await download.path();
  expect(path).not.toBeNull();
  const markdown = await readFile(path!, 'utf8');
  expect(markdown).toContain('1 work item');
  expect(markdown).toContain('estimateState=unestimated');
  expect(markdown).toContain('workState=open');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: 'Precise estimate evidence', level: 2, exact: true })).toBeVisible();
  await expect(page.getByText('One null estimate; zero points is estimated.', { exact: true })).toBeVisible();
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('snapshot-print.png'), fullPage: true });
  const reread = await request.get(`${apiBase()}/projects/${f.project.id}/status-reports/${id}`);
  expect((await reread.json() as ProjectStatusReportDetailDto).snapshot).toEqual(report.snapshot);

  // Exercise actual historical input, not a newly generated seed (which now produces v2).
  const legacySnapshot: ProjectStatusReportSnapshotV1Dto = structuredClone(goldenReportV1);
  legacySnapshot.project = { ...legacySnapshot.project, id: f.project.id, key: f.project.key };
  for (const link of legacySnapshot.cycle?.links ?? []) link.projectId = f.project.id;
  const legacy = await post<ProjectStatusReportDetailDto>(request, `/projects/${f.project.id}/status-reports`, {
    title: 'Legacy version one evidence', statusDate: toDateString(new Date()),
    summary: 'Historical facts remain historical.', snapshot: legacySnapshot
  });
  expect(legacy.snapshot).toEqual(legacySnapshot);
  await page.emulateMedia({ media: 'screen' });
  await page.goto(`/projects/${f.project.id}/status/${legacy.id}`);
  await expect(page.getByRole('heading', { name: legacy.title, level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Open current work:/ })).toHaveCount(0);
  const legacyDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown', exact: true }).click();
  const legacyPath = await (await legacyDownload).path();
  const legacyMarkdown = await readFile(legacyPath!, 'utf8');
  expect(legacyMarkdown).toContain('1 matching item.');
  expect(legacyMarkdown).not.toContain('estimateState=');
  await page.setViewportSize({ width: 390, height: 900 });
  await expectFits(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: legacy.title, level: 2, exact: true })).toBeVisible();
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('snapshot-v1-print.png'), fullPage: true });
});
