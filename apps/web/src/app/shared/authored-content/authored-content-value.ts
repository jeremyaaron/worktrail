import type { AuthoredContentFormat } from '@worktrail/contracts';

export interface AuthoredContentValue {
  readonly source: string;
  readonly format: AuthoredContentFormat;
}
