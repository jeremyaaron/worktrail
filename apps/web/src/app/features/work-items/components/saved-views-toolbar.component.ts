import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { SavedWorkViewDto, SavedWorkViewVisibility } from '@worktrail/contracts';

import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';
import {
  meaningfulWorkItemQueryFieldCount,
  type WorkItemQueryScope
} from '../query/work-item-query-serialization';

@Component({
  selector: 'app-saved-views-toolbar',
  imports: [EmptyStateComponent, LoadingIndicatorComponent],
  template: `
    <section class="saved-views" aria-labelledby="saved-views-heading">
      <div class="saved-views__heading">
        <div>
          <h2 id="saved-views-heading">Saved views</h2>
          <p>{{ sharedViews.length }} shared · {{ personalViews.length }} personal</p>
        </div>
        @if (isLoading) {
          <app-loading-indicator label="Loading saved views" />
        }
      </div>

      @if (loadError !== null) {
        <p class="inline-error">{{ loadError }}</p>
      }

      @if (canManagePersonalViews || canManageSharedViews) {
        <form class="saved-view-form" (submit)="saveRequested('personal'); $event.preventDefault()">
          <label>
            <span>Name</span>
            <input
              type="text"
              name="savedViewName"
              [value]="newViewName"
              [placeholder]="newViewPlaceholder"
              (input)="newViewName = $any($event.target).value"
            />
          </label>
          <div class="save-actions">
            @if (canManagePersonalViews) {
              <button type="submit" [disabled]="isSaving">
                {{ isSaving ? 'Saving...' : savePersonalButtonLabel }}
              </button>
            }
            @if (canManageSharedViews) {
              <button
                type="button"
                class="secondary-action"
                [disabled]="isSaving"
                (click)="saveRequested('workspace')"
              >
                {{ isSaving ? 'Saving...' : saveSharedButtonLabel }}
              </button>
            }
          </div>
        </form>
      }

      @if (mutationError !== null) {
        <p class="inline-error">{{ mutationError }}</p>
      }

      @if (!canManageSharedViews && sharedViews.length > 0) {
        <p class="shared-helper">{{ sharedHelper }}</p>
      }

      @if (!canManagePersonalViews && !canManageSharedViews) {
        <p class="shared-helper">{{ readOnlyHelper }}</p>
      }

      @if (sharedViews.length === 0 && personalViews.length === 0) {
        <app-empty-state
          [title]="emptyTitle"
          [message]="emptyMessage"
        />
      } @else if (canManagePersonalViews || canManageSharedViews) {
        <details class="saved-view-manager">
          <summary>Manage saved views</summary>

          <div class="saved-view-list">
            <section class="saved-view-section" [attr.aria-label]="sharedSectionLabel">
              <div class="saved-view-section__heading">
                <strong>{{ sharedSectionLabel }}</strong>
                <span>{{ sharedViews.length }}</span>
              </div>

              @if (sharedViews.length === 0) {
                <p class="saved-view-section__empty">{{ sharedEmptyMessage }}</p>
              } @else {
                @for (view of sharedViews; track view.id) {
                  <article class="saved-view-row saved-view-row--shared">
                    <div>
                      <strong>{{ view.name }}</strong>
                      <small>{{ savedViewQueryLabel(view) }}</small>
                    </div>

                    @if (canManageSharedViews) {
                      <label>
                        <span>Rename</span>
                        <input
                          type="text"
                          [value]="draftNames[view.id] ?? view.name"
                          (input)="draftNameChange.emit({ savedViewId: view.id, name: $any($event.target).value })"
                        />
                      </label>
                    } @else {
                      <p class="saved-view-owner">Shared by {{ view.owner.name }}</p>
                    }

                    <div class="saved-view-actions">
                      <button type="button" class="secondary-action" (click)="open.emit(view)">
                        Open
                      </button>
                      @if (canManageSharedViews) {
                        <button type="button" class="secondary-action" (click)="rename.emit(view)">
                          Rename
                        </button>
                        <button type="button" class="secondary-action" (click)="updateQuery.emit(view)">
                          Update query
                        </button>
                        <button
                          type="button"
                          class="secondary-action"
                          (click)="pinChange.emit({ savedView: view, isPinned: !view.isPinned })"
                        >
                          {{ view.isPinned ? 'Unpin' : 'Pin' }}
                        </button>
                        <button type="button" class="danger-action" (click)="delete.emit(view)">
                          Delete
                        </button>
                      }
                    </div>
                  </article>
                }
              }
            </section>

            <section class="saved-view-section" [attr.aria-label]="personalSectionLabel">
              <div class="saved-view-section__heading">
                <strong>{{ personalSectionLabel }}</strong>
                <span>{{ personalViews.length }}</span>
              </div>

              @if (personalViews.length === 0) {
                <p class="saved-view-section__empty">{{ personalEmptyMessage }}</p>
              } @else {
                @for (view of personalViews; track view.id) {
                  <article class="saved-view-row">
                    <div>
                      <strong>{{ view.name }}</strong>
                      <small>{{ savedViewQueryLabel(view) }}</small>
                    </div>

                    @if (canManagePersonalViews) {
                      <label>
                        <span>Rename</span>
                        <input
                          type="text"
                          [value]="draftNames[view.id] ?? view.name"
                          (input)="draftNameChange.emit({ savedViewId: view.id, name: $any($event.target).value })"
                        />
                      </label>
                    } @else {
                      <p class="saved-view-owner">Personal view</p>
                    }

                    <div class="saved-view-actions">
                      <button type="button" class="secondary-action" (click)="open.emit(view)">
                        Open
                      </button>
                      @if (canManagePersonalViews) {
                        <button type="button" class="secondary-action" (click)="rename.emit(view)">
                          Rename
                        </button>
                        <button type="button" class="secondary-action" (click)="updateQuery.emit(view)">
                          Update query
                        </button>
                        <button
                          type="button"
                          class="secondary-action"
                          (click)="pinChange.emit({ savedView: view, isPinned: !view.isPinned })"
                        >
                          {{ view.isPinned ? 'Unpin' : 'Pin' }}
                        </button>
                        <button type="button" class="danger-action" (click)="delete.emit(view)">
                          Delete
                        </button>
                      }
                    </div>
                  </article>
                }
              }
            </section>
          </div>
        </details>
      } @else {
        <div class="saved-view-list">
          @if (sharedViews.length > 0) {
            <section class="saved-view-section" [attr.aria-label]="sharedSectionLabel">
              <div class="saved-view-section__heading">
                <strong>{{ sharedSectionLabel }}</strong>
                <span>{{ sharedViews.length }}</span>
              </div>
              @for (view of sharedViews; track view.id) {
                <article class="saved-view-row saved-view-row--shared">
                  <div>
                    <strong>{{ view.name }}</strong>
                    <small>{{ savedViewQueryLabel(view) }}</small>
                  </div>
                  <p class="saved-view-owner">Shared by {{ view.owner.name }}</p>
                  <div class="saved-view-actions">
                    <button type="button" class="secondary-action" (click)="open.emit(view)">
                      Open
                    </button>
                  </div>
                </article>
              }
            </section>
          }

          @if (personalViews.length > 0) {
            <section class="saved-view-section" [attr.aria-label]="personalSectionLabel">
              <div class="saved-view-section__heading">
                <strong>{{ personalSectionLabel }}</strong>
                <span>{{ personalViews.length }}</span>
              </div>
              @for (view of personalViews; track view.id) {
                <article class="saved-view-row">
                  <div>
                    <strong>{{ view.name }}</strong>
                    <small>{{ savedViewQueryLabel(view) }}</small>
                  </div>
                  <p class="saved-view-owner">Personal view</p>
                  <div class="saved-view-actions">
                    <button type="button" class="secondary-action" (click)="open.emit(view)">
                      Open
                    </button>
                  </div>
                </article>
              }
            </section>
          }
        </div>
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

    .shared-helper {
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 700;
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

    .save-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
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

    .saved-view-section {
      display: grid;
      gap: 10px;
    }

    .saved-view-section + .saved-view-section {
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
    }

    .saved-view-section__heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .saved-view-section__heading strong {
      color: #111827;
      font-size: 0.875rem;
    }

    .saved-view-section__heading span {
      min-width: 28px;
      border-radius: 999px;
      padding: 3px 8px;
      background: #e8eef8;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
      text-align: center;
    }

    .saved-view-section__empty,
    .saved-view-owner {
      color: #64748b;
      font-size: 0.8125rem;
    }

    .saved-view-row {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) minmax(180px, 0.8fr) auto;
      gap: 12px;
      align-items: end;
      border-top: 1px solid #eef2f7;
      padding-top: 12px;
    }

    .saved-view-row--shared {
      background: #f8fafc;
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
      .save-actions,
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
  @Input() personalViews: SavedWorkViewDto[] = [];
  @Input() sharedViews: SavedWorkViewDto[] = [];
  @Input() canManagePersonalViews = true;
  @Input() canManageSharedViews = false;
  @Input({ required: true }) draftNames: Partial<Record<string, string>> = {};
  @Input() querySummaryScope: WorkItemQueryScope = 'workspace';
  @Input() emptyTitle = 'No saved views';
  @Input() emptyMessage = 'Save the current filters to reuse this workspace view.';
  @Input() sharedHelper = 'Owners and maintainers manage shared saved views.';
  @Input() sharedSectionLabel = 'Shared views';
  @Input() personalSectionLabel = 'Personal views';
  @Input() sharedEmptyMessage = 'No shared views saved.';
  @Input() personalEmptyMessage = 'No personal views saved.';
  @Input() readOnlyHelper = 'Saved views are read-only.';
  @Input() newViewPlaceholder = 'Open owner work';
  @Input() savePersonalButtonLabel = 'Save personal view';
  @Input() saveSharedButtonLabel = 'Save shared view';
  @Input() isLoading = false;
  @Input() isSaving = false;
  @Input() loadError: string | null = null;
  @Input() mutationError: string | null = null;
  @Output() readonly savePersonal = new EventEmitter<string>();
  @Output() readonly saveWorkspace = new EventEmitter<string>();
  @Output() readonly saveShared = new EventEmitter<string>();
  @Output() readonly save = new EventEmitter<string>();
  @Output() readonly open = new EventEmitter<SavedWorkViewDto>();
  @Output() readonly rename = new EventEmitter<SavedWorkViewDto>();
  @Output() readonly updateQuery = new EventEmitter<SavedWorkViewDto>();
  @Output() readonly pinChange = new EventEmitter<{ savedView: SavedWorkViewDto; isPinned: boolean }>();
  @Output() readonly delete = new EventEmitter<SavedWorkViewDto>();
  @Output() readonly draftNameChange = new EventEmitter<{ savedViewId: string; name: string }>();

  newViewName = '';

  @Input()
  set savedViews(savedViews: SavedWorkViewDto[]) {
    this.personalViews = savedViews.filter((savedView) => savedView.visibility === 'personal');
    this.sharedViews = savedViews.filter((savedView) => savedView.visibility === 'workspace');
  }

  @Input()
  set workspaceViews(workspaceViews: SavedWorkViewDto[]) {
    this.sharedViews = workspaceViews;
  }

  @Input()
  set canManageWorkspaceViews(canManageWorkspaceViews: boolean) {
    this.canManageSharedViews = canManageWorkspaceViews;
  }

  saveRequested(visibility: SavedWorkViewVisibility): void {
    if (visibility === 'workspace') {
      this.saveWorkspace.emit(this.newViewName);
      this.saveShared.emit(this.newViewName);
    } else {
      this.savePersonal.emit(this.newViewName);
      this.save.emit(this.newViewName);
    }

    this.newViewName = '';
  }

  savedViewQueryLabel(savedView: SavedWorkViewDto): string {
    const count = meaningfulWorkItemQueryFieldCount(savedView.query, this.querySummaryScope);

    return count === 0
      ? `Default ${this.querySummaryScope} view`
      : `${count} applied ${count === 1 ? 'filter' : 'filters'}`;
  }
}
