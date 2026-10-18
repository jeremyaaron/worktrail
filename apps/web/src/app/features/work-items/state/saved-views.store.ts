import { computed, signal } from '@angular/core';
import type {
  CreateSavedWorkViewRequest,
  ListSavedWorkViewsQuery,
  MemberDto,
  SavedWorkViewDto,
  SavedWorkViewScope,
  SavedWorkViewVisibility,
  UpdateSavedWorkViewRequest,
  WorkItemQuery
} from '@worktrail/contracts';
import { Subscription, take, type Observable } from 'rxjs';
import { extractApiErrorMessage } from '../../../core/api/api-error';
import {
  meaningfulWorkItemQueryFieldCount,
  routerLinkQueryParamsFromWorkItemQuery
} from '../query/work-item-query-serialization';

export interface SavedViewsGateway {
  listSavedWorkViews(query?: ListSavedWorkViewsQuery): Observable<SavedWorkViewDto[]>;
  createSavedWorkView(input: CreateSavedWorkViewRequest): Observable<SavedWorkViewDto>;
  updateSavedWorkView(savedViewId: string, input: UpdateSavedWorkViewRequest): Observable<SavedWorkViewDto>;
  deleteSavedWorkView(savedViewId: string): Observable<void>;
}
export interface SavedViewsStoreConfig {
  readonly scope: SavedWorkViewScope;
  readonly actor: () => MemberDto | null;
  readonly contextKey?: () => string;
  readonly appliedQuery?: () => WorkItemQuery;
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
  readonly pendingViewId = signal<string | null>(null);
  readonly createdRevision = signal(0);
  private readonly opened = signal<{
    id: string;
    definition: string;
  } | null>(null);
  readonly openedView = computed(() => this.views().find(view => view.id === this.opened()?.id && this.canRead(view)) ?? null);
  readonly manageableViewIds = computed(() => new Set(this.views().filter(view => this.canMutate(view)).map(view => view.id)));
  readonly viewState = computed(() => {
    const view = this.openedView();
    if (!view)
      return { kind: 'custom' as const, label: 'Custom', id: null };
    const named = this.opened()?.definition === savedViewQueryKey(this.config.appliedQuery?.() ?? {}, this.config.scope);
    return { kind: named ? 'named' as const : 'modified' as const, label: (named ? 'Named: ' : 'Modified: ') + view.name, id: view.id };
  });
  private loads = new Subscription();
  private writes = new Subscription();
  private generation = 0;
  private loadGeneration = 0;
  private destroyed = false;
  private nameBaselines = new Map<string, string>();
  readonly draftNames = signal<Record<string, string>>({});
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly mutationError = signal<string | null>(null);
  readonly personalViews = computed(() => this.sortViews(this.views().filter((savedView) => this.canRead(savedView) && savedView.visibility === 'personal')));
  readonly sharedViews = computed(() => this.sortViews(this.views().filter((savedView) => this.canRead(savedView) && savedView.visibility === 'workspace')));
  readonly pinnedPersonalViews = computed(() => this.personalViews().filter((savedView) => savedView.isPinned));
  readonly pinnedSharedViews = computed(() => this.sharedViews().filter((savedView) => savedView.isPinned));
  constructor(private readonly gateway: SavedViewsGateway, private readonly config: SavedViewsStoreConfig) { }
  load(): void {
    if (this.destroyed || this.isSaving())
      return;
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const current = this.capture();
    const load = ++this.loadGeneration;
    this.isLoading.set(true);
    this.loadError.set(null);
    this.loads.add(this.gateway.listSavedWorkViews(this.listQuery()).subscribe({
      next: views => {
        if (!current() || load !== this.loadGeneration)
          return;
        this.views.set(this.sortViews(views.filter(view => this.canRead(view))));
        this.syncDraftNames();
        if (!this.openedView())
          this.opened.set(null);
        this.isLoading.set(false);
      },
      error: () => {
        if (!current() || load !== this.loadGeneration)
          return;
        this.views.set([]);
        this.draftNames.set({});
        this.opened.set(null);
        this.nameBaselines.clear();
        this.loadError.set(this.config.loadErrorMessage ?? 'Saved views could not be loaded.');
        this.isLoading.set(false);
      }
    }));
  }
  create(name: string, visibility: SavedWorkViewVisibility, query: WorkItemQuery, onCreated?: () => void): void {
    if (!name.trim()) {
      this.mutationError.set('Saved view name is required.');
      return;
    }
    if (!this.canManageVisibility(visibility))
      return;
    this.mutate(null, () => this.gateway.createSavedWorkView({
      name: name.trim(), scope: this.config.scope,
      ...(this.config.scope === 'project' ? { projectId: this.config.projectId?.() } : {}),
      query, ...(visibility === 'workspace' ? { visibility } : {})
    }), view => {
      if (!this.canRead(view) || !this.hasPermission(visibility))
        return;
      this.views.set(this.sortViews([...this.views().filter(current => current.id !== view.id), view]));
      this.syncDraftNames(view.id);
      this.createdRevision.update(value => value + 1);
      onCreated?.();
    }, this.config.mutationErrorMessage ?? 'Saved view could not be created.');
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
  delete(view: SavedWorkViewDto): void {
    const accepted = this.acceptMutation(view);
    if (!accepted)
      return;
    this.mutate(view.id, () => this.gateway.deleteSavedWorkView(view.id), () => {
      if (!this.canMutate(accepted))
        return;
      this.views.set(this.views().filter(current => current.id !== view.id));
      this.syncDraftNames();
      if (this.opened()?.id === view.id)
        this.opened.set(null);
    }, 'Saved view could not be deleted.');
  }
  draftName(savedViewId: string): string {
    return this.draftNames()[savedViewId] ?? '';
  }
  setDraftName(id: string, name: string): void {
    if (this.views().some(view => view.id === id && this.canMutate(view)))
      this.draftNames.update(names => ({ ...names, [id]: name }));
  }
  queryLabel(savedView: SavedWorkViewDto): string {
    const count = meaningfulWorkItemQueryFieldCount(savedView.query, this.config.scope);
    if (count === 0) {
      return this.config.scope === 'workspace' ? 'Default workspace view' : 'Default project view';
    }
    return `${count} applied ${count === 1 ? 'filter' : 'filters'}`;
  }
  canMutate(view: SavedWorkViewDto): boolean { return this.canRead(view) && this.hasPermission(view.visibility); }
  private update(view: SavedWorkViewDto, input: UpdateSavedWorkViewRequest, fallback: string): void {
    const accepted = this.acceptMutation(view);
    if (!accepted)
      return;
    this.mutate(view.id, () => this.gateway.updateSavedWorkView(view.id, input), updated => {
      if (!this.canMutate(accepted) || !this.canRead(updated))
        return;
      this.replaceView(updated, input.name !== undefined);
      if (input.query && this.opened()?.id === view.id)
        this.opened.set({ id: view.id, definition: savedViewQueryKey(updated.query, this.config.scope) });
    }, fallback);
  }
  private canManageVisibility(visibility: SavedWorkViewVisibility): boolean {
    if (this.hasPermission(visibility))
      return true;
    this.mutationError.set(visibility === 'personal' ? this.config.personalDeniedMessage ?? 'Saved views are read-only.' :
      this.config.sharedDeniedMessage ?? 'Only owners and maintainers can manage shared saved views.');
    return false;
  }
  private listQuery(): ListSavedWorkViewsQuery {
    return {
      scope: this.config.scope,
      projectId: this.config.scope === 'project' ? this.config.projectId?.() : undefined
    };
  }
  private replaceView(savedView: SavedWorkViewDto, renamed = false): void {
    this.views.set(this.sortViews(this.views().map((current) => (current.id === savedView.id ? savedView : current))));
    this.syncDraftNames(renamed ? savedView.id : undefined);
  }
  private syncDraftNames(changedId?: string): void {
    const before = this.draftNames();
    this.draftNames.set(Object.fromEntries(this.views().map(view => {
      const unedited = before[view.id] === undefined || before[view.id] === this.nameBaselines.get(view.id);
      return [view.id, view.id === changedId || unedited ? view.name : before[view.id]];
    })));
    this.nameBaselines = new Map(this.views().map(view => [view.id, view.name]));
  }
  private sortViews(savedViews: SavedWorkViewDto[]): SavedWorkViewDto[] {
    return [...savedViews].sort((left, right) => left.name.localeCompare(right.name));
  }
  reset(): void {
    this.nameBaselines.clear();
    this.generation++;
    this.loadGeneration++;
    this.loads.unsubscribe();
    this.writes.unsubscribe();
    this.loads = new Subscription();
    this.writes = new Subscription();
    this.views.set([]);
    this.draftNames.set({});
    this.opened.set(null);
    this.isLoading.set(false);
    this.isSaving.set(false);
    this.pendingViewId.set(null);
    this.loadError.set(null);
    this.mutationError.set(null);
    this.createdRevision.set(0);
  }
  destroy(): void { this.destroyed = true; this.reset(); }
  open(view: SavedWorkViewDto): boolean {
    const accepted = this.views().find(current => current.id === view.id && this.canRead(current));
    if (!accepted || this.destroyed)
      return false;
    this.opened.set({ id: accepted.id, definition: savedViewQueryKey(accepted.query, this.config.scope) });
    return true;
  }
  canOpen(view: SavedWorkViewDto): boolean { return this.views().some(current => current.id === view.id && this.canRead(current)); }
  private canRead(view: SavedWorkViewDto): boolean {
    const actor = this.config.actor();
    return !!actor?.isActive && actor.workspaceId === view.workspaceId && view.scope === this.config.scope &&
      (view.scope === 'workspace' ? view.projectId === null : view.projectId === this.config.projectId?.()) &&
      (view.visibility === 'workspace' || view.owner.id === actor.id);
  }
  private hasPermission(visibility: SavedWorkViewVisibility): boolean {
    const actor = this.config.actor();
    if (!actor?.isActive)
      return false;
    return visibility === 'personal' ? this.config.canManagePersonalViews?.() ?? false :
      (actor.role === 'owner' || actor.role === 'maintainer') && (this.config.canManageSharedViews?.() ?? false);
  }
  private acceptMutation(view: SavedWorkViewDto): SavedWorkViewDto | null {
    const accepted = this.views().find(current => current.id === view.id && this.canRead(current));
    if (!accepted || !this.canMutate(accepted)) {
      if (accepted)
        this.canManageVisibility(accepted.visibility);
      else
        this.mutationError.set('Saved view is no longer available.');
      return null;
    }
    return accepted;
  }
  private key(): string {
    const actor = this.config.actor();
    return JSON.stringify([actor?.workspaceId, actor?.id, this.config.projectId?.(), this.config.contextKey?.()]);
  }
  private capture(): () => boolean {
    const key = this.key();
    const generation = this.generation;
    return () => !this.destroyed && generation === this.generation && key === this.key();
  }
  private mutate<T>(id: string | null, send: () => Observable<T>, accept: (result: T) => void, fallback: string): void {
    if (this.destroyed || this.isSaving())
      return;
    this.loads.unsubscribe();
    this.loadGeneration++;
    this.isLoading.set(false);
    const current = this.capture();
    this.isSaving.set(true);
    this.pendingViewId.set(id);
    this.mutationError.set(null);
    this.writes.add(send().pipe(take(1)).subscribe({
      next: result => {
        if (current()) {
          accept(result);
          this.isSaving.set(false);
          this.pendingViewId.set(null);
        }
      },
      error: error => {
        if (current()) {
          this.mutationError.set(extractApiErrorMessage(error, fallback));
          this.isSaving.set(false);
          this.pendingViewId.set(null);
        }
      }
    }));
  }
}

export function savedViewQueryKey(query: WorkItemQuery, scope: SavedWorkViewScope): string {
  return JSON.stringify(Object.entries(routerLinkQueryParamsFromWorkItemQuery(query, scope) ?? {}).sort(([a], [b]) => a.localeCompare(b)));
}
