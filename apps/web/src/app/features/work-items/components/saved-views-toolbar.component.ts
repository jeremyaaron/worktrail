import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { SavedWorkViewDto } from '@worktrail/contracts';

import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';
import { meaningfulWorkItemQueryFieldCount } from '../query/work-item-query-serialization';

@Component({
  selector: 'app-saved-views-toolbar',
  imports: [EmptyStateComponent, LoadingIndicatorComponent],
  template: `
    <section class="saved-views" aria-labelledby="saved-views-heading">
      <div class="saved-views__heading">
        <div>
          <h2 id="saved-views-heading">Saved views</h2>
          <p>{{ savedViews.length }} personal views</p>
        </div>
        @if (isLoading) {
          <app-loading-indicator label="Loading saved views" />
        }
      </div>

      @if (loadError !== null) {
        <p class="inline-error">{{ loadError }}</p>
      }

      <form class="saved-view-form" (submit)="saveRequested(); $event.preventDefault()">
        <label>
          <span>Name</span>
          <input
            type="text"
            name="savedViewName"
            [value]="newViewName"
            placeholder="Open owner work"
            (input)="newViewName = $any($event.target).value"
          />
        </label>
        <button type="submit" [disabled]="isSaving">
          {{ isSaving ? 'Saving...' : 'Save current view' }}
        </button>
      </form>

      @if (mutationError !== null) {
        <p class="inline-error">{{ mutationError }}</p>
      }

      @if (savedViews.length === 0) {
        <app-empty-state
          title="No saved views"
          message="Save the current filters to reuse this workspace view."
        />
      } @else {
        <details class="saved-view-manager">
          <summary>Manage saved views</summary>

          <div class="saved-view-list">
            @for (view of savedViews; track view.id) {
              <article class="saved-view-row">
                <div>
                  <strong>{{ view.name }}</strong>
                  <small>{{ savedViewQueryLabel(view) }}</small>
                </div>

                <label>
                  <span>Rename</span>
                  <input
                    type="text"
                    [value]="draftNames[view.id] ?? view.name"
                    (input)="draftNameChange.emit({ savedViewId: view.id, name: $any($event.target).value })"
                  />
                </label>

                <div class="saved-view-actions">
                  <button type="button" class="secondary-action" (click)="open.emit(view)">
                    Open
                  </button>
                  <button type="button" class="secondary-action" (click)="rename.emit(view)">
                    Rename
                  </button>
                  <button type="button" class="secondary-action" (click)="updateQuery.emit(view)">
                    Update query
                  </button>
                  <button type="button" class="danger-action" (click)="delete.emit(view)">
                    Delete
                  </button>
                </div>
              </article>
            }
          </div>
        </details>
      }
    </section>
  `,
  styles: `
    .saved-views {
      display: grid;
      gap: 12px;
      margin-bottom: 18px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
    }

    .saved-views__heading,
    .saved-view-form {
      display: flex;
      gap: 12px;
      align-items: end;
      justify-content: space-between;
    }

    h2,
    p {
      margin: 0;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    p,
    small {
      color: #64748b;
      font-size: 0.75rem;
      line-height: 1.4;
    }

    .saved-view-form label {
      display: grid;
      flex: 1;
      gap: 6px;
      min-width: 220px;
    }

    label span {
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    input {
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
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    .secondary-action {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    .danger-action {
      border-color: #fecaca;
      background: #fff1f2;
      color: #991b1b;
    }

    .inline-error {
      color: #991b1b;
      font-size: 0.875rem;
      font-weight: 700;
    }

    .saved-view-manager summary {
      width: fit-content;
      color: #1e3a5f;
      font-size: 0.875rem;
      font-weight: 800;
      cursor: pointer;
    }

    .saved-view-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }

    .saved-view-row {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) minmax(180px, 0.8fr) auto;
      gap: 12px;
      align-items: end;
      border-top: 1px solid #eef2f7;
      padding-top: 12px;
    }

    .saved-view-row strong {
      display: block;
      color: #111827;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    .saved-view-row small {
      display: block;
      margin-top: 4px;
    }

    .saved-view-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    @media (max-width: 760px) {
      .saved-views__heading,
      .saved-view-form,
      .saved-view-row {
        display: grid;
        grid-template-columns: 1fr;
      }

      .saved-view-actions {
        justify-content: flex-start;
      }
    }
  `
})
export class SavedViewsToolbarComponent {
  @Input({ required: true }) savedViews: SavedWorkViewDto[] = [];
  @Input({ required: true }) draftNames: Partial<Record<string, string>> = {};
  @Input() isLoading = false;
  @Input() isSaving = false;
  @Input() loadError: string | null = null;
  @Input() mutationError: string | null = null;
  @Output() readonly save = new EventEmitter<string>();
  @Output() readonly open = new EventEmitter<SavedWorkViewDto>();
  @Output() readonly rename = new EventEmitter<SavedWorkViewDto>();
  @Output() readonly updateQuery = new EventEmitter<SavedWorkViewDto>();
  @Output() readonly delete = new EventEmitter<SavedWorkViewDto>();
  @Output() readonly draftNameChange = new EventEmitter<{ savedViewId: string; name: string }>();

  newViewName = '';

  saveRequested(): void {
    this.save.emit(this.newViewName);
    this.newViewName = '';
  }

  savedViewQueryLabel(savedView: SavedWorkViewDto): string {
    const count = meaningfulWorkItemQueryFieldCount(savedView.query, 'workspace');

    return count === 0
      ? 'Default workspace view'
      : `${count} applied ${count === 1 ? 'filter' : 'filters'}`;
  }
}
