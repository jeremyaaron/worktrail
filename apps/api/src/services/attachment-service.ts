import type { WorkItemAttachmentDto, WorkItemAttachmentListDto } from '@worktrail/contracts';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import {
  attachmentPolicy,
  attachmentPolicyDto,
  validateAttachmentFile
} from '../domain/attachment-policy.js';
import {
  AttachmentLimitExceededError,
  AttachmentStorageUnavailableError,
  ConflictError,
  ForbiddenError,
  NotFoundError
} from '../errors/app-error.js';
import { type Repositories, withRepositoriesTransaction } from '../repositories/index.js';
import type { Member, Project, WorkItem, WorkItemAttachment } from '../repositories/types.js';
import type { AttachmentObjectStore } from '../storage/attachment-object-store.js';
import {
  type AttachmentOperationalLogEntry,
  type AttachmentOperationalLogger,
  consoleAttachmentOperationalLogger
} from './attachment-operational-logger.js';
import { toWorkItemAttachmentDto, toWorkItemAttachmentUsageDto } from './attachment-dto.js';

export interface AttachmentServiceContext {
  repositories: Repositories;
  db: WorktrailDb;
  objectStore: AttachmentObjectStore;
  now?: () => Date;
  createId?: () => string;
  createStorageKey?: () => string;
  logger?: AttachmentOperationalLogger;
}

export interface AttachmentUploadInput {
  fileName: string;
  declaredMediaType: string;
  bytes: Uint8Array;
}

interface ResolvedWorkItemContext {
  workItem: WorkItem;
  project: Project;
}

export class AttachmentService {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly createStorageKey: () => string;
  private readonly logger: AttachmentOperationalLogger;

  constructor(private readonly context: AttachmentServiceContext) {
    this.now = context.now ?? (() => new Date());
    this.createId = context.createId ?? randomUUID;
    this.createStorageKey = context.createStorageKey ?? (() => randomBytes(32).toString('hex'));
    this.logger = context.logger ?? consoleAttachmentOperationalLogger;
  }

  async listForWorkItem(
    actor: ActorContext,
    workItemId: string
  ): Promise<WorkItemAttachmentListDto> {
    const actorMember = await this.requireActiveActor(actor, this.context.repositories);
    const { workItem, project } = await this.requireWorkItemContext(
      actor,
      workItemId,
      this.context.repositories
    );
    const [attachments, usage] = await Promise.all([
      this.context.repositories.workItemAttachments.listByWorkItem(workItem.id),
      this.context.repositories.workItemAttachments.getUsageByWorkItem(workItem.id)
    ]);
    const uploaderIds = [...new Set(attachments.map((attachment) => attachment.uploaderMemberId))];
    const uploaders = await this.context.repositories.members.listByIds(uploaderIds);
    const uploadersById = new Map(uploaders.map((uploader) => [uploader.id, uploader]));

    return {
      items: attachments.map((attachment) => {
        const uploader = uploadersById.get(attachment.uploaderMemberId);

        if (uploader === undefined || uploader.workspaceId !== actor.workspaceId) {
          throw new NotFoundError('Attachment uploader not found.');
        }

        return toWorkItemAttachmentDto({
          attachment,
          uploader,
          canRemove: this.canRemove(actorMember, project, attachment)
        });
      }),
      policy: attachmentPolicyDto(),
      usage: toWorkItemAttachmentUsageDto(usage),
      permissions: {
        canUpload: project.status === 'active'
      }
    };
  }

