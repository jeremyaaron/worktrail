import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideSearch, LucideX } from '@lucide/angular';
import type { QuickFindResponseDto } from '@worktrail/contracts';
import {
  EMPTY,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  merge,
  of,
  switchMap,
  tap,
  timer
} from 'rxjs';

import { QuickFindApi } from '../../core/api/quick-find-api';
import { CurrentUserService } from '../../core/current-user.service';
import {
  quickFindHasResults,
  quickFindResultGroups
} from './quick-find-display';
import type {
  QuickFindNavigationEntry,
  QuickFindSelectableOption
} from './quick-find-model';
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
  private readonly quickFindApi = inject(QuickFindApi);
  private readonly currentUser = inject(CurrentUserService);
  private readonly queryInput =
    viewChild.required<ElementRef<HTMLInputElement>>('queryInput');
  private readonly retryQuery = new Subject<string>();
  private readonly initialActorId = this.currentUser.selectedMember()?.id ?? null;
  private requestGeneration = 0;

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly visibleQuery = signal('');
  readonly normalizedQuery = signal('');
  readonly response = signal<QuickFindResponseDto | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isNavigationMode = computed(
    () => codePointLength(this.normalizedQuery()) < 2
  );
  readonly resultGroups = computed(() => quickFindResultGroups(this.response()));
  readonly hasResults = computed(() => quickFindHasResults(this.response()));
  readonly hasNoResults = computed(
    () =>
      !this.isNavigationMode() &&
      !this.isLoading() &&
      this.error() === null &&
      this.response() !== null &&
      !this.hasResults()
  );
  readonly resultOptions = computed<readonly QuickFindSelectableOption[]>(() => {
    const response = this.response();

    if (response === null) {
      return [];
    }

    return this.resultGroups().flatMap((group) => [
      ...group.rows.map((row) => ({ type: 'result', result: row.result }) as const),
      ...(group.hasWorkItemOverflow
        ? [{ type: 'work_item_overflow', query: response.query } as const]
        : [])
    ]);
  });
  readonly globalEntries: readonly QuickFindNavigationEntry[] =
    quickFindGlobalNavigationEntries;
  readonly currentProjectEntries = quickFindCurrentProjectNavigationEntries(
    this.data.currentProjectId
  );

  constructor() {
    const queryChanges = this.queryControl.valueChanges.pipe(
      tap((query) => this.visibleQuery.set(query)),
      map(normalizeForSearch),
      distinctUntilChanged(),
      tap((query) => this.prepareQuery(query)),
      map((query) => ({
        query,
        generation: this.requestGeneration,
        debounce: true
      }))
    );
    const retries = this.retryQuery.pipe(
      map((query) => {
        this.requestGeneration += 1;
        this.response.set(null);
        this.error.set(null);
        this.isLoading.set(true);

        return {
          query,
          generation: this.requestGeneration,
          debounce: false
        };
      })
    );

    merge(queryChanges, retries)
      .pipe(
        switchMap(({ query, generation, debounce }) => {
          if (codePointLength(query) < 2) {
            return EMPTY;
          }

          return timer(debounce ? 220 : 0).pipe(
            switchMap(() => this.quickFindApi.search({ query })),
            map((response) => ({ type: 'success' as const, response, query, generation })),
            catchError(() => of({ type: 'error' as const, query, generation }))
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe((outcome) => {
        if (
          outcome.generation !== this.requestGeneration ||
          outcome.query !== this.normalizedQuery()
        ) {
          return;
        }

        this.isLoading.set(false);

        if (outcome.type === 'success') {
          this.response.set(outcome.response);
          this.error.set(null);
        } else {
          this.response.set(null);
          this.error.set('Quick Find is temporarily unavailable.');
        }
      });

    effect(() => {
      const currentActorId = this.currentUser.selectedMember()?.id ?? null;

      if (currentActorId !== this.initialActorId) {
        this.requestGeneration += 1;
        this.dialogRef.close();
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  focusQueryInput(): void {
    this.queryInput().nativeElement.focus();
  }

  clearSearch(): void {
    this.queryControl.setValue('');
    this.focusQueryInput();
  }

  retrySearch(): void {
    const query = this.normalizedQuery();

    if (codePointLength(query) >= 2 && !this.isLoading()) {
      this.retryQuery.next(query);
    }
  }

  openNavigationEntry(entry: QuickFindNavigationEntry): void {
    this.dialogRef.close();
    void this.router.navigate([...entry.commands], {
      ...(entry.queryParams === undefined ? {} : { queryParams: entry.queryParams }),
      ...(entry.fragment === undefined ? {} : { fragment: entry.fragment })
    });
  }

  private prepareQuery(query: string): void {
    this.requestGeneration += 1;
    this.normalizedQuery.set(query);
    this.response.set(null);
    this.error.set(null);
    this.isLoading.set(codePointLength(query) >= 2);
  }
}

function normalizeForSearch(query: string): string {
  return query.normalize('NFC').trim().replace(/\p{White_Space}+/gu, ' ');
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}
