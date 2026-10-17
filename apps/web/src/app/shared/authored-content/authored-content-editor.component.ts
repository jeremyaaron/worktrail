import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import {
  LucideBold,
  LucideItalic,
  LucideHeading2,
  LucideList,
  LucideListOrdered,
  LucideQuote,
  LucideCode,
  LucideSquareCode,
  LucideLink,
  LucideCheck,
  LucideX
} from '@lucide/angular';
import { authoredContentSourceLimit, normalizeAuthoredContentSource } from '@worktrail/contracts';
import {
  applyAuthoredContentCommand,
  insertAuthoredContentLink,
  type AuthoredContentCommand,
  type AuthoredContentTextEdit
} from './authored-content-edit-commands';
import type { AuthoredContentValue } from './authored-content-value';
import { AuthoredContentViewerComponent } from './authored-content-viewer.component';

interface LinkSelection {
  readonly source: string;
  readonly start: number;
  readonly end: number;
  readonly revision: number;
}

@Component({
  selector: 'app-authored-content-editor',
  imports: [
    AuthoredContentViewerComponent,
    LucideBold,
    LucideItalic,
    LucideHeading2,
    LucideList,
    LucideListOrdered,
    LucideQuote,
    LucideCode,
    LucideSquareCode,
    LucideLink,
    LucideCheck,
    LucideX
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AuthoredContentEditorComponent),
      multi: true
    }
  ],
  templateUrl: './authored-content-editor.component.html',
  styleUrl: './authored-content-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(focusout)': 'focusOut($event)', '(keydown)': 'escapeLink($event)' }
})
export class AuthoredContentEditorComponent implements ControlValueAccessor {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly rows = input(8);
  readonly errorDescriptionIds = input('');
  readonly invalid = input(false);
  readonly resetIdentity = input<unknown>(null);
  readonly value = signal<AuthoredContentValue>({ source: '', format: 'markdown_v1' });
  readonly disabled = signal(false);
  readonly composing = signal(false);
  readonly urlComposing = signal(false);
  readonly toolsDisabled = computed(
    () => this.disabled() || this.composing() || this.urlComposing()
  );
  readonly mode = signal<'edit' | 'preview'>('edit');
  readonly revision = signal(0);
  readonly textareaInstances = computed(() => [{ revision: this.revision() }]);
  readonly linkSelection = signal<LinkSelection | null>(null);
  readonly linkUrl = signal('');
  readonly linkError = signal<string | null>(null);
  readonly sourceCount = computed(() => normalizeAuthoredContentSource(this.value().source).length);
  readonly sourceLimit = authoredContentSourceLimit;
  readonly describedBy = computed(() =>
    [this.errorDescriptionIds(), `${this.fieldId()}-count`].filter(Boolean).join(' ')
  );
  readonly previewHeight = computed(() => Math.max(2, this.rows()) * 21 + 22);
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly linkInput = viewChild<ElementRef<HTMLInputElement>>('linkInput');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private onChange: (value: AuthoredContentValue) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      this.resetIdentity();
      untracked(() => this.resetLocalState());
    });
    effect(() => {
      const textarea = this.textarea()?.nativeElement;
      const source = this.value().source;
      // Avoid rewriting native input events: assigning value can discard the browser's undo history.
      if (textarea && textarea.value !== normalizeAuthoredContentSource(source))
        textarea.value = source;
    });
  }

  writeValue(value: AuthoredContentValue | null): void {
    this.value.set(value ? { ...value } : { source: '', format: 'markdown_v1' });
    this.resetLocalState();
  }

  registerOnChange(fn: (value: AuthoredContentValue) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    if (disabled) {
      this.composing.set(false);
      this.clearLink();
    }
  }

  protected focusOut(event: FocusEvent): void {
    if (event.target instanceof Element) {
      const revision = event.target
        .closest('[data-editor-revision]')
        ?.getAttribute('data-editor-revision');
      if (revision !== undefined && revision !== null && revision !== String(this.revision()))
        return;
    }
    if (
      event.relatedTarget instanceof Node &&
      this.host.nativeElement.contains(event.relatedTarget)
    )
      return;
    const revision = this.revision();
    queueMicrotask(() => {
      if (
        this.revision() === revision &&
        !this.disabled() &&
        this.host.nativeElement.isConnected &&
        !this.host.nativeElement.contains(this.document.activeElement)
      )
        this.onTouched();
    });
  }

  protected sourceInput(event: Event): void {
    if (this.disabled() || this.composing() || (event as InputEvent).isComposing) return;
    if (event.target !== this.currentTextarea()) return;
    this.clearLink();
    this.change({ ...this.value(), source: this.textarea()!.nativeElement.value });
  }

  protected compositionStart(event: Event): void {
    if (!this.disabled() && event.target === this.currentTextarea()) this.composing.set(true);
  }

  protected compositionEnd(event: Event): void {
    if (event.target !== this.currentTextarea()) return;
    this.composing.set(false);
    this.sourceInput(event);
  }

  protected changeFormat(event: Event): void {
    if (this.toolsDisabled()) return;
    const format = (event.target as HTMLSelectElement).value;
    if (format !== 'plain_text' && format !== 'markdown_v1') return;
    this.clearLink();
    this.change({ source: this.value().source, format });
  }

  protected changeMode(mode: 'edit' | 'preview'): void {
    if (this.toolsDisabled()) return;
    this.clearLink();
    this.mode.set(mode);
  }

  protected command(command: AuthoredContentCommand): void {
    const textarea = this.editableTextarea();
    if (!textarea) return;
    this.clearLink();
    this.applyEdit(
      applyAuthoredContentCommand(
        textarea.value,
        textarea.selectionStart,
        textarea.selectionEnd,
        command
      )
    );
  }

  protected openLink(): void {
    const textarea = this.editableTextarea();
    if (!textarea) return;
    const revision = this.revision();
    this.linkSelection.set({
      source: textarea.value,
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      revision
    });
    this.linkUrl.set('');
    this.linkError.set(null);
    afterNextRender(
      () => {
        if (revision === this.revision() && this.linkSelection() && !this.disabled())
          this.linkInput()?.nativeElement.focus();
      },
      { injector: this.injector }
    );
  }

  protected urlInput(event: Event): void {
    if (this.disabled()) return;
    this.linkUrl.set((event.target as HTMLInputElement).value);
    this.linkError.set(null);
  }

  protected urlComposition(event: Event, composing: boolean): void {
    if (
      !this.disabled() &&
      this.linkSelection() &&
      event.target === this.linkInput()?.nativeElement
    ) {
      this.urlComposing.set(composing);
    }
  }

  protected insertLink(): void {
    const textarea = this.editableTextarea();
    const selection = this.linkSelection();
    if (!textarea || !selection) return;
    if (selection.revision !== this.revision() || selection.source !== textarea.value) {
      this.clearLink();
      return;
    }
    const edit = insertAuthoredContentLink(
      selection.source,
      selection.start,
      selection.end,
      this.linkUrl()
    );
    if (!edit) {
      this.linkError.set('Enter a valid HTTP or HTTPS URL.');
      this.linkInput()?.nativeElement.focus();
      return;
    }
    this.clearLink();
    this.applyEdit(edit);
  }

  protected cancelLink(): void {
    const selection = this.linkSelection();
    this.clearLink();
    const textarea = this.editableTextarea();
    if (
      textarea &&
      selection &&
      selection.revision === this.revision() &&
      selection.source === textarea.value
    ) {
      textarea.focus();
      textarea.setSelectionRange(selection.start, selection.end);
    }
  }

  protected linkKeydown(event: KeyboardEvent): void {
    if (this.urlComposing() || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Enter') this.insertLink();
      else this.cancelLink();
    }
  }

  protected escapeLink(event: KeyboardEvent): void {
    if (
      event.key !== 'Escape' ||
      !this.linkSelection() ||
      this.composing() ||
      this.urlComposing() ||
      event.isComposing ||
      event.keyCode === 229
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    this.cancelLink();
  }

  private editableTextarea(): HTMLTextAreaElement | null {
    return this.toolsDisabled() || this.mode() !== 'edit' || this.value().format !== 'markdown_v1'
      ? null
      : this.currentTextarea();
  }

  private currentTextarea(): HTMLTextAreaElement | null {
    const textarea = this.textarea()?.nativeElement;
    return textarea?.dataset['editorRevision'] === String(this.revision()) ? textarea : null;
  }

  private applyEdit(edit: AuthoredContentTextEdit): void {
    const textarea = this.textarea()!.nativeElement;
    const previous = textarea.value;
    let start = 0;
    while (
      start < previous.length &&
      start < edit.source.length &&
      previous[start] === edit.source[start]
    )
      start++;
    let oldEnd = previous.length;
    let newEnd = edit.source.length;
    while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === edit.source[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    textarea.setRangeText(edit.source.slice(start, newEnd), start, oldEnd, 'preserve');
    this.change({ ...this.value(), source: textarea.value });
    textarea.focus();
    textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  }

  private change(value: AuthoredContentValue): void {
    if (value.source === this.value().source && value.format === this.value().format) return;
    this.value.set(value);
    this.onChange({ ...value });
  }

  private clearLink(): void {
    this.urlComposing.set(false);
    this.linkSelection.set(null);
    this.linkUrl.set('');
    this.linkError.set(null);
  }

  private resetLocalState(): void {
    this.revision.update((value) => value + 1);
    this.mode.set('edit');
    this.composing.set(false);
    this.clearLink();
  }
}
