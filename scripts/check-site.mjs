import { fileURLToPath } from 'node:url';
import { checkSite } from './verification/site.mjs';

await checkSite(fileURLToPath(new URL('../', import.meta.url)));
