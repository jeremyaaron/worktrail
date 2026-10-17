import { execFileSync } from 'node:child_process';

export function resetDemoDatabase(): void {
  if (process.env.WORKTRAIL_E2E_SKIP_DB_RESTORE === 'true') return;
  const env = { ...process.env };
  delete env.NO_COLOR;
  delete env.FORCE_COLOR;
  for (const script of ['db:reset', 'db:migrate', 'db:seed']) {
    execFileSync('npm', ['run', script], { cwd: process.cwd(), env, stdio: 'inherit' });
  }
}
