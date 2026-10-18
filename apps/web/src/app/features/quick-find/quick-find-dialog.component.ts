import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  Component, DestroyRef, ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, type NavigationExtras } from '@angular/router';
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
  take,
  tap,
  timer
} from 'rxjs';
import { navigationContextFromPage, recordNavigationTarget } from '../../shared/navigation/work-navigation';
import { QuickFindSessionService, type QuickFindSession } from './quick-find-session.service';

import { QuickFindApi } from '../../core/api/quick-find-api';
import { CurrentUserService } from '../../core/current-user.service';
import {
  focusWorkItemFilesTarget,
  workItemFilesFragment
} from '../work-items/work-item-files-target';
import type { QuickFindDialogData } from './open-quick-find-dialog';
import {
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

@Component({
  selector: 'app-quick-find-dialog',
  imports: [LucideSearch, LucideX, ReactiveFormsModule, FormsModule],
  templateUrl: './quick-find-dialog.component.html',
  styleUrl: './quick-find-dialog.component.scss'
})
export class QuickFindDialogComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(QuickFindSessionService);
  private readonly initialSession = this.session.read();
  private readonly initialIdentity = this.session.identity();
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

  readonly queryControl = new FormControl(this.initialSession.query, { nonNullable: true });
  readonly resultType = signal<QuickFindSession['type']>(this.initialSession.type);
  readonly projectFilter = signal(this.initialSession.projectId);
  readonly resultTypes = [{ value: 'all', label: 'All types' }, { value: 'workItems', label: 'Work items' }, { value: 'projects', label: 'Projects' }, { value: 'milestones', label: 'Milestones' }, { value: 'cycles', label: 'Cycles' }, { value: 'reports', label: 'Reports' }, { value: 'attachments', label: 'Filenames' }] as const;
  readonly projectOptions = computed(() => {
    const projects = new Map<string, string>();
    for (const group of Object.values(this.response()?.groups ?? {})) {
      for (const row of group.items) projects.set(row.project.id, row.project.key + ' · ' + row.project.name);
    }
    if (this.projectFilter() && !projects.has(this.projectFilter())) projects.set(this.projectFilter(), 'Selected project (outside current preview)');
    return [...projects].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  });
  readonly visibleQuery = signal(this.initialSession.query);
  readonly normalizedQuery = signal(normalizeForSearch(this.initialSession.query));
  readonly response = signal<QuickFindResponseDto | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isNavigationMode = computed(
    () => codePointLength(this.normalizedQuery()) < 2
  );
  readonly resultGroups = computed(() => quickFindResultGroups(this.response())
    .filter(group => this.resultType() === 'all' || group.key === this.resultType())
    .map(group => ({ ...group, rows: group.rows.filter(row => !this.projectFilter() || row.result.project.id === this.projectFilter()) }))
    .filter(group => group.rows.length > 0 || group.hasMore));
  readonly hasResults = computed(() => this.resultGroups().some(group => group.rows.length > 0));
  readonly hasNoResults = computed(
    () =>
      !this.isNavigationMode() &&
      !this.isLoading() &&
      this.error() === null &&
      this.response() !== null &&
      this.resultGroups().length === 0
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
          outcome.query !== this.normalizedQuery() || this.session.identity() !== this.initialIdentity
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

      if (currentActorId !== this.initialActorId || this.session.identity() !== this.initialIdentity) {
        this.requestGeneration += 1;
        this.response.set(null);
        this.activeOptionId.set(null);
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

    effect(() => {
      this.session.update({ query: this.visibleQuery(), type: this.resultType(), projectId: this.projectFilter() }, this.initialIdentity);
    });
    this.destroyRef.onDestroy(() => this.session.update({ query: this.queryControl.value, type: this.resultType(), projectId: this.projectFilter() }, this.initialIdentity));
    this.queryControl.setValue(this.initialSession.query);
  }

  close(): void {
    this.dialogRef.close();
  }

  focusQueryInput(): void {
    this.queryInput().nativeElement.focus();
  }

  clearSearch(): void {
    this.resultType.set('all');
    this.projectFilter.set('');
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
        this.navigate(quickFindWorkItemOverflowDestination(option.query, this.projectFilter() || undefined));
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
    const context = navigationContextFromPage(this.router.url,
      this.data.currentProjectId ? '/projects/' + this.data.currentProjectId + '/work-items' : '/work-items');
    const record = target.commands.length === 2 && target.commands[0] === '/work-items' && target.commands[1] !== 'new'
      ? recordNavigationTarget(String(target.commands[1]), context, undefined, target.fragment ?? null)
      : null;
    if (record) target = { ...target, commands: record.kind === 'record' ? target.commands : [record.path], queryParams: record.queryParams ?? undefined, fragment: record.fragment ?? undefined };
    const extras = this.navigationExtras(target);
    const repeatFiles = target.fragment === workItemFilesFragment && record?.path === context.immediate?.path;
    const actorId = this.currentUser.selectedMember()?.id;
    const closeAndFocus = () => {
      if (repeatFiles) this.dialogRef.closed.pipe(take(1)).subscribe(() => queueMicrotask(() => {
        if (this.router.url === destinationUrl && this.currentUser.selectedMember()?.id === actorId) focusWorkItemFilesTarget();
      }));
      this.dialogRef.close();
    };
    const destinationUrl = this.router.serializeUrl(
      this.router.createUrlTree([...target.commands], extras)
    );

    if (
      target.fragment === workItemFilesFragment &&
      destinationUrl === this.router.url
    ) {
      closeAndFocus();
      return;
    }

    void this.router.navigate([...target.commands], extras).then((accepted) => {
      if (accepted && !this.destroyRef.destroyed && this.session.identity() === this.initialIdentity) closeAndFocus();
    }).catch(() => {
      if (!this.destroyRef.destroyed && this.session.identity() === this.initialIdentity) this.error.set('The destination could not be opened.');
    });
  }

  private navigationExtras(target: QuickFindRouteTarget): NavigationExtras {
    return {
      ...(target.queryParams === undefined ? {} : { queryParams: target.queryParams }),
      ...(target.fragment === undefined ? {} : { fragment: target.fragment })
    };
  }

  private prepareQuery(query: string): void {
    this.requestGeneration += 1;
    this.normalizedQuery.set(query);
    this.response.set(null);
    this.activeOptionId.set(null);
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
