import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideX } from '@lucide/angular';
import type { WorkItemQuery } from '@worktrail/contracts';
import type { WorkItemFilterChip } from '../query/work-item-filter-labels';

@Component({
  selector: 'app-active-filter-chips',
  imports: [LucideX],
  template: `
    @if (chips.length > 0) {
      <section class="active-filters" aria-label="Active filters">
        @for (chip of chips; track chip.key) {
          <span>
            {{ chip.label }}
            <button
              type="button"
              [attr.aria-label]="'Remove ' + chip.label"
              [title]="'Remove ' + chip.label"
              (click)="remove.emit(chip.key)"
            ><svg lucideX aria-hidden="true"></svg></button>
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
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border: 0;
      border-radius: 999px;
      padding: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .active-filters button:hover {
      background-color: #dbeafe;
    }
    .active-filters svg { width: 14px; height: 14px; }
  `
})
export class ActiveFilterChipsComponent {
  @Input({ required: true }) chips: WorkItemFilterChip[] = [];
  @Output() readonly remove = new EventEmitter<keyof WorkItemQuery>();
}
