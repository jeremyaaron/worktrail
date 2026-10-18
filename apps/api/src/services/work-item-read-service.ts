import type {
  ActivityEventDto,
  CommentDto,
  WorkItemChildSummaryDto,
  WorkItemChildrenDto,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkItemParentCandidateDto,
  WorkItemParentDto
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';
import { assertPersistence } from '../repositories/persistence.js';
import type { WorkItemServiceContext } from './work-item-context.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type {
  ActivityEvent,
  Comment,
  Label,
  Member,
  Milestone,
  ProjectCycle,
  WorkItem
} from '../repositories/types.js';
import {
  toActivityEventDto,
  toCommentDto,
  toWorkItemDetailDto
} from './dto.js';
import { WorkItemHydrator } from './work-item-hydrator.js';
import { WorkItemRelationshipService } from './work-item-relationship-service.js';

interface WorkItemBundle {
  workItem: WorkItem;
  assignee: Member | null;
  reporter: Member;
  labels: Label[];
  milestone: Milestone | null;
  cycle: ProjectCycle | null;
}

interface WorkItemHierarchyContext {
  parentsByChildId: Map<string, WorkItemParentDto>;
  childSummariesByParentId: Map<string, WorkItemChildSummaryDto>;
}

export class WorkItemReadService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;
  constructor(private readonly context: WorkItemServiceContext) {
    assertPersistence(context.persistence);
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }
  async getWorkItem(workItemId: string): Promise<WorkItemDetailDto> {
    return this.context.persistence.readConsistent((scope) =>
      new WorkItemReadService({ ...this.context, ...scope }).getWorkItemInScope(workItemId)
    );
  }

  private async getWorkItemInScope(workItemId: string): Promise<WorkItemDetailDto> {
    const workItem = await this.requireWorkItem(workItemId, this.context.repositories);
    return this.toDetailDto(workItem, this.context.repositories);
  }

  async listChildren(workItemId: string, limit: number): Promise<WorkItemChildrenDto> {
    return this.context.persistence.readConsistent((scope) =>
      new WorkItemReadService({ ...this.context, ...scope }).listChildrenInScope(workItemId, limit)
    );
  }

  private async listChildrenInScope(workItemId: string, limit: number): Promise<WorkItemChildrenDto> {
    const workItem = await this.requireWorkItem(workItemId, this.context.repositories);
    const children = await this.context.repositories.workItems.listChildren(workItem.id, limit);
    const childSummaries = await this.context.repositories.workItems.summarizeChildren([workItem.id]);
    const totalCount = childSummaries[0]?.summary.totalCount ?? 0;

    return {
      items: await this.toListDtos(children, this.context.repositories),
      totalCount,
      hasMore: totalCount > children.length
    };
  }

  async listParentCandidates(
    workItemId: string,
    search?: string
  ): Promise<WorkItemParentCandidateDto[]> {
    return this.context.persistence.readConsistent((scope) =>
      new WorkItemReadService({ ...this.context, ...scope }).listParentCandidatesInScope(workItemId, search)
    );
  }

  private async listParentCandidatesInScope(
    workItemId: string,
    search?: string
  ): Promise<WorkItemParentCandidateDto[]> {
    const workItem = await this.requireWorkItem(workItemId, this.context.repositories);

    if (await this.context.repositories.workItems.hasChildren(workItem.id)) {
      return [];
    }

    const candidates = await this.context.repositories.workItems.listEligibleParentCandidates({
      workItem,
      search,
      limit: 20
    });

    return candidates.map((candidate) => ({
      ...this.toParentDto(candidate),
      priority: candidate.priority,
      updatedAt: candidate.updatedAt.toISOString()
    }));
  }

  private async requireWorkItem(workItemId: string, repositories: Repositories): Promise<WorkItem> {
    const workItem = await repositories.workItems.findById(workItemId);

    if (workItem === null || workItem.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Work item not found.');
    }

    return workItem;
  }

  private async toListDtos(
    workItems: WorkItem[],
    repositories: Repositories
  ): Promise<WorkItemListItemDto[]> {
    return new WorkItemHydrator(repositories).list(workItems);
  }

  async toDetailDto(
    workItem: WorkItem,
    repositories: Repositories
  ): Promise<WorkItemDetailDto> {
    const labels = await repositories.labels.listByWorkItem(workItem.id);
    const comments = await repositories.comments.findByWorkItem(workItem.id);
    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    const relationships = await new WorkItemRelationshipService({
      persistence: this.context.persistence,
      actor: this.context.actor,
      repositories,
      clock: this.clock,
      idGenerator: this.idGenerator
    }).getRelationshipSummaryWithRepositories(workItem.id, repositories);
    const hierarchy = await this.loadHierarchyContext([workItem], repositories);

    return toWorkItemDetailDto({
      ...(await this.toBundle(workItem, repositories, labels)),
      parent: hierarchy.parentsByChildId.get(workItem.id) ?? null,
      childSummary: hierarchy.childSummariesByParentId.get(workItem.id) ?? null,
      dependencyCounts: relationships,
      relationships,
      comments: await this.toCommentDtos(comments, repositories),
      activity: await this.toActivityDtos(activity, repositories)
    });
  }

  private async loadHierarchyContext(
    workItems: WorkItem[],
    repositories: Repositories
  ): Promise<WorkItemHierarchyContext> {
    const workItemIds = workItems.map((workItem) => workItem.id);
    const parents = await repositories.workItems.listParentsForChildren(workItemIds);
    const childSummaries = await repositories.workItems.summarizeChildren(workItemIds);

    return {
      parentsByChildId: new Map(
        parents.map(({ childWorkItemId, parent }) => [
          childWorkItemId,
          this.toParentDto(parent)
        ])
      ),
      childSummariesByParentId: new Map(
        childSummaries.map(({ parentWorkItemId, summary }) => [parentWorkItemId, summary])
      )
    };
  }

  private toParentDto(workItem: Pick<WorkItem, 'id' | 'projectId' | 'displayKey' | 'title' | 'type' | 'status'>): WorkItemParentDto {
    return {
      id: workItem.id,
      projectId: workItem.projectId,
      displayKey: workItem.displayKey,
      title: workItem.title,
      type: workItem.type,
      status: workItem.status
    };
  }

  private async toBundle(
    workItem: WorkItem,
    repositories: Repositories,
    labels: Label[]
  ): Promise<WorkItemBundle> {
    const reporter = await repositories.members.findById(workItem.reporterId);
    const assignee =
      workItem.assigneeId === null ? null : await repositories.members.findById(workItem.assigneeId);
    const milestone =
      workItem.milestoneId === null ? null : await repositories.milestones.findById(workItem.milestoneId);
    const cycle =
      workItem.cycleId === null ? null : await repositories.projectCycles.findById(workItem.cycleId);

    if (reporter === null) {
      throw new NotFoundError('Work item reporter not found.');
    }

    if (workItem.milestoneId !== null && milestone === null) {
      throw new NotFoundError('Work item milestone not found.');
    }

    if (workItem.cycleId !== null && cycle === null) {
      throw new NotFoundError('Work item cycle not found.');
    }

    return {
      workItem,
      assignee,
      reporter,
      labels,
      milestone,
      cycle
    };
  }

  private async toCommentDtos(comments: Comment[], repositories: Repositories) {
    const dtos: CommentDto[] = [];
    const mentionsByCommentId = await this.getMentionsByCommentId(comments, repositories);

    for (const comment of comments) {
      const author = await this.requireMember(comment.authorId, repositories, 'Comment author not found.');
      const deletedBy =
        comment.deletedById === null
          ? null
          : await this.requireMember(comment.deletedById, repositories, 'Comment deletion actor not found.');
      dtos.push(toCommentDto(comment, author, deletedBy, mentionsByCommentId.get(comment.id) ?? []));
    }

    return dtos;
  }

  private async getMentionsByCommentId(
    comments: Comment[],
    repositories: Repositories
  ): Promise<Map<string, Member[]>> {
    const mentionsByCommentId = new Map<string, Member[]>();
    const mentions = await repositories.commentMentions.listByComments(
      comments.map((comment) => comment.id)
    );

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

  private async toActivityDtos(activity: ActivityEvent[], repositories: Repositories) {
    const dtos: ActivityEventDto[] = [];

    for (const event of activity) {
      const actor = await this.requireMember(event.actorId, repositories, 'Activity actor not found.');
      dtos.push(toActivityEventDto(event, actor));
    }

    return dtos;
  }

  private async requireMember(
    memberId: string,
    repositories: Repositories,
    message: string
  ): Promise<Member> {
    const member = await repositories.members.findById(memberId);

    if (member === null || member.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError(message);
    }

    return member;
  }
}
