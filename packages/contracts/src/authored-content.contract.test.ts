import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  authoredContentFormats,
  authoredContentSourceLimit,
  normalizeAuthoredContentSource,
  type AuthoredContentFormat
} from './index.js';

describe('authored content primitives', () => {
  it('exports the finite source-format vocabulary and UTF-16 source limit', () => {
    expect(authoredContentFormats).toEqual(['plain_text', 'markdown_v1']);
    expectTypeOf<AuthoredContentFormat>().toEqualTypeOf<'plain_text' | 'markdown_v1'>();
    expectTypeOf(authoredContentFormats).toEqualTypeOf<readonly ['plain_text', 'markdown_v1']>();
    expect(authoredContentSourceLimit).toBe(10_000);
  });

  it.each([
    ['', ''],
    ['first\r\nsecond\rthird\n', 'first\nsecond\nthird\n'],
    ['\r\n\r\r\n', '\n\n\n'],
    ['  indented\tcode  \r\n\r\n', '  indented\tcode  \n\n'],
    ['**literal** <tag> &amp;\n', '**literal** <tag> &amp;\n'],
    ['Cafe\u0301\u2028\u2029\u{1f600}', 'Cafe\u0301\u2028\u2029\u{1f600}']
  ])('normalizes line endings without other source changes: %j', (source, expected) => {
    const normalized = normalizeAuthoredContentSource(source);

    expect(normalized).toBe(expected);
    expect(normalizeAuthoredContentSource(normalized)).toBe(normalized);
  });

  it('does not truncate or validate legacy-sized strings', () => {
    const source = `${'\u{1f600}'.repeat(authoredContentSourceLimit)}\r\n`;

    expect(normalizeAuthoredContentSource(source)).toBe(
      `${'\u{1f600}'.repeat(authoredContentSourceLimit)}\n`
    );
  });
});
