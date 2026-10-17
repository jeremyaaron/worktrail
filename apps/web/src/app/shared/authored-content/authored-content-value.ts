import { normalizeAuthoredContentSource, type AuthoredContentFormat } from '@worktrail/contracts';

export interface AuthoredContentValue {
  readonly source: string;
  readonly format: AuthoredContentFormat;
}

export function authoredContentEquals(a: AuthoredContentValue, b: AuthoredContentValue): boolean {
  return (
    a.format === b.format &&
    normalizeAuthoredContentSource(a.source) === normalizeAuthoredContentSource(b.source)
  );
}
