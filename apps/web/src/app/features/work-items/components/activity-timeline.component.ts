import { Component, Input } from '@angular/core';
import type { ActivityEventDto } from '@worktrail/contracts';

import { memberDisplayName } from '../../../shared/display/member-display';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';

@Component({
  selector: 'app-activity-timeline',
  imports: [EmptyStateComponent],
  template: `
    <section class="panel" aria-labelledby="activity-heading">
      <h2 id="activity-heading">Activity</h2>

      @if (events.length === 0) {
        <app-empty-state title="No activity yet" message="Meaningful changes will appear here." />
      } @else {
        <ol class="activity-list">
          @for (event of events; track event.id) {
            <li>
              <strong>{{ event.summary }}</strong>
              <span>{{ memberDisplayName(event.actor) }} · {{ formatEventType(event) }} · {{ formatDateTime(event.createdAt) }}</span>
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: `
    .panel {
      display: grid;
      gap: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    h2,
    ol {
      margin: 0;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    .activity-list {
      display: grid;
      gap: 10px;
      list-style: none;
      padding: 0;
    }

    .activity-list li {
      display: grid;
      gap: 5px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    .activity-list strong {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .activity-list span {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
    }
  `
})
export class ActivityTimelineComponent {
  @Input({ required: true }) events: ActivityEventDto[] = [];

  memberDisplayName = memberDisplayName;

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  formatEventType(event: ActivityEventDto): string {
    return event.eventType.replaceAll('.', ' ').replaceAll('_', ' ');
  }
}
