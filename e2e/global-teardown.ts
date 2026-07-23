import { execFileSync } from 'node:child_process';

function cleanEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env };
  delete environment.NO_COLOR;
  delete environment.FORCE_COLOR;
  return environment;
}

function runNpmScript(script: string, environment: NodeJS.ProcessEnv): void {
  execFileSync('npm', ['run', script], {
    cwd: process.cwd(),
    env: environment,
    stdio: 'inherit'
  });
}

export default async function globalTeardown(): Promise<void> {
  const e2eEnvironment = cleanEnvironment();
  let firstError: unknown;

  try {
    runNpmScript('storage:reset', e2eEnvironment);
  } catch (error) {
    firstError = error;
  }

  if (process.env.WORKTRAIL_E2E_SKIP_DB_RESTORE !== 'true') {
    const restoreEnvironment = cleanEnvironment();
    const originalStoragePath = process.env.WORKTRAIL_E2E_RESTORE_ATTACHMENT_STORAGE_PATH;

    if (originalStoragePath === undefined || originalStoragePath === '') {
      delete restoreEnvironment.WORKTRAIL_ATTACHMENT_STORAGE_PATH;
    } else {
      restoreEnvironment.WORKTRAIL_ATTACHMENT_STORAGE_PATH = originalStoragePath;
    }

    try {
      runNpmScript('db:reset', restoreEnvironment);
      runNpmScript('db:migrate', restoreEnvironment);
      runNpmScript('db:seed', restoreEnvironment);
    } catch (error) {
      firstError ??= error;
    }
  }

  if (firstError !== undefined) {
    throw firstError;
  }
}
