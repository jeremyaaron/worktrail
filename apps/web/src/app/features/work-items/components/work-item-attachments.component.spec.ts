import { provideHttpClient } from '@angular/common/http';
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

function listResponse(items: WorkItemAttachmentDto[], canUpload = true): WorkItemAttachmentListDto {
  const aggregateBytes = items.reduce((total, item) => total + item.byteSize, 0);

  return {
    items,
    policy,
    usage: {
      attachmentCount: items.length,
      aggregateBytes,
      remainingAttachmentSlots: policy.maxAttachmentsPerWorkItem - items.length,
      remainingBytes: policy.maxAggregateBytesPerWorkItem - aggregateBytes
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
      createdAt: '2026-07-21T16:00:00.000Z'
    });
    const older = attachment({ id: firstAttachmentId, fileName: 'requirements.md' });
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
      'button'
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
    compiled.querySelector<HTMLButtonElement>('button')?.click();
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
    const retry = compiled.querySelector<HTMLButtonElement>('button');
    expect(retry?.disabled).toBeFalse();
    retry?.click();
    http
      .expectOne(`/api/attachments/${firstAttachmentId}/content`)
      .flush(errorBody, { status: 503, statusText: 'Unavailable' });
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
});
