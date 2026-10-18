import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder } from '@angular/forms';
import type {
  CommentDto,
  CreateCommentRequest,
  MemberDto,
  WorkItemDetailDto
} from '@worktrail/contracts';
import { normalizeAuthoredContentSource } from '@worktrail/contracts';
import { merge } from 'rxjs';
import { DraftDepartureCoordinator, draftRouteKey } from '../../core/navigation/draft-departure-coordinator';
import { DraftTracker } from '../../core/navigation/draft-tracker';

import { WorkItemsApi } from '../../core/api/work-items-api';
import { CurrentUserService } from '../../core/current-user.service';
import { authoredContentValidator } from '../../shared/authored-content/authored-content-validation';
import {
  type AuthoredContentValue
} from '../../shared/authored-content/authored-content-value';

import { WorkItemDetailStore } from './work-item-detail.store';
@Injectable()
export class WorkItemDiscussionStore {
  readonly record = inject(WorkItemDetailStore);
  readonly departure = inject(DraftDepartureCoordinator);
  private readonly workItemsApi = inject(WorkItemsApi);
  private readonly currentUser = inject(CurrentUserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  private normalizedContent(value: AuthoredContentValue): AuthoredContentValue {
    return { source: normalizeAuthoredContentSource(value.source), format: value.format };
  }
  private readonly newCommentDraft = new DraftTracker(() => ({
    content: this.normalizedContent(this.commentForm.getRawValue().bodyContent),
    recipients: [...new Set(this.selectedMentionMemberIds())].sort()
  }));

  private readonly editCommentDraft = new DraftTracker(() =>
    this.normalizedContent(this.editCommentForm.getRawValue().bodyContent));

  private editDraftToken!: symbol;

  private commentCreateGeneration = 0;

  private commentDeleteGeneration = 0;

  private discussionRefreshGeneration = 0;

  readonly newCommentIdentity = signal(0);

  readonly editCommentIdentity = signal(0);

  readonly isCommenting = signal(false);

  readonly savingCommentId = signal<string | null>(null);

  readonly deletingCommentId = signal<string | null>(null);

  readonly editingCommentId = signal<string | null>(null);

  readonly confirmingDeleteCommentId = signal<string | null>(null);

  readonly hasSubmittedComment = signal(false);

  readonly hasSubmittedEditComment = signal(false);

  readonly commentError = signal<string | null>(null);

  readonly commentMutationError = signal<string | null>(null);

  readonly discussionRefreshError = signal<string | null>(null);

  readonly selectedMentionMemberIds = signal<string[]>([]);

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

  addComment(): void {
    if (this.isCommenting() || this.record.workItem() === null) {
      return;
    }
    this.hasSubmittedComment.set(true);
    this.commentError.set(null);

    if (this.commentForm.invalid) {
      this.commentForm.markAllAsTouched();
      return;
    }

    if (this.record.isArchivedProject()) {
      return;
    }

    this.isCommenting.set(true);
    const generation = ++this.commentCreateGeneration;
    this.discussionRefreshGeneration += 1;
    this.syncReadOnlyState();
    this.workItemsApi
      .createComment(this.record.workItemId(), this.toCreateCommentRequest())
      .pipe(this.record.guardContext(() => generation === this.commentCreateGeneration))
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
      .pipe(this.record.guardContext(() =>
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
      .pipe(this.record.guardContext(() =>
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

  addMentionMember(memberId: string): void {
    if (memberId === '' || this.record.isArchivedProject() || this.isCommenting()) {
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
    if (this.record.isArchivedProject() || this.isCommenting()) {
      return;
    }
    this.selectedMentionMemberIds.set(
      this.selectedMentionMemberIds().filter((selectedMemberId) => selectedMemberId !== memberId)
    );
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

    if (this.record.isArchivedProject() || comment.isDeleted || actor === null) {
      return false;
    }

    return actor.role === 'owner' || actor.role === 'maintainer' || comment.author.id === actor.id;
  }

  deletedCommentText(comment: CommentDto): string {
    const actor =
      comment.deletedBy === null ? '' : ` by ${this.record.memberDisplayName(comment.deletedBy)}`;
    const timestamp =
      comment.deletedAt === null ? '' : ` on ${this.record.formatDateTime(comment.deletedAt)}`;
    return `Comment deleted${actor}${timestamp}.`;
  }

  refreshDiscussion(): void {
    if (this.record.workItem() === null) {
      return;
    }
    const generation = ++this.discussionRefreshGeneration;
    const createGeneration = this.commentCreateGeneration;
    const editIdentity = this.editCommentIdentity();
    const deleteGeneration = this.commentDeleteGeneration;
    this.discussionRefreshError.set(null);
    this.workItemsApi
      .getWorkItem(this.record.workItemId())
      .pipe(this.record.guardContext(() =>
        generation === this.discussionRefreshGeneration &&
        createGeneration === this.commentCreateGeneration &&
        editIdentity === this.editCommentIdentity() &&
        deleteGeneration === this.commentDeleteGeneration
      ))
      .pipe(this.record.context.guard()).subscribe({
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
    this.record.workItem.update((current) => {
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

  private applyDiscussionRefresh(workItem: WorkItemDetailDto): void {
    this.record.workItem.update((current) =>
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

  requestCancelCommentEdit(): Promise<boolean> {
    return this.departure.change(() => this.cancelEditComment(), [this.editDraftToken]);
  }

  requestEditComment(comment: CommentDto): Promise<boolean> {
    return this.departure.change(() => this.startEditComment(comment), [this.editDraftToken]);
  }

  requestDeleteComment(comment: CommentDto): Promise<boolean> {
    return this.departure.change(() => this.confirmDeleteComment(comment), [this.editDraftToken]);
  }

  constructor() { effect(() => { this.record.isArchivedProject(); this.syncReadOnlyState(); }); }

  reset(): void {
    this.discussionRefreshGeneration += 1;
    this.isCommenting.set(false);
    this.hasSubmittedComment.set(false);
    this.hasSubmittedEditComment.set(false);
    this.resetNewComment();
    this.cancelEditComment();
    this.cancelDeleteComment();
    this.syncReadOnlyState();
  }

  private syncReadOnlyState(): void {
    const options = { emitEvent: false };
    if (this.record.isArchivedProject() || this.isCommenting()) this.commentForm.disable(options);
    else this.commentForm.enable(options);
    if (this.record.isArchivedProject() || this.savingCommentId() !== null) this.editCommentForm.disable(options);
    else this.editCommentForm.enable(options);
  }

  registerDrafts(): void {
    const base = {
      context: () => this.record.context.contextKey(),
      routeKey: () => draftRouteKey('detail', this.record.workItemId())
    };
    this.departure.register({
      ...base, category: 'New comment',
      context: () => base.context() + ':' + this.newCommentIdentity(),
      revision: () => this.newCommentDraft.revision(),
      meaningful: () => this.record.workItem() !== null && this.newCommentDraft.meaningful(),
      pending: () => this.isCommenting(), discard: () => this.resetNewComment()
    }, this.destroyRef);
    this.editDraftToken = this.departure.register({
      ...base, category: 'Comment edit',
      context: () => base.context() + ':' + this.editCommentIdentity(),
      revision: () => this.editCommentDraft.revision(),
      meaningful: () => this.editingCommentId() !== null && this.editCommentDraft.meaningful(),
      pending: () => this.savingCommentId() !== null || this.deletingCommentId() !== null,
      discard: () => this.cancelEditComment()
    }, this.destroyRef);
    merge(this.commentForm.valueChanges, this.editCommentForm.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.departure.refresh());
  }

}
