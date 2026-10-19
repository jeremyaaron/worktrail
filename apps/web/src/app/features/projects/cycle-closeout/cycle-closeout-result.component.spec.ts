import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ClipboardService } from '../../../shared/clipboard.service';
import { closeoutMarkdown } from './closeout-markdown';
import { historicalCloseout } from './closeout-test-fixture';
import { CycleCloseoutResultComponent } from './cycle-closeout-result.component';

describe('CycleCloseoutResultComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [CycleCloseoutResultComponent], providers: [provideRouter([])] }));

  for (const version of [1, 2] as const) {
    it(`presents all v${version} frozen rows with independent group paging, Show all and bounded Current links`, () => {
      const fixture = TestBed.createComponent(CycleCloseoutResultComponent);
      const closeout = historicalCloseout(version);
      const original = JSON.stringify(closeout);
      fixture.componentRef.setInput('closeout', closeout);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('Original author');
      expect(root.textContent).not.toContain('Renamed author');
      expect(root.textContent).toContain('Done at close');
      expect(root.textContent).toContain('Snapshot v' + version);
      const unfinished = root.querySelector<HTMLElement>('[aria-labelledby="snapshot-unfinished"]')!;
      const done = root.querySelector<HTMLElement>('[aria-labelledby="snapshot-completed"]')!;
      expect(unfinished.querySelectorAll('article').length).toBe(10);
      expect(done.querySelectorAll('article').length).toBe(10);
      unfinished.querySelector<HTMLButtonElement>('[aria-label="Next Unfinished at close page"]')!.click();
      fixture.detectChanges();
      expect(unfinished.querySelectorAll('article').length).toBe(2);
      expect(unfinished.textContent).toContain('Frozen commitment 311');
      expect(unfinished.textContent).toContain('11-12 of 12');
      expect(done.querySelectorAll('article').length).toBe(10);
      unfinished.querySelector<HTMLButtonElement>('[aria-pressed]')!.click();
      fixture.detectChanges();
      expect(unfinished.querySelectorAll('article').length).toBe(12);
      expect(unfinished.textContent).toContain('1-12 of 12');
      const link = unfinished.querySelector<HTMLAnchorElement>('a')!;
      expect(link.textContent).toContain('Current');
      expect(link.getAttribute('href')).toBe(`/work-items/${closeout.snapshot.items.unfinished[0]!.id}?returnUrl=${encodeURIComponent(`/projects/${closeout.projectId}/cycles/${closeout.cycleId}#cycle-result-heading`)}`);
      expect(JSON.stringify(closeout)).toBe(original);
      fixture.componentRef.setInput('closeout', historicalCloseout(version));
      fixture.detectChanges();
      expect(unfinished.querySelectorAll('article').length).toBe(10);
    });

    it(`prints and exports complete v${version} evidence without changing the screen page or stored data`, () => {
      const fixture = TestBed.createComponent(CycleCloseoutResultComponent);
      const closeout = historicalCloseout(version);
      const original = JSON.stringify(closeout);
      fixture.componentRef.setInput('closeout', closeout);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLButtonElement>('[aria-label="Next Unfinished at close page"]')!.click();
      fixture.detectChanges();
      fixture.componentInstance.beforePrint();
      expect(root.querySelectorAll('article').length).toBe(34);
      fixture.componentInstance.afterPrint();
      expect(root.querySelectorAll('[aria-labelledby="snapshot-unfinished"] article').length).toBe(2);
      const markdown = closeoutMarkdown(closeout);
      expect(markdown).toContain('Frozen commitment 311');
      expect(markdown).toContain('Done at close (11)');
      expect(markdown).toContain('Canceled at close (11)');
      expect(markdown).toContain('Unfinished at close (12)');
      expect(markdown).not.toContain('Renamed author');
      expect(JSON.parse(markdown.split('```json\n')[1]!.split('\n```')[0]!)).toEqual(closeout.snapshot);
      expect(JSON.stringify(closeout)).toBe(original);
    });
  }

  it('keeps arbitrary Markdown and HTML inert, including fences in frozen text', () => {
    const closeout = historicalCloseout(2);
    closeout.snapshot.items.unfinished[11]!.title = '<img src=x onerror=alert(1)> [go](javascript:alert(1)) ```';
    const markdown = closeoutMarkdown(closeout);
    expect(markdown).toContain('&lt;img');
    expect(markdown).toContain('\\[go\\]\\(javascript:alert\\(1\\)\\)');
    expect(markdown).toContain('````json\n');
    expect(markdown.endsWith('\n````\n')).toBe(true);
  });

  it('handles failed copies and ignores obsolete copy feedback after switching outcomes', async () => {
    const fixture = TestBed.createComponent(CycleCloseoutResultComponent);
    fixture.componentRef.setInput('closeout', historicalCloseout(1));
    fixture.detectChanges();
    let resolve!: () => void;
    const clipboard = vi.spyOn(TestBed.inject(ClipboardService), 'copyText').mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const pending = fixture.componentInstance.copyMarkdown();
    fixture.componentRef.setInput('closeout', historicalCloseout(2));
    fixture.detectChanges();
    resolve();
    await pending;
    expect(fixture.componentInstance.shareMessage()).toBe('');
    clipboard.mockRejectedValue(new Error('Denied'));
    await fixture.componentInstance.copyMarkdown();
    expect(fixture.componentInstance.shareMessage()).toContain('Copy failed');
    expect(fixture.componentInstance.isCopying()).toBe(false);
  });
});

afterEach(() => {
  try {
    TestBed.resetTestingModule();
  } finally {
    vi.restoreAllMocks();
    localStorage.removeItem('worktrail.selectedMemberId');
  }
});
