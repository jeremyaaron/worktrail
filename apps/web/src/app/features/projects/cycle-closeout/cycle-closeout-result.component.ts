import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  ProjectCycleCloseoutDto,
  ProjectCycleCloseoutItemSnapshotDto
} from '@worktrail/contracts';

const visibleItemLimit = 8;

interface SnapshotGroup {
  key: 'completed' | 'canceled' | 'unfinished';
  title: string;
  description: string;
  items: ProjectCycleCloseoutItemSnapshotDto[];
}

@Component({
  selector: 'app-cycle-closeout-result',
  imports: [RouterLink],
  template: `
    <section class="result" aria-labelledby="cycle-result-heading">
      <header class="result-header">
        <div>
          <p class="eyebrow">Cycle result · Snapshot</p>
          <h2 id="cycle-result-heading">Outcome at close</h2>
          <p>
            Closed {{ formatDateTime(closeout.closedAt) }} by {{ closeout.closedBy.name }}. These
            values preserve the cycle scope at that time.
          </p>
        </div>
        <span>Snapshot v{{ closeout.snapshot.snapshotVersion }}</span>
      </header>

      <div class="result-metrics" aria-label="Cycle closeout metrics">
        <div><span>Target points</span><strong>{{ targetLabel() }}</strong></div>
        <div><span>Committed points</span><strong>{{ closeout.snapshot.counts.committedEstimatePoints }}</strong></div>
        <div><span>Completed points</span><strong>{{ closeout.snapshot.counts.completedEstimatePoints }}</strong></div>
        <div><span>Completed items</span><strong>{{ closeout.snapshot.counts.completedCount }}</strong></div>
        <div><span>Canceled items</span><strong>{{ closeout.snapshot.counts.canceledCount }}</strong></div>
        <div><span>Retained</span><strong>{{ closeout.snapshot.counts.retainedCount }}</strong></div>
        <div><span>Moved</span><strong>{{ closeout.snapshot.counts.movedCount }}</strong></div>
      </div>

      <section class="destination" aria-labelledby="closeout-destination-heading">
        <div>
          <p class="eyebrow">Carryover result</p>
          <h3 id="closeout-destination-heading">{{ destinationLabel() }}</h3>
        </div>
        @if (closeout.snapshot.destination.kind === 'cycle') {
          <a
            [routerLink]="[
              '/projects',
              closeout.projectId,
              'cycles',
              closeout.snapshot.destination.cycle.id
            ]"
          >
            Review destination cycle
          </a>
        }
      </section>

      <div class="snapshot-groups">
        @for (group of groups(); track group.key) {
          <section class="snapshot-group" [attr.aria-labelledby]="'snapshot-' + group.key">
            <header>
              <div>
                <h3 [id]="'snapshot-' + group.key">{{ group.title }}</h3>
                <p>{{ group.description }}</p>
              </div>
              <span>{{ group.items.length }}</span>
            </header>

            @if (group.items.length === 0) {
              <p class="empty-group">No items in this snapshot group.</p>
            } @else {
              <div class="snapshot-list" role="list">
                @for (item of visibleItems(group); track item.id) {
                  <article role="listitem">
                    <div>
                      <a
                        [routerLink]="['/work-items', item.id]"
                        [attr.aria-label]="'Open current ' + item.displayKey"
                      >
                        {{ item.displayKey }}
                      </a>
                      <strong>{{ item.title }}</strong>
                    </div>
                    <p>
                      At close: {{ statusLabel(item) }} · {{ item.priority }} ·
                      {{ item.assignee?.name ?? 'Unassigned' }} · {{ estimateLabel(item) }}
                      @if (item.dependencyBlocked) {
                        <span> · Dependency blocked</span>
                      }
                    </p>
                  </article>
                }
              </div>
              @if (hiddenCount(group) > 0) {
                <p class="hidden-count">
                  {{ hiddenCount(group) }} additional snapshot
                  {{ hiddenCount(group) === 1 ? 'item' : 'items' }} not shown.
                </p>
              }
            }
          </section>
        }
      </div>
    </section>
  `,
  styles: `
    .result { display: grid; gap: 20px; border-block: 2px solid #2563eb; padding: 22px 0; }
    .result-header, .destination, .snapshot-group > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
    .result-header h2, .destination h3, .snapshot-group h3, p { margin: 0; }
    .result-header h2 { margin-top: 3px; font-size: 1.3rem; letter-spacing: 0; }
    .result-header p, .snapshot-group header p, .empty-group, .hidden-count { margin-top: 5px; color: #52637a; font-size: .83rem; line-height: 1.5; }
    .result-header > span { color: #1d4ed8; font-size: .74rem; font-weight: 800; white-space: nowrap; }
    .eyebrow { color: #64748b; font-size: .71rem; font-weight: 900; letter-spacing: 0; text-transform: uppercase; }
    .result-metrics { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-block: 1px solid #dbe3ed; }
    .result-metrics div { display: grid; gap: 5px; min-width: 0; padding: 13px 10px; border-right: 1px solid #e5eaf0; }
    .result-metrics div:last-child { border-right: 0; }
    .result-metrics span { color: #64748b; font-size: .72rem; line-height: 1.25; }
    .result-metrics strong { color: #111827; font-size: 1.12rem; overflow-wrap: anywhere; }
    .destination { align-items: center; padding: 14px 16px; border-left: 4px solid #2563eb; background: #eff6ff; }
    .destination h3 { margin-top: 3px; font-size: .95rem; letter-spacing: 0; }
    .destination a { color: #1d4ed8; font-size: .8rem; font-weight: 800; text-decoration: none; }
    .snapshot-groups { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
    .snapshot-group { min-width: 0; }
    .snapshot-group > header { align-items: baseline; padding-bottom: 9px; border-bottom: 1px solid #dbe3ed; }
    .snapshot-group h3 { font-size: .92rem; letter-spacing: 0; }
    .snapshot-group > header > span { color: #64748b; font-size: .78rem; font-weight: 800; }
    .snapshot-list article { display: grid; gap: 5px; padding: 10px 2px; border-bottom: 1px solid #edf0f4; }
    .snapshot-list article > div { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
    .snapshot-list a { color: #1d4ed8; font-size: .76rem; font-weight: 900; text-decoration: none; }
    .snapshot-list strong { min-width: 0; overflow-wrap: anywhere; color: #111827; font-size: .82rem; }
    .snapshot-list p { color: #52637a; font-size: .75rem; line-height: 1.45; }
    .snapshot-list p span { color: #b42318; font-weight: 700; }
    .hidden-count { font-weight: 700; }
    @media (max-width: 1000px) {
      .result-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .result-metrics div:nth-child(4) { border-right: 0; }
      .result-metrics div:nth-child(-n + 4) { border-bottom: 1px solid #e5eaf0; }
      .snapshot-groups { grid-template-columns: 1fr; }
    }
    @media (max-width: 620px) {
      .result-header, .destination { display: grid; }
      .result-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .result-metrics div:nth-child(even) { border-right: 0; }
      .result-metrics div:nth-child(-n + 6) { border-bottom: 1px solid #e5eaf0; }
    }
  `
})
export class CycleCloseoutResultComponent {
  @Input({ required: true }) closeout!: ProjectCycleCloseoutDto;

