import type pg from 'pg';

import { assertOwnedDatabase } from '../../../../scripts/verification/ownership.mjs';

export async function assertVerificationTarget(pool?: pg.Pool): Promise<void> {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.WORKTRAIL_VERIFY_MANIFEST !== undefined ||
    process.env.WORKTRAIL_VERIFY_NONCE !== undefined
  ) {
    await assertOwnedDatabase(process.env, pool);
  }
}
