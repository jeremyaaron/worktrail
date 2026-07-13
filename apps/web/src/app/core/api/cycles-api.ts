import { Injectable, inject } from '@angular/core';
import type {
  CloseProjectCycleRequest,
  CloseProjectCycleResultDto,
  CreateProjectCycleRequest,
  ProjectCycleDto,
  ProjectCycleCloseoutPreviewDto,
  ProjectCycleReviewDto,
  ProjectCycleStatus,
  UpdateProjectCycleRequest
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { ApiClient } from './api-client';

export interface ProjectCycleListFilters {
  includeArchived?: boolean;
  status?: ProjectCycleStatus;
}

@Injectable({ providedIn: 'root' })
export class CyclesApi {
  private readonly api = inject(ApiClient);

  listCycles(
    projectId: string,
    filters: ProjectCycleListFilters = {}
  ): Observable<ProjectCycleDto[]> {
    return this.api.get<ProjectCycleDto[]>(`/projects/${projectId}/cycles`, {
      params: {
        includeArchived: filters.includeArchived === true ? 'true' : undefined,
        status: filters.status
      }
    });
  }

  createCycle(
    projectId: string,
    input: CreateProjectCycleRequest
  ): Observable<ProjectCycleDto> {
    return this.api.post<ProjectCycleDto, CreateProjectCycleRequest>(
      `/projects/${projectId}/cycles`,
      input
    );
  }

  getCycle(projectId: string, cycleId: string): Observable<ProjectCycleDto> {
    return this.api.get<ProjectCycleDto>(`/projects/${projectId}/cycles/${cycleId}`);
  }

  updateCycle(
    projectId: string,
    cycleId: string,
    input: UpdateProjectCycleRequest
  ): Observable<ProjectCycleDto> {
    return this.api.patch<ProjectCycleDto, UpdateProjectCycleRequest>(
      `/projects/${projectId}/cycles/${cycleId}`,
      input
    );
  }

  archiveCycle(projectId: string, cycleId: string): Observable<ProjectCycleDto> {
    return this.api.post<ProjectCycleDto>(`/projects/${projectId}/cycles/${cycleId}/archive`, {});
  }

  reactivateCycle(projectId: string, cycleId: string): Observable<ProjectCycleDto> {
    return this.api.post<ProjectCycleDto>(
      `/projects/${projectId}/cycles/${cycleId}/reactivate`,
      {}
    );
  }

  getCycleReview(projectId: string, cycleId: string): Observable<ProjectCycleReviewDto> {
    return this.api.get<ProjectCycleReviewDto>(
      `/projects/${projectId}/cycles/${cycleId}/review`
    );
  }

  getCloseoutPreview(
    projectId: string,
    cycleId: string
  ): Observable<ProjectCycleCloseoutPreviewDto> {
    return this.api.get<ProjectCycleCloseoutPreviewDto>(
      `/projects/${projectId}/cycles/${cycleId}/closeout-preview`
    );
  }

  closeCycle(
    projectId: string,
    cycleId: string,
    input: CloseProjectCycleRequest
  ): Observable<CloseProjectCycleResultDto> {
    return this.api.post<CloseProjectCycleResultDto, CloseProjectCycleRequest>(
      `/projects/${projectId}/cycles/${cycleId}/closeout`,
      input
    );
  }
}
