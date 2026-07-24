import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild
} from '@angular/core';
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
  QuickFindRouteTarget,
  QuickFindSelectableOption
} from './quick-find-model';
import {
  quickFindCurrentProjectNavigationEntries,
  quickFindGlobalNavigationEntries,
  quickFindResultDestination,
  quickFindResultOptionId,
  quickFindWorkItemOverflowDestination
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
  readonly selectableOptions = computed<readonly QuickFindSelectableOption[]>(() => {
    if (this.isNavigationMode()) {
      return [
        ...this.globalEntries.map((entry) => ({ type: 'navigation', entry }) as const),
        ...this.currentProjectEntries.map((entry) => ({ type: 'navigation', entry }) as const)
      ];
    }

    if (this.isLoading() || this.error() !== null) {
      return [];
    }

    return this.resultOptions();
  });
  readonly activeOptionId = signal<string | null>(null);
  readonly listIsExpanded = computed(() => this.selectableOptions().length > 0);
  readonly overflowQuery = computed(
    () => this.response()?.query ?? this.normalizedQuery()
  );
  readonly liveSummary = computed(() => {
    if (this.isNavigationMode()) {
      return `${this.selectableOptions().length} destinations available.`;
    }

    if (this.isLoading()) {
      return 'Searching.';
    }

    if (this.error() !== null) {
      return '';
    }

    const resultCount = this.resultGroups().reduce(
      (total, group) => total + group.rows.length,
      0
    );

    return resultCount === 0
      ? `No results for ${this.normalizedQuery()}.`
      : `${resultCount} ${resultCount === 1 ? 'result' : 'results'} available.`;
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

    effect(() => {
      const optionIds = this.selectableOptions().map((option) => this.optionId(option));
      const currentId = untracked(this.activeOptionId);
      const nextId =
        currentId !== null && optionIds.includes(currentId)
          ? currentId
          : (optionIds[0] ?? null);

      this.activeOptionId.set(nextId);
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

  onQueryKeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }

    const options = this.selectableOptions();

    if (options.length === 0) {
      return;
    }

    const activeIndex = options.findIndex(
      (option) => this.optionId(option) === this.activeOptionId()
    );
    let targetIndex: number | null = null;

    switch (event.key) {
      case 'ArrowDown':
        targetIndex = activeIndex < 0 ? 0 : Math.min(activeIndex + 1, options.length - 1);
        break;
      case 'ArrowUp':
        targetIndex = activeIndex < 0 ? options.length - 1 : Math.max(activeIndex - 1, 0);
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = options.length - 1;
        break;
      case 'Enter':
        if (activeIndex >= 0) {
          event.preventDefault();
          this.activateOption(options[activeIndex]);
        }
        return;
      default:
        return;
    }

    event.preventDefault();
    this.setActiveOption(options[targetIndex]);
  }

  setActiveOption(option: QuickFindSelectableOption): void {
    const id = this.optionId(option);
    this.activeOptionId.set(id);
    queueMicrotask(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
    });
  }

  onOptionKeydown(event: KeyboardEvent, option: QuickFindSelectableOption): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.activateOption(option);
  }

  keepInputFocus(event: MouseEvent): void {
    event.preventDefault();
  }

  activateOption(option: QuickFindSelectableOption): void {
    switch (option.type) {
      case 'navigation':
        this.navigate(option.entry);
        return;
      case 'result':
        this.navigate(quickFindResultDestination(option.result));
        return;
      case 'work_item_overflow':
        this.navigate(quickFindWorkItemOverflowDestination(option.query));
        return;
      default:
        assertNever(option);
    }
  }

  optionId(option: QuickFindSelectableOption): string {
    switch (option.type) {
      case 'navigation':
        return `quick-find-navigation-${option.entry.id}`;
      case 'result':
        return quickFindResultOptionId(option.result);
      case 'work_item_overflow':
        return 'quick-find-work-item-overflow';
      default:
        return assertNever(option);
    }
  }

  isActiveOption(option: QuickFindSelectableOption): boolean {
    return this.activeOptionId() === this.optionId(option);
  }

  navigationOption(entry: QuickFindNavigationEntry): QuickFindSelectableOption {
    return { type: 'navigation', entry };
  }

  resultOption(
    result: Extract<QuickFindSelectableOption, { type: 'result' }>['result']
  ): QuickFindSelectableOption {
    return { type: 'result', result };
  }

  overflowOption(query: string): QuickFindSelectableOption {
    return { type: 'work_item_overflow', query };
  }

  resultAriaLabel(
    row: ReturnType<typeof quickFindResultGroups>[number]['rows'][number]
  ): string {
    return [
      row.identity,
      row.title,
      row.context,
      ...row.metadata,
      ...row.lifecycle
    ].filter((part): part is string => part !== null && part !== '').join(', ');
  }

  openNavigationEntry(entry: QuickFindNavigationEntry): void {
    this.activateOption({ type: 'navigation', entry });
  }

  private navigate(target: QuickFindRouteTarget): void {
    this.dialogRef.close();
    void this.router.navigate([...target.commands], {
      ...(target.queryParams === undefined ? {} : { queryParams: target.queryParams }),
      ...(target.fragment === undefined ? {} : { fragment: target.fragment })
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

function assertNever(value: never): never {
  throw new Error(`Unsupported Quick Find option: ${String(value)}`);
}
