import { describe, expect, it, vi } from 'vitest';

import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { ClipboardService } from './clipboard.service';

describe('ClipboardService', () => {
  it('uses the browser clipboard API when available', async () => {
    const writeText = vi.fn<Clipboard['writeText']>().mockName('writeText').mockResolvedValue(undefined);
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

    expect(writeText).toHaveBeenCalledExactlyOnceWith('https://example.test/work-items');
  });

  it('falls back to a temporary textarea when clipboard API is unavailable', async () => {
    const textarea = {
      value: '',
      style: {} as Record<string, string>,
      setAttribute: vi.fn<Element['setAttribute']>().mockName('setAttribute'),
      select: vi.fn<HTMLTextAreaElement['select']>().mockName('select')
    };
    const body = {
      appendChild: vi.fn<(element: typeof textarea) => void>().mockName('appendChild'),
      removeChild: vi.fn<(element: typeof textarea) => void>().mockName('removeChild')
    };
    const documentRef = {
      body,
      createElement: vi.fn<(tagName: string) => typeof textarea>().mockName('createElement').mockReturnValue(textarea),
      defaultView: {
        navigator: {}
      },
      execCommand: vi.fn<Document['execCommand']>().mockName('execCommand').mockReturnValue(true)
    };

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: documentRef }]
    });

    await TestBed.inject(ClipboardService).copyText('https://example.test/projects/1/work-items');

    expect(documentRef.createElement).toHaveBeenCalledExactlyOnceWith('textarea');
    expect(textarea.value).toBe('https://example.test/projects/1/work-items');
    expect(textarea.setAttribute).toHaveBeenCalledExactlyOnceWith('readonly', '');
    expect(body.appendChild).toHaveBeenCalledExactlyOnceWith(textarea);
    expect(textarea.select).toHaveBeenCalled();
    expect(documentRef.execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(body.removeChild).toHaveBeenCalledExactlyOnceWith(textarea);
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

    await expect(TestBed.inject(ClipboardService).copyText('copy me')).rejects.toThrowError(
      'Clipboard copy is not available.'
    );
  });
});
