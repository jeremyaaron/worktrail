import { downloadBlob, fileNameFromContentDisposition } from './download-file';

describe('download helpers', () => {
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

  it('downloads blobs through an object URL and revokes it', () => {
    const link = document.createElement('a');
    spyOn(document, 'createElement').and.returnValue(link);
    spyOn(document.body, 'appendChild').and.callThrough();
    spyOn(link, 'click').and.stub();
    spyOn(link, 'remove').and.stub();

    const objectUrl = {
      createObjectURL: jasmine.createSpy('createObjectURL').and.returnValue('blob:test-url'),
      revokeObjectURL: jasmine.createSpy('revokeObjectURL')
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
