export interface AttachmentOperationalLogEntry {
  operation:
    | 'upload_write'
    | 'upload_compensation'
    | 'download_read'
    | 'download_integrity'
    | 'remove_object'
    | 'remove_stale_object';
  attachmentId: string;
  outcome: 'failed' | 'missing' | 'integrity_mismatch';
  errorName?: string;
}

export interface AttachmentOperationalLogger {
  warn(entry: AttachmentOperationalLogEntry): void;
  error(entry: AttachmentOperationalLogEntry): void;
}

export const consoleAttachmentOperationalLogger: AttachmentOperationalLogger = {
  warn(entry) {
    console.warn('Attachment operation warning.', entry);
  },
  error(entry) {
    console.error('Attachment operation failed.', entry);
  }
};
