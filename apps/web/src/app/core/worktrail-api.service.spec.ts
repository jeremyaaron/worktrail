import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { BulkUpdateWorkItemsRequest, MemberDto, SavedWorkViewDto } from '@worktrail/contracts';

import { CurrentUserService } from './current-user.service';
import { WorktrailApiService } from './worktrail-api.service';

describe('WorktrailApiService', () => {
  let api: WorktrailApiService;
  let http: HttpTestingController;
  let currentUser: CurrentUserService;

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

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    api = TestBed.inject(WorktrailApiService);
    http = TestBed.inject(HttpTestingController);
    currentUser = TestBed.inject(CurrentUserService);
    currentUser.members.set([actor]);
    currentUser.selectMember(actor.id);
  });

  afterEach(() => {
    http.verify();
  });

  it('requests My Work and project navigation summaries', () => {
    api.getMyWork().subscribe();
    const myWork = http.expectOne('/api/my-work');
    expect(myWork.request.method).toBe('GET');
    expect(myWork.request.headers.get('x-worktrail-member-id')).toBe(actor.id);
    expect(myWork.request.headers.get('x-worktrail-workspace-id')).toBe(actor.workspaceId);
    myWork.flush({ summaryCounts: [] });

    api.listProjectNavigationSummaries().subscribe();
    const summaries = http.expectOne('/api/projects/navigation-summary');
    expect(summaries.request.method).toBe('GET');
    summaries.flush([]);
  });

  it('supports project status report requests', () => {
    const projectId = '10000000-0000-4000-8000-000000000201';
    const reportId = '10000000-0000-4000-8000-000000000901';
    const publishInput = {
      title: 'Weekly status',
      statusDate: '2026-07-10',
      summary: 'Delivery remains on track.',
      highlights: 'Planning is complete.',
      risks: '',
      nextSteps: 'Publish the report.'
    };

    api.listProjectStatusReports(projectId).subscribe();
    const list = http.expectOne(`/api/projects/${projectId}/status-reports`);
    expect(list.request.method).toBe('GET');
    list.flush([]);

    api.getProjectStatusReportDraft(projectId).subscribe();
    const draft = http.expectOne(`/api/projects/${projectId}/status-reports/draft`);
    expect(draft.request.method).toBe('GET');
    draft.flush({});

    api.publishProjectStatusReport(projectId, publishInput).subscribe();
    const publish = http.expectOne(`/api/projects/${projectId}/status-reports`);
    expect(publish.request.method).toBe('POST');
    expect(publish.request.body).toEqual(publishInput);
    expect(publish.request.headers.get('x-worktrail-member-id')).toBe(actor.id);
    publish.flush({});

    api.getProjectStatusReport(projectId, reportId).subscribe();
    const detail = http.expectOne(`/api/projects/${projectId}/status-reports/${reportId}`);
    expect(detail.request.method).toBe('GET');
    detail.flush({});

    api.exportProjectStatusReportMarkdown(projectId, reportId).subscribe();
    const exportRequest = http.expectOne(
      `/api/projects/${projectId}/status-reports/${reportId}/export.md`
    );
    expect(exportRequest.request.method).toBe('GET');
    expect(exportRequest.request.responseType).toBe('blob');
    expect(exportRequest.request.headers.get('x-worktrail-member-id')).toBe(actor.id);
    exportRequest.flush(new Blob(['# Weekly status\n'], { type: 'text/markdown' }));
  });

  it('sends workspace work item query params and skips blank params', () => {
    api
      .listWorkspaceWorkItems({
        workState: 'open',
        assigneeState: 'unassigned',
        blocked: false,
        dependency: 'dependency_blocked',
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
    expect(request.request.params.get('dependency')).toBe('dependency_blocked');
    expect(request.request.params.get('archivedProjects')).toBe('include');
    expect(request.request.params.get('sort')).toBe('priority_desc');
    expect(request.request.params.has('search')).toBeFalse();

    request.flush([]);
  });

  it('sends saved work view list scope params and skips blank params', () => {
    const projectId = '10000000-0000-4000-8000-000000000201';

    api.listSavedWorkViews({ scope: 'project', projectId }).subscribe();

    const projectRequest = http.expectOne((candidate) => candidate.url === '/api/saved-work-views');
    expect(projectRequest.request.method).toBe('GET');
    expect(projectRequest.request.params.get('scope')).toBe('project');
    expect(projectRequest.request.params.get('projectId')).toBe(projectId);
    projectRequest.flush([]);

    api.listSavedWorkViews({ scope: 'workspace' }).subscribe();

    const workspaceRequest = http.expectOne((candidate) => candidate.url === '/api/saved-work-views');
    expect(workspaceRequest.request.method).toBe('GET');
    expect(workspaceRequest.request.params.get('scope')).toBe('workspace');
    expect(workspaceRequest.request.params.has('projectId')).toBeFalse();
    workspaceRequest.flush([]);
  });

  it('previews and applies work item CSV imports', () => {
    const projectId = '10000000-0000-4000-8000-000000000201';
    const csv = 'title,type,priority\nImported task,task,medium\n';

    api.previewWorkItemCsvImport(projectId, csv).subscribe();
    const preview = http.expectOne(`/api/projects/${projectId}/work-items/imports/preview`);
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual({ csv });
    expect(preview.request.headers.get('x-worktrail-member-id')).toBe(actor.id);
    preview.flush({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      errors: [],
      warnings: [],
      rows: []
    });

    api.applyWorkItemCsvImport(projectId, csv).subscribe();
    const apply = http.expectOne(`/api/projects/${projectId}/work-items/imports`);
    expect(apply.request.method).toBe('POST');
    expect(apply.request.body).toEqual({ csv });
    expect(apply.request.headers.get('x-worktrail-workspace-id')).toBe(actor.workspaceId);
    apply.flush({ createdCount: 0, workItems: [] });
  });

  it('posts project bulk work item updates', () => {
    const projectId = '10000000-0000-4000-8000-000000000201';
    const workItemId = '10000000-0000-4000-8000-000000000401';
    const input: BulkUpdateWorkItemsRequest = {
      workItemIds: [workItemId],
      action: {
        type: 'set_priority',
        priority: 'urgent'
      }
    };

    api.bulkUpdateProjectWorkItems(projectId, input).subscribe();

    const request = http.expectOne(`/api/projects/${projectId}/work-items/bulk-update`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(actor.id);
    expect(request.request.headers.get('x-worktrail-workspace-id')).toBe(actor.workspaceId);
    request.flush({
      requestedCount: 1,
      succeededCount: 1,
      unchangedCount: 0,
      failedCount: 0,
      results: [
        {
          workItemId,
          displayKey: 'WT-1',
          status: 'updated',
          workItem: null,
          error: null
        }
      ]
    });
  });

  it('exports project work items with filters as a blob response', () => {
    const projectId = '10000000-0000-4000-8000-000000000201';

    api
      .exportProjectWorkItems(projectId, {
        status: 'ready',
        dependency: 'blocking_open_work',
        labelId: '10000000-0000-4000-8000-000000000301',
        search: '  ',
        sort: 'priority_desc'
      })
      .subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === `/api/projects/${projectId}/work-items/export`
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.params.get('status')).toBe('ready');
    expect(request.request.params.get('dependency')).toBe('blocking_open_work');
    expect(request.request.params.get('labelId')).toBe('10000000-0000-4000-8000-000000000301');
    expect(request.request.params.get('sort')).toBe('priority_desc');
    expect(request.request.params.has('search')).toBeFalse();
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(actor.id);
    request.flush(new Blob(['project_key\n'], { type: 'text/csv' }));
  });

  it('exports workspace work items with query params as a blob response', () => {
    api
      .exportWorkspaceWorkItems({
        workState: 'open',
        assigneeState: 'unassigned',
        blocked: false,
        dependency: 'dependency_blocked',
        archivedProjects: 'include',
        search: 'import',
        sort: 'updated_desc'
      })
      .subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/work-items/export');

    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.params.get('workState')).toBe('open');
    expect(request.request.params.get('assigneeState')).toBe('unassigned');
    expect(request.request.params.get('blocked')).toBe('false');
    expect(request.request.params.get('dependency')).toBe('dependency_blocked');
    expect(request.request.params.get('archivedProjects')).toBe('include');
    expect(request.request.params.get('search')).toBe('import');
    expect(request.request.params.get('sort')).toBe('updated_desc');
    expect(request.request.headers.get('x-worktrail-workspace-id')).toBe(actor.workspaceId);
    request.flush(new Blob(['project_key\n'], { type: 'text/csv' }));
  });

  it('supports work item relationship requests', () => {
    const workItemId = '10000000-0000-4000-8000-000000000401';
    const targetWorkItemId = '10000000-0000-4000-8000-000000000402';
    const relationshipId = '10000000-0000-4000-8000-000000000801';

    api.listWorkItemRelationships(workItemId).subscribe();
    const list = http.expectOne(`/api/work-items/${workItemId}/relationships`);
    expect(list.request.method).toBe('GET');
    list.flush({
      blockedBy: [],
      blocks: [],
      related: [],
      dependencyBlocked: false,
      openBlockerCount: 0,
      openBlockedWorkCount: 0
    });

    api
      .createWorkItemRelationship(workItemId, {
        relationshipType: 'blocks',
        targetWorkItemId
      })
      .subscribe();
    const create = http.expectOne(`/api/work-items/${workItemId}/relationships`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      relationshipType: 'blocks',
      targetWorkItemId
    });
    create.flush({});

    api.deleteWorkItemRelationship(workItemId, relationshipId).subscribe();
    const remove = http.expectOne(`/api/work-items/${workItemId}/relationships/${relationshipId}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('supports work item watcher requests', () => {
    const workItemId = '10000000-0000-4000-8000-000000000401';
    const watchState = {
      isWatchedByCurrentActor: true,
      watcherCount: 1,
      watchers: [
        {
          id: '10000000-0000-4000-8000-000000000901',
          member: actor,
          watchedAt: '2026-07-05T12:00:00.000Z'
        }
      ]
    };

    api.getWorkItemWatchState(workItemId).subscribe();
    const getState = http.expectOne(`/api/work-items/${workItemId}/watchers`);
    expect(getState.request.method).toBe('GET');
    getState.flush(watchState);

    api.watchWorkItem(workItemId).subscribe();
    const watch = http.expectOne(`/api/work-items/${workItemId}/watch`);
    expect(watch.request.method).toBe('PUT');
    expect(watch.request.body).toEqual({});
    watch.flush(watchState);

    api.unwatchWorkItem(workItemId).subscribe();
    const unwatch = http.expectOne(`/api/work-items/${workItemId}/watch`);
    expect(unwatch.request.method).toBe('DELETE');
    unwatch.flush({ ...watchState, isWatchedByCurrentActor: false });
  });

  it('supports notification inbox requests', () => {
    const notificationId = '10000000-0000-4000-8000-000000000901';

    api.listNotifications('all').subscribe();
    const list = http.expectOne((candidate) => candidate.url === '/api/notifications');
    expect(list.request.method).toBe('GET');
    expect(list.request.params.get('state')).toBe('all');
    list.flush({ items: [], unreadCount: 2 });

    api.getNotificationUnreadCount().subscribe();
    const count = http.expectOne('/api/notifications/unread-count');
    expect(count.request.method).toBe('GET');
    count.flush({ unreadCount: 2 });

    api.updateNotificationReadState(notificationId, { read: true }).subscribe();
    const update = http.expectOne(`/api/notifications/${notificationId}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ read: true });
    update.flush({});

    api.markAllNotificationsRead().subscribe();
    const markAllRead = http.expectOne('/api/notifications/mark-all-read');
    expect(markAllRead.request.method).toBe('POST');
    expect(markAllRead.request.body).toEqual({});
    markAllRead.flush({ unreadCount: 0 });
  });

  it('sends comment mention member ids when creating comments', () => {
    const workItemId = '10000000-0000-4000-8000-000000000401';
    const mentionMemberIds = ['10000000-0000-4000-8000-000000000102'];

    api.createComment(workItemId, { body: 'Please review this.', mentionMemberIds }).subscribe();

    const request = http.expectOne(`/api/work-items/${workItemId}/comments`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ body: 'Please review this.', mentionMemberIds });
    request.flush({});
  });

  it('supports saved work view CRUD requests', () => {
    const savedView: SavedWorkViewDto = {
      id: '10000000-0000-4000-8000-000000000201',
      workspaceId: '10000000-0000-4000-8000-000000000001',
      projectId: null,
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
      scope: 'workspace',
      visibility: 'personal',
      isPinned: false,
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

    api
      .createSavedWorkView({
        name: 'Shared open bugs',
        visibility: 'workspace',
        query: { type: 'bug', workState: 'open' }
      })
      .subscribe();
    const createShared = http.expectOne('/api/saved-work-views');
    expect(createShared.request.method).toBe('POST');
    expect(createShared.request.body).toEqual({
      name: 'Shared open bugs',
      visibility: 'workspace',
      query: { type: 'bug', workState: 'open' }
    });
    createShared.flush({ ...savedView, visibility: 'workspace', name: 'Shared open bugs' });

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
