import { execFileSync } from 'node:child_process';

const childEnv: NodeJS.ProcessEnv = { ...process.env };
delete childEnv.NO_COLOR;
delete childEnv.FORCE_COLOR;

function runNpmScript(script: string): void {
  execFileSync('npm', ['run', script], {
    cwd: process.cwd(),
    env: childEnv,
    stdio: 'inherit'
  });
}

export default async function globalSetup(): Promise<void> {
  if (process.env.WORKTRAIL_E2E_SKIP_DB_RESET === 'true') {
    return;
  }

  runNpmScript('storage:reset');
  runNpmScript('db:reset');
  runNpmScript('db:migrate');
  runNpmScript('db:seed');
}
