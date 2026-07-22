import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MemberDto } from '@worktrail/contracts';

import { CurrentUserService } from '../current-user.service';
import { AttachmentsApi } from './attachments-api';

describe('AttachmentsApi', () => {
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
  const workItemId = '10000000-0000-4000-8000-000000000401';
  const attachmentId = '10000000-0000-4000-8000-000000000801';
  let api: AttachmentsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    const currentUser = TestBed.inject(CurrentUserService);
    currentUser.members.set([actor]);
    currentUser.selectMember(actor.id);
    api = TestBed.inject(AttachmentsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists work item attachment metadata with actor headers', () => {
    api.listWorkItemAttachments(workItemId).subscribe();

    const list = http.expectOne(`/api/work-items/${workItemId}/attachments`);
    expect(list.request.method).toBe('GET');
    expect(list.request.headers.get('x-worktrail-member-id')).toBe(actor.id);
    expect(list.request.headers.get('x-worktrail-workspace-id')).toBe(actor.workspaceId);
    list.flush({ items: [], policy: {}, usage: {}, permissions: { canUpload: true } });
  });

  it('uploads raw bytes with encoded metadata and progress events', () => {
    const events: number[] = [];
    const file = new File(['attachment evidence'], 'résumé Q3.txt');

    api.uploadWorkItemAttachment(workItemId, file, 'text/plain').subscribe((event) => {
      events.push(event.type);
    });

    const upload = http.expectOne(`/api/work-items/${workItemId}/attachments`);
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body).toBe(file);
    expect(upload.request.reportProgress).toBeTrue();
    expect(upload.request.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(upload.request.headers.get('X-Worktrail-Filename')).toBe(encodeURIComponent(file.name));
    expect(upload.request.headers.get('X-Worktrail-Media-Type')).toBe('text/plain');
    upload.event({ type: HttpEventType.UploadProgress, loaded: 4, total: file.size });
    upload.flush({ id: attachmentId });

    expect(events).toContain(HttpEventType.UploadProgress);
    expect(events).toContain(HttpEventType.Response);
  });

  it('prefers the file media type when the browser provides one', () => {
    const file = new File(['{}'], 'evidence.json', { type: 'application/json' });

    api.uploadWorkItemAttachment(workItemId, file, 'text/plain').subscribe();

    const upload = http.expectOne(`/api/work-items/${workItemId}/attachments`);
    expect(upload.request.headers.get('X-Worktrail-Media-Type')).toBe('application/json');
    upload.flush({ id: attachmentId });
  });

  it('downloads a Blob response and removes attachment metadata', () => {
    api.downloadAttachment(attachmentId).subscribe((response) => {
      expect(response.body?.type).toBe('text/plain');
      expect(response.headers.get('Content-Disposition')).toContain(
        "filename*=UTF-8''evidence.txt"
      );
    });

    const download = http.expectOne(`/api/attachments/${attachmentId}/content`);
    expect(download.request.method).toBe('GET');
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['evidence'], { type: 'text/plain' }), {
      headers: {
        'Content-Disposition': "attachment; filename*=UTF-8''evidence.txt"
      }
    });

    api.removeAttachment(attachmentId).subscribe();
    const remove = http.expectOne(`/api/attachments/${attachmentId}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
});
