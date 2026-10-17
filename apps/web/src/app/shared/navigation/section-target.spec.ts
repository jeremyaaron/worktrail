import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationSectionTargetDirective } from './section-target';

@Component({
  imports: [NavigationSectionTargetDirective],
  template: `<section [appNavigationSectionTarget]="fragment()" [navigationIdentity]="identity()" [navigationReady]="ready()">
    @if (ready()) { <details><summary>Result</summary><h2 id="cycle-result-heading">Result</h2></details> }
  </section>`
})
class TargetHost {
  readonly fragment = signal<string | null>('cycle-result-heading');
  readonly identity = signal('cycle-a');
  readonly ready = signal<object | null>(null);
}

describe('NavigationSectionTargetDirective', () => {
  it('waits for the accepted render, opens disclosure, focuses once and permits a new identity', async () => {
    const fixture = TestBed.createComponent(TargetHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#cycle-result-heading')).toBeNull();
    fixture.componentInstance.ready.set({});
    fixture.detectChanges();
    await fixture.whenStable();
    const heading = host.querySelector<HTMLElement>('#cycle-result-heading')!;
    expect(document.activeElement).toBe(heading);
    expect(heading.closest('details')?.open).toBeTrue();
    expect(heading.tabIndex).toBe(-1);
    expect(heading.style.scrollMarginBlockStart).toBe('88px');
    const focus = spyOn(heading, 'focus');
    fixture.componentInstance.ready.set({ refreshed: true });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(focus).not.toHaveBeenCalled();
    fixture.componentInstance.identity.set('cycle-b');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(focus).toHaveBeenCalledOnceWith({ preventScroll: true });
  });

  it('does not target unknown fragments or nodes outside the page owner', async () => {
    const fixture = TestBed.createComponent(TargetHost);
    fixture.componentInstance.fragment.set('unknown');
    fixture.componentInstance.ready.set({});
    fixture.detectChanges();
    await fixture.whenStable();
    const heading = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#cycle-result-heading')!;
    expect(document.activeElement).not.toBe(heading);
    fixture.componentInstance.fragment.set('report-summary-heading');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).not.toBe(heading);
    expect(heading.closest('details')?.open).toBeFalse();
  });
});
