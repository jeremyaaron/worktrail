import 'dotenv/config';

import { loadRuntimeConfig } from '../config/runtime-config.js';
import { assertVerificationTarget } from '../db/verification-target.js';
import { resetLocalAttachmentStorage } from './reset-local-attachment-storage.js';

const config = loadRuntimeConfig();
await assertVerificationTarget();
const outcome = await resetLocalAttachmentStorage(config.attachmentStoragePath);

console.log(
  outcome === 'removed'
    ? 'Local attachment storage reset.'
    : 'Local attachment storage was already absent.'
);
