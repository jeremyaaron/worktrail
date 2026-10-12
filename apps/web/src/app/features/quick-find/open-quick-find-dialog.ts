import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { type Injector, inject, runInInjectionContext } from '@angular/core';

import type { QuickFindDialogComponent } from './quick-find-dialog.component';

export interface QuickFindDialogData {
  currentProjectId: string | null;
}

export type QuickFindDialogRef = DialogRef<void, QuickFindDialogComponent>;

export async function openQuickFindDialog(
  injector: Injector,
  data: QuickFindDialogData
): Promise<QuickFindDialogRef> {
  const dialog = runInInjectionContext(injector, () => inject(Dialog));
  const { QuickFindDialogComponent } = await import('./quick-find-dialog.component');

  return dialog.open<void, QuickFindDialogData, QuickFindDialogComponent>(
    QuickFindDialogComponent,
    {
      ariaLabelledBy: 'quick-find-heading',
      ariaModal: true,
      autoFocus: '.quick-find__input',
      closeOnNavigation: true,
      data,
      disableClose: false,
      hasBackdrop: true,
      maxHeight: 'calc(100vh - 32px)',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'quick-find-overlay',
      restoreFocus: true,
      width: '720px'
    }
  );
}
