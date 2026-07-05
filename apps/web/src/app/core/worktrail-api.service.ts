import { HttpClient, HttpParams, type HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ActivityEventDto,
  CommentDto,
  CreateCommentRequest,
  CreateLabelRequest,
  CreateMemberRequest,
  CreateMilestoneRequest,
  CreateProjectRequest,
  CreateSavedWorkViewRequest,
  CreateWorkItemRequest,
  DueDateState,
  LabelDto,
  MemberDto,
  MilestoneDto,
  MilestoneStatus,
  MoveWorkItemOnBoardRequest,
  MyWorkDashboardDto,
  ProjectDto,
  ProjectNavigationSummaryDto,
  ProjectPlanningSummaryDto,
  ProjectSummaryDto,
  SavedWorkViewDto,
  TransitionWorkItemRequest,
  UpdateCommentRequest,
  UpdateLabelRequest,
  UpdateMemberRequest,
  UpdateMilestoneRequest,
  UpdateProjectRequest,
  UpdateSavedWorkViewRequest,
  UpdateWorkspaceRequest,
  UpdateWorkItemRequest,
  WorkItemCsvImportApplyDto,
  WorkItemCsvImportPreviewDto,
  WorkItemQuery,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkItemPriority,
  WorkItemSort,
  WorkItemStatus,
  WorkItemType,
  WorkspaceActivityEventDto,
  WorkspaceCapabilitiesDto,
  WorkspaceDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  queryToHttpParams,
  workItemQueryToHttpParams
} from '../shared/work-items/work-item-query-params';
import { CurrentUserService } from './current-user.service';

export interface WorkItemListFilters {
  status?: WorkItemStatus;
  assigneeId?: string;
  reporterId?: string;
  type?: WorkItemType;
  labelId?: string;
  milestoneId?: string;
  priority?: WorkItemPriority;
  dueDateState?: DueDateState;
  search?: string;
  sort?: WorkItemSort;
}

@Injectable({ providedIn: 'root' })
export class WorktrailApiService {
  private readonly http = inject(HttpClient);
  private readonly currentUser = inject(CurrentUserService);

  getWorkspace(): Observable<WorkspaceDto> {
    return this.http.get<WorkspaceDto>(this.url('/workspace'), this.options());
  }

  updateWorkspace(input: UpdateWorkspaceRequest): Observable<WorkspaceDto> {
    return this.http.patch<WorkspaceDto>(this.url('/workspace'), input, this.options());
  }

  getWorkspaceCapabilities(): Observable<WorkspaceCapabilitiesDto> {
    return this.http.get<WorkspaceCapabilitiesDto>(
      this.url('/workspace/capabilities'),
      this.options()
    );
  }

  listWorkspaceActivity(): Observable<WorkspaceActivityEventDto[]> {
    return this.http.get<WorkspaceActivityEventDto[]>(
      this.url('/workspace/activity'),
      this.options()
    );
  }

  listMembers(): Observable<MemberDto[]> {
    return this.http.get<MemberDto[]>(this.url('/members'), this.options());
  }

  createMember(input: CreateMemberRequest): Observable<MemberDto> {
    return this.http.post<MemberDto>(this.url('/members'), input, this.options());
  }

  updateMember(memberId: string, input: UpdateMemberRequest): Observable<MemberDto> {
    return this.http.patch<MemberDto>(this.url(`/members/${memberId}`), input, this.options());
  }

  deactivateMember(memberId: string): Observable<MemberDto> {
    return this.http.post<MemberDto>(
      this.url(`/members/${memberId}/deactivate`),
      {},
      this.options()
    );
  }

  reactivateMember(memberId: string): Observable<MemberDto> {
    return this.http.post<MemberDto>(
      this.url(`/members/${memberId}/reactivate`),
      {},
      this.options()
    );
  }

  listProjects(): Observable<ProjectDto[]> {
    return this.http.get<ProjectDto[]>(this.url('/projects'), this.options());
  }

  listProjectNavigationSummaries(): Observable<ProjectNavigationSummaryDto[]> {
    return this.http.get<ProjectNavigationSummaryDto[]>(
      this.url('/projects/navigation-summary'),
      this.options()
    );
  }

  createProject(input: CreateProjectRequest): Observable<ProjectDto> {
    return this.http.post<ProjectDto>(this.url('/projects'), input, this.options());
  }

  getProject(projectId: string): Observable<ProjectDto> {
    return this.http.get<ProjectDto>(this.url(`/projects/${projectId}`), this.options());
  }

  updateProject(projectId: string, input: UpdateProjectRequest): Observable<ProjectDto> {
    return this.http.patch<ProjectDto>(this.url(`/projects/${projectId}`), input, this.options());
  }

