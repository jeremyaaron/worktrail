import 'zone.js';
import '@angular/compiler';
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuthoredContentEditorComponent } from '../../src/app/shared/authored-content/authored-content-editor.component';
import type { AuthoredContentValue } from '../../src/app/shared/authored-content/authored-content-value';

@Component({
  selector: 'app-editor-test',
  imports: [AuthoredContentEditorComponent, ReactiveFormsModule],
  template: `
    <main>
      <h1>Editor verification</h1>
      <form (submit)="$event.preventDefault(); submits = submits + 1">
        <app-authored-content-editor
          fieldId="description"
          label="Description"
          [formControl]="content"
          [resetIdentity]="identity"
        />
        <button type="submit">Save</button>
      </form>
      <nav aria-label="Test fixture controls">
        <button type="button" (click)="content.reset()">Reset</button>
        <button type="button" (click)="loadSample()">Load sample</button>
        <button type="button" (click)="identity = identity + 1">New identity</button>
        <button type="button" (click)="content.disable()">Disable</button>
        <button type="button" (click)="content.enable()">Enable</button>
      </nav>
      <pre data-testid="model">{{ content.value.source }}</pre>
      <output data-testid="format">{{ content.value.format }}</output>
      <output data-testid="dirty">{{ content.dirty }}</output>
      <output data-testid="touched">{{ content.touched }}</output>
      <output data-testid="submits">{{ submits }}</output>
    </main>
  `
})
export class EditorTestComponent {
  readonly content = new FormControl<AuthoredContentValue>(
    { source: '', format: 'markdown_v1' },
    { nonNullable: true }
  );
  identity = 1;
  submits = 0;

  loadSample(): void {
    this.content.setValue({
      source:
        '## Implementation notes\n\nReview the **API changes** before release.\n\n- Preserve existing data\n- Verify the migration\n\n[Design review](https://example.com/review)',
      format: 'markdown_v1'
    });
    this.content.markAsPristine();
    this.content.markAsUntouched();
  }
}

void bootstrapApplication(EditorTestComponent);
