import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';

import { WorkItemRelationshipsStore } from '../work-item-relationships.store';
@Component({
  selector: 'app-work-item-dependencies',
  imports: [ReactiveFormsModule, RouterLink, ErrorPanelComponent],
  template: `@if (state.record.workItem(); as item) {
      <section id="dependencies" tabindex="-1" class="panel relationship-panel" aria-labelledby="relationships-heading">
        <div class="panel-heading">
          <div>
            <p class="section-eyebrow">Dependencies</p>
            <h2 id="relationships-heading">Blocking and related work</h2>

          </div>
        </div>

        <div class="relationship-grid">
          <section class="relationship-group" aria-labelledby="blocked-by-heading">
            <h3 id="blocked-by-heading">Blocked by</h3>
            @if (item.relationships.blockedBy.length === 0) {
              <p class="muted">No blockers linked.</p>
            } @else {
              <div class="relationship-list">
                @for (relationship of item.relationships.blockedBy; track relationship.id) {
                  <article class="relationship-row">
                    <div>
                      <span class="relationship-project">
                        {{ relationship.workItem.project.key }} · {{ relationship.workItem.project.name }}
                      </span>
                      <a [routerLink]="['/work-items', relationship.workItem.id]">
                        {{ relationship.workItem.displayKey }} {{ relationship.workItem.title }}
                      </a>
                      <span class="relationship-meta">
                        {{ state.record.formatToken(relationship.workItem.status) }} ·
                        {{ state.record.formatToken(relationship.workItem.priority) }} ·
                        {{ relationship.workItem.assignee === null ? 'Unassigned' : state.record.memberDisplayName(relationship.workItem.assignee) }}
                      </span>
                    </div>
                    @if (state.managing()) { <button
                      type="button"
                      class="danger-action"
                      [disabled]="state.isRelationshipReadOnly() || state.removingRelationshipId() === relationship.id"
                      (click)="state.removeRelationship(relationship)"
                    >
                      {{ state.removingRelationshipId() === relationship.id ? 'Removing...' : 'Remove' }}
                    </button> }
                  </article>
                }
              </div>
            }
          </section>

          <section class="relationship-group" aria-labelledby="blocks-heading">
            <h3 id="blocks-heading">Blocks</h3>
            @if (item.relationships.blocks.length === 0) {
              <p class="muted">No blocked work linked.</p>
            } @else {
              <div class="relationship-list">
                @for (relationship of item.relationships.blocks; track relationship.id) {
                  <article class="relationship-row">
                    <div>
                      <span class="relationship-project">
                        {{ relationship.workItem.project.key }} · {{ relationship.workItem.project.name }}
                      </span>
                      <a [routerLink]="['/work-items', relationship.workItem.id]">
                        {{ relationship.workItem.displayKey }} {{ relationship.workItem.title }}
                      </a>
                      <span class="relationship-meta">
                        {{ state.record.formatToken(relationship.workItem.status) }} ·
                        {{ state.record.formatToken(relationship.workItem.priority) }} ·
                        {{ relationship.workItem.assignee === null ? 'Unassigned' : state.record.memberDisplayName(relationship.workItem.assignee) }}
                      </span>
                    </div>
                    @if (state.managing()) { <button
                      type="button"
                      class="danger-action"
                      [disabled]="state.isRelationshipReadOnly() || state.removingRelationshipId() === relationship.id"
                      (click)="state.removeRelationship(relationship)"
                    >
                      {{ state.removingRelationshipId() === relationship.id ? 'Removing...' : 'Remove' }}
                    </button> }
                  </article>
                }
              </div>
            }
          </section>

          <section class="relationship-group" aria-labelledby="related-heading">
            <h3 id="related-heading">Related work</h3>
            @if (item.relationships.related.length === 0) {
              <p class="muted">No related work linked.</p>
            } @else {
              <div class="relationship-list">
                @for (relationship of item.relationships.related; track relationship.id) {
                  <article class="relationship-row">
                    <div>
                      <span class="relationship-project">
                        {{ relationship.workItem.project.key }} · {{ relationship.workItem.project.name }}
                      </span>
                      <a [routerLink]="['/work-items', relationship.workItem.id]">
                        {{ relationship.workItem.displayKey }} {{ relationship.workItem.title }}
                      </a>
                      <span class="relationship-meta">
                        {{ state.record.formatToken(relationship.workItem.status) }} ·
                        {{ state.record.formatToken(relationship.workItem.priority) }} ·
                        {{ relationship.workItem.assignee === null ? 'Unassigned' : state.record.memberDisplayName(relationship.workItem.assignee) }}
                      </span>
                    </div>
                    @if (state.managing()) { <button
                      type="button"
                      class="danger-action"
                      [disabled]="state.isRelationshipReadOnly() || state.removingRelationshipId() === relationship.id"
                      (click)="state.removeRelationship(relationship)"
                    >
                      {{ state.removingRelationshipId() === relationship.id ? 'Removing...' : 'Remove' }}
                    </button> }
                  </article>
                }
              </div>
            }
          </section>
        </div>

        <details (toggle)="state.managing.set($any($event.target).open)">
          <summary>Manage dependencies</summary>
        <form
          class="relationship-form"
          [formGroup]="state.relationshipForm"
          (ngSubmit)="state.addRelationship()"
          novalidate
        >
          <div class="relationship-form-grid">
            <label>
              <span>Relationship</span>
              <select formControlName="kind">
                <option value="blocked_by">Add blocker</option>
                <option value="blocks">Add blocked work</option>
                <option value="related">Add related work</option>
              </select>
            </label>

            <label>
              <span>Find work item</span>
              <input type="search" formControlName="search" placeholder="Key, title, or description" />
            </label>

            <button type="button" class="secondary-action" [disabled]="state.isRelationshipReadOnly() || state.isSearchingCandidates()" (click)="state.searchRelationshipCandidates()">
              {{ state.isSearchingCandidates() ? 'Searching...' : 'Search' }}
            </button>
          </div>

          @if (state.candidateSearchError()) {
            <app-error-panel
              title="Search failed"
              [message]="state.candidateSearchError() ?? ''"
              (retry)="state.searchRelationshipCandidates()"
            />
          }

          @if (state.relationshipCandidates().length > 0) {
            <div class="candidate-list" aria-label="Relationship candidates">
              @for (candidate of state.relationshipCandidates(); track candidate.id) {
                <button
                  type="button"
                  class="candidate-row"
                  [class.selected]="state.relationshipForm.getRawValue().targetWorkItemId === candidate.id"
                  [disabled]="state.isRelationshipReadOnly() || state.isAlreadyLinked(candidate.id)"
                  (click)="state.selectRelationshipCandidate(candidate)"
                >
                  <span>
                    <strong>{{ candidate.displayKey }} {{ candidate.title }}</strong>
                    <small>
                      {{ candidate.project.key }} · {{ candidate.project.name }} ·
                      {{ state.record.formatToken(candidate.status) }} · {{ state.record.formatToken(candidate.priority) }} ·
                      {{ candidate.assignee === null ? 'Unassigned' : state.record.memberDisplayName(candidate.assignee) }}
                    </small>
                  </span>
                  @if (state.isAlreadyLinked(candidate.id)) {
                    <span class="linked-marker">Linked</span>
                  }
                </button>
              }
            </div>
          } @else if (state.hasSearchedRelationshipCandidates()) {
            <p class="muted">No matching work items found.</p>
          }

          @if (state.relationshipCandidatesHaveMore()) {
            <p class="muted">More matches are available. Refine the search to narrow the results.</p>
          }

          @if (state.relationshipError()) {
            <app-error-panel
              title="Relationship not changed"
              [message]="state.relationshipError() ?? ''"
              (retry)="state.addRelationship()"
            />
          }

          <button type="submit" [disabled]="state.isRelationshipReadOnly() || state.isAddingRelationship()">
            {{ state.isAddingRelationship() ? 'Adding...' : state.relationshipActionLabel() }}
          </button>
        </form>
        </details>
      </section>

}`,
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

    .section-eyebrow {
      margin: 0 0 4px;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0;
      line-height: 1.3;
      text-transform: uppercase;
    }

    h3 {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    button,
.secondary-action,
.danger-action {
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

    .danger-action {
      border-color: #fecaca;
      background: #fff1f2;
      color: #991b1b;
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

.panel { border: 0; border-top: 1px solid #e5e7eb; border-radius: 0; padding: 20px 0; background: transparent; }

summary { cursor: pointer; font-weight: 700; }
.relationship-form { margin-top: 12px; }`
})
export class WorkItemDependenciesComponent {
  readonly state = inject(WorkItemRelationshipsStore);
}
