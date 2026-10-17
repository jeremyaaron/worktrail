import { authoredContentFormats, authoredContentSourceLimit } from '@worktrail/contracts';
import { describe, expect, it } from 'vitest';

import {
  resolveNewAuthoredContent,
  resolveUpdatedAuthoredContent
} from '../src/domain/authored-content-policy.js';
import { toApiErrorResponse, ValidationError } from '../src/errors/app-error.js';

const descriptionPolicy = { sourceField: 'description', requireNonWhitespace: false } as const;
const commentPolicy = { sourceField: 'body', requireNonWhitespace: true } as const;

describe('new authored content', () => {
  it('defaults omitted description source/format without inferring Markdown', () => {
    expect(resolveNewAuthoredContent({}, descriptionPolicy)).toEqual({
      source: '',
      format: 'plain_text',
      changed: true
    });
    expect(resolveNewAuthoredContent({ source: '# Heading' }, descriptionPolicy)).toEqual({
      source: '# Heading',
      format: 'plain_text',
      changed: true
    });
  });

  it.each(authoredContentFormats)('normalizes %s without trimming source', (format) => {
    expect(
      resolveNewAuthoredContent({ source: '  indented\tcode  \r\n\rtrailing  ', format }, commentPolicy)
    ).toEqual({ source: '  indented\tcode  \n\ntrailing  ', format, changed: true });
  });

  it.each(['', ' \t\r\n\u00a0\u2003'])('accepts blank description source: %j', (source) => {
    expect(resolveNewAuthoredContent({ source, format: 'markdown_v1' }, descriptionPolicy)).toEqual({
      source: source.replace(/\r\n?/g, '\n'),
      format: 'markdown_v1',
      changed: true
    });
  });

  it.each([undefined, '', ' \t\r\n\u00a0\u2003'])('rejects blank comment source: %j', (source) => {
    expect(() => resolveNewAuthoredContent({ source }, commentPolicy)).toThrow(ValidationError);
  });

  it('allows non-whitespace Unicode comments without altering source', () => {
    const source = ' \u{1f600}\t ';
    expect(resolveNewAuthoredContent({ source }, commentPolicy).source).toBe(source);
  });
});

describe('updated authored content', () => {
  it.each(authoredContentFormats)('preserves omitted fields for stored %s', (format) => {
    const current = { source: 'legacy\r\nsource  ', format };

    expect(resolveUpdatedAuthoredContent(current, {}, descriptionPolicy)).toEqual({
      ...current,
      changed: false
    });
    expect(
      resolveUpdatedAuthoredContent(current, { source: 'new\r\nsource' }, descriptionPolicy)
    ).toEqual({ source: 'new\nsource', format, changed: true });
  });

  it.each([
    { source: '  legacy\r\nsource\r  ' },
    { source: '  legacy\nsource\n  ' },
    { source: '  legacy\rsource\r\n  ' },
    { format: 'markdown_v1' as const },
    { source: '  legacy\nsource\n  ', format: 'markdown_v1' as const }
  ])('preserves exact stored bytes for an equivalent pair: %j', (input) => {
    const current = { source: '  legacy\r\nsource\r  ', format: 'markdown_v1' } as const;

    expect(resolveUpdatedAuthoredContent(current, input, commentPolicy)).toEqual({
      ...current,
      changed: false
    });
  });

  it.each(authoredContentFormats)('treats conversion away from %s as a pair change', (format) => {
    const current = { source: '  literal **source**\r\n', format };
    const nextFormat = format === 'plain_text' ? 'markdown_v1' : 'plain_text';

    expect(resolveUpdatedAuthoredContent(current, { format: nextFormat }, commentPolicy)).toEqual({
      source: current.source,
      format: nextFormat,
      changed: true
    });
    expect(
      resolveUpdatedAuthoredContent(
        current,
        { source: '  literal **source**\n', format: nextFormat },
        commentPolicy
      )
    ).toEqual({ source: current.source, format: nextFormat, changed: true });
  });

  it.each(['source ', ' source', '  source', 'source\n'])(
    'retains significant whitespace changes: %j',
    (source) => {
      expect(
        resolveUpdatedAuthoredContent(
          { source: 'source', format: 'plain_text' },
          { source },
          descriptionPolicy
        )
      ).toEqual({ source, format: 'plain_text', changed: true });
    }
  );

  it('saves changed source and format together without modifying inputs', () => {
    const current = Object.freeze({ source: 'before\r\n', format: 'plain_text' as const });
    const input = Object.freeze({ source: '  after\r\n  ', format: 'markdown_v1' as const });

    expect(resolveUpdatedAuthoredContent(current, input, commentPolicy)).toEqual({
      source: '  after\n  ',
      format: 'markdown_v1',
      changed: true
    });
    expect(current.source).toBe('before\r\n');
    expect(input.source).toBe('  after\r\n  ');
  });

  it('allows clearing a description but rejects clearing a comment', () => {
    const current = { source: 'before', format: 'markdown_v1' } as const;

    expect(resolveUpdatedAuthoredContent(current, { source: '' }, descriptionPolicy)).toEqual({
      source: '',
      format: 'markdown_v1',
      changed: true
    });
    for (const source of ['', ' \t\r\n\u00a0']) {
      expect(() => resolveUpdatedAuthoredContent(current, { source }, commentPolicy)).toThrow(
        ValidationError
      );
    }
  });

  it('preserves a blank legacy comment on a no-op but validates its conversion', () => {
    const current = { source: ' \r\n ', format: 'plain_text' } as const;

    expect(resolveUpdatedAuthoredContent(current, {}, commentPolicy)).toEqual({
      ...current,
      changed: false
    });
    expect(resolveUpdatedAuthoredContent(current, { source: ' \n ' }, commentPolicy)).toEqual({
      ...current,
      changed: false
    });
    expect(() =>
      resolveUpdatedAuthoredContent(current, { format: 'markdown_v1' }, commentPolicy)
    ).toThrow(ValidationError);
  });
});

