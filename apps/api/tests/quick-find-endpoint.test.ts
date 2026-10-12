import type { MemberRole } from '@worktrail/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import type { Repositories } from '../src/repositories/index.js';
import type { QuickFindRepositoryResult } from '../src/repositories/quick-find-repository.js';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const memberId = '10000000-0000-4000-8000-000000000101';
const headers = {
  'x-worktrail-workspace-id': workspaceId,
  'x-worktrail-member-id': memberId
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Quick Find endpoint', () => {
  it('normalizes the request and returns all bounded groups without DB or object-store coupling', async () => {
    const searchWorkspace = vi.fn(async () => emptyResult());
    const app = createExpressApp({
      repositories: repositories({ searchWorkspace })
    });

    await request(app)
      .post('/api/quick-find')
      .set(headers)
      .send({ query: '  release \t evidence  ' })
      .expect('Cache-Control', 'private, no-store')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          query: 'release evidence',
          groups: {
            workItems: { items: [], hasMore: false },
            projects: { items: [], hasMore: false },
            milestones: { items: [], hasMore: false },
            cycles: { items: [], hasMore: false },
            reports: { items: [], hasMore: false },
            attachments: { items: [], hasMore: false }
          }
        });
      });

    expect(searchWorkspace).toHaveBeenCalledWith({
      workspaceId,
      query: 'release evidence',
      groupLimit: 5
    });
  });

  it('rejects invalid requests before searching', async () => {
    const searchWorkspace = vi.fn(async () => emptyResult());
    const app = createExpressApp({
      repositories: repositories({ searchWorkspace })
    });

    await request(app)
      .post('/api/quick-find')
      .set(headers)
      .send({ query: 'x', extra: true })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

    expect(searchWorkspace).not.toHaveBeenCalled();
  });

  it('rejects missing and inactive local actors before searching', async () => {
    const searchWorkspace = vi.fn(async () => emptyResult());
    const missingActorApp = createExpressApp({
      repositories: repositories({ searchWorkspace, resolveActor: false })
    });

    await request(missingActorApp)
      .post('/api/quick-find')
      .send({ query: 'release' })
      .expect(403);

    const inactiveActorApp = createExpressApp({
      repositories: repositories({ searchWorkspace, isActive: false })
    });

    await request(inactiveActorApp)
      .post('/api/quick-find')
      .set(headers)
      .send({ query: 'release' })
      .expect(403);

    expect(searchWorkspace).not.toHaveBeenCalled();
  });

  it('returns a safe 503 without exposing repository or query details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createExpressApp({
      repositories: repositories({
        searchWorkspace: vi.fn(async () => {
          throw new Error('relation missing while searching confidential roadmap');
        })
      })
    });

    const response = await request(app)
      .post('/api/quick-find')
      .set(headers)
      .send({ query: 'confidential roadmap' })
      .expect(503);

    expect(response.body).toEqual({
      error: {
        code: 'QUICK_FIND_UNAVAILABLE',
        message: 'Quick Find is temporarily unavailable.'
      }
    });
    expect(JSON.stringify(response.body)).not.toContain('confidential roadmap');
    expect(JSON.stringify(response.body)).not.toContain('relation missing');
  });
});

function repositories(input: {
  searchWorkspace: (input: {
    workspaceId: string;
    query: string;
    groupLimit: number;
  }) => Promise<QuickFindRepositoryResult>;
  isActive?: boolean;
  resolveActor?: boolean;
}): Repositories {
  return {
    members: {
      findById: vi.fn(async (requestedMemberId: string) => {
        if (input.resolveActor === false || requestedMemberId !== memberId) {
          return null;
        }

        return {
          id: memberId,
          workspaceId,
          role: 'contributor' as MemberRole,
          isActive: input.isActive ?? true
        };
      })
    },
    quickFind: {
      searchWorkspace: input.searchWorkspace
    }
  } as unknown as Repositories;
}

function emptyResult(): QuickFindRepositoryResult {
  const emptyGroup = () => ({ items: [], hasMore: false });

  return {
    workItems: emptyGroup(),
    projects: emptyGroup(),
    milestones: emptyGroup(),
    cycles: emptyGroup(),
    reports: emptyGroup(),
    attachments: emptyGroup()
  };
}
