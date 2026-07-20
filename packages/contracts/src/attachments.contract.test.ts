import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ActivityEventType,
  AttachmentPolicyDto,
  MemberDto,
  WorkItemAttachmentDto,
  WorkItemAttachmentListDto
} from './index.js';

const uploader = {
  id: 'member-id',
  workspaceId: 'workspace-id',
  name: 'Morgan Maintainer',
  email: 'morgan@example.com',
  role: 'maintainer',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-19T12:00:00.000Z',
  updatedAt: '2026-07-19T12:00:00.000Z'
} satisfies MemberDto;

const attachment = {
  id: 'attachment-id',
  workItemId: 'work-item-id',
  fileName: 'design-review.png',
  mediaType: 'image/png',
  byteSize: 1_024,
  uploader,
  createdAt: '2026-07-19T13:00:00.000Z',
  permissions: {
    canRemove: true
  }
} satisfies WorkItemAttachmentDto;

const policy = {
  maxFileBytes: 4 * 1024 * 1024,
  maxAttachmentsPerWorkItem: 20,
  maxAggregateBytesPerWorkItem: 50 * 1024 * 1024,
  maxFileNameCodePoints: 180,
  acceptedTypes: [
    {
      extensions: ['.png'],
      mediaTypes: ['image/png'],
      canonicalMediaType: 'image/png',
      category: 'image'
    }
  ]
} satisfies AttachmentPolicyDto;

describe('attachment contracts', () => {
  it('keeps public attachment metadata independent from storage internals', () => {
    expect(attachment.permissions.canRemove).toBe(true);
    expect('storageKey' in attachment).toBe(false);
    expect('checksum' in attachment).toBe(false);
    expect('bytes' in attachment).toBe(false);
    expectTypeOf(attachment).toMatchTypeOf<WorkItemAttachmentDto>();
  });

  it('describes policy, usage, and server-returned capabilities', () => {
    const response = {
      items: [attachment],
      policy,
      usage: {
        attachmentCount: 1,
        aggregateBytes: attachment.byteSize,
        remainingAttachmentSlots: 19,
        remainingBytes: policy.maxAggregateBytesPerWorkItem - attachment.byteSize
      },
      permissions: {
        canUpload: true
      }
    } satisfies WorkItemAttachmentListDto;

    expect(response.policy.acceptedTypes[0]?.category).toBe('image');
    expect(response.usage.remainingAttachmentSlots).toBe(19);
    expect(response.permissions.canUpload).toBe(true);
    expectTypeOf(response).toMatchTypeOf<WorkItemAttachmentListDto>();
  });

  it('adds upload and removal to work item activity vocabulary', () => {
    const eventTypes = [
      'work_item.attachment_uploaded',
      'work_item.attachment_removed'
    ] satisfies ActivityEventType[];

    expect(eventTypes).toEqual(['work_item.attachment_uploaded', 'work_item.attachment_removed']);
  });
});
