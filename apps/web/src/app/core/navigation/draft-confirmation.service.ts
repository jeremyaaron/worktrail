import { Injectable, Injector, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { captureDraftFocus } from './draft-focus';

@Injectable({ providedIn: 'root' })
export class DraftConfirmationService {
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  async confirm(categories: readonly string[], signal: AbortSignal): Promise<boolean> {
    const restore = captureDraftFocus(this.document);
    let allowed = false;
    try {
      const { confirmDraftDeparture } = await import('./open-draft-departure-dialog');
      if (signal.aborted) return false;
      allowed = await confirmDraftDeparture(this.injector, categories, signal);
      return allowed;
    } finally {
      if (!allowed) restore();
    }
  }
}
