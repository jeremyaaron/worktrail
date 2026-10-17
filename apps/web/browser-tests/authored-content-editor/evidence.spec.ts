import { expect, test } from '@playwright/test';

test('records parser and projection-policy timing outside Angular rendering', async ({
  page,
  browserName
}, testInfo) => {
  await page.goto('/');
  const cases = await page.evaluate(() => window.runContentBenchmark());
  const evidence = {
    browser: browserName,
    version: await page.context().browser()!.version(),
    cases
  };
  console.log(JSON.stringify(evidence));
  await testInfo.attach('content-timing.json', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json'
  });
  expect(cases[0].codeUnits).toBe(10_000);
  expect(cases[0].kind).toBe('markdown');
  expect(cases.every((entry) => entry.samples === 30)).toBe(true);
  // Timing targets are reviewed evidence, not CI speed assertions.
});

test('keeps composition input intact and performs keyboard-only formatting and link cancellation', async ({
  page
}) => {
  await page.goto('/');
  const textarea = page.getByRole('textbox', { name: 'Description', exact: true });
  await textarea.focus();
  await textarea.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    (element as HTMLTextAreaElement).value = 'composing';
    element.dispatchEvent(
      new InputEvent('input', { bubbles: true, isComposing: true, data: 'composing' })
    );
  });
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeDisabled();
  await textarea.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, data: 'composing' })
    );
  });
  await expect(page.getByTestId('model')).toHaveText('composing');
  await textarea.press('ControlOrMeta+a');
  await textarea.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Link', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Link', exact: true })).toHaveAttribute(
    'title',
    'Insert link'
  );
  await page.keyboard.press('Enter');
  const url = page.getByRole('textbox', { name: 'URL', exact: true });
  await expect(url).toBeFocused();
  await page.keyboard.type('https://example.com');
  await url.press('Escape');
  await expect(textarea).toBeFocused();
  expect(
    await textarea.evaluate((element) => [
      (element as HTMLTextAreaElement).selectionStart,
      (element as HTMLTextAreaElement).selectionEnd
    ])
  ).toEqual([0, 9]);
  await expect(page.getByTestId('submits')).toHaveText('0');
});
