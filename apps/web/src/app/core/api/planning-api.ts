import { Injectable, inject } from '@angular/core';
import type { ProjectPlanningSummaryDto } from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class PlanningApi {
  private readonly api = inject(ApiClient);

  getProjectPlanningSummary(projectId: string): Observable<ProjectPlanningSummaryDto> {
    return this.api.get<ProjectPlanningSummaryDto>(`/projects/${projectId}/planning-summary`);
  }
}
