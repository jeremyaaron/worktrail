import type {
  BulkUpdateWorkItemsRequest,
  BulkUpdateWorkItemsResponseDto,
  CreateWorkItemRequest,
  MoveWorkItemOnBoardRequest,
  ResolvedWorkItemPageQuery,
  SetWorkItemParentRequest,
  TransitionWorkItemRequest,
  UpdateWorkItemRequest,
  WorkItemQuery,
  WorkItemChildrenDto,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkItemListPageDto,
  WorkItemParentCandidateDto,
  WorkspaceWorkItemListItemDto,
  WorkspaceWorkItemListPageDto
} from '@worktrail/contracts';
import { assertPersistence, type PersistenceScope } from '../repositories/persistence.js';
import type { ProjectWorkItemQuery } from '../repositories/work-item-query-builder.js';
import { WorkItemQueryService } from './work-item-query-service.js';
import type { WorkItemServiceContext, WorkItemCreationInput } from './work-item-context.js';
import { WorkItemBulkCommandService } from './work-item-bulk-command-service.js';
import { WorkItemCommandService } from './work-item-command-service.js';
import { WorkItemReadService } from './work-item-read-service.js';
export type { WorkItemServiceContext, WorkItemCreationInput } from './work-item-context.js';
export type WorkItemListFilters = ProjectWorkItemQuery;
export class WorkItemService {
  constructor(private readonly context: WorkItemServiceContext) { assertPersistence(context.persistence); }
  async listWorkItems(
    projectId: string,
    filters: WorkItemListFilters = {}
  ): Promise<WorkItemListItemDto[]> {
    return new WorkItemQueryService(this.context).listWorkItems(projectId, filters);
  }

  async listWorkspaceWorkItems(
    filters: WorkItemQuery = {}
  ): Promise<WorkspaceWorkItemListItemDto[]> {
    return new WorkItemQueryService(this.context).listWorkspaceWorkItems(filters);
  }

  async listWorkItemPage(
    projectId: string,
    filters: WorkItemListFilters = {},
    pageQuery: ResolvedWorkItemPageQuery = { page: 1, pageSize: 25 }
  ): Promise<WorkItemListPageDto> {
    return new WorkItemQueryService(this.context).listWorkItemPage(projectId, filters, pageQuery);
  }

  async listWorkspaceWorkItemPage(
    filters: WorkItemQuery = {},
    pageQuery: ResolvedWorkItemPageQuery = { page: 1, pageSize: 25 }
  ): Promise<WorkspaceWorkItemListPageDto> {
    return new WorkItemQueryService(this.context).listWorkspaceWorkItemPage(filters, pageQuery);
  }

  async listProjectBoardWorkItems(projectId: string): Promise<WorkItemListItemDto[]> {
    return new WorkItemQueryService(this.context).listProjectBoardWorkItems(projectId);
  }

  async getWorkItem(workItemId: string): Promise<WorkItemDetailDto> {
    return new WorkItemReadService(this.context).getWorkItem(workItemId);
  }

  async listChildren(workItemId: string, limit: number): Promise<WorkItemChildrenDto> {
    return new WorkItemReadService(this.context).listChildren(workItemId, limit);
  }

  async listParentCandidates(
    workItemId: string,
    search?: string
  ): Promise<WorkItemParentCandidateDto[]> {
    return new WorkItemReadService(this.context).listParentCandidates(workItemId, search);
  }

  async createWorkItem(projectId: string, input: CreateWorkItemRequest): Promise<WorkItemDetailDto> {
    return new WorkItemCommandService(this.context).createWorkItem(projectId, input);
  }

  async bulkUpdateWorkItems(
    projectId: string,
    input: BulkUpdateWorkItemsRequest
  ): Promise<BulkUpdateWorkItemsResponseDto> {
    return new WorkItemBulkCommandService(this.context).bulkUpdateWorkItems(projectId, input);
  }

  async createWorkItemWithScope(
    projectId: string,
    input: WorkItemCreationInput,
    scope: PersistenceScope
  ): Promise<WorkItemDetailDto> {
    return new WorkItemCommandService(this.context).createWorkItemWithScope(projectId, input, scope);
  }

  async setParent(
    workItemId: string,
    input: SetWorkItemParentRequest
  ): Promise<WorkItemDetailDto> {
    return new WorkItemCommandService(this.context).setParent(workItemId, input);
  }

  async updateWorkItem(
    workItemId: string,
    input: UpdateWorkItemRequest
  ): Promise<WorkItemDetailDto> {
    return new WorkItemCommandService(this.context).updateWorkItem(workItemId, input);
  }

  async transitionWorkItem(
    workItemId: string,
    input: TransitionWorkItemRequest
  ): Promise<WorkItemDetailDto> {
    return new WorkItemCommandService(this.context).transitionWorkItem(workItemId, input);
  }

  async moveWorkItemOnBoard(
    workItemId: string,
    input: MoveWorkItemOnBoardRequest
  ): Promise<WorkItemDetailDto> {
    return new WorkItemCommandService(this.context).moveWorkItemOnBoard(workItemId, input);
  }

}
