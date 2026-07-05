import type { HttpResponse } from '@angular/common/http';
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
  CreateWorkItemRelationshipRequest,
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
  WorkItemRelationshipDto,
  WorkItemRelationshipSummaryDto,
  WorkspaceActivityEventDto,
  WorkspaceCapabilitiesDto,
  WorkspaceDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { PlanningApi } from './api/planning-api';
import { ProjectsApi } from './api/projects-api';
import { SavedViewsApi } from './api/saved-views-api';
import { WorkItemsApi } from './api/work-items-api';
import type { WorkItemListFilters } from './api/work-items-api';
import { WorkspaceApi } from './api/workspace-api';

export type { WorkItemListFilters } from './api/work-items-api';

@Injectable({ providedIn: 'root' })
export class WorktrailApiService {
  private readonly planning = inject(PlanningApi);
  private readonly projects = inject(ProjectsApi);
  private readonly savedViews = inject(SavedViewsApi);
  private readonly workItems = inject(WorkItemsApi);
  private readonly workspace = inject(WorkspaceApi);

  getWorkspace(): Observable<WorkspaceDto> {
    return this.workspace.getWorkspace();
  }

  updateWorkspace(input: UpdateWorkspaceRequest): Observable<WorkspaceDto> {
    return this.workspace.updateWorkspace(input);
  }

  getWorkspaceCapabilities(): Observable<WorkspaceCapabilitiesDto> {
    return this.workspace.getWorkspaceCapabilities();
  }

  listWorkspaceActivity(): Observable<WorkspaceActivityEventDto[]> {
    return this.workspace.listWorkspaceActivity();
  }

  listMembers(): Observable<MemberDto[]> {
    return this.workspace.listMembers();
  }

  createMember(input: CreateMemberRequest): Observable<MemberDto> {
    return this.workspace.createMember(input);
  }

  updateMember(memberId: string, input: UpdateMemberRequest): Observable<MemberDto> {
    return this.workspace.updateMember(memberId, input);
  }

  deactivateMember(memberId: string): Observable<MemberDto> {
    return this.workspace.deactivateMember(memberId);
  }

  reactivateMember(memberId: string): Observable<MemberDto> {
    return this.workspace.reactivateMember(memberId);
  }

  listProjects(): Observable<ProjectDto[]> {
    return this.projects.listProjects();
  }

  listProjectNavigationSummaries(): Observable<ProjectNavigationSummaryDto[]> {
    return this.projects.listProjectNavigationSummaries();
  }

  createProject(input: CreateProjectRequest): Observable<ProjectDto> {
    return this.projects.createProject(input);
  }

  getProject(projectId: string): Observable<ProjectDto> {
    return this.projects.getProject(projectId);
  }

  updateProject(projectId: string, input: UpdateProjectRequest): Observable<ProjectDto> {
    return this.projects.updateProject(projectId, input);
  }

  archiveProject(projectId: string): Observable<ProjectDto> {
    return this.projects.archiveProject(projectId);
  }

  reactivateProject(projectId: string): Observable<ProjectDto> {
    return this.projects.reactivateProject(projectId);
  }

  getProjectSummary(projectId: string): Observable<ProjectSummaryDto> {
    return this.projects.getProjectSummary(projectId);
  }

  getProjectPlanningSummary(projectId: string): Observable<ProjectPlanningSummaryDto> {
    return this.planning.getProjectPlanningSummary(projectId);
  }

  listProjectActivity(projectId: string): Observable<ActivityEventDto[]> {
    return this.projects.listProjectActivity(projectId);
  }

  listProjectLabels(projectId: string, input: { includeArchived?: boolean } = {}): Observable<LabelDto[]> {
    return this.projects.listProjectLabels(projectId, input);
  }

  createLabel(projectId: string, input: CreateLabelRequest): Observable<LabelDto> {
    return this.projects.createLabel(projectId, input);
  }

  updateLabel(labelId: string, input: UpdateLabelRequest): Observable<LabelDto> {
    return this.projects.updateLabel(labelId, input);
  }

  archiveLabel(labelId: string): Observable<LabelDto> {
    return this.projects.archiveLabel(labelId);
  }

  reactivateLabel(labelId: string): Observable<LabelDto> {
    return this.projects.reactivateLabel(labelId);
  }

  listProjectMilestones(
    projectId: string,
    input: { includeArchived?: boolean; status?: MilestoneStatus } = {}
  ): Observable<MilestoneDto[]> {
    return this.projects.listProjectMilestones(projectId, input);
  }

  createMilestone(projectId: string, input: CreateMilestoneRequest): Observable<MilestoneDto> {
    return this.projects.createMilestone(projectId, input);
  }

