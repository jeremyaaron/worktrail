import { Component, inject } from '@angular/core';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { ActivityTimelineComponent } from './activity-timeline.component';

import { WorkItemWatchHistoryStore } from '../work-item-watch-history.store';
@Component({
  selector: 'app-work-item-history',
  imports: [ErrorPanelComponent, ActivityTimelineComponent],
  template: `@if (state.record.workItem(); as item) {
      <section id="history" tabindex="-1" class="history-section" aria-label="History"><details><summary>History</summary>

        @if (state.attachmentActivityError()) {
          <app-error-panel
            title="Activity not refreshed"
            [message]="state.attachmentActivityError() ?? ''"
            (retry)="state.refreshAttachmentActivity()"
          />
        }
        <app-activity-timeline [events]="item.activity" />
      </details></section>

}`,
  styles: `
    .history-section {
      display: grid;
      gap: 18px;
    }

    h1,
h2,
h3,
p,
dl,
dd,
ol {
      margin: 0;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    h3 {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    button {
      min-height: 38px;
      border: 1px solid #1f4f99;
      border-radius: 6px;
      padding: 9px 14px;
      background: #1f4f99;
      color: #ffffff;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    app-work-item-parent-manager {
      display: block;
      margin-bottom: 18px;
    }

    label {
      display: grid;
      gap: 6px;
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    input,
select,
textarea {
      width: 100%;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 0.875rem;
    }

    input:focus,
select:focus,
textarea:focus {
      border-color: #1d4ed8;
      outline: 2px solid #bfdbfe;
    }

    dt {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
    }

    dd {
      color: #111827;
      font-size: 0.875rem;
      font-weight: 700;
    }

.history-section { border-top: 1px solid #e5e7eb; padding: 20px 0; }
summary { cursor: pointer; font-weight: 700; margin-bottom: 12px; }`
})
export class WorkItemHistoryComponent {
  readonly state = inject(WorkItemWatchHistoryStore);
}