  archiveProject(projectId: string): Observable<ProjectDto> {
    return this.http.post<ProjectDto>(this.url(`/projects/${projectId}/archive`), {}, this.options());
  }

  reactivateProject(projectId: string): Observable<ProjectDto> {
    return this.http.post<ProjectDto>(
      this.url(`/projects/${projectId}/reactivate`),
      {},
      this.options()
    );
  }

  getProjectSummary(projectId: string): Observable<ProjectSummaryDto> {
    return this.http.get<ProjectSummaryDto>(this.url(`/projects/${projectId}/summary`), this.options());
  }

  getProjectPlanningSummary(projectId: string): Observable<ProjectPlanningSummaryDto> {
    return this.http.get<ProjectPlanningSummaryDto>(
      this.url(`/projects/${projectId}/planning-summary`),
      this.options()
    );
  }

  listProjectActivity(projectId: string): Observable<ActivityEventDto[]> {
    return this.http.get<ActivityEventDto[]>(
      this.url(`/projects/${projectId}/activity`),
      this.options()
    );
  }

  listProjectLabels(projectId: string, input: { includeArchived?: boolean } = {}): Observable<LabelDto[]> {
    return this.http.get<LabelDto[]>(
      this.url(`/projects/${projectId}/labels`),
      this.options({
        params:
          input.includeArchived === true
            ? new HttpParams().set('includeArchived', 'true')
            : undefined
      })
    );
  }

  createLabel(projectId: string, input: CreateLabelRequest): Observable<LabelDto> {
    return this.http.post<LabelDto>(
      this.url(`/projects/${projectId}/labels`),
      input,
      this.options()
    );
  }

  updateLabel(labelId: string, input: UpdateLabelRequest): Observable<LabelDto> {
    return this.http.patch<LabelDto>(this.url(`/labels/${labelId}`), input, this.options());
  }

  archiveLabel(labelId: string): Observable<LabelDto> {
    return this.http.post<LabelDto>(this.url(`/labels/${labelId}/archive`), {}, this.options());
  }

  reactivateLabel(labelId: string): Observable<LabelDto> {
    return this.http.post<LabelDto>(this.url(`/labels/${labelId}/reactivate`), {}, this.options());
  }

  listProjectMilestones(
    projectId: string,
    input: { includeArchived?: boolean; status?: MilestoneStatus } = {}
  ): Observable<MilestoneDto[]> {
    let params = new HttpParams();

    if (input.includeArchived === true) {
      params = params.set('includeArchived', 'true');
    }

    if (input.status !== undefined) {
      params = params.set('status', input.status);
    }

    return this.http.get<MilestoneDto[]>(
      this.url(`/projects/${projectId}/milestones`),
      this.options({ params })
    );
  }

  createMilestone(projectId: string, input: CreateMilestoneRequest): Observable<MilestoneDto> {
    return this.http.post<MilestoneDto>(
      this.url(`/projects/${projectId}/milestones`),
      input,
      this.options()
    );
  }

  updateMilestone(milestoneId: string, input: UpdateMilestoneRequest): Observable<MilestoneDto> {
    return this.http.patch<MilestoneDto>(this.url(`/milestones/${milestoneId}`), input, this.options());
  }

  archiveMilestone(milestoneId: string): Observable<MilestoneDto> {
    return this.http.post<MilestoneDto>(
      this.url(`/milestones/${milestoneId}/archive`),
      {},
      this.options()
    );
  }

  reactivateMilestone(milestoneId: string): Observable<MilestoneDto> {
    return this.http.post<MilestoneDto>(
      this.url(`/milestones/${milestoneId}/reactivate`),
      {},
      this.options()
    );
  }

  listWorkItems(
    projectId: string,
    filters: WorkItemListFilters = {}
  ): Observable<WorkItemListItemDto[]> {
    return this.http.get<WorkItemListItemDto[]>(
      this.url(`/projects/${projectId}/work-items`),
      this.options({ params: queryToHttpParams(filters) })
    );
  }

  getMyWork(): Observable<MyWorkDashboardDto> {
    return this.http.get<MyWorkDashboardDto>(this.url('/my-work'), this.options());
  }

  listWorkspaceWorkItems(filters: WorkItemQuery = {}): Observable<WorkspaceWorkItemListItemDto[]> {
    return this.http.get<WorkspaceWorkItemListItemDto[]>(
      this.url('/work-items'),
      this.options({ params: workItemQueryToHttpParams(filters) })
    );
  }

