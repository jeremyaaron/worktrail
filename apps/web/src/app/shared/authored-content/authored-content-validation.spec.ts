import { describe, expect, it } from 'vitest';

import { FormControl } from '@angular/forms';
import { authoredContentValidator } from './authored-content-validation';
import { authoredContentEquals, type AuthoredContentValue } from './authored-content-value';

describe('authored-content validation', () => {
  const validate = (
    source: string,
    format: AuthoredContentValue['format'] = 'markdown_v1',
    options: Parameters<typeof authoredContentValidator>[0] = {}
  ) => authoredContentValidator(options)(new FormControl({ source, format }));

  it('allows empty descriptions but requires non-whitespace comments', () => {
    expect(validate('')).toBeNull();
    expect(validate(' \t\r\n', 'markdown_v1', { requireNonWhitespace: true })).toEqual({
      authoredContentRequired: true
    });
    expect(validate(' **text** ', 'markdown_v1', { requireNonWhitespace: true })).toBeNull();
  });

  it('measures normalized UTF-16 units, without trimming source', () => {
    expect(validate('\r\n'.repeat(10000))).toBeNull();
    expect(validate('\ud83d\ude00'.repeat(5000))).toBeNull();
    expect(validate(' '.repeat(10001))).toEqual({
      authoredContentTooLong: { maximumCodeUnits: 10000, actualCodeUnits: 10001 }
    });
    expect(validate('\ud83d\ude00'.repeat(5000) + 'x')).toEqual({
      authoredContentTooLong: { maximumCodeUnits: 10000, actualCodeUnits: 10001 }
    });
  });

  it('grandfathers unchanged oversized pairs and equivalent historical line endings', () => {
    const baseline: AuthoredContentValue = { source: '\r\n'.repeat(10001), format: 'plain_text' };
    expect(validate('\n'.repeat(10001), 'plain_text', { baseline })).toBeNull();
    expect(validate(baseline.source, 'markdown_v1', { baseline })).not.toBeNull();
    expect(validate('x'.repeat(10001), 'plain_text', { baseline })).not.toBeNull();
    expect(validate('shortened', 'markdown_v1', { baseline })).toBeNull();
  });

  it('allows unchanged legacy blank comments but not changed/conversion blank comments', () => {
    const baseline: AuthoredContentValue = { source: ' \r\n ', format: 'plain_text' };
    const options = { baseline, requireNonWhitespace: true };
    expect(validate(' \n ', 'plain_text', options)).toBeNull();
    expect(validate(baseline.source, 'markdown_v1', options)).toEqual({
      authoredContentRequired: true
    });
    expect(validate('\t', 'plain_text', options)).toEqual({ authoredContentRequired: true });
  });

  it('snapshots its baseline and policy without mutating parent values', () => {
    const baseline = { source: ' '.repeat(10001), format: 'plain_text' as const };
    const options = { baseline, requireNonWhitespace: true };
    const validator = authoredContentValidator(options);
    const control = new FormControl({ ...baseline });
    baseline.source = 'changed';
    options.requireNonWhitespace = false;
    expect(validator(control)).toBeNull();
    control.setValue({ source: ' ', format: 'plain_text' });
    expect(validator(control)).toEqual({ authoredContentRequired: true });
  });

  for (const value of [
    null,
    undefined,
    'text',
    {},
    { source: 1, format: 'plain_text' },
    { source: '', format: 'unknown' }
  ]) {
    it(`rejects an invalid compound value ${JSON.stringify(value)}`, () => {
      expect(authoredContentValidator()(new FormControl(value))).toEqual({
        authoredContentValue: true
      });
    });
  }

  it('compares format and normalized source but not trimmed source', () => {
    const baseline: AuthoredContentValue = { source: ' x\r\ny ', format: 'plain_text' };
    expect(authoredContentEquals({ source: ' x\ny ', format: 'plain_text' }, baseline)).toBe(true);
    expect(authoredContentEquals({ source: 'x\ny', format: 'plain_text' }, baseline)).toBe(false);
    expect(
      authoredContentEquals({ source: baseline.source, format: 'markdown_v1' }, baseline)
    ).toBe(false);
  });
});
