import { Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucidePencil } from '@lucide/angular';
import { WorkItemSectionTarget } from './work-item-section-target';
import { CurrentUserService } from '../../core/current-user.service';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { WorkItemAttachmentsComponent } from './components/work-item-attachments.component';
import { WorkItemChildWorkComponent } from './components/work-item-child-work.component';
import { WorkItemDependenciesComponent } from './components/work-item-dependencies.component';
import { WorkItemDetailEditorComponent } from './components/work-item-detail-editor.component';
import { WorkItemDetailSummaryComponent } from './components/work-item-detail-summary.component';
import { WorkItemDiscussionComponent } from './components/work-item-discussion.component';
import { WorkItemHistoryComponent } from './components/work-item-history.component';
import { WorkItemParentContextComponent } from './components/work-item-parent-context.component';
import { WorkItemParentManagerComponent } from './components/work-item-parent-manager.component';
import { WorkItemWatchComponent } from './components/work-item-watch.component';
import { WorkItemDetailStore } from './work-item-detail.store';
import { WorkItemDiscussionStore } from './work-item-discussion.store';
import { WorkItemRelationshipsStore } from './work-item-relationships.store';
import { WorkItemWatchHistoryStore } from './work-item-watch-history.store';

@Component({
  selector: 'app-work-item-detail-page',
  host: { '[attr.inert]': 'state.departure.isDeparting() ? "" : null' },
  providers: [WorkItemDetailStore, WorkItemDiscussionStore, WorkItemRelationshipsStore, WorkItemWatchHistoryStore],
  imports: [RouterLink, ReactiveFormsModule, LucidePencil, ErrorPanelComponent, LoadingIndicatorComponent, WorkItemDetailSummaryComponent, WorkItemDetailEditorComponent, WorkItemDiscussionComponent, WorkItemDependenciesComponent, WorkItemWatchComponent, WorkItemHistoryComponent, WorkItemAttachmentsComponent, WorkItemParentManagerComponent, WorkItemParentContextComponent, WorkItemChildWorkComponent],
  template: `    @if (state.isLoading()) {
      <app-loading-indicator label="Loading work item" />
    } @else if (state.loadError()) {
      <app-error-panel [message]="state.loadError() ?? ''" (retry)="state.loadWorkItem()" />
    } @else if (state.workItem(); as item) {
      <section class="detail-header">
        <div class="summary-block" aria-labelledby="work-item-summary-heading">
          <p class="section-eyebrow">Summary</p>
          <span id="work-item-summary-heading" class="visually-hidden">Work item summary</span>
          <app-work-item-detail-summary [item]="item" [project]="state.project()" />
          @if (item.parent; as parent) {
            <app-work-item-parent-context [parent]="parent" [navigationContext]="state.navigationContext()" [sourceUrl]="state.currentRecordUrl()" />
          }
        </div>

        <div class="detail-header__actions">
          <a [routerLink]="state.returnTarget().path" [queryParams]="state.returnTarget().queryParams" [fragment]="state.returnTarget().fragment ?? undefined">
            {{ state.returnTarget().label }}
          </a>
          @if (state.canAddChildWorkItem()) {
            <a
              [routerLink]="state.createChildTarget().path"
              [queryParams]="state.createChildTarget().queryParams"
            >
              Add child work item
            </a>
          }

          <button #editButton type="button" [disabled]="state.isArchivedProject() || state.isUpdating()" [attr.aria-expanded]="state.isEditing()"
            aria-controls="edit-work-item" (click)="state.openEditor()"><svg lucidePencil aria-hidden="true"></svg> Edit</button>
          <app-work-item-watch />
                    <section class="status-control" aria-labelledby="status-heading">
            <span id="status-heading" class="visually-hidden">Status</span>
            <form class="status-form" [formGroup]="state.statusForm" (ngSubmit)="state.transitionStatus()">
              <label>
                <span>Current status</span>
                <select formControlName="status">
                  @for (status of state.statuses; track status) {
                    <option [value]="status">{{ state.formatToken(status) }}</option>
                  }
                </select>
              </label>

              @if (state.statusError()) {
                <app-error-panel
                  title="Status not changed"
                  [message]="state.statusError() ?? ''"
                  (retry)="state.transitionStatus()"
                />
              }

              <button type="submit" [disabled]="state.isStatusTransitionReadOnly() || state.isTransitioning()">
                {{ state.isTransitioning() ? 'Updating...' : 'Update status' }}
              </button>
            </form>
          </section>

        </div>
      </section>

      @if (state.isArchivedProject()) {
        <section class="notice" aria-label="Archived project">
          <strong>Archived project</strong>
          <p>Project work is read-only until it is reactivated in settings.</p>
        </section>
      } @else if (state.isTerminalStatusReadOnly()) {
        <section class="notice" aria-label="Terminal work item">
          <strong>Terminal work item</strong>
          <p>Only owners and maintainers can reopen done or canceled work items.</p>
        </section>
      }

      @if (item.relationships.openBlockerCount > 0 || item.relationships.openBlockedWorkCount > 0) {
        <section class="dependency-alert" aria-label="Dependency state">
          <strong>{{ state.dependencyStateLabel(item) }}</strong>
          <p>
            Review dependencies before changing status or publishing updates that reference this
            work.
          </p>
        </section>
      }

      <div class="hierarchy">
        @if (!state.isArchivedProject() && item.childSummary === null) {
          <details><summary>{{ item.parent === null ? 'Set parent' : 'Change parent' }}</summary>
            <app-work-item-parent-manager [item]="item" [readOnly]="state.isArchivedProject()" (parentChanged)="state.applyParentChange($event)" />
          </details>
        }
        @if (item.childSummary !== null) {
          <app-work-item-child-work [navigationContext]="state.navigationContext()" [sourceUrl]="state.currentRecordUrl()" [item]="item" [readOnly]="state.isArchivedProject()" />
        }
      </div>
      <app-work-item-detail-editor (closed)="editButton.focus()" />
      <nav class="section-nav" aria-label="Work item sections">
        <a [routerLink]="[]" fragment="discussion" queryParamsHandling="preserve" (click)="scrollToSection('discussion')">Discussion <span>{{ item.comments.length }}</span></a>
        <a [routerLink]="[]" fragment="files" queryParamsHandling="preserve" (click)="scrollToSection('files')">Files</a>
        <a [routerLink]="[]" fragment="dependencies" queryParamsHandling="preserve" (click)="scrollToSection('dependencies')">Dependencies</a>
        <a [routerLink]="[]" fragment="history" queryParamsHandling="preserve" (click)="scrollToSection('history')">History</a>
      </nav>
      <app-work-item-discussion />
      <app-work-item-attachments [workItemId]="item.id" [focusWhenSettled]="state.filesTargetGeneration()" (activityChanged)="watch.refreshAttachmentActivity()" />
      <app-work-item-dependencies />
      <app-work-item-history />
      <details class="metadata-disclosure"><summary>Record information</summary>
        <dl><dt>Reporter</dt><dd>{{ state.memberDisplayName(item.reporter) }}</dd>
          <dt>Created</dt><dd>{{ state.formatDateTime(item.createdAt) }}</dd>
          <dt>Updated</dt><dd>{{ state.formatDateTime(item.updatedAt) }}</dd></dl>
      </details>
    }
`,
  styles: `
    :host { display: block; min-width: 0; }
    .detail-header { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 28px; margin-bottom: 16px; }
    .detail-header__actions { display: flex; flex-direction: column; align-items: stretch; gap: 10px; }
    .detail-header__actions > a, button { min-height: 38px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: white; color: #1f2937; font: inherit; font-size: .875rem; font-weight: 700; text-decoration: none; cursor: pointer; }
    button { display: flex; align-items: center; justify-content: center; gap: 8px; }
    svg { width: 16px; height: 16px; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .status-control, .status-form { display: grid; gap: 8px; }
    label { display: grid; gap: 6px; font-size: .8125rem; font-weight: 700; }
    select { width: 100%; min-height: 38px; border: 1px solid #cbd5e1; border-radius: 6px; background: white; padding: 8px; font: inherit; }
    .notice, .dependency-alert { border-left: 3px solid #d97706; padding: 10px 14px; margin: 14px 0; background: #fffbeb; font-size: .875rem; }
    .notice p, .dependency-alert p { margin: 4px 0 0; }
    .hierarchy { margin: 16px 0; }
    .hierarchy summary, .metadata-disclosure summary { cursor: pointer; font-size: .875rem; font-weight: 700; padding: 8px 0; }
    .section-nav { display: flex; flex-wrap: wrap; gap: 4px 20px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 12px 0; }
    .section-nav a { font-size: .875rem; font-weight: 700; color: #1f4f99; }
    .section-nav span { color: #64748b; }
    .section-eyebrow { display: none; }
    .metadata-disclosure { border-top: 1px solid #e5e7eb; }
    .metadata-disclosure dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 18px; font-size: .8125rem; }
    .metadata-disclosure dd { margin: 0; overflow-wrap: anywhere; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    @media (max-width: 760px) {
      .detail-header { grid-template-columns: minmax(0, 1fr); gap: 16px; }
      .detail-header__actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
      .status-control { grid-column: 1 / -1; }
      .status-form { grid-template-columns: minmax(0, 1fr) auto; align-items: end; }
      .status-form app-error-panel { grid-column: 1 / -1; }
    }
  `
})
export class WorkItemDetailPageComponent implements OnInit {
  readonly state = inject(WorkItemDetailStore);
  readonly discussion = inject(WorkItemDiscussionStore);
  readonly relationships = inject(WorkItemRelationshipsStore);
  readonly watch = inject(WorkItemWatchHistoryStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly sectionTarget = new WorkItemSectionTarget(this.state, this.host);
  private readonly currentUser = inject(CurrentUserService);
  private readonly destroyRef = inject(DestroyRef);

  scrollToSection(id: 'discussion' | 'files' | 'dependencies' | 'history'): void {
    this.sectionTarget.repeat(id);
  }

  ngOnInit(): void {
    this.state.registerDrafts();
    this.discussion.registerDrafts();
    this.relationships.registerDrafts();
    this.watch.registerDrafts();
    if (this.currentUser.members().length === 0) this.currentUser.loadMembers();
    this.state.loaded.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.watch.loadWatchState());
    this.state.context.start(() => {
      this.discussion.reset();
      this.relationships.reset();
      this.watch.reset();
      this.state.resetNavigationState();
      this.state.syncFilesTarget(this.state.context.fragment(), true);
      this.state.loadWorkItem();
    });
    this.state.context.routeState$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ fragment }) => this.state.syncFilesTarget(fragment, false));
  }
}
