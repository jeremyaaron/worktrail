import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CreateProjectCycleRequest, MemberDto, UpdateProjectCycleRequest } from '@worktrail/contracts';

import { CurrentUserService } from '../current-user.service';
import { CyclesApi } from './cycles-api';

describe('CyclesApi', () => {
  const workspaceId = '10000000-0000-4000-8000-000000000001';
  const projectId = '10000000-0000-4000-8000-000000000201';
  const cycleId = '10000000-0000-4000-8000-000000000701';
  const actor: MemberDto = {
    id: '10000000-0000-4000-8000-000000000101',
    workspaceId,
    name: 'Avery Owner',
    email: 'avery.owner@example.com',
    role: 'owner',
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-07-02T12:00:00.000Z',
    updatedAt: '2026-07-03T12:00:00.000Z'
  };

  let api: CyclesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    api = TestBed.inject(CyclesApi);
    http = TestBed.inject(HttpTestingController);

    const currentUser = TestBed.inject(CurrentUserService);
    currentUser.members.set([actor]);
    currentUser.selectMember(actor.id);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists cycles with optional filters', () => {
    api.listCycles(projectId, { includeArchived: true, status: 'active' }).subscribe();

    const request = http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/cycles`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('includeArchived')).toBe('true');
    expect(request.request.params.get('status')).toBe('active');
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(actor.id);
    expect(request.request.headers.get('x-worktrail-workspace-id')).toBe(workspaceId);
    request.flush([]);
  });

  it('creates, updates, archives, and reactivates project cycles', () => {
    const createInput: CreateProjectCycleRequest = {
      name: 'v0.2.1',
      goal: 'Plan and review cycle scope.',
      startDate: '2026-07-13',
      endDate: '2026-07-24',
      targetPoints: 20
    };
    const updateInput: UpdateProjectCycleRequest = {
      status: 'completed',
      targetPoints: null
    };

    api.createCycle(projectId, createInput).subscribe();
    const create = http.expectOne(`/api/projects/${projectId}/cycles`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(createInput);
    create.flush({});

    api.updateCycle(projectId, cycleId, updateInput).subscribe();
    const update = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual(updateInput);
    update.flush({});

    api.archiveCycle(projectId, cycleId).subscribe();
    const archive = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/archive`);
    expect(archive.request.method).toBe('POST');
    expect(archive.request.body).toEqual({});
    archive.flush({});

    api.reactivateCycle(projectId, cycleId).subscribe();
    const reactivate = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/reactivate`);
    expect(reactivate.request.method).toBe('POST');
    expect(reactivate.request.body).toEqual({});
    reactivate.flush({});
  });

  it('loads cycle detail and review endpoints', () => {
    api.getCycle(projectId, cycleId).subscribe();
    const detail = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}`);
    expect(detail.request.method).toBe('GET');
    detail.flush({});

    api.getCycleReview(projectId, cycleId).subscribe();
    const review = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/review`);
    expect(review.request.method).toBe('GET');
    review.flush({});
  });
});
