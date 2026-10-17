import type { ValidatorFn } from '@angular/forms';
import {
  authoredContentFormats,
  authoredContentSourceLimit,
  normalizeAuthoredContentSource
} from '@worktrail/contracts';
import { authoredContentEquals, type AuthoredContentValue } from './authored-content-value';

export function authoredContentValidator(
  options: {
    baseline?: AuthoredContentValue;
    requireNonWhitespace?: boolean;
  } = {}
): ValidatorFn {
  const baseline = options.baseline ? { ...options.baseline } : undefined;
  const requireNonWhitespace = options.requireNonWhitespace ?? false;
  return (control) => {
    const value: AuthoredContentValue | null = control.value;
    if (
      !value ||
      typeof value.source !== 'string' ||
      !authoredContentFormats.includes(value.format)
    ) {
      return { authoredContentValue: true };
    }
    if (baseline && authoredContentEquals(value, baseline)) return null;
    const source = normalizeAuthoredContentSource(value.source);
    if (source.length > authoredContentSourceLimit) {
      return {
        authoredContentTooLong: {
          maximumCodeUnits: authoredContentSourceLimit,
          actualCodeUnits: source.length
        }
      };
    }
    return requireNonWhitespace && !source.trim() ? { authoredContentRequired: true } : null;
  };
}
