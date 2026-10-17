import { normalizeAuthoredContentSource } from '@worktrail/contracts';
import { DraftTracker } from '../../core/navigation/draft-tracker';
import { DraftDepartureCoordinator, draftRouteKey } from '../../core/navigation/draft-departure-coordinator';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  CommentDto,
  CreateCommentRequest,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectCycleDto,
  ProjectDto,
  UpdateWorkItemRequest,
  WorkItemDetailDto,
  WorkItemPriority,
  WorkItemRelationshipItemDto,
  WorkItemRelationshipType,
  WorkItemStatus,
  WorkItemType,
  WorkItemWatchStateDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import type { MonoTypeOperatorFunction, Subscription } from 'rxjs';
import { merge } from 'rxjs';

import { PageContext } from '../../core/navigation/page-context';
import { CurrentUserService } from '../../core/current-user.service';
import { CyclesApi } from '../../core/api/cycles-api';
import { ProjectsApi } from '../../core/api/projects-api';
import { WorkItemsApi } from '../../core/api/work-items-api';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { AuthoredContentEditorComponent } from '../../shared/authored-content/authored-content-editor.component';
import { AuthoredContentViewerComponent } from '../../shared/authored-content/authored-content-viewer.component';
import { authoredContentValidator } from '../../shared/authored-content/authored-content-validation';
import {
  authoredContentEquals,
  type AuthoredContentValue
} from '../../shared/authored-content/authored-content-value';
import { ActivityTimelineComponent } from './components/activity-timeline.component';
import { WorkItemAttachmentsComponent } from './components/work-item-attachments.component';
import { WorkItemChildWorkComponent } from './components/work-item-child-work.component';
import { WorkItemDetailSummaryComponent } from './components/work-item-detail-summary.component';
import { WorkItemParentContextComponent } from './components/work-item-parent-context.component';
import { WorkItemParentManagerComponent } from './components/work-item-parent-manager.component';
import { workItemFilesFragment } from './work-item-files-target';

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
const terminalStatuses = new Set<WorkItemStatus>(['done', 'canceled']);
type RelationshipKind = 'blocked_by' | 'blocks' | 'related';

