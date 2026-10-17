import { assertOwnedDatabase } from '../scripts/verification/ownership.mjs';

export default async function globalTeardown(): Promise<void> {
  await assertOwnedDatabase();
  // The runner removes its database/storage after stopping its servers. Never restore working data.
}
