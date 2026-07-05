import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-work-item-filter-panel',
  imports: [ReactiveFormsModule],
  template: `
    <form class="filters" [formGroup]="formGroup" (ngSubmit)="apply.emit()">
      <section class="filters__core" aria-label="Core filters">
        <ng-content select="[filterCore]" />
      </section>

      <details class="filters__advanced">
        <summary>Advanced filters</summary>
        <section class="filters__advanced-grid" aria-label="Advanced filters">
          <ng-content select="[filterAdvanced]" />
        </section>
      </details>

      <section class="filter-actions" aria-label="Filter actions">
        <ng-content select="[filterActions]" />
      </section>
    </form>
  `,
  styles: `
    .filters {
      display: grid;
      gap: 14px;
      margin-bottom: 18px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }

    .filters__core,
    .filters__advanced-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(150px, 1fr));
      gap: 12px;
    }

    .filters__advanced {
      display: grid;
      gap: 12px;
    }

    .filters__advanced summary {
      width: fit-content;
      color: #1e3a5f;
      font-size: 0.875rem;
      font-weight: 800;
      cursor: pointer;
    }

    .filters__advanced-grid {
      margin-top: 12px;
    }

    .filter-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    :host ::ng-deep label {
      display: grid;
      gap: 6px;
    }

    :host ::ng-deep label span {
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    :host ::ng-deep input,
    :host ::ng-deep select {
      width: 100%;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 10px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 0.875rem;
    }

    :host ::ng-deep input:focus,
    :host ::ng-deep select:focus {
      border-color: #1d4ed8;
      outline: 2px solid #bfdbfe;
      outline-offset: 0;
    }

    @media (max-width: 900px) {
      .filters__core,
      .filters__advanced-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      .filters__core,
      .filters__advanced-grid {
        grid-template-columns: 1fr;
      }

      .filter-actions {
        align-items: stretch;
      }
    }
  `
})
export class WorkItemFilterPanelComponent {
  @Input({ required: true }) formGroup!: FormGroup;
  @Output() readonly apply = new EventEmitter<void>();
}
