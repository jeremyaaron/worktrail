export interface ObjectUrlAdapter {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface DownloadBlobOptions {
  blob: Blob;
  fileName: string;
  documentRef?: Document;
  objectUrl?: ObjectUrlAdapter;
}

export function fileNameFromContentDisposition(
  contentDisposition: string | null,
  fallbackFileName: string
): string {
  if (contentDisposition === null || contentDisposition.trim() === '') {
    return fallbackFileName;
  }

  const encodedMatch = /(?:^|;)\s*filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);

  if (encodedMatch?.[1] !== undefined) {
    return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, ''));
  }

  const quotedMatch = /(?:^|;)\s*filename="([^"]+)"/i.exec(contentDisposition);

  if (quotedMatch?.[1] !== undefined) {
    return quotedMatch[1];
  }

  const plainMatch = /(?:^|;)\s*filename=([^;]+)/i.exec(contentDisposition);

  return plainMatch?.[1]?.trim() || fallbackFileName;
}

export function downloadBlob(options: DownloadBlobOptions): void {
  const documentRef = options.documentRef ?? document;
  const objectUrl = options.objectUrl ?? URL;
  const url = objectUrl.createObjectURL(options.blob);
  const link = documentRef.createElement('a');

  link.href = url;
  link.download = options.fileName;
  link.style.display = 'none';
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  objectUrl.revokeObjectURL(url);
}
