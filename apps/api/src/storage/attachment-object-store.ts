export type AttachmentObjectStoreOperation = 'initialize' | 'put' | 'get' | 'remove';

export type AttachmentObjectStoreFailureReason =
  'invalid_key' | 'object_exists' | 'invalid_object' | 'object_too_large' | 'unavailable';

export type AttachmentObjectRemovalOutcome = 'removed' | 'missing';

export interface AttachmentObjectStore {
  initialize(): Promise<void>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<AttachmentObjectRemovalOutcome>;
}

export class AttachmentObjectStoreError extends Error {
  constructor(
    readonly operation: AttachmentObjectStoreOperation,
    readonly reason: AttachmentObjectStoreFailureReason
  ) {
    super(`Attachment object storage ${operation} failed.`);
    this.name = 'AttachmentObjectStoreError';
  }
}

const opaqueAttachmentKeyPattern = /^[a-f0-9]{64}$/;

export function assertAttachmentObjectKey(
  key: string,
  operation: AttachmentObjectStoreOperation
): void {
  if (!opaqueAttachmentKeyPattern.test(key)) {
    throw new AttachmentObjectStoreError(operation, 'invalid_key');
  }
}