  updateMilestone(milestoneId: string, input: UpdateMilestoneRequest): Observable<MilestoneDto> {
    return this.projects.updateMilestone(milestoneId, input);
  }

  archiveMilestone(milestoneId: string): Observable<MilestoneDto> {
    return this.projects.archiveMilestone(milestoneId);
  }

  reactivateMilestone(milestoneId: string): Observable<MilestoneDto> {
    return this.projects.reactivateMilestone(milestoneId);
  }

  listWorkItems(
    projectId: string,
    filters: WorkItemListFilters = {}
  ): Observable<WorkItemListItemDto[]> {
    return this.workItems.listWorkItems(projectId, filters);
  }

  getMyWork(): Observable<MyWorkDashboardDto> {
    return this.workItems.getMyWork();
  }

  listWorkspaceWorkItems(filters: WorkItemQuery = {}): Observable<WorkspaceWorkItemListItemDto[]> {
    return this.workItems.listWorkspaceWorkItems(filters);
  }

  exportWorkspaceWorkItems(filters: WorkItemQuery = {}): Observable<HttpResponse<Blob>> {
    return this.workItems.exportWorkspaceWorkItems(filters);
  }

  listSavedWorkViews(): Observable<SavedWorkViewDto[]> {
    return this.savedViews.listSavedWorkViews();
  }

  createSavedWorkView(input: CreateSavedWorkViewRequest): Observable<SavedWorkViewDto> {
    return this.savedViews.createSavedWorkView(input);
  }

  updateSavedWorkView(
    savedViewId: string,
    input: UpdateSavedWorkViewRequest
  ): Observable<SavedWorkViewDto> {
    return this.savedViews.updateSavedWorkView(savedViewId, input);
  }

  deleteSavedWorkView(savedViewId: string): Observable<void> {
    return this.savedViews.deleteSavedWorkView(savedViewId);
  }

  createWorkItem(projectId: string, input: CreateWorkItemRequest): Observable<WorkItemDetailDto> {
    return this.workItems.createWorkItem(projectId, input);
  }

  previewWorkItemCsvImport(
    projectId: string,
    csv: string
  ): Observable<WorkItemCsvImportPreviewDto> {
    return this.workItems.previewWorkItemCsvImport(projectId, csv);
  }

  applyWorkItemCsvImport(projectId: string, csv: string): Observable<WorkItemCsvImportApplyDto> {
    return this.workItems.applyWorkItemCsvImport(projectId, csv);
  }

  exportProjectWorkItems(
    projectId: string,
    filters: WorkItemListFilters = {}
  ): Observable<HttpResponse<Blob>> {
    return this.workItems.exportProjectWorkItems(projectId, filters);
  }

  getWorkItem(workItemId: string): Observable<WorkItemDetailDto> {
    return this.workItems.getWorkItem(workItemId);
  }

  updateWorkItem(workItemId: string, input: UpdateWorkItemRequest): Observable<WorkItemDetailDto> {
    return this.workItems.updateWorkItem(workItemId, input);
  }

  transitionWorkItem(
    workItemId: string,
    input: TransitionWorkItemRequest
  ): Observable<WorkItemDetailDto> {
    return this.workItems.transitionWorkItem(workItemId, input);
  }

  moveWorkItemOnBoard(
    workItemId: string,
    input: MoveWorkItemOnBoardRequest
  ): Observable<WorkItemDetailDto> {
    return this.workItems.moveWorkItemOnBoard(workItemId, input);
  }

  listWorkItemRelationships(workItemId: string): Observable<WorkItemRelationshipSummaryDto> {
    return this.workItems.listWorkItemRelationships(workItemId);
  }

  createWorkItemRelationship(
    workItemId: string,
    input: CreateWorkItemRelationshipRequest
  ): Observable<WorkItemRelationshipDto> {
    return this.workItems.createWorkItemRelationship(workItemId, input);
  }

  deleteWorkItemRelationship(workItemId: string, relationshipId: string): Observable<void> {
    return this.workItems.deleteWorkItemRelationship(workItemId, relationshipId);
  }

  listComments(workItemId: string): Observable<CommentDto[]> {
    return this.workItems.listComments(workItemId);
  }

  createComment(workItemId: string, input: CreateCommentRequest): Observable<CommentDto> {
    return this.workItems.createComment(workItemId, input);
  }

  updateComment(commentId: string, input: UpdateCommentRequest): Observable<CommentDto> {
    return this.workItems.updateComment(commentId, input);
  }

  deleteComment(commentId: string): Observable<CommentDto> {
    return this.workItems.deleteComment(commentId);
  }

  listWorkItemActivity(workItemId: string): Observable<ActivityEventDto[]> {
    return this.workItems.listWorkItemActivity(workItemId);
  }
}
