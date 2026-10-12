import {
  authoredContentSourceLimit,
  normalizeAuthoredContentSource,
  type AuthoredContentFormat
} from '@worktrail/contracts';

import { ValidationError } from '../errors/app-error.js';

interface AuthoredContentPair {
  source: string;
  format: AuthoredContentFormat;
}

interface AuthoredContentInput {
  source?: string;
  format?: AuthoredContentFormat;
}

interface AuthoredContentPolicy {
  sourceField: 'description' | 'body';
  requireNonWhitespace: boolean;
}

interface ResolvedAuthoredContent extends AuthoredContentPair {
  changed: boolean;
}

export function resolveNewAuthoredContent(
  input: AuthoredContentInput,
  policy: AuthoredContentPolicy
): ResolvedAuthoredContent {
  const source = normalizeAuthoredContentSource(input.source ?? '');

  validateNormalizedSource(source, policy);

  return { source, format: input.format ?? 'plain_text', changed: true };
}

export function resolveUpdatedAuthoredContent(
  current: AuthoredContentPair,
  input: AuthoredContentInput,
  policy: AuthoredContentPolicy
): ResolvedAuthoredContent {
  if (input.source === undefined && input.format === undefined) {
    return { ...current, changed: false };
  }

  const normalizedCurrent = normalizeAuthoredContentSource(current.source);
  const normalizedNext =
    input.source === undefined ? normalizedCurrent : normalizeAuthoredContentSource(input.source);
  const sourceChanged = normalizedNext !== normalizedCurrent;
  const format = input.format ?? current.format;
  const changed = sourceChanged || format !== current.format;

  if (changed) {
    validateNormalizedSource(normalizedNext, policy);
  }

  // Equivalent source retains historical bytes, even during a format conversion.
  return { source: sourceChanged ? normalizedNext : current.source, format, changed };
}

function validateNormalizedSource(source: string, policy: AuthoredContentPolicy): void {
  if (source.length > authoredContentSourceLimit) {
    throw new ValidationError(
      `${policy.sourceField} must be ${authoredContentSourceLimit} UTF-16 code units or fewer after line-ending normalization.`,
      {
        field: policy.sourceField,
        reason: 'source_too_long',
        maximumCodeUnits: authoredContentSourceLimit
      }
    );
  }

  if (policy.requireNonWhitespace && source.trim().length === 0) {
    throw new ValidationError(`${policy.sourceField} must contain non-whitespace content.`, {
      field: policy.sourceField,
      reason: 'empty_source'
    });
  }
}
