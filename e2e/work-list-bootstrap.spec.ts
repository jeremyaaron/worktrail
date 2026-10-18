import { expect, test } from '@playwright/test';

const projectId = '10000000-0000-4000-8000-000000000201';
const ownerId = '10000000-0000-4000-8000-000000000101';

for (const scope of ['project', 'workspace'] as const) {
  test(`${scope} work retains deep-link paging after delayed initial member bootstrap`, async ({ page }) => {
    let releaseMembers!: () => void;
    let blockedRequests = 0;
    const membersReady = new Promise<void>(resolve => { releaseMembers = resolve; });
    await page.route('**/api/members', async route => {
      blockedRequests++;
      await membersReady;
      await route.continue();
    });

    const path = scope === 'project' ? `/projects/${projectId}/work-items` : '/work-items';
    const results = page.getByRole('region', {
      name: scope === 'project' ? 'Project work item results' : 'Workspace work item results',
      exact: true
    });
    const secondPage = results.getByRole('heading', { name: /^11-\d+ of \d+ work items$/ });
    // Wait for this page owner's initial query, not cold lazy-route rendering or pre-member results.
    const initialQuery = page.waitForRequest(request => {
      const url = new URL(request.url());
      return request.method() === 'GET' && url.pathname === `/api${path}` &&
        url.searchParams.get('page') === '2' && url.searchParams.get('pageSize') === '10';
    });
    try {
      await page.goto(`${path}?page=2&pageSize=10&sort=created_desc`);
      await expect.poll(() => blockedRequests).toBeGreaterThan(0);
      await initialQuery;
      releaseMembers();
      await expect(page.getByRole('combobox', { name: 'Acting as', exact: true })).toHaveValue(ownerId);
      await expect(secondPage).toBeVisible();
      await expect(page).toHaveURL(url => url.pathname === path &&
        url.searchParams.get('page') === '2' && url.searchParams.get('pageSize') === '10' &&
        url.searchParams.get('sort') === 'created_desc');
    } finally {
      releaseMembers();
    }
  });
}
