import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';
import type { APIRequestContext, Download, Page } from '@playwright/test';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const ownerId = '10000000-0000-4000-8000-000000000101';
const appProjectId = '10000000-0000-4000-8000-000000000201';
const inProgressWorkItemId = '10000000-0000-4000-8000-000000000403';
const hierarchyChildId = '10000000-0000-4000-8000-000000000421';
const hierarchyParentId = '10000000-0000-4000-8000-000000000420';
const markdownContents = [
  '# Attachment requirements',
  '',
  '- Preserve exact file bytes.',
  '- Keep object storage and metadata consistent.',
  ''
].join('\n');
const jsonContents = [
  '{',
  '  "check": "attachment download",',
  '  "result": "passed",',
  '  "workItem": "WT-3"',
  '}',
  ''
].join('\n');
const childEnv: NodeJS.ProcessEnv = { ...process.env };

delete childEnv.NO_COLOR;
delete childEnv.FORCE_COLOR;

function apiBaseURL(): string {
  const apiPort = Number.parseInt(process.env.API_PORT ?? '3000', 10);
  const host = process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1';
  return `http://${host}:${apiPort}`;
}

function runNpmScript(script: string): void {
  execFileSync('npm', ['run', script], {
    cwd: process.cwd(),
    env: childEnv,
    stdio: 'inherit'
  });
}

async function downloadText(download: Download): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'worktrail-attachment-download-'));
  const filePath = join(directory, download.suggestedFilename());

  try {
    await download.saveAs(filePath);
    return await readFile(filePath, 'utf8');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    )
    .toBeLessThanOrEqual(1);
}

