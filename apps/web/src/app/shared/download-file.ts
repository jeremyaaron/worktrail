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
  const safeFallback = safeDownloadFileName(fallbackFileName, 'download');

  if (contentDisposition === null || contentDisposition.trim() === '') {
    return safeFallback;
  }

  const encodedMatch = /(?:^|;)\s*filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);

  if (encodedMatch?.[1] !== undefined) {
    try {
      return safeDownloadFileName(
        decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, '')),
        safeFallback
      );
    } catch {
      // Fall through to a safe ASCII filename or the caller-provided fallback.
    }
  }

  const quotedMatch = /(?:^|;)\s*filename="([^"]+)"/i.exec(contentDisposition);

  if (quotedMatch?.[1] !== undefined) {
    return safeDownloadFileName(quotedMatch[1], safeFallback);
  }

  const plainMatch = /(?:^|;)\s*filename=([^;]+)/i.exec(contentDisposition);

  return safeDownloadFileName(plainMatch?.[1]?.trim() ?? '', safeFallback);
}

function safeDownloadFileName(value: string, fallback: string): string {
  const normalized = value
    .normalize('NFC')
    .replace(/[/\\]/g, '_')
    .split('')
    .filter((character) => !isControlCharacter(character))
    .join('')
    .trim();

  return normalized === '' || normalized === '.' || normalized === '..' ? fallback : normalized;
}

function isControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x2028 ||
    codePoint === 0x2029
  );
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