describe('normalized source limits', () => {
  const cases = [
    ['ASCII', 'x'.repeat(authoredContentSourceLimit), 'x'.repeat(authoredContentSourceLimit + 1)],
    ['surrogate pairs', '\u{1f600}'.repeat(5_000), `${'\u{1f600}'.repeat(5_000)}x`],
    ['CRLF', 'x\r\n'.repeat(5_000), `${'x\r\n'.repeat(5_000)}x`],
    ['lone CR', 'x\r'.repeat(5_000), `${'x\r'.repeat(5_000)}x`],
    ['UTF-8 multibyte', '\u00e9'.repeat(10_000), '\u00e9'.repeat(10_001)]
  ] as const;

  describe.each(authoredContentFormats)('%s', (format) => {
    it.each(cases)('applies the exact normalized UTF-16 boundary to %s', (_name, accepted, rejected) => {
      for (const policy of [descriptionPolicy, commentPolicy]) {
        const current = { source: 'before', format };
        const result = resolveNewAuthoredContent({ source: accepted, format }, policy);
        expect(result.source).toHaveLength(authoredContentSourceLimit);
        expect(resolveUpdatedAuthoredContent(current, { source: accepted }, policy)).toEqual(result);
        expect(() => resolveNewAuthoredContent({ source: rejected, format }, policy)).toThrow(
          ValidationError
        );
        expect(() => resolveUpdatedAuthoredContent(current, { source: rejected }, policy)).toThrow(
          ValidationError
        );
      }
    });
  });

  it.each(authoredContentFormats)('grandfathers unchanged oversized %s but not conversion', (format) => {
    const current = { source: `  ${'legacy\r\n'.repeat(2_000)}  `, format };
    const normalized = current.source.replace(/\r\n/g, '\n');
    const nextFormat = format === 'plain_text' ? 'markdown_v1' : 'plain_text';

    for (const policy of [descriptionPolicy, commentPolicy]) {
      for (const input of [
        {},
        { source: current.source },
        { source: normalized },
        { format },
        { source: normalized, format }
      ]) {
        expect(resolveUpdatedAuthoredContent(current, input, policy)).toEqual({
          ...current,
          changed: false
        });
      }
      expect(() => resolveUpdatedAuthoredContent(current, { format: nextFormat }, policy)).toThrow(
        ValidationError
      );
      expect(() =>
        resolveUpdatedAuthoredContent(current, { source: normalized, format: nextFormat }, policy)
      ).toThrow(ValidationError);
      expect(() =>
        resolveUpdatedAuthoredContent(current, { source: `${normalized}changed` }, policy)
      ).toThrow(ValidationError);
      expect(
        resolveUpdatedAuthoredContent(current, { source: 'shorter\r\n', format: nextFormat }, policy)
      ).toEqual({ source: 'shorter\n', format: nextFormat, changed: true });
    }
  });

  it('uses normalized length during conversion but retains equivalent historical bytes', () => {
    const current = { source: 'x\r\n'.repeat(5_000), format: 'plain_text' } as const;

    expect(current.source.length).toBeGreaterThan(authoredContentSourceLimit);
    expect(resolveUpdatedAuthoredContent(current, { format: 'markdown_v1' }, commentPolicy)).toEqual({
      source: current.source,
      format: 'markdown_v1',
      changed: true
    });
  });

  it('does not trim whitespace to make oversized input valid', () => {
    const source = `x${' '.repeat(authoredContentSourceLimit)}`;

    expect(() => resolveNewAuthoredContent({ source }, commentPolicy)).toThrow(ValidationError);
    expect(() =>
      resolveUpdatedAuthoredContent({ source: 'x', format: 'plain_text' }, { source }, descriptionPolicy)
    ).toThrow(ValidationError);
  });
});

describe('safe validation errors', () => {
  it.each([descriptionPolicy, commentPolicy])(
    'reports length and field without source: $sourceField',
    (policy) => {
      const source = `private source ${'x'.repeat(authoredContentSourceLimit)}`;

      try {
        resolveNewAuthoredContent({ source }, policy);
        expect.fail('Expected source length validation to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const response = toApiErrorResponse(error);
        expect(response).toMatchObject({
          status: 400,
          body: {
            error: {
              code: 'VALIDATION_ERROR',
              details: {
                field: policy.sourceField,
                reason: 'source_too_long',
                maximumCodeUnits: 10_000
              }
            }
          }
        });
        expect(JSON.stringify(response)).not.toContain('private source');
      }
    }
  );

  it('reports blank comments without echoing submitted whitespace', () => {
    try {
      resolveNewAuthoredContent({ source: '\t\r\n' }, commentPolicy);
      expect.fail('Expected non-whitespace validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(toApiErrorResponse(error)).toEqual({
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'body must contain non-whitespace content.',
            details: { field: 'body', reason: 'empty_source' }
          }
        }
      });
    }
  });
});
