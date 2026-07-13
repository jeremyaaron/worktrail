import { execFileSync } from 'node:child_process';

import { expect, test } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';

const projectId = '10000000-0000-4000-8000-000000000205';
const sourceCycleId = '10000000-0000-4000-8000-000000000374';
const destinationCycleId = '10000000-0000-4000-8000-000000000375';
const carriedItemId = '10000000-0000-4000-8000-000000000417';
const longCarriedTitle =
  'Carry estimated closeout follow-up into the planned validation cycle';
const childEnv: NodeJS.ProcessEnv = { ...process.env };

delete childEnv.NO_COLOR;
delete childEnv.FORCE_COLOR;

function runNpmScript(script: string): void {
  execFileSync('npm', ['run', script], {
    cwd: process.cwd(),
    env: childEnv,
    stdio: 'inherit'
  });
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    )
    .toBeLessThanOrEqual(1);
}

async function expectFocused(locator: Locator): Promise<void> {
  await expect
    .poll(async () => locator.evaluate((element) => element === element.ownerDocument.activeElement))
    .toBe(true);
}

async function captureScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string
): Promise<void> {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

function metric(page: Page, regionName: string, label: string): Locator {
  return page
    .getByLabel(regionName)
    .locator('div')
    .filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) })
    .locator('strong');
}

