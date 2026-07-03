import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <section class="empty-state">
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
    </section>
  `,
  styles: `
    .empty-state {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 24px;
      background: #f8fafc;
    }

    h2 {
      margin: 0 0 8px;
      color: #111827;
      font-size: 1rem;
      line-height: 1.3;
    }

    p {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }
  `
})
export class EmptyStateComponent {
  readonly title = input('No results');
  readonly message = input('There is no data to show yet.');
}