  groups(): SnapshotGroup[] {
    return [
      {
        key: 'completed',
        title: 'Completed at close',
        description: 'Work recorded as done in the closeout snapshot.',
        items: this.closeout.snapshot.items.completed
      },
      {
        key: 'canceled',
        title: 'Canceled at close',
        description: 'Work recorded as canceled in the closeout snapshot.',
        items: this.closeout.snapshot.items.canceled
      },
      {
        key: 'unfinished',
        title: 'Unfinished at close',
        description: 'Work carried out of the source cycle at close.',
        items: this.closeout.snapshot.items.unfinished
      }
    ];
  }

  visibleItems(group: SnapshotGroup): ProjectCycleCloseoutItemSnapshotDto[] {
    return group.items.slice(0, visibleItemLimit);
  }

  hiddenCount(group: SnapshotGroup): number {
    return Math.max(group.items.length - visibleItemLimit, 0);
  }

  targetLabel(): string {
    return this.closeout.snapshot.cycle.targetPoints?.toString() ?? 'No target';
  }

  destinationLabel(): string {
    const destination = this.closeout.snapshot.destination;

    if (destination.kind === 'cycle') {
      return `${destination.cycle.name} received ${this.closeout.snapshot.counts.movedCount} moved ${this.closeout.snapshot.counts.movedCount === 1 ? 'item' : 'items'}`;
    }

    if (destination.kind === 'unplanned') {
      return 'Unfinished work returned to unplanned work';
    }

    return 'No unfinished work required carryover';
  }

  statusLabel(item: ProjectCycleCloseoutItemSnapshotDto): string {
    return item.status.replace('_', ' ');
  }

  estimateLabel(item: ProjectCycleCloseoutItemSnapshotDto): string {
    return item.estimatePoints === null ? 'unestimated' : `${item.estimatePoints} points`;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }
}
