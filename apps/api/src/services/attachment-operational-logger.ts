export interface AttachmentOperationalLogEntry {
  operation: 'upload_write' | 'upload_compensation';
  attachmentId: string;
  outcome: 'failed' | 'missing';
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
