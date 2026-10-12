import { describe, expect, it } from 'vitest';

import { ValidationError } from '../src/errors/app-error.js';
import { escapeLikeLiteral } from '../src/repositories/quick-find-sql.js';
import {
  normalizeQuickFindQuery,
  parseQuickFindRequest,
  quickFindQueryMaxCodePoints,
  quickFindQueryMinCodePoints
} from '../src/validation/quick-find-query.js';

describe('Quick Find query validation', () => {
  it('normalizes Unicode and whitespace while preserving casing', () => {
    const parsed = parseQuickFindRequest({
      query: ' \tCafe\u0301\u00a0\u2003Cloud\nREADINESS\r '
    });

    expect(parsed).toEqual({
      query: 'Café Cloud READINESS'
    });
    expect(normalizeQuickFindQuery('  WT-3  ')).toBe('WT-3');
  });

  it('counts Unicode code points rather than UTF-16 code units', () => {
    expect(parseQuickFindRequest({ query: '🔎W' })).toEqual({ query: '🔎W' });
    const maximumQuery = parseQuickFindRequest({
      query: '🔎'.repeat(quickFindQueryMaxCodePoints)
    }).query;

    expect(maximumQuery).toHaveLength(quickFindQueryMaxCodePoints * 2);
    expect(Array.from(maximumQuery)).toHaveLength(quickFindQueryMaxCodePoints);

    expect(() =>
      parseQuickFindRequest({ query: '🔎'.repeat(quickFindQueryMinCodePoints - 1) })
    ).toThrow(ValidationError);
    expect(() =>
      parseQuickFindRequest({ query: '🔎'.repeat(quickFindQueryMaxCodePoints + 1) })
    ).toThrow(ValidationError);
  });

  it('rejects missing, malformed, and extra request fields', () => {
    for (const input of [
      undefined,
      null,
      [],
      {},
      { query: 42 },
      { query: 'valid', extra: true }
    ]) {
      expect(() => parseQuickFindRequest(input)).toThrow(ValidationError);
    }
  });

  it('does not include rejected query text in validation details', () => {
    const privateQuery = 'private-planning-query-that-must-not-appear';

    try {
      parseQuickFindRequest({ query: privateQuery.repeat(10) });
      throw new Error('Expected query validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(JSON.stringify((error as ValidationError).details)).not.toContain(privateQuery);
    }
  });
});

describe('Quick Find LIKE literal escaping', () => {
  it('escapes every PostgreSQL LIKE metacharacter', () => {
    expect(escapeLikeLiteral('100%_ready\\later')).toBe('100\\%\\_ready\\\\later');
  });

  it('leaves ordinary Unicode and punctuation unchanged', () => {
    expect(escapeLikeLiteral('Café cloud-readiness.json')).toBe('Café cloud-readiness.json');
  });
});
