import { expect, test } from '@playwright/test';
import type { SavedWorkViewDto } from '@worktrail/contracts';
import { resetDemoDatabase } from './reset-demo-database';

test.afterEach(resetDemoDatabase);

const projectId = '10000000-0000-4000-8000-000000000201';
const headers = {'x-worktrail-workspace-id':'10000000-0000-4000-8000-000000000001', 'x-worktrail-member-id':'10000000-0000-4000-8000-000000000101'};
const apiURL = `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? '3000'}/api`;

for (const scope of ['workspace','project'] as const) {
  test(`shared saved view state: ${scope} applied identity, latest feedback and 100-row navigation`, async ({page,request}, testInfo) => {
    test.setTimeout(90_000);
    const prefix = `ViewState-${scope}-${Date.now()}`;
    for (let i=0;i<105;i++) {
      const created = await request.post(`${apiURL}/projects/${projectId}/work-items`, {headers,
        data:{title:`${prefix} ${i}`, type:'task', priority:'medium', status:'ready'}});
      expect(created.ok()).toBe(true);
    }
    const query = {search:prefix, estimateState:'unestimated', sort:'created_desc'};
    const saved = await request.post(`${apiURL}/saved-work-views`, {headers, data:{name:prefix, scope, query,
      ...(scope === 'project' ? {projectId} : {})}});
    expect(saved.ok()).toBe(true);
    const view = await saved.json() as SavedWorkViewDto;
    const path = scope === 'project' ? `/projects/${projectId}/work-items` : '/work-items';
    await page.goto(`${path}?search=${prefix}`);
    const currentView = page.getByLabel('Current view', {exact:true});
    const feedback = page.getByRole('status', {name:'Work item results status',exact:true});
    const top = page.getByRole('navigation', {name:'Work item result navigation',exact:true});
    const bottom = page.getByRole('navigation', {name:'Work item pages',exact:true});
    await expect(currentView).toHaveText('Custom');
    await expect(feedback).toContainText('Results updated:');

    let release!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    let pause = true;
    let fail = false;
    const matcher = new RegExp(`/api${path.replaceAll('/','\\/')}(?:\\?.*)?$`);
    await page.route(matcher, async route => {
      if (route.request().method() !== 'GET') return route.continue();
      if (pause) { pause = false; await paused; }
      if (fail) { fail = false; return route.fulfill({status:500, contentType:'application/json', body:JSON.stringify({error:{message:'Expected load failure'}})}); }
      await route.continue();
    });
    await page.getByLabel('Open saved view', {exact:true}).selectOption(view.id);
    const openedRequest = page.waitForRequest(request => new URL(request.url()).pathname === `/api${path}`);
    await page.getByRole('button', {name:'Open selected saved view',exact:true}).click();
    await openedRequest;
    await expect(currentView).toHaveText(`Named: ${prefix}`);
    await expect(feedback).toBeEmpty();
    release();
    await expect(feedback).toContainText(`Named: ${prefix}. Results updated: 1-25 of 105`);

    const filters = page.locator('form.filters');
    await filters.getByLabel('Search', {exact:true}).fill(prefix+' staged');
    await expect(currentView).toHaveText(`Named: ${prefix}`);
    await filters.getByLabel('Search', {exact:true}).fill(prefix);
    await filters.getByRole('combobox', {name:'Status',exact:true}).selectOption('ready');
    await filters.getByRole('button', {name:'Apply',exact:true}).click();
    await expect(currentView).toHaveText(`Modified: ${prefix}`);
    await expect(feedback).toContainText('Results updated:');
    const listQuery = new URLSearchParams({scope, ...(scope === 'project' ? {projectId} : {})});
    const before = await request.get(`${apiURL}/saved-work-views?${listQuery}`, {headers});
    expect((await before.json() as SavedWorkViewDto[]).find(current => current.id === view.id)?.query.status).toBeUndefined();

    await page.locator('.saved-view-manager > summary').click();
    await page.getByLabel('Manage saved view', {exact:true}).selectOption(view.id);
    const panel = page.locator('.saved-view-management-panel');
    const updated = page.waitForResponse(response => response.request().method()==='PATCH' && response.url().endsWith(`/saved-work-views/${view.id}`));
    await panel.getByRole('button', {name:`Update query for ${prefix}`,exact:true}).click();
    const update = await updated;
    expect(update.ok()).toBe(true);
    expect(update.request().postDataJSON().query).toEqual({...query, status:'ready'});
    await expect(currentView).toHaveText(`Named: ${prefix}`);
    await panel.getByRole('button', {name:`Pin ${prefix}`,exact:true}).click();
    const pinned = page.getByRole('button', {name:`Open pinned personal view ${prefix}`,exact:true});
    await expect(pinned).toHaveAttribute('aria-pressed','true');
    const renamed = `${prefix} renamed`;
    await panel.getByLabel('Rename', {exact:true}).fill(renamed);
    await panel.getByRole('button', {name:`Rename ${prefix}`,exact:true}).click();
    await expect(currentView).toHaveText(`Named: ${renamed}`);
    await page.getByRole('button', {name:`Open pinned personal view ${renamed}`,exact:true}).click();
    await expect(feedback).toContainText(`Named: ${renamed}. Results updated:`);
    await page.locator('.saved-view-manager > summary').click();

    await top.getByLabel('Items per page').selectOption('100');
    await expect(top).toContainText('1-100 of 105 work items');
    await expect(bottom.getByLabel('Items per page')).toHaveValue('100');
    await expect(currentView).toHaveText(`Named: ${renamed}`);
    if (scope === 'project') {
      await page.getByRole('button', {name:'Bulk edit',exact:true}).click();
      const table = page.getByRole('table', {name:'Work items',exact:true});
      await expect(table.getByRole('columnheader')).toHaveCount(7);
      await table.getByRole('checkbox', {name:'Select all visible work items',exact:true}).check();
      await expect(page.getByLabel('Bulk work item actions')).toContainText('100 selected on this page');
    }
    await top.getByRole('button', {name:'Next',exact:true}).click();
    await expect(top).toContainText('101-105 of 105 work items');
    await expect(bottom).toContainText('Page 2 of 2');
    await expect(currentView).toHaveText(`Named: ${renamed}`);
    if (scope === 'project') {
      await expect(page.getByRole('status', {name:'Work item selection status',exact:true})).toContainText('Selection cleared:');
      await expect(page.locator('app-work-item-result-list input:checked')).toHaveCount(0);
    }
    for (const width of [1280,320]) {
      await page.setViewportSize({width,height:900});
      await top.scrollIntoViewIfNeeded();
      await expect(top.getByRole('button', {name:'Previous',exact:true})).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({path:testInfo.outputPath(`${scope}-results-${width}.png`)});
    }
    if (scope === 'project') {
      await page.locator('.mobile-selection input').check();
      await expect(page.getByLabel('Bulk work item actions')).toContainText('5 selected on this page');
      await page.getByRole('button', {name:'Exit bulk edit',exact:true}).click();
    }
    await page.setViewportSize({width:1280,height:900});
    fail = true;
    await filters.getByLabel('Search', {exact:true}).fill(prefix+' missing');
    await filters.getByRole('button', {name:'Apply',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('could not be loaded');
    await expect(feedback).toBeEmpty();
    await page.getByRole('alert').getByRole('button', {name:'Retry',exact:true}).click();
    await expect(feedback).toContainText('Results updated: 0-0 of 0');
    await page.locator('.saved-view-manager > summary').click();
    await page.getByLabel('Manage saved view', {exact:true}).selectOption(view.id);
    await panel.getByRole('button', {name:`Delete ${renamed}`,exact:true}).click();
    await expect(currentView).toHaveText('Custom');
    await expect(page.getByLabel('Open saved view', {exact:true})).toHaveValue('');
  });
}
