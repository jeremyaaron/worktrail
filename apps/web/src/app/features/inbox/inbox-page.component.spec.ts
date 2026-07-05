import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MemberDto, NotificationDto } from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { InboxPageComponent } from './inbox-page.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const owner: MemberDto = {
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
const maintainer: MemberDto = {
  id: '10000000-0000-4000-8000-000000000102',
  workspaceId,
  name: 'Morgan Maintainer',
  email: 'morgan.maintainer@example.com',
  role: 'maintainer',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const unreadNotification: NotificationDto = {
  id: '10000000-0000-4000-8000-000000000901',
  type: 'mention',
  summary: 'You were mentioned on WT-3.',
  actor: maintainer,
  project: {
    id: '10000000-0000-4000-8000-000000000201',
    key: 'WT',
    name: 'Worktrail App'
  },
  workItem: {
    id: '10000000-0000-4000-8000-000000000403',
    displayKey: 'WT-3',
    title: 'Implement transport-neutral API handler contract',
    status: 'in_progress'
  },
  metadata: { commentId: '10000000-0000-4000-8000-000000000502' },
  readAt: null,
  createdAt: '2026-07-05T12:00:00.000Z'
};
const readNotification: NotificationDto = {
  ...unreadNotification,
  id: '10000000-0000-4000-8000-000000000902',
  type: 'assignment',
  summary: 'WT-3 was assigned to you.',
  readAt: '2026-07-05T12:15:00.000Z'
};

function seedCurrentUser(): void {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([owner, maintainer]);
  currentUser.selectMember(owner.id);
}

function setup(): {
  fixture: ComponentFixture<InboxPageComponent>;
  http: HttpTestingController;
} {
  seedCurrentUser();
  const fixture = TestBed.createComponent(InboxPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne('/api/notifications/unread-count').flush({ unreadCount: 2 });
  return { fixture, http };
}

function expectNotificationListRequest(
  http: HttpTestingController,
  state: 'unread' | 'all'
) {
  const request = http.expectOne((candidate) => candidate.url === '/api/notifications');
  expect(request.request.method).toBe('GET');
  expect(request.request.params.get('state')).toBe(state);
  expect(request.request.headers.get('x-worktrail-member-id')).toBe(owner.id);
  return request;
}

describe('InboxPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [InboxPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('loads unread notifications and renders work item links', () => {
    const { fixture, http } = setup();
    expectNotificationListRequest(http, 'unread').flush({
      items: [unreadNotification],
      unreadCount: 1
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const workItemLink = compiled.querySelector<HTMLAnchorElement>('.work-item-link');

    expect(compiled.textContent).toContain('1 unread notification.');
    expect(compiled.textContent).toContain('Mention');
    expect(compiled.textContent).toContain('You were mentioned on WT-3.');
    expect(compiled.textContent).toContain('Morgan Maintainer');
    expect(workItemLink?.getAttribute('href')).toBe(
      `/work-items/${unreadNotification.workItem?.id}?returnUrl=%2Finbox`
    );
  });

  it('switches between unread and all notifications', () => {
    const { fixture, http } = setup();
    expectNotificationListRequest(http, 'unread').flush({
      items: [unreadNotification],
      unreadCount: 1
    });
    fixture.detectChanges();

    const allButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.view-tabs button')
    ).find((button) => button.textContent?.includes('All'));
    allButton?.click();
    fixture.detectChanges();

    expectNotificationListRequest(http, 'all').flush({
      items: [unreadNotification, readNotification],
      unreadCount: 1
    });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('You were mentioned on WT-3.');
    expect(text).toContain('WT-3 was assigned to you.');
    expect(text).toContain('Mark unread');
  });

  it('marks a single unread notification read and removes it from the unread view', () => {
    const { fixture, http } = setup();
    expectNotificationListRequest(http, 'unread').flush({
      items: [unreadNotification],
      unreadCount: 1
    });
    fixture.detectChanges();

    const readButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.notification-card__actions button'
      )
    ).find((button) => button.textContent?.includes('Mark read'));
    readButton?.click();
    fixture.detectChanges();

    const update = http.expectOne(`/api/notifications/${unreadNotification.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ read: true });
    update.flush({ ...unreadNotification, readAt: '2026-07-05T12:30:00.000Z' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No unread notifications');
    expect(text).toContain('No unread notifications.');
  });

  it('marks a read notification unread from the all view', () => {
    const { fixture, http } = setup();
    expectNotificationListRequest(http, 'unread').flush({ items: [], unreadCount: 0 });
    fixture.detectChanges();

    const allButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.view-tabs button')
    ).find((button) => button.textContent?.includes('All'));
    allButton?.click();
    fixture.detectChanges();

    expectNotificationListRequest(http, 'all').flush({
      items: [readNotification],
      unreadCount: 0
    });
    fixture.detectChanges();

    const unreadButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.notification-card__actions button'
      )
    ).find((button) => button.textContent?.includes('Mark unread'));
    unreadButton?.click();
    fixture.detectChanges();

    const update = http.expectOne(`/api/notifications/${readNotification.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ read: false });
    update.flush({ ...readNotification, readAt: null });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 unread notification.');
  });

  it('marks all unread notifications read', () => {
    const { fixture, http } = setup();
    expectNotificationListRequest(http, 'unread').flush({
      items: [unreadNotification],
      unreadCount: 1
    });
    fixture.detectChanges();

    const markAllButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.header-action'
    );
    markAllButton?.click();
    fixture.detectChanges();

    const request = http.expectOne('/api/notifications/mark-all-read');
    expect(request.request.method).toBe('POST');
    request.flush({ unreadCount: 0 });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No unread notifications');
    expect(text).toContain('No unread notifications.');
  });
});
