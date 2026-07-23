import type {
  QuickFindAttachmentResultDto,
  QuickFindCycleResultDto,
  QuickFindMilestoneResultDto,
  QuickFindProjectResultDto,
  QuickFindReportResultDto,
  QuickFindWorkItemResultDto
} from '@worktrail/contracts';
import { describe, expect, it, vi } from 'vitest';

import { QuickFindUnavailableError } from '../src/errors/app-error.js';
import type { Repositories } from '../src/repositories/index.js';
import type { QuickFindRepositoryResult } from '../src/repositories/quick-find-repository.js';
import { QuickFindService } from '../src/services/quick-find-service.js';

const workspaceId = '10000000-0000-4000-8000-000000000001';

describe('QuickFindService', () => {
  it('scopes one repository search to the actor and maps every public result group', async () => {
    const searchWorkspace = vi.fn(async () => repositoryResult());
    const service = new QuickFindService({
      actor: {
        workspaceId,
        memberId: '10000000-0000-4000-8000-000000000101',
        role: 'contributor'
      },
      repositories: {
        quickFind: { searchWorkspace }
      } as Pick<Repositories, 'quickFind'>
    });

    const response = await service.search({ query: 'release evidence' });

    expect(searchWorkspace).toHaveBeenCalledOnce();
    expect(searchWorkspace).toHaveBeenCalledWith({
      workspaceId,
      query: 'release evidence',
      groupLimit: 5
    });
    expect(response.query).toBe('release evidence');
    expect(response.groups.workItems.items[0]).toEqual(expectedWorkItem());
    expect(response.groups.projects.items[0]).toEqual(expectedProject());
    expect(response.groups.milestones.items[0]).toEqual(expectedMilestone());
    expect(response.groups.cycles.items[0]).toEqual(expectedCycle());
    expect(response.groups.reports.items[0]).toEqual(expectedReport());
    expect(response.groups.attachments.items[0]).toEqual(expectedAttachment());
    expect(response.groups.attachments.hasMore).toBe(true);
    expect(JSON.stringify(response)).not.toMatch(/storageKey|checksumSha256|workspaceId/);
  });

  it('translates repository and mapping failures into the safe availability error', async () => {
    const repositoryFailure = new QuickFindService({
      actor: {
        workspaceId,
        memberId: '10000000-0000-4000-8000-000000000101',
        role: 'owner'
      },
      repositories: {
        quickFind: {
          searchWorkspace: vi.fn(async () => {
            throw new Error('database failure while searching private terms');
          })
        }
      } as Pick<Repositories, 'quickFind'>
    });
    await expect(repositoryFailure.search({ query: 'private terms' })).rejects.toEqual(
      new QuickFindUnavailableError()
    );

    const invalidResult = repositoryResult();
    invalidResult.reports.items[0]!.report.health = 'unknown' as 'healthy';
    const mappingFailure = new QuickFindService({
      actor: {
        workspaceId,
        memberId: '10000000-0000-4000-8000-000000000101',
        role: 'owner'
      },
      repositories: {
        quickFind: {
          searchWorkspace: vi.fn(async () => invalidResult)
        }
      } as Pick<Repositories, 'quickFind'>
    });

    await expect(mappingFailure.search({ query: 'private terms' })).rejects.toEqual(
      new QuickFindUnavailableError()
    );
  });
});

