import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ProjectDto, WorkItemDetailDto } from '@worktrail/contracts';
import { demoIds } from '../apps/api/src/db/demo-ids';
import { resetDemoDatabase } from './reset-demo-database';

test.afterAll(resetDemoDatabase);

async function containsControls(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const failures = await page.locator('main h1, .content-shell button, .content-shell input, .content-shell select, .content-shell summary').evaluateAll(elements => elements.filter(element => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth + 1) return false;
    }
    return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
  }).map(element => element.getAttribute('aria-label') ?? element.textContent?.trim()));
  expect(failures).toEqual([]);
}

for (const [name, path] of [
  ['my-work', '/my-work'],
  ['work', '/work-items'],
  ['planning', `/projects/${demoIds.projects.app}/planning`],
  ['portfolio', '/portfolio'],
  ['long-detail', `/work-items/${demoIds.workItems.backlog}`]
]) {
  test(`cross-surface acceptance: ${name} viewport and font containment`, async ({ page, request }, info) => {
    let target = path;
    if (name === 'long-detail') {
      const api = `http://127.0.0.1:${process.env.API_PORT}/api`;
      const headers = { 'x-worktrail-workspace-id': demoIds.workspace, 'x-worktrail-member-id': demoIds.members.owner };
      const projectResponse = await request.post(api + '/projects', { headers, data: { key: 'MX20', name: 'Cross-surface project with a long coordination and delivery review name' } });
      expect(projectResponse.ok()).toBe(true);
      const project = await projectResponse.json() as ProjectDto;
      const response = await request.post(`${api}/projects/${project.id}/work-items`, { headers, data: { title: 'NonBreakingReference'.repeat(8), type: 'task', priority: 'medium' } });
      expect(response.ok()).toBe(true);
      target = '/work-items/' + (await response.json() as WorkItemDetailDto).id;
    }
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(target);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (name === 'my-work') await expect(page.locator('.work-row').first()).toBeVisible();
    if (name === 'work') {
      await expect(page.getByRole('status', { name: 'Work item results status', exact: true })).toContainText('Results updated:');
      await expect(page.getByRole('table', { name: 'Workspace work items', exact: true }).getByRole('columnheader')).not.toHaveCount(0);
    }
    if (name === 'planning') {
      await expect(page.locator('app-planning-review')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Project sections', exact: true }).getByRole('link', { name: 'Planning', exact: true })).toHaveAttribute('aria-current', 'page');
    }
    if (name === 'portfolio') await expect(page.locator('article.project-row').first()).toBeVisible();
    if (name === 'long-detail') await expect(page.locator('app-work-item-detail-summary')).toBeVisible();
    for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080], [568, 320]]) {
      await page.setViewportSize({ width, height });
      await containsControls(page);
      if ([320, 768, 1440, 568].includes(width)) await page.screenshot({ path: info.outputPath(`${name}-${width}x${height}.png`) });
      if (name === 'my-work' && [768, 1440].includes(width)) {
        await page.locator('.work-row').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`${name}-secondary-${width}.png`) });
        await page.evaluate(() => scrollTo(0, 0));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addStyleTag({ content: 'button, input, select, label { font-family: monospace !important; font-size: 20px !important; }' });
    await containsControls(page);
    await page.screenshot({ path: info.outputPath(`${name}-larger-control-fonts.png`) });
    expect(errors).toEqual([]);
  });
}
