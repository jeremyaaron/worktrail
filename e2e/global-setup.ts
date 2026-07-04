import { execFileSync } from 'node:child_process';

function runNpmScript(script: string): void {
  execFileSync('npm', ['run', script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });
}

export default async function globalSetup(): Promise<void> {
  if (process.env.WORKTRAIL_E2E_SKIP_DB_RESET === 'true') {
    return;
  }

  runNpmScript('db:reset');
  runNpmScript('db:migrate');
  runNpmScript('db:seed');
}
