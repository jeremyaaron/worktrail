import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  ActivityEventDto,
  CommentDto,
  LabelDto,
  MemberDto,
  UpdateWorkItemRequest,
  WorkItemDetailDto,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

const statuses: WorkItemStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'done',
  'canceled'
];
const types: WorkItemType[] = ['task', 'bug', 'story', 'chore'];
const priorities: WorkItemPriority[] = ['low', 'medium', 'high', 'urgent'];

@Component({
  selector: 'app-work-item-detail-page',
  imports: [
    EmptyStateComponent,
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink
  ],
  template: `
    @if (isLoading()) {
      <app-loading-indicator label="Loading work item" />
    } @else if (loadError()) {
      <app-error-panel [message]="loadError() ?? ''" (retry)="loadWorkItem()" />
    } @else if (workItem(); as item) {
      <section class="detail-header">
        <div>
          <p class="eyebrow">Work item</p>
          <h1>{{ item.title }}</h1>
          <p>{{ item.description || 'No description provided.' }}</p>
        </div>

        <a [routerLink]="['/projects', item.projectId, 'work-items']">Back to list</a>
      </section>

      <section class="detail-grid">
        <section class="panel" aria-labelledby="edit-work-item-heading">
          <h2 id="edit-work-item-heading">Details</h2>

          <form class="detail-form" [formGroup]="detailForm" (ngSubmit)="updateWorkItem()" novalidate>
            <label for="detail-title">Title</label>
            <input
              id="detail-title"
              type="text"
              formControlName="title"
              [attr.aria-invalid]="showTitleError()"
              aria-describedby="detail-title-error"
            />
            @if (showTitleError()) {
              <p id="detail-title-error" class="field-error">Title is required.</p>
            }

            <label for="detail-description">Description</label>
            <textarea id="detail-description" rows="5" formControlName="description"></textarea>

            <div class="form-grid">
              <label>
                <span>Type</span>
                <select formControlName="type">
                  @for (type of types; track type) {
                    <option [value]="type">{{ formatToken(type) }}</option>
                  }
                </select>
              </label>

              <label>
                <span>Priority</span>
                <select formControlName="priority">
                  @for (priority of priorities; track priority) {
                    <option [value]="priority">{{ formatToken(priority) }}</option>
                  }
                </select>
              </label>

              <label>
                <span>Assignee</span>
                <select formControlName="assigneeId">
                  <option value="">Unassigned</option>
                  @for (member of members(); track member.id) {
                    <option [value]="member.id">{{ member.name }}</option>
                  }
                </select>
              </label>
            </div>

            <section class="label-editor" aria-label="Labels">
              <h3>Labels</h3>
              @if (labelLoadError()) {
                <app-error-panel
                  title="Labels unavailable"
                  [message]="labelLoadError() ?? ''"
                  (retry)="loadProjectLabels(item.projectId)"
                />
              } @else if (availableLabels().length === 0) {
                <p>No project labels are available.</p>
              } @else {
                <div class="label-options">
                  @for (label of availableLabels(); track label.id) {
                    <label class="label-option">
                      <input
                        type="checkbox"
                        [checked]="isLabelSelected(label.id)"
                        (change)="toggleLabel(label.id, $event)"
                      />
                      <span [style.background]="label.color ?? '#e2e8f0'"></span>
                      {{ label.name }}
                    </label>
                  }
                </div>
              }
            </section>

            @if (updateError()) {
              <app-error-panel
                title="Update failed"
                [message]="updateError() ?? ''"
                (retry)="updateWorkItem()"
              />
            }

            <button type="submit" [disabled]="isUpdating()">
              {{ isUpdating() ? 'Saving...' : 'Save changes' }}
            </button>
          </form>
        </section>

        <aside class="side-stack">
          <section class="panel" aria-labelledby="status-heading">
            <h2 id="status-heading">Status</h2>
            <form class="status-form" [formGroup]="statusForm" (ngSubmit)="transitionStatus()">
              <label>
                <span>Current status</span>
                <select formControlName="status">
                  @for (status of statuses; track status) {
                    <option [value]="status">{{ formatToken(status) }}</option>
                  }
                </select>
              </label>

              @if (statusError()) {
                <app-error-panel
                  title="Status not changed"
                  [message]="statusError() ?? ''"
                  (retry)="transitionStatus()"
                />
              }

              <button type="submit" [disabled]="isTransitioning()">
                {{ isTransitioning() ? 'Updating...' : 'Update status' }}
              </button>
            </form>
          </section>

          <section class="panel" aria-labelledby="metadata-heading">
            <h2 id="metadata-heading">Metadata</h2>
            <dl class="metadata">
              <div>
                <dt>Reporter</dt>
                <dd>{{ item.reporter.name }}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{{ formatDateTime(item.createdAt) }}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{{ formatDateTime(item.updatedAt) }}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{{ item.dueDate ?? 'None' }}</dd>
              </div>
              <div>
                <dt>Estimate</dt>
                <dd>{{ item.estimatePoints === null ? 'None' : item.estimatePoints + ' points' }}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </section>

      <section class="collaboration-grid">
        <section class="panel" aria-labelledby="comments-heading">
          <h2 id="comments-heading">Comments</h2>

          @if (item.comments.length === 0) {
            <app-empty-state title="No comments yet" message="Start the discussion from this detail page." />
          } @else {
            <div class="comment-list">
              @for (comment of item.comments; track comment.id) {
                <article class="comment">
                  <header>
                    <strong>{{ comment.author.name }}</strong>
                    <time>{{ formatDateTime(comment.createdAt) }}</time>
                  </header>
                  <p>{{ comment.body }}</p>
                </article>
              }
            </div>
          }

          <form class="comment-form" [formGroup]="commentForm" (ngSubmit)="addComment()" novalidate>
            <label for="comment-body">Add comment</label>
            <textarea id="comment-body" rows="4" formControlName="body"></textarea>
            @if (showCommentError()) {
              <p class="field-error">Comment body is required.</p>
            }

            @if (commentError()) {
              <app-error-panel
                title="Comment not added"
                [message]="commentError() ?? ''"
                (retry)="addComment()"
              />
            }

            <button type="submit" [disabled]="isCommenting()">
              {{ isCommenting() ? 'Adding...' : 'Add comment' }}
            </button>
          </form>
        </section>

        <section class="panel" aria-labelledby="activity-heading">
          <h2 id="activity-heading">Activity</h2>

          @if (item.activity.length === 0) {
            <app-empty-state title="No activity yet" message="Meaningful changes will appear here." />
          } @else {
            <ol class="activity-list">
              @for (event of item.activity; track event.id) {
                <li>
                  <strong>{{ event.summary }}</strong>
                  <span>{{ event.actor.name }} · {{ formatEventType(event) }} · {{ formatDateTime(event.createdAt) }}</span>
                </li>
              }
            </ol>
          }
        </section>
      </section>
    }
  `,
  styles: `
    .detail-header,
    .detail-grid,
    .collaboration-grid {
      display: grid;
      gap: 18px;
    }

    .detail-header {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      margin-bottom: 20px;
    }

    .detail-grid,
    .collaboration-grid {
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      align-items: start;
      margin-bottom: 18px;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1,
    h2,
    h3,
    p,
    dl,
    dd,
    ol {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    h3 {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    .detail-header p,
    .label-editor p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .detail-header a,
    button {
      min-height: 38px;
      border: 1px solid #1f4f99;
      border-radius: 6px;
      padding: 9px 14px;
      background: #1f4f99;
      color: #ffffff;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    .detail-header a {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    .panel {
      display: grid;
      gap: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .side-stack {
      display: grid;
      gap: 18px;
    }

    .detail-form,
    .status-form,
    .comment-form,
    .metadata {
      display: grid;
      gap: 12px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    label {
      display: grid;
      gap: 6px;
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    input,
    select,
    textarea {
      width: 100%;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 0.875rem;
    }

    input:focus,
    select:focus,
    textarea:focus {
      border-color: #1d4ed8;
      outline: 2px solid #bfdbfe;
    }

    .field-error {
      color: #b91c1c;
      font-size: 0.8125rem;
    }

    .label-editor,
    .label-options {
      display: grid;
      gap: 10px;
    }

    .label-options {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .label-option {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
    }

    .label-option input[type='checkbox'] {
      width: 16px;
      height: 16px;
      min-height: 16px;
      margin: 0;
      padding: 0;
      flex: 0 0 auto;
    }

    .label-option span {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .metadata div {
      display: grid;
      gap: 3px;
    }

    dt {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
    }

    dd {
      color: #111827;
      font-size: 0.875rem;
      font-weight: 700;
    }

    .comment-list,
    .activity-list {
      display: grid;
      gap: 10px;
    }

    .comment,
    .activity-list li {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    .comment header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      color: #111827;
      font-size: 0.875rem;
    }

    .comment time,
    .activity-list span {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .comment p,
    .activity-list strong {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .activity-list {
      list-style: none;
      padding: 0;
    }

    .activity-list li {
      display: grid;
      gap: 5px;
    }

    @media (max-width: 920px) {
      .detail-header,
      .detail-grid,
      .collaboration-grid {
        grid-template-columns: 1fr;
      }

      .form-grid,
      .label-options {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class WorkItemDetailPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = statuses;
  readonly types = types;
  readonly priorities = priorities;
  readonly members = computed<MemberDto[]>(() => this.currentUser.members());
  readonly workItemId = computed(() => this.route.snapshot.paramMap.get('workItemId') ?? '');

  readonly workItem = signal<WorkItemDetailDto | null>(null);
  readonly selectedLabelIds = signal<string[]>([]);
  readonly isLoading = signal(false);
  readonly isUpdating = signal(false);
  readonly isTransitioning = signal(false);
  readonly isCommenting = signal(false);
  readonly hasSubmittedDetail = signal(false);
  readonly hasSubmittedComment = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly updateError = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);
  readonly commentError = signal<string | null>(null);
  readonly labelLoadError = signal<string | null>(null);
  readonly availableLabels = signal<LabelDto[]>([]);

  readonly detailForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    type: ['task'],
    priority: ['medium'],
    assigneeId: ['']
  });

  readonly statusForm = this.formBuilder.nonNullable.group({
    status: ['backlog']
  });

  readonly commentForm = this.formBuilder.nonNullable.group({
    body: ['', [Validators.required]]
  });

  ngOnInit(): void {
    if (this.currentUser.members().length === 0) {
      this.currentUser.loadMembers();
    }

    this.loadWorkItem();
  }

  loadWorkItem(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.getWorkItem(this.workItemId()).subscribe({
      next: (workItem) => {
        this.applyWorkItem(workItem);
        this.loadProjectLabels(workItem.projectId);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Work item detail could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  updateWorkItem(): void {
    this.hasSubmittedDetail.set(true);
    this.updateError.set(null);

    if (this.detailForm.invalid) {
      this.detailForm.markAllAsTouched();
      return;
    }

    this.isUpdating.set(true);
    this.api.updateWorkItem(this.workItemId(), this.toUpdateRequest()).subscribe({
      next: (workItem) => {
        this.applyWorkItem(workItem);
        this.hasSubmittedDetail.set(false);
        this.isUpdating.set(false);
      },
      error: () => {
        this.updateError.set('The work item could not be updated.');
        this.isUpdating.set(false);
      }
    });
  }

  transitionStatus(): void {
    const status = this.statusForm.getRawValue().status as WorkItemStatus;
    this.statusError.set(null);
    this.isTransitioning.set(true);

    this.api.transitionWorkItem(this.workItemId(), { status }).subscribe({
      next: (workItem) => {
        this.applyWorkItem(workItem);
        this.isTransitioning.set(false);
      },
      error: () => {
        this.statusError.set('The requested status transition was rejected.');
        this.isTransitioning.set(false);
      }
    });
  }

  addComment(): void {
    this.hasSubmittedComment.set(true);
    this.commentError.set(null);

    if (this.commentForm.invalid) {
      this.commentForm.markAllAsTouched();
      return;
    }

    this.isCommenting.set(true);
    this.api.createComment(this.workItemId(), { body: this.commentForm.getRawValue().body.trim() }).subscribe({
      next: () => {
        this.commentForm.reset();
        this.hasSubmittedComment.set(false);
        this.refreshAfterComment();
      },
      error: () => {
        this.commentError.set('The comment could not be added.');
        this.isCommenting.set(false);
      }
    });
  }

  toggleLabel(labelId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const selected = new Set(this.selectedLabelIds());

    if (checked) {
      selected.add(labelId);
    } else {
      selected.delete(labelId);
    }

    this.selectedLabelIds.set([...selected]);
  }

  isLabelSelected(labelId: string): boolean {
    return this.selectedLabelIds().includes(labelId);
  }

  loadProjectLabels(projectId: string): void {
    this.labelLoadError.set(null);

    this.api.listProjectLabels(projectId).subscribe({
      next: (labels) => {
        this.availableLabels.set(labels);
      },
      error: () => {
        this.labelLoadError.set('Project labels could not be loaded from the API.');
      }
    });
  }

  showTitleError(): boolean {
    const control = this.detailForm.controls.title;
    return control.invalid && (control.touched || this.hasSubmittedDetail());
  }

  showCommentError(): boolean {
    const control = this.commentForm.controls.body;
    return control.invalid && (control.touched || this.hasSubmittedComment());
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  formatEventType(event: ActivityEventDto): string {
    return this.formatToken(event.eventType.replace('.', ' '));
  }

  private refreshAfterComment(): void {
    this.api.getWorkItem(this.workItemId()).subscribe({
      next: (workItem) => {
        this.applyWorkItem(workItem);
        this.isCommenting.set(false);
      },
      error: () => {
        this.commentError.set('The comment was added, but the latest activity could not be loaded.');
        this.isCommenting.set(false);
      }
    });
  }

  private applyWorkItem(workItem: WorkItemDetailDto): void {
    this.workItem.set(workItem);
    this.selectedLabelIds.set(workItem.labels.map((label) => label.id));
    this.mergeAvailableLabels(workItem.labels);
    this.detailForm.reset({
      title: workItem.title,
      description: workItem.description,
      type: workItem.type,
      priority: workItem.priority,
      assigneeId: workItem.assignee?.id ?? ''
    });
    this.statusForm.reset({ status: workItem.status });
  }

  private toUpdateRequest(): UpdateWorkItemRequest {
    const formValue = this.detailForm.getRawValue();

    return {
      title: formValue.title.trim(),
      description: formValue.description.trim(),
      type: formValue.type as WorkItemType,
      priority: formValue.priority as WorkItemPriority,
      assigneeId: formValue.assigneeId === '' ? null : formValue.assigneeId,
      labelIds: this.selectedLabelIds()
    };
  }

  private mergeAvailableLabels(labels: LabelDto[]): void {
    const labelsById = new Map(this.availableLabels().map((label) => [label.id, label]));

    for (const label of labels) {
      labelsById.set(label.id, label);
    }

    this.availableLabels.set([...labelsById.values()].sort((left, right) => left.name.localeCompare(right.name)));
  }
}
