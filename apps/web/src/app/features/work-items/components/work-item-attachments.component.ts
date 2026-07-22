import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import type {
  AttachmentCategory,
  WorkItemAttachmentDto,
  WorkItemAttachmentListDto
} from '@worktrail/contracts';
import type { Subscription } from 'rxjs';

import { WorktrailApiService } from '../../../core/worktrail-api.service';
import { downloadBlob, fileNameFromContentDisposition } from '../../../shared/download-file';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';

@Component({
  selector: 'app-work-item-attachments',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent],
  template: `
    <section
      class="attachments"
      aria-labelledby="attachments-heading"
      [attr.aria-busy]="isLoading()"
    >
      <header class="attachments__heading">
        <div>
          <p class="section-eyebrow">Files</p>
          <h2 id="attachments-heading">
            Attachments <span class="count">{{ attachmentCount() }}</span>
          </h2>
        </div>

        @if (attachmentList(); as state) {
          <p class="capacity">
            {{ state.usage.attachmentCount }} of {{ state.policy.maxAttachmentsPerWorkItem }} files
            <span aria-hidden="true">·</span>
            {{ formatBytes(state.usage.aggregateBytes) }} of
            {{ formatBytes(state.policy.maxAggregateBytesPerWorkItem) }}
          </p>
        }
      </header>

      @if (attachmentList(); as state) {
        @if (!state.permissions.canUpload) {
          <p class="availability">File changes are unavailable for this project.</p>
        } @else if (
          state.usage.remainingAttachmentSlots === 0 || state.usage.remainingBytes === 0
        ) {
          <p class="availability">Attachment capacity has been reached.</p>
        }
      }

      @if (isLoading()) {
        <app-loading-indicator label="Loading attachments" />
      } @else if (loadError()) {
        <app-error-panel
          title="Attachments unavailable"
          [message]="loadError() ?? ''"
          (retry)="reload()"
        />
      } @else if (attachments().length === 0) {
        <app-empty-state
          title="No attachments"
          message="Files added to this work item will appear here."
        />
      } @else {
        <ul class="attachment-list" aria-label="Work item attachments">
          @for (attachment of attachments(); track attachment.id) {
            <li class="attachment-row">
              <div class="attachment-row__content">
                <strong class="attachment-name" [title]="attachment.fileName">
                  {{ attachment.fileName }}
                </strong>
                <p class="attachment-meta">
                  <span>{{ categoryLabel(attachment) }}</span>
                  <span>{{ attachment.mediaType }}</span>
                  <span>{{ formatBytes(attachment.byteSize) }}</span>
                  <span>{{ attachment.uploader.name }}</span>
                  <time [attr.datetime]="attachment.createdAt">
                    {{ formatDateTime(attachment.createdAt) }}
                  </time>
                </p>
                @if (downloadError(attachment.id); as message) {
                  <p class="row-error" role="alert">{{ message }}</p>
                }
              </div>

              <div class="attachment-row__actions">
                <button
                  type="button"
                  [disabled]="isDownloading(attachment.id)"
                  [attr.aria-label]="'Download ' + attachment.fileName"
                  (click)="download(attachment)"
                >
                  {{ isDownloading(attachment.id) ? 'Downloading...' : 'Download' }}
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      margin-bottom: 18px;
    }

    .attachments {
      display: grid;
      gap: 12px;
      border-top: 1px solid #dbe3ec;
      border-bottom: 1px solid #dbe3ec;
      padding: 16px 0;
    }

    .attachments__heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      min-width: 0;
    }

    h2,
    p {
      margin: 0;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    .section-eyebrow {
      margin-bottom: 4px;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0;
      line-height: 1.3;
      text-transform: uppercase;
    }

    .count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      min-height: 22px;
      margin-left: 4px;
      border-radius: 999px;
      padding: 2px 7px;
      background: #e2e8f0;
      color: #475569;
      font-size: 0.75rem;
      vertical-align: 1px;
    }

    .capacity,
    .availability,
    .attachment-meta {
      color: #64748b;
      font-size: 0.8125rem;
      line-height: 1.45;
    }

    .capacity {
      text-align: right;
    }

    .capacity span {
      margin: 0 4px;
    }

    .availability {
      font-weight: 700;
    }

    .attachment-list {
      display: grid;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .attachment-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
      min-width: 0;
      border-top: 1px solid #e5e7eb;
      padding: 12px 0;
    }

    .attachment-row:last-child {
      padding-bottom: 0;
    }

    .attachment-row__content {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .attachment-name {
      min-width: 0;
      color: #111827;
      font-size: 0.875rem;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .attachment-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 3px 8px;
    }

    .attachment-meta span:not(:last-of-type)::after {
      margin-left: 8px;
      color: #cbd5e1;
      content: '·';
    }

    .attachment-row__actions {
      display: flex;
      align-items: center;
      min-width: 112px;
      justify-content: flex-end;
    }

    button {
      min-width: 104px;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #ffffff;
      color: #1f2937;
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 800;
      white-space: nowrap;
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    .row-error {
      color: #b91c1c;
      font-size: 0.8125rem;
      font-weight: 700;
      line-height: 1.4;
    }

    @media (max-width: 640px) {
      .attachments__heading {
        display: grid;
      }

      .capacity {
        text-align: left;
      }

      .attachment-row {
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
      }

      .attachment-row__actions {
        min-width: 0;
        justify-content: flex-start;
      }
    }
  `
})
export class WorkItemAttachmentsComponent {
  private readonly api = inject(WorktrailApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  private listSubscription: Subscription | null = null;
  private readonly downloadSubscriptions = new Map<string, Subscription>();
  private requestGeneration = 0;

  readonly workItemId = input.required<string>();
  readonly activityChanged = output<void>();
  readonly attachmentList = signal<WorkItemAttachmentListDto | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly downloadingIds = signal<ReadonlySet<string>>(new Set());
  readonly downloadErrors = signal<Readonly<Record<string, string>>>({});
  readonly attachments = computed(() => this.attachmentList()?.items ?? []);
  readonly attachmentCount = computed(() => this.attachments().length);

  constructor() {
    effect(() => this.load(this.workItemId()));
    this.destroyRef.onDestroy(() => this.cancelRequests());
  }

  reload(): void {
    this.load(this.workItemId());
  }

  download(attachment: WorkItemAttachmentDto): void {
    if (this.isDownloading(attachment.id)) {
      return;
    }

    const generation = this.requestGeneration;
    const workItemId = this.workItemId();
    this.setDownloading(attachment.id, true);
    this.setDownloadError(attachment.id, null);

    const subscription = this.api.downloadAttachment(attachment.id).subscribe({
      next: (response) => {
        if (!this.isCurrentRequest(generation, workItemId)) {
          return;
        }

        if (response.body === null) {
          this.setDownloadError(attachment.id, 'The attachment download returned no file.');
          this.setDownloading(attachment.id, false);
          return;
        }

        downloadBlob({
          blob: response.body,
          fileName: fileNameFromContentDisposition(
            response.headers.get('Content-Disposition'),
            attachment.fileName
          )
        });
        this.setDownloading(attachment.id, false);
      },
      error: () => {
        if (!this.isCurrentRequest(generation, workItemId)) {
          return;
        }

        this.setDownloadError(attachment.id, 'The attachment could not be downloaded. Try again.');
        this.setDownloading(attachment.id, false);
      }
    });
    this.downloadSubscriptions.set(attachment.id, subscription);
  }

  isDownloading(attachmentId: string): boolean {
    return this.downloadingIds().has(attachmentId);
  }

  downloadError(attachmentId: string): string | null {
    return this.downloadErrors()[attachmentId] ?? null;
  }

  categoryLabel(attachment: WorkItemAttachmentDto): string {
    const category = this.attachmentList()?.policy.acceptedTypes.find(
      (type) =>
        type.canonicalMediaType === attachment.mediaType ||
        type.mediaTypes.includes(attachment.mediaType)
    )?.category;

    return this.formatCategory(category);
  }

  formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${this.compactNumber(bytes / (1024 * 1024))} MiB`;
    }

    if (bytes >= 1024) {
      return `${this.compactNumber(bytes / 1024)} KiB`;
    }

    return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  }

  formatDateTime(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  private load(workItemId: string): void {
    this.cancelRequests();
    const generation = ++this.requestGeneration;
    this.attachmentList.set(null);
    this.loadError.set(null);
    this.isLoading.set(true);
    this.downloadingIds.set(new Set());
    this.downloadErrors.set({});

    this.listSubscription = this.api.listWorkItemAttachments(workItemId).subscribe({
      next: (response) => {
        if (!this.isCurrentRequest(generation, workItemId)) {
          return;
        }

        this.attachmentList.set(response);
        this.isLoading.set(false);
      },
      error: () => {
        if (!this.isCurrentRequest(generation, workItemId)) {
          return;
        }

        this.loadError.set('Attachment metadata could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  private cancelRequests(): void {
    this.listSubscription?.unsubscribe();
    this.listSubscription = null;

    for (const subscription of this.downloadSubscriptions.values()) {
      subscription.unsubscribe();
    }
    this.downloadSubscriptions.clear();
  }

  private isCurrentRequest(generation: number, workItemId: string): boolean {
    return generation === this.requestGeneration && workItemId === this.workItemId();
  }

  private setDownloading(attachmentId: string, isDownloading: boolean): void {
    const next = new Set(this.downloadingIds());

    if (isDownloading) {
      next.add(attachmentId);
    } else {
      next.delete(attachmentId);
    }

    this.downloadingIds.set(next);

    if (!isDownloading) {
      this.downloadSubscriptions.delete(attachmentId);
    }
  }

  private setDownloadError(attachmentId: string, message: string | null): void {
    const next = { ...this.downloadErrors() };

    if (message === null) {
      delete next[attachmentId];
    } else {
      next[attachmentId] = message;
    }

    this.downloadErrors.set(next);
  }

  private compactNumber(value: number): string {
    return value >= 10 || Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  }

  private formatCategory(category: AttachmentCategory | undefined): string {
    switch (category) {
      case 'pdf':
        return 'PDF';
      case 'data':
        return 'Data';
      case 'document':
        return 'Document';
      case 'image':
        return 'Image';
      case 'text':
        return 'Text';
      default:
        return 'File';
    }
  }
}