  async upload(
    actor: ActorContext,
    workItemId: string,
    input: AttachmentUploadInput
  ): Promise<WorkItemAttachmentDto> {
    const bytes = Uint8Array.from(input.bytes);
    const validatedFile = await validateAttachmentFile({
      fileName: input.fileName,
      declaredMediaType: input.declaredMediaType,
      bytes
    });
    await this.requireActiveActor(actor, this.context.repositories);
    const prechecked = await this.requireWorkItemContext(
      actor,
      workItemId,
      this.context.repositories
    );
    this.assertProjectWritable(prechecked.project);

    const attachmentId = this.createId();
    const storageKey = this.createStorageKey();
    const timestamp = this.now();
    const checksumSha256 = createHash('sha256').update(bytes).digest('hex');

    try {
      await this.context.objectStore.put(storageKey, bytes);
    } catch (error) {
      this.logError(this.logEntry('upload_write', attachmentId, 'failed', error));
      throw new AttachmentStorageUnavailableError();
    }

    try {
      const created = await withRepositoriesTransaction(this.context.db, async (repositories) => {
        const project = await repositories.projects.findByIdForShare(prechecked.project.id);

        if (project === null || project.workspaceId !== actor.workspaceId) {
          throw new NotFoundError('Project not found.');
        }

        const [workItem] = await repositories.workItems.findManyByIdsForUpdate([workItemId]);

        if (
          workItem === undefined ||
          workItem.workspaceId !== actor.workspaceId ||
          workItem.projectId !== project.id
        ) {
          throw new NotFoundError('Work item not found.');
        }

        this.assertProjectWritable(project);
        const uploader = await this.requireActiveActor(actor, repositories);
        const usage = await repositories.workItemAttachments.getUsageByWorkItem(workItem.id);
        this.assertCapacity(usage, validatedFile.byteSize);

        const attachment = await repositories.workItemAttachments.create({
          id: attachmentId,
          workspaceId: workItem.workspaceId,
          projectId: workItem.projectId,
          workItemId: workItem.id,
          uploaderMemberId: uploader.id,
          fileName: validatedFile.fileName,
          mediaType: validatedFile.mediaType,
          byteSize: validatedFile.byteSize,
          checksumSha256,
          storageKey,
          createdAt: timestamp
        });

        if (attachment === undefined) {
          throw new Error('Attachment metadata insert returned no record.');
        }

        await repositories.activityEvents.create({
          id: this.createId(),
          workspaceId: workItem.workspaceId,
          projectId: workItem.projectId,
          workItemId: workItem.id,
          actorId: uploader.id,
          eventType: 'work_item.attachment_uploaded',
          summary: `Uploaded attachment "${validatedFile.fileName}".`,
          previousValue: null,
          newValue: {
            attachment: {
              id: attachment.id,
              fileName: attachment.fileName,
              mediaType: attachment.mediaType,
              byteSize: attachment.byteSize
            }
          },
          metadata: { attachmentId: attachment.id },
          createdAt: timestamp
        });

        return { attachment, uploader };
      });

      return toWorkItemAttachmentDto({
        attachment: created.attachment,
        uploader: created.uploader,
        canRemove: true
      });
    } catch (error) {
      await this.compensateUpload(attachmentId, storageKey);
      throw error;
    }
  }

  private async requireWorkItemContext(
    actor: ActorContext,
    workItemId: string,
    repositories: Repositories
  ): Promise<ResolvedWorkItemContext> {
    const workItem = await repositories.workItems.findById(workItemId);

    if (workItem === null || workItem.workspaceId !== actor.workspaceId) {
      throw new NotFoundError('Work item not found.');
    }

    const project = await repositories.projects.findById(workItem.projectId);

    if (project === null || project.workspaceId !== actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return { workItem, project };
  }

  private async requireActiveActor(
    actor: ActorContext,
    repositories: Repositories
  ): Promise<Member> {
    const member = await repositories.members.findById(actor.memberId);

    if (member === null || member.workspaceId !== actor.workspaceId || !member.isActive) {
      throw new ForbiddenError('Inactive or unknown members cannot access attachments.');
    }

    return member;
  }

  private assertProjectWritable(project: Project): void {
    if (project.status === 'archived') {
      throw new ConflictError('Attachments cannot be changed for archived projects.');
    }
  }

  private assertCapacity(
    usage: { attachmentCount: number; aggregateBytes: number },
    incomingBytes: number
  ): void {
    if (usage.attachmentCount >= attachmentPolicy.maxAttachmentsPerWorkItem) {
      throw new AttachmentLimitExceededError({
        limit: 'attachment_count',
        maximum: attachmentPolicy.maxAttachmentsPerWorkItem
      });
    }

    if (usage.aggregateBytes + incomingBytes > attachmentPolicy.maxAggregateBytesPerWorkItem) {
      throw new AttachmentLimitExceededError({
        limit: 'aggregate_bytes',
        maximum: attachmentPolicy.maxAggregateBytesPerWorkItem
      });
    }
  }

  private canRemove(actor: Member, project: Project, attachment: WorkItemAttachment): boolean {
    return (
      project.status === 'active' &&
      (attachment.uploaderMemberId === actor.id ||
        actor.role === 'owner' ||
        actor.role === 'maintainer')
    );
  }

  private async compensateUpload(attachmentId: string, storageKey: string): Promise<void> {
    try {
      const outcome = await this.context.objectStore.remove(storageKey);

      if (outcome === 'missing') {
        this.logError({
          operation: 'upload_compensation',
          attachmentId,
          outcome: 'missing'
        });
      }
    } catch (error) {
      this.logError(this.logEntry('upload_compensation', attachmentId, 'failed', error));
    }
  }

  private logEntry(
    operation: AttachmentOperationalLogEntry['operation'],
    attachmentId: string,
    outcome: AttachmentOperationalLogEntry['outcome'],
    error: unknown
  ): AttachmentOperationalLogEntry {
    return {
      operation,
      attachmentId,
      outcome,
      errorName: error instanceof Error ? error.name : 'UnknownError'
    };
  }

  private logError(entry: AttachmentOperationalLogEntry): void {
    try {
      this.logger.error(entry);
    } catch {
      // Operational logging must not change storage compensation or API error behavior.
    }
  }
}
