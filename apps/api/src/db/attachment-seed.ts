import { sql } from 'drizzle-orm';

import type { WorktrailDb } from './client.js';
import { activityEvents, workItemAttachments } from './schema.js';
import type { AttachmentObjectStore } from '../storage/attachment-object-store.js';
import { deterministicSeedAttachments, type DeterministicSeedAttachment } from './demo-attachments.js';

export { deterministicSeedAttachments, type DeterministicSeedAttachment } from './demo-attachments.js';

export interface AttachmentSeedReferences {
  workspaceId: string;
  projectId: string;
  workItemId: string;
  ownerMemberId: string;
  maintainerMemberId: string;
}

export async function seedDeterministicAttachments(input: {
  db: WorktrailDb;
  objectStore: AttachmentObjectStore;
  references: AttachmentSeedReferences;
  attachments?: readonly DeterministicSeedAttachment[];
}): Promise<void> {
  const attachments = input.attachments ?? deterministicSeedAttachments;

  for (const attachment of attachments) {
    await ensureExactObject(input.objectStore, attachment.storageKey, attachment.bytes);
  }

  await input.db.transaction(async (tx) => {
    for (const attachment of attachments) {
      const uploaderMemberId =
        attachment.uploader === 'owner'
          ? input.references.ownerMemberId
          : input.references.maintainerMemberId;

      await tx
        .insert(workItemAttachments)
        .values({
          id: attachment.id,
          workspaceId: input.references.workspaceId,
          projectId: input.references.projectId,
          workItemId: input.references.workItemId,
          uploaderMemberId,
          fileName: attachment.fileName,
          mediaType: attachment.mediaType,
          byteSize: attachment.byteSize,
          checksumSha256: attachment.checksumSha256,
          storageKey: attachment.storageKey,
          createdAt: attachment.createdAt
        })
        .onConflictDoUpdate({
          target: workItemAttachments.id,
          set: {
            workspaceId: sql`excluded.workspace_id`,
            projectId: sql`excluded.project_id`,
            workItemId: sql`excluded.work_item_id`,
            uploaderMemberId: sql`excluded.uploader_member_id`,
            fileName: sql`excluded.file_name`,
            mediaType: sql`excluded.media_type`,
            byteSize: sql`excluded.byte_size`,
            checksumSha256: sql`excluded.checksum_sha256`,
            storageKey: sql`excluded.storage_key`,
            createdAt: sql`excluded.created_at`
          }
        });

      await tx
        .insert(activityEvents)
        .values({
          id: attachment.activityEventId,
          workspaceId: input.references.workspaceId,
          projectId: input.references.projectId,
          workItemId: input.references.workItemId,
          actorId: uploaderMemberId,
          eventType: 'work_item.attachment_uploaded',
          summary: `Uploaded attachment "${attachment.fileName}".`,
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
          createdAt: attachment.createdAt
        })
        .onConflictDoUpdate({
          target: activityEvents.id,
          set: {
            workspaceId: sql`excluded.workspace_id`,
            projectId: sql`excluded.project_id`,
            workItemId: sql`excluded.work_item_id`,
            actorId: sql`excluded.actor_id`,
            eventType: sql`excluded.event_type`,
            summary: sql`excluded.summary`,
            previousValue: sql`excluded.previous_value`,
            newValue: sql`excluded.new_value`,
            metadata: sql`excluded.metadata`,
            createdAt: sql`excluded.created_at`
          }
        });
    }
  });
}

async function ensureExactObject(
  objectStore: AttachmentObjectStore,
  key: string,
  expectedBytes: Uint8Array
): Promise<void> {
  const existingBytes = await objectStore.get(key);

  if (existingBytes !== null && bytesEqual(existingBytes, expectedBytes)) {
    return;
  }

  if (existingBytes !== null) {
    await objectStore.remove(key);
  }

  await objectStore.put(key, expectedBytes);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
