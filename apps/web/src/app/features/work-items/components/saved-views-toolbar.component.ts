import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { SavedWorkViewDto, SavedWorkViewVisibility } from '@worktrail/contracts';

import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';
import {
  meaningfulWorkItemQueryFieldCount,
  type WorkItemQueryScope
} from '../query/work-item-query-serialization';

type SavedViewOptionGroup = 'shared' | 'personal';

interface SavedViewOption {
  id: string;
  group: SavedViewOptionGroup;
  label: string;
  summary: string;
  canManage: boolean;
  savedView: SavedWorkViewDto;
}

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

      @if (sharedViews.length > 0 || personalViews.length > 0) {
        <div class="saved-view-open">
          <label>
            <span>Open saved view</span>
            <select
              [value]="selectedOpenViewId"
              aria-describedby="saved-view-open-help"
              (change)="selectedOpenViewId = $any($event.target).value"
            >
              <option value="">Choose a saved view</option>
              @if (sharedViewOptions().length > 0) {
                <optgroup [label]="sharedSectionLabel">
                  @for (option of sharedViewOptions(); track option.id) {
                    <option [value]="option.id">{{ option.label }}</option>
                  }
                </optgroup>
              }
              @if (personalViewOptions().length > 0) {
                <optgroup [label]="personalSectionLabel">
                  @for (option of personalViewOptions(); track option.id) {
                    <option [value]="option.id">{{ option.label }}</option>
                  }
                </optgroup>
              }
            </select>
          </label>
          <button
            type="button"
            aria-label="Open selected saved view"
            [disabled]="selectedOpenViewOption() === null"
            (click)="openSelectedView()"
          >
            Open
          </button>
        </div>
        <p id="saved-view-open-help" class="visually-hidden">
          Choose a saved view, then open it to apply its filters.
        </p>

        @if (selectedOpenViewOption(); as option) {
          <p class="saved-view-selected-summary">
            {{ option.group === 'shared' ? 'Shared view' : 'Personal view' }} · {{ option.summary }}
          </p>
        }
      }

      @if (openedViewMessage !== null) {
        <p class="saved-view-opened" aria-live="polite">{{ openedViewMessage }}</p>
      }

      @if (canManagePersonalViews || canManageSharedViews) {
        <details class="saved-view-save">
          <summary>Save view</summary>
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
        </details>
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
      } @else {
        <details class="saved-view-manager">
          <summary>Manage views</summary>

          <div class="saved-view-manage">
            <label>
              <span>Manage saved view</span>
              <select
                [value]="selectedManageViewId"
                aria-describedby="saved-view-manage-help"
                (change)="selectedManageViewId = $any($event.target).value"
              >
                <option value="">Choose a saved view to manage</option>
                @if (sharedViewOptions().length > 0) {
                  <optgroup [label]="sharedSectionLabel">
                    @for (option of sharedViewOptions(); track option.id) {
                      <option [value]="option.id">{{ option.label }}</option>
                    }
                  </optgroup>
                }
                @if (personalViewOptions().length > 0) {
                  <optgroup [label]="personalSectionLabel">
                    @for (option of personalViewOptions(); track option.id) {
                      <option [value]="option.id">{{ option.label }}</option>
                    }
                  </optgroup>
                }
              </select>
            </label>
            <p id="saved-view-manage-help" class="visually-hidden">
              Choose a saved view to inspect or manage its allowed actions.
            </p>

            @if (selectedManageViewOption(); as option) {
              <article class="saved-view-management-panel">
                <div class="saved-view-management-panel__heading">
                  <div>
                    <strong>{{ option.savedView.name }}</strong>
                    <small>{{ option.summary }}</small>
                  </div>
                  <span>{{ option.group === 'shared' ? 'Shared view' : 'Personal view' }}</span>
                </div>

                <p class="saved-view-management-meta">
                  {{ managementMetaLabel(option) }}
                </p>

                <div class="saved-view-management-actions">
                  <button
                    type="button"
                    [attr.aria-label]="'Open ' + option.savedView.name"
                    (click)="openSavedView(option.savedView)"
                  >
                    Open
                  </button>

                  @if (option.canManage) {
                    <button
                      type="button"
                      class="secondary-action"
                      [attr.aria-label]="'Update query for ' + option.savedView.name"
                      (click)="updateQuery.emit(option.savedView)"
                    >
                      Update query
                    </button>
                    <button
                      type="button"
                      class="secondary-action"
                      [attr.aria-label]="
                        (option.savedView.isPinned ? 'Unpin ' : 'Pin ') + option.savedView.name
                      "
                      (click)="pinChange.emit({ savedView: option.savedView, isPinned: !option.savedView.isPinned })"
                    >
                      {{ option.savedView.isPinned ? 'Unpin' : 'Pin' }}
                    </button>
                  }
                </div>

                @if (option.canManage) {
                  <label class="saved-view-management-rename">
                    <span>Rename</span>
                    <input
                      type="text"
                      [value]="draftNames[option.id] ?? option.savedView.name"
                      (input)="draftNameChange.emit({ savedViewId: option.id, name: $any($event.target).value })"
                    />
                  </label>

                  <div class="saved-view-management-actions saved-view-management-actions--danger">
                    <button
                      type="button"
                      class="secondary-action"
                      [attr.aria-label]="'Rename ' + option.savedView.name"
                      (click)="rename.emit(option.savedView)"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      class="danger-action"
                      [attr.aria-label]="'Delete ' + option.savedView.name"
                      (click)="delete.emit(option.savedView)"
                    >
                      Delete
                    </button>
                  </div>
                } @else {
                  <p class="saved-view-read-only">
                    This saved view is read-only for your current role.
                  </p>
                }
              </article>
            } @else {
              <p class="saved-view-manage-empty">Choose a saved view to inspect or manage it.</p>
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

    .saved-views__heading {
      display: flex;
      gap: 12px;
      align-items: end;
      justify-content: space-between;
      min-width: 0;
    }

    .saved-view-open,
    .saved-view-form {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto;
      gap: 12px;
      align-items: end;
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
      overflow-wrap: anywhere;
    }

    .shared-helper {
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .saved-view-open label,
    .saved-view-manage label,
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

    input,
    select {
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

    .saved-view-selected-summary,
    .saved-view-opened {
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .saved-view-opened {
      color: #166534;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
      padding: 0;
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

    .saved-view-save,
    .saved-view-manager {
      display: grid;
      gap: 12px;
    }

    .saved-view-save summary,
    .saved-view-manager summary {
      width: fit-content;
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #ffffff;
      color: #1e3a5f;
      font-size: 0.875rem;
      font-weight: 800;
      cursor: pointer;
    }

    .saved-view-save[open] summary,
    .saved-view-manager[open] summary {
      border-color: #1f4f99;
      color: #1f4f99;
    }

    .saved-view-manage {
      display: grid;
      gap: 10px;
      max-width: 100%;
    }

    .saved-view-management-panel {
      display: grid;
      gap: 12px;
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
    }

    .saved-view-management-panel__heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
    }

    .saved-view-management-panel__heading div {
      min-width: 0;
    }

    .saved-view-management-panel__heading strong {
      display: block;
      color: #111827;
      font-size: 0.875rem;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .saved-view-management-panel__heading small {
      display: block;
      margin-top: 4px;
    }

    .saved-view-management-panel__heading span {
      border-radius: 999px;
      padding: 4px 8px;
      background: #e8eef8;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .saved-view-management-meta,
    .saved-view-manage-empty,
    .saved-view-read-only {
      color: #64748b;
      font-size: 0.8125rem;
    }

    .saved-view-management-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .saved-view-management-actions--danger {
      border-top: 1px solid #eef2f7;
      padding-top: 12px;
    }

    .saved-view-management-actions--danger .danger-action {
      margin-left: auto;
    }

    @media (max-width: 760px) {
      .saved-views__heading,
      .saved-view-open,
      .saved-view-form,
      .save-actions,
      .saved-view-management-panel__heading {
        display: grid;
        grid-template-columns: 1fr;
      }

      .saved-view-management-actions button,
      .save-actions button,
      .saved-view-open button {
        width: 100%;
      }

      .saved-view-management-actions--danger .danger-action {
        margin-left: 0;
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
  selectedOpenViewId = '';
  selectedManageViewId = '';
  openedViewMessage: string | null = null;

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

  sharedViewOptions(): SavedViewOption[] {
    return this.toSavedViewOptions(this.sharedViews, 'shared');
  }

  personalViewOptions(): SavedViewOption[] {
    return this.toSavedViewOptions(this.personalViews, 'personal');
  }

  savedViewOptions(): SavedViewOption[] {
    return [...this.sharedViewOptions(), ...this.personalViewOptions()];
  }

  selectedOpenViewOption(): SavedViewOption | null {
    return this.savedViewOptions().find((option) => option.id === this.selectedOpenViewId) ?? null;
  }

  selectedManageViewOption(): SavedViewOption | null {
    return this.savedViewOptions().find((option) => option.id === this.selectedManageViewId) ?? null;
  }

  canManageView(savedView: SavedWorkViewDto): boolean {
    return savedView.visibility === 'personal'
      ? this.canManagePersonalViews
      : this.canManageSharedViews;
  }

  openSelectedView(): void {
    const option = this.selectedOpenViewOption();

    if (option === null) {
      return;
    }

    this.openSavedView(option.savedView);
  }

  openSavedView(savedView: SavedWorkViewDto): void {
    this.selectedOpenViewId = savedView.id;
    this.openedViewMessage = `Opened "${savedView.name}". Results updated below.`;
    this.open.emit(savedView);
  }

  savedViewQueryLabel(savedView: SavedWorkViewDto): string {
    const count = meaningfulWorkItemQueryFieldCount(savedView.query, this.querySummaryScope);

    return count === 0
      ? `Default ${this.querySummaryScope} view`
      : `${count} applied ${count === 1 ? 'filter' : 'filters'}`;
  }

  managementMetaLabel(option: SavedViewOption): string {
    const ownerLabel =
      option.group === 'shared'
        ? `Shared by ${option.savedView.owner.name}`
        : 'Personal saved view';
    const pinnedLabel = option.savedView.isPinned ? 'Pinned' : 'Not pinned';

    return `${ownerLabel} · ${pinnedLabel} · Updated ${this.updatedDateLabel(option.savedView)}`;
  }

  private toSavedViewOptions(
    savedViews: SavedWorkViewDto[],
    group: SavedViewOptionGroup
  ): SavedViewOption[] {
    return savedViews.map((savedView) => {
      const summary = this.savedViewQueryLabel(savedView);

      return {
        id: savedView.id,
        group,
        label: `${savedView.name} - ${summary}`,
        summary,
        canManage: this.canManageView(savedView),
        savedView
      };
    });
  }

  private updatedDateLabel(savedView: SavedWorkViewDto): string {
    const date = new Date(savedView.updatedAt);

    if (Number.isNaN(date.getTime())) {
      return savedView.updatedAt;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }
}
