import type {
  CreateSavedWorkViewRequest,
  ListSavedWorkViewsQuery,
  MemberDto,
  SavedWorkViewDto,
  UpdateSavedWorkViewRequest
} from '@worktrail/contracts';
import { of, throwError, type Observable } from 'rxjs';

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
    const store = new SavedViewsStore(gateway, { scope: 'workspace' });

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

  it('blocks shared mutations when the current member cannot manage shared views', () => {
    const gateway = new FakeSavedViewsGateway();
    const sharedView = savedViewFixture({
      id: 'shared',
      visibility: 'workspace',
      isPinned: false
    });
    gateway.savedViews = [sharedView];
    const store = new SavedViewsStore(gateway, {
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
    const store = new SavedViewsStore(gateway, { scope: 'workspace' });

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
    const store = new SavedViewsStore(gateway, { scope: 'workspace' });
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
