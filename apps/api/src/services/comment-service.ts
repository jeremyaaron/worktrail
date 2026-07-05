import type { CommentDto, CreateCommentRequest, UpdateCommentRequest } from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { Comment, Member, Project, WorkItem } from '../repositories/types.js';
import { toCommentDto } from './dto.js';

export interface CommentServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class CommentService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: CommentServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listComments(workItemId: string): Promise<CommentDto[]> {
    await this.requireWorkItem(workItemId, this.context.repositories);
    const comments = await this.context.repositories.comments.findByWorkItem(workItemId);
    return this.toCommentDtos(comments, this.context.repositories);
  }

  async addComment(workItemId: string, input: CreateCommentRequest): Promise<CommentDto> {
    return this.withWriteRepositories(async (repositories) => {
      const workItem = await this.requireWorkItem(workItemId, repositories);
      const project = await this.requireProject(workItem.projectId, repositories);
      this.assertProjectWritable(project);
      const timestamp = this.clock();
      const mentionedMembers = await this.validateMentionMembers(input.mentionMemberIds ?? [], repositories);

      const comment = await repositories.comments.create({
        id: this.idGenerator(),
        workspaceId: workItem.workspaceId,
        projectId: workItem.projectId,
        workItemId,
        authorId: this.context.actor.memberId,
        body: input.body,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      await repositories.commentMentions.createMany(
        mentionedMembers.map((member) => ({
          commentId: comment.id,
          memberId: member.id,
          workspaceId: workItem.workspaceId,
          workItemId,
          createdAt: timestamp
        }))
      );

      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: workItem.workspaceId,
        projectId: workItem.projectId,
        workItemId,
        actorId: this.context.actor.memberId,
        eventType: 'comment.added',
        summary: 'Comment added.',
        previousValue: null,
        newValue: null,
        metadata: { commentId: comment.id },
        createdAt: timestamp
      });

      return this.toCommentDto(comment, repositories);
    });
  }

  async updateComment(commentId: string, input: UpdateCommentRequest): Promise<CommentDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireComment(commentId, repositories);
      this.assertCommentWritable(current);
      this.assertCanModifyComment(current);
      const project = await this.requireProject(current.projectId, repositories);
      this.assertProjectWritable(project);
      const timestamp = this.clock();
      const updated = await repositories.comments.updateBody(commentId, {
        body: input.body,
        editedAt: timestamp,
        updatedAt: timestamp
      });

      if (updated === null) {
        throw new NotFoundError('Comment not found.');
      }

      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: updated.workspaceId,
        projectId: updated.projectId,
        workItemId: updated.workItemId,
        actorId: this.context.actor.memberId,
        eventType: 'comment.edited',
        summary: 'Comment edited.',
        previousValue: null,
        newValue: null,
        metadata: { commentId: updated.id },
        createdAt: timestamp
      });

      return this.toCommentDto(updated, repositories);
    });
  }

  async deleteComment(commentId: string): Promise<CommentDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireComment(commentId, repositories);
      this.assertCommentWritable(current);
      this.assertCanModifyComment(current);
      const project = await this.requireProject(current.projectId, repositories);
      this.assertProjectWritable(project);
      const timestamp = this.clock();
      const deleted = await repositories.comments.softDelete(commentId, {
        deletedAt: timestamp,
        deletedById: this.context.actor.memberId,
        updatedAt: timestamp
      });

      if (deleted === null) {
        throw new NotFoundError('Comment not found.');
      }

      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: deleted.workspaceId,
        projectId: deleted.projectId,
        workItemId: deleted.workItemId,
        actorId: this.context.actor.memberId,
        eventType: 'comment.deleted',
        summary: 'Comment deleted.',
        previousValue: null,
        newValue: null,
        metadata: { commentId: deleted.id },
        createdAt: timestamp
      });

      return this.toCommentDto(deleted, repositories);
    });
  }

  private async withWriteRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    if (this.context.db === undefined) {
      return callback(this.context.repositories);
    }

    return withRepositoriesTransaction(this.context.db, callback);
  }

  private async requireWorkItem(workItemId: string, repositories: Repositories): Promise<WorkItem> {
    const workItem = await repositories.workItems.findById(workItemId);

    if (workItem === null || workItem.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Work item not found.');
    }

    return workItem;
  }

  private async requireComment(commentId: string, repositories: Repositories): Promise<Comment> {
    const comment = await repositories.comments.findById(commentId);

    if (comment === null || comment.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Comment not found.');
    }

    return comment;
  }

  private async requireProject(projectId: string, repositories: Repositories): Promise<Project> {
    const project = await repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private assertProjectWritable(project: Project): void {
    if (project.status === 'archived') {
      throw new ConflictError('Archived projects are read-only.');
    }
  }

  private assertCommentWritable(comment: Comment): void {
    if (comment.deletedAt !== null) {
      throw new ConflictError('Deleted comments cannot be modified.');
    }
  }

  private assertCanModifyComment(comment: Comment): void {
    if (this.context.actor.role === 'owner' || this.context.actor.role === 'maintainer') {
      return;
    }

    if (comment.authorId === this.context.actor.memberId) {
      return;
    }

    throw new ForbiddenError('You do not have permission to modify this comment.');
  }

  private async toCommentDtos(
    comments: Comment[],
    repositories: Repositories
  ): Promise<CommentDto[]> {
    const mentionsByCommentId = await this.getMentionsByCommentId(comments, repositories);
    return Promise.all(
      comments.map((comment) => this.toCommentDto(comment, repositories, mentionsByCommentId))
    );
  }

  private async toCommentDto(
    comment: Comment,
    repositories: Repositories,
    mentionsByCommentId?: Map<string, Member[]>
  ): Promise<CommentDto> {
    const author = await this.requireMember(comment.authorId, repositories);
    const deletedBy =
      comment.deletedById === null ? null : await this.requireMember(comment.deletedById, repositories);
    const mentions =
      mentionsByCommentId?.get(comment.id) ?? (await this.getMentionsByCommentId([comment], repositories)).get(comment.id) ?? [];
    return toCommentDto(comment, author, deletedBy, mentions);
  }

  private async requireMember(memberId: string, repositories: Repositories): Promise<Member> {
    const member = await repositories.members.findById(memberId);

    if (member === null || member.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Comment author not found.');
    }

    return member;
  }

  private async validateMentionMembers(
    memberIds: string[],
    repositories: Repositories
  ): Promise<Member[]> {
    const dedupedMemberIds = [...new Set(memberIds)];

    if (dedupedMemberIds.length === 0) {
      return [];
    }

    const members = await Promise.all(dedupedMemberIds.map((memberId) => repositories.members.findById(memberId)));
    const validMembers: Member[] = [];

    for (let index = 0; index < dedupedMemberIds.length; index += 1) {
      const member = members[index] ?? null;

      if (
        member === null ||
        member.workspaceId !== this.context.actor.workspaceId ||
        !member.isActive
      ) {
        throw new ValidationError('Mentioned members must be active workspace members.');
      }

      validMembers.push(member);
    }

    return validMembers;
  }

  private async getMentionsByCommentId(
    comments: Comment[],
    repositories: Repositories
  ): Promise<Map<string, Member[]>> {
    const mentionsByCommentId = new Map<string, Member[]>();
    const commentIds = comments.map((comment) => comment.id);
    const mentions = await repositories.commentMentions.listByComments(commentIds);

    if (mentions.length === 0) {
      return mentionsByCommentId;
    }

    const membersById = new Map(
      (await repositories.members.listByWorkspace(this.context.actor.workspaceId)).map((member) => [
        member.id,
        member
      ])
    );

    for (const mention of mentions) {
      const member = membersById.get(mention.memberId);

      if (member === undefined) {
        throw new NotFoundError('Mentioned member not found.');
      }

      const existing = mentionsByCommentId.get(mention.commentId) ?? [];
      existing.push(member);
      mentionsByCommentId.set(mention.commentId, existing);
    }

    return mentionsByCommentId;
  }
}
