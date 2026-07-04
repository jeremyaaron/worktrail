import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { SavedWorkViewDto } from '@worktrail/contracts';

import { WorktrailApiService } from './worktrail-api.service';

describe('WorktrailApiService', () => {
  let api: WorktrailApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    api = TestBed.inject(WorktrailApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('requests My Work and project navigation summaries', () => {
    api.getMyWork().subscribe();
    const myWork = http.expectOne('/api/my-work');
    expect(myWork.request.method).toBe('GET');
    myWork.flush({ summaryCounts: [] });

    api.listProjectNavigationSummaries().subscribe();
    const summaries = http.expectOne('/api/projects/navigation-summary');
    expect(summaries.request.method).toBe('GET');
    summaries.flush([]);
  });

  it('sends workspace work item query params and skips blank params', () => {
    api
      .listWorkspaceWorkItems({
        workState: 'open',
        assigneeState: 'unassigned',
        blocked: false,
        archivedProjects: 'include',
        search: '  ',
        sort: 'priority_desc'
      })
      .subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/work-items');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('workState')).toBe('open');
    expect(request.request.params.get('assigneeState')).toBe('unassigned');
    expect(request.request.params.get('blocked')).toBe('false');
    expect(request.request.params.get('archivedProjects')).toBe('include');
    expect(request.request.params.get('sort')).toBe('priority_desc');
    expect(request.request.params.has('search')).toBeFalse();

    request.flush([]);
  });

  it('supports saved work view CRUD requests', () => {
    const savedView: SavedWorkViewDto = {
      id: '10000000-0000-4000-8000-000000000201',
      workspaceId: '10000000-0000-4000-8000-000000000001',
      owner: {
        id: '10000000-0000-4000-8000-000000000101',
        workspaceId: '10000000-0000-4000-8000-000000000001',
        name: 'Avery Owner',
        email: 'avery.owner@example.com',
        role: 'owner',
        isActive: true,
        deactivatedAt: null,
        createdAt: '2026-07-02T12:00:00.000Z',
        updatedAt: '2026-07-03T12:00:00.000Z'
      },
      name: 'Open bugs',
      visibility: 'personal',
      query: { type: 'bug', workState: 'open' },
      createdAt: '2026-07-04T12:00:00.000Z',
      updatedAt: '2026-07-04T12:00:00.000Z'
    };

    api.listSavedWorkViews().subscribe();
    const list = http.expectOne('/api/saved-work-views');
    expect(list.request.method).toBe('GET');
    list.flush([savedView]);

    api
      .createSavedWorkView({ name: 'Open bugs', query: { type: 'bug', workState: 'open' } })
      .subscribe();
    const create = http.expectOne('/api/saved-work-views');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Open bugs', query: { type: 'bug', workState: 'open' } });
    create.flush(savedView);

    api.updateSavedWorkView(savedView.id, { name: 'Open work' }).subscribe();
    const update = http.expectOne(`/api/saved-work-views/${savedView.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ name: 'Open work' });
    update.flush({ ...savedView, name: 'Open work' });

    api.deleteSavedWorkView(savedView.id).subscribe();
    const remove = http.expectOne(`/api/saved-work-views/${savedView.id}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
});
