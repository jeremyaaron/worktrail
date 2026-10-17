import { assertOwnedDatabase } from '../../../../scripts/verification/ownership.mjs';

export default async function setup(): Promise<void> {
  const manifest = await assertOwnedDatabase();
  if (!manifest.prepared) throw new Error('Owned verification database is not prepared. Use npm run verify -- --mode=api.');
}
