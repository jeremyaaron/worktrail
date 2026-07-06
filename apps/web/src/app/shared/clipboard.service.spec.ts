import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { ClipboardService } from './clipboard.service';

describe('ClipboardService', () => {
  it('uses the browser clipboard API when available', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    const documentRef = {
      defaultView: {
        navigator: {
          clipboard: { writeText }
        }
      }
    };

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: documentRef }]
    });

    await TestBed.inject(ClipboardService).copyText('https://example.test/work-items');

    expect(writeText).toHaveBeenCalledOnceWith('https://example.test/work-items');
  });

  it('falls back to a temporary textarea when clipboard API is unavailable', async () => {
    const textarea = {
      value: '',
      style: {} as Record<string, string>,
      setAttribute: jasmine.createSpy('setAttribute'),
      select: jasmine.createSpy('select')
    };
    const body = {
      appendChild: jasmine.createSpy('appendChild'),
      removeChild: jasmine.createSpy('removeChild')
    };
    const documentRef = {
      body,
      createElement: jasmine.createSpy('createElement').and.returnValue(textarea),
      defaultView: {
        navigator: {}
      },
      execCommand: jasmine.createSpy('execCommand').and.returnValue(true)
    };

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: documentRef }]
    });

    await TestBed.inject(ClipboardService).copyText('https://example.test/projects/1/work-items');

    expect(documentRef.createElement).toHaveBeenCalledOnceWith('textarea');
    expect(textarea.value).toBe('https://example.test/projects/1/work-items');
    expect(textarea.setAttribute).toHaveBeenCalledOnceWith('readonly', '');
    expect(body.appendChild).toHaveBeenCalledOnceWith(textarea);
    expect(textarea.select).toHaveBeenCalled();
    expect(documentRef.execCommand).toHaveBeenCalledOnceWith('copy');
    expect(body.removeChild).toHaveBeenCalledOnceWith(textarea);
  });

  it('rejects when no copy mechanism is available', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DOCUMENT,
          useValue: {
            body: null,
            defaultView: {
              navigator: {}
            }
          }
        }
      ]
    });

    await expectAsync(TestBed.inject(ClipboardService).copyText('copy me')).toBeRejectedWithError(
      'Clipboard copy is not available.'
    );
  });
});
