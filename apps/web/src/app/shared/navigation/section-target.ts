import { Directive, ElementRef, afterRenderEffect, inject, input } from '@angular/core';
import { originSection } from './work-navigation';

export function focusSectionTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  if (target instanceof HTMLDetailsElement) target.open = true;
  target.querySelector<HTMLDetailsElement>(':scope > details')?.setAttribute('open', '');
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.style.scrollMarginBlockStart = '88px';
  target.focus({ preventScroll: true });
  // No animation, including reduced-motion users and repeated settled-file targets.
  target.scrollIntoView({ block: 'start' });
  return true;
}

@Directive({ selector: '[appNavigationSectionTarget]' })
export class NavigationSectionTargetDirective {
  readonly fragment = input<string | null>(null, { alias: 'appNavigationSectionTarget' });
  readonly navigationIdentity = input('');
  readonly navigationReady = input<unknown>(null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private fulfilled = '';

  constructor() {
    afterRenderEffect(() => {
      const fragment = originSection(this.fragment());
      const key = JSON.stringify([this.navigationIdentity(), fragment]);
      if (!this.navigationReady()) return;
      if (!fragment) { this.fulfilled = ''; return; }
      if (key === this.fulfilled) return;
      const node = this.host.nativeElement.querySelector<HTMLElement>('#' + CSS.escape(fragment));
      if (focusSectionTarget(node)) this.fulfilled = key;
    });
  }
}
