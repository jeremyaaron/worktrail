import 'dotenv/config';

import { loadRuntimeConfig } from '../config/runtime-config.js';
import { resetLocalAttachmentStorage } from './reset-local-attachment-storage.js';

const config = loadRuntimeConfig();
const outcome = await resetLocalAttachmentStorage(config.attachmentStoragePath);

console.log(
  outcome === 'removed'
    ? 'Local attachment storage reset.'
    : 'Local attachment storage was already absent.'
);
