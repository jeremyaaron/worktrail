import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  template: `
    <div class="loading-indicator" role="status" aria-live="polite">
      <span class="loading-indicator__spinner" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </div>
  `,
  styles: `
    .loading-indicator {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #4b5563;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .loading-indicator__spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #d1d5db;
      border-top-color: #2563eb;
      border-radius: 999px;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `
})
export class LoadingIndicatorComponent {
  readonly label = input('Loading');
}
