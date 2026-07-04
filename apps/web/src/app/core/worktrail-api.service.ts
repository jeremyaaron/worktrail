import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ActivityEventDto,
  CommentDto,
  CreateCommentRequest,
  CreateLabelRequest,
  CreateMilestoneRequest,
  CreateProjectRequest,
  CreateWorkItemRequest,
  DueDateState,
  LabelDto,
  MemberDto,
  MilestoneDto,
  MilestoneStatus,
  MoveWorkItemOnBoardRequest,
  ProjectDto,
  ProjectPlanningSummaryDto,
  ProjectSummaryDto,
  TransitionWorkItemRequest,
  UpdateCommentRequest,
  UpdateLabelRequest,
  UpdateMilestoneRequest,
  UpdateProjectRequest,
  UpdateWorkItemRequest,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkItemPriority,
  WorkItemSort,
  WorkItemStatus,
  WorkItemType
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
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

  listMembers(): Observable<MemberDto[]> {
    return this.http.get<MemberDto[]>(this.url('/members'));
  }

  listProjects(): Observable<ProjectDto[]> {
    return this.http.get<ProjectDto[]>(this.url('/projects'), this.options());
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
      this.options({ params: this.toWorkItemParams(filters) })
    );
  }

  createWorkItem(projectId: string, input: CreateWorkItemRequest): Observable<WorkItemDetailDto> {
    return this.http.post<WorkItemDetailDto>(
      this.url(`/projects/${projectId}/work-items`),
      input,
      this.options()
    );
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

  private toWorkItemParams(filters: WorkItemListFilters): HttpParams {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value.trim() !== '') {
        params = params.set(key, value);
      }
    }

    return params;
  }
}
