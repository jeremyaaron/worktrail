import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideSearch, LucideX } from '@lucide/angular';

import type { QuickFindNavigationEntry } from './quick-find-model';
import {
  quickFindCurrentProjectNavigationEntries,
  quickFindGlobalNavigationEntries
} from './quick-find-navigation';
import type { QuickFindDialogData } from './open-quick-find-dialog';

@Component({
  selector: 'app-quick-find-dialog',
  imports: [LucideSearch, LucideX, ReactiveFormsModule],
  templateUrl: './quick-find-dialog.component.html',
  styleUrl: './quick-find-dialog.component.scss'
})
export class QuickFindDialogComponent {
  private readonly data = inject<QuickFindDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<void, QuickFindDialogComponent>>(DialogRef);
  private readonly router = inject(Router);
  private readonly queryInput =
    viewChild.required<ElementRef<HTMLInputElement>>('queryInput');

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly visibleQuery = signal('');
  readonly isNavigationMode = computed(
    () => Array.from(normalizeForMode(this.visibleQuery())).length < 2
  );
  readonly globalEntries: readonly QuickFindNavigationEntry[] =
    quickFindGlobalNavigationEntries;
  readonly currentProjectEntries = quickFindCurrentProjectNavigationEntries(
    this.data.currentProjectId
  );

  constructor() {
    this.queryControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((query) => {
      this.visibleQuery.set(query);
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  focusQueryInput(): void {
    this.queryInput().nativeElement.focus();
  }

  openNavigationEntry(entry: QuickFindNavigationEntry): void {
    this.dialogRef.close();
    void this.router.navigate([...entry.commands], {
      ...(entry.queryParams === undefined ? {} : { queryParams: entry.queryParams }),
      ...(entry.fragment === undefined ? {} : { fragment: entry.fragment })
    });
  }
}

function normalizeForMode(query: string): string {
  return query.normalize('NFC').trim().replace(/\p{White_Space}+/gu, ' ');
}
