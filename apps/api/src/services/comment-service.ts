import type { CommentDto, CreateCommentRequest } from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { NotFoundError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { Comment, Member, WorkItem } from '../repositories/types.js';
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
      const timestamp = this.clock();

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

  private async toCommentDtos(
    comments: Comment[],
    repositories: Repositories
  ): Promise<CommentDto[]> {
    return Promise.all(comments.map((comment) => this.toCommentDto(comment, repositories)));
  }

  private async toCommentDto(comment: Comment, repositories: Repositories): Promise<CommentDto> {
    const author = await this.requireMember(comment.authorId, repositories);
    return toCommentDto(comment, author);
  }

  private async requireMember(memberId: string, repositories: Repositories): Promise<Member> {
    const member = await repositories.members.findById(memberId);

    if (member === null || member.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Comment author not found.');
    }

    return member;
  }
}
