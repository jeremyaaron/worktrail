import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import MarkdownIt from 'markdown-it';
import { AuthoredContentEditorComponent } from './authored-content-editor.component';
import { AuthoredContentViewerComponent } from './authored-content-viewer.component';
import { authoredContentValidator } from './authored-content-validation';
import type { AuthoredContentValue } from './authored-content-value';

@Component({
  imports: [AuthoredContentEditorComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submits = submits + 1">
      <app-authored-content-editor
        fieldId="description"
        label="Description"
        formControlName="content"
        [resetIdentity]="identity"
        [errorDescriptionIds]="errorIds"
        [invalid]="invalid"
        [rows]="rows"
      />
      <p id="description-error">Server error</p>
      <button type="submit">Save</button>
    </form>
    <button type="button" id="outside">Outside</button>
  `
})
class EditorHostComponent {
  readonly control = new FormControl<AuthoredContentValue>(
    { source: '', format: 'markdown_v1' },
    { nonNullable: true }
  );
  readonly form = new FormGroup({ content: this.control });
  identity = 1;
  errorIds = '';
  invalid = false;
  rows = 8;
  submits = 0;
}

describe('AuthoredContentEditorComponent', () => {
  let fixture: ComponentFixture<EditorHostComponent>;
  let host: EditorHostComponent;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EditorHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(EditorHostComponent);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await settle();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const textarea = () => root.querySelector('textarea')!;
  const format = () => root.querySelector('select')!;
  const button = (name: string): HTMLButtonElement => {
    const found = Array.from(root.querySelectorAll('button')).find(
      (element) =>
        element.getAttribute('aria-label') === name || element.textContent?.trim() === name
    );
    if (!found) throw new Error(`Missing button ${name}`);
    return found;
  };
  async function click(name: string): Promise<void> {
    button(name).click();
    await settle();
  }
  async function type(source: string): Promise<void> {
    textarea().value = source;
    textarea().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    await settle();
  }
  async function setSource(
    source: string,
    valueFormat: AuthoredContentValue['format'] = 'markdown_v1'
  ): Promise<void> {
    host.control.setValue({ source, format: valueFormat });
    await settle();
  }
  async function url(source: string): Promise<HTMLInputElement> {
    const input = root.querySelector<HTMLInputElement>('input[inputmode="url"]')!;
    input.value = source;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    return input;
  }

  it('initializes a compound reactive control and exposes labels/count without a native maxlength', () => {
    expect(host.control.value).toEqual({ source: '', format: 'markdown_v1' });
    expect(format().value).toBe('markdown_v1');
    expect(root.querySelector('label[for="description"]')?.textContent).toBe('Description');
    expect(textarea().rows).toBe(8);
    expect(textarea().hasAttribute('maxlength')).toBeFalse();
    expect(textarea().getAttribute('aria-describedby')).toBe('description-count');
    expect(root.querySelector('output')?.textContent?.trim()).toBe('0 / 10,000');
    expect(host.control.pristine).toBeTrue();
    expect(host.control.untouched).toBeTrue();
  });

  it('writes exact loaded pairs without inferring format or echoing a change', async () => {
    const changes = jasmine.createSpy('changes');
    host.control.valueChanges.subscribe(changes);
    await setSource('  **legacy**\r\n ', 'plain_text');
    expect(host.control.value.source).toBe('  **legacy**\r\n ');
    expect(textarea().value).toBe('  **legacy**\n ');
    expect(format().value).toBe('plain_text');
    expect(root.querySelector('.formatting')).toBeNull();
    expect(changes.calls.count()).toBe(1);
    expect(host.control.pristine).toBeTrue();
  });

  it('emits both fields on native source input and measures normalized UTF-16 units', async () => {
    const changes = jasmine.createSpy('changes');
    host.control.valueChanges.subscribe(changes);
    await type('  \ud83d\ude00\n ');
    expect(changes).toHaveBeenCalledOnceWith({
      source: '  \ud83d\ude00\n ',
      format: 'markdown_v1'
    });
    expect(host.control.dirty).toBeTrue();
    expect(root.querySelector('output')?.textContent?.trim()).toBe('6 / 10,000');
  });

  it('does not overwrite native input value while Angular updates the model', async () => {
    const valueSetter = spyOnProperty(
      HTMLTextAreaElement.prototype,
      'value',
      'set'
    ).and.callThrough();
    textarea().value = 'native source';
    valueSetter.calls.reset();
    textarea().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(valueSetter).not.toHaveBeenCalled();
    expect(host.control.value.source).toBe('native source');
  });

  it('switches only format, preserving exact source and emitting one pair', async () => {
    await setSource('  **legacy**\r\n', 'plain_text');
    const changes = jasmine.createSpy('changes');
    host.control.valueChanges.subscribe(changes);
    format().value = 'markdown_v1';
    format().dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(changes).toHaveBeenCalledOnceWith({ source: '  **legacy**\r\n', format: 'markdown_v1' });
    expect(host.control.dirty).toBeTrue();
    expect(root.querySelector('.formatting')).not.toBeNull();
  });

  it('mounts faithful preview only when requested, without parsing edit keystrokes or changing form state', async () => {
    const parse = spyOn(MarkdownIt.prototype, 'parse').and.callThrough();
    await type('**draft**');
    expect(parse).not.toHaveBeenCalled();
    host.control.markAsPristine();
    const changes = jasmine.createSpy('changes');
    host.control.valueChanges.subscribe(changes);
    const original = textarea();
    original.setSelectionRange(2, 7);
    await click('Preview');
    expect(root.querySelector('.preview strong')?.textContent).toBe('draft');
    expect(button('Preview').getAttribute('aria-pressed')).toBe('true');
    expect(parse.calls.count()).toBe(1);
    const reference = TestBed.createComponent(AuthoredContentViewerComponent);
    reference.componentRef.setInput('source', host.control.value.source);
    reference.componentRef.setInput('format', host.control.value.format);
    reference.detectChanges();
    expect(root.querySelector('.preview app-authored-content-viewer')?.textContent).toBe(
      reference.nativeElement.textContent
    );
    reference.destroy();
    await click('Edit');
    expect(textarea()).toBe(original);
    expect(textarea().selectionStart).toBe(2);
    expect(textarea().selectionEnd).toBe(7);
    expect(root.querySelector('app-authored-content-viewer')).toBeNull();
    expect(changes).not.toHaveBeenCalled();
    expect(host.control.pristine).toBeTrue();
    expect(host.control.untouched).toBeTrue();
  });

  it('keeps plain-text preview literal and makes no remote request for embedded HTML/images', async () => {
    const fetch = spyOn(window, 'fetch').and.callThrough();
    await setSource('**literal** <img src="https://remote.example/image">', 'plain_text');
    await click('Preview');
    expect(root.querySelector('.preview')?.textContent).toContain(
      '**literal** <img src="https://remote.example/image">'
    );
    expect(root.querySelector('.preview img, .preview strong')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('marks touched only when focus leaves the entire compound control', async () => {
    textarea().focus();
    button('Bold').focus();
    await settle();
    expect(host.control.untouched).toBeTrue();
    root.querySelector<HTMLButtonElement>('#outside')!.focus();
    await settle();
    expect(host.control.touched).toBeTrue();
  });

  it('applies a selection command, restores focus, updates the form, and never submits it', async () => {
    await setSource('before text after');
    textarea().focus();
    textarea().setSelectionRange(7, 11);
    button('Bold').focus();
    await click('Bold');
    expect(host.control.value).toEqual({ source: 'before **text** after', format: 'markdown_v1' });
    expect(document.activeElement).toBe(textarea());
    expect([textarea().selectionStart, textarea().selectionEnd]).toEqual([9, 13]);
    expect(host.control.dirty).toBeTrue();
    expect(host.control.untouched).toBeTrue();
    expect(host.submits).toBe(0);
    for (const element of Array.from(root.querySelectorAll('app-authored-content-editor button'))) {
      expect(element.getAttribute('type')).toBe('button');
    }
    for (const element of Array.from(root.querySelectorAll('.formatting button'))) {
      expect(element.getAttribute('title')).toBeTruthy();
      expect(element.getAttribute('aria-label')).toBeTruthy();
      expect(element.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  for (const name of [
    'Italic',
    'Heading',
    'Bullet list',
    'Numbered list',
    'Quote',
    'Inline code',
    'Code block'
  ]) {
    it(`connects the ${name} toolbar command to the form`, async () => {
      await setSource('text');
      textarea().setSelectionRange(0, 4);
      await click(name);
      expect(host.control.value.source).not.toBe('text');
      expect(host.control.dirty).toBeTrue();
      expect(host.submits).toBe(0);
    });
  }

  it('captures textarea selection before focusing the URL and inserts an escaped descriptive link', async () => {
    await setSource('before label after');
    textarea().focus();
    textarea().setSelectionRange(7, 12);
    await click('Link');
    expect(document.activeElement).toBe(root.querySelector('input[inputmode="url"]'));
    const input = await url('https://example.com/a_(b)');
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    await settle();
    expect(host.control.value.source).toBe('before [label](<https://example.com/a_(b)>) after');
    expect([textarea().selectionStart, textarea().selectionEnd]).toEqual([8, 13]);
    expect(document.activeElement).toBe(textarea());
    expect(root.querySelector('.link-entry')).toBeNull();
    expect(host.submits).toBe(0);
  });

  it('rejects unsafe URLs with associated error feedback without changing the draft', async () => {
    await setSource('label');
    textarea().setSelectionRange(0, 5);
    await click('Link');
    const input = await url('javascript:alert(1)');
    const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(key);
    await settle();
    expect(key.defaultPrevented).toBeTrue();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('description-link-error');
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('valid HTTP or HTTPS URL');
    expect(host.control.value.source).toBe('label');
    expect(host.control.pristine).toBeTrue();
    expect(host.submits).toBe(0);
    await url('https://example.com');
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  for (const cancel of ['Escape', 'Cancel link']) {
    it(`cancels URL insertion via ${cancel}, restoring the original selection`, async () => {
      await setSource('before label after');
      textarea().setSelectionRange(7, 12);
      await click('Link');
      const input = await url('https://example.com');
      if (cancel === 'Escape')
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        );
      else button('Cancel link').click();
      await settle();
      expect(root.querySelector('.link-entry')).toBeNull();
      expect(document.activeElement).toBe(textarea());
      expect([textarea().selectionStart, textarea().selectionEnd]).toEqual([7, 12]);
      expect(host.control.value.source).toBe('before label after');
      expect(host.control.pristine).toBeTrue();
    });
  }

  it('clears captured link selection on source changes so old actions cannot overwrite newer typing', async () => {
    await setSource('label');
    await click('Link');
    await url('https://example.com');
    const insert = button('Insert link');
    await type('newer draft');
    insert.click();
    await settle();
    expect(root.querySelector('.link-entry')).toBeNull();
    expect(host.control.value.source).toBe('newer draft');
  });

  it('clears preview, URL data, and selection/history identity on same-value parent writes and context resets', async () => {
    await setSource('same source');
    const original = textarea();
    await click('Preview');
    await setSource('same source');
    expect(root.querySelector('.preview')).toBeNull();
    expect(textarea()).not.toBe(original);
    await click('Link');
    await url('https://example.com');
    const current = textarea();
    host.identity++;
    await settle();
    expect(root.querySelector('.link-entry')).toBeNull();
    expect(textarea()).not.toBe(current);
    expect(textarea().value).toBe('same source');
    expect(host.control.pristine).toBeTrue();
    await click('Link');
    expect(root.querySelector<HTMLInputElement>('input[inputmode="url"]')?.value).toBe('');
    host.control.reset();
    await settle();
    expect(host.control.value).toEqual({ source: '', format: 'markdown_v1' });
    expect(textarea().value).toBe('');
    expect(root.querySelector('.link-entry')).toBeNull();
  });

  it('suppresses formatting and intermediate input during IME composition, committing only once', async () => {
    const changes = jasmine.createSpy('changes');
    host.control.valueChanges.subscribe(changes);
    textarea().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    textarea().value = '\u65e5';
    textarea().dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    await settle();
    expect(button('Bold').disabled).toBeTrue();
    expect(button('Preview').disabled).toBeTrue();
    expect(format().disabled).toBeTrue();
    await click('Bold');
    expect(changes).not.toHaveBeenCalled();
    textarea().value = '\u65e5\u672c';
    textarea().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    textarea().dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();
    expect(changes).toHaveBeenCalledOnceWith({ source: '\u65e5\u672c', format: 'markdown_v1' });
    expect(button('Bold').disabled).toBeFalse();
  });

  it('ignores stale composition/input events after a context reset', async () => {
    const previous = textarea();
    previous.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    await setSource('new context');
    previous.value = 'old context';
    previous.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    previous.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();
    expect(host.control.value.source).toBe('new context');
    expect(button('Bold').disabled).toBeFalse();
  });

  it('ignores old DOM events even before a parent write has rendered the next textarea', async () => {
    const previous = textarea();
    host.control.setValue({ source: 'new context', format: 'markdown_v1' });
    previous.value = 'stale input';
    previous.dispatchEvent(new Event('input', { bubbles: true }));
    previous.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await settle();
    expect(host.control.value.source).toBe('new context');
    expect(textarea().value).toBe('new context');
  });

  it('keeps a focused parent reset pristine and untouched', async () => {
    await type('draft');
    textarea().focus();
    host.control.reset();
    await settle();
    expect(host.control.pristine).toBeTrue();
    expect(host.control.untouched).toBeTrue();
    expect(textarea().value).toBe('');
  });

  it('supports deliberate conversion while Preview is open without changing source', async () => {
    await setSource('**legacy**', 'plain_text');
    await click('Preview');
    format().value = 'markdown_v1';
    format().dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(root.querySelector('.preview strong')?.textContent).toBe('legacy');
    expect(host.control.value).toEqual({ source: '**legacy**', format: 'markdown_v1' });
    expect(host.control.dirty).toBeTrue();
  });

  it('protects URL IME composition without disabling the composing input', async () => {
    await click('Link');
    const input = await url('https://example.com/');
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    await settle();
    expect(input.disabled).toBeFalse();
    expect(button('Insert link').disabled).toBeTrue();
    expect(button('Cancel link').disabled).toBeTrue();
    expect(button('Preview').disabled).toBeTrue();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    await settle();
    expect(host.control.value.source).toBe('');
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await settle();
    expect(button('Insert link').disabled).toBeFalse();
    await click('Insert link');
    expect(host.control.value.source).toContain('](<https://example.com/>)');
  });

  it('does not leak temporary URL constraint validation into the parent form', async () => {
    await click('Link');
    const input = await url('unfinished URL');
    expect(input.checkValidity()).toBeTrue();
    button('Save').click();
    await settle();
    expect(host.submits).toBe(1);
    expect(host.control.value.source).toBe('');
  });

  it('ignores composing Enter/Escape in the URL input', async () => {
    await click('Link');
    const input = await url('https://example.com');
    for (const key of ['Enter', 'Escape'])
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key, isComposing: true, bubbles: true, cancelable: true })
      );
    await settle();
    expect(root.querySelector('.link-entry')).not.toBeNull();
    expect(host.control.value.source).toBe('');
  });

  it('disables all authoring controls, closes pending links, and emits no value on disable/enable', async () => {
    await setSource('draft');
    await click('Link');
    const changes = jasmine.createSpy('changes');
    host.control.valueChanges.subscribe(changes);
    host.control.disable({ emitEvent: false });
    await settle();
    expect(root.querySelector('.link-entry')).toBeNull();
    expect(textarea().disabled).toBeTrue();
    expect(format().disabled).toBeTrue();
    for (const element of Array.from(
      root.querySelectorAll<HTMLButtonElement>('app-authored-content-editor button')
    ))
      expect(element.disabled).toBeTrue();
    await click('Bold');
    await type('blocked');
    expect(host.control.value.source).toBe('draft');
    host.control.enable({ emitEvent: false });
    await settle();
    expect(changes).not.toHaveBeenCalled();
    expect(textarea().disabled).toBeFalse();
  });

  it('associates external errors and enforces parent validation while leaving oversized legacy source editable', async () => {
    const baseline: AuthoredContentValue = { source: 'x'.repeat(10001), format: 'plain_text' };
    host.control.setValidators(authoredContentValidator({ baseline }));
    await setSource(baseline.source, baseline.format);
    expect(host.control.valid).toBeTrue();
    expect(textarea().value.length).toBe(10001);
    expect(textarea().hasAttribute('maxlength')).toBeFalse();
    format().value = 'markdown_v1';
    format().dispatchEvent(new Event('change', { bubbles: true }));
    host.invalid = true;
    host.errorIds = 'description-error other-error';
    await settle();
    expect(host.control.hasError('authoredContentTooLong')).toBeTrue();
    expect(textarea().getAttribute('aria-invalid')).toBe('true');
    expect(textarea().getAttribute('aria-describedby')).toBe(
      'description-error other-error description-count'
    );
    await type('shortened');
    expect(host.control.valid).toBeTrue();
  });

  for (const width of [320, 390, 760]) {
    it(`keeps toolbar/link entry and preview contained at ${width}px`, async () => {
      const editor = root.querySelector<HTMLElement>('app-authored-content-editor')!;
      editor.style.width = `${width}px`;
      await click('Link');
      await url('https://example.com/' + 'long'.repeat(100));
      expect(editor.scrollWidth).toBeLessThanOrEqual(editor.clientWidth);
      for (const element of Array.from(
        editor.querySelectorAll<HTMLElement>('.formatting button')
      )) {
        expect(element.offsetWidth).toBe(34);
        expect(element.offsetHeight).toBe(34);
      }
      await click('Cancel link');
      await type('longword'.repeat(100));
      await click('Preview');
      expect(editor.scrollWidth).toBeLessThanOrEqual(editor.clientWidth);
    });
  }
});
