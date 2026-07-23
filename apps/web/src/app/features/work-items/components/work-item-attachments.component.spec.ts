import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type {
  AttachmentPolicyDto,
  MemberDto,
  WorkItemAttachmentDto,
  WorkItemAttachmentListDto
} from '@worktrail/contracts';

import { CurrentUserService } from '../../../core/current-user.service';
import { WorkItemAttachmentsComponent } from './work-item-attachments.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const firstWorkItemId = '10000000-0000-4000-8000-000000000401';
const secondWorkItemId = '10000000-0000-4000-8000-000000000402';
const firstAttachmentId = '10000000-0000-4000-8000-000000000801';
const secondAttachmentId = '10000000-0000-4000-8000-000000000802';

const uploader: MemberDto = {
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

const policy: AttachmentPolicyDto = {
  maxFileBytes: 4 * 1024 * 1024,
  maxAttachmentsPerWorkItem: 20,
  maxAggregateBytesPerWorkItem: 50 * 1024 * 1024,
  maxFileNameCodePoints: 180,
  acceptedTypes: [
    {
      extensions: ['.txt', '.md'],
      mediaTypes: ['text/plain', 'text/markdown'],
      canonicalMediaType: 'text/plain',
      category: 'text'
    },
    {
      extensions: ['.png'],
      mediaTypes: ['image/png'],
      canonicalMediaType: 'image/png',
      category: 'image'
    }
  ]
};

function attachment(
  input: Partial<WorkItemAttachmentDto> & Pick<WorkItemAttachmentDto, 'id' | 'fileName'>
): WorkItemAttachmentDto {
  return {
    id: input.id,
    workItemId: input.workItemId ?? firstWorkItemId,
    fileName: input.fileName,
    mediaType: input.mediaType ?? 'text/plain',
    byteSize: input.byteSize ?? 1536,
    uploader: input.uploader ?? uploader,
    createdAt: input.createdAt ?? '2026-07-21T15:00:00.000Z',
    permissions: input.permissions ?? { canRemove: true }
  };
}

function listResponse(
  items: WorkItemAttachmentDto[],
  canUpload = true,
  usageOverrides: Partial<WorkItemAttachmentListDto['usage']> = {}
): WorkItemAttachmentListDto {
  const aggregateBytes = items.reduce((total, item) => total + item.byteSize, 0);

  return {
    items,
    policy,
    usage: {
      attachmentCount: items.length,
      aggregateBytes,
      remainingAttachmentSlots: policy.maxAttachmentsPerWorkItem - items.length,
      remainingBytes: policy.maxAggregateBytesPerWorkItem - aggregateBytes,
      ...usageOverrides
    },
    permissions: { canUpload }
  };
}

describe('WorkItemAttachmentsComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [WorkItemAttachmentsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    const currentUser = TestBed.inject(CurrentUserService);
    currentUser.members.set([uploader]);
    currentUser.selectMember(uploader.id);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function createComponent(workItemId = firstWorkItemId) {
    const fixture = TestBed.createComponent(WorkItemAttachmentsComponent);
    fixture.componentRef.setInput('workItemId', workItemId);
    fixture.detectChanges();
    return fixture;
  }

  it('renders compact loading, empty, and retry states', () => {
    const fixture = createComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Loading attachments');
    expect(compiled.textContent).toContain('Attachments 0');

    http
      .expectOne(`/api/work-items/${firstWorkItemId}/attachments`)
      .flush(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed.' } },
        { status: 500, statusText: 'Server Error' }
      );
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Attachments unavailable');

    compiled.querySelector<HTMLButtonElement>('app-error-panel button')?.click();
    const retry = http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`);
    retry.flush(listResponse([]));
    fixture.detectChanges();

    expect(compiled.textContent).toContain('No attachments');
    expect(compiled.textContent).toContain('0 of 20 files');
  });

  it('renders newest-first metadata, policy capacity, archived guidance, and contained long names', () => {
    const fixture = createComponent();
    const longName = `${'architecture-review-'.repeat(10)}final-evidence.txt`;
    const newer = attachment({
      id: secondAttachmentId,
      fileName: longName,
      byteSize: 2 * 1024 * 1024,
      createdAt: '2026-07-21T16:00:00.000Z',
      permissions: { canRemove: false }
    });
    const older = attachment({
      id: firstAttachmentId,
      fileName: 'requirements.md',
      permissions: { canRemove: false }
    });
    http
      .expectOne(`/api/work-items/${firstWorkItemId}/attachments`)
      .flush(listResponse([newer, older], false));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const names = [...compiled.querySelectorAll<HTMLElement>('.attachment-name')].map((element) =>
      element.textContent?.trim()
    );
    expect(names).toEqual([longName, 'requirements.md']);
    expect(compiled.textContent).toContain('Attachments 2');
    expect(compiled.textContent).toContain('2 of 20 files');
    expect(compiled.textContent).toContain('2 MiB');
    expect(compiled.textContent).toContain('Text');
    expect(compiled.textContent).toContain('Avery Owner');
    expect(compiled.textContent).toContain('File changes are unavailable for this project.');
    expect(compiled.querySelector('.attachment-name')?.getAttribute('title')).toBe(longName);
    expect(compiled.querySelectorAll('button').length).toBe(2);
    expect(compiled.textContent).not.toContain('Remove');
  });

  it('downloads the authorized Blob using the UTF-8 server filename', () => {
    const fixture = createComponent();
    const item = attachment({ id: firstAttachmentId, fileName: 'resume.txt' });
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(listResponse([item]));
    fixture.detectChanges();

    const link = document.createElement('a');
    spyOn(document, 'createElement').and.returnValue(link);
    spyOn(document.body, 'appendChild').and.callThrough();
    spyOn(link, 'click').and.stub();
    spyOn(link, 'remove').and.stub();
    spyOn(URL, 'createObjectURL').and.returnValue('blob:attachment');
    spyOn(URL, 'revokeObjectURL').and.stub();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.attachment-row__actions button'
    );
    button?.click();
    fixture.detectChanges();
    expect(button?.textContent?.trim()).toBe('Downloading...');
    expect(button?.disabled).toBeTrue();

    const download = http.expectOne(`/api/attachments/${firstAttachmentId}/content`);
    expect(download.request.responseType).toBe('blob');
    const blob = new Blob(['attachment evidence'], { type: 'text/plain' });
    download.flush(blob, {
      headers: {
        'Content-Disposition':
          "attachment; filename=resume.txt; filename*=UTF-8''r%C3%A9sum%C3%A9.txt"
      }
    });
    fixture.detectChanges();

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(link.download).toBe('résumé.txt');
    expect(link.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment');
    expect(button?.disabled).toBeFalse();
  });

  it('keeps metadata visible and makes a failed row download retryable', () => {
    const fixture = createComponent();
    const item = attachment({ id: firstAttachmentId, fileName: 'evidence.txt' });
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(listResponse([item]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.attachment-row__actions button')?.click();
    const errorBody = new Blob(
      [JSON.stringify({ error: { code: 'ATTACHMENT_STORAGE_UNAVAILABLE' } })],
      { type: 'application/json' }
    );
    http
      .expectOne(`/api/attachments/${firstAttachmentId}/content`)
      .flush(errorBody, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('evidence.txt');
    expect(compiled.textContent).toContain('The attachment could not be downloaded. Try again.');
    const retry = compiled.querySelector<HTMLButtonElement>('.attachment-row__actions button');
    expect(retry?.disabled).toBeFalse();
    retry?.click();
    http
      .expectOne(`/api/attachments/${firstAttachmentId}/content`)
      .flush(errorBody, { status: 503, statusText: 'Unavailable' });
  });

  it('shows removal only from server capability and supports filename confirmation cancellation', () => {
    const fixture = createComponent();
    const removable = attachment({ id: firstAttachmentId, fileName: 'normalized evidence.txt' });
    const protectedItem = attachment({
      id: secondAttachmentId,
      fileName: 'protected.txt',
      permissions: { canRemove: false }
    });
    http
      .expectOne(`/api/work-items/${firstWorkItemId}/attachments`)
      .flush(listResponse([removable, protectedItem]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled.querySelector('button[aria-label="Remove normalized evidence.txt"]')
    ).not.toBeNull();
    expect(compiled.querySelector('button[aria-label="Remove protected.txt"]')).toBeNull();

    compiled
      .querySelector<HTMLButtonElement>('button[aria-label="Remove normalized evidence.txt"]')
      ?.click();
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Remove "normalized evidence.txt"?');

    compiled.querySelector<HTMLButtonElement>('.removal-confirmation button:last-child')?.click();
    fixture.detectChanges();
    expect(compiled.textContent).not.toContain('Remove "normalized evidence.txt"?');
    http.expectNone(`/api/attachments/${firstAttachmentId}`);
  });

  it('removes one attachment once and restores local count and byte capacity', () => {
    const fixture = createComponent();
    const activityChanged = spyOn(fixture.componentInstance.activityChanged, 'emit');
    const item = attachment({
      id: firstAttachmentId,
      fileName: 'evidence.txt',
      byteSize: 2048
    });
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(listResponse([item]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('button[aria-label="Remove evidence.txt"]')?.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.removal-confirmation .danger-action')?.click();
    fixture.detectChanges();

    const removal = http.expectOne(`/api/attachments/${firstAttachmentId}`);
    expect(removal.request.method).toBe('DELETE');
    expect(compiled.textContent).toContain('Removing...');
    expect(
      compiled.querySelector<HTMLButtonElement>('.removal-confirmation .danger-action')?.disabled
    ).toBeTrue();
    fixture.componentInstance.removeAttachment(item);
    http.expectNone(`/api/attachments/${firstAttachmentId}`);

    removal.flush(null);
    fixture.detectChanges();

    expect(compiled.querySelector('.attachment-name')).toBeNull();
    expect(compiled.textContent).toContain('No attachments');
    expect(compiled.textContent).toContain('Removed attachment "evidence.txt".');
    expect(fixture.componentInstance.attachmentList()?.usage).toEqual({
      attachmentCount: 0,
      aggregateBytes: 0,
      remainingAttachmentSlots: policy.maxAttachmentsPerWorkItem,
      remainingBytes: policy.maxAggregateBytesPerWorkItem
    });
    expect(activityChanged).toHaveBeenCalledTimes(1);
  });

  it('retains a failed removal with the API message and permits explicit retry', () => {
    const fixture = createComponent();
    const activityChanged = spyOn(fixture.componentInstance.activityChanged, 'emit');
    const item = attachment({ id: firstAttachmentId, fileName: 'retry-removal.txt' });
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(listResponse([item]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled
      .querySelector<HTMLButtonElement>('button[aria-label="Remove retry-removal.txt"]')
      ?.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.removal-confirmation .danger-action')?.click();
    http
      .expectOne(`/api/attachments/${firstAttachmentId}`)
      .flush(
        {
          error: { code: 'ATTACHMENT_STORAGE_UNAVAILABLE', message: 'File storage is unavailable.' }
        },
        { status: 503, statusText: 'Unavailable' }
      );
    fixture.detectChanges();

    expect(compiled.textContent).toContain('retry-removal.txt');
    expect(compiled.textContent).toContain('File storage is unavailable.');
    expect(activityChanged).not.toHaveBeenCalled();
    const retry = compiled.querySelector<HTMLButtonElement>('.removal-confirmation .danger-action');
    expect(retry?.disabled).toBeFalse();

    retry?.click();
    http.expectOne(`/api/attachments/${firstAttachmentId}`).flush(null);
    fixture.detectChanges();
    expect(compiled.querySelector('.attachment-name')).toBeNull();
    expect(activityChanged).toHaveBeenCalledTimes(1);
  });

  it('cancels an active removal and clears its state when route identity changes', () => {
    const fixture = createComponent();
    const activityChanged = spyOn(fixture.componentInstance.activityChanged, 'emit');
    const item = attachment({ id: firstAttachmentId, fileName: 'old-removal.txt' });
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(listResponse([item]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled
      .querySelector<HTMLButtonElement>('button[aria-label="Remove old-removal.txt"]')
      ?.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.removal-confirmation .danger-action')?.click();
    const removal = http.expectOne(`/api/attachments/${firstAttachmentId}`);

    fixture.componentRef.setInput('workItemId', secondWorkItemId);
    fixture.detectChanges();

    expect(removal.cancelled).toBeTrue();
    expect(fixture.componentInstance.confirmingRemovalId()).toBeNull();
    expect(fixture.componentInstance.removingIds().size).toBe(0);
    expect(activityChanged).not.toHaveBeenCalled();
    http.expectOne(`/api/work-items/${secondWorkItemId}/attachments`).flush(listResponse([]));
  });

  it('clears old rows immediately when the work item input changes', () => {
    const fixture = createComponent();
    http
      .expectOne(`/api/work-items/${firstWorkItemId}/attachments`)
      .flush(listResponse([attachment({ id: firstAttachmentId, fileName: 'old-item.txt' })]));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('old-item.txt');

    fixture.componentRef.setInput('workItemId', secondWorkItemId);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('old-item.txt');
    expect(compiled.textContent).toContain('Loading attachments');

    http.expectOne(`/api/work-items/${secondWorkItemId}/attachments`).flush(listResponse([]));
    fixture.detectChanges();
    expect(compiled.textContent).toContain('No attachments');
  });

  it('cancels an in-flight list read when route identity changes', () => {
    const fixture = createComponent();
    const firstRequest = http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`);

    fixture.componentRef.setInput('workItemId', secondWorkItemId);
    fixture.detectChanges();

    expect(firstRequest.cancelled).toBeTrue();
    http.expectOne(`/api/work-items/${secondWorkItemId}/attachments`).flush(listResponse([]));
  });

  it('derives picker guidance and isolates invalid files from a valid media fallback', () => {
    const fixture = createComponent();
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(listResponse([]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input?.multiple).toBeTrue();
    expect(input?.accept).toBe('.txt,.md,.png');
    expect(compiled.textContent).toContain('Up to 4 MiB per file. TXT, MD, PNG.');

    const empty = new File([], 'empty.txt', { type: 'text/plain' });
    const oversized = new File([new Uint8Array(policy.maxFileBytes + 1)], 'large.txt', {
      type: 'text/plain'
    });
    const unsupported = new File(['binary'], 'evidence.exe', {
      type: 'application/octet-stream'
    });
    const mismatched = new File(['text'], 'mismatch.txt', { type: 'image/png' });
    const validFallback = new File(['notes'], 'notes.md');

    fixture.componentInstance.enqueueFiles([
      empty,
      oversized,
      unsupported,
      mismatched,
      validFallback
    ]);
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Attachment files cannot be empty.');
    expect(compiled.textContent).toContain('Attachment files must be 4 MiB or smaller.');
    expect(compiled.textContent).toContain('This attachment file type is not supported.');
    expect(compiled.textContent).toContain(
      'The attachment media type does not match its filename extension.'
    );
    const upload = http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`);
    expect(upload.request.headers.get('X-Worktrail-Media-Type')).toBe('text/plain');
    upload.flush(
      attachment({
        id: firstAttachmentId,
        fileName: validFallback.name,
        byteSize: validFallback.size
      })
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.attachments().map((item) => item.fileName)).toEqual([
      'notes.md'
    ]);
    expect(fixture.componentInstance.uploadQueue().length).toBe(4);
    expect(compiled.textContent).toContain('1 file uploaded. 4 files need attention.');
  });

  it('uploads files sequentially with determinate and indeterminate progress', () => {
    const fixture = createComponent();
    const activityChanged = spyOn(fixture.componentInstance.activityChanged, 'emit');
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(listResponse([]));
    fixture.detectChanges();

    const firstFile = new File(['first'], 'first.txt', { type: 'text/plain' });
    const secondFile = new File(['second'], 'second.txt', { type: 'text/plain' });
    fixture.componentInstance.enqueueFiles([firstFile, secondFile]);
    fixture.detectChanges();

    const firstUpload = http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`);
    expect(http.match(`/api/work-items/${firstWorkItemId}/attachments`).length).toBe(0);
    firstUpload.event({ type: HttpEventType.UploadProgress, loaded: 1 });
    fixture.detectChanges();
    let progress = (fixture.nativeElement as HTMLElement).querySelector('progress');
    expect(progress?.hasAttribute('value')).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Uploading');

    firstUpload.event({
      type: HttpEventType.UploadProgress,
      loaded: 3,
      total: firstFile.size
    });
    fixture.detectChanges();
    progress = (fixture.nativeElement as HTMLElement).querySelector('progress');
    expect(progress?.getAttribute('value')).toBe('60');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Uploading 60%');

    firstUpload.flush(
      attachment({
        id: firstAttachmentId,
        fileName: firstFile.name,
        byteSize: firstFile.size
      })
    );
    expect(fixture.componentInstance.attachments().map((item) => item.fileName)).toEqual([
      'first.txt'
    ]);

    const secondUpload = http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`);
    secondUpload.flush(
      attachment({
        id: secondAttachmentId,
        fileName: secondFile.name,
        byteSize: secondFile.size
      })
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.attachments().map((item) => item.fileName)).toEqual([
      'second.txt',
      'first.txt'
    ]);
    expect(fixture.componentInstance.attachmentList()?.usage).toEqual({
      attachmentCount: 2,
      aggregateBytes: firstFile.size + secondFile.size,
      remainingAttachmentSlots: policy.maxAttachmentsPerWorkItem - 2,
      remainingBytes: policy.maxAggregateBytesPerWorkItem - firstFile.size - secondFile.size
    });
    expect(fixture.componentInstance.uploadQueue()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2 files uploaded.');
    expect(activityChanged).toHaveBeenCalledTimes(1);
  });

  it('continues after a server failure and retries the retained file without reselection', () => {
    const fixture = createComponent();
    const activityChanged = spyOn(fixture.componentInstance.activityChanged, 'emit');
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(listResponse([]));

    const failedFile = new File(['failed'], 'failed.txt', { type: 'text/plain' });
    const successfulFile = new File(['success'], 'successful.txt', { type: 'text/plain' });
    fixture.componentInstance.enqueueFiles([failedFile, successfulFile]);

    http
      .expectOne(`/api/work-items/${firstWorkItemId}/attachments`)
      .flush(
        { error: { code: 'VALIDATION_ERROR', message: 'The file contents were rejected.' } },
        { status: 422, statusText: 'Unprocessable Entity' }
      );
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(
      attachment({
        id: secondAttachmentId,
        fileName: successfulFile.name,
        byteSize: successfulFile.size
      })
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('The file contents were rejected.');
    expect(compiled.textContent).toContain('1 file uploaded. 1 file needs attention.');
    expect(fixture.componentInstance.uploadQueue()[0].file).toBe(failedFile);
    expect(activityChanged).toHaveBeenCalledTimes(1);

    compiled
      .querySelector<HTMLButtonElement>(`button[aria-label="Retry upload of ${failedFile.name}"]`)
      ?.click();
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(
      attachment({
        id: firstAttachmentId,
        fileName: failedFile.name,
        byteSize: failedFile.size
      })
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.uploadQueue()).toEqual([]);
    expect(fixture.componentInstance.attachments().map((item) => item.fileName)).toEqual([
      'failed.txt',
      'successful.txt'
    ]);
    expect(activityChanged).toHaveBeenCalledTimes(2);
  });

  it('preflights the selected batch against aggregate bytes and attachment slots', () => {
    const fixture = createComponent();
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(
      listResponse([], true, {
        attachmentCount: 18,
        aggregateBytes: policy.maxAggregateBytesPerWorkItem - 3,
        remainingAttachmentSlots: 2,
        remainingBytes: 3
      })
    );

    const first = new File(['12'], 'first.txt', { type: 'text/plain' });
    const exceedsBytes = new File(['34'], 'bytes.txt', { type: 'text/plain' });
    const fillsCapacity = new File(['5'], 'last.txt', { type: 'text/plain' });
    const exceedsCount = new File(['6'], 'count.txt', { type: 'text/plain' });
    fixture.componentInstance.enqueueFiles([first, exceedsBytes, fillsCapacity, exceedsCount]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(
      'This selection exceeds the remaining attachment storage.'
    );
    expect(compiled.textContent).toContain(
      'This selection exceeds the remaining attachment count.'
    );

    http
      .expectOne(`/api/work-items/${firstWorkItemId}/attachments`)
      .flush(attachment({ id: firstAttachmentId, fileName: first.name, byteSize: first.size }));
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(
      attachment({
        id: secondAttachmentId,
        fileName: fillsCapacity.name,
        byteSize: fillsCapacity.size
      })
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.attachmentList()?.usage.remainingAttachmentSlots).toBe(0);
    expect(fixture.componentInstance.attachmentList()?.usage.remainingBytes).toBe(0);
    expect(compiled.textContent).toContain('Attachment capacity has been reached.');
  });

  it('clears the queue and cancels an active upload when route identity changes', () => {
    const fixture = createComponent();
    const activityChanged = spyOn(fixture.componentInstance.activityChanged, 'emit');
    http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`).flush(listResponse([]));

    fixture.componentInstance.enqueueFiles([
      new File(['route'], 'route.txt', { type: 'text/plain' })
    ]);
    const upload = http.expectOne(`/api/work-items/${firstWorkItemId}/attachments`);

    fixture.componentRef.setInput('workItemId', secondWorkItemId);
    fixture.detectChanges();

    expect(upload.cancelled).toBeTrue();
    expect(fixture.componentInstance.uploadQueue()).toEqual([]);
    expect(activityChanged).not.toHaveBeenCalled();
    http.expectOne(`/api/work-items/${secondWorkItemId}/attachments`).flush(listResponse([]));
  });
});