test.describe.serial('v0.2.4 cycle closeout', () => {
  test.afterAll(() => {
    if (process.env.WORKTRAIL_E2E_SKIP_DB_RESTORE === 'true') {
      return;
    }

    runNpmScript('db:reset');
    runNpmScript('db:migrate');
    runNpmScript('db:seed');
  });

  test('closes mixed cycle scope into a durable snapshot and planned carryover', async ({
    page
  }, testInfo) => {
    test.setTimeout(120_000);

    const sourceReviewPath = `/projects/${projectId}/cycles/${sourceCycleId}`;
    const previewPath = `${sourceReviewPath}/closeout`;
    const destinationReviewPath = `/projects/${projectId}/cycles/${destinationCycleId}`;
    const previewRequest = `**/api/projects/${projectId}/cycles/${sourceCycleId}/closeout-preview`;
    const closeRequest = `**/api/projects/${projectId}/cycles/${sourceCycleId}/closeout`;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(sourceReviewPath);
    await page.locator('#current-member').selectOption({
      label: 'Morgan Maintainer · maintainer'
    });
    await expect(page.locator('#current-member')).toHaveValue(
      '10000000-0000-4000-8000-000000000102'
    );
    await expect(page.getByRole('heading', { name: 'Closeout Demonstration' })).toBeVisible();

    await page.route(
      previewRequest,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.continue();
      },
      { times: 1 }
    );
    await page.getByRole('link', { name: 'Close cycle' }).click();
    await expect(page).toHaveURL(previewPath);
    await expect(page.getByRole('status')).toContainText('Loading cycle closeout preview');
    await expect(page.getByRole('heading', { name: 'Closeout Demonstration' })).toBeVisible();

    await expect(metric(page, 'Closeout scope metrics', 'Total')).toHaveText('5');
    await expect(metric(page, 'Closeout scope metrics', 'Completed')).toHaveText('1');
    await expect(metric(page, 'Closeout scope metrics', 'Canceled')).toHaveText('1');
    await expect(metric(page, 'Closeout scope metrics', 'Unfinished')).toHaveText('3');
    await expect(metric(page, 'Closeout scope metrics', 'Committed points')).toHaveText('12');
    await expect(metric(page, 'Closeout scope metrics', 'Unfinished points')).toHaveText('7');
    await expect(page.getByText('1 unestimated unfinished')).toBeVisible();

    const unfinishedWork = page.locator('.work-list').filter({
      has: page.getByText(longCarriedTitle, { exact: true })
    });
    await expect(unfinishedWork).toContainText('LAB-3');
    await expect(unfinishedWork).toContainText('LAB-4');
    await expect(unfinishedWork).toContainText('LAB-5');
    await expect(unfinishedWork).toContainText('Dependency blocked');

    const destinationChoice = page.getByRole('radio', { name: /Follow-up Validation/ });
    const unplannedChoice = page.getByRole('radio', { name: /Return to unplanned work/ });
    await expect(destinationChoice).toBeChecked();
    await expect(unplannedChoice).not.toBeChecked();
    await destinationChoice.focus();
    await page.keyboard.press('Tab');
    await expectFocused(unplannedChoice);
    await page.keyboard.press('Shift+Tab');
    await expectFocused(destinationChoice);

    for (const viewport of [
      { name: 'preview-desktop', width: 1440, height: 900 },
      { name: 'preview-compact', width: 1024, height: 768 },
      { name: 'preview-mobile', width: 390, height: 844 }
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expectNoPageOverflow(page);
      await expect
        .poll(() =>
          page
            .getByText(longCarriedTitle, { exact: true })
            .evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
        )
        .toBe(true);
      await captureScreenshot(page, testInfo, viewport.name);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    const closeButton = page.getByRole('button', { name: 'Close cycle' });
    const restingButtonBox = await closeButton.boundingBox();

    await page.route(
      closeRequest,
      async (route) => {
        expect(route.request().postDataJSON()).toEqual({ destinationCycleId });
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.continue();
      },
      { times: 1 }
    );
    await closeButton.click();
    const submittingButton = page.getByRole('button', { name: 'Closing...' });
    await expect(submittingButton).toBeDisabled();
    const submittingButtonBox = await submittingButton.boundingBox();
    expect(restingButtonBox).not.toBeNull();
    expect(submittingButtonBox).not.toBeNull();
    expect(submittingButtonBox?.width).toBeCloseTo(restingButtonBox?.width ?? 0, 0);
    expect(submittingButtonBox?.height).toBeCloseTo(restingButtonBox?.height ?? 0, 0);

    await expect(page).toHaveURL(sourceReviewPath);
    await expect(page.getByRole('heading', { name: 'Outcome at close' })).toBeVisible();
    await expect(page.getByText(/Closed .* by Morgan Maintainer/)).toBeVisible();
    await expect(metric(page, 'Cycle closeout metrics', 'Target points')).toHaveText('13');
    await expect(metric(page, 'Cycle closeout metrics', 'Committed points')).toHaveText('12');
    await expect(metric(page, 'Cycle closeout metrics', 'Completed points')).toHaveText('3');
    await expect(metric(page, 'Cycle closeout metrics', 'Retained')).toHaveText('2');
    await expect(metric(page, 'Cycle closeout metrics', 'Moved')).toHaveText('3');
    await expect(
      page.getByRole('heading', { name: 'Follow-up Validation received 3 moved items' })
    ).toBeVisible();
    await expect(page.getByText('Current state · Live view')).toBeVisible();

    for (const viewport of [
      { name: 'result-desktop', width: 1440, height: 900 },
      { name: 'result-compact', width: 1024, height: 768 },
      { name: 'result-mobile', width: 390, height: 844 }
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expectNoPageOverflow(page);
      await captureScreenshot(page, testInfo, viewport.name);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('link', { name: 'Review destination cycle' }).click();
    await expect(page).toHaveURL(destinationReviewPath);
    await expect(page.getByRole('heading', { name: 'Follow-up Validation' })).toBeVisible();
    await expect(page.getByLabel('Cycle progress summary')).toContainText('3');

    await page.goto(sourceReviewPath);
    await page.getByRole('link', { name: 'Open current LAB-3' }).click();
    await expect(page).toHaveURL(`/work-items/${carriedItemId}`);
    await expect(page.getByRole('heading', { name: longCarriedTitle })).toBeVisible();
    await expect(page.getByLabel('Metadata')).toContainText('Follow-up Validation');
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
    await expect(page.getByText('Cycle changed to Follow-up Validation.')).toBeVisible();
  });
});
