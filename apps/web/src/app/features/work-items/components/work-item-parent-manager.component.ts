import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type {
  WorkItemDetailDto,
  WorkItemParentCandidateDto,
  WorkItemParentDto
} from '@worktrail/contracts';
import { Subscription, debounceTime, distinctUntilChanged, tap } from 'rxjs';

import { extractApiErrorMessage } from '../../../core/api/api-error';
import { WorktrailApiService } from '../../../core/worktrail-api.service';
import { workItemStatusLabel } from '../../../shared/work-items/work-item-display';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';

@Component({
  selector: 'app-work-item-parent-manager',
  imports: [ErrorPanelComponent, LoadingIndicatorComponent, ReactiveFormsModule],
  template: `
    <section class="parent-manager" aria-labelledby="parent-manager-heading">
      <div class="parent-manager__heading">
        <div>
          <p class="eyebrow">Work breakdown</p>
          <h2 id="parent-manager-heading">Parent work</h2>
        </div>

        @if (currentParent(); as parent) {
          <span class="current-parent">Current: {{ parent.displayKey }}</span>
        }
      </div>

      @if (readOnly()) {
        <p class="muted">Parent changes are unavailable while this project is archived.</p>
      } @else if (isStructurallyIneligible()) {
        <p class="muted">Work with children cannot be assigned to another parent.</p>
      } @else {
        <label for="parent-search">
          <span>Find a parent</span>
          <input
            id="parent-search"
            type="search"
            [formControl]="searchControl"
            placeholder="Search by key or title"
            autocomplete="off"
          />
        </label>

        @if (normalizedSearch().length < 2) {
          <p class="search-guidance">Enter at least two characters. Exact keys are supported.</p>
        } @else if (isSearching()) {
          <app-loading-indicator label="Searching parent work" />
        } @else if (searchError()) {
          <app-error-panel
            title="Parent search unavailable"
            [message]="searchError() ?? ''"
            (retry)="retrySearch()"
          />
        } @else if (hasSearched() && candidates().length === 0) {
          <p class="empty-result">No eligible parent work found.</p>
        } @else if (candidates().length > 0) {
          <div class="candidate-list" aria-label="Eligible parent work">
            @for (candidate of candidates(); track candidate.id) {
              <button
                type="button"
                class="candidate"
                [class.candidate--selected]="selectedParent()?.id === candidate.id"
                [attr.aria-pressed]="selectedParent()?.id === candidate.id"
                (click)="selectCandidate(candidate)"
              >
                <span class="candidate__identity">
                  <strong>{{ candidate.displayKey }} {{ candidate.title }}</strong>
                  <small>{{ formatToken(candidate.type) }} · {{ formatToken(candidate.priority) }}</small>
                </span>
                <span class="candidate__status" [attr.data-status]="candidate.status">
                  {{ workItemStatusLabel(candidate.status) }}
                </span>
              </button>
            }
          </div>
        }

        <div class="selection" aria-live="polite">
          @if (selectedParent(); as selected) {
            <div>
              <span>Selected parent</span>
              <strong>{{ selected.displayKey }} {{ selected.title }}</strong>
            </div>
            @if (isSelectionStale()) {
              <p>The selection may no longer be eligible. Search again or retry to revalidate it.</p>
            }
          } @else {
            <p>No parent selected.</p>
          }
        </div>

        @if (mutationError()) {
          <app-error-panel
            title="Parent not changed"
            [message]="mutationError() ?? ''"
            (retry)="retryMutation()"
          />
        }

        <div class="actions">
          <button type="button" [disabled]="isSaveDisabled()" (click)="saveParent()">
            {{ isSaving() ? 'Saving...' : 'Save parent' }}
          </button>
          @if (currentParent() !== null) {
            <button
              type="button"
              class="secondary-action"
              [disabled]="isSaving()"
              (click)="clearParent()"
            >
              Clear parent
            </button>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .parent-manager {
      display: grid;
      gap: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .parent-manager__heading,
    .candidate,
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .eyebrow,
    h2,
    p {
      margin: 0;
    }

    .eyebrow {
      margin-bottom: 4px;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    h2 {
      color: #111827;
      font-size: 1.05rem;
    }

    .current-parent,
    .candidate__status {
      min-height: 22px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 2px 8px;
      background: #f8fafc;
      color: #475569;
      font-size: 0.72rem;
      font-weight: 800;
    }

    label,
    .candidate__identity,
    .selection div {
      display: grid;
      gap: 5px;
    }

    label {
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    input {
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

    input:focus {
      border-color: #1d4ed8;
      outline: 2px solid #bfdbfe;
    }

    .search-guidance,
    .empty-result,
    .muted,
    .selection p {
      color: #64748b;
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    .candidate-list {
      display: grid;
      gap: 6px;
      max-height: 250px;
      overflow-y: auto;
    }

    .candidate {
      width: 100%;
      min-height: 52px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      color: #1f2937;
      text-align: left;
      cursor: pointer;
    }

    .candidate:hover,
    .candidate:focus-visible,
    .candidate--selected {
      border-color: #2563eb;
      background: #eff6ff;
    }

    .candidate__identity small {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .candidate__status[data-status='done'] {
      border-color: #a7f3d0;
      background: #ecfdf5;
      color: #047857;
    }

    .candidate__status[data-status='canceled'] {
      background: #f1f5f9;
    }

    .selection {
      border-left: 3px solid #93c5fd;
      padding: 8px 10px;
      background: #f8fafc;
      color: #1f2937;
      font-size: 0.8125rem;
    }

    .selection span {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .selection p + p,
    .selection div + p {
      margin-top: 6px;
      color: #9a3412;
    }

    .actions {
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    .actions button {
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

    .actions .secondary-action {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    .actions button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    @media (max-width: 640px) {
      .parent-manager__heading,
      .candidate {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `
})
export class WorkItemParentManagerComponent implements OnDestroy {
  private readonly api = inject(WorktrailApiService);
  private readonly subscriptions = new Subscription();
  private searchRequest = 0;
  private lastWorkItemId = '';
  private lastParentId: string | null = null;
  private lastMutationParentId: string | null | undefined;

