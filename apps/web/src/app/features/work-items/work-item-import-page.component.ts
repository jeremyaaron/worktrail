import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  ProjectDto,
  WorkItemCsvImportApplyDto,
  WorkItemCsvImportErrorDto,
  WorkItemCsvImportPreviewDto,
  WorkItemCsvImportWarningDto
} from '@worktrail/contracts';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

@Component({
  selector: 'app-work-item-import-page',
  imports: [ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Import CSV</p>
        <h1>Import work items</h1>
        <p>Validate a project backlog CSV before creating work items.</p>
      </div>

      <nav aria-label="Project import navigation">
        <a class="secondary-header-action" [routerLink]="['/projects', projectId(), 'work-items']">
          List
        </a>
        <a class="secondary-header-action" [routerLink]="['/projects', projectId(), 'board']">
          Board
        </a>
      </nav>
    </section>

    @if (isProjectLoading()) {
      <app-loading-indicator label="Loading project" />
    } @else if (projectError()) {
      <app-error-panel
        title="Project unavailable"
        [message]="projectError() ?? ''"
        (retry)="loadProject()"
      />
    }

    @if (isArchivedProject()) {
      <section class="notice" aria-label="Archived project">
        <strong>Archived project</strong>
        <p>Project work is read-only until it is reactivated in settings.</p>
      </section>
    }

    @if (applyResult(); as result) {
      <section class="success-panel" aria-label="Import complete">
        <div>
          <strong>{{ result.createdCount }} work items imported</strong>
          <p>Imported work is available in the project list, board, and workspace discovery.</p>
        </div>

        <div class="success-actions">
          @for (item of result.workItems; track item.id) {
            <a [routerLink]="['/work-items', item.id]">{{ item.displayKey }}</a>
          }
          <a [routerLink]="['/projects', projectId(), 'work-items']">Project list</a>
          <a [routerLink]="['/projects', projectId(), 'board']">Board</a>
        </div>
      </section>
    }

    <section class="import-panel">
      <div class="import-panel__header">
        <div>
          <h2>CSV file</h2>
          <p>Supported file size is up to 1 MiB and 250 data rows.</p>
        </div>

        @if (selectedFileName()) {
          <span class="file-pill">{{ selectedFileName() }}</span>
        }
      </div>

      <label class="file-control">
        <span>Choose CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          [disabled]="isArchivedProject() || isPreviewLoading() || isApplyLoading()"
          (change)="onFileSelected($event)"
        />
      </label>

      @if (isPreviewLoading()) {
        <app-loading-indicator label="Validating CSV" />
      }

      @if (previewError()) {
        <app-error-panel [message]="previewError() ?? ''" />
      }

      @if (preview(); as currentPreview) {
        <section class="summary-grid" aria-label="Import summary">
          <div>
            <span>Total rows</span>
            <strong>{{ currentPreview.totalRows }}</strong>
          </div>
          <div>
            <span>Valid rows</span>
            <strong>{{ currentPreview.validRows }}</strong>
          </div>
          <div>
            <span>Invalid rows</span>
            <strong>{{ currentPreview.invalidRows }}</strong>
          </div>
        </section>

        @if (currentPreview.errors.length > 0) {
          <section class="report-section" aria-label="Import errors">
            <h2>Errors</h2>
            <div class="report-table" role="table" aria-label="Import errors">
              <div class="report-table__head" role="row">
                <span>Row</span>
                <span>Field</span>
                <span>Message</span>
              </div>
              @for (error of currentPreview.errors; track issueKey(error)) {
                <div class="report-table__row" role="row">
                  <span>{{ error.rowNumber ?? 'File' }}</span>
                  <span>{{ error.field ?? 'CSV' }}</span>
                  <span>{{ error.message }}</span>
                </div>
              }
            </div>
          </section>
        }

        @if (currentPreview.warnings.length > 0) {
          <section class="report-section" aria-label="Import warnings">
            <h2>Warnings</h2>
            <div class="report-table" role="table" aria-label="Import warnings">
              <div class="report-table__head" role="row">
                <span>Row</span>
                <span>Field</span>
                <span>Message</span>
              </div>
              @for (warning of currentPreview.warnings; track issueKey(warning)) {
                <div class="report-table__row" role="row">
                  <span>{{ warning.rowNumber ?? 'File' }}</span>
                  <span>{{ warning.field ?? 'CSV' }}</span>
                  <span>{{ warning.message }}</span>
                </div>
              }
            </div>
          </section>
        }

        @if (currentPreview.rows.length > 0) {
          <section class="report-section" aria-label="Normalized rows">
            <h2>Preview</h2>
            <div class="preview-table" role="table" aria-label="Normalized import rows">
              <div class="preview-table__head" role="row">
                <span>Row</span>
                <span>Title</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Assignee</span>
                <span>Labels</span>
              </div>
              @for (row of currentPreview.rows; track row.rowNumber) {
                <div class="preview-table__row" role="row">
                  <span>{{ row.rowNumber }}</span>
                  <span>
                    <strong>{{ row.title }}</strong>
                    <small>{{ formatToken(row.type) }}</small>
                  </span>
                  <span>{{ formatToken(row.status) }}</span>
                  <span>{{ formatToken(row.priority) }}</span>
                  <span>{{ row.assigneeEmail ?? 'Unassigned' }}</span>
                  <span>{{ row.labelNames.length === 0 ? 'None' : row.labelNames.join(', ') }}</span>
                </div>
              }
            </div>
          </section>
        }
      }

      @if (applyError()) {
        <app-error-panel [message]="applyError() ?? ''" />
      }

      <div class="actions">
        <button type="button" [disabled]="!canApply()" (click)="applyImport()">
          {{ isApplyLoading() ? 'Importing...' : 'Import work items' }}
        </button>
      </div>
    </section>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    nav,
    .success-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    a,
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
      text-decoration: none;
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .secondary-header-action,
    .success-actions a {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    .notice,
    .success-panel,
    .import-panel {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #ffffff;
    }

    .notice {
      display: grid;
      gap: 4px;
      margin-bottom: 18px;
      border-color: #fed7aa;
      padding: 14px;
      background: #fff7ed;
      color: #9a3412;
    }

    .notice p {
      color: #9a3412;
    }

    .success-panel {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 18px;
      padding: 16px;
    }

    .success-panel strong {
      color: #166534;
    }

    .import-panel {
      display: grid;
      gap: 16px;
      padding: 16px;
    }

    .import-panel__header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }

    .file-pill {
      min-height: 24px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 8px;
      background: #f8fafc;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .file-control {
      display: grid;
      gap: 6px;
      max-width: 420px;
    }

    .file-control span {
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    input[type='file'] {
      width: 100%;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 10px;
      color: #111827;
      font: inherit;
      font-size: 0.875rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .summary-grid div {
      display: grid;
      gap: 4px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #f8fafc;
    }

    .summary-grid span {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .summary-grid strong {
      color: #111827;
      font-size: 1.4rem;
    }

    .report-section {
      display: grid;
      gap: 10px;
    }

    .report-table,
    .preview-table {
      display: grid;
      overflow-x: auto;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }

    .report-table__head,
    .report-table__row,
    .preview-table__head,
    .preview-table__row {
      display: grid;
      gap: 12px;
      align-items: center;
      min-width: 760px;
      padding: 10px 12px;
    }

    .report-table__head,
    .report-table__row {
      grid-template-columns: 80px 160px minmax(320px, 1fr);
    }

    .preview-table__head,
    .preview-table__row {
      grid-template-columns: 70px minmax(220px, 1.5fr) 120px 120px minmax(180px, 1fr) minmax(180px, 1fr);
    }

    .report-table__head,
    .preview-table__head {
      border-bottom: 1px solid #e5e7eb;
      background: #f8fafc;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .report-table__row,
    .preview-table__row {
      border-bottom: 1px solid #eef2f7;
      color: #334155;
      font-size: 0.875rem;
    }

    .report-table__row:last-child,
    .preview-table__row:last-child {
      border-bottom: 0;
    }

    .preview-table__row span {
      display: grid;
      gap: 3px;
    }

    .preview-table__row strong {
      color: #111827;
    }

    .preview-table__row small {
      color: #64748b;
      font-size: 0.75rem;
      text-transform: capitalize;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
    }

    @media (max-width: 700px) {
      .page-header,
      .success-panel,
      .import-panel__header {
        flex-direction: column;
      }

      nav,
      .success-actions,
      .actions {
        justify-content: flex-start;
      }

      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class WorkItemImportPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly route = inject(ActivatedRoute);

  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly project = signal<ProjectDto | null>(null);
  readonly isProjectLoading = signal(false);
  readonly projectError = signal<string | null>(null);
  readonly selectedFileName = signal('');
  readonly csvText = signal('');
  readonly preview = signal<WorkItemCsvImportPreviewDto | null>(null);
  readonly previewError = signal<string | null>(null);
  readonly isPreviewLoading = signal(false);
  readonly applyResult = signal<WorkItemCsvImportApplyDto | null>(null);
  readonly applyError = signal<string | null>(null);
  readonly isApplyLoading = signal(false);
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');
  readonly canApply = computed(() => {
    const preview = this.preview();

    return (
      preview !== null &&
      preview.errors.length === 0 &&
      preview.validRows > 0 &&
      !this.isArchivedProject() &&
      !this.isPreviewLoading() &&
      !this.isApplyLoading()
    );
  });

  ngOnInit(): void {
    this.loadProject();
  }

  loadProject(): void {
    this.isProjectLoading.set(true);
    this.projectError.set(null);

    this.api.getProject(this.projectId()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.isProjectLoading.set(false);
      },
      error: () => {
        this.project.set(null);
        this.projectError.set('Project could not be loaded from the API.');
        this.isProjectLoading.set(false);
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file === undefined) {
      return;
    }

    void this.previewFile(file);
  }

  async previewFile(file: File): Promise<void> {
    this.selectedFileName.set(file.name);
    this.applyResult.set(null);
    this.applyError.set(null);
    this.preview.set(null);
    this.previewError.set(null);

    try {
      const csv = await file.text();
      this.csvText.set(csv);
      this.previewImport();
    } catch {
      this.csvText.set('');
      this.previewError.set('CSV file could not be read.');
    }
  }

  previewImport(): void {
    if (this.isArchivedProject() || this.csvText().trim() === '') {
      return;
    }

    this.isPreviewLoading.set(true);
    this.previewError.set(null);
    this.applyError.set(null);

    this.api.previewWorkItemCsvImport(this.projectId(), this.csvText()).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.isPreviewLoading.set(false);
      },
      error: (error: unknown) => {
        this.preview.set(null);
        this.previewError.set(this.errorMessage(error, 'CSV could not be validated.'));
        this.isPreviewLoading.set(false);
      }
    });
  }

  applyImport(): void {
    if (!this.canApply()) {
      return;
    }

    this.isApplyLoading.set(true);
    this.applyError.set(null);

    this.api.applyWorkItemCsvImport(this.projectId(), this.csvText()).subscribe({
      next: (result) => {
        this.applyResult.set(result);
        this.isApplyLoading.set(false);
      },
      error: (error: unknown) => {
        this.applyError.set(this.errorMessage(error, 'CSV import could not be applied.'));
        this.isApplyLoading.set(false);
      }
    });
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  issueKey(issue: WorkItemCsvImportErrorDto | WorkItemCsvImportWarningDto): string {
    return `${issue.rowNumber ?? 'file'}:${issue.field ?? 'csv'}:${issue.message}`;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { error?: { message?: string } } | null)?.error?.message;
      return message ?? fallback;
    }

    return fallback;
  }
}
