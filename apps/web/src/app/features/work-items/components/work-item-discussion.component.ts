import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthoredContentEditorComponent } from '../../../shared/authored-content/authored-content-editor.component';
import { AuthoredContentViewerComponent } from '../../../shared/authored-content/authored-content-viewer.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';

import { WorkItemDiscussionStore } from '../work-item-discussion.store';
@Component({
  selector: 'app-work-item-discussion',
  imports: [ReactiveFormsModule, ErrorPanelComponent, EmptyStateComponent, AuthoredContentEditorComponent, AuthoredContentViewerComponent],
  template: `@if (state.record.workItem(); as item) {
        <section id="discussion" tabindex="-1" class="panel" aria-labelledby="comments-heading">

          <h2 id="comments-heading">Discussion</h2>

          @if (item.comments.length === 0) {
            <app-empty-state title="No comments yet" message="Start the discussion from this detail page." />
          } @else {
            <div class="comment-list">
              @for (comment of item.comments; track comment.id) {
                <article class="comment" [id]="'comment-' + comment.id" tabindex="-1">
                  <header>
                    <div>
                      <strong>{{ comment.author.name }}</strong>
                      @if (!comment.author.isActive) {
                        <span class="inactive-marker">Inactive</span>
                      }
                      @if (comment.isEdited && comment.editedAt !== null && !comment.isDeleted) {
                        <span class="comment-marker">Edited {{ state.record.formatDateTime(comment.editedAt) }}</span>
                      }
                    </div>
                    <time>{{ state.record.formatDateTime(comment.createdAt) }}</time>
                  </header>

                  @if (comment.isDeleted) {
                    <p class="comment-tombstone">
                      {{ state.deletedCommentText(comment) }}
                    </p>
                  } @else if (state.editingCommentId() === comment.id) {
                    <form
                      class="comment-edit-form"
                      [formGroup]="state.editCommentForm"
                      (ngSubmit)="state.saveComment(comment)"
                      novalidate
                    >
                      <app-authored-content-editor
                        [fieldId]="'comment-edit-' + comment.id"
                        label="Edit comment"
                        [rows]="4"
                        formControlName="bodyContent"
                        [resetIdentity]="state.editCommentIdentity()"
                        [invalid]="state.showEditCommentError()"
                        [errorDescriptionIds]="'comment-edit-error-' + comment.id"
                      />
                      @if (state.showEditCommentError()) {
                        <p class="field-error" [id]="'comment-edit-error-' + comment.id">
                          {{ state.commentValidationMessage(true) }}
                        </p>
                      }

                      <div class="comment-actions">
                        <button
                          type="submit"
                          [disabled]="state.record.isArchivedProject() || state.savingCommentId() === comment.id"
                        >
                          {{ state.savingCommentId() === comment.id ? 'Saving...' : 'Save' }}
                        </button>
                        <button type="button" class="secondary-action" (click)="state.requestCancelCommentEdit()">
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
                          <span>{{ '@' + state.record.memberDisplayName(mention) }}</span>
                        }
                      </div>
                    }

                    @if (state.canModifyComment(comment)) {
                      <div class="comment-actions">
                        <button type="button" class="secondary-action" (click)="state.requestEditComment(comment)">
                          Edit
                        </button>
                        <button type="button" class="danger-action" (click)="state.requestDeleteComment(comment)">
                          Delete
                        </button>
                      </div>
                    }

                    @if (state.confirmingDeleteCommentId() === comment.id) {
                      <div class="delete-confirmation" role="group" aria-label="Delete comment confirmation">
                        <span>Delete this comment?</span>
                        <button
                          type="button"
                          class="danger-action"
                          [disabled]="state.record.isArchivedProject() || state.deletingCommentId() === comment.id"
                          (click)="state.deleteComment(comment)"
                        >
                          {{ state.deletingCommentId() === comment.id ? 'Deleting...' : 'Delete comment' }}
                        </button>
                        <button type="button" class="secondary-action" (click)="state.cancelDeleteComment()">
                          Cancel
                        </button>
                      </div>
                    }
                  }
                </article>
              }
            </div>
          }

          @if (state.commentMutationError()) {
            <app-error-panel
              title="Comment action failed"
              [message]="state.commentMutationError() ?? ''"
              (retry)="state.clearCommentMutationError()"
            />
          }

          @if (state.discussionRefreshError()) {
            <app-error-panel
              title="Discussion not refreshed"
              [message]="state.discussionRefreshError() ?? ''"
              (retry)="state.refreshDiscussion()"
            />
          }

          <form class="comment-form" [formGroup]="state.commentForm" (ngSubmit)="state.addComment()" novalidate>
            <app-authored-content-editor
              fieldId="comment-body"
              label="Add comment"
              [rows]="4"
              formControlName="bodyContent"
              [resetIdentity]="state.newCommentIdentity()"
              [invalid]="state.showCommentError()"
              errorDescriptionIds="comment-body-error"
            />
            @if (state.showCommentError()) {
              <p id="comment-body-error" class="field-error">{{ state.commentValidationMessage() }}</p>
            }

            <section class="mention-picker" aria-label="Comment mentions">
              <label for="comment-mention-member">Mention members</label>
              <div class="mention-controls">
                <select
                  id="comment-mention-member"
                  #mentionSelect
                  [disabled]="
                    state.record.isArchivedProject() || state.isCommenting() || state.availableMentionMembers().length === 0
                  "
                  (change)="state.addMentionMember(mentionSelect.value); mentionSelect.value = ''"
                >
                  <option value="">Add mention</option>
                  @for (member of state.availableMentionMembers(); track member.id) {
                    <option [value]="member.id">{{ state.record.memberDisplayName(member) }}</option>
                  }
                </select>
              </div>

              @if (state.selectedMentionMembers().length > 0) {
                <div class="mention-chips" aria-label="Selected mentions">
                  @for (member of state.selectedMentionMembers(); track member.id) {
                    <span>
                      {{ state.record.memberDisplayName(member) }}
                      <button
                        type="button"
                        class="chip-remove"
                        [disabled]="state.record.isArchivedProject() || state.isCommenting()"
                        [attr.aria-label]="'Remove ' + state.record.memberDisplayName(member)"
                        (click)="state.removeMentionMember(member.id)"
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

            @if (state.commentError()) {
              <app-error-panel
                title="Comment not added"
                [message]="state.commentError() ?? ''"
                (retry)="state.addComment()"
              />
            }

            <button type="submit" [disabled]="state.record.isArchivedProject() || state.isCommenting()">
              {{ state.isCommenting() ? 'Adding...' : 'Add comment' }}
            </button>
          </form>
        </section>

}`,
  styles: `
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

    h3 {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.35;
    }

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

    .comment-form,
.comment-edit-form {
      display: grid;
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

    .comment-list {
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

    .comment {
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

.panel { border: 0; border-top: 1px solid #e5e7eb; border-radius: 0; padding: 20px 0; background: transparent; }

.comment-form { max-width: 760px; }`
})
export class WorkItemDiscussionComponent {
  readonly state = inject(WorkItemDiscussionStore);
}
