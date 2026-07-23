import type { HttpEvent, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { WorkItemAttachmentDto, WorkItemAttachmentListDto } from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class AttachmentsApi {
  private readonly api = inject(ApiClient);

  listWorkItemAttachments(workItemId: string): Observable<WorkItemAttachmentListDto> {
    return this.api.get<WorkItemAttachmentListDto>(`/work-items/${workItemId}/attachments`);
  }

  uploadWorkItemAttachment(
    workItemId: string,
    file: File,
    canonicalMediaType: string
  ): Observable<HttpEvent<WorkItemAttachmentDto>> {
    return this.api.postBinaryWithProgress<WorkItemAttachmentDto>(
      `/work-items/${workItemId}/attachments`,
      file,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Worktrail-Filename': encodeURIComponent(file.name),
          'X-Worktrail-Media-Type': file.type.trim() || canonicalMediaType.trim()
        }
      }
    );
  }

  downloadAttachment(attachmentId: string): Observable<HttpResponse<Blob>> {
    return this.api.getBlob(`/attachments/${attachmentId}/content`);
  }

  removeAttachment(attachmentId: string): Observable<void> {
    return this.api.delete<void>(`/attachments/${attachmentId}`);
  }
}
