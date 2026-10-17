import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import type { CommentDto, ProjectDto, WorkItemDetailDto } from '@worktrail/contracts';
import { resetDemoDatabase } from './reset-demo-database';

test.afterAll(resetDemoDatabase);

const projectId = '10000000-0000-4000-8000-000000000201';
const ownerId = '10000000-0000-4000-8000-000000000101';
const contributorId = '10000000-0000-4000-8000-000000000103';
const headers = { 'x-worktrail-workspace-id': '10000000-0000-4000-8000-000000000001', 'x-worktrail-member-id': ownerId };
const apiURL = `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? '3000'}/api`;

async function createItem(request: APIRequestContext, title: string, parentWorkItemId?: string, project = projectId): Promise<WorkItemDetailDto> {
  const response = await request.post(`${apiURL}/projects/${project}/work-items`, {
    headers, data: { title, type: 'task', priority: 'medium', parentWorkItemId }
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<WorkItemDetailDto>;
}

async function expectRecord(page: Page, id: string, origin: string, immediate: string | null = null, fragment = ''): Promise<void> {
  await expect(page).toHaveURL(url => url.pathname === `/work-items/${id}` && url.searchParams.get('returnUrl') === origin && url.searchParams.get('returnTo') === immediate && url.hash === fragment);
  expect(new TextEncoder().encode(page.url()).length).toBeLessThan(12288);
}

test('bounded navigation preserves filtered page three across reload, hierarchy, cross-project dependencies and creation', async ({ page, request }) => {
  test.setTimeout(90_000);
  const prefix = `Bounded-${Date.now()}`;
  const parent = await createItem(request, `${prefix} parent`);
  const child = await createItem(request, `${prefix} child`, parent.id);
  for (let i = 0; i < 22; i++) await createItem(request, `${prefix} filler ${i}`);
  const originPath = `/work-items?search=${prefix}&sort=created_desc&page=3&pageSize=10`;
  await page.goto(originPath);
  const parentLink = page.getByRole('link', { name: new RegExp(parent.title) });
  const origin = new URL((await parentLink.getAttribute('href'))!, page.url()).searchParams.get('returnUrl')!;
  expect(new URL(origin, page.url()).searchParams.get('page')).toBe('3');
  await parentLink.click();
  await expectRecord(page, parent.id, origin);
  await page.locator('app-work-item-child-work > details > summary').click();
  await page.getByRole('link', { name: new RegExp(child.title) }).click();
  await expectRecord(page, child.id, origin, `/work-items/${parent.id}`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: child.title })).toBeVisible();
  await page.getByLabel('Parent work item').getByRole('link').click();
  await expectRecord(page, parent.id, origin);
  await page.getByRole('link', { name: 'Back to filtered work', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/work-items' && url.searchParams.get('page') === '3' && url.searchParams.get('pageSize') === '10' && url.searchParams.get('sort') === 'created_desc' && url.searchParams.get('search') === prefix);
  await page.reload();
  await expect(parentLink).toBeVisible();

  const projectsResponse = await request.get(`${apiURL}/projects`, { headers });
  expect(projectsResponse.ok()).toBe(true);
  const projects = await projectsResponse.json() as ProjectDto[];
  const otherProject = projects.find(project => project.id !== projectId && project.status === 'active')!;
  expect(otherProject).toBeTruthy();
  const other = await createItem(request, `${prefix} other project`, undefined, otherProject.id);
  const relationship = await request.post(`${apiURL}/work-items/${parent.id}/relationships`, { headers, data: { relationshipType: 'blocks', targetWorkItemId: other.id } });
  expect(relationship.ok()).toBe(true);
  await parentLink.click();
  await page.getByRole('navigation', { name: 'Work item sections' }).getByRole('link', { name: 'Dependencies', exact: true }).click();
  await expect(page.locator('#dependencies')).toBeFocused();
  await page.getByRole('region', { name: 'Blocks', exact: true }).getByRole('link', { name: new RegExp(other.title) }).click();
  await expectRecord(page, other.id, origin, `/work-items/${parent.id}#dependencies`);
  await page.getByRole('link', { name: 'Back to work item', exact: true }).click();
  await expectRecord(page, parent.id, origin, null, '#dependencies');
  await expect(page.locator('#dependencies')).toBeFocused();

  await page.locator('app-work-item-child-work > details > summary').click();
  await page.getByRole('link', { name: 'Add child work item', exact: true }).first().click();
  await expect(page).toHaveURL(url => url.searchParams.get('returnTo') === `/work-items/${parent.id}#dependencies` && url.searchParams.get('returnUrl') === origin && url.searchParams.get('parentWorkItemId') === parent.id);
  await page.getByLabel('Title', { exact: true }).fill(`${prefix} created child`);
  await page.getByRole('button', { name: 'Create work item', exact: true }).click();
  const success = page.getByLabel('Work item created', { exact: true });
  const createdHref = (await success.getByRole('link', { name: 'Open work item', exact: true }).getAttribute('href'))!;
  const createdId = new URL(createdHref, page.url()).pathname.split('/').at(-1)!;
  await success.getByRole('link', { name: 'Open work item', exact: true }).click();
  await expectRecord(page, createdId, origin, `/work-items/${parent.id}#dependencies`);
  await page.getByRole('link', { name: `Back to ${parent.displayKey}`, exact: true }).click();
  await expectRecord(page, parent.id, origin, null, '#dependencies');
  await expect(page.locator('#dependencies')).toBeFocused();
});

test('bounded navigation targets notification comments after commit and safely falls back for deleted or unavailable targets', async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  const a = await createItem(request, `Section source ${Date.now()}`);
  const b = await createItem(request, `Section destination ${Date.now()}`);
  const secret = `Comment target ${Date.now()}`;
  const posted = await request.post(`${apiURL}/work-items/${b.id}/comments`, { headers, data: { body: secret, bodyFormat: 'plain_text', mentionMemberIds: [contributorId] } });
  expect(posted.ok()).toBe(true);
  const comment = await posted.json() as CommentDto;
  await page.goto(`/work-items/${a.id}`);
  await page.locator('#current-member').selectOption(contributorId);
  await page.locator('button[aria-controls="edit-work-item"]').click();
  await page.locator('#detail-title').fill('Keep this source draft');
  const inbox = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: /^Inbox/ });
  await inbox.click();
  const decision = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await decision.getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(page.locator('#detail-title')).toHaveValue('Keep this source draft');
  await expect(page.locator(`#comment-${comment.id}`)).toHaveCount(0);
  await inbox.click();
  await decision.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.getByRole('link', { name: new RegExp(b.title) }).click();
  await expectRecord(page, b.id, '/inbox', null, `#comment-${comment.id}`);
  const target = page.locator(`#comment-${comment.id}`);
  await expect(target).toBeFocused();
  await page.reload();
  await expect(target).toBeFocused();
  const removed = await request.delete(`${apiURL}/comments/${comment.id}`, { headers });
  expect(removed.ok()).toBe(true);
  await page.reload();
  await expect(page.locator('#discussion')).toBeFocused();
  await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
  await expect(target.locator('app-authored-content-viewer')).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('navigation', { name: 'Work item sections' }).getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('#history')).toBeFocused();
  await expect(page.locator('#history > details')).toHaveAttribute('open', '');
  await page.goBack();
  await expect(page.locator('#discussion')).toBeFocused();
  await page.goForward();
  await expect(page.locator('#history')).toBeFocused();
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('navigation', { name: 'Work item sections' }).getByRole('link', { name: 'History', exact: true }).click();
    await expect(page.locator('#history')).toBeFocused();
    await expect.poll(() => page.locator('#history').evaluate(node => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    await expect.poll(() => page.locator('#history').evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(900);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`section-target-${width}.png`) });
  }
  const missingCommentURL = new URL(page.url());
  missingCommentURL.hash = 'comment-10000000-0000-4000-8000-000000099999';
  await page.goto(missingCommentURL.toString());
  await expect(page.locator('#discussion')).toBeFocused();

  // A valid local return address never bypasses a rejected resource load.
  await page.route(`**/api/work-items/${b.id}`, route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Access denied' } }) }));
  const denied = page.waitForResponse(response => response.url().endsWith(`/api/work-items/${b.id}`));
  await page.reload();
  expect((await denied).status()).toBe(403);
  await expect(page.getByRole('alert')).toContainText('Work item detail could not be loaded');
  await expect(page.locator('#discussion')).toHaveCount(0);
  await expect(target).toHaveCount(0);
});
