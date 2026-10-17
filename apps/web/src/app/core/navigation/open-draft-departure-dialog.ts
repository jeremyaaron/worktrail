import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, runInInjectionContext } from '@angular/core';
import type { Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Component({
  template: `
    <h2 id="draft-departure-heading">Discard unsaved changes?</h2>
    <p id="draft-departure-description">Unsaved changes in {{ categories.join(', ') }} will be discarded.</p>
    <div class="actions">
      <button type="button" class="stay" (click)="ref.close(false)">Stay</button>
      <button type="button" class="discard" (click)="ref.close(true)">Discard</button>
    </div>
  `,
  styles: `
    :host { display: block; padding: 24px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; color: #111827; }
    h2 { margin: 0 0 12px; font-size: 1.2rem; }
    p { margin: 0; font-size: .9rem; line-height: 1.5; overflow-wrap: anywhere; }
    .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
    button { min-height: 40px; padding: 8px 16px; border: 1px solid #94a3b8; border-radius: 6px; font: inherit; font-weight: 600; cursor: pointer; }
    .stay { background: #fff; color: #111827; }
    .discard { background: #b91c1c; border-color: #b91c1c; color: #fff; }
    button:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
  `
})
class DraftDepartureDialogComponent {
  readonly categories = inject<readonly string[]>(DIALOG_DATA);
  readonly ref = inject<DialogRef<boolean>>(DialogRef);
}

export async function confirmDraftDeparture(injector: Injector, categories: readonly string[], signal: AbortSignal): Promise<boolean> {
  const dialog = runInInjectionContext(injector, () => inject(Dialog));
  const ref = dialog.open<boolean>(DraftDepartureDialogComponent, {
    data: categories, ariaLabelledBy: 'draft-departure-heading', ariaDescribedBy: 'draft-departure-description',
    ariaModal: true, autoFocus: '.stay', closeOnNavigation: false, restoreFocus: false,
    width: '420px', maxWidth: 'calc(100vw - 32px)'
  });
  const abort = () => ref.close(false);
  const closed = firstValueFrom(ref.closed);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  try {
    return (await closed) === true;
  } finally { signal.removeEventListener('abort', abort); }
}
