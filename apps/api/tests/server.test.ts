import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createExpressApp } from '../src/adapters/express/server.js';
import { ValidationError } from '../src/errors/app-error.js';
import type { Repositories } from '../src/repositories/index.js';
import { parseWithSchema } from '../src/validation/parse.js';

async function createStaticFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'worktrail-static-'));

  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Worktrail</title><app-root></app-root>');
  await writeFile(join(directory, 'asset.txt'), 'static asset response');

  return directory;
}

describe('Express API foundation', () => {
  it('returns health through the endpoint adapter', async () => {
    const app = createExpressApp();

    await request(app)
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.service).toBe('worktrail-api');
        expect(body.checkedAt).toEqual(expect.any(String));
      });
  });

  it('returns liveness through the health live endpoint', async () => {
    const app = createExpressApp();

    await request(app)
      .get('/api/health/live')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.service).toBe('worktrail-api');
        expect(body.checkedAt).toEqual(expect.any(String));
      });
  });

  it('returns readiness when the database check succeeds', async () => {
    const app = createExpressApp({
      healthCheckPool: {
        query: vi.fn(async () => ({ rows: [] }))
      }
    });

    await request(app)
      .get('/api/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ready');
        expect(body.service).toBe('worktrail-api');
        expect(body.checks).toEqual({ database: 'ok' });
        expect(body.checkedAt).toEqual(expect.any(String));
      });
  });

  it('returns safe readiness failure when the database check fails', async () => {
    const app = createExpressApp({
      healthCheckPool: {
        query: vi.fn(async () => {
          throw new Error('secret connection failure');
        })
      }
    });

    await request(app)
      .get('/api/health/ready')
      .expect(503)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: {
            code: 'READINESS_FAILED',
            message: 'Worktrail API is not ready.',
            checks: {
              database: 'failed'
            }
          }
        });
        expect(JSON.stringify(body)).not.toContain('secret connection failure');
      });
  });

  it('uses the local seed actor when no development actor headers are provided', async () => {
    const app = createExpressApp({
      testRoutes: {
        '/api/test/actor': (appRequest) => ({
          status: 200,
          body: appRequest.actor
        })
      }
    });

    await request(app)
      .get('/api/test/actor')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          memberId: '10000000-0000-4000-8000-000000000101',
          workspaceId: '10000000-0000-4000-8000-000000000001',
          role: 'owner'
        });
      });
  });

  it('uses development actor headers when repositories are not available', async () => {
    const app = createExpressApp({
      testRoutes: {
        '/api/test/actor': (appRequest) => ({
          status: 200,
          body: appRequest.actor
        })
      }
    });

    await request(app)
      .get('/api/test/actor')
      .set('x-worktrail-member-id', '20000000-0000-4000-8000-000000000001')
      .set('x-worktrail-workspace-id', '20000000-0000-4000-8000-000000000002')
      .set('x-worktrail-role', 'maintainer')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          memberId: '20000000-0000-4000-8000-000000000001',
          workspaceId: '20000000-0000-4000-8000-000000000002',
          role: 'maintainer'
        });
      });
  });

  it('derives the actor role from the member record when repositories are available', async () => {
    const repositories = {
      members: {
        findById: vi.fn(async () => ({
          id: '20000000-0000-4000-8000-000000000001',
          workspaceId: '20000000-0000-4000-8000-000000000002',
          name: 'Morgan Maintainer',
          email: 'morgan.maintainer@example.com',
          role: 'maintainer',
          isActive: true,
          deactivatedAt: null,
          deactivatedById: null,
          createdAt: new Date('2026-07-02T12:00:00.000Z'),
          updatedAt: new Date('2026-07-03T12:00:00.000Z')
        }))
      }
    } as unknown as Repositories;
    const app = createExpressApp({
      repositories,
      testRoutes: {
        '/api/test/actor': (appRequest) => ({
          status: 200,
          body: appRequest.actor
        })
      }
    });

    await request(app)
      .get('/api/test/actor')
      .set('x-worktrail-member-id', '20000000-0000-4000-8000-000000000001')
      .set('x-worktrail-workspace-id', '20000000-0000-4000-8000-000000000002')
      .set('x-worktrail-role', 'owner')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          memberId: '20000000-0000-4000-8000-000000000001',
          workspaceId: '20000000-0000-4000-8000-000000000002',
          role: 'maintainer'
        });
      });
  });

  it('rejects inactive actors when repositories are available', async () => {
    const repositories = {
      members: {
        findById: vi.fn(async () => ({
          id: '20000000-0000-4000-8000-000000000001',
          workspaceId: '20000000-0000-4000-8000-000000000002',
          name: 'Riley Former',
          email: 'riley.former@example.com',
          role: 'contributor',
          isActive: false,
          deactivatedAt: new Date('2026-06-20T12:00:00.000Z'),
          deactivatedById: '20000000-0000-4000-8000-000000000003',
          createdAt: new Date('2026-07-02T12:00:00.000Z'),
          updatedAt: new Date('2026-07-03T12:00:00.000Z')
        }))
      }
    } as unknown as Repositories;
    const app = createExpressApp({
      repositories,
      testRoutes: {
        '/api/test/actor': (appRequest) => ({
          status: 200,
          body: appRequest.actor
        })
      }
    });

    await request(app)
      .get('/api/test/actor')
      .set('x-worktrail-member-id', '20000000-0000-4000-8000-000000000001')
      .set('x-worktrail-workspace-id', '20000000-0000-4000-8000-000000000002')
      .expect(403)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: {
            code: 'FORBIDDEN',
            message: 'Inactive members cannot act in this workspace.'
          }
        });
      });
  });

  it('maps validation errors to structured 400 responses', async () => {
    const app = createExpressApp({
      testRoutes: {
        '/api/test/validation': () => {
          throw new ValidationError('Invalid test request.', { fieldErrors: { name: ['Required'] } });
        }
      }
    });

    await request(app)
      .post('/api/test/validation')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid test request.',
            details: { fieldErrors: { name: ['Required'] } }
          }
        });
      });
  });

  it('masks unexpected errors as structured 500 responses', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createExpressApp({
      testRoutes: {
        '/api/test/unexpected-error': () => {
          throw new Error('database exploded');
        }
      }
    });

    await request(app)
      .get('/api/test/unexpected-error')
      .expect(500)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred.'
          }
        });
      });

    errorSpy.mockRestore();
  });

  it('sends string endpoint responses without JSON serialization', async () => {
    const app = createExpressApp({
      testRoutes: {
        '/api/test/csv': () => ({
          status: 200,
          body: 'name,value\nWorktrail,1\n',
          headers: {
            'Content-Type': 'text/csv; charset=utf-8'
          }
        })
      }
    });

    await request(app)
      .get('/api/test/csv')
      .expect(200)
      .expect('Content-Type', /text\/csv/)
      .expect(({ text }) => {
        expect(text).toBe('name,value\nWorktrail,1\n');
      });
  });

  it('serves configured static assets', async () => {
    const directory = await createStaticFixture();

    try {
      const app = createExpressApp({ staticAssets: { directory } });

      await request(app)
        .get('/asset.txt')
        .expect(200)
        .expect(({ text }) => {
          expect(text).toBe('static asset response');
        });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('serves the SPA index for non-API deep links', async () => {
    const directory = await createStaticFixture();

    try {
      const app = createExpressApp({ staticAssets: { directory } });

      await request(app)
        .get('/projects/10000000-0000-4000-8000-000000000201/board')
        .expect(200)
        .expect(({ text }) => {
          expect(text).toContain('<app-root></app-root>');
        });

      await request(app)
        .head('/projects/10000000-0000-4000-8000-000000000201/board')
        .expect(200)
        .expect('Content-Type', /text\/html/);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('keeps API routes ahead of static fallback', async () => {
    const directory = await createStaticFixture();

    try {
      const app = createExpressApp({ staticAssets: { directory } });

      await request(app)
        .get('/api/health')
        .expect(200)
        .expect(({ body, text }) => {
          expect(body.status).toBe('ok');
          expect(body.service).toBe('worktrail-api');
          expect(text).not.toContain('<app-root></app-root>');
        });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('does not swallow unknown API routes with the SPA fallback', async () => {
    const directory = await createStaticFixture();

    try {
      const app = createExpressApp({ staticAssets: { directory } });

      await request(app)
        .get('/api/unknown')
        .expect(404)
        .expect(({ text }) => {
          expect(text).not.toContain('<app-root></app-root>');
        });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('fails fast when a configured static assets directory is missing', () => {
    const directory = join(tmpdir(), `worktrail-static-missing-${randomUUID()}`);

    expect(() => createExpressApp({ staticAssets: { directory } })).toThrow(
      `Static assets directory does not exist: ${directory}`
    );
  });
});

describe('parseWithSchema', () => {
  it('returns parsed values for valid input', () => {
    const schema = z.object({ name: z.string().min(1) });

    expect(parseWithSchema(schema, { name: 'Worktrail' })).toEqual({ name: 'Worktrail' });
  });

  it('throws ValidationError for invalid input', () => {
    const schema = z.object({ name: z.string().min(1) });

    expect(() => parseWithSchema(schema, { name: '' })).toThrow(ValidationError);
  });
});