async function downloadAttachment(page: Page, fileName: string): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download ${fileName}` }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(fileName);
  return downloadText(download);
}

async function setProjectArchived(
  request: APIRequestContext,
  archived: boolean
): Promise<void> {
  const response = await request.post(
    `${apiBaseURL()}/api/projects/${appProjectId}/${archived ? 'archive' : 'reactivate'}`,
    {
      headers: {
        'x-worktrail-member-id': ownerId,
        'x-worktrail-workspace-id': workspaceId
      }
    }
  );

  if (!response.ok()) {
    throw new Error(
      `Failed to ${archived ? 'archive' : 'reactivate'} project: ${response.status()} ${await response.text()}`
    );
  }
}

test.describe.serial('v0.2.7 attachment lifecycle', () => {
  test.afterAll(() => {
    if (process.env.WORKTRAIL_E2E_SKIP_DB_RESTORE === 'true') {
      return;
    }

    runNpmScript('db:reset');
    runNpmScript('db:migrate');
    runNpmScript('db:seed');
  });

  test('downloads seeded files exactly and refreshes attachments across reused detail routes', async ({
    page
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/work-items/${inProgressWorkItemId}`);
    await expect(
      page.getByRole('heading', { name: 'Implement transport-neutral API handler contract' })
    ).toBeVisible();

    const attachments = page.locator('section.attachments');
    await expect(attachments.getByRole('heading', { name: 'Attachments 2' })).toBeVisible();
    await expect(attachments.getByText('attachment-requirements.md', { exact: true })).toBeVisible();
    await expect(attachments.getByText('verification-evidence.json', { exact: true })).toBeVisible();
    await expect(attachments.locator('embed, iframe, img, object')).toHaveCount(0);
    await expect(downloadAttachment(page, 'attachment-requirements.md')).resolves.toBe(
      markdownContents
    );
    await expect(downloadAttachment(page, 'verification-evidence.json')).resolves.toBe(jsonContents);
    await expectNoPageOverflow(page);

    await page
      .getByRole('region', { name: 'Blocks' })
      .getByRole('link', { name: /WT-2 Add filter controls to work item list/ })
      .click();
    await expect(page).toHaveURL('/work-items/10000000-0000-4000-8000-000000000402');
    await expect(page.getByRole('heading', { name: 'Add filter controls to work item list' })).toBeVisible();
    await expect(attachments.getByRole('heading', { name: 'Attachments 0' })).toBeVisible();
    await expect(attachments.getByText('No attachments')).toBeVisible();

    await page.goto(`/work-items/${hierarchyChildId}`);
    const parentContext = page.getByLabel('Parent work item');
    await expect(parentContext).toContainText('WT-12');
    await parentContext.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/work-items/${hierarchyParentId}(?:\\?|$)`));
    await expect(
      page.getByRole('heading', {
        name: 'Coordinate the Work Breakdown launch across product and platform teams'
      })
    ).toBeVisible();
    await expect(attachments.getByRole('heading', { name: 'Attachments 0' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoPageOverflow(page);
  });

  test('handles upload retry, role-based removal, and archived read-only access', async ({
    page,
    request
  }) => {
    test.setTimeout(120_000);
    const longFileName = `contributor-${'review-'.repeat(14)}notes.txt`;
    const retryFileName = 'retry-evidence.json';
    const unsupportedFileName = 'unsafe-script.exe';
    let failedRetryRequest = false;

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/work-items/${inProgressWorkItemId}`);
    await page.locator('#current-member').selectOption({ label: 'Casey Contributor · contributor' });

    const attachments = page.locator('section.attachments');
    await expect(attachments.getByRole('button', { name: 'Remove attachment-requirements.md' })).toHaveCount(0);
    await expect(attachments.getByRole('button', { name: 'Remove verification-evidence.json' })).toHaveCount(0);

    await page.route(`**/api/work-items/${inProgressWorkItemId}/attachments`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      const encodedName = route.request().headers()['x-worktrail-filename'] ?? '';
      const fileName = decodeURIComponent(encodedName);

      if (fileName === longFileName) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (fileName === retryFileName && !failedRetryRequest) {
        failedRetryRequest = true;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'ATTACHMENT_STORAGE_UNAVAILABLE',
              message: 'Temporary attachment test failure.'
            }
          })
        });
        return;
      }

      await route.continue();
    });

    const fileInput = attachments.getByLabel('Choose attachment files');
    await expect(fileInput).toHaveAttribute('accept', /\.txt/);
    await fileInput.setInputFiles([
      {
        name: longFileName,
        mimeType: 'text/plain',
        buffer: Buffer.from('Contributor review notes.\n')
      },
      {
        name: retryFileName,
        mimeType: 'application/json',
        buffer: Buffer.from('{"verified":true}\n')
      },
      {
        name: unsupportedFileName,
        mimeType: 'application/octet-stream',
        buffer: Buffer.from([0x4d, 0x5a, 0x00, 0x01])
      }
    ]);

    const progress = attachments.getByRole('progressbar', { name: `Uploading ${longFileName}` });
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute('max', '100');
    await expect(attachments.getByRole('button', { name: 'Uploading...' })).toBeDisabled();
    await expect(attachments.getByText('1 file uploaded. 2 files need attention.')).toBeVisible();
    await expect(attachments.getByText('Temporary attachment test failure.')).toBeVisible();
    await expect(attachments.getByText('This attachment file type is not supported.')).toBeVisible();

    await attachments.getByRole('button', { name: `Retry upload of ${retryFileName}` }).click();
    await expect(attachments.getByText('1 file uploaded. 1 file needs attention.')).toBeVisible();
    await expect(attachments.getByText(retryFileName, { exact: true })).toBeVisible();
    await attachments.getByRole('button', { name: `Dismiss ${unsupportedFileName}` }).click();
    await expect(attachments.getByRole('heading', { name: 'Selected files' })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(attachments.getByText(longFileName, { exact: true })).toBeVisible();
    await expectNoPageOverflow(page);

    await attachments.getByRole('button', { name: `Remove ${retryFileName}` }).click();
    await attachments.getByRole('button', { name: 'Remove file' }).click();
    await expect(attachments.getByText(`Removed attachment "${retryFileName}".`)).toBeVisible();
    await expect(page.getByText(`Removed attachment "${retryFileName}".`).last()).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('#current-member').selectOption({ label: 'Morgan Maintainer · maintainer' });
    await attachments.getByRole('button', { name: `Remove ${longFileName}` }).click();
    await attachments.getByRole('button', { name: 'Remove file' }).click();
    await expect(attachments.getByText(longFileName, { exact: true })).toHaveCount(0);
    await expect(page.getByText(`Removed attachment "${longFileName}".`).last()).toBeVisible();

    await setProjectArchived(request, true);
    await page.reload();
    await expect(attachments.getByText('File changes are unavailable for this project.')).toBeVisible();
    await expect(attachments.getByRole('button', { name: 'Add files' })).toHaveCount(0);
    await expect(attachments.getByRole('button', { name: /^Remove / })).toHaveCount(0);
    await expect(downloadAttachment(page, 'attachment-requirements.md')).resolves.toBe(
      markdownContents
    );
    await expectNoPageOverflow(page);

    await setProjectArchived(request, false);
  });
});
