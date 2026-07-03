import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ActivityEventDto,
  CommentDto,
  CreateCommentRequest,
  CreateProjectRequest,
  CreateWorkItemRequest,
  MemberDto,
  ProjectDto,
  ProjectSummaryDto,
  TransitionWorkItemRequest,
  UpdateProjectRequest,
  UpdateWorkItemRequest,
  WorkItemDetailDto,
  WorkItemListItemDto
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { CurrentUserService } from './current-user.service';

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

  getProjectSummary(projectId: string): Observable<ProjectSummaryDto> {
    return this.http.get<ProjectSummaryDto>(this.url(`/projects/${projectId}/summary`), this.options());
  }

  listProjectActivity(projectId: string): Observable<ActivityEventDto[]> {
    return this.http.get<ActivityEventDto[]>(
      this.url(`/projects/${projectId}/activity`),
      this.options()
    );
  }

  listWorkItems(projectId: string): Observable<WorkItemListItemDto[]> {
    return this.http.get<WorkItemListItemDto[]>(
      this.url(`/projects/${projectId}/work-items`),
      this.options()
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

  listWorkItemActivity(workItemId: string): Observable<ActivityEventDto[]> {
    return this.http.get<ActivityEventDto[]>(
      this.url(`/work-items/${workItemId}/activity`),
      this.options()
    );
  }

  private url(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  private options(): { headers: Record<string, string> } {
    return {
      headers: this.currentUser.actorHeaders()
    };
  }
}
