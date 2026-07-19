import type { HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ActivityEventDto,
  BulkUpdateWorkItemsRequest,
  BulkUpdateWorkItemsResponseDto,
  CommentDto,
  CreateCommentRequest,
  CreateWorkItemRequest,
  CreateWorkItemRelationshipRequest,
  DependencyFilter,
  DueDateState,
  MoveWorkItemOnBoardRequest,
  MyWorkDashboardDto,
  ResolvedWorkItemPageQuery,
  SetWorkItemParentRequest,
  TransitionWorkItemRequest,
  UpdateCommentRequest,
  UpdateWorkItemRequest,
  WorkItemCsvImportApplyDto,
  WorkItemCsvImportPreviewDto,
  WorkItemChildrenDto,
  WorkItemDetailDto,
  WorkItemHierarchyFilter,
  WorkItemListItemDto,
  WorkItemListPageDto,
  WorkItemPriority,
  WorkItemParentCandidateDto,
  WorkItemQuery,
  WorkItemRelationshipDto,
  WorkItemRelationshipSummaryDto,
  WorkItemRiskFilter,
  WorkItemSort,
  WorkItemStatus,
  WorkItemType,
  WorkItemWatchStateDto,
  WorkspaceWorkItemListPageDto
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import {
  workItemPageRequestToHttpParams,
  workItemQueryToHttpParams
} from '../../shared/work-items/work-item-query-params';
import { ApiClient } from './api-client';

export interface WorkItemListFilters {
  status?: WorkItemStatus;
  assigneeId?: string;
  reporterId?: string;
  type?: WorkItemType;
  labelId?: string;
  milestoneId?: string;
  priority?: WorkItemPriority;
  dueDateState?: DueDateState;
  dependency?: DependencyFilter;
  workRisk?: WorkItemRiskFilter;
  hierarchy?: WorkItemHierarchyFilter;
  parentKey?: string;
  search?: string;
  sort?: WorkItemSort;
}

@Injectable({ providedIn: 'root' })
export class WorkItemsApi {
  private readonly api = inject(ApiClient);

  listWorkItems(
    projectId: string,
    filters: WorkItemListFilters,
    pageQuery: ResolvedWorkItemPageQuery
  ): Observable<WorkItemListPageDto> {
    return this.api.get<WorkItemListPageDto>(`/projects/${projectId}/work-items`, {
      params: workItemPageRequestToHttpParams(filters, pageQuery)
    });
  }

  listProjectBoardWorkItems(projectId: string): Observable<WorkItemListItemDto[]> {
    return this.api.get<WorkItemListItemDto[]>(`/projects/${projectId}/board/work-items`);
  }

  getMyWork(): Observable<MyWorkDashboardDto> {
    return this.api.get<MyWorkDashboardDto>('/my-work');
  }

  listWorkspaceWorkItems(
    filters: WorkItemQuery,
    pageQuery: ResolvedWorkItemPageQuery
  ): Observable<WorkspaceWorkItemListPageDto> {
    return this.api.get<WorkspaceWorkItemListPageDto>('/work-items', {
      params: workItemPageRequestToHttpParams(filters, pageQuery)
    });
  }

  exportWorkspaceWorkItems(filters: WorkItemQuery = {}): Observable<HttpResponse<Blob>> {
    return this.api.getBlob('/work-items/export', {
      params: workItemQueryToHttpParams(filters)
    });
  }

  createWorkItem(projectId: string, input: CreateWorkItemRequest): Observable<WorkItemDetailDto> {
    return this.api.post<WorkItemDetailDto, CreateWorkItemRequest>(
      `/projects/${projectId}/work-items`,
      input
    );
  }

  bulkUpdateProjectWorkItems(
    projectId: string,
    input: BulkUpdateWorkItemsRequest
  ): Observable<BulkUpdateWorkItemsResponseDto> {
    return this.api.post<BulkUpdateWorkItemsResponseDto, BulkUpdateWorkItemsRequest>(
      `/projects/${projectId}/work-items/bulk-update`,
      input
    );
  }

  previewWorkItemCsvImport(
    projectId: string,
    csv: string
  ): Observable<WorkItemCsvImportPreviewDto> {
    return this.api.post<WorkItemCsvImportPreviewDto>(
      `/projects/${projectId}/work-items/imports/preview`,
      { csv }
    );
  }

  applyWorkItemCsvImport(projectId: string, csv: string): Observable<WorkItemCsvImportApplyDto> {
    return this.api.post<WorkItemCsvImportApplyDto>(
      `/projects/${projectId}/work-items/imports`,
      { csv }
    );
  }

  exportProjectWorkItems(
    projectId: string,
    filters: WorkItemQuery = {}
  ): Observable<HttpResponse<Blob>> {
    return this.api.getBlob(`/projects/${projectId}/work-items/export`, {
      params: workItemQueryToHttpParams(filters)
    });
  }

  getWorkItem(workItemId: string): Observable<WorkItemDetailDto> {
    return this.api.get<WorkItemDetailDto>(`/work-items/${workItemId}`);
  }

  listWorkItemChildren(workItemId: string, limit = 25): Observable<WorkItemChildrenDto> {
    return this.api.get<WorkItemChildrenDto>(`/work-items/${workItemId}/children`, {
      params: { limit }
    });
  }

  listParentCandidates(
    workItemId: string,
    search?: string
  ): Observable<WorkItemParentCandidateDto[]> {
    return this.api.get<WorkItemParentCandidateDto[]>(
      `/work-items/${workItemId}/parent-candidates`,
      { params: { search } }
    );
  }

  setWorkItemParent(
    workItemId: string,
    input: SetWorkItemParentRequest
  ): Observable<WorkItemDetailDto> {
    return this.api.put<WorkItemDetailDto, SetWorkItemParentRequest>(
      `/work-items/${workItemId}/parent`,
      input
    );
  }

  updateWorkItem(workItemId: string, input: UpdateWorkItemRequest): Observable<WorkItemDetailDto> {
    return this.api.patch<WorkItemDetailDto, UpdateWorkItemRequest>(
      `/work-items/${workItemId}`,
      input
    );
  }

  transitionWorkItem(
    workItemId: string,
    input: TransitionWorkItemRequest
  ): Observable<WorkItemDetailDto> {
    return this.api.post<WorkItemDetailDto, TransitionWorkItemRequest>(
      `/work-items/${workItemId}/transitions`,
      input
    );
  }

  moveWorkItemOnBoard(
    workItemId: string,
    input: MoveWorkItemOnBoardRequest
  ): Observable<WorkItemDetailDto> {
    return this.api.post<WorkItemDetailDto, MoveWorkItemOnBoardRequest>(
      `/work-items/${workItemId}/board-move`,
      input
    );
  }

  listWorkItemRelationships(workItemId: string): Observable<WorkItemRelationshipSummaryDto> {
    return this.api.get<WorkItemRelationshipSummaryDto>(
      `/work-items/${workItemId}/relationships`
    );
  }

  createWorkItemRelationship(
    workItemId: string,
    input: CreateWorkItemRelationshipRequest
  ): Observable<WorkItemRelationshipDto> {
    return this.api.post<WorkItemRelationshipDto, CreateWorkItemRelationshipRequest>(
      `/work-items/${workItemId}/relationships`,
      input
    );
  }

  deleteWorkItemRelationship(workItemId: string, relationshipId: string): Observable<void> {
    return this.api.delete<void>(`/work-items/${workItemId}/relationships/${relationshipId}`);
  }

  getWorkItemWatchState(workItemId: string): Observable<WorkItemWatchStateDto> {
    return this.api.get<WorkItemWatchStateDto>(`/work-items/${workItemId}/watchers`);
  }

  watchWorkItem(workItemId: string): Observable<WorkItemWatchStateDto> {
    return this.api.put<WorkItemWatchStateDto>(`/work-items/${workItemId}/watch`, {});
  }

  unwatchWorkItem(workItemId: string): Observable<WorkItemWatchStateDto> {
    return this.api.delete<WorkItemWatchStateDto>(`/work-items/${workItemId}/watch`);
  }

  listComments(workItemId: string): Observable<CommentDto[]> {
    return this.api.get<CommentDto[]>(`/work-items/${workItemId}/comments`);
  }

  createComment(workItemId: string, input: CreateCommentRequest): Observable<CommentDto> {
    return this.api.post<CommentDto, CreateCommentRequest>(
      `/work-items/${workItemId}/comments`,
      input
    );
  }

  updateComment(commentId: string, input: UpdateCommentRequest): Observable<CommentDto> {
    return this.api.patch<CommentDto, UpdateCommentRequest>(`/comments/${commentId}`, input);
  }

  deleteComment(commentId: string): Observable<CommentDto> {
    return this.api.delete<CommentDto>(`/comments/${commentId}`);
  }

  listWorkItemActivity(workItemId: string): Observable<ActivityEventDto[]> {
    return this.api.get<ActivityEventDto[]>(`/work-items/${workItemId}/activity`);
  }
}
