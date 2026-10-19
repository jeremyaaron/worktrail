import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob, fileNameFromContentDisposition } from './download-file';

describe('download helpers', () => {
  let link: HTMLAnchorElement | undefined;
  afterEach(() => {
    vi.restoreAllMocks();
    link?.remove();
    link = undefined;
  });

  it('extracts filenames from content disposition headers', () => {
    expect(
      fileNameFromContentDisposition(
        'attachment; filename="worktrail-work-items.csv"',
        'fallback.csv'
      )
    ).toBe('worktrail-work-items.csv');
    expect(
      fileNameFromContentDisposition(
        "attachment; filename*=UTF-8''worktrail%20items.csv",
        'fallback.csv'
      )
    ).toBe('worktrail items.csv');
    expect(fileNameFromContentDisposition(null, 'fallback.csv')).toBe('fallback.csv');
  });

  it('falls back safely for malformed or unsafe server filenames', () => {
    expect(
      fileNameFromContentDisposition(
        "attachment; filename=report.csv; filename*=UTF-8''%E0%A4%A",
        'fallback.csv'
      )
    ).toBe('report.csv');
    expect(
      fileNameFromContentDisposition('attachment; filename="../report.csv"', 'fallback.csv')
    ).toBe('.._report.csv');
    expect(fileNameFromContentDisposition('attachment; filename="\u0000"', '../fallback.csv')).toBe(
      '.._fallback.csv'
    );
  });

  it('downloads blobs through an object URL and revokes it', () => {
    link = document.createElement('a');
    vi.spyOn(document, 'createElement').mockReturnValue(link);
    vi.spyOn(document.body, 'appendChild');
    vi.spyOn(link, 'click').mockImplementation(() => undefined);
    vi.spyOn(link, 'remove').mockImplementation(() => undefined);

    const objectUrl = {
      createObjectURL: vi.fn<typeof URL.createObjectURL>().mockName('createObjectURL').mockReturnValue('blob:test-url'),
      revokeObjectURL: vi.fn<typeof URL.revokeObjectURL>().mockName('revokeObjectURL')
    };
    const blob = new Blob(['project_key\n'], { type: 'text/csv' });

    downloadBlob({
      blob,
      fileName: 'worktrail-work-items.csv',
      documentRef: document,
      objectUrl
    });

    expect(objectUrl.createObjectURL).toHaveBeenCalledWith(blob);
    expect(link.href).toBe('blob:test-url');
    expect(link.download).toBe('worktrail-work-items.csv');
    expect(document.body.appendChild).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalled();
    expect(link.remove).toHaveBeenCalled();
    expect(objectUrl.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });
});
