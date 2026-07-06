import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private readonly document = inject(DOCUMENT);

  copyText(value: string): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;

    if (clipboard?.writeText !== undefined) {
      return clipboard.writeText(value);
    }

    return this.copyWithTextarea(value)
      ? Promise.resolve()
      : Promise.reject(new Error('Clipboard copy is not available.'));
  }

  private copyWithTextarea(value: string): boolean {
    if (this.document.body === null) {
      return false;
    }

    const textarea = this.document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';

    this.document.body.appendChild(textarea);
    textarea.select();

    try {
      return this.document.execCommand('copy');
    } finally {
      this.document.body.removeChild(textarea);
    }
  }
}
