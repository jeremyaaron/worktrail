import type { HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ActivityEventDto,
  CommentDto,
  CreateCommentRequest,
  CreateWorkItemRequest,
  CreateWorkItemRelationshipRequest,
  DependencyFilter,
  DueDateState,
  MoveWorkItemOnBoardRequest,
  MyWorkDashboardDto,
  TransitionWorkItemRequest,
  UpdateCommentRequest,
  UpdateWorkItemRequest,
  WorkItemCsvImportApplyDto,
  WorkItemCsvImportPreviewDto,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkItemPriority,
  WorkItemQuery,
  WorkItemRelationshipDto,
  WorkItemRelationshipSummaryDto,
  WorkItemSort,
  WorkItemStatus,
  WorkItemType,
  WorkItemWatchStateDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import {
  queryToHttpParams,
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
  search?: string;
  sort?: WorkItemSort;
}

@Injectable({ providedIn: 'root' })
export class WorkItemsApi {
  private readonly api = inject(ApiClient);

  listWorkItems(
    projectId: string,
    filters: WorkItemListFilters = {}
  ): Observable<WorkItemListItemDto[]> {
    return this.api.get<WorkItemListItemDto[]>(`/projects/${projectId}/work-items`, {
      params: queryToHttpParams(filters)
    });
  }

  getMyWork(): Observable<MyWorkDashboardDto> {
    return this.api.get<MyWorkDashboardDto>('/my-work');
  }

  listWorkspaceWorkItems(filters: WorkItemQuery = {}): Observable<WorkspaceWorkItemListItemDto[]> {
    return this.api.get<WorkspaceWorkItemListItemDto[]>('/work-items', {
      params: workItemQueryToHttpParams(filters)
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
