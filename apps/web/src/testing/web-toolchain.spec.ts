import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { QuickFindResponseDto } from '@worktrail/contracts';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuickFindApi } from '../app/core/api/quick-find-api';
import { CurrentUserService } from '../app/core/current-user.service';
import { QuickFindDialogComponent } from '../app/features/quick-find/quick-find-dialog.component';

describe('web toolchain integration', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('renders icons and native focus while controlling the Quick Find debounce', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const pending = new Subject<QuickFindResponseDto>();
    const search = vi.fn<QuickFindApi['search']>().mockReturnValue(pending);
    await TestBed.configureTestingModule({
      imports: [QuickFindDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: {} },
        { provide: DialogRef, useValue: { close: vi.fn(), closed: new Subject<void>() } },
        { provide: QuickFindApi, useValue: { search } },
        { provide: CurrentUserService, useValue: { selectedMember: signal({ id: 'member-1' }) } },
        provideRouter([])
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(QuickFindDialogComponent);
    try {
      fixture.detectChanges();
      fixture.componentInstance.queryControl.setValue('release');
      await vi.advanceTimersByTimeAsync(219);
      expect(search).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(search).toHaveBeenCalledExactlyOnceWith({ query: 'release' });
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      input.focus();
      expect(document.activeElement).toBe(input);
      expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
    } finally { fixture.destroy(); }
  });
});
