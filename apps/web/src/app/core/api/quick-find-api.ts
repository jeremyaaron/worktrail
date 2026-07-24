import { Injectable, inject } from '@angular/core';
import type { QuickFindRequest, QuickFindResponseDto } from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class QuickFindApi {
  private readonly api = inject(ApiClient);

  search(input: QuickFindRequest): Observable<QuickFindResponseDto> {
    return this.api.post<QuickFindResponseDto, QuickFindRequest>('/quick-find', input);
  }
}
