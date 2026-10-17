import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function inventory(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name), relative = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await inventory(path, relative));
    else if (entry.isFile()) files.push([relative, createHash('sha256').update(await readFile(path)).digest('hex')]);
    else throw new Error('Schema verification refuses non-file migration entries.');
  }
  return files.sort(([a], [b]) => a.localeCompare(b));
}

export async function verifySchemaGeneration(checkout, generate) {
  const root = join(checkout, 'apps/api/drizzle');
  const before = await inventory(root);
  await generate();
  const after = await inventory(root);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('Schema generation changed the owned migration inventory; review schema/journal drift. Working migrations were not modified.');
  }
  console.log('Schema generation matches the committed SQL/journal/snapshot inventory.');
}
