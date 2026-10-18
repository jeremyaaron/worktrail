import { ChangeDetectorRef, Component, DestroyRef, HostListener, Input, OnChanges, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronLeft, LucideChevronRight, LucideCopy, LucideDownload, LucidePrinter } from '@lucide/angular';
import type {
  ProjectCycleCloseoutDto,
  ProjectCycleCloseoutItemSnapshotDto
} from '@worktrail/contracts';
import { snapshotCountLabel } from '@worktrail/contracts';
import { ClipboardService } from '../../../shared/clipboard.service';
import { cycleDateRangeLabel } from '../../../shared/cycles/cycle-display';
import { deliveryHealthLabel } from '../../../shared/delivery-health/delivery-health-display';
import { downloadBlob } from '../../../shared/download-file';
import { recordOriginParams } from '../../../shared/navigation/work-navigation';
import { closeoutMarkdown } from './closeout-markdown';

const visibleItemLimit = 10;

interface SnapshotGroup {
  key: 'completed' | 'canceled' | 'unfinished';
  title: string;
  description: string;
  items: ProjectCycleCloseoutItemSnapshotDto[];
}

@Component({
  selector: 'app-cycle-closeout-result',
  imports: [RouterLink, LucideChevronLeft, LucideChevronRight, LucideCopy, LucideDownload, LucidePrinter],
  template: `
    <section class="result" aria-labelledby="cycle-result-heading">
      <header class="result-header">
        <div>
          <p class="eyebrow">Cycle result · Snapshot</p>
          <h2 id="cycle-result-heading">Outcome at close</h2>
          <p>
            Closed {{ formatDateTime(closeout.snapshot.closedAt) }} by {{ closeout.snapshot.closedBy.name }}. These
            values preserve the cycle scope at that time.
          </p>
        </div>
        <span>Snapshot v{{ closeout.snapshot.snapshotVersion }}</span>
      </header>

      <div class="result-actions" aria-label="Share frozen outcome">
        <button type="button" title="Copy outcome as Markdown" [disabled]="isCopying()" (click)="copyMarkdown()"><svg lucideCopy aria-hidden="true"></svg>Copy Markdown</button>
        <button type="button" title="Download outcome as Markdown" (click)="downloadMarkdown()"><svg lucideDownload aria-hidden="true"></svg>Download Markdown</button>
        <button type="button" title="Print frozen outcome" (click)="print()"><svg lucidePrinter aria-hidden="true"></svg>Print</button>
        <span role="status">{{ shareMessage() }}</span>
      </div>
      <div class="result-metrics" aria-label="Cycle closeout metrics">
        <div><span>Target points</span><strong>{{ targetLabel() }}</strong></div>
        <div><span>Committed points</span><strong>{{ closeout.snapshot.counts.committedEstimatePoints }}</strong></div>
        <div><span>Completed points</span><strong>{{ closeout.snapshot.counts.completedEstimatePoints }}</strong></div>
        <div><span>Done at close</span><strong>{{ closeout.snapshot.counts.completedCount }}</strong></div>
        <div><span>Canceled items</span><strong>{{ closeout.snapshot.counts.canceledCount }}</strong></div>
        <div><span>Total at close</span><strong>{{ closeout.snapshot.counts.totalCount }}</strong></div>
        <div><span>Unfinished at close</span><strong>{{ closeout.snapshot.counts.unfinishedCount }}</strong></div>
        <div><span>Unfinished points</span><strong>{{ closeout.snapshot.counts.unfinishedEstimatePoints }}</strong></div>
        <div><span>Unestimated unfinished</span><strong>{{ closeout.snapshot.counts.unestimatedUnfinishedCount }}</strong></div>
        <div><span>Retained</span><strong>{{ closeout.snapshot.counts.retainedCount }}</strong></div>
        <div><span>Moved</span><strong>{{ closeout.snapshot.counts.movedCount }}</strong></div>
      </div>

      <section class="frozen-health" aria-label="Health at close">
        <strong>Health at close: {{ healthLabel(closeout.snapshot.health.health) }}</strong>
        @if (closeout.snapshot.health.reasons.length > 0) {
          <ul>
            @for (reason of closeout.snapshot.health.reasons; track $index) {
              <li>{{ reason.message }} ({{ countLabel(reason) }})</li>
            }
          </ul>
        }
      </section>

      <section class="destination" aria-labelledby="closeout-destination-heading">
        <div>
          <p class="eyebrow">Carryover result</p>
          <h3 id="closeout-destination-heading">{{ destinationLabel() }}</h3>
          @if (closeout.snapshot.destination.kind === 'cycle') {
            <p>{{ dateRangeLabel(closeout.snapshot.destination.cycle) }}</p>
          }
        </div>
        @if (closeout.snapshot.destination.kind === 'cycle') {
          <a
            [routerLink]="[
              '/projects',
              closeout.projectId,
              'cycles',
              closeout.snapshot.destination.cycle.id
            ]"
            [queryParams]="detailQueryParams()"
          >
            Current destination cycle
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
                        [routerLink]="['/work-items', item.id]" [queryParams]="detailQueryParams()"
                        [attr.aria-label]="'Open current ' + item.displayKey"
                      >
                        {{ item.displayKey }}<span class="current-link-label"> · Current</span>
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
              @if (group.items.length > pageSize) {
                <nav class="group-pagination" [attr.aria-label]="group.title + ' pages'">
                  <span aria-live="polite">{{ rangeLabel(group) }}</span>
                  <button type="button" [attr.title]="'Previous ' + group.title + ' page'" [attr.aria-label]="'Previous ' + group.title + ' page'" [disabled]="pageIndex(group) === 0 || isShowingAll(group)" (click)="changePage(group, -1)"><svg lucideChevronLeft aria-hidden="true"></svg></button>
                  <button type="button" [attr.title]="'Next ' + group.title + ' page'" [attr.aria-label]="'Next ' + group.title + ' page'" [disabled]="(pageIndex(group) + 1) * pageSize >= group.items.length || isShowingAll(group)" (click)="changePage(group, 1)"><svg lucideChevronRight aria-hidden="true"></svg></button>
                  <button type="button" [attr.aria-pressed]="isShowingAll(group)" (click)="toggleAll(group)">{{ isShowingAll(group) ? 'Paginate' : 'Show all' }}</button>
                </nav>
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
    .result-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-block: 1px solid #dbe3ed; }
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
    .result-actions, .group-pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .result-actions button, .group-pagination button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 6px 10px; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; color: #334155; font: inherit; font-size: .8rem; cursor: pointer; }
    button:disabled { opacity: .5; cursor: default; }
    button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
    svg { width: 16px; height: 16px; flex: none; }
    .group-pagination { margin-top: 10px; }
    .group-pagination span { flex: 1 0 100%; color: #52637a; font-size: .8rem; }
    .result-actions > span { font-size: .8rem; color: #52637a; }
    .frozen-health, .destination p { color: #52637a; font-size: .8rem; line-height: 1.5; }
    .snapshot-list a { flex: none; }
    @media print {
      .result-actions, .group-pagination, .destination a, .current-link-label { display: none !important; }
      .snapshot-groups { grid-template-columns: 1fr !important; }
      .snapshot-list article { break-inside: avoid; }
      .snapshot-list a { color: inherit; text-decoration: none; }
    }
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
export class CycleCloseoutResultComponent implements OnChanges {
  @Input({ required: true }) closeout!: ProjectCycleCloseoutDto;
  readonly healthLabel = deliveryHealthLabel;
  readonly countLabel = snapshotCountLabel;
  readonly dateRangeLabel = cycleDateRangeLabel;

  private readonly clipboard = inject(ClipboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly pageSize = visibleItemLimit;
  readonly isCopying = signal(false);
  readonly shareMessage = signal('');
  private pages: Partial<Record<SnapshotGroup['key'], number>> = {};
  private expanded = new Set<SnapshotGroup['key']>();
  private printing = false;
  private copyGeneration = 0;

  ngOnChanges(): void {
    this.pages = {};
    this.expanded.clear();
    this.copyGeneration++;
    this.isCopying.set(false);
    this.shareMessage.set('');
  }

  pageIndex(group: SnapshotGroup): number { return this.pages[group.key] ?? 0; }
  isShowingAll(group: SnapshotGroup): boolean { return this.expanded.has(group.key); }
  changePage(group: SnapshotGroup, delta: number): void {
    this.pages[group.key] = Math.max(0, Math.min(Math.ceil(group.items.length / this.pageSize) - 1, this.pageIndex(group) + delta));
  }
  toggleAll(group: SnapshotGroup): void {
    if (this.isShowingAll(group)) this.expanded.delete(group.key);
    else this.expanded.add(group.key);
    this.pages[group.key] = 0;
  }
  rangeLabel(group: SnapshotGroup): string {
    const start = this.isShowingAll(group) ? 0 : this.pageIndex(group) * this.pageSize;
    const end = this.isShowingAll(group) ? group.items.length : Math.min(start + this.pageSize, group.items.length);
    return (start + 1) + '-' + end + ' of ' + group.items.length;
  }
  async copyMarkdown(): Promise<void> {
    if (this.isCopying()) return;
    const generation = ++this.copyGeneration;
    this.isCopying.set(true);
    this.shareMessage.set('');
    try {
      await this.clipboard.copyText(closeoutMarkdown(this.closeout));
      if (!this.destroyRef.destroyed && generation === this.copyGeneration) this.shareMessage.set('Outcome copied.');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.copyGeneration) this.shareMessage.set('Copy failed. Download Markdown instead.');
    } finally {
      if (!this.destroyRef.destroyed && generation === this.copyGeneration) this.isCopying.set(false);
    }
  }
  downloadMarkdown(): void {
    downloadBlob({ blob: new Blob([closeoutMarkdown(this.closeout)], { type: 'text/markdown;charset=utf-8' }), fileName: 'cycle-outcome-' + this.closeout.cycleId + '.md' });
  }
  print(): void { window.print(); }
  @HostListener('window:beforeprint')
  beforePrint(): void {
    this.printing = true;
    this.changeDetector.detectChanges();
  }
  @HostListener('window:afterprint')
  afterPrint(): void {
    this.printing = false;
    this.changeDetector.detectChanges();
  }

  detailQueryParams(): { returnUrl: string } {
    return recordOriginParams('/projects/' + this.closeout.projectId + '/cycles/' + this.closeout.cycleId, 'cycle-result-heading');
  }
  groups(): SnapshotGroup[] {
    return [
      {
        key: 'completed',
        title: 'Done at close',
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
    if (this.printing || this.isShowingAll(group)) return group.items;
    const start = this.pageIndex(group) * this.pageSize;
    return group.items.slice(start, start + this.pageSize);
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
