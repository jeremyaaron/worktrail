import { assertOwnedDatabase } from '../scripts/verification/ownership.mjs';

export default async function globalSetup(): Promise<void> {
  const manifest = await assertOwnedDatabase();
  if (!manifest.prepared) throw new Error('Browser setup requires runner-prepared data.');
}
