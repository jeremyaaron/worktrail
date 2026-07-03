import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-panel',
  template: `
    <section class="error-panel" role="alert">
      <div>
        <h2>{{ title() }}</h2>
        <p>{{ message() }}</p>
      </div>

      <button type="button" (click)="retry.emit()">Retry</button>
    </section>
  `,
  styles: `
    .error-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 16px;
      background: #fff1f2;
      color: #7f1d1d;
    }

    h2 {
      margin: 0 0 4px;
      font-size: 1rem;
      line-height: 1.3;
    }

    p {
      margin: 0;
      color: #991b1b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    button {
      min-height: 36px;
      border: 1px solid #fca5a5;
      border-radius: 6px;
      padding: 0 14px;
      background: #ffffff;
      color: #7f1d1d;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
    }
  `
})
export class ErrorPanelComponent {
  readonly title = input('Request failed');
  readonly message = input('The latest data could not be loaded.');
  readonly retry = output<void>();
}
