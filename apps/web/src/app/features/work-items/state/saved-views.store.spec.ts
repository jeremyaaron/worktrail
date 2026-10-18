import { signal } from '@angular/core';
import type {
  CreateSavedWorkViewRequest,
  ListSavedWorkViewsQuery,
  MemberDto,
  SavedWorkViewDto,
  UpdateSavedWorkViewRequest,
  WorkItemQuery
} from '@worktrail/contracts';
import { Subject, of, throwError, type Observable } from 'rxjs';

import { SavedViewsStore, type SavedViewsGateway } from './saved-views.store';

class FakeSavedViewsGateway implements SavedViewsGateway {
  savedViews: SavedWorkViewDto[] = [];
  listQueries: ListSavedWorkViewsQuery[] = [];
  createRequests: CreateSavedWorkViewRequest[] = [];
  updateRequests: Array<{ id: string; input: UpdateSavedWorkViewRequest }> = [];
  deleteRequests: string[] = [];
  failList = false;

  listSavedWorkViews(query: ListSavedWorkViewsQuery = {}): Observable<SavedWorkViewDto[]> {
    this.listQueries.push(query);

    if (this.failList) {
      return throwError(() => new Error('failed'));
    }

    return of(this.savedViews);
  }

  createSavedWorkView(input: CreateSavedWorkViewRequest): Observable<SavedWorkViewDto> {
    this.createRequests.push(input);
    const savedView = savedViewFixture({
      id: `view-${this.createRequests.length}`,
      name: input.name,
      scope: input.scope ?? 'workspace',
      projectId: input.projectId ?? null,
      visibility: input.visibility ?? 'personal',
      query: input.query
    });
    this.savedViews = [...this.savedViews, savedView];
    return of(savedView);
  }

  updateSavedWorkView(
    savedViewId: string,
    input: UpdateSavedWorkViewRequest
  ): Observable<SavedWorkViewDto> {
    this.updateRequests.push({ id: savedViewId, input });
    const current = this.savedViews.find((savedView) => savedView.id === savedViewId);
    const updated = {
      ...(current ?? savedViewFixture({ id: savedViewId })),
      ...input
    };
    this.savedViews = this.savedViews.map((savedView) =>
      savedView.id === savedViewId ? updated : savedView
    );
    return of(updated);
  }

  deleteSavedWorkView(savedViewId: string): Observable<void> {
    this.deleteRequests.push(savedViewId);
    this.savedViews = this.savedViews.filter((savedView) => savedView.id !== savedViewId);
    return of(undefined);
  }
}

