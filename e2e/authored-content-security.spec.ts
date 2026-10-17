import { expect, test } from '@playwright/test';
import type { WorkItemDetailDto } from '@worktrail/contracts';
import type { Locator } from '@playwright/test';
import { resetDemoDatabase } from './reset-demo-database';

const activeItemId = '10000000-0000-4000-8000-000000000402';
const archivedItemId = '10000000-0000-4000-8000-000000000427';
const headers = {
  'x-worktrail-workspace-id': '10000000-0000-4000-8000-000000000001',
  'x-worktrail-member-id': '10000000-0000-4000-8000-000000000101'
};
const apiURL = `http://${process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? '3000'}/api`;
test.afterAll(resetDemoDatabase);

async function expectInert(viewer: Locator) {
  await expect(
    viewer.locator(
      'script, style, img, svg, iframe, form, input, button, object, embed, video, audio, source, link, meta'
    )
  ).toHaveCount(0);
  expect(
    await viewer.evaluate(
      (root) =>
        [...root.querySelectorAll('*')].flatMap((element) =>
          [...element.attributes].filter(
            (attribute) =>
              /^on/i.test(attribute.name) || ['src', 'srcdoc', 'style'].includes(attribute.name)
          )
        ).length
    )
  ).toBe(0);
  for (const anchor of await viewer.locator('a').all()) {
    expect(await anchor.getAttribute('href')).toMatch(/^https?:\/\//);
    await expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(anchor).toHaveAttribute('referrerpolicy', 'no-referrer');
  }
}

test('renders hostile source and complete fallback without remote assets or privileged API calls', async ({
  page,
  request,
  baseURL
}, testInfo) => {
  test.setTimeout(90_000);
  const originalResponse = await request.get(`${apiURL}/work-items/${activeItemId}`, { headers });
  expect(originalResponse.ok()).toBe(true);
  const original = (await originalResponse.json()) as WorkItemDetailDto;
  const remote: string[] = [];
  const privileged: string[] = [];
  const errors: string[] = [];
  const localOrigin = new URL(baseURL!).origin;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== localOrigin) {
      remote.push(url.origin);
      await route.abort();
    } else await route.continue();
  });
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (
      url.pathname.startsWith('/api/') &&
      (req.method() !== 'GET' || /\/(exports?|imports?|settings)\b/.test(url.pathname))
    )
      privileged.push(`${req.method()} ${url.pathname}`);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const hostile = [
    '# Visible source',
    '',
    '**Safe emphasis**',
    '',
    '<script>window.contentExecuted = true</script>',
    '<svg onload="alert(1)"><a href="/api/work-items/export">bad</a></svg>',
    '<iframe src="https://assets.example.invalid/frame"></iframe>',
    '<img src="/api/work-items/export" onerror="alert(1)">',
    '<style>body { display:none }</style>',
    '',
    '![Visible alternative](https://assets.example.invalid/pixel.png)',
    '',
    '[JS](java&#x73;cript:alert%281%29) [Data](data:text/html,hello) [Relative](//assets.example.invalid/path)',
    '[Credentials](https://user:pass@assets.example.invalid) [Local](/api/work-items/export)',
    '',
    '[Safe reference](https://example.com/review)',
    '',
    '```html',
    '<img src="https://assets.example.invalid/code">',
    '```',
    '',
    '```text',
    'long-code-'.repeat(120),
    '```'
  ].join('\n');
  const fallback =
    '> '.repeat(100) + 'complete fallback <img src="https://assets.example.invalid/fallback">';
  try {
    for (const source of [hostile, fallback]) {
      const update = await request.patch(`${apiURL}/work-items/${activeItemId}`, {
        headers,
        data: { description: source, descriptionFormat: 'markdown_v1' }
      });
      expect(update.ok()).toBe(true);
      await page.goto(`/work-items/${activeItemId}`);
      const saved = page.locator('app-work-item-detail-summary app-authored-content-viewer');
      await expect(saved).toContainText(source === hostile ? 'Visible alternative' : fallback);
      await expectInert(saved);
      if (source === hostile) {
        await expect(saved.locator('a')).toHaveCount(1);
        await expect(saved.locator('script')).toHaveCount(0);
        await expect(saved).toContainText('<script>window.contentExecuted = true</script>');
      } else {
        await expect(saved.locator('.plain-content')).toHaveText(fallback);
        await expect(saved.locator('a')).toHaveCount(0);
      }
      const editor = page.locator(
        'app-authored-content-editor[formcontrolname="descriptionContent"]'
      );
      await editor.getByRole('button', { name: 'Preview', exact: true }).click();
      const preview = editor.locator('app-authored-content-viewer');
      await expectInert(preview);
      expect(await preview.innerHTML()).toBe(await saved.innerHTML());
      for (const width of [1440, 1024, 640, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await preview.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            )
          )
          .toBeLessThanOrEqual(1);
        await page.screenshot({
          path: testInfo.outputPath(`${source === hostile ? 'hostile' : 'fallback'}-${width}.png`)
        });
        if (source === hostile) {
          const code = preview.locator('pre').last();
          await expect(code.locator('code')).toHaveText('long-code-'.repeat(120));
          if (width === 320) {
            await code.screenshot({ path: testInfo.outputPath('code-320.png') });
          }
          expect(await code.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
            true
          );
          await expect(code).toHaveAttribute('tabindex', '0');
        }
      }
    }
    expect(remote).toEqual([]);
    expect(privileged).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => 'contentExecuted' in window)).toBe(false);
  } finally {
    const restore = await request.patch(`${apiURL}/work-items/${activeItemId}`, {
      headers,
      data: { description: original.description, descriptionFormat: original.descriptionFormat }
    });
    expect(restore.ok()).toBe(true);
  }
});

