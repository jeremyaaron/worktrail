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
import { HttpEventType } from '@angular/common/http';
import type {
  AttachmentCategory,
  AttachmentTypePolicyDto,
  WorkItemAttachmentDto,
  WorkItemAttachmentListDto
} from '@worktrail/contracts';
import type { Subscription } from 'rxjs';

import { extractApiErrorMessage } from '../../../core/api/api-error';
import { WorktrailApiService } from '../../../core/worktrail-api.service';
import { downloadBlob, fileNameFromContentDisposition } from '../../../shared/download-file';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';

type AttachmentUploadState = 'failed' | 'queued' | 'uploading';

interface AttachmentUploadQueueEntry {
  id: number;
  file: File;
  canonicalMediaType: string | null;
  state: AttachmentUploadState;
  progress: number | null;
  error: string | null;
  canRetry: boolean;
}

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

        @if (canOfferUpload()) {
          <div class="upload-tools">
            <button
              type="button"
              class="add-files"
              [disabled]="isUploading()"
              [attr.aria-describedby]="uploadGuidanceId"
              (click)="fileInput.click()"
            >
              {{ isUploading() ? 'Uploading...' : 'Add files' }}
            </button>
            <input
              #fileInput
              class="visually-hidden"
              type="file"
              multiple
              [accept]="acceptedFileTypes()"
              [disabled]="isUploading()"
              (change)="selectFiles($event)"
            />
            <p [id]="uploadGuidanceId" class="upload-guidance">{{ uploadGuidance() }}</p>
          </div>
        }
      }

      <p class="upload-announcement" aria-live="polite">{{ uploadAnnouncement() }}</p>

      @if (uploadQueue().length > 0) {
        <section class="upload-queue" aria-labelledby="attachment-upload-queue-heading">
          <h3 id="attachment-upload-queue-heading">Selected files</h3>
          <ul>
            @for (entry of uploadQueue(); track entry.id) {
              <li class="upload-row">
                <div class="upload-row__content">
                  <strong [title]="entry.file.name">{{ entry.file.name }}</strong>
                  <p class="upload-row__meta">
                    {{ formatBytes(entry.file.size) }}
                    <span aria-hidden="true">·</span>
                    {{ uploadStateLabel(entry) }}
                  </p>

                  @if (entry.state === 'uploading') {
                    <progress
                      max="100"
                      [attr.value]="entry.progress"
                      [attr.aria-label]="'Uploading ' + entry.file.name"
                    ></progress>
                  }

                  @if (entry.error) {
                    <p class="row-error" role="alert">{{ entry.error }}</p>
                  }
                </div>

                @if (entry.state === 'failed') {
                  <div class="upload-row__actions">
                    @if (entry.canRetry) {
                      <button
                        type="button"
                        [disabled]="isUploading()"
                        [attr.aria-label]="'Retry upload of ' + entry.file.name"
                        (click)="retryUpload(entry.id)"
                      >
                        Retry
                      </button>
                    }
                    <button
                      type="button"
                      [disabled]="isUploading()"
                      [attr.aria-label]="'Dismiss ' + entry.file.name"
                      (click)="dismissUpload(entry.id)"
                    >
                      Dismiss
                    </button>
                  </div>
                }
              </li>
            }
          </ul>
        </section>
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
    .attachment-meta,
    .upload-guidance,
    .upload-row__meta {
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

    .upload-tools {
      display: flex;
      align-items: center;
      gap: 10px 12px;
      flex-wrap: wrap;
    }

    .upload-guidance {
      max-width: 680px;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .upload-announcement:empty {
      display: none;
    }

    .upload-queue {
      display: grid;
      gap: 8px;
      border: 1px solid #dbe3ec;
      border-radius: 6px;
      padding: 12px;
      background: #f8fafc;
    }

    .upload-queue h3 {
      margin: 0;
      color: #334155;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    .upload-queue ul {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .upload-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .upload-row__content {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .upload-row strong {
      min-width: 0;
      color: #111827;
      font-size: 0.8125rem;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .upload-row__meta span {
      margin: 0 3px;
    }

    .upload-row__actions {
      display: flex;
      gap: 8px;
    }

    progress {
      width: min(100%, 320px);
      height: 8px;
      accent-color: #2563eb;
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

    .add-files {
      border-color: #2563eb;
      background: #2563eb;
      color: #ffffff;
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

      .upload-row {
        grid-template-columns: minmax(0, 1fr);
      }

      .upload-row__actions {
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
  private uploadSubscription: Subscription | null = null;
  private readonly downloadSubscriptions = new Map<string, Subscription>();
  private requestGeneration = 0;
  private nextUploadId = 1;
  private successfulUploadsInRun = 0;

  readonly workItemId = input.required<string>();
  readonly activityChanged = output<void>();
  readonly uploadGuidanceId = 'work-item-attachment-upload-guidance';
  readonly attachmentList = signal<WorkItemAttachmentListDto | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly downloadingIds = signal<ReadonlySet<string>>(new Set());
  readonly downloadErrors = signal<Readonly<Record<string, string>>>({});
  readonly uploadQueue = signal<readonly AttachmentUploadQueueEntry[]>([]);
  readonly uploadAnnouncement = signal('');
  readonly attachments = computed(() => this.attachmentList()?.items ?? []);
  readonly attachmentCount = computed(() => this.attachments().length);
  readonly isUploading = computed(() =>
    this.uploadQueue().some((entry) => entry.state === 'uploading')
  );
  readonly canOfferUpload = computed(() => {
    const state = this.attachmentList();

    if (state === null || !state.permissions.canUpload) {
      return false;
    }

    const retainedFiles = this.uploadQueue().filter((entry) => entry.canonicalMediaType !== null);
    const reservedBytes = retainedFiles.reduce((total, entry) => total + entry.file.size, 0);

    return (
      state.usage.remainingAttachmentSlots > retainedFiles.length &&
      state.usage.remainingBytes > reservedBytes
    );
  });
  readonly acceptedFileTypes = computed(() => {
    const acceptedTypes = this.attachmentList()?.policy.acceptedTypes ?? [];

    return [...new Set(acceptedTypes.flatMap((type) => type.extensions))].join(',');
  });
  readonly uploadGuidance = computed(() => {
    const state = this.attachmentList();

    if (state === null) {
      return '';
    }

    const extensions = [...new Set(state.policy.acceptedTypes.flatMap((type) => type.extensions))]
      .map((extension) => extension.slice(1).toUpperCase())
      .join(', ');

    return `Up to ${this.formatBytes(state.policy.maxFileBytes)} per file. ${extensions}.`;
  });

  constructor() {
    effect(() => this.load(this.workItemId()));
    this.destroyRef.onDestroy(() => this.cancelRequests());
  }

  reload(): void {
    this.load(this.workItemId());
  }

  selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.enqueueFiles(files);
  }

  enqueueFiles(files: readonly File[]): void {
    const state = this.attachmentList();

    if (state === null || !this.canOfferUpload() || this.isUploading() || files.length === 0) {
      return;
    }

    this.uploadAnnouncement.set('');
    const retainedFiles = this.uploadQueue().filter((entry) => entry.canonicalMediaType !== null);
    let remainingSlots = state.usage.remainingAttachmentSlots - retainedFiles.length;
    let remainingBytes =
      state.usage.remainingBytes -
      retainedFiles.reduce((total, entry) => total + entry.file.size, 0);
    const additions: AttachmentUploadQueueEntry[] = [];

    for (const file of files) {
      const validation = this.validateSelection(file, state, remainingSlots, remainingBytes);
      additions.push({
        id: this.nextUploadId++,
        file,
        canonicalMediaType: validation.typePolicy?.canonicalMediaType ?? null,
        state: validation.error === null ? 'queued' : 'failed',
        progress: null,
        error: validation.error,
        canRetry: false
      });

      if (validation.error === null) {
        remainingSlots -= 1;
        remainingBytes -= file.size;
      }
    }

    this.uploadQueue.update((entries) => [...entries, ...additions]);
    this.processNextUpload();
  }

  retryUpload(entryId: number): void {
    if (this.isUploading()) {
      return;
    }

    const entry = this.uploadQueue().find((candidate) => candidate.id === entryId);

    if (entry?.state !== 'failed' || !entry.canRetry || entry.canonicalMediaType === null) {
      return;
    }

    this.uploadAnnouncement.set('');
    this.updateUploadEntry(entryId, {
      state: 'queued',
      progress: null,
      error: null,
      canRetry: false
    });
    this.processNextUpload();
  }

  dismissUpload(entryId: number): void {
    if (this.isUploading()) {
      return;
    }

    this.uploadQueue.update((entries) => entries.filter((entry) => entry.id !== entryId));
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

  uploadStateLabel(entry: AttachmentUploadQueueEntry): string {
    if (entry.state === 'uploading') {
      return entry.progress === null ? 'Uploading' : `Uploading ${entry.progress}%`;
    }

    return entry.state === 'queued' ? 'Waiting' : 'Needs attention';
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
    this.uploadQueue.set([]);
    this.uploadAnnouncement.set('');
    this.successfulUploadsInRun = 0;

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
    this.uploadSubscription?.unsubscribe();
    this.uploadSubscription = null;

    for (const subscription of this.downloadSubscriptions.values()) {
      subscription.unsubscribe();
    }
    this.downloadSubscriptions.clear();
  }

  private validateSelection(
    file: File,
    state: WorkItemAttachmentListDto,
    remainingSlots: number,
    remainingBytes: number
  ): { typePolicy: AttachmentTypePolicyDto | null; error: string | null } {
    if (file.size === 0) {
      return { typePolicy: null, error: 'Attachment files cannot be empty.' };
    }

    if (file.size > state.policy.maxFileBytes) {
      return {
        typePolicy: null,
        error: `Attachment files must be ${this.formatBytes(state.policy.maxFileBytes)} or smaller.`
      };
    }

    if ([...file.name.normalize('NFC')].length > state.policy.maxFileNameCodePoints) {
      return {
        typePolicy: null,
        error: `Attachment filenames must be ${state.policy.maxFileNameCodePoints} characters or fewer.`
      };
    }

    const extension = this.fileExtension(file.name);
    const typePolicy = state.policy.acceptedTypes.find((type) =>
      type.extensions.includes(extension)
    );

    if (typePolicy === undefined) {
      return { typePolicy: null, error: 'This attachment file type is not supported.' };
    }

    const declaredMediaType = file.type.trim().toLowerCase();

    if (declaredMediaType !== '' && !typePolicy.mediaTypes.includes(declaredMediaType)) {
      return {
        typePolicy: null,
        error: 'The attachment media type does not match its filename extension.'
      };
    }

    if (remainingSlots <= 0) {
      return {
        typePolicy: null,
        error: 'This selection exceeds the remaining attachment count.'
      };
    }

    if (file.size > remainingBytes) {
      return {
        typePolicy: null,
        error: 'This selection exceeds the remaining attachment storage.'
      };
    }

    return { typePolicy, error: null };
  }

  private processNextUpload(): void {
    if (this.uploadSubscription !== null) {
      return;
    }

    const entry = this.uploadQueue().find((candidate) => candidate.state === 'queued');

    if (entry === undefined) {
      this.finishUploadRun();
      return;
    }

    if (entry.canonicalMediaType === null) {
      this.updateUploadEntry(entry.id, {
        state: 'failed',
        error: 'This file cannot be uploaded.',
        canRetry: false
      });
      this.processNextUpload();
      return;
    }

    const generation = this.requestGeneration;
    const workItemId = this.workItemId();
    this.updateUploadEntry(entry.id, {
      state: 'uploading',
      progress: null,
      error: null,
      canRetry: false
    });

    this.uploadSubscription = this.api
      .uploadWorkItemAttachment(workItemId, entry.file, entry.canonicalMediaType)
      .subscribe({
        next: (event) => {
          if (!this.isCurrentRequest(generation, workItemId)) {
            return;
          }

          if (event.type === HttpEventType.UploadProgress) {
            const progress =
              event.total === undefined || event.total <= 0
                ? null
                : Math.min(100, Math.round((event.loaded / event.total) * 100));
            this.updateUploadEntry(entry.id, { progress });
          } else if (event.type === HttpEventType.Response) {
            if (event.body === null) {
              this.failUpload(entry.id, 'The attachment upload returned no metadata.');
              return;
            }

            this.completeUpload(entry.id, event.body);
          }
        },
        error: (error: unknown) => {
          if (!this.isCurrentRequest(generation, workItemId)) {
            return;
          }

          this.failUpload(
            entry.id,
            extractApiErrorMessage(error, 'The attachment could not be uploaded. Try again.')
          );
          this.uploadSubscription = null;
          this.processNextUpload();
        },
        complete: () => {
          if (!this.isCurrentRequest(generation, workItemId)) {
            return;
          }

          this.uploadSubscription = null;
          this.processNextUpload();
        }
      });
  }

  private completeUpload(entryId: number, attachment: WorkItemAttachmentDto): void {
    const state = this.attachmentList();

    if (state === null) {
      return;
    }

    this.uploadQueue.update((entries) => entries.filter((entry) => entry.id !== entryId));
    this.attachmentList.set({
      ...state,
      items: [attachment, ...state.items.filter((item) => item.id !== attachment.id)],
      usage: {
        attachmentCount: state.usage.attachmentCount + 1,
        aggregateBytes: state.usage.aggregateBytes + attachment.byteSize,
        remainingAttachmentSlots: Math.max(0, state.usage.remainingAttachmentSlots - 1),
        remainingBytes: Math.max(0, state.usage.remainingBytes - attachment.byteSize)
      }
    });
    this.successfulUploadsInRun += 1;
  }

  private failUpload(entryId: number, message: string): void {
    this.updateUploadEntry(entryId, {
      state: 'failed',
      progress: null,
      error: message,
      canRetry: true
    });
  }

  private finishUploadRun(): void {
    if (this.successfulUploadsInRun === 0) {
      return;
    }

    const successfulUploads = this.successfulUploadsInRun;
    const failedUploads = this.uploadQueue().filter((entry) => entry.state === 'failed').length;
    this.successfulUploadsInRun = 0;
    this.uploadAnnouncement.set(
      `${successfulUploads} ${successfulUploads === 1 ? 'file' : 'files'} uploaded.${
        failedUploads === 0
          ? ''
          : ` ${failedUploads} ${failedUploads === 1 ? 'file needs' : 'files need'} attention.`
      }`
    );
    this.activityChanged.emit();
  }

  private updateUploadEntry(
    entryId: number,
    changes: Partial<Omit<AttachmentUploadQueueEntry, 'id' | 'file' | 'canonicalMediaType'>>
  ): void {
    this.uploadQueue.update((entries) =>
      entries.map((entry) => (entry.id === entryId ? { ...entry, ...changes } : entry))
    );
  }

  private fileExtension(fileName: string): string {
    const lastPeriod = fileName.lastIndexOf('.');

    return lastPeriod <= 0 ? '' : fileName.slice(lastPeriod).toLowerCase();
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