describe('SavedViewsStore', () => {
  it('denies writes by default and excludes foreign personal, workspace and project views', () => {
    const gateway = new FakeSavedViewsGateway();
    const own = savedViewFixture();
    gateway.savedViews = [own, savedViewFixture({ id: 'foreign-owner', owner: { ...memberFixture(), id: 'other' } }),
      savedViewFixture({ id: 'foreign-workspace', workspaceId: 'other' }), savedViewFixture({ id: 'project', scope: 'project', projectId: 'project-1' })];
    const store = new SavedViewsStore(gateway, { scope: 'workspace', actor: () => memberFixture() });
    store.load();
    expect(store.personalViews().map(view => view.id)).toEqual([own.id]);
    expect(store.canMutate(own)).toBeFalse();
    store.rename(own, 'Denied');
    expect(gateway.updateRequests).toEqual([]);
    expect(store.open(gateway.savedViews[1])).toBeFalse();
  });

  it('keeps explicit identity and canonical Named/Modified/Custom state separate from pending forms and paging', () => {
    const gateway = new FakeSavedViewsGateway();
    const query = signal<WorkItemQuery>({ status: 'ready' });
    const first = savedViewFixture({ query: { status: 'ready', sort: 'updated_desc' } });
    gateway.savedViews = [first, savedViewFixture({ id: 'equal-query', name: 'Other', query: { status: 'ready' } })];
    const store = new SavedViewsStore(gateway, { scope: 'workspace', actor: () => memberFixture(), appliedQuery: query, canManagePersonalViews: () => true });
    store.load();
    expect(store.viewState().kind).toBe('custom');
    store.open(first);
    expect(store.viewState()).toEqual({ kind: 'named', label: 'Named: My view', id: first.id });
    query.set({ status: 'blocked' });
    expect(store.viewState().kind).toBe('modified');
    store.updateQuery(first, query());
    expect(store.viewState().kind).toBe('named');
    store.rename(first, 'Renamed');
    expect(store.viewState().label).toBe('Named: Renamed');
    store.setPinned(first, true);
    expect(store.openedView()?.id).toBe(first.id);
    store.delete(first);
    expect(store.viewState().kind).toBe('custom');
  });

  for (const operation of ['create', 'rename', 'query', 'pin', 'delete'] as const) {
    it('guards late ' + operation + ' completion through reset, A/B/A and destruction', () => {
      const gateway = new FakeSavedViewsGateway();
      const view = savedViewFixture();
      gateway.savedViews = [view];
      const actor = signal<MemberDto | null>(memberFixture());
      const store = new SavedViewsStore(gateway, { scope: 'workspace', actor, canManagePersonalViews: () => true });
      store.load(); store.open(view);
      const completion = new Subject<SavedWorkViewDto>();
      const deletion = new Subject<void>();
      spyOn(gateway, 'createSavedWorkView').and.returnValue(completion);
      spyOn(gateway, 'updateSavedWorkView').and.returnValue(completion);
      spyOn(gateway, 'deleteSavedWorkView').and.returnValue(deletion);
      if (operation === 'create') store.create('New', 'personal', {});
      if (operation === 'rename') store.rename(view, 'New');
      if (operation === 'query') store.updateQuery(view, { status: 'ready' });
      if (operation === 'pin') store.setPinned(view, true);
      if (operation === 'delete') store.delete(view);
      expect(store.isSaving()).toBeTrue();
      actor.set({ ...memberFixture(), id: 'other' }); store.reset(); actor.set(memberFixture());
      completion.next({ ...view, name: 'Obsolete' }); deletion.next();
      expect(store.views()).toEqual([]);
      expect(store.viewState().kind).toBe('custom');
      expect(store.isSaving()).toBeFalse();
      expect(completion.observed || deletion.observed).toBeFalse();
      store.destroy(); store.load();
      expect(store.views()).toEqual([]);
    });
  }

  it('cancels superseded reads and prevents an older load from replacing a successful mutation', () => {
    const gateway = new FakeSavedViewsGateway();
    const first = new Subject<SavedWorkViewDto[]>();
    const second = new Subject<SavedWorkViewDto[]>();
    spyOn(gateway, 'listSavedWorkViews').and.returnValues(first, second);
    const store = new SavedViewsStore(gateway, { scope: 'workspace', actor: () => memberFixture(), canManagePersonalViews: () => true });
    store.load(); store.load();
    expect(first.observed).toBeFalse();
    first.next([savedViewFixture({ name: 'Old' })]);
    second.next([savedViewFixture()]);
    gateway.savedViews = [savedViewFixture()];
    store.rename(savedViewFixture(), 'Accepted');
    second.next([savedViewFixture({ name: 'Stale' })]);
    expect(store.views()[0].name).toBe('Accepted');
    expect(second.observed).toBeFalse();
  });

  it('serializes pending actions, retains failed rename drafts and preserves unrelated rename drafts', () => {
    const gateway = new FakeSavedViewsGateway();
    const view = savedViewFixture();
    const other = savedViewFixture({ id: 'other', name: 'Other' });
    gateway.savedViews = [view, other];
    const store = new SavedViewsStore(gateway, { scope: 'workspace', actor: () => memberFixture(), canManagePersonalViews: () => true });
    store.load(); store.open(view);
    store.setDraftName(view.id, 'Retry name'); store.setDraftName(other.id, 'Keep other draft');
    const response = new Subject<SavedWorkViewDto>();
    const update = spyOn(gateway, 'updateSavedWorkView').and.returnValue(response);
    store.rename(view, 'Retry name'); store.setPinned(view, true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(store.pendingViewId()).toBe(view.id);
    response.error({ error: { error: { message: 'Expected failure' } } });
    expect(store.isSaving()).toBeFalse();
    expect(store.mutationError()).toBe('Expected failure');
    expect(store.draftName(view.id)).toBe('Retry name');
    update.and.returnValue(of({ ...view, name: 'Accepted' }));
    store.rename(view, 'Accepted');
    expect(store.draftName(other.id)).toBe('Keep other draft');
    expect(store.openedView()?.id).toBe(view.id);
  });

  it('clears inaccessible selection on reload and stops exposing data when actor permission is lost', () => {
    const gateway = new FakeSavedViewsGateway();
    const view = savedViewFixture(); gateway.savedViews = [view];
    const actor = signal<MemberDto | null>(memberFixture());
    const store = new SavedViewsStore(gateway, { scope: 'workspace', actor, canManagePersonalViews: () => true });
    store.load(); store.open(view);
    actor.set({ ...memberFixture(), isActive: false });
    expect(store.personalViews()).toEqual([]);
    expect(store.viewState().kind).toBe('custom');
    actor.set(memberFixture()); gateway.savedViews = []; store.load();
    expect(store.openedView()).toBeNull();
  });

  it('invalidates project changes and denied late shared writes without replacing current state', () => {
    const gateway = new FakeSavedViewsGateway();
    const project = signal('project-1');
    const actor = signal(memberFixture());
    const view = savedViewFixture({ scope: 'project', projectId: 'project-1', visibility: 'workspace' });
    gateway.savedViews = [view];
    const store = new SavedViewsStore(gateway, {
scope: 'project', projectId: project, actor,
      canManageSharedViews: () => true, canManagePersonalViews: () => true
});
    store.load(); store.open(view);
    const write = new Subject<SavedWorkViewDto>();
    spyOn(gateway, 'updateSavedWorkView').and.returnValue(write);
    store.rename(view, 'Denied');
    actor.set({ ...memberFixture(), role: 'contributor' });
    write.next({ ...view, name: 'Denied' });
    expect(store.views()[0].name).toBe(view.name);
    expect(store.isSaving()).toBeFalse();
    project.set('project-2'); store.reset();
    gateway.savedViews = [{ ...view, id: 'new', projectId: 'project-2' }]; store.load();
    write.next({ ...view, name: 'Old project' });
    expect(store.views()[0].id).toBe('new');
    expect(store.viewState().kind).toBe('custom');
    store.destroy();
  });

  it('preserves a rename draft through pin/query changes while accepting fresh unedited names', () => {
    const gateway = new FakeSavedViewsGateway();
    const view = savedViewFixture(); gateway.savedViews = [view];
    const store = new SavedViewsStore(gateway, { scope: 'workspace', actor: () => memberFixture(), canManagePersonalViews: () => true });
    store.load(); store.setDraftName(view.id, 'Unsaved name');
    store.setPinned(view, true); store.updateQuery(view, { status: 'ready' });
    expect(store.draftName(view.id)).toBe('Unsaved name');
    store.rename(view, 'Accepted');
    gateway.savedViews = [{ ...view, name: 'Remote rename' }]; store.load();
    expect(store.draftName(view.id)).toBe('Remote rename');
  });
  it('loads sorted workspace views and derives pinned shortcuts by visibility', () => {
    const gateway = new FakeSavedViewsGateway();
    gateway.savedViews = [
      savedViewFixture({
        id: 'shared-b',
        name: 'Zebra',
        visibility: 'workspace',
        isPinned: true
      }),
      savedViewFixture({
        id: 'personal-a',
        name: 'Alpha',
        visibility: 'personal',
        isPinned: true
      }),
      savedViewFixture({
        id: 'shared-a',
        name: 'Beta',
        visibility: 'workspace'
      })
    ];
    const store = new SavedViewsStore(gateway, {
      actor: () => memberFixture(),
      canManagePersonalViews: () => true,
      canManageSharedViews: () => true,
      scope: 'workspace'
    });

    store.load();

    expect(gateway.listQueries).toEqual([{ scope: 'workspace', projectId: undefined }]);
    expect(store.personalViews().map((view) => view.name)).toEqual(['Alpha']);
    expect(store.sharedViews().map((view) => view.name)).toEqual(['Beta', 'Zebra']);
    expect(store.pinnedPersonalViews().map((view) => view.id)).toEqual(['personal-a']);
    expect(store.pinnedSharedViews().map((view) => view.id)).toEqual(['shared-b']);
    expect(store.draftName('shared-b')).toBe('Zebra');
  });

  it('creates project saved views with scope and current query', () => {
    const gateway = new FakeSavedViewsGateway();
    const store = new SavedViewsStore(gateway, {
      actor: () => memberFixture(),
      scope: 'project',
      projectId: () => 'project-1',
      canManagePersonalViews: () => true,
      canManageSharedViews: () => true
    });

    store.create(' Blocked bugs ', 'workspace', {
      status: 'blocked',
      type: 'bug'
    });

    expect(gateway.createRequests).toEqual([
      {
        name: 'Blocked bugs',
        scope: 'project',
        projectId: 'project-1',
        visibility: 'workspace',
        query: {
          status: 'blocked',
          type: 'bug'
        }
      }
    ]);
    expect(store.sharedViews().map((view) => view.name)).toEqual(['Blocked bugs']);
    expect(store.isSaving()).toBeFalse();
  });

  it('preserves hierarchy queries across personal, shared, and pinned saved views', () => {
    const gateway = new FakeSavedViewsGateway();
    const store = new SavedViewsStore(gateway, {
      actor: () => memberFixture(),
      canManagePersonalViews: () => true,
      scope: 'workspace',
      canManageSharedViews: () => true
    });

    store.create('Child work', 'personal', { hierarchy: 'children' });
    store.create('Parent drill-down', 'workspace', { parentKey: 'WT-42' });
    const shared = store.sharedViews()[0]!;
    store.setPinned(shared, true);

    expect(gateway.createRequests.map((request) => request.query)).toEqual([
      { hierarchy: 'children' },
      { parentKey: 'WT-42' }
    ]);
    expect(gateway.updateRequests).toEqual([{ id: shared.id, input: { isPinned: true } }]);
    expect(store.pinnedSharedViews()[0]?.query).toEqual({ parentKey: 'WT-42' });
    expect(store.queryLabel(store.personalViews()[0]!)).toBe('1 applied filter');
    expect(store.queryLabel(store.pinnedSharedViews()[0]!)).toBe('1 applied filter');
  });

  it('blocks shared mutations when the current member cannot manage shared views', () => {
    const gateway = new FakeSavedViewsGateway();
    const sharedView = savedViewFixture({
      id: 'shared',
      visibility: 'workspace',
      isPinned: false
    });
    gateway.savedViews = [sharedView];
    const store = new SavedViewsStore(gateway, {
      actor: () => memberFixture(),
      canManagePersonalViews: () => true,
      scope: 'workspace',
      canManageSharedViews: () => false
    });

    store.load();
    store.setPinned(sharedView, true);

    expect(gateway.updateRequests).toEqual([]);
    expect(store.mutationError()).toBe('Only owners and maintainers can manage shared saved views.');
  });

  it('updates draft names and removes deleted views', () => {
    const gateway = new FakeSavedViewsGateway();
    const view = savedViewFixture({ id: 'view-1', name: 'Mine' });
    gateway.savedViews = [view];
    const store = new SavedViewsStore(gateway, {
      actor: () => memberFixture(),
      canManagePersonalViews: () => true,
      canManageSharedViews: () => true,
      scope: 'workspace'
    });

    store.load();
    store.setDraftName(view.id, 'Renamed');
    store.rename(view, store.draftName(view.id));
    store.delete({ ...view, name: 'Renamed' });

    expect(gateway.updateRequests).toEqual([{ id: 'view-1', input: { name: 'Renamed' } }]);
    expect(gateway.deleteRequests).toEqual(['view-1']);
    expect(store.views()).toEqual([]);
    expect(store.draftNames()).toEqual({});
  });

  it('reports load failure and clears stale saved views', () => {
    const gateway = new FakeSavedViewsGateway();
    gateway.savedViews = [savedViewFixture()];
    const store = new SavedViewsStore(gateway, {
      actor: () => memberFixture(),
      canManagePersonalViews: () => true,
      canManageSharedViews: () => true,
      scope: 'workspace'
    });
    store.load();
    gateway.failList = true;

    store.load();

    expect(store.views()).toEqual([]);
    expect(store.loadError()).toBe('Saved views could not be loaded.');
    expect(store.isLoading()).toBeFalse();
  });
});

function savedViewFixture(overrides: Partial<SavedWorkViewDto> = {}): SavedWorkViewDto {
  return {
    id: 'view-1',
    workspaceId: 'workspace-1',
    projectId: null,
    owner: memberFixture(),
    name: 'My view',
    scope: 'workspace',
    visibility: 'personal',
    isPinned: false,
    query: {},
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z',
    ...overrides
  };
}

function memberFixture(): MemberDto {
  return {
    id: 'member-1',
    workspaceId: 'workspace-1',
    name: 'Avery Owner',
    email: 'avery@example.com',
    role: 'owner',
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z'
  };
}
