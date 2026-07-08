import type { HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ActivityEventDto,
  CreateLabelRequest,
  CreateMilestoneRequest,
  CreateProjectRequest,
  CreateProjectStatusReportRequest,
  LabelDto,
  MilestoneDto,
  MilestoneStatus,
  ProjectDto,
  ProjectNavigationSummaryDto,
  ProjectStatusReportDetailDto,
  ProjectStatusReportDraftDto,
  ProjectStatusReportSummaryDto,
  ProjectSummaryDto,
  UpdateLabelRequest,
  UpdateMilestoneRequest,
  UpdateProjectRequest
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class ProjectsApi {
  private readonly api = inject(ApiClient);

  listProjects(): Observable<ProjectDto[]> {
    return this.api.get<ProjectDto[]>('/projects');
  }

  listProjectNavigationSummaries(): Observable<ProjectNavigationSummaryDto[]> {
    return this.api.get<ProjectNavigationSummaryDto[]>('/projects/navigation-summary');
  }

  createProject(input: CreateProjectRequest): Observable<ProjectDto> {
    return this.api.post<ProjectDto, CreateProjectRequest>('/projects', input);
  }

  getProject(projectId: string): Observable<ProjectDto> {
    return this.api.get<ProjectDto>(`/projects/${projectId}`);
  }

  updateProject(projectId: string, input: UpdateProjectRequest): Observable<ProjectDto> {
    return this.api.patch<ProjectDto, UpdateProjectRequest>(`/projects/${projectId}`, input);
  }

  archiveProject(projectId: string): Observable<ProjectDto> {
    return this.api.post<ProjectDto>(`/projects/${projectId}/archive`, {});
  }

  reactivateProject(projectId: string): Observable<ProjectDto> {
    return this.api.post<ProjectDto>(`/projects/${projectId}/reactivate`, {});
  }

  getProjectSummary(projectId: string): Observable<ProjectSummaryDto> {
    return this.api.get<ProjectSummaryDto>(`/projects/${projectId}/summary`);
  }

  listProjectStatusReports(projectId: string): Observable<ProjectStatusReportSummaryDto[]> {
    return this.api.get<ProjectStatusReportSummaryDto[]>(
      `/projects/${projectId}/status-reports`
    );
  }

  getProjectStatusReportDraft(projectId: string): Observable<ProjectStatusReportDraftDto> {
    return this.api.get<ProjectStatusReportDraftDto>(
      `/projects/${projectId}/status-reports/draft`
    );
  }

  publishProjectStatusReport(
    projectId: string,
    input: CreateProjectStatusReportRequest
  ): Observable<ProjectStatusReportDetailDto> {
    return this.api.post<ProjectStatusReportDetailDto, CreateProjectStatusReportRequest>(
      `/projects/${projectId}/status-reports`,
      input
    );
  }

  getProjectStatusReport(
    projectId: string,
    reportId: string
  ): Observable<ProjectStatusReportDetailDto> {
    return this.api.get<ProjectStatusReportDetailDto>(
      `/projects/${projectId}/status-reports/${reportId}`
    );
  }

  exportProjectStatusReportMarkdown(
    projectId: string,
    reportId: string
  ): Observable<HttpResponse<Blob>> {
    return this.api.getBlob(`/projects/${projectId}/status-reports/${reportId}/export.md`);
  }

  listProjectActivity(projectId: string): Observable<ActivityEventDto[]> {
    return this.api.get<ActivityEventDto[]>(`/projects/${projectId}/activity`);
  }

  listProjectLabels(
    projectId: string,
    input: { includeArchived?: boolean } = {}
  ): Observable<LabelDto[]> {
    return this.api.get<LabelDto[]>(`/projects/${projectId}/labels`, {
      params: { includeArchived: input.includeArchived === true ? 'true' : undefined }
    });
  }

  createLabel(projectId: string, input: CreateLabelRequest): Observable<LabelDto> {
    return this.api.post<LabelDto, CreateLabelRequest>(`/projects/${projectId}/labels`, input);
  }

  updateLabel(labelId: string, input: UpdateLabelRequest): Observable<LabelDto> {
    return this.api.patch<LabelDto, UpdateLabelRequest>(`/labels/${labelId}`, input);
  }

  archiveLabel(labelId: string): Observable<LabelDto> {
    return this.api.post<LabelDto>(`/labels/${labelId}/archive`, {});
  }

  reactivateLabel(labelId: string): Observable<LabelDto> {
    return this.api.post<LabelDto>(`/labels/${labelId}/reactivate`, {});
  }

  listProjectMilestones(
    projectId: string,
    input: { includeArchived?: boolean; status?: MilestoneStatus } = {}
  ): Observable<MilestoneDto[]> {
    return this.api.get<MilestoneDto[]>(`/projects/${projectId}/milestones`, {
      params: {
        includeArchived: input.includeArchived === true ? 'true' : undefined,
        status: input.status
      }
    });
  }

  createMilestone(projectId: string, input: CreateMilestoneRequest): Observable<MilestoneDto> {
    return this.api.post<MilestoneDto, CreateMilestoneRequest>(
      `/projects/${projectId}/milestones`,
      input
    );
  }

  updateMilestone(
    milestoneId: string,
    input: UpdateMilestoneRequest
  ): Observable<MilestoneDto> {
    return this.api.patch<MilestoneDto, UpdateMilestoneRequest>(
      `/milestones/${milestoneId}`,
      input
    );
  }

  archiveMilestone(milestoneId: string): Observable<MilestoneDto> {
    return this.api.post<MilestoneDto>(`/milestones/${milestoneId}/archive`, {});
  }

  reactivateMilestone(milestoneId: string): Observable<MilestoneDto> {
    return this.api.post<MilestoneDto>(`/milestones/${milestoneId}/reactivate`, {});
  }
}
