import { randomUUID } from 'node:crypto';

import type {
  WorkItemListItemDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import type { Repositories } from '../src/repositories/index.js';
import type { WorkItem } from '../src/repositories/types.js';
import {
  synchronousExportLimit,
  WorkItemCsvExportService
} from '../src/services/work-item-csv-export-service.js';
import { WorkItemService } from '../src/services/work-item-service.js';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const memberId = '10000000-0000-4000-8000-000000000002';
const projectId = '10000000-0000-4000-8000-000000000003';

function actor() {
  return { workspaceId, memberId, role: 'owner' as const };
}

function exportDto(index = 1): WorkItemListItemDto {
  return {
    id: randomUUID(),
    workspaceId,
    projectId,
    itemNumber: index,
    displayKey: `EXP-${index}`,
    title: `Export item ${index}`,
    type: 'task',
    status: 'ready',
    priority: 'medium',
    assignee: null,
    reporter: {
      id: memberId,
      workspaceId,
      name: 'Export Owner',
      email: 'owner@example.com',
      role: 'owner',
      isActive: true,
      deactivatedAt: null,
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z'
    },
    labels: [],
    milestone: null,
    cycle: null,
    boardPosition: index * 1024,
    dueDate: null,
    estimatePoints: null,
    parent: null,
    childSummary: null,
    dependencyBlocked: false,
    openBlockerCount: 0,
    openBlockedWorkCount: 0,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z'
  };
}

function repositoriesWithRawRows(rowCount: number, projectFound = true): Repositories {
  const rawRows = Array.from({ length: rowCount }, () => ({}) as WorkItem);

  return {
    members: {
      findById: vi.fn().mockResolvedValue({
        id: memberId,
        workspaceId,
        role: 'owner',
        isActive: true
      })
    },
    projects: {
      findById: vi.fn().mockResolvedValue(
        projectFound
          ? {
              id: projectId,
              workspaceId,
              key: 'EXP'
            }
          : null
      )
    },
    workItems: {
      listByProjectForExport: vi.fn().mockResolvedValue(rawRows),
      listByWorkspaceForExport: vi.fn().mockResolvedValue(
        rawRows.map((workItem) => ({
          workItem,
          project: { id: projectId, key: 'EXP', name: 'Export Project', status: 'active' }
        }))
      )
    }
  } as unknown as Repositories;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('work item CSV export limits', () => {
  it('accepts exactly 10,000 project rows from a 10,001-row bounded read', async () => {
    const repositories = repositoriesWithRawRows(synchronousExportLimit);
    const enriched = Array.from({ length: synchronousExportLimit }, (_, index) =>
      exportDto(index + 1)
    );
    const enrich = vi
      .spyOn(WorkItemService.prototype, 'enrichWorkItemListWithRepositories')
      .mockResolvedValue(enriched);
    const service = new WorkItemCsvExportService({ actor: actor(), repositories });

    const result = await service.exportProjectWorkItems(projectId, { sort: 'created_desc' });

    expect(repositories.workItems.listByProjectForExport).toHaveBeenCalledWith(
      projectId,
      { sort: 'created_desc' },
      synchronousExportLimit + 1
    );
    expect(enrich).toHaveBeenCalledWith(expect.any(Array), repositories);
    expect(result.fileName).toBe('worktrail-exp-work-items.csv');
    expect(result.csv.match(/\n/g)).toHaveLength(synchronousExportLimit + 1);
  });

  it('rejects 10,001 project rows before DTO enrichment', async () => {
    const repositories = repositoriesWithRawRows(synchronousExportLimit + 1);
    const enrich = vi.spyOn(WorkItemService.prototype, 'enrichWorkItemListWithRepositories');
    const service = new WorkItemCsvExportService({ actor: actor(), repositories });

    await expect(service.exportProjectWorkItems(projectId)).rejects.toMatchObject({
      code: 'EXPORT_LIMIT_EXCEEDED',
      status: 422,
      message: 'More than 10,000 work items match. Narrow the applied filters and retry.',
      details: { limit: synchronousExportLimit }
    });
    expect(enrich).not.toHaveBeenCalled();
  });

  it('uses actor workspace scope and rejects workspace overflow before enrichment', async () => {
    const repositories = repositoriesWithRawRows(synchronousExportLimit + 1);
    const enrich = vi.spyOn(
      WorkItemService.prototype,
      'enrichWorkspaceWorkItemListWithRepositories'
    );
    const service = new WorkItemCsvExportService({ actor: actor(), repositories });

    await expect(
      service.exportWorkspaceWorkItems({ archivedProjects: 'include' })
    ).rejects.toMatchObject({ code: 'EXPORT_LIMIT_EXCEEDED' });
    expect(repositories.workItems.listByWorkspaceForExport).toHaveBeenCalledWith(
      workspaceId,
      { archivedProjects: 'include' },
      synchronousExportLimit + 1
    );
    expect(enrich).not.toHaveBeenCalled();
  });

  it('authorizes project scope before reading export rows', async () => {
    const repositories = repositoriesWithRawRows(1, false);
    const service = new WorkItemCsvExportService({ actor: actor(), repositories });

    await expect(service.exportProjectWorkItems(projectId)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    expect(repositories.workItems.listByProjectForExport).not.toHaveBeenCalled();
  });

  it('returns one JSON overflow error without CSV headers or a partial body', async () => {
    const repositories = repositoriesWithRawRows(synchronousExportLimit + 1);
    const app = createExpressApp({ repositories });

    const response = await request(app)
      .get(`/api/projects/${projectId}/work-items/export`)
      .set({
        'x-worktrail-workspace-id': workspaceId,
        'x-worktrail-member-id': memberId,
        'x-worktrail-role': 'owner'
      })
      .expect(422)
      .expect('Content-Type', /application\/json/);

    expect(response.headers['content-disposition']).toBeUndefined();
    expect(response.body).toEqual({
      error: {
        code: 'EXPORT_LIMIT_EXCEEDED',
        message: 'More than 10,000 work items match. Narrow the applied filters and retry.',
        details: { limit: synchronousExportLimit }
      }
    });
    expect(response.text).not.toContain('project_key,display_key');
  });
});
