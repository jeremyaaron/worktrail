import { isAbsolute, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDatabaseUrl = 'postgres://worktrail:worktrail@localhost:5432/worktrail';
const defaultApiPort = 3000;
const defaultCorsOrigin = 'http://localhost:4200';

export type RuntimeMode = 'development' | 'test' | 'production';

export interface RuntimeConfig {
  nodeEnv: RuntimeMode;
  apiPort: number;
  databaseUrl: string;
  corsOrigin: string | false;
  serveStaticAssets: boolean;
  staticAssetsPath: string;
  attachmentStorageDriver: 'local';
  attachmentStoragePath: string;
  localActorMode: 'enabled';
}

export class RuntimeConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Runtime configuration is invalid: ${issues.join(' ')}`);
    this.name = 'RuntimeConfigError';
  }
}

export function defaultStaticAssetsPath(): string {
  return fileURLToPath(new URL('../../../web/dist/worktrail-web/browser', import.meta.url));
}

export function defaultAttachmentStoragePath(): string {
  return fileURLToPath(new URL('../../../../.worktrail/attachments', import.meta.url));
}

export function formatRuntimeConfigError(error: RuntimeConfigError): string {
  return [
    'Worktrail API configuration is invalid:',
    ...error.issues.map((issue) => `- ${issue}`)
  ].join('\n');
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const issues: string[] = [];
  const nodeEnv = parseNodeEnv(env.NODE_ENV, issues);
  const apiPort = parseApiPort(env.API_PORT, issues);
  const databaseUrl = parseDatabaseUrl(env.DATABASE_URL, nodeEnv, issues);
  const corsOrigin = parseCorsOrigin(env.CORS_ORIGIN);
  const serveStaticAssets = parseBoolean(
    env.WORKTRAIL_SERVE_STATIC,
    'WORKTRAIL_SERVE_STATIC',
    nodeEnv === 'production',
    issues
  );
  const staticAssetsPath = parseStaticAssetsPath(env.WORKTRAIL_STATIC_ASSETS_PATH);
  const attachmentStorageDriver = parseAttachmentStorageDriver(
    env.WORKTRAIL_ATTACHMENT_STORAGE_DRIVER,
    issues
  );
  const attachmentStoragePath = parseAttachmentStoragePath(
    env.WORKTRAIL_ATTACHMENT_STORAGE_PATH,
    nodeEnv,
    issues
  );

  if (issues.length > 0) {
    throw new RuntimeConfigError(issues);
  }

  return {
    nodeEnv,
    apiPort,
    databaseUrl,
    corsOrigin,
    serveStaticAssets,
    staticAssetsPath,
    attachmentStorageDriver,
    attachmentStoragePath,
    localActorMode: 'enabled'
  };
}

function parseNodeEnv(value: string | undefined, issues: string[]): RuntimeMode {
  if (value === undefined || value.trim() === '') {
    return 'development';
  }

  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }

  issues.push('NODE_ENV must be one of development, test, or production.');
  return 'development';
}

function parseApiPort(value: string | undefined, issues: string[]): number {
  if (value === undefined || value.trim() === '') {
    return defaultApiPort;
  }

  if (!/^\d+$/.test(value)) {
    issues.push('API_PORT must be an integer from 1 to 65535.');
    return defaultApiPort;
  }

  const port = Number.parseInt(value, 10);

  if (port < 1 || port > 65535) {
    issues.push('API_PORT must be an integer from 1 to 65535.');
    return defaultApiPort;
  }

  return port;
}

function parseDatabaseUrl(
  value: string | undefined,
  nodeEnv: RuntimeMode,
  issues: string[]
): string {
  if (value === undefined || value.trim() === '') {
    if (nodeEnv === 'production') {
      issues.push('DATABASE_URL is required when NODE_ENV=production.');
    }

    return defaultDatabaseUrl;
  }

  try {
    const parsed = new URL(value);

    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      issues.push('DATABASE_URL must use the postgres:// or postgresql:// protocol.');
    }
  } catch {
    issues.push('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  return value;
}

function parseCorsOrigin(value: string | undefined): string | false {
  if (value === undefined || value.trim() === '') {
    return defaultCorsOrigin;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}

function parseBoolean(
  value: string | undefined,
  name: string,
  defaultValue: boolean,
  issues: string[]
): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  issues.push(`${name} must be true or false.`);
  return defaultValue;
}

function parseStaticAssetsPath(value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    return defaultStaticAssetsPath();
  }

  return value;
}

function parseAttachmentStorageDriver(value: string | undefined, issues: string[]): 'local' {
  if (value === undefined || value.trim() === '' || value === 'local') {
    return 'local';
  }

  issues.push('WORKTRAIL_ATTACHMENT_STORAGE_DRIVER must be local.');
  return 'local';
}

function parseAttachmentStoragePath(
  value: string | undefined,
  nodeEnv: RuntimeMode,
  issues: string[]
): string {
  if (value === undefined || value.trim() === '') {
    if (nodeEnv === 'production') {
      issues.push(
        'WORKTRAIL_ATTACHMENT_STORAGE_PATH is required and must be an absolute writable directory when NODE_ENV=production.'
      );
    }

    return defaultAttachmentStoragePath();
  }

  if (!isAbsolute(value)) {
    issues.push('WORKTRAIL_ATTACHMENT_STORAGE_PATH must be an absolute directory path.');
    return defaultAttachmentStoragePath();
  }

  const resolvedPath = resolve(value);

  if (resolvedPath === parse(resolvedPath).root) {
    issues.push('WORKTRAIL_ATTACHMENT_STORAGE_PATH must not be the filesystem root.');
  }

  return resolvedPath;
}
