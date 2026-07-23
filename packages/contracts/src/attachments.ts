import type { MemberDto } from './members.js';

export type AttachmentCategory = 'image' | 'pdf' | 'text' | 'data' | 'document';

export interface WorkItemAttachmentDto {
  id: string;
  workItemId: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
  uploader: MemberDto;
  createdAt: string;
  permissions: {
    canRemove: boolean;
  };
}

export interface AttachmentTypePolicyDto {
  extensions: string[];
  mediaTypes: string[];
  canonicalMediaType: string;
  category: AttachmentCategory;
}

export interface AttachmentPolicyDto {
  maxFileBytes: number;
  maxAttachmentsPerWorkItem: number;
  maxAggregateBytesPerWorkItem: number;
  maxFileNameCodePoints: number;
  acceptedTypes: AttachmentTypePolicyDto[];
}

export interface WorkItemAttachmentUsageDto {
  attachmentCount: number;
  aggregateBytes: number;
  remainingAttachmentSlots: number;
  remainingBytes: number;
}

export interface WorkItemAttachmentListDto {
  items: WorkItemAttachmentDto[];
  policy: AttachmentPolicyDto;
  usage: WorkItemAttachmentUsageDto;
  permissions: {
    canUpload: boolean;
  };
}
