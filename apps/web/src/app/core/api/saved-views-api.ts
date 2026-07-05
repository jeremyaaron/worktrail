import { Injectable, inject } from '@angular/core';
import type {
  CreateSavedWorkViewRequest,
  SavedWorkViewDto,
  UpdateSavedWorkViewRequest
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class SavedViewsApi {
  private readonly api = inject(ApiClient);

  listSavedWorkViews(): Observable<SavedWorkViewDto[]> {
    return this.api.get<SavedWorkViewDto[]>('/saved-work-views');
  }

  createSavedWorkView(input: CreateSavedWorkViewRequest): Observable<SavedWorkViewDto> {
    return this.api.post<SavedWorkViewDto, CreateSavedWorkViewRequest>(
      '/saved-work-views',
      input
    );
  }

  updateSavedWorkView(
    savedViewId: string,
    input: UpdateSavedWorkViewRequest
  ): Observable<SavedWorkViewDto> {
    return this.api.patch<SavedWorkViewDto, UpdateSavedWorkViewRequest>(
      `/saved-work-views/${savedViewId}`,
      input
    );
  }

  deleteSavedWorkView(savedViewId: string): Observable<void> {
    return this.api.delete<void>(`/saved-work-views/${savedViewId}`);
  }
}
