import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { MyWorkSummaryCountDto } from '@worktrail/contracts';

@Component({
  selector: 'app-my-work-summary',
  template: `
    <section class="summary-grid" aria-label="My Work summary">
      @for (count of counts; track count.key) {
        <button
          type="button"
          class="summary-card"
          [attr.aria-pressed]="activeKey === count.key"
          (click)="select.emit(count.key)"
        >
          <span>{{ count.label }}</span>
          <strong>{{ count.count }}</strong>
        </button>
      }
    </section>
  `,
  styles: `
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .summary-card {
      display: grid;
      gap: 8px;
      min-height: 92px;
      border: 1px solid #dbe3ea;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
      color: #334155;
      font: inherit;
      text-align: left;
    }

    .summary-card:hover,
    .summary-card[aria-pressed='true'] {
      border-color: #93c5fd;
      background: #f8fafc;
      cursor: pointer;
    }

    .summary-card[aria-pressed='true'] {
      box-shadow: inset 0 0 0 1px #93c5fd;
    }

    .summary-card span {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 900;
      line-height: 1.3;
      text-transform: uppercase;
    }

    .summary-card strong {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1;
    }

    @media (max-width: 1120px) {
      .summary-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 520px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class MyWorkSummaryComponent {
  @Input({ required: true }) counts: MyWorkSummaryCountDto[] = [];
  @Input() activeKey: MyWorkSummaryCountDto['key'] | null = null;
  @Output() readonly select = new EventEmitter<MyWorkSummaryCountDto['key']>();
}
