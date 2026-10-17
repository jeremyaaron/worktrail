import { LocalAttachmentObjectStore } from '../../apps/api/src/storage/local-attachment-object-store.ts';

import { assertOwnedDatabase } from './ownership.mjs';

const manifest = await assertOwnedDatabase();
await new LocalAttachmentObjectStore(manifest.storageRoot).initialize();