@Component({
  selector: 'app-work-item-detail-page',
  host: { '[attr.inert]': 'departure.isDeparting() ? "": null' },
  imports: [
    AuthoredContentEditorComponent,
    AuthoredContentViewerComponent,
    ActivityTimelineComponent,
    EmptyStateComponent,
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
    WorkItemAttachmentsComponent,
    WorkItemChildWorkComponent,
    WorkItemDetailSummaryComponent,
    WorkItemParentContextComponent,
    WorkItemParentManagerComponent
  ],
  template: `
    @if (isLoading()) {
      <app-loading-indicator label="Loading work item" />
    } @else if (loadError()) {
      <app-error-panel [message]="loadError() ?? ''" (retry)="loadWorkItem()" />
    } @else if (workItem(); as item) {
      <section class="detail-header">
        <div class="summary-block" aria-labelledby="work-item-summary-heading">
          <p class="section-eyebrow">Summary</p>
          <span id="work-item-summary-heading" class="visually-hidden">Work item summary</span>
          <app-work-item-detail-summary [item]="item" />
          @if (item.parent; as parent) {
            <app-work-item-parent-context [parent]="parent" [returnUrl]="detailSelfUrl()" />
          }
        </div>

        <div class="detail-header__actions">
          <a [routerLink]="returnTarget().path" [queryParams]="returnTarget().queryParams">
            {{ returnTarget().label }}
          </a>
          @if (canAddChildWorkItem()) {
            <a
              [routerLink]="['/projects', item.projectId, 'work-items', 'new']"
              [queryParams]="{ parentWorkItemId: item.id, returnUrl: detailSelfUrl() }"
            >
              Add child work item
            </a>
          }
        </div>
      </section>

      @if (isArchivedProject()) {
        <section class="notice" aria-label="Archived project">
          <strong>Archived project</strong>
          <p>Project work is read-only until it is reactivated in settings.</p>
        </section>
      } @else if (isTerminalStatusReadOnly()) {
        <section class="notice" aria-label="Terminal work item">
          <strong>Terminal work item</strong>
          <p>Only owners and maintainers can reopen done or canceled work items.</p>
        </section>
      }

      @if (item.relationships.openBlockerCount > 0 || item.relationships.openBlockedWorkCount > 0) {
        <section class="dependency-alert" aria-label="Dependency state">
          <strong>{{ dependencyStateLabel(item) }}</strong>
          <p>
            Review dependencies before changing status or publishing updates that reference this
            work.
          </p>
        </section>
      }

      <app-work-item-parent-manager
        [item]="item"
        [readOnly]="isArchivedProject()"
        (parentChanged)="applyParentChange($event)"
      />

      @if (item.childSummary !== null) {
        <app-work-item-child-work [item]="item" [readOnly]="isArchivedProject()" />
      }

      <section class="detail-grid">
        <section class="panel" aria-labelledby="edit-work-item-heading">
          <p class="section-eyebrow">Act</p>
          <h2 id="edit-work-item-heading">Edit work item</h2>

          <form
            class="detail-form"
            [formGroup]="detailForm"
            (ngSubmit)="updateWorkItem()"
            novalidate
          >
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

            <app-authored-content-editor
              fieldId="detail-description"
              label="Description"
              [rows]="5"
              formControlName="descriptionContent"
              [resetIdentity]="descriptionEditorIdentity()"
              [invalid]="showDescriptionError()"
              errorDescriptionIds="detail-description-error"
            />
            @if (showDescriptionError()) {
              <p id="detail-description-error" class="field-error">
                Changed descriptions must be 10,000 characters or fewer.
              </p>
            }

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

              <label>
                <span>Cycle</span>
                <select formControlName="cycleId">
                  <option value="">No cycle</option>
                  @for (cycle of availableCycles(); track cycle.id) {
                    <option [value]="cycle.id">{{ cycle.name }}</option>
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

            @if (cycleLoadError()) {
              <app-error-panel
                title="Cycles unavailable"
                [message]="cycleLoadError() ?? ''"
                (retry)="loadProjectCycles(item.projectId)"
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
              } @else if (
                assignableLabels().length === 0 && archivedAttachedLabels().length === 0
              ) {
                <p>No project labels are available.</p>
              } @else {
                @if (assignableLabels().length > 0) {
                  <div class="label-options">
                    @for (label of assignableLabels(); track label.id) {
                      <label class="label-option">
                        <input
                          type="checkbox"
                          [checked]="isLabelSelected(label.id)"
                          [disabled]="isArchivedProject() || isUpdating()"
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
            <button
              type="button"
              class="secondary-action"
              [disabled]="isArchivedProject() || isUpdating()"
              (click)="requestDiscardDetailChanges()"
            >
              Discard changes
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

              <button type="submit" [disabled]="isStatusTransitionReadOnly() || isTransitioning()">
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
                <dt>Cycle</dt>
                <dd>{{ item.cycle?.name ?? 'None' }}</dd>
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

      <section class="panel relationship-panel" aria-labelledby="relationships-heading">
        <div class="panel-heading">
          <div>
            <p class="section-eyebrow">Dependencies</p>
            <h2 id="relationships-heading">Blocking and related work</h2>
            <p>Connect blockers, downstream work, and related items across the workspace.</p>
          </div>
        </div>

        <div class="relationship-grid">
          <section class="relationship-group" aria-labelledby="blocked-by-heading">
            <h3 id="blocked-by-heading">Blocked by</h3>
            @if (item.relationships.blockedBy.length === 0) {
              <p class="muted">No blockers linked.</p>
            } @else {
              <div class="relationship-list">
                @for (relationship of item.relationships.blockedBy; track relationship.id) {
                  <article class="relationship-row">
                    <div>
                      <span class="relationship-project">
                        {{ relationship.workItem.project.key }} · {{ relationship.workItem.project.name }}
                      </span>
                      <a [routerLink]="['/work-items', relationship.workItem.id]">
                        {{ relationship.workItem.displayKey }} {{ relationship.workItem.title }}
                      </a>
                      <span class="relationship-meta">
                        {{ formatToken(relationship.workItem.status) }} ·
                        {{ formatToken(relationship.workItem.priority) }} ·
                        {{ relationship.workItem.assignee === null ? 'Unassigned' : memberDisplayName(relationship.workItem.assignee) }}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="danger-action"
                      [disabled]="isRelationshipReadOnly() || removingRelationshipId() === relationship.id"
                      (click)="removeRelationship(relationship)"
                    >
                      {{ removingRelationshipId() === relationship.id ? 'Removing...' : 'Remove' }}
                    </button>
                  </article>
                }
              </div>
            }
          </section>

          <section class="relationship-group" aria-labelledby="blocks-heading">
            <h3 id="blocks-heading">Blocks</h3>
            @if (item.relationships.blocks.length === 0) {
              <p class="muted">No blocked work linked.</p>
            } @else {
              <div class="relationship-list">
                @for (relationship of item.relationships.blocks; track relationship.id) {
                  <article class="relationship-row">
                    <div>
                      <span class="relationship-project">
                        {{ relationship.workItem.project.key }} · {{ relationship.workItem.project.name }}
                      </span>
                      <a [routerLink]="['/work-items', relationship.workItem.id]">
                        {{ relationship.workItem.displayKey }} {{ relationship.workItem.title }}
                      </a>
                      <span class="relationship-meta">
                        {{ formatToken(relationship.workItem.status) }} ·
                        {{ formatToken(relationship.workItem.priority) }} ·
                        {{ relationship.workItem.assignee === null ? 'Unassigned' : memberDisplayName(relationship.workItem.assignee) }}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="danger-action"
                      [disabled]="isRelationshipReadOnly() || removingRelationshipId() === relationship.id"
                      (click)="removeRelationship(relationship)"
                    >
                      {{ removingRelationshipId() === relationship.id ? 'Removing...' : 'Remove' }}
                    </button>
                  </article>
                }
              </div>
            }
          </section>

          <section class="relationship-group" aria-labelledby="related-heading">
            <h3 id="related-heading">Related work</h3>
            @if (item.relationships.related.length === 0) {
              <p class="muted">No related work linked.</p>
            } @else {
              <div class="relationship-list">
                @for (relationship of item.relationships.related; track relationship.id) {
                  <article class="relationship-row">
                    <div>
                      <span class="relationship-project">
                        {{ relationship.workItem.project.key }} · {{ relationship.workItem.project.name }}
                      </span>
                      <a [routerLink]="['/work-items', relationship.workItem.id]">
                        {{ relationship.workItem.displayKey }} {{ relationship.workItem.title }}
                      </a>
                      <span class="relationship-meta">
                        {{ formatToken(relationship.workItem.status) }} ·
                        {{ formatToken(relationship.workItem.priority) }} ·
                        {{ relationship.workItem.assignee === null ? 'Unassigned' : memberDisplayName(relationship.workItem.assignee) }}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="danger-action"
                      [disabled]="isRelationshipReadOnly() || removingRelationshipId() === relationship.id"
                      (click)="removeRelationship(relationship)"
                    >
                      {{ removingRelationshipId() === relationship.id ? 'Removing...' : 'Remove' }}
                    </button>
                  </article>
                }
              </div>
            }
          </section>
        </div>

        <form
          class="relationship-form"
          [formGroup]="relationshipForm"
          (ngSubmit)="addRelationship()"
          novalidate
        >
          <div class="relationship-form-grid">
            <label>
              <span>Relationship</span>
              <select formControlName="kind">
                <option value="blocked_by">Add blocker</option>
                <option value="blocks">Add blocked work</option>
                <option value="related">Add related work</option>
              </select>
            </label>

            <label>
              <span>Find work item</span>
              <input type="search" formControlName="search" placeholder="Key, title, or description" />
            </label>

            <button type="button" class="secondary-action" [disabled]="isRelationshipReadOnly() || isSearchingCandidates()" (click)="searchRelationshipCandidates()">
              {{ isSearchingCandidates() ? 'Searching...' : 'Search' }}
            </button>
          </div>

          @if (candidateSearchError()) {
            <app-error-panel
              title="Search failed"
              [message]="candidateSearchError() ?? ''"
              (retry)="searchRelationshipCandidates()"
            />
          }

          @if (relationshipCandidates().length > 0) {
            <div class="candidate-list" aria-label="Relationship candidates">
              @for (candidate of relationshipCandidates(); track candidate.id) {
                <button
                  type="button"
                  class="candidate-row"
                  [class.selected]="relationshipForm.getRawValue().targetWorkItemId === candidate.id"
                  [disabled]="isRelationshipReadOnly() || isAlreadyLinked(candidate.id)"
                  (click)="selectRelationshipCandidate(candidate)"
                >
                  <span>
                    <strong>{{ candidate.displayKey }} {{ candidate.title }}</strong>
                    <small>
                      {{ candidate.project.key }} · {{ candidate.project.name }} ·
                      {{ formatToken(candidate.status) }} · {{ formatToken(candidate.priority) }} ·
                      {{ candidate.assignee === null ? 'Unassigned' : memberDisplayName(candidate.assignee) }}
                    </small>
                  </span>
                  @if (isAlreadyLinked(candidate.id)) {
                    <span class="linked-marker">Linked</span>
                  }
                </button>
              }
            </div>
          } @else if (hasSearchedRelationshipCandidates()) {
            <p class="muted">No matching work items found.</p>
          }

          @if (relationshipCandidatesHaveMore()) {
            <p class="muted">More matches are available. Refine the search to narrow the results.</p>
          }

          @if (relationshipError()) {
            <app-error-panel
              title="Relationship not changed"
              [message]="relationshipError() ?? ''"
              (retry)="addRelationship()"
            />
          }

          <button type="submit" [disabled]="isRelationshipReadOnly() || isAddingRelationship()">
            {{ isAddingRelationship() ? 'Adding...' : relationshipActionLabel() }}
          </button>
        </form>
      </section>

      <app-work-item-attachments
        [workItemId]="item.id"
        [focusWhenSettled]="filesTargetGeneration()"
        (activityChanged)="refreshAttachmentActivity()"
      />

      <section class="collaboration-grid">
        <section class="panel" aria-labelledby="comments-heading">
          <p class="section-eyebrow">Collaborate</p>
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
                      <app-authored-content-editor
                        [fieldId]="'comment-edit-' + comment.id"
                        label="Edit comment"
                        [rows]="4"
                        formControlName="bodyContent"
                        [resetIdentity]="editCommentIdentity()"
                        [invalid]="showEditCommentError()"
                        [errorDescriptionIds]="'comment-edit-error-' + comment.id"
                      />
                      @if (showEditCommentError()) {
                        <p class="field-error" [id]="'comment-edit-error-' + comment.id">
                          {{ commentValidationMessage(true) }}
                        </p>
                      }

                      <div class="comment-actions">
                        <button
                          type="submit"
                          [disabled]="isArchivedProject() || savingCommentId() === comment.id"
                        >
                          {{ savingCommentId() === comment.id ? 'Saving...' : 'Save' }}
                        </button>
                        <button type="button" class="secondary-action" (click)="requestCancelCommentEdit()">
                          Cancel
                        </button>
                      </div>
                    </form>
                  } @else {
                    <app-authored-content-viewer
                      [source]="comment.body"
                      [format]="comment.bodyFormat"
                    />

                    @if (comment.mentions.length > 0) {
                      <div class="comment-mentions" aria-label="Mentioned members">
                        @for (mention of comment.mentions; track mention.id) {
                          <span>{{ '@' + memberDisplayName(mention) }}</span>
                        }
                      </div>
                    }

                    @if (canModifyComment(comment)) {
                      <div class="comment-actions">
                        <button type="button" class="secondary-action" (click)="requestEditComment(comment)">
                          Edit
                        </button>
                        <button type="button" class="danger-action" (click)="requestDeleteComment(comment)">
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
                          [disabled]="isArchivedProject() || deletingCommentId() === comment.id"
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

          @if (discussionRefreshError()) {
            <app-error-panel
              title="Discussion not refreshed"
              [message]="discussionRefreshError() ?? ''"
              (retry)="refreshDiscussion()"
            />
          }

          <form class="comment-form" [formGroup]="commentForm" (ngSubmit)="addComment()" novalidate>
            <app-authored-content-editor
              fieldId="comment-body"
              label="Add comment"
              [rows]="4"
              formControlName="bodyContent"
              [resetIdentity]="newCommentIdentity()"
              [invalid]="showCommentError()"
              errorDescriptionIds="comment-body-error"
            />
            @if (showCommentError()) {
              <p id="comment-body-error" class="field-error">{{ commentValidationMessage() }}</p>
            }

            <section class="mention-picker" aria-label="Comment mentions">
              <label for="comment-mention-member">Mention members</label>
              <div class="mention-controls">
                <select
                  id="comment-mention-member"
                  #mentionSelect
                  [disabled]="
                    isArchivedProject() || isCommenting() || availableMentionMembers().length === 0
                  "
                  (change)="addMentionMember(mentionSelect.value); mentionSelect.value = ''"
                >
                  <option value="">Add mention</option>
                  @for (member of availableMentionMembers(); track member.id) {
                    <option [value]="member.id">{{ memberDisplayName(member) }}</option>
                  }
                </select>
              </div>

              @if (selectedMentionMembers().length > 0) {
                <div class="mention-chips" aria-label="Selected mentions">
                  @for (member of selectedMentionMembers(); track member.id) {
                    <span>
                      {{ memberDisplayName(member) }}
                      <button
                        type="button"
                        class="chip-remove"
                        [disabled]="isArchivedProject() || isCommenting()"
                        [attr.aria-label]="'Remove ' + memberDisplayName(member)"
                        (click)="removeMentionMember(member.id)"
                      >
                        x
                      </button>
                    </span>
                  }
                </div>
              } @else {
                <p class="muted">No mentions selected.</p>
              }
            </section>

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

        <section class="panel watch-panel" aria-labelledby="watch-heading">
          <div class="watch-heading">
            <div>
              <p class="section-eyebrow">Collaborate</p>
              <h2 id="watch-heading">Watchers</h2>
              <p>{{ watcherCount() }} watching</p>
            </div>
            <button
              type="button"
              class="secondary-action"
              [disabled]="isArchivedProject() || isWatchLoading() || isWatchUpdating()"
              (click)="toggleWatch()"
            >
              @if (isWatchUpdating()) {
                Updating...
              } @else if (watchState()?.isWatchedByCurrentActor) {
                Unwatch
              } @else {
                Watch
              }
            </button>
          </div>

          @if (watchError()) {
            <app-error-panel
              title="Watchers unavailable"
              [message]="watchError() ?? ''"
              (retry)="loadWatchState()"
            />
          } @else if (isWatchLoading()) {
            <p class="muted">Loading watchers...</p>
          } @else if (watchers().length === 0) {
            <p class="muted">No active watchers.</p>
          } @else {
            <details class="watcher-list">
              <summary>Show watchers</summary>
              <ul>
                @for (watcher of watchers(); track watcher.id) {
                  <li>
                    <span>{{ memberDisplayName(watcher.member) }}</span>
                    <time>{{ formatDateTime(watcher.watchedAt) }}</time>
                  </li>
                }
              </ul>
            </details>
          }
        </section>
      </section>

      <section class="history-section" aria-label="History">
        <p class="section-eyebrow">History</p>
        @if (attachmentActivityError()) {
          <app-error-panel
            title="Activity not refreshed"
            [message]="attachmentActivityError() ?? ''"
            (retry)="refreshAttachmentActivity()"
          />
        }
        <app-activity-timeline [events]="item.activity" />
      </section>
    }
  `,
  styles: `
    .detail-header,
    .detail-grid,
    .collaboration-grid,
    .history-section {
      display: grid;
      gap: 18px;
    }

    .detail-header {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      margin-bottom: 20px;
    }

    .detail-header__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .detail-grid,
    .collaboration-grid {
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      align-items: start;
      margin-bottom: 18px;
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

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    .section-eyebrow {
      margin: 0 0 4px;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0;
      line-height: 1.3;
      text-transform: uppercase;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }

    h3 {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    .label-editor p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
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

    .dependency-alert {
      display: grid;
      gap: 4px;
      margin-bottom: 18px;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      padding: 14px;
      background: #fef2f2;
      color: #991b1b;
    }

    .dependency-alert p {
      margin: 0;
      color: #991b1b;
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
      min-width: 0;
      gap: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    app-work-item-parent-manager {
      display: block;
      margin-bottom: 18px;
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

    .watch-panel {
      align-content: start;
    }

    .watch-heading {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
    }

    .watch-heading p {
      margin-top: 3px;
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 800;
      line-height: 1.4;
    }

    .watcher-list {
      display: grid;
      gap: 10px;
      color: #334155;
      font-size: 0.875rem;
    }

    .watcher-list summary {
      cursor: pointer;
      font-weight: 800;
    }

    .watcher-list ul {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .watcher-list li {
      display: grid;
      gap: 2px;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
    }

    .watcher-list time {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
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

    .comment-list {
      min-width: 0;
      grid-template-columns: minmax(0, 1fr);
    }

    .comment {
      min-width: 0;
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
    .comment-marker {
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

    .comment p {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .comment-mentions,
    .mention-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }

    .comment-mentions span,
    .mention-chips span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 8px;
      background: #f8fafc;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .mention-picker {
      display: grid;
      gap: 8px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #f8fafc;
    }

    .mention-controls {
      display: grid;
      gap: 8px;
    }

    .chip-remove {
      min-height: 20px;
      width: 20px;
      border: 0;
      border-radius: 999px;
      padding: 0;
      background: #e2e8f0;
      color: #334155;
      font-size: 0.875rem;
      line-height: 1;
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

      .detail-header__actions {
        justify-content: flex-start;
      }
    }
  `
})
export class WorkItemDetailPageComponent implements OnInit {
  readonly departure = inject(DraftDepartureCoordinator);
  private readonly detailDraft = new DraftTracker(() => this.detailDraftValue());
  private readonly newCommentDraft = new DraftTracker(() => ({
    content: this.normalizedContent(this.commentForm.getRawValue().bodyContent),
    recipients: [...new Set(this.selectedMentionMemberIds())].sort()
  }));
  private readonly editCommentDraft = new DraftTracker(() =>
    this.normalizedContent(this.editCommentForm.getRawValue().bodyContent));
  private detailDraftToken!: symbol;
  private editDraftToken!: symbol;
  private readonly context = new PageContext();
  private readonly projectsApi = inject(ProjectsApi);
  private readonly workItemsApi = inject(WorkItemsApi);
  private readonly cyclesApi = inject(CyclesApi);
  private readonly currentUser = inject(CurrentUserService);
  private readonly destroyRef = inject(DestroyRef);
  private attachmentActivitySubscription: Subscription | null = null;
  private attachmentActivityGeneration = 0;
  private nextFilesTargetGeneration = 0;
  private loadGeneration = 0;
  private descriptionBaseline: AuthoredContentValue | null = null;
  readonly descriptionEditorIdentity = signal(0);
  private commentCreateGeneration = 0;
  private commentDeleteGeneration = 0;
  private discussionRefreshGeneration = 0;
  readonly newCommentIdentity = signal(0);
  readonly editCommentIdentity = signal(0);
  private readonly formBuilder = inject(FormBuilder);

