import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  viewChildren
} from '@angular/core';
import { isExternalAuthoredContentLink } from './authored-content-link';
import { parseAuthoredContent } from './authored-content-parser';

@Component({
  selector: 'app-authored-content-viewer',
  imports: [NgTemplateOutlet],
  templateUrl: './authored-content-viewer.component.html',
  styleUrl: './authored-content-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthoredContentViewerComponent {
  readonly source = input('');
  readonly format = input<string>('plain_text');
  readonly document = computed(() => parseAuthoredContent(this.source(), this.format()));
  private readonly origin = inject(DOCUMENT).location?.origin ?? '';
  private readonly codeRegions = viewChildren<ElementRef<HTMLPreElement>>('codeRegion');

  constructor() {
    afterRenderEffect({
      mixedReadWrite: (onCleanup) => {
        const regions = this.codeRegions().map((region) => region.nativeElement);
        const update = () => {
          for (const region of regions) {
            if (region.scrollWidth > region.clientWidth) {
              region.setAttribute('tabindex', '0');
              region.setAttribute('role', 'region');
              region.setAttribute('aria-label', 'Code block');
            } else {
              region.removeAttribute('tabindex');
              region.removeAttribute('role');
              region.removeAttribute('aria-label');
            }
          }
        };
        update();
        const observer = new ResizeObserver(update);
        for (const region of regions) observer.observe(region);
        onCleanup(() => observer.disconnect());
      }
    });
  }

  protected linkTarget(href: string): '_blank' | null {
    return isExternalAuthoredContentLink(href, this.origin) ? '_blank' : null;
  }
}
