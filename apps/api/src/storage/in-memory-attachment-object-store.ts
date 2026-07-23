import { attachmentPolicy } from '../domain/attachment-policy.js';
import {
  assertAttachmentObjectKey,
  AttachmentObjectStoreError,
  type AttachmentObjectRemovalOutcome,
  type AttachmentObjectStore,
  type AttachmentObjectStoreOperation
} from './attachment-object-store.js';

export class InMemoryAttachmentObjectStore implements AttachmentObjectStore {
  private readonly objects = new Map<string, Uint8Array>();
  private readonly pendingFailures = new Set<AttachmentObjectStoreOperation>();

  failNext(operation: AttachmentObjectStoreOperation): void {
    this.pendingFailures.add(operation);
  }

  async initialize(): Promise<void> {
    this.throwPendingFailure('initialize');
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    assertAttachmentObjectKey(key, 'put');
    this.throwPendingFailure('put');

    if (this.objects.has(key)) {
      throw new AttachmentObjectStoreError('put', 'object_exists');
    }

    this.objects.set(key, Uint8Array.from(bytes));
  }

  async get(key: string): Promise<Uint8Array | null> {
    assertAttachmentObjectKey(key, 'get');
    this.throwPendingFailure('get');
    const bytes = this.objects.get(key);

    if (bytes === undefined) {
      return null;
    }

    if (bytes.byteLength > attachmentPolicy.maxFileBytes) {
      throw new AttachmentObjectStoreError('get', 'object_too_large');
    }

    return Uint8Array.from(bytes);
  }

  async remove(key: string): Promise<AttachmentObjectRemovalOutcome> {
    assertAttachmentObjectKey(key, 'remove');
    this.throwPendingFailure('remove');
    return this.objects.delete(key) ? 'removed' : 'missing';
  }

  private throwPendingFailure(operation: AttachmentObjectStoreOperation): void {
    if (this.pendingFailures.delete(operation)) {
      throw new AttachmentObjectStoreError(operation, 'unavailable');
    }
  }
}
