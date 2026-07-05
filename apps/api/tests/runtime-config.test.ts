import { describe, expect, it } from 'vitest';

import {
  RuntimeConfigError,
  defaultStaticAssetsPath,
  formatRuntimeConfigError,
  loadRuntimeConfig
} from '../src/config/runtime-config.js';

describe('runtime configuration', () => {
  it('applies development defaults', () => {
    const config = loadRuntimeConfig({});

    expect(config).toEqual({
      nodeEnv: 'development',
      apiPort: 3000,
      databaseUrl: 'postgres://worktrail:worktrail@localhost:5432/worktrail',
      corsOrigin: 'http://localhost:4200',
      serveStaticAssets: false,
      staticAssetsPath: defaultStaticAssetsPath(),
      localActorMode: 'enabled'
    });
  });

  it('requires an explicit database URL in production mode', () => {
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production' })).toThrow(RuntimeConfigError);

    try {
      loadRuntimeConfig({ NODE_ENV: 'production' });
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeConfigError);
      expect((error as RuntimeConfigError).issues).toEqual([
        'DATABASE_URL is required when NODE_ENV=production.'
      ]);
    }
  });

  it('accepts production configuration with explicit database URL', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'production',
      API_PORT: '8080',
      DATABASE_URL: 'postgres://worktrail:worktrail@localhost:5432/worktrail',
      CORS_ORIGIN: 'false'
    });

    expect(config.nodeEnv).toBe('production');
    expect(config.apiPort).toBe(8080);
    expect(config.databaseUrl).toBe('postgres://worktrail:worktrail@localhost:5432/worktrail');
    expect(config.corsOrigin).toBe(false);
    expect(config.serveStaticAssets).toBe(true);
  });

  it('rejects invalid ports, modes, database URLs, and booleans', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'staging',
        API_PORT: '70000',
        DATABASE_URL: 'mysql://worktrail:worktrail@localhost:3306/worktrail',
        WORKTRAIL_SERVE_STATIC: 'yes'
      })
    ).toThrow(RuntimeConfigError);

    try {
      loadRuntimeConfig({
        NODE_ENV: 'staging',
        API_PORT: '70000',
        DATABASE_URL: 'mysql://worktrail:worktrail@localhost:3306/worktrail',
        WORKTRAIL_SERVE_STATIC: 'yes'
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeConfigError);
      expect((error as RuntimeConfigError).issues).toEqual([
        'NODE_ENV must be one of development, test, or production.',
        'API_PORT must be an integer from 1 to 65535.',
        'DATABASE_URL must use the postgres:// or postgresql:// protocol.',
        'WORKTRAIL_SERVE_STATIC must be true or false.'
      ]);
    }
  });

  it('does not include secret values in formatted errors', () => {
    let configError: RuntimeConfigError | null = null;

    try {
      loadRuntimeConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'mysql://secret-user:secret-password@db.example.com/worktrail'
      });
    } catch (error) {
      configError = error as RuntimeConfigError;
    }

    expect(configError).not.toBeNull();
    const message = formatRuntimeConfigError(configError!);

    expect(message).toContain('DATABASE_URL must use the postgres:// or postgresql:// protocol.');
    expect(message).not.toContain('secret-user');
    expect(message).not.toContain('secret-password');
    expect(message).not.toContain('db.example.com');
  });
});
