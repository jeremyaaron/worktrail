import { execFileSync } from 'node:child_process';
import { execPath } from 'node:process';

export function resetDemoDatabase(): void {
  execFileSync(execPath, ['--input-type=module', '-e',
    "import { assertOwnedDatabase } from './scripts/verification/ownership.mjs'; await assertOwnedDatabase();"
  ], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
  const env = { ...process.env };
  delete env.NO_COLOR;
  delete env.FORCE_COLOR;
  for (const script of ['db:reset', 'db:migrate', 'db:seed']) {
    execFileSync('npm', ['run', script], { cwd: process.cwd(), env, stdio: 'inherit' });
  }
}