  readonly item = input.required<WorkItemDetailDto>();
  readonly readOnly = input(false);
  readonly parentChanged = output<WorkItemDetailDto>();
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly candidates = signal<WorkItemParentCandidateDto[]>([]);
  readonly selectedParent = signal<WorkItemParentDto | null>(null);
  readonly isSearching = signal(false);
  readonly hasSearched = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly mutationError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly isSelectionStale = signal(false);
  readonly searchTerm = signal('');
  readonly normalizedSearch = computed(() => this.searchTerm().trim());
  readonly currentParent = computed(() => this.item().parent);
  readonly isStructurallyIneligible = computed(() => this.item().childSummary !== null);
  readonly isSaveDisabled = computed(() => {
    const selectedParentId = this.selectedParent()?.id ?? null;

    return (
      this.readOnly() ||
      this.isStructurallyIneligible() ||
      this.isSaving() ||
      selectedParentId === null ||
      selectedParentId === this.currentParent()?.id
    );
  });
  readonly workItemStatusLabel = workItemStatusLabel;

  constructor() {
    effect(() => {
      const item = this.item();
      const parentId = item.parent?.id ?? null;
      const workItemChanged = item.id !== this.lastWorkItemId;

      if (workItemChanged) {
        this.lastWorkItemId = item.id;
        this.searchRequest += 1;
        this.searchControl.setValue('', { emitEvent: false });
        this.searchTerm.set('');
        this.candidates.set([]);
        this.hasSearched.set(false);
        this.searchError.set(null);
        this.mutationError.set(null);
        this.isSearching.set(false);
        this.isSaving.set(false);
        this.isSelectionStale.set(false);
        this.lastMutationParentId = undefined;
      }

      if (workItemChanged || parentId !== this.lastParentId) {
        this.selectedParent.set(item.parent);
      }

      this.lastParentId = parentId;
    });

    this.subscriptions.add(
      this.searchControl.valueChanges
        .pipe(
          tap((value) => this.searchTerm.set(value)),
          debounceTime(300),
          distinctUntilChanged()
        )
        .subscribe(() => this.searchCandidates())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  selectCandidate(candidate: WorkItemParentCandidateDto): void {
    this.selectedParent.set(candidate);
    this.mutationError.set(null);
    this.isSelectionStale.set(false);
  }

  retrySearch(): void {
    this.searchCandidates();
  }

  saveParent(): void {
    const selected = this.selectedParent();

    if (selected === null || this.isSaveDisabled()) {
      return;
    }

    this.changeParent(selected.id);
  }

  clearParent(): void {
    if (
      this.currentParent() === null ||
      this.readOnly() ||
      this.isStructurallyIneligible() ||
      this.isSaving()
    ) {
      return;
    }

    this.changeParent(null);
  }

  retryMutation(): void {
    if (this.lastMutationParentId !== undefined && !this.isSaving()) {
      this.changeParent(this.lastMutationParentId);
    }
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  private searchCandidates(): void {
    const search = this.normalizedSearch();
    const requestId = ++this.searchRequest;

    this.searchError.set(null);

    if (search.length < 2 || this.readOnly() || this.isStructurallyIneligible()) {
      this.candidates.set([]);
      this.hasSearched.set(false);
      this.isSearching.set(false);
      return;
    }

    const workItemId = this.item().id;
    this.isSearching.set(true);
    this.candidates.set([]);

    this.api.listParentCandidates(workItemId, search).subscribe({
      next: (candidates) => {
        if (requestId !== this.searchRequest || workItemId !== this.item().id) {
          return;
        }

        this.candidates.set(candidates);
        this.hasSearched.set(true);
        this.isSearching.set(false);
      },
      error: () => {
        if (requestId !== this.searchRequest || workItemId !== this.item().id) {
          return;
        }

        this.searchError.set('Eligible parent work could not be loaded.');
        this.hasSearched.set(true);
        this.isSearching.set(false);
      }
    });
  }

  private changeParent(parentWorkItemId: string | null): void {
    this.lastMutationParentId = parentWorkItemId;
    this.isSaving.set(true);
    this.mutationError.set(null);
    this.isSelectionStale.set(false);

    this.api.setWorkItemParent(this.item().id, { parentWorkItemId }).subscribe({
      next: (workItem) => {
        this.selectedParent.set(workItem.parent);
        this.isSaving.set(false);
        this.lastMutationParentId = undefined;
        this.parentChanged.emit(workItem);
      },
      error: (error: HttpErrorResponse) => {
        this.mutationError.set(
          extractApiErrorMessage(error, 'The parent work item could not be changed.')
        );
        this.isSelectionStale.set(error.status === 404 || error.status === 409);
        this.isSaving.set(false);
      }
    });
  }
}