  readonly statuses = statuses;
  readonly types = types;
  readonly priorities = priorities;
  readonly members = computed<MemberDto[]>(() => this.currentUser.members());
  readonly assigneeOptions = computed<MemberDto[]>(() => {
    const membersById = new Map(
      this.currentUser.activeMembers().map((member) => [member.id, member])
    );
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
  readonly workItemId = computed(() => this.context.param('workItemId'));
  readonly filesTargetGeneration = signal<number | null>(null);

  readonly project = signal<ProjectDto | null>(null);
  readonly workItem = signal<WorkItemDetailDto | null>(null);
  readonly selectedLabelIds = signal<string[]>([]);
  readonly isLoading = signal(false);
  readonly isUpdating = signal(false);
  readonly isTransitioning = signal(false);
  readonly isCommenting = signal(false);
  readonly isWatchLoading = signal(false);
  readonly isWatchUpdating = signal(false);
  readonly isSearchingCandidates = signal(false);
  readonly isAddingRelationship = signal(false);
  readonly savingCommentId = signal<string | null>(null);
  readonly deletingCommentId = signal<string | null>(null);
  readonly editingCommentId = signal<string | null>(null);
  readonly confirmingDeleteCommentId = signal<string | null>(null);
  readonly removingRelationshipId = signal<string | null>(null);
  readonly hasSubmittedDetail = signal(false);
  readonly hasSubmittedComment = signal(false);
  readonly hasSubmittedEditComment = signal(false);
  readonly hasSearchedRelationshipCandidates = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly updateError = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);
  readonly commentError = signal<string | null>(null);
  readonly commentMutationError = signal<string | null>(null);
  readonly watchError = signal<string | null>(null);
  readonly relationshipError = signal<string | null>(null);
  readonly candidateSearchError = signal<string | null>(null);
  readonly labelLoadError = signal<string | null>(null);
  readonly milestoneLoadError = signal<string | null>(null);
  readonly cycleLoadError = signal<string | null>(null);
  readonly attachmentActivityError = signal<string | null>(null);
  readonly discussionRefreshError = signal<string | null>(null);
  readonly availableLabels = signal<LabelDto[]>([]);
  readonly availableMilestones = signal<MilestoneDto[]>([]);
  readonly availableCycles = signal<ProjectCycleDto[]>([]);
  readonly relationshipCandidates = signal<WorkspaceWorkItemListItemDto[]>([]);
  readonly relationshipCandidatesHaveMore = signal(false);
  readonly watchState = signal<WorkItemWatchStateDto | null>(null);
  readonly selectedMentionMemberIds = signal<string[]>([]);
  readonly watchers = computed(() => this.watchState()?.watchers ?? []);
  readonly watcherCount = computed(() => this.watchState()?.watcherCount ?? this.watchers().length);
  readonly selectedMentionMembers = computed(() => {
    const membersById = new Map(
      this.currentUser.activeMembers().map((member) => [member.id, member])
    );

    return this.selectedMentionMemberIds()
      .map((memberId) => membersById.get(memberId))
      .filter((member): member is MemberDto => member !== undefined);
  });
  readonly availableMentionMembers = computed(() => {
    const selected = new Set(this.selectedMentionMemberIds());
    return this.currentUser
      .activeMembers()
      .filter((member) => !selected.has(member.id))
      .sort((left, right) => left.name.localeCompare(right.name));
  });
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');
  readonly detailSelfUrl = computed(() => `/work-items/${this.workItemId()}`);
  readonly canAddChildWorkItem = computed(
    () =>
      this.workItem()?.parent === null &&
      this.workItem()?.childSummary === null &&
      !this.isArchivedProject()
  );
  readonly isTerminalWorkItem = computed(() =>
    terminalStatuses.has(this.workItem()?.status ?? 'backlog')
  );
  readonly canReopenTerminalWorkItem = computed(() => {
    const actor = this.currentUser.selectedMember();
    return actor?.role === 'owner' || actor?.role === 'maintainer';
  });
  readonly isTerminalStatusReadOnly = computed(
    () => this.isTerminalWorkItem() && !this.canReopenTerminalWorkItem()
  );
  readonly isStatusTransitionReadOnly = computed(
    () => this.isArchivedProject() || this.isTerminalStatusReadOnly()
  );
  readonly assignableLabels = computed(() =>
    this.availableLabels().filter((label) => !label.isArchived)
  );
  readonly archivedAttachedLabels = computed(() =>
    (this.workItem()?.labels ?? []).filter((label) => label.isArchived)
  );
  readonly linkedWorkItemIds = computed(() => {
    const relationships = this.workItem()?.relationships;

    if (relationships === undefined) {
      return new Set<string>();
    }

    return new Set([
      ...relationships.blockedBy.map((relationship) => relationship.workItem.id),
      ...relationships.blocks.map((relationship) => relationship.workItem.id),
      ...relationships.related.map((relationship) => relationship.workItem.id)
    ]);
  });
  readonly returnTarget = computed(() => {
    const item = this.workItem();
    const fallbackPath = item === null ? '/work-items' : `/projects/${item.projectId}/work-items`;
    const parsedReturnUrl = this.parseSafeReturnUrl(
      this.context.query('returnUrl') || null
    );

    if (parsedReturnUrl !== null) {
      return {
        ...parsedReturnUrl,
        label: 'Back'
      };
    }

    return {
      path: fallbackPath,
      queryParams: null,
      label: item === null ? 'Back to work items' : 'Back to project work'
    };
  });

  readonly detailForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required]],
    descriptionContent: this.formBuilder.nonNullable.control<AuthoredContentValue>(
      { source: '', format: 'markdown_v1' },
      authoredContentValidator()
    ),
    type: ['task'],
    priority: ['medium'],
    assigneeId: [''],
    milestoneId: [''],
    cycleId: ['']
  });

  readonly statusForm = this.formBuilder.nonNullable.group({
    status: ['backlog']
  });

  readonly commentForm = this.formBuilder.nonNullable.group({
    bodyContent: this.formBuilder.nonNullable.control<AuthoredContentValue>(
      { source: '', format: 'markdown_v1' },
      authoredContentValidator({ requireNonWhitespace: true })
    )
  });

  readonly editCommentForm = this.formBuilder.nonNullable.group({
    bodyContent: this.formBuilder.nonNullable.control<AuthoredContentValue>(
      { source: '', format: 'markdown_v1' },
      authoredContentValidator({ requireNonWhitespace: true })
    )
  });

  readonly relationshipForm = this.formBuilder.nonNullable.group({
    kind: ['blocked_by'],
    search: [''],
    targetWorkItemId: ['']
  });

  constructor() {
    effect(() => {
      this.isStatusTransitionReadOnly();
      this.syncReadOnlyState();
    });
  }

  ngOnInit(): void {
    this.registerDrafts();
    if (this.currentUser.members().length === 0) this.currentUser.loadMembers();
    this.context.start(() => {
      this.resetNavigationState();
      this.syncFilesTarget(this.context.fragment(), true);
      this.loadWorkItem();
    });
    this.context.routeState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ fragment }) => this.syncFilesTarget(fragment, false));
  }

  loadWorkItem(): void {
    const workItemId = this.workItemId();
    const generation = ++this.loadGeneration;
    this.isLoading.set(true);
    this.loadError.set(null);

    this.workItemsApi
      .getWorkItem(workItemId)
      .pipe(this.context.guard())
      .subscribe({
        next: (workItem) => {
          if (generation !== this.loadGeneration) {
            return;
          }

          this.applyWorkItem(workItem);
          this.loadWatchState();
          this.loadProject(workItem.projectId);
          this.loadProjectLabels(workItem.projectId);
          this.loadProjectMilestones(workItem.projectId);
          this.loadProjectCycles(workItem.projectId);
          this.isLoading.set(false);
        },
        error: () => {
          if (generation !== this.loadGeneration) {
            return;
          }

          this.loadError.set('Work item detail could not be loaded from the API.');
          this.isLoading.set(false);
        }
      });
  }

  updateWorkItem(): void {
    if (this.isUpdating() || this.workItem() === null) {
      return;
    }
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
    this.syncReadOnlyState();
    this.workItemsApi
      .updateWorkItem(this.workItemId(), this.toUpdateRequest())
      .pipe(this.guardContext())
      .subscribe({
        next: (workItem) => {
          this.isUpdating.set(false);
          // A field save does not own discussion; its older DTO must not undo a comment write.
          this.applyWorkItem({ ...workItem, comments: this.workItem()?.comments ?? workItem.comments });
          this.hasSubmittedDetail.set(false);
        },
        error: () => {
          this.updateError.set('The work item could not be updated.');
          this.isUpdating.set(false);
          this.syncReadOnlyState();
        }
      });
  }

  discardDetailChanges(): void {
    const workItem = this.workItem();
    if (workItem !== null && !this.isUpdating() && !this.isArchivedProject()) {
      this.resetDetailForm(workItem);
      this.hasSubmittedDetail.set(false);
      this.updateError.set(null);
    }
  }

  applyParentChange(workItem: WorkItemDetailDto): void {
    if (workItem.id === this.workItemId()) {
      this.workItem.update((current) =>
        current === null ? current : {
          ...current,
          parent: workItem.parent,
          childSummary: workItem.childSummary,
          updatedAt: workItem.updatedAt,
          activity: workItem.activity
        }
      );
    }
  }

  refreshAttachmentActivity(): void {
    const workItemId = this.workItemId();
    const generation = ++this.attachmentActivityGeneration;
    this.attachmentActivitySubscription?.unsubscribe();
    this.attachmentActivityError.set(null);

    this.attachmentActivitySubscription = this.workItemsApi
      .listWorkItemActivity(workItemId)
      .pipe(this.context.guard())
      .subscribe({
        next: (activity) => {
          if (
            generation !== this.attachmentActivityGeneration ||
            workItemId !== this.workItemId()
          ) {
            return;
          }

          this.workItem.update((workItem) =>
            workItem?.id === workItemId ? { ...workItem, activity } : workItem
          );
          this.attachmentActivitySubscription = null;
        },
        error: () => {
          if (
            generation !== this.attachmentActivityGeneration ||
            workItemId !== this.workItemId()
          ) {
            return;
          }

          this.attachmentActivityError.set(
            'The file changed, but the latest activity could not be loaded.'
          );
          this.attachmentActivitySubscription = null;
        }
      });
  }

  transitionStatus(): void {
    if (this.isStatusTransitionReadOnly()) {
      if (this.isTerminalStatusReadOnly()) {
        this.statusError.set('Only owners and maintainers can reopen done or canceled work items.');
      }
      return;
    }

    const status = this.statusForm.getRawValue().status as WorkItemStatus;
    this.statusError.set(null);
    this.isTransitioning.set(true);

    this.workItemsApi
      .transitionWorkItem(this.workItemId(), { status })
      .pipe(this.guardContext())
      .subscribe({
        next: (workItem) => {
          this.workItem.update((current) =>
            current === null ? current : {
              ...current,
              status: workItem.status,
              boardPosition: workItem.boardPosition,
              updatedAt: workItem.updatedAt,
              activity: workItem.activity
            }
          );
          this.statusForm.reset({ status: workItem.status });
          this.syncReadOnlyState();
          this.isTransitioning.set(false);
        },
        error: () => {
          this.statusError.set('The requested status transition was rejected.');
          this.isTransitioning.set(false);
        }
      });
  }

  addComment(): void {
    if (this.isCommenting() || this.workItem() === null) {
      return;
    }
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
    const generation = ++this.commentCreateGeneration;
    this.discussionRefreshGeneration += 1;
    this.syncReadOnlyState();
    this.workItemsApi
      .createComment(this.workItemId(), this.toCreateCommentRequest())
      .pipe(this.guardContext(() => generation === this.commentCreateGeneration))
      .subscribe({
        next: (comment) => {
          this.applyComment(comment);
          this.resetNewComment();
          this.isCommenting.set(false);
          this.syncReadOnlyState();
          this.refreshDiscussion();
        },
        error: () => {
          this.commentError.set('The comment could not be added.');
          this.isCommenting.set(false);
          this.syncReadOnlyState();
        }
      });
  }

  loadWatchState(): void {
    const workItemId = this.workItemId();
    this.isWatchLoading.set(true);
    this.watchError.set(null);

    this.workItemsApi
      .getWorkItemWatchState(workItemId)
      .pipe(this.context.guard())
      .subscribe({
        next: (watchState) => {
          if (workItemId !== this.workItemId()) {
            return;
          }

          this.watchState.set(watchState);
          this.isWatchLoading.set(false);
        },
        error: () => {
          if (workItemId !== this.workItemId()) {
            return;
          }

          this.watchError.set('Watch state could not be loaded from the API.');
          this.watchState.set(null);
          this.isWatchLoading.set(false);
        }
      });
  }

  toggleWatch(): void {
    if (this.isArchivedProject() || this.isWatchLoading() || this.isWatchUpdating()) {
      return;
    }

    const isWatched = this.watchState()?.isWatchedByCurrentActor ?? false;
    const request = isWatched
      ? this.workItemsApi.unwatchWorkItem(this.workItemId())
      : this.workItemsApi.watchWorkItem(this.workItemId());

    this.isWatchUpdating.set(true);
    this.watchError.set(null);

    request.pipe(this.guardContext()).subscribe({
      next: (watchState) => {
        this.watchState.set(watchState);
        this.isWatchUpdating.set(false);
      },
      error: () => {
        this.watchError.set('Watch state could not be updated.');
        this.isWatchUpdating.set(false);
      }
    });
  }

  startEditComment(comment: CommentDto): void {
    if (!this.canModifyComment(comment)) {
      return;
    }

    this.commentMutationError.set(null);
    this.cancelDeleteComment();
    this.editCommentIdentity.update((identity) => identity + 1);
    this.savingCommentId.set(null);
    this.editingCommentId.set(comment.id);
    this.hasSubmittedEditComment.set(false);
    const bodyContent = { source: comment.body, format: comment.bodyFormat };
    this.editCommentForm.controls.bodyContent.setValidators(
      authoredContentValidator({ baseline: bodyContent, requireNonWhitespace: true })
    );
    this.editCommentForm.reset({ bodyContent });
    this.editCommentDraft.accept();
    this.syncReadOnlyState();
  }

  cancelEditComment(): void {
    this.editCommentIdentity.update((identity) => identity + 1);
    this.savingCommentId.set(null);
    this.editingCommentId.set(null);
    this.hasSubmittedEditComment.set(false);
    this.editCommentForm.controls.bodyContent.setValidators(
      authoredContentValidator({ requireNonWhitespace: true })
    );
    this.editCommentForm.reset({ bodyContent: { source: '', format: 'markdown_v1' } });
    this.editCommentDraft.accept();
    this.syncReadOnlyState();
  }

  saveComment(comment: CommentDto): void {
    if (this.editingCommentId() !== comment.id || this.savingCommentId() !== null) {
      return;
    }
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
    const identity = this.editCommentIdentity();
    const bodyContent = this.editCommentForm.getRawValue().bodyContent;
    this.discussionRefreshGeneration += 1;
    this.syncReadOnlyState();
    this.workItemsApi
      .updateComment(comment.id, { body: bodyContent.source, bodyFormat: bodyContent.format })
      .pipe(this.guardContext(() =>
        identity === this.editCommentIdentity() && this.editingCommentId() === comment.id
      ))
      .subscribe({
        next: (updatedComment) => {
          this.applyComment(updatedComment);
          this.cancelEditComment();
          this.refreshDiscussion();
        },
        error: () => {
          this.commentMutationError.set('The comment could not be updated.');
          this.savingCommentId.set(null);
          this.syncReadOnlyState();
        }
      });
  }

  confirmDeleteComment(comment: CommentDto): void {
    if (!this.canModifyComment(comment)) {
      return;
    }

    this.commentMutationError.set(null);
    this.cancelEditComment();
    this.commentDeleteGeneration += 1;
    this.deletingCommentId.set(null);
    this.confirmingDeleteCommentId.set(comment.id);
  }

  cancelDeleteComment(): void {
    this.commentDeleteGeneration += 1;
    this.deletingCommentId.set(null);
    this.confirmingDeleteCommentId.set(null);
  }

  deleteComment(comment: CommentDto): void {
    if (this.confirmingDeleteCommentId() !== comment.id || this.deletingCommentId() !== null) {
      return;
    }
    this.commentMutationError.set(null);

    if (!this.canModifyComment(comment)) {
      return;
    }

    this.deletingCommentId.set(comment.id);
    const generation = this.commentDeleteGeneration;
    this.discussionRefreshGeneration += 1;
    this.workItemsApi
      .deleteComment(comment.id)
      .pipe(this.guardContext(() =>
        generation === this.commentDeleteGeneration && this.confirmingDeleteCommentId() === comment.id
      ))
      .subscribe({
        next: (deletedComment) => {
          this.applyComment(deletedComment);
          this.cancelDeleteComment();
          this.refreshDiscussion();
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

  searchRelationshipCandidates(): void {
    this.candidateSearchError.set(null);
    this.relationshipError.set(null);
    this.relationshipCandidatesHaveMore.set(false);
    this.hasSearchedRelationshipCandidates.set(true);
    this.relationshipForm.patchValue({ targetWorkItemId: '' }, { emitEvent: false });

    if (this.isRelationshipReadOnly()) {
      return;
    }

    const search = this.relationshipForm.getRawValue().search.trim();
    this.isSearchingCandidates.set(true);

    this.workItemsApi
      .listWorkspaceWorkItems(
        {
          search,
          archivedProjects: 'exclude',
          sort: 'updated_desc'
        },
        { page: 1, pageSize: 25 }
      )
      .pipe(this.context.guard())
      .subscribe({
        next: (response) => {
          this.relationshipCandidates.set(
            response.items.filter((candidate) => candidate.id !== this.workItemId())
          );
          this.relationshipCandidatesHaveMore.set(response.hasNextPage);
          this.isSearchingCandidates.set(false);
        },
        error: () => {
          this.candidateSearchError.set('Work item candidates could not be loaded.');
          this.relationshipCandidates.set([]);
          this.relationshipCandidatesHaveMore.set(false);
          this.isSearchingCandidates.set(false);
        }
      });
  }

  selectRelationshipCandidate(candidate: WorkspaceWorkItemListItemDto): void {
    if (this.isRelationshipReadOnly() || this.isAlreadyLinked(candidate.id)) {
      return;
    }

    this.relationshipError.set(null);
    this.relationshipForm.patchValue({ targetWorkItemId: candidate.id }, { emitEvent: false });
  }

  addRelationship(): void {
    this.relationshipError.set(null);

    if (this.isRelationshipReadOnly()) {
      return;
    }

    const formValue = this.relationshipForm.getRawValue();
    const targetWorkItemId = formValue.targetWorkItemId;

    if (targetWorkItemId === '') {
      this.relationshipError.set('Select a work item to link.');
      return;
    }

    if (this.isAlreadyLinked(targetWorkItemId)) {
      this.relationshipError.set('That work item is already linked.');
      return;
    }

    const kind = formValue.kind as RelationshipKind;
    const sourceWorkItemId = kind === 'blocked_by' ? targetWorkItemId : this.workItemId();
    const relationshipTargetWorkItemId =
      kind === 'blocked_by' ? this.workItemId() : targetWorkItemId;
    const relationshipType: WorkItemRelationshipType = kind === 'related' ? 'relates_to' : 'blocks';

    this.isAddingRelationship.set(true);
    this.workItemsApi
      .createWorkItemRelationship(sourceWorkItemId, {
        relationshipType,
        targetWorkItemId: relationshipTargetWorkItemId
      })
      .pipe(this.guardContext())
      .subscribe({
        next: () => {
          this.refreshAfterRelationshipMutation(() => {
            this.relationshipForm.patchValue({ targetWorkItemId: '' }, { emitEvent: false });
            this.isAddingRelationship.set(false);
          });
        },
        error: () => {
          this.relationshipError.set('The relationship could not be added.');
          this.isAddingRelationship.set(false);
        }
      });
  }

  removeRelationship(relationship: WorkItemRelationshipItemDto): void {
    this.relationshipError.set(null);

    if (this.isRelationshipReadOnly()) {
      return;
    }

    this.removingRelationshipId.set(relationship.id);
    this.workItemsApi
      .deleteWorkItemRelationship(this.workItemId(), relationship.id)
      .pipe(this.guardContext())
      .subscribe({
        next: () => {
          this.refreshAfterRelationshipMutation(() => {
            this.removingRelationshipId.set(null);
          });
        },
        error: () => {
          this.relationshipError.set('The relationship could not be removed.');
          this.removingRelationshipId.set(null);
        }
      });
  }

  isRelationshipReadOnly(): boolean {
    return this.isArchivedProject();
  }

  isAlreadyLinked(workItemId: string): boolean {
    return this.linkedWorkItemIds().has(workItemId);
  }

  relationshipActionLabel(): string {
    const kind = this.relationshipForm.getRawValue().kind as RelationshipKind;

    if (kind === 'blocked_by') {
      return 'Add blocker';
    }

    if (kind === 'blocks') {
      return 'Add blocked work';
    }

    return 'Add related work';
  }

  dependencyStateLabel(item: WorkItemDetailDto): string {
    const blockers = item.relationships.openBlockerCount;
    const blockedWork = item.relationships.openBlockedWorkCount;

    if (blockers > 0 && blockedWork > 0) {
      return `Blocked by ${blockers} and blocking ${blockedWork}`;
    }

    if (blockers > 0) {
      return `Blocked by ${blockers}`;
    }

    return `Blocking ${blockedWork}`;
  }

  addMentionMember(memberId: string): void {
    if (memberId === '' || this.isArchivedProject() || this.isCommenting()) {
      return;
    }

    if (!this.currentUser.activeMembers().some((member) => member.id === memberId)) {
      return;
    }

    const selected = new Set(this.selectedMentionMemberIds());
    selected.add(memberId);
    this.selectedMentionMemberIds.set([...selected]);
  }

  removeMentionMember(memberId: string): void {
    if (this.isArchivedProject() || this.isCommenting()) {
      return;
    }
    this.selectedMentionMemberIds.set(
      this.selectedMentionMemberIds().filter((selectedMemberId) => selectedMemberId !== memberId)
    );
  }

  toggleLabel(labelId: string, event: Event): void {
    if (this.isArchivedProject() || this.isUpdating()) {
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

    this.projectsApi
      .listProjectLabels(projectId)
      .pipe(this.context.guard())
      .subscribe({
        next: (labels) => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.availableLabels.set(labels.filter((label) => !label.isArchived));
        },
        error: () => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.labelLoadError.set('Project labels could not be loaded from the API.');
        }
      });
  }

  loadProjectMilestones(projectId: string): void {
    this.milestoneLoadError.set(null);

    this.projectsApi
      .listProjectMilestones(projectId, { includeArchived: true })
      .pipe(this.context.guard())
      .subscribe({
        next: (milestones) => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.availableMilestones.set(this.sortMilestones(this.mergeCurrentMilestone(milestones)));
        },
        error: () => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.milestoneLoadError.set('Project milestones could not be loaded from the API.');
        }
      });
  }

  loadProjectCycles(projectId: string): void {
    this.cycleLoadError.set(null);

    this.cyclesApi
      .listCycles(projectId, { includeArchived: true })
      .pipe(this.context.guard())
      .subscribe({
        next: (cycles) => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.availableCycles.set(this.sortCycles(this.mergeCurrentCycle(cycles)));
        },
        error: () => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.cycleLoadError.set('Project cycles could not be loaded from the API.');
        }
      });
  }

  loadProject(projectId: string): void {
    this.projectsApi
      .getProject(projectId)
      .pipe(this.context.guard())
      .subscribe({
        next: (project) => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.project.set(project);
          this.syncReadOnlyState();
        },
        error: () => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.project.set(null);
          this.syncReadOnlyState();
        }
      });
  }

  showTitleError(): boolean {
    const control = this.detailForm.controls.title;
    return control.invalid && (control.touched || this.hasSubmittedDetail());
  }

  showDescriptionError(): boolean {
    const control = this.detailForm.controls.descriptionContent;
    return control.invalid && (control.touched || this.hasSubmittedDetail());
  }

  showCommentError(): boolean {
    const control = this.commentForm.controls.bodyContent;
    return control.invalid && (control.touched || this.hasSubmittedComment());
  }

  showEditCommentError(): boolean {
    const control = this.editCommentForm.controls.bodyContent;
    return control.invalid && (control.touched || this.hasSubmittedEditComment());
  }

  commentValidationMessage(editing = false): string {
    const control = editing
      ? this.editCommentForm.controls.bodyContent
      : this.commentForm.controls.bodyContent;
    return control.hasError('authoredContentTooLong')
      ? 'Comment body must be 10,000 characters or fewer.'
      : 'Comment body is required.';
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

  memberDisplayName(member: MemberDto): string {
    return member.isActive ? member.name : `${member.name} (inactive)`;
  }

  deletedCommentText(comment: CommentDto): string {
    const actor =
      comment.deletedBy === null ? '' : ` by ${this.memberDisplayName(comment.deletedBy)}`;
    const timestamp =
      comment.deletedAt === null ? '' : ` on ${this.formatDateTime(comment.deletedAt)}`;
    return `Comment deleted${actor}${timestamp}.`;
  }

  refreshDiscussion(): void {
    if (this.workItem() === null) {
      return;
    }
    const generation = ++this.discussionRefreshGeneration;
    const createGeneration = this.commentCreateGeneration;
    const editIdentity = this.editCommentIdentity();
    const deleteGeneration = this.commentDeleteGeneration;
    this.discussionRefreshError.set(null);
    this.workItemsApi
      .getWorkItem(this.workItemId())
      .pipe(this.guardContext(() =>
        generation === this.discussionRefreshGeneration &&
        createGeneration === this.commentCreateGeneration &&
        editIdentity === this.editCommentIdentity() &&
        deleteGeneration === this.commentDeleteGeneration
      ))
      .pipe(this.context.guard()).subscribe({
        next: (workItem) => {
          this.applyDiscussionRefresh(workItem);
        },
        error: () => {
          this.discussionRefreshError.set(
            'The latest discussion and activity could not be loaded.'
          );
        }
      });
  }

  private applyComment(comment: CommentDto): void {
    this.workItem.update((current) => {
      if (current === null || comment.workItemId !== current.id) {
        return current;
      }
      const exists = current.comments.some((existing) => existing.id === comment.id);
      return {
        ...current,
        comments: exists
          ? current.comments.map((existing) => existing.id === comment.id ? comment : existing)
          : [...current.comments, comment]
      };
    });
  }

  private resetNewComment(): void {
    this.commentCreateGeneration += 1;
    this.newCommentIdentity.update((identity) => identity + 1);
    this.commentForm.reset({ bodyContent: { source: '', format: 'markdown_v1' } });
    this.selectedMentionMemberIds.set([]);
    this.hasSubmittedComment.set(false);
    this.newCommentDraft.accept();
  }

  private refreshAfterRelationshipMutation(afterRefresh: () => void): void {
    this.workItemsApi
      .getWorkItem(this.workItemId())
      .pipe(this.context.guard())
      .subscribe({
        next: (workItem) => {
          this.workItem.update((current) =>
            current === null
              ? current
              : {
                  ...current,
                  relationships: workItem.relationships,
                  dependencyBlocked: workItem.dependencyBlocked,
                  openBlockerCount: workItem.openBlockerCount,
                  openBlockedWorkCount: workItem.openBlockedWorkCount,
                  updatedAt: workItem.updatedAt,
                  activity: workItem.activity
                }
          );
          afterRefresh();
        },
        error: () => {
          this.relationshipError.set(
            'The relationship changed, but the latest detail could not be loaded.'
          );
          afterRefresh();
        }
      });
  }

  private applyDiscussionRefresh(workItem: WorkItemDetailDto): void {
    this.workItem.update((current) =>
      current === null
        ? current
        : {
            ...current,
            comments: workItem.comments,
            updatedAt: workItem.updatedAt,
            activity: workItem.activity
          }
    );
  }

  private applyWorkItem(workItem: WorkItemDetailDto): void {
    this.workItem.set(workItem);
    this.mergeAvailableLabels(workItem.labels);
    this.resetDetailForm(workItem);
    this.statusForm.reset({ status: workItem.status });
    this.relationshipError.set(null);
    this.syncReadOnlyState();
  }

  private resetDetailForm(workItem: WorkItemDetailDto): void {
    this.descriptionBaseline = { source: workItem.description, format: workItem.descriptionFormat };
    this.detailForm.controls.descriptionContent.setValidators(
      authoredContentValidator({ baseline: this.descriptionBaseline })
    );
    this.descriptionEditorIdentity.update((identity) => identity + 1);
    this.selectedLabelIds.set(
      workItem.labels.filter((label) => !label.isArchived).map((label) => label.id)
    );
    this.detailForm.reset({
      title: workItem.title,
      descriptionContent: { ...this.descriptionBaseline },
      type: workItem.type,
      priority: workItem.priority,
      assigneeId: workItem.assignee?.id ?? '',
      milestoneId: workItem.milestone?.id ?? '',
      cycleId: workItem.cycle?.id ?? ''
    });
    this.detailDraft.accept();
  }

  private resetNavigationState(): void {
    this.discussionRefreshGeneration += 1;
    this.descriptionBaseline = null;
    this.descriptionEditorIdentity.update((identity) => identity + 1);
    this.detailForm.controls.descriptionContent.setValidators(authoredContentValidator());
    this.attachmentActivitySubscription?.unsubscribe();
    this.attachmentActivitySubscription = null;
    this.attachmentActivityGeneration += 1;
    this.project.set(null);
    this.workItem.set(null);
    this.selectedLabelIds.set([]);
    this.availableLabels.set([]);
    this.availableMilestones.set([]);
    this.availableCycles.set([]);
    this.relationshipCandidates.set([]);
    this.relationshipCandidatesHaveMore.set(false);
    this.watchState.set(null);
    this.selectedMentionMemberIds.set([]);
    this.isUpdating.set(false);
    this.isTransitioning.set(false);
    this.isCommenting.set(false);
    this.isWatchLoading.set(false);
    this.isWatchUpdating.set(false);
    this.isSearchingCandidates.set(false);
    this.isAddingRelationship.set(false);
    this.savingCommentId.set(null);
    this.deletingCommentId.set(null);
    this.editingCommentId.set(null);
    this.confirmingDeleteCommentId.set(null);
    this.removingRelationshipId.set(null);
    this.hasSubmittedDetail.set(false);
    this.hasSubmittedComment.set(false);
    this.hasSubmittedEditComment.set(false);
    this.hasSearchedRelationshipCandidates.set(false);
    this.loadError.set(null);
    this.updateError.set(null);
    this.statusError.set(null);
    this.commentError.set(null);
    this.commentMutationError.set(null);
    this.watchError.set(null);
    this.relationshipError.set(null);
    this.candidateSearchError.set(null);
    this.labelLoadError.set(null);
    this.milestoneLoadError.set(null);
    this.cycleLoadError.set(null);
    this.attachmentActivityError.set(null);
    this.discussionRefreshError.set(null);
    this.detailForm.reset({
      title: '',
      descriptionContent: { source: '', format: 'markdown_v1' },
      type: 'task',
      priority: 'medium',
      assigneeId: '',
      milestoneId: '',
      cycleId: ''
    });
    this.statusForm.reset({ status: 'backlog' });
    this.resetNewComment();
    this.cancelEditComment();
    this.cancelDeleteComment();
    this.relationshipForm.reset({
      kind: 'blocked_by',
      search: '',
      targetWorkItemId: ''
    });
    this.syncReadOnlyState();
  }

  private syncFilesTarget(fragment: string | null, workItemChanged: boolean): void {
    if (fragment !== workItemFilesFragment) {
      this.filesTargetGeneration.set(null);
      return;
    }

    if (workItemChanged || this.filesTargetGeneration() === null) {
      this.filesTargetGeneration.set(++this.nextFilesTargetGeneration);
    }
  }

  private toUpdateRequest(): UpdateWorkItemRequest {
    const formValue = this.detailForm.getRawValue();
    const description = formValue.descriptionContent;

    return {
      title: formValue.title.trim(),
      ...(this.descriptionBaseline !== null &&
      authoredContentEquals(description, this.descriptionBaseline)
        ? {}
        : { description: description.source, descriptionFormat: description.format }),
      type: formValue.type as WorkItemType,
      priority: formValue.priority as WorkItemPriority,
      assigneeId: formValue.assigneeId === '' ? null : formValue.assigneeId,
      milestoneId: formValue.milestoneId === '' ? null : formValue.milestoneId,
      cycleId: formValue.cycleId === '' ? null : formValue.cycleId,
      labelIds: [
        ...this.selectedLabelIds(),
        ...this.archivedAttachedLabels().map((label) => label.id)
      ]
    };
  }

  private toCreateCommentRequest(): CreateCommentRequest {
    const mentionMemberIds = this.selectedMentionMemberIds();
    const bodyContent = this.commentForm.getRawValue().bodyContent;
    const request: CreateCommentRequest = {
      body: bodyContent.source,
      bodyFormat: bodyContent.format
    };

    if (mentionMemberIds.length > 0) {
      request.mentionMemberIds = [...mentionMemberIds];
    }

    return request;
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

  private mergeCurrentCycle(cycles: ProjectCycleDto[]): ProjectCycleDto[] {
    const current = this.workItem()?.cycle;

    if (current === null || current === undefined) {
      return cycles;
    }

    const cyclesById = new Map(cycles.map((cycle) => [cycle.id, cycle]));
    cyclesById.set(current.id, current);
    return [...cyclesById.values()];
  }

  private sortMilestones(milestones: MilestoneDto[]): MilestoneDto[] {
    return [...milestones].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private sortCycles(cycles: ProjectCycleDto[]): ProjectCycleDto[] {
    return [...cycles].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate);
      }

      return left.name.localeCompare(right.name);
    });
  }

  private mergeAvailableLabels(labels: LabelDto[]): void {
    const labelsById = new Map(this.availableLabels().map((label) => [label.id, label]));

    for (const label of labels) {
      labelsById.set(label.id, label);
    }

    this.availableLabels.set(
      [...labelsById.values()].sort((left, right) => left.name.localeCompare(right.name))
    );
  }

  private syncReadOnlyState(): void {
    const options = { emitEvent: false };

    if (this.isArchivedProject()) {
      this.detailForm.disable(options);
      this.statusForm.disable(options);
      this.commentForm.disable(options);
      this.editCommentForm.disable(options);
      this.relationshipForm.disable(options);
    } else {
      if (this.isUpdating()) {
        this.detailForm.disable(options);
      } else {
        this.detailForm.enable(options);
      }
      if (this.isCommenting()) {
        this.commentForm.disable(options);
      } else {
        this.commentForm.enable(options);
      }
      if (this.savingCommentId() !== null) {
        this.editCommentForm.disable(options);
      } else {
        this.editCommentForm.enable(options);
      }
      this.relationshipForm.enable(options);

      if (this.isStatusTransitionReadOnly()) {
        this.statusForm.disable(options);
      } else {
        this.statusForm.enable(options);
      }
    }
  }



  private guardContext<T>(isOperationCurrent: () => boolean = () => true): MonoTypeOperatorFunction<T> {
    return this.context.guardMutation(isOperationCurrent);
  }

  private parseSafeReturnUrl(rawReturnUrl: string | null): {
    path: string;
    queryParams: Record<string, string> | null;
  } | null {
    if (rawReturnUrl === null || rawReturnUrl.trim() === '') {
      return null;
    }

    if (
      !rawReturnUrl.startsWith('/') ||
      rawReturnUrl.startsWith('//') ||
      /^[a-z][a-z0-9+.-]*:/i.test(rawReturnUrl) ||
      this.hasControlCharacter(rawReturnUrl)
    ) {
      return null;
    }

    const [pathAndQuery] = rawReturnUrl.split('#', 1);
    const [path, queryString = ''] = pathAndQuery.split('?', 2);

    if (path === '' || path.includes('\\')) {
      return null;
    }

    const parsedQueryParams: Record<string, string> = {};
    new URLSearchParams(queryString).forEach((value, key) => {
      parsedQueryParams[key] = value;
    });

    return {
      path,
      queryParams: Object.keys(parsedQueryParams).length === 0 ? null : parsedQueryParams
    };
  }

  private hasControlCharacter(value: string): boolean {
    for (const character of value) {
      const code = character.charCodeAt(0);

      if (code <= 31 || code === 127) {
        return true;
      }
    }

    return false;
  }
  requestDiscardDetailChanges(): Promise<boolean> {
    return this.departure.change(() => this.discardDetailChanges(), [this.detailDraftToken]);
  }

  requestCancelCommentEdit(): Promise<boolean> {
    return this.departure.change(() => this.cancelEditComment(), [this.editDraftToken]);
  }

  requestEditComment(comment: CommentDto): Promise<boolean> {
    return this.departure.change(() => this.startEditComment(comment), [this.editDraftToken]);
  }

  requestDeleteComment(comment: CommentDto): Promise<boolean> {
    return this.departure.change(() => this.confirmDeleteComment(comment), [this.editDraftToken]);
  }

  private normalizedContent(value: AuthoredContentValue): AuthoredContentValue {
    return { source: normalizeAuthoredContentSource(value.source), format: value.format };
  }

  private detailDraftValue() {
    const value = this.detailForm.getRawValue();
    return { ...value, title: value.title.trim(),
      descriptionContent: this.normalizedContent(value.descriptionContent),
      labels: [...new Set(this.selectedLabelIds())].sort() };
  }

  private registerDrafts(): void {
    const base = {
      context: () => this.context.contextKey(),
      routeKey: () => draftRouteKey('detail', this.workItemId())
    };
    this.detailDraftToken = this.departure.register({ ...base, category: 'Work item details',
      revision: () => this.detailDraft.revision(),
      meaningful: () => this.workItem() !== null && this.detailDraft.meaningful(),
      pending: () => this.isUpdating(), discard: () => this.discardDetailChanges()
    }, this.destroyRef);
    this.departure.register({ ...base, category: 'New comment',
      context: () => base.context() + ':' + this.newCommentIdentity(),
      revision: () => this.newCommentDraft.revision(),
      meaningful: () => this.workItem() !== null && this.newCommentDraft.meaningful(),
      pending: () => this.isCommenting(), discard: () => this.resetNewComment()
    }, this.destroyRef);
    this.editDraftToken = this.departure.register({ ...base, category: 'Comment edit',
      context: () => base.context() + ':' + this.editCommentIdentity(),
      revision: () => this.editCommentDraft.revision(),
      meaningful: () => this.editingCommentId() !== null && this.editCommentDraft.meaningful(),
      pending: () => this.savingCommentId() !== null || this.deletingCommentId() !== null,
      discard: () => this.cancelEditComment()
    }, this.destroyRef);
    this.departure.register({ ...base, category: 'Work item action', revision: () => 0,
      meaningful: () => false,
      pending: () => this.isTransitioning() || this.isWatchUpdating() || this.isAddingRelationship() ||
        this.removingRelationshipId() !== null,
      discard: () => undefined
    }, this.destroyRef);
    merge(this.detailForm.valueChanges, this.commentForm.valueChanges, this.editCommentForm.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.departure.refresh());
  }

}
