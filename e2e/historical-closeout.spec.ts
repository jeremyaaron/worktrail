import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { ProjectCycleDto, ProjectCycleReviewDto, ProjectDto, WorkItemDetailDto } from '@worktrail/contracts';
import { readFile } from 'node:fs/promises';
import { addDays, toDateString } from '../packages/contracts/src/work-risk-policy';
import { resetDemoDatabase } from './reset-demo-database';

test.afterEach(resetDemoDatabase);

const ownerId = '10000000-0000-4000-8000-000000000101';
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

async function patch(request: APIRequestContext, path: string, data: unknown): Promise<void> {
  const response = await request.patch(apiBase() + path, { headers, data });
  expect(response.ok(), await response.text()).toBe(true);
}

test('historical closeout keeps twelve commitments inspectable after current work changes and disappears', async ({ page, request, context }, info) => {
  test.setTimeout(120_000);
  const project = await post<ProjectDto>(request, '/projects', { key: `HC${Date.now().toString(36).slice(-6).toUpperCase()}`, name: 'Original historical project' });
  const today = new Date();
  const cycle = await post<ProjectCycleDto>(request, `/projects/${project.id}/cycles`, {
    name: 'Original historical cycle', goal: 'Preserve twelve commitments', status: 'active',
    startDate: toDateString(today), endDate: toDateString(addDays(today, 7)), targetPoints: 32
  });
  const destination = await post<ProjectCycleDto>(request, `/projects/${project.id}/cycles`, {
    name: 'Original destination', status: 'planned', startDate: toDateString(addDays(today, 8)), endDate: toDateString(addDays(today, 15)), targetPoints: 32
  });
  const unfinished: WorkItemDetailDto[] = [];
  for (let index = 1; index <= 12; index++) {
    unfinished.push(await post<WorkItemDetailDto>(request, `/projects/${project.id}/work-items`, {
      title: 'Original commitment ' + index, type: 'task', status: 'ready', priority: 'medium', assigneeId: ownerId, cycleId: cycle.id, estimatePoints: 2
    }));
  }
  for (const status of ['done', 'canceled'] as const) {
    await post(request, `/projects/${project.id}/work-items`, { title: 'Original ' + status, type: 'task', status, priority: 'low', assigneeId: ownerId, cycleId: cycle.id, estimatePoints: 3 });
  }
  const path = `/projects/${project.id}/cycles/${cycle.id}`;
  const reviewPath = `/projects/${project.id}/cycles/${cycle.id}/review`;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(path + '/closeout');
  const choice = page.getByRole('radio', { name: /Original destination/ });
  await expect(choice).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Close cycle', exact: true })).toBeDisabled();
  await choice.check();
  await expect(page.locator('.decision-copy')).toContainText('12 unfinished items will move to Original destination');
  await page.getByRole('button', { name: 'Close cycle', exact: true }).click();
  await expect(page).toHaveURL(path + '#cycle-result-heading');
  await expect(page.locator('#cycle-result-heading')).toBeFocused();
  const beforeResponse = await request.get(apiBase() + reviewPath, { headers });
  expect(beforeResponse.ok()).toBe(true);
  const before = await beforeResponse.json() as ProjectCycleReviewDto;
  expect(before.closeout?.snapshot.snapshotVersion).toBe(2);
  await patch(request, `/work-items/${unfinished[0]!.id}`, { title: 'Changed current title', estimatePoints: 8, cycleId: null });
  await post(request, `/work-items/${unfinished[0]!.id}/transitions`, { status: 'in_progress' });
  await post(request, `/work-items/${unfinished[0]!.id}/transitions`, { status: 'done' });
  await patch(request, `/projects/${project.id}`, { name: 'Changed current project' });
  await patch(request, `/projects/${project.id}/cycles/${cycle.id}`, { name: 'Changed current cycle' });
  await patch(request, `/projects/${project.id}/cycles/${destination.id}`, { name: 'Changed current destination' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Original historical cycle', exact: true })).toBeVisible();
  await expect(page.locator('details.current-context')).not.toHaveAttribute('open');
  await expect(page.getByLabel('Cycle progress summary')).toHaveCount(0);
  const group = page.locator('[aria-labelledby="snapshot-unfinished"]');
  await expect(group.locator('article')).toHaveCount(10);
  await expect(group).toContainText('1-10 of 12');
  await expect(group).toContainText('Original commitment 1');
  await expect(group).not.toContainText('Changed current title');
  await expect(group).toContainText('ready · medium · Avery Owner · 2 points');
  await group.getByRole('button', { name: 'Next Unfinished at close page' }).click();
  await expect(group.locator('article')).toHaveCount(2);
  await expect(group).toContainText('Original commitment 12');
  await expect(group).toContainText('11-12 of 12');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown', exact: true }).click();
  const downloaded = await downloadPromise;
  const markdown = await readFile((await downloaded.path())!, 'utf8');
  expect(markdown).toContain('Original commitment 12');
  expect(markdown).not.toContain('Changed current title');
  expect(JSON.parse(markdown.split('```json\n')[1]!.split('\n```')[0]!)).toEqual(before.closeout!.snapshot);
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Outcome copied.' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(markdown);
  await group.getByRole('button', { name: 'Show all', exact: true }).click();
  await expect(group.locator('article')).toHaveCount(12);
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`historical-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await group.getByRole('button', { name: 'Paginate', exact: true }).click();
  await page.locator('details.current-context > summary').click();
  await expect(page.getByRole('heading', { name: 'Changed current cycle', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Current cycle assignments', exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await expect(group.locator('article')).toHaveCount(12);
  await expect(page.locator('details.current-context')).toBeHidden();
  await expect(page.locator('.project-shell__header')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Project sections', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Download Markdown', exact: true })).toBeHidden();
  await page.screenshot({ path: info.outputPath('historical-print.png'), fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(group.locator('article')).toHaveCount(10);
  await page.getByRole('link', { name: 'Open current ' + unfinished[0]!.displayKey, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Changed current title', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to cycle review', exact: true }).click();
  await expect(page.locator('#cycle-result-heading')).toBeFocused();
  await expect(group).toContainText('Original commitment 1');
  await page.route(`**/api/work-items/${unfinished[0]!.id}`, route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Unavailable current record' } }) }));
  await page.getByRole('link', { name: 'Open current ' + unfinished[0]!.displayKey, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Work item detail could not be loaded');
  await page.getByRole('link', { name: 'Back to cycle review', exact: true }).click();
  await expect(page.locator('#cycle-result-heading')).toBeFocused();
  await expect(group).toContainText('Original commitment 1');
  const afterResponse = await request.get(apiBase() + reviewPath, { headers });
  const after = await afterResponse.json() as ProjectCycleReviewDto;
  expect(after.closeout!.snapshot).toEqual(before.closeout!.snapshot);
  await page.getByRole('link', { name: 'Current destination cycle', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Changed current destination', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to outcome at close', exact: true }).click();
  await expect(page.locator('#cycle-result-heading')).toBeFocused();

  // Legacy read-boundary fixture, separate from the product demo and the real v2 command above.
  const legacy = structuredClone(after);
  legacy.closeout!.snapshot.snapshotVersion = 1;
  legacy.closeout!.snapshot.health = { health: 'healthy', reasons: [] };
  await page.route('**/api' + reviewPath, route => route.fulfill({ json: legacy }));
  await page.reload();
  await expect(page.getByText('Snapshot v1', { exact: true })).toBeVisible();
  await group.getByRole('button', { name: 'Show all', exact: true }).click();
  await expect(group.locator('article')).toHaveCount(12);
  await expect(group).toContainText('Original commitment 12');
  const legacyDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown', exact: true }).click();
  const legacyMarkdown = await readFile((await (await legacyDownload).path())!, 'utf8');
  expect(JSON.parse(legacyMarkdown.split('```json\n')[1]!.split('\n```')[0]!)).toEqual(legacy.closeout!.snapshot);
  const final = await request.get(apiBase() + reviewPath, { headers });
  expect((await final.json() as ProjectCycleReviewDto).closeout!.snapshot).toEqual(before.closeout!.snapshot);
  expect(pageErrors).toEqual([]);
});