  exportWorkspaceWorkItems(filters: WorkItemQuery = {}): Observable<HttpResponse<Blob>> {
    return this.http.get(this.url('/work-items/export'), {
      ...this.options({ params: workItemQueryToHttpParams(filters) }),
      observe: 'response',
      responseType: 'blob'
    });
  }

  listSavedWorkViews(): Observable<SavedWorkViewDto[]> {
    return this.http.get<SavedWorkViewDto[]>(this.url('/saved-work-views'), this.options());
  }

  createSavedWorkView(input: CreateSavedWorkViewRequest): Observable<SavedWorkViewDto> {
    return this.http.post<SavedWorkViewDto>(this.url('/saved-work-views'), input, this.options());
  }

  updateSavedWorkView(
    savedViewId: string,
    input: UpdateSavedWorkViewRequest
  ): Observable<SavedWorkViewDto> {
    return this.http.patch<SavedWorkViewDto>(
      this.url(`/saved-work-views/${savedViewId}`),
      input,
      this.options()
    );
  }

  deleteSavedWorkView(savedViewId: string): Observable<void> {
    return this.http.delete<void>(this.url(`/saved-work-views/${savedViewId}`), this.options());
  }

  createWorkItem(projectId: string, input: CreateWorkItemRequest): Observable<WorkItemDetailDto> {
    return this.http.post<WorkItemDetailDto>(
      this.url(`/projects/${projectId}/work-items`),
      input,
      this.options()
    );
  }

  previewWorkItemCsvImport(
    projectId: string,
    csv: string
  ): Observable<WorkItemCsvImportPreviewDto> {
    return this.http.post<WorkItemCsvImportPreviewDto>(
      this.url(`/projects/${projectId}/work-items/imports/preview`),
      { csv },
      this.options()
    );
  }

  applyWorkItemCsvImport(projectId: string, csv: string): Observable<WorkItemCsvImportApplyDto> {
    return this.http.post<WorkItemCsvImportApplyDto>(
      this.url(`/projects/${projectId}/work-items/imports`),
      { csv },
      this.options()
    );
  }

  exportProjectWorkItems(
    projectId: string,
    filters: WorkItemListFilters = {}
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(this.url(`/projects/${projectId}/work-items/export`), {
      ...this.options({ params: queryToHttpParams(filters) }),
      observe: 'response',
      responseType: 'blob'
    });
  }

  getWorkItem(workItemId: string): Observable<WorkItemDetailDto> {
    return this.http.get<WorkItemDetailDto>(this.url(`/work-items/${workItemId}`), this.options());
  }

  updateWorkItem(workItemId: string, input: UpdateWorkItemRequest): Observable<WorkItemDetailDto> {
    return this.http.patch<WorkItemDetailDto>(
      this.url(`/work-items/${workItemId}`),
      input,
      this.options()
    );
  }

  transitionWorkItem(
    workItemId: string,
    input: TransitionWorkItemRequest
  ): Observable<WorkItemDetailDto> {
    return this.http.post<WorkItemDetailDto>(
      this.url(`/work-items/${workItemId}/transitions`),
      input,
      this.options()
    );
  }

  moveWorkItemOnBoard(
    workItemId: string,
    input: MoveWorkItemOnBoardRequest
  ): Observable<WorkItemDetailDto> {
    return this.http.post<WorkItemDetailDto>(
      this.url(`/work-items/${workItemId}/board-move`),
      input,
      this.options()
    );
  }

  listComments(workItemId: string): Observable<CommentDto[]> {
    return this.http.get<CommentDto[]>(this.url(`/work-items/${workItemId}/comments`), this.options());
  }

  createComment(workItemId: string, input: CreateCommentRequest): Observable<CommentDto> {
    return this.http.post<CommentDto>(
      this.url(`/work-items/${workItemId}/comments`),
      input,
      this.options()
    );
  }

  updateComment(commentId: string, input: UpdateCommentRequest): Observable<CommentDto> {
    return this.http.patch<CommentDto>(this.url(`/comments/${commentId}`), input, this.options());
  }

  deleteComment(commentId: string): Observable<CommentDto> {
    return this.http.delete<CommentDto>(this.url(`/comments/${commentId}`), this.options());
  }

  listWorkItemActivity(workItemId: string): Observable<ActivityEventDto[]> {
    return this.http.get<ActivityEventDto[]>(
      this.url(`/work-items/${workItemId}/activity`),
      this.options()
    );
  }

  private url(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  private options(input: { params?: HttpParams } = {}): {
    headers: Record<string, string>;
    params?: HttpParams;
  } {
    return {
      headers: this.currentUser.actorHeaders(),
      ...(input.params === undefined ? {} : { params: input.params })
    };
  }
}
