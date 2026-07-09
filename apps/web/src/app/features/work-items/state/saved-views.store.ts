import { computed, signal } from '@angular/core';
import type {
  CreateSavedWorkViewRequest,
  ListSavedWorkViewsQuery,
  SavedWorkViewDto,
  SavedWorkViewScope,
  SavedWorkViewVisibility,
  UpdateSavedWorkViewRequest,
  WorkItemQuery
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { meaningfulWorkItemQueryFieldCount } from '../query/work-item-query-serialization';

export interface SavedViewsGateway {
  listSavedWorkViews(query?: ListSavedWorkViewsQuery): Observable<SavedWorkViewDto[]>;
  createSavedWorkView(input: CreateSavedWorkViewRequest): Observable<SavedWorkViewDto>;
  updateSavedWorkView(
    savedViewId: string,
    input: UpdateSavedWorkViewRequest
  ): Observable<SavedWorkViewDto>;
  deleteSavedWorkView(savedViewId: string): Observable<void>;
}

export interface SavedViewsStoreConfig {
  readonly scope: SavedWorkViewScope;
  readonly projectId?: () => string;
  readonly canManagePersonalViews?: () => boolean;
  readonly canManageSharedViews?: () => boolean;
  readonly personalDeniedMessage?: string;
  readonly sharedDeniedMessage?: string;
  readonly loadErrorMessage?: string;
  readonly mutationErrorMessage?: string;
}

export class SavedViewsStore {
  readonly views = signal<SavedWorkViewDto[]>([]);
  readonly draftNames = signal<Record<string, string>>({});
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly mutationError = signal<string | null>(null);
  readonly personalViews = computed(() =>
    this.sortViews(
      this.views().filter(
        (savedView) =>
          savedView.scope === this.config.scope && savedView.visibility === 'personal'
      )
    )
  );
  readonly sharedViews = computed(() =>
    this.sortViews(
      this.views().filter(
        (savedView) =>
          savedView.scope === this.config.scope && savedView.visibility === 'workspace'
      )
    )
  );
  readonly pinnedPersonalViews = computed(() =>
    this.personalViews().filter((savedView) => savedView.isPinned)
  );
  readonly pinnedSharedViews = computed(() =>
    this.sharedViews().filter((savedView) => savedView.isPinned)
  );

  constructor(
    private readonly gateway: SavedViewsGateway,
    private readonly config: SavedViewsStoreConfig
  ) {}

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.gateway.listSavedWorkViews(this.listQuery()).subscribe({
      next: (savedViews) => {
        this.views.set(this.sortViews(savedViews));
        this.syncDraftNames();
        this.isLoading.set(false);
      },
      error: () => {
        this.views.set([]);
        this.draftNames.set({});
        this.loadError.set(this.config.loadErrorMessage ?? 'Saved views could not be loaded.');
        this.isLoading.set(false);
      }
    });
  }

  create(name: string, visibility: SavedWorkViewVisibility, query: WorkItemQuery): void {
    const trimmedName = name.trim();

    if (trimmedName === '') {
      this.mutationError.set('Saved view name is required.');
      return;
    }

    if (!this.canManageVisibility(visibility)) {
      return;
    }

    this.isSaving.set(true);
    this.mutationError.set(null);

    this.gateway
      .createSavedWorkView({
        name: trimmedName,
        scope: this.config.scope,
        projectId: this.config.scope === 'project' ? this.config.projectId?.() : undefined,
        query,
        ...(visibility === 'workspace' ? { visibility } : {})
      })
      .subscribe({
        next: (savedView) => {
          this.views.set(this.sortViews([...this.views(), savedView]));
          this.syncDraftNames();
          this.isSaving.set(false);
        },
        error: () => {
          this.mutationError.set(
            this.config.mutationErrorMessage ?? 'Saved view could not be saved.'
          );
          this.isSaving.set(false);
        }
      });
  }

  rename(savedView: SavedWorkViewDto, name: string): void {
    const trimmedName = name.trim();

    if (trimmedName === '') {
      this.mutationError.set('Saved view name is required.');
      return;
    }

    this.update(savedView, { name: trimmedName }, 'Saved view could not be renamed.');
  }

  updateQuery(savedView: SavedWorkViewDto, query: WorkItemQuery): void {
    this.update(savedView, { query }, 'Saved view query could not be updated.');
  }

  setPinned(savedView: SavedWorkViewDto, isPinned: boolean): void {
    this.update(savedView, { isPinned }, 'Saved view pin state could not be updated.');
  }

  delete(savedView: SavedWorkViewDto): void {
    if (!this.canMutate(savedView)) {
      return;
    }

    this.mutationError.set(null);

    this.gateway.deleteSavedWorkView(savedView.id).subscribe({
      next: () => {
        this.views.set(this.views().filter((view) => view.id !== savedView.id));
        const { [savedView.id]: _removed, ...remainingDraftNames } = this.draftNames();
        this.draftNames.set(remainingDraftNames);
      },
      error: () => {
        this.mutationError.set('Saved view could not be deleted.');
      }
    });
  }

  draftName(savedViewId: string): string {
    return this.draftNames()[savedViewId] ?? '';
  }

  setDraftName(savedViewId: string, name: string): void {
    this.draftNames.set({
      ...this.draftNames(),
      [savedViewId]: name
    });
  }

  queryLabel(savedView: SavedWorkViewDto): string {
    const count = meaningfulWorkItemQueryFieldCount(savedView.query, this.config.scope);

    if (count === 0) {
      return this.config.scope === 'workspace' ? 'Default workspace view' : 'Default project view';
    }

    return `${count} applied ${count === 1 ? 'filter' : 'filters'}`;
  }

  canMutate(savedView: SavedWorkViewDto): boolean {
    return this.canManageVisibility(savedView.visibility);
  }

  private update(
    savedView: SavedWorkViewDto,
    input: UpdateSavedWorkViewRequest,
    fallback: string
  ): void {
    if (!this.canMutate(savedView)) {
      return;
    }

    this.mutationError.set(null);

    this.gateway.updateSavedWorkView(savedView.id, input).subscribe({
      next: (updated) => {
        this.replaceView(updated);
      },
      error: () => {
        this.mutationError.set(fallback);
      }
    });
  }

  private canManageVisibility(visibility: SavedWorkViewVisibility): boolean {
    if (visibility === 'personal') {
      if (this.config.canManagePersonalViews?.() ?? true) {
        return true;
      }

      this.mutationError.set(this.config.personalDeniedMessage ?? 'Saved views are read-only.');
      return false;
    }

    if (this.config.canManageSharedViews?.() ?? true) {
      return true;
    }

    this.mutationError.set(
      this.config.sharedDeniedMessage ??
        'Only owners and maintainers can manage shared saved views.'
    );
    return false;
  }

  private listQuery(): ListSavedWorkViewsQuery {
    return {
      scope: this.config.scope,
      projectId: this.config.scope === 'project' ? this.config.projectId?.() : undefined
    };
  }

  private replaceView(savedView: SavedWorkViewDto): void {
    this.views.set(
      this.sortViews(
        this.views().map((current) => (current.id === savedView.id ? savedView : current))
      )
    );
    this.syncDraftNames();
  }

  private syncDraftNames(): void {
    this.draftNames.set(Object.fromEntries(this.views().map((view) => [view.id, view.name])));
  }

  private sortViews(savedViews: SavedWorkViewDto[]): SavedWorkViewDto[] {
    return [...savedViews].sort((left, right) => left.name.localeCompare(right.name));
  }
}
