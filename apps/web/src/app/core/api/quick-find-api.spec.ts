import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MemberDto, QuickFindRequest, QuickFindResponseDto } from '@worktrail/contracts';

import { CurrentUserService } from '../current-user.service';
import { QuickFindApi } from './quick-find-api';

describe('QuickFindApi', () => {
  const actor: MemberDto = {
    id: '10000000-0000-4000-8000-000000000101',
    workspaceId: '10000000-0000-4000-8000-000000000001',
    name: 'Avery Owner',
    email: 'avery.owner@example.com',
    role: 'owner',
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-07-02T12:00:00.000Z',
    updatedAt: '2026-07-03T12:00:00.000Z'
  };
  const input: QuickFindRequest = { query: 'release evidence' };
  const response: QuickFindResponseDto = {
    query: input.query,
    groups: {
      workItems: { items: [], hasMore: false },
      projects: { items: [], hasMore: false },
      milestones: { items: [], hasMore: false },
      cycles: { items: [], hasMore: false },
      reports: { items: [], hasMore: false },
      attachments: { items: [], hasMore: false }
    }
  };

  let api: QuickFindApi;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    const currentUser = TestBed.inject(CurrentUserService);
    currentUser.members.set([actor]);
    currentUser.selectMember(actor.id);
    api = TestBed.inject(QuickFindApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('posts the query body with actor headers and no URL query text', () => {
    let actual: QuickFindResponseDto | undefined;

    api.search(input).subscribe((value) => {
      actual = value;
    });

    const search = http.expectOne('/api/quick-find');
    expect(search.request.method).toBe('POST');
    expect(search.request.urlWithParams).toBe('/api/quick-find');
    expect(search.request.params.keys()).toEqual([]);
    expect(search.request.body).toEqual(input);
    expect(search.request.headers.get('x-worktrail-member-id')).toBe(actor.id);
    expect(search.request.headers.get('x-worktrail-workspace-id')).toBe(actor.workspaceId);
    search.flush(response);

    expect(actual).toEqual(response);
  });

  it('does not memoize or replay a prior search response', () => {
    api.search(input).subscribe();
    const first = http.expectOne('/api/quick-find');
    first.flush(response);

    api.search(input).subscribe();
    const second = http.expectOne('/api/quick-find');
    expect(second.request.method).toBe('POST');
    expect(second.request.body).toEqual(input);
    second.flush(response);
  });
});
