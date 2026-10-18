import { Component, inject } from '@angular/core';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';

import { WorkItemWatchHistoryStore } from '../work-item-watch-history.store';
@Component({
  selector: 'app-work-item-watch',
  imports: [ErrorPanelComponent],
  template: `        <section class="panel watch-panel" aria-labelledby="watch-heading">
          <div class="watch-heading">
            <div>

              <span id="watch-heading" class="visually-hidden">Watchers</span>
              <p>{{ state.watcherCount() }} watching</p>
            </div>
            <button
              type="button"
              class="secondary-action"
              [disabled]="state.record.isArchivedProject() || state.isWatchLoading() || state.isWatchUpdating()"
              (click)="state.toggleWatch()"
            >
              @if (state.isWatchUpdating()) {
                Updating...
              } @else if (state.watchState()?.isWatchedByCurrentActor) {
                Unwatch
              } @else {
                Watch
              }
            </button>
          </div>

          @if (state.watchError()) {
            <app-error-panel
              title="Watchers unavailable"
              [message]="state.watchError() ?? ''"
              (retry)="state.loadWatchState()"
            />
          } @else if (state.isWatchLoading()) {
            <p class="muted">Loading watchers...</p>
          } @else if (state.watchers().length === 0) {
            <p class="muted">No active watchers.</p>
          } @else {
            <details class="watcher-list">
              <summary>Show watchers</summary>
              <ul>
                @for (watcher of state.watchers(); track watcher.id) {
                  <li>
                    <span>{{ state.record.memberDisplayName(watcher.member) }}</span>
                    <time>{{ state.record.formatDateTime(watcher.watchedAt) }}</time>
                  </li>
                }
              </ul>
            </details>
          }
        </section>
`,
  styles: `
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

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }

    h3 {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    button,
.secondary-action {
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

    .secondary-action {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    .panel {
      display: grid;
      min-width: 0;
      gap: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
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

    .watch-panel {
      align-content: start;
    }

    .watch-heading {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
    }

    .watch-heading p {
      margin-top: 3px;
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 800;
      line-height: 1.4;
    }

    .watcher-list {
      display: grid;
      gap: 10px;
      color: #334155;
      font-size: 0.875rem;
    }

    .watcher-list summary {
      cursor: pointer;
      font-weight: 800;
    }

    .watcher-list ul {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .watcher-list li {
      display: grid;
      gap: 2px;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
    }

    .watcher-list time {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
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

.watch-panel { border: 0; border-radius: 0; padding: 0; background: transparent; gap: 6px; }
.watch-heading { align-items: center; flex-wrap: wrap; }
.watcher-list { max-width: 360px; }`
})
export class WorkItemWatchComponent {
  readonly state = inject(WorkItemWatchHistoryStore);
}
