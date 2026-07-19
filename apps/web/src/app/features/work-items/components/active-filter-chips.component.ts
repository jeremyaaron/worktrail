import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-active-filter-chips',
  template: `
    @if (labels.length > 0) {
      <section class="active-filters" aria-label="Active filters">
        @for (label of labels; track $index) {
          <span>
            {{ label }}
            <button
              type="button"
              [attr.aria-label]="'Remove ' + label"
              (click)="remove.emit(label)"
            ></button>
          </span>
        }
      </section>
    }
  `,
  styles: `
    .active-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }

    .active-filters span {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      min-height: 24px;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 3px 8px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .active-filters button {
      width: 14px;
      height: 14px;
      border: 0;
      border-radius: 999px;
      padding: 0;
      background:
        linear-gradient(45deg, transparent 45%, #1d4ed8 45%, #1d4ed8 55%, transparent 55%),
        linear-gradient(-45deg, transparent 45%, #1d4ed8 45%, #1d4ed8 55%, transparent 55%);
      cursor: pointer;
    }

    .active-filters button:hover {
      background-color: #dbeafe;
    }
  `
})
export class ActiveFilterChipsComponent {
  @Input({ required: true }) labels: string[] = [];
  @Output() readonly remove = new EventEmitter<string>();
}
