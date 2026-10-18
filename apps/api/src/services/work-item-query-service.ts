import type {
  ResolvedWorkItemPageQuery, WorkItemQuery, WorkItemListItemDto, WorkItemListPageDto,
  WorkspaceWorkItemListItemDto, WorkspaceWorkItemListPageDto
} from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import { assertPersistence, type Persistence } from '../repositories/persistence.js';
import type { ProjectWorkItemQuery } from '../repositories/work-item-query-builder.js';
import { WorkItemHydrator } from './work-item-hydrator.js';
import { resolveWorkItemPage } from './work-item-page.js';

export interface WorkItemQueryServiceContext {
  actor: ActorContext;
  persistence: Persistence;
}

export class WorkItemQueryService {
  constructor(private readonly context: WorkItemQueryServiceContext) {
    assertPersistence(context.persistence);
  }

  async listWorkItems(projectId: string, filters: ProjectWorkItemQuery = {}): Promise<WorkItemListItemDto[]> {
    return this.context.persistence.readConsistent(async ({ repositories }) => {
      await this.requireProject(projectId, repositories);
      return new WorkItemHydrator(repositories).list(await repositories.workItems.listByProject(projectId, filters));
    });
  }

  async listWorkspaceWorkItems(filters: WorkItemQuery = {}): Promise<WorkspaceWorkItemListItemDto[]> {
    return this.context.persistence.readConsistent(async ({ repositories }) => {
      const records = await repositories.workItems.listByWorkspace(this.context.actor.workspaceId, filters);
      return new WorkItemHydrator(repositories).workspace(records);
    });
  }

  async listWorkItemPage(
    projectId: string, filters: ProjectWorkItemQuery = {},
    pageQuery: ResolvedWorkItemPageQuery = { page: 1, pageSize: 25 }
  ): Promise<WorkItemListPageDto> {
    return this.context.persistence.readConsistent(async ({ repositories }) => {
      await this.requireProject(projectId, repositories);
      const totalCount = await repositories.workItems.countByProjectQuery(projectId, filters);
      const resolution = resolveWorkItemPage(pageQuery, totalCount);
      const rows = await repositories.workItems.listPageByProject(projectId, filters, {
        limit: resolution.metadata.pageSize, offset: resolution.offset
      });
      return { items: await new WorkItemHydrator(repositories).list(rows), ...resolution.metadata };
    });
  }

  async listWorkspaceWorkItemPage(
    filters: WorkItemQuery = {}, pageQuery: ResolvedWorkItemPageQuery = { page: 1, pageSize: 25 }
  ): Promise<WorkspaceWorkItemListPageDto> {
    return this.context.persistence.readConsistent(async ({ repositories }) => {
      const workspaceId = this.context.actor.workspaceId;
      const totalCount = await repositories.workItems.countByWorkspaceQuery(workspaceId, filters);
      const resolution = resolveWorkItemPage(pageQuery, totalCount);
      const rows = await repositories.workItems.listPageByWorkspace(workspaceId, filters, {
        limit: resolution.metadata.pageSize, offset: resolution.offset
      });
      return { items: await new WorkItemHydrator(repositories).workspace(rows), ...resolution.metadata };
    });
  }

  async listProjectBoardWorkItems(projectId: string): Promise<WorkItemListItemDto[]> {
    return this.context.persistence.readConsistent(async ({ repositories }) => {
      await this.requireProject(projectId, repositories);
      return new WorkItemHydrator(repositories).list(await repositories.workItems.listByProjectForBoard(projectId));
    });
  }

  private async requireProject(projectId: string, repositories: Repositories): Promise<void> {
    const project = await repositories.projects.findById(projectId);
    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }
  }
}