test('keeps seeded legacy and deleted content correct and archived formatted content read-only', async ({
  page,
  request
}) => {
  const remote: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).hostname === 'assets.example.invalid') remote.push(req.url());
  });
  await page.goto('/work-items/10000000-0000-4000-8000-000000000403');
  const summary = page.locator('app-work-item-detail-summary');
  await expect(summary).toContainText('**not emphasis**');
  await expect(
    summary.locator('app-authored-content-viewer strong, app-authored-content-viewer a')
  ).toHaveCount(0);
  await expect(
    page.locator('article.comment').filter({ hasText: 'This is the first slice' })
  ).toContainText('**Literal legacy punctuation**');
  const tombstone = page.locator('article.comment').filter({ hasText: 'Comment deleted' });
  await expect(
    tombstone.locator('app-authored-content-viewer, app-authored-content-editor')
  ).toHaveCount(0);
  await expect(
    page.getByText('This original body must never appear in the tombstone.')
  ).toHaveCount(0);
  for (const width of [640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1);
    if (width < 400) {
      const code = page.locator('article.comment app-authored-content-viewer pre').first();
      expect(await code.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        true
      );
      await expect(code).toHaveAttribute('tabindex', '0');
    }
  }
  await page.goto(`/work-items/${archivedItemId}`);
  await expect(page.locator('app-work-item-detail-summary strong')).toHaveText('original source');
  await expect(page.locator('article.comment app-authored-content-viewer strong')).toHaveText(
    'migration decision'
  );
  await expect(page.locator('#detail-description')).toBeDisabled();
  await expect(page.locator('#comment-body')).toBeDisabled();
  const itemResponse = await request.get(`${apiURL}/work-items/${archivedItemId}`, { headers });
  const item = (await itemResponse.json()) as WorkItemDetailDto;
  for (const response of [
    await request.patch(`${apiURL}/work-items/${archivedItemId}`, {
      headers,
      data: { description: 'Denied', descriptionFormat: 'markdown_v1' }
    }),
    await request.post(`${apiURL}/work-items/${archivedItemId}/comments`, {
      headers,
      data: { body: 'Denied', bodyFormat: 'markdown_v1' }
    }),
    await request.patch(`${apiURL}/comments/${item.comments[0].id}`, {
      headers,
      data: { body: 'Denied', bodyFormat: 'markdown_v1' }
    })
  ]) {
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'CONFLICT' } });
  }
  expect(remote).toEqual([]);
});
