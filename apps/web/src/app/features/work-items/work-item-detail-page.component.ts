import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  ActivityEventDto,
  CommentDto,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectDto,
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
          <div class="work-item-meta">
            <span>{{ item.displayKey }}</span>
          </div>
          <p>{{ item.description || 'No description provided.' }}</p>
        </div>

        <a [routerLink]="['/projects', item.projectId, 'work-items']">Back to list</a>
      </section>

      @if (isArchivedProject()) {
        <section class="notice" aria-label="Archived project">
          <strong>Archived project</strong>
          <p>Project work is read-only until it is reactivated in settings.</p>
        </section>
      }

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
            <textarea
              id="detail-description"
              rows="5"
              formControlName="description"
            ></textarea>

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
                  @for (member of assigneeOptions(); track member.id) {
                    <option [value]="member.id">{{ memberDisplayName(member) }}</option>
                  }
                </select>
              </label>

              <label>
                <span>Milestone</span>
                <select formControlName="milestoneId">
                  <option value="">No milestone</option>
                  @for (milestone of availableMilestones(); track milestone.id) {
                    <option [value]="milestone.id">{{ milestone.name }}</option>
                  }
                </select>
              </label>
            </div>

            @if (milestoneLoadError()) {
              <app-error-panel
                title="Milestones unavailable"
                [message]="milestoneLoadError() ?? ''"
                (retry)="loadProjectMilestones(item.projectId)"
              />
            }

            <section class="label-editor" aria-label="Labels">
              <h3>Labels</h3>
              @if (labelLoadError()) {
                <app-error-panel
                  title="Labels unavailable"
                  [message]="labelLoadError() ?? ''"
                  (retry)="loadProjectLabels(item.projectId)"
                />
              } @else if (assignableLabels().length === 0 && archivedAttachedLabels().length === 0) {
                <p>No project labels are available.</p>
              } @else {
                @if (assignableLabels().length > 0) {
                  <div class="label-options">
                    @for (label of assignableLabels(); track label.id) {
                      <label class="label-option">
                        <input
                          type="checkbox"
                          [checked]="isLabelSelected(label.id)"
                          [disabled]="isArchivedProject()"
                          (change)="toggleLabel(label.id, $event)"
                        />
                        <span [style.background]="label.color ?? '#e2e8f0'"></span>
                        {{ label.name }}
                      </label>
                    }
                  </div>
                }

                @if (archivedAttachedLabels().length > 0) {
                  <div class="archived-labels" aria-label="Archived attached labels">
                    @for (label of archivedAttachedLabels(); track label.id) {
                      <span [style.border-color]="label.color ?? '#cbd5e1'">{{ label.name }}</span>
                    }
                  </div>
                }
              }
            </section>

            @if (updateError()) {
              <app-error-panel
                title="Update failed"
                [message]="updateError() ?? ''"
                (retry)="updateWorkItem()"
              />
            }

            <button type="submit" [disabled]="isArchivedProject() || isUpdating()">
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

              <button type="submit" [disabled]="isArchivedProject() || isTransitioning()">
                {{ isTransitioning() ? 'Updating...' : 'Update status' }}
              </button>
            </form>
          </section>

          <section class="panel" aria-labelledby="metadata-heading">
            <h2 id="metadata-heading">Metadata</h2>
            <dl class="metadata">
              <div>
                <dt>Reporter</dt>
                <dd>{{ memberDisplayName(item.reporter) }}</dd>
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
                <dt>Milestone</dt>
                <dd>{{ item.milestone?.name ?? 'None' }}</dd>
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
                    <div>
                      <strong>{{ comment.author.name }}</strong>
                      @if (!comment.author.isActive) {
                        <span class="inactive-marker">Inactive</span>
                      }
                      @if (comment.isEdited && comment.editedAt !== null && !comment.isDeleted) {
                        <span class="comment-marker">Edited {{ formatDateTime(comment.editedAt) }}</span>
                      }
                    </div>
                    <time>{{ formatDateTime(comment.createdAt) }}</time>
                  </header>

                  @if (comment.isDeleted) {
                    <p class="comment-tombstone">
                      {{ deletedCommentText(comment) }}
                    </p>
                  } @else if (editingCommentId() === comment.id) {
                    <form
                      class="comment-edit-form"
                      [formGroup]="editCommentForm"
                      (ngSubmit)="saveComment(comment)"
                      novalidate
                    >
                      <label [for]="'comment-edit-' + comment.id">Edit comment</label>
                      <textarea
                        [id]="'comment-edit-' + comment.id"
                        rows="4"
                        formControlName="body"
                      ></textarea>
                      @if (showEditCommentError()) {
                        <p class="field-error">Comment body is required.</p>
                      }

                      <div class="comment-actions">
                        <button type="submit" [disabled]="savingCommentId() === comment.id">
                          {{ savingCommentId() === comment.id ? 'Saving...' : 'Save' }}
                        </button>
                        <button type="button" class="secondary-action" (click)="cancelEditComment()">
                          Cancel
                        </button>
                      </div>
                    </form>
                  } @else {
                    <p>{{ comment.body }}</p>

                    @if (canModifyComment(comment)) {
                      <div class="comment-actions">
                        <button type="button" class="secondary-action" (click)="startEditComment(comment)">
                          Edit
                        </button>
                        <button type="button" class="danger-action" (click)="confirmDeleteComment(comment)">
                          Delete
                        </button>
                      </div>
                    }

                    @if (confirmingDeleteCommentId() === comment.id) {
                      <div class="delete-confirmation" role="group" aria-label="Delete comment confirmation">
                        <span>Delete this comment?</span>
                        <button
                          type="button"
                          class="danger-action"
                          [disabled]="deletingCommentId() === comment.id"
                          (click)="deleteComment(comment)"
                        >
                          {{ deletingCommentId() === comment.id ? 'Deleting...' : 'Delete comment' }}
                        </button>
                        <button type="button" class="secondary-action" (click)="cancelDeleteComment()">
                          Cancel
                        </button>
                      </div>
                    }
                  }
                </article>
              }
            </div>
          }

          @if (commentMutationError()) {
            <app-error-panel
              title="Comment action failed"
              [message]="commentMutationError() ?? ''"
              (retry)="clearCommentMutationError()"
            />
          }

          <form class="comment-form" [formGroup]="commentForm" (ngSubmit)="addComment()" novalidate>
            <label for="comment-body">Add comment</label>
            <textarea
              id="comment-body"
              rows="4"
              formControlName="body"
            ></textarea>
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

            <button type="submit" [disabled]="isArchivedProject() || isCommenting()">
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
                  <span>{{ memberDisplayName(event.actor) }} · {{ formatEventType(event) }} · {{ formatDateTime(event.createdAt) }}</span>
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

    .work-item-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }

    .work-item-meta span {
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      padding: 3px 9px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 0.75rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .notice {
      display: grid;
      gap: 4px;
      margin-bottom: 18px;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 14px;
      background: #fff7ed;
      color: #9a3412;
    }

    .notice p {
      margin: 0;
      color: #9a3412;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .detail-header a,
    button,
    .secondary-action,
    .danger-action {
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

    .detail-header a,
    .secondary-action {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    .danger-action {
      border-color: #fecaca;
      background: #fff1f2;
      color: #991b1b;
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
    .comment-edit-form,
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

    .archived-labels {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .archived-labels span {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 8px;
      background: #f8fafc;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      text-decoration: line-through;
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

    .comment header div {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .comment time,
    .comment-marker,
    .activity-list span {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .inactive-marker {
      display: inline-flex;
      min-height: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      padding: 2px 7px;
      background: #f8fafc;
      color: #64748b;
      font-size: 0.6875rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .comment p,
    .activity-list strong {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .comment-tombstone {
      color: #64748b !important;
      font-style: italic;
    }

    .comment-actions,
    .delete-confirmation {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 10px;
    }

    .delete-confirmation {
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px;
      background: #fff7f7;
      color: #991b1b;
      font-size: 0.8125rem;
      font-weight: 800;
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
  readonly assigneeOptions = computed<MemberDto[]>(() => {
    const membersById = new Map(this.currentUser.activeMembers().map((member) => [member.id, member]));
    const currentAssignee = this.workItem()?.assignee;

    if (currentAssignee !== null && currentAssignee !== undefined) {
      membersById.set(currentAssignee.id, currentAssignee);
    }

    return [...membersById.values()].sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  });
  readonly workItemId = computed(() => this.route.snapshot.paramMap.get('workItemId') ?? '');

  readonly project = signal<ProjectDto | null>(null);
  readonly workItem = signal<WorkItemDetailDto | null>(null);
  readonly selectedLabelIds = signal<string[]>([]);
  readonly isLoading = signal(false);
  readonly isUpdating = signal(false);
  readonly isTransitioning = signal(false);
  readonly isCommenting = signal(false);
  readonly savingCommentId = signal<string | null>(null);
  readonly deletingCommentId = signal<string | null>(null);
  readonly editingCommentId = signal<string | null>(null);
  readonly confirmingDeleteCommentId = signal<string | null>(null);
  readonly hasSubmittedDetail = signal(false);
  readonly hasSubmittedComment = signal(false);
  readonly hasSubmittedEditComment = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly updateError = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);
  readonly commentError = signal<string | null>(null);
  readonly commentMutationError = signal<string | null>(null);
  readonly labelLoadError = signal<string | null>(null);
  readonly milestoneLoadError = signal<string | null>(null);
  readonly availableLabels = signal<LabelDto[]>([]);
  readonly availableMilestones = signal<MilestoneDto[]>([]);
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');
  readonly assignableLabels = computed(() => this.availableLabels().filter((label) => !label.isArchived));
  readonly archivedAttachedLabels = computed(() =>
    (this.workItem()?.labels ?? []).filter((label) => label.isArchived)
  );

  readonly detailForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    type: ['task'],
    priority: ['medium'],
    assigneeId: [''],
    milestoneId: ['']
  });

  readonly statusForm = this.formBuilder.nonNullable.group({
    status: ['backlog']
  });

  readonly commentForm = this.formBuilder.nonNullable.group({
    body: ['', [Validators.required]]
  });

  readonly editCommentForm = this.formBuilder.nonNullable.group({
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
        this.loadProject(workItem.projectId);
        this.loadProjectLabels(workItem.projectId);
        this.loadProjectMilestones(workItem.projectId);
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

    if (this.isArchivedProject()) {
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
    if (this.isArchivedProject()) {
      return;
    }

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

    if (this.isArchivedProject()) {
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

  startEditComment(comment: CommentDto): void {
    if (!this.canModifyComment(comment)) {
      return;
    }

    this.commentMutationError.set(null);
    this.confirmingDeleteCommentId.set(null);
    this.editingCommentId.set(comment.id);
    this.hasSubmittedEditComment.set(false);
    this.editCommentForm.reset({ body: comment.body });
  }

  cancelEditComment(): void {
    this.editingCommentId.set(null);
    this.hasSubmittedEditComment.set(false);
    this.editCommentForm.reset({ body: '' });
  }

  saveComment(comment: CommentDto): void {
    this.hasSubmittedEditComment.set(true);
    this.commentMutationError.set(null);

    if (!this.canModifyComment(comment)) {
      return;
    }

    if (this.editCommentForm.invalid) {
      this.editCommentForm.markAllAsTouched();
      return;
    }

    this.savingCommentId.set(comment.id);
    this.api.updateComment(comment.id, { body: this.editCommentForm.getRawValue().body.trim() }).subscribe({
      next: () => {
        this.refreshAfterCommentMutation(() => {
          this.savingCommentId.set(null);
          this.cancelEditComment();
        });
      },
      error: () => {
        this.commentMutationError.set('The comment could not be updated.');
        this.savingCommentId.set(null);
      }
    });
  }

  confirmDeleteComment(comment: CommentDto): void {
    if (!this.canModifyComment(comment)) {
      return;
    }

    this.commentMutationError.set(null);
    this.editingCommentId.set(null);
    this.confirmingDeleteCommentId.set(comment.id);
  }

  cancelDeleteComment(): void {
    this.confirmingDeleteCommentId.set(null);
  }

  deleteComment(comment: CommentDto): void {
    this.commentMutationError.set(null);

    if (!this.canModifyComment(comment)) {
      return;
    }

    this.deletingCommentId.set(comment.id);
    this.api.deleteComment(comment.id).subscribe({
      next: () => {
        this.refreshAfterCommentMutation(() => {
          this.deletingCommentId.set(null);
          this.cancelDeleteComment();
        });
      },
      error: () => {
        this.commentMutationError.set('The comment could not be deleted.');
        this.deletingCommentId.set(null);
      }
    });
  }

  clearCommentMutationError(): void {
    this.commentMutationError.set(null);
  }

  toggleLabel(labelId: string, event: Event): void {
    if (this.isArchivedProject()) {
      return;
    }

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
        this.availableLabels.set(labels.filter((label) => !label.isArchived));
      },
      error: () => {
        this.labelLoadError.set('Project labels could not be loaded from the API.');
      }
    });
  }

  loadProjectMilestones(projectId: string): void {
    this.milestoneLoadError.set(null);

    this.api.listProjectMilestones(projectId).subscribe({
      next: (milestones) => {
        this.availableMilestones.set(this.sortMilestones(this.mergeCurrentMilestone(milestones)));
      },
      error: () => {
        this.milestoneLoadError.set('Project milestones could not be loaded from the API.');
      }
    });
  }

  loadProject(projectId: string): void {
    this.api.getProject(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        this.syncReadOnlyState();
      },
      error: () => {
        this.project.set(null);
        this.syncReadOnlyState();
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

  showEditCommentError(): boolean {
    const control = this.editCommentForm.controls.body;
    return control.invalid && (control.touched || this.hasSubmittedEditComment());
  }

  canModifyComment(comment: CommentDto): boolean {
    const actor = this.currentUser.selectedMember();

    if (this.isArchivedProject() || comment.isDeleted || actor === null) {
      return false;
    }

    return actor.role === 'owner' || actor.role === 'maintainer' || comment.author.id === actor.id;
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

  memberDisplayName(member: MemberDto): string {
    return member.isActive ? member.name : `${member.name} (inactive)`;
  }

  deletedCommentText(comment: CommentDto): string {
    const actor = comment.deletedBy === null ? '' : ` by ${this.memberDisplayName(comment.deletedBy)}`;
    const timestamp = comment.deletedAt === null ? '' : ` on ${this.formatDateTime(comment.deletedAt)}`;
    return `Comment deleted${actor}${timestamp}.`;
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

  private refreshAfterCommentMutation(afterRefresh: () => void): void {
    this.api.getWorkItem(this.workItemId()).subscribe({
      next: (workItem) => {
        this.applyWorkItem(workItem);
        afterRefresh();
      },
      error: () => {
        this.commentMutationError.set('The comment changed, but the latest activity could not be loaded.');
        afterRefresh();
      }
    });
  }

  private applyWorkItem(workItem: WorkItemDetailDto): void {
    this.workItem.set(workItem);
    this.selectedLabelIds.set(workItem.labels.filter((label) => !label.isArchived).map((label) => label.id));
    this.mergeAvailableLabels(workItem.labels);
    this.detailForm.reset({
      title: workItem.title,
      description: workItem.description,
      type: workItem.type,
      priority: workItem.priority,
      assigneeId: workItem.assignee?.id ?? '',
      milestoneId: workItem.milestone?.id ?? ''
    });
    this.statusForm.reset({ status: workItem.status });
    this.syncReadOnlyState();
  }

  private toUpdateRequest(): UpdateWorkItemRequest {
    const formValue = this.detailForm.getRawValue();

    return {
      title: formValue.title.trim(),
      description: formValue.description.trim(),
      type: formValue.type as WorkItemType,
      priority: formValue.priority as WorkItemPriority,
      assigneeId: formValue.assigneeId === '' ? null : formValue.assigneeId,
      milestoneId: formValue.milestoneId === '' ? null : formValue.milestoneId,
      labelIds: [...this.selectedLabelIds(), ...this.archivedAttachedLabels().map((label) => label.id)]
    };
  }

  private mergeCurrentMilestone(milestones: MilestoneDto[]): MilestoneDto[] {
    const current = this.workItem()?.milestone;

    if (current === null || current === undefined) {
      return milestones;
    }

    const milestonesById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
    milestonesById.set(current.id, current);
    return [...milestonesById.values()];
  }

  private sortMilestones(milestones: MilestoneDto[]): MilestoneDto[] {
    return [...milestones].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private mergeAvailableLabels(labels: LabelDto[]): void {
    const labelsById = new Map(this.availableLabels().map((label) => [label.id, label]));

    for (const label of labels) {
      labelsById.set(label.id, label);
    }

    this.availableLabels.set([...labelsById.values()].sort((left, right) => left.name.localeCompare(right.name)));
  }

  private syncReadOnlyState(): void {
    const options = { emitEvent: false };

    if (this.isArchivedProject()) {
      this.detailForm.disable(options);
      this.statusForm.disable(options);
      this.commentForm.disable(options);
      this.editCommentForm.disable(options);
    } else {
      this.detailForm.enable(options);
      this.statusForm.enable(options);
      this.commentForm.enable(options);
      this.editCommentForm.enable(options);
    }
  }
}
