import { expect, test } from '@playwright/test';

test('preserves native typing undo across preview and synchronizes undo/redo with its parent', async ({
  page
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample', exact: true }).click();
  const textarea = page.getByLabel('Description', { exact: true });
  await expect(textarea).not.toHaveValue('');
  const original = await textarea.inputValue();
  await expect(page.getByTestId('model')).toHaveText(original);
  await textarea.focus();
  await textarea.press('ControlOrMeta+End');
  await page.keyboard.type(' additional');
  await expect(page.getByTestId('model')).toHaveText(original + ' additional');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Description preview' })).toContainText(
    'additional'
  );
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(textarea).toBeVisible();
  await textarea.focus();
  await expect(textarea).toBeFocused();
  await textarea.press('ControlOrMeta+z');
  await expect(textarea).toHaveValue(original);
  await expect(page.getByTestId('model')).toHaveText(original);
  await textarea.press('ControlOrMeta+Shift+z');
  await expect(textarea).toHaveValue(original + ' additional');
  await expect(page.getByTestId('model')).toHaveText(original + ' additional');
  await expect(page.getByTestId('submits')).toHaveText('0');
});

test('handles keyboard link insertion, cancel, format conversion, reset, and post-command typing', async ({
  page
}) => {
  await page.goto('/');
  const textarea = page.getByLabel('Description', { exact: true });
  await textarea.fill('before label after');
  await textarea.press('Home');
  for (let index = 0; index < 7; index++) await textarea.press('ArrowRight');
  for (let index = 0; index < 5; index++) await textarea.press('Shift+ArrowRight');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  const url = page.getByRole('textbox', { name: 'URL', exact: true });
  await expect(url).toBeFocused();
  await url.fill('javascript:bad()');
  await url.press('Enter');
  await expect(page.getByRole('alert')).toContainText('valid HTTP or HTTPS URL');
  await url.fill('https://example.com/a_(b)');
  await url.press('Escape');
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveValue('before label after');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await url.fill('https://example.com/a_(b)');
  await url.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Cancel link', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveValue('before label after');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await url.fill('https://example.com/a_(b)');
  await url.press('Enter');
  await expect(textarea).toHaveValue('before [label](<https://example.com/a_(b)>) after');
  await expect(textarea).toBeFocused();
  await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption('plain_text');
  await expect(page.getByTestId('format')).toHaveText('plain_text');
  await expect(page.getByRole('group', { name: 'Description formatting' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Description preview' })).toContainText(
    '[label](<https://example.com/a_(b)>)'
  );
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(textarea).toHaveValue('');
  await expect(page.getByTestId('format')).toHaveText('markdown_v1');
  await textarea.fill('draft');
  await textarea.press('ControlOrMeta+a');
  await page.getByRole('button', { name: 'Bold', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(textarea).toHaveValue('**draft**');
  await textarea.press('End');
  await page.keyboard.type(' suffix');
  await textarea.press('ControlOrMeta+z');
  await expect(textarea).toHaveValue('**draft**');
  await expect(page.getByTestId('model')).toHaveText(await textarea.inputValue());
  await textarea.press('ControlOrMeta+Shift+z');
  await expect(textarea).toHaveValue('**draft** suffix');
  await expect(page.getByTestId('model')).toHaveText(await textarea.inputValue());
  await page.getByRole('button', { name: 'New identity', exact: true }).click();
  await expect(textarea).toHaveValue(/ suffix$/u);
  await page.getByRole('button', { name: 'Disable', exact: true }).click();
  await expect(textarea).toBeDisabled();
  await page.getByRole('button', { name: 'Enable', exact: true }).click();
  await expect(textarea).toBeEnabled();
  await expect(page.getByTestId('submits')).toHaveText('0');
});

test('contains editor, link form, and preview at desktop/mobile widths without remote requests', async ({
  page
}, testInfo) => {
  const remoteRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:')) remoteRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample', exact: true }).click();
  const editor = page.locator('app-authored-content-editor');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Link', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'URL', exact: true })
      .fill('https://example.com/' + 'long'.repeat(100));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const editScreenshot = testInfo.outputPath(`editor-${width}.png`);
    await editor.screenshot({ path: editScreenshot });
    await testInfo.attach(`editor-${width}`, { path: editScreenshot, contentType: 'image/png' });
    await page.getByRole('button', { name: 'Cancel link', exact: true }).click();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Description preview' }).locator('strong')
    ).toHaveText('API changes');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const previewScreenshot = testInfo.outputPath(`preview-${width}.png`);
    await editor.screenshot({ path: previewScreenshot });
    await testInfo.attach(`preview-${width}`, {
      path: previewScreenshot,
      contentType: 'image/png'
    });
  }
  expect(remoteRequests).toEqual([]);
  await expect(page.getByTestId('submits')).toHaveText('0');
});
