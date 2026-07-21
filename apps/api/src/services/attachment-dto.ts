import type { WorkItemAttachmentDto, WorkItemAttachmentUsageDto } from '@worktrail/contracts';

import type { Member, WorkItemAttachment } from '../repositories/types.js';
import type { WorkItemAttachmentUsage } from '../repositories/work-item-attachment-repository.js';
import { attachmentPolicy } from '../domain/attachment-policy.js';
import { toMemberDto } from './dto.js';

export function toWorkItemAttachmentDto(input: {
  attachment: WorkItemAttachment;
  uploader: Member;
  canRemove: boolean;
}): WorkItemAttachmentDto {
  return {
    id: input.attachment.id,
    workItemId: input.attachment.workItemId,
    fileName: input.attachment.fileName,
    mediaType: input.attachment.mediaType,
    byteSize: input.attachment.byteSize,
    uploader: toMemberDto(input.uploader),
    createdAt: input.attachment.createdAt.toISOString(),
    permissions: {
      canRemove: input.canRemove
    }
  };
}

export function toWorkItemAttachmentUsageDto(
  usage: WorkItemAttachmentUsage
): WorkItemAttachmentUsageDto {
  return {
    attachmentCount: usage.attachmentCount,
    aggregateBytes: usage.aggregateBytes,
    remainingAttachmentSlots: Math.max(
      0,
      attachmentPolicy.maxAttachmentsPerWorkItem - usage.attachmentCount
    ),
    remainingBytes: Math.max(
      0,
      attachmentPolicy.maxAggregateBytesPerWorkItem - usage.aggregateBytes
    )
  };
}