function repositoryResult(): QuickFindRepositoryResult {
  const project = {
    id: '20000000-0000-4000-8000-000000000001',
    key: 'WT',
    name: 'Worktrail',
    status: 'active' as const
  };
  const workItem = {
    id: '30000000-0000-4000-8000-000000000001',
    displayKey: 'WT-42',
    title: 'Release evidence',
    status: 'in_progress' as const,
    type: 'task' as const
  };

  return {
    workItems: {
      items: [
        {
          kind: 'work_item',
          project,
          workItem,
          match: { field: 'work_item_title', mode: 'exact', excerpt: null }
        }
      ],
      hasMore: false
    },
    projects: {
      items: [
        {
          kind: 'project',
          project,
          match: { field: 'project_description', mode: 'substring', excerpt: 'release evidence' }
        }
      ],
      hasMore: false
    },
    milestones: {
      items: [
        {
          kind: 'milestone',
          project,
          milestone: {
            id: '40000000-0000-4000-8000-000000000001',
            name: 'Release',
            status: 'active',
            targetDate: '2026-08-01',
            isArchived: false
          },
          match: { field: 'milestone_description', mode: 'substring', excerpt: 'release evidence' }
        }
      ],
      hasMore: false
    },
    cycles: {
      items: [
        {
          kind: 'cycle',
          project,
          cycle: {
            id: '50000000-0000-4000-8000-000000000001',
            name: 'Release cycle',
            status: 'active',
            startDate: '2026-07-20',
            endDate: '2026-08-01',
            isArchived: false
          },
          match: { field: 'cycle_name', mode: 'prefix', excerpt: null }
        }
      ],
      hasMore: false
    },
    reports: {
      items: [
        {
          kind: 'report',
          project,
          report: {
            id: '60000000-0000-4000-8000-000000000001',
            title: 'Release report',
            statusDate: '2026-07-23',
            health: 'healthy',
            publishedAt: new Date('2026-07-23T12:00:00.000Z')
          },
          match: { field: 'report_summary', mode: 'substring', excerpt: 'release evidence' }
        }
      ],
      hasMore: false
    },
    attachments: {
      items: [
        {
          kind: 'attachment',
          project,
          workItem,
          attachment: {
            id: '70000000-0000-4000-8000-000000000001',
            fileName: 'release-evidence.pdf',
            byteSize: 2048,
            createdAt: new Date('2026-07-22T15:30:00.000Z')
          },
          match: { field: 'attachment_file_name', mode: 'prefix', excerpt: null }
        }
      ],
      hasMore: true
    }
  };
}

function expectedProject(): QuickFindProjectResultDto {
  return {
    kind: 'project',
    project: {
      id: '20000000-0000-4000-8000-000000000001',
      key: 'WT',
      name: 'Worktrail',
      status: 'active'
    },
    match: { field: 'project_description', mode: 'substring', excerpt: 'release evidence' }
  };
}

function expectedWorkItem(): QuickFindWorkItemResultDto {
  return {
    kind: 'work_item',
    project: expectedProject().project,
    workItem: {
      id: '30000000-0000-4000-8000-000000000001',
      displayKey: 'WT-42',
      title: 'Release evidence',
      status: 'in_progress',
      type: 'task'
    },
    match: { field: 'work_item_title', mode: 'exact', excerpt: null }
  };
}

function expectedMilestone(): QuickFindMilestoneResultDto {
  return {
    kind: 'milestone',
    project: expectedProject().project,
    milestone: {
      id: '40000000-0000-4000-8000-000000000001',
      name: 'Release',
      status: 'active',
      targetDate: '2026-08-01',
      isArchived: false
    },
    match: { field: 'milestone_description', mode: 'substring', excerpt: 'release evidence' }
  };
}

function expectedCycle(): QuickFindCycleResultDto {
  return {
    kind: 'cycle',
    project: expectedProject().project,
    cycle: {
      id: '50000000-0000-4000-8000-000000000001',
      name: 'Release cycle',
      status: 'active',
      startDate: '2026-07-20',
      endDate: '2026-08-01',
      isArchived: false
    },
    match: { field: 'cycle_name', mode: 'prefix', excerpt: null }
  };
}

function expectedReport(): QuickFindReportResultDto {
  return {
    kind: 'report',
    project: expectedProject().project,
    report: {
      id: '60000000-0000-4000-8000-000000000001',
      title: 'Release report',
      statusDate: '2026-07-23',
      health: 'healthy',
      publishedAt: '2026-07-23T12:00:00.000Z'
    },
    match: { field: 'report_summary', mode: 'substring', excerpt: 'release evidence' }
  };
}

function expectedAttachment(): QuickFindAttachmentResultDto {
  return {
    kind: 'attachment',
    project: expectedProject().project,
    workItem: expectedWorkItem().workItem,
    attachment: {
      id: '70000000-0000-4000-8000-000000000001',
      fileName: 'release-evidence.pdf',
      byteSize: 2048,
      createdAt: '2026-07-22T15:30:00.000Z'
    },
    match: { field: 'attachment_file_name', mode: 'prefix', excerpt: null }
  };
}
