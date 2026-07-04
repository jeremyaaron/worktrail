import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  CreateWorkItemRequest,
  MemberDto,
  WorkItemPriority,
  WorkItemType
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';

const types: WorkItemType[] = ['task', 'bug', 'story', 'chore'];
const priorities: WorkItemPriority[] = ['low', 'medium', 'high', 'urgent'];

@Component({
  selector: 'app-work-item-create-page',
  imports: [ErrorPanelComponent, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Create work item</p>
        <h1>New project work item</h1>
        <p>Capture a scoped task, bug, story, or chore for this project.</p>
      </div>

      <a [routerLink]="['/projects', projectId(), 'work-items']">Back to list</a>
    </section>

    <form class="work-item-form" [formGroup]="workItemForm" (ngSubmit)="createWorkItem()" novalidate>
      <label for="work-item-title">Title</label>
      <input
        id="work-item-title"
        type="text"
        formControlName="title"
        autocomplete="off"
        [attr.aria-invalid]="showTitleError()"
        aria-describedby="work-item-title-error"
      />
      @if (showTitleError()) {
        <p id="work-item-title-error" class="field-error">Title is required.</p>
      }

      <label for="work-item-description">Description</label>
      <textarea id="work-item-description" rows="5" formControlName="description"></textarea>

      <div class="form-grid">
        <label>
          <span>Type</span>
          <select formControlName="type">
            @for (type of types; track type) {
              <option [value]="type">{{ formatToken(type) }}</option>
            }
          </select>
        </label>

        <label>
          <span>Priority</span>
          <select formControlName="priority">
            @for (priority of priorities; track priority) {
              <option [value]="priority">{{ formatToken(priority) }}</option>
            }
          </select>
        </label>

        <label>
          <span>Assignee</span>
          <select formControlName="assigneeId">
            <option value="">Unassigned</option>
            @for (member of members(); track member.id) {
              <option [value]="member.id">{{ member.name }}</option>
            }
          </select>
        </label>

        <label>
          <span>Due date</span>
          <input type="date" formControlName="dueDate" />
        </label>

        <label>
          <span>Estimate</span>
          <input type="number" min="0" step="1" formControlName="estimatePoints" />
        </label>
      </div>

      @if (createError()) {
        <app-error-panel
          title="Work item not created"
          [message]="createError() ?? ''"
          (retry)="createWorkItem()"
        />
      }

      <div class="form-actions">
        <button type="submit" [disabled]="isCreating()">
          {{ isCreating() ? 'Creating...' : 'Create work item' }}
        </button>
        <a [routerLink]="['/projects', projectId(), 'work-items']">Cancel</a>
      </div>
    </form>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .page-header > a,
    .form-actions a {
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 14px;
      color: #1f2937;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
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
    p {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    .page-header p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .work-item-form {
      display: grid;
      gap: 12px;
      max-width: 820px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
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
      outline-offset: 0;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .field-error {
      color: #b91c1c;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    .form-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 4px;
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
      opacity: 0.64;
    }

    @media (max-width: 760px) {
      .page-header,
      .form-actions {
        align-items: stretch;
        flex-direction: column;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class WorkItemCreatePageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly types = types;
  readonly priorities = priorities;
  readonly members = computed<MemberDto[]>(() => this.currentUser.members());
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly isCreating = signal(false);
  readonly hasSubmitted = signal(false);
  readonly createError = signal<string | null>(null);

  readonly workItemForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    type: ['task'],
    priority: ['medium'],
    assigneeId: [''],
    dueDate: [''],
    estimatePoints: ['']
  });

  ngOnInit(): void {
    if (this.currentUser.members().length === 0) {
      this.currentUser.loadMembers();
    }
  }

  createWorkItem(): void {
    this.hasSubmitted.set(true);
    this.createError.set(null);

    if (this.workItemForm.invalid) {
      this.workItemForm.markAllAsTouched();
      return;
    }

    this.isCreating.set(true);
    this.api.createWorkItem(this.projectId(), this.toRequest()).subscribe({
      next: (workItem) => {
        void this.router.navigate(['/work-items', workItem.id]);
      },
      error: () => {
        this.createError.set('The work item could not be created.');
        this.isCreating.set(false);
      }
    });
  }

  showTitleError(): boolean {
    const control = this.workItemForm.controls.title;
    return control.invalid && (control.touched || this.hasSubmitted());
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  private toRequest(): CreateWorkItemRequest {
    const formValue = this.workItemForm.getRawValue();
    const estimate = this.normalizeEstimate(formValue.estimatePoints);

    return {
      title: formValue.title.trim(),
      description: formValue.description.trim(),
      type: formValue.type as WorkItemType,
      priority: formValue.priority as WorkItemPriority,
      assigneeId: formValue.assigneeId === '' ? null : formValue.assigneeId,
      dueDate: formValue.dueDate === '' ? null : formValue.dueDate,
      estimatePoints: estimate === '' ? null : Number.parseInt(estimate, 10)
    };
  }

  private normalizeEstimate(value: string | number): string {
    return typeof value === 'number' ? value.toString() : value.trim();
  }
}
