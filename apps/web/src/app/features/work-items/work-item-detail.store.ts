import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators, type ValidatorFn } from '@angular/forms';
import type {
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectCycleDto,
  ProjectDto,
  UpdateWorkItemRequest,
  WorkItemDetailDto,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType
} from '@worktrail/contracts';
import { normalizeAuthoredContentSource } from '@worktrail/contracts';
import type { MonoTypeOperatorFunction } from 'rxjs';
import { Subject } from 'rxjs';
import { DraftDepartureCoordinator, draftRouteKey } from '../../core/navigation/draft-departure-coordinator';
import { DraftTracker } from '../../core/navigation/draft-tracker';

import { CyclesApi } from '../../core/api/cycles-api';
import { ProjectsApi } from '../../core/api/projects-api';
import { WorkItemsApi } from '../../core/api/work-items-api';
import { CurrentUserService } from '../../core/current-user.service';
import { PageContext } from '../../core/navigation/page-context';
import { authoredContentValidator } from '../../shared/authored-content/authored-content-validation';
import {
  authoredContentEquals,
  type AuthoredContentValue
} from '../../shared/authored-content/authored-content-value';
import { workItemFilesFragment } from './work-item-files-target';

const statuses: WorkItemStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'done',
  'canceled'
];
const types: WorkItemType[] = ['task', 'bug', 'story', 'chore'];
const priorities: WorkItemPriority[] = ['low', 'medium', 'high', 'urgent'];
const terminalStatuses = new Set<WorkItemStatus>(['done', 'canceled']);

@Injectable()
export class WorkItemDetailStore {
  readonly loaded = new Subject<void>();
  readonly isEditing = signal(false);
  private readonly invalidPlanningInputs = signal<string[]>([]);

  validatePlanningInput(field: 'estimatePoints' | 'dueDate', badInput: boolean): void {
    const control = this.detailForm.controls[field];
    this.invalidPlanningInputs.update(fields => badInput
      ? [...new Set([...fields, field])] : fields.filter(value => value !== field));
    control.updateValueAndValidity({ emitEvent: false });
    if (badInput) control.setErrors({ ...control.errors, nativeInput: true });
    this.departure.refresh();
  }
  readonly saveNotice = signal<string | null>(null);

  constructor() { effect(() => { this.isStatusTransitionReadOnly(); this.isUpdating(); this.isTransitioning(); this.syncReadOnlyState(); }); }

  openEditor(): void {
    if (this.isArchivedProject() || this.isUpdating()) return;
    this.saveNotice.set(null);
    this.isEditing.set(true);
  }

  showPlanningError(field: 'estimatePoints' | 'dueDate'): boolean {
    const control = this.detailForm.controls[field];
    return (control.invalid || this.invalidPlanningInputs().includes(field)) &&
      (control.touched || this.hasSubmittedDetail());
  }
  readonly departure = inject(DraftDepartureCoordinator);

  private readonly detailDraft = new DraftTracker(() => this.detailDraftValue());

  private detailDraftToken!: symbol;

  readonly context = new PageContext();

  private readonly projectsApi = inject(ProjectsApi);

  private readonly workItemsApi = inject(WorkItemsApi);

  private readonly cyclesApi = inject(CyclesApi);

  private readonly currentUser = inject(CurrentUserService);

  private readonly destroyRef = inject(DestroyRef);

  private nextFilesTargetGeneration = 0;

  private loadGeneration = 0;

  private descriptionBaseline: AuthoredContentValue | null = null;

  readonly descriptionEditorIdentity = signal(0);

  private readonly formBuilder = inject(FormBuilder);

  readonly statuses = statuses;

  readonly types = types;

  readonly priorities = priorities;

  readonly members = computed<MemberDto[]>(() => this.currentUser.members());

  readonly assigneeOptions = computed<MemberDto[]>(() => {
    const membersById = new Map(
      this.currentUser.activeMembers().map((member) => [member.id, member])
    );
    const currentAssignee = this.workItem()?.assignee;

    if (currentAssignee !== null && currentAssignee !== undefined) {
      membersById.set(currentAssignee.id, currentAssignee);
    }

    return [...membersById.values()].sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  });

  readonly workItemId = computed(() => this.context.param('workItemId'));

  readonly filesTargetGeneration = signal<number | null>(null);

  readonly project = signal<ProjectDto | null>(null);

  readonly workItem = signal<WorkItemDetailDto | null>(null);

  readonly selectedLabelIds = signal<string[]>([]);

  readonly isLoading = signal(false);

  readonly isUpdating = signal(false);

  readonly isTransitioning = signal(false);

  readonly hasSubmittedDetail = signal(false);

  readonly loadError = signal<string | null>(null);

  readonly updateError = signal<string | null>(null);

  readonly statusError = signal<string | null>(null);

  readonly labelLoadError = signal<string | null>(null);

  readonly milestoneLoadError = signal<string | null>(null);

  readonly cycleLoadError = signal<string | null>(null);

  readonly availableLabels = signal<LabelDto[]>([]);

  readonly availableMilestones = signal<MilestoneDto[]>([]);

  readonly availableCycles = signal<ProjectCycleDto[]>([]);

  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');

  readonly detailSelfUrl = computed(() => `/work-items/${this.workItemId()}`);

  readonly canAddChildWorkItem = computed(
    () =>
      this.workItem()?.parent === null &&
      this.workItem()?.childSummary === null &&
      !this.isArchivedProject()
  );

  readonly isTerminalWorkItem = computed(() =>
    terminalStatuses.has(this.workItem()?.status ?? 'backlog')
  );

  readonly canReopenTerminalWorkItem = computed(() => {
    const actor = this.currentUser.selectedMember();
    return actor?.role === 'owner' || actor?.role === 'maintainer';
  });

  readonly isTerminalStatusReadOnly = computed(
    () => this.isTerminalWorkItem() && !this.canReopenTerminalWorkItem()
  );

  readonly isStatusTransitionReadOnly = computed(
    () => this.isArchivedProject() || this.isTerminalStatusReadOnly()
  );

  readonly assignableLabels = computed(() =>
    this.availableLabels().filter((label) => !label.isArchived)
  );

  readonly archivedAttachedLabels = computed(() =>
    (this.workItem()?.labels ?? []).filter((label) => label.isArchived)
  );

  readonly returnTarget = computed(() => {
    const item = this.workItem();
    const fallbackPath = item === null ? '/work-items' : `/projects/${item.projectId}/work-items`;
    const parsedReturnUrl = this.parseSafeReturnUrl(
      this.context.query('returnUrl') || null
    );

    if (parsedReturnUrl !== null) {
      return {
        ...parsedReturnUrl,
        label: 'Back'
      };
    }

    return {
      path: fallbackPath,
      queryParams: null,
      label: item === null ? 'Back to work items' : 'Back to project work'
    };
  });

  readonly detailForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required]],
    descriptionContent: this.formBuilder.nonNullable.control<AuthoredContentValue>(
      { source: '', format: 'markdown_v1' },
      authoredContentValidator()
    ),
    type: ['task'],
    priority: ['medium'],
    assigneeId: [''],
    milestoneId: [''],
    cycleId: [''],
    estimatePoints: this.formBuilder.control<number | null>(null, estimateValidator),
    dueDate: ['', calendarDateValidator]
  });

  readonly statusForm = this.formBuilder.nonNullable.group({
    status: ['backlog']
  });

  loadWorkItem(): void {
    const workItemId = this.workItemId();
    const generation = ++this.loadGeneration;
    this.isLoading.set(true);
    this.loadError.set(null);

    this.workItemsApi
      .getWorkItem(workItemId)
      .pipe(this.context.guard())
      .subscribe({
        next: (workItem) => {
          if (generation !== this.loadGeneration) {
            return;
          }

          this.applyWorkItem(workItem);
          this.loaded.next();
          this.loadProject(workItem.projectId);
          this.loadProjectLabels(workItem.projectId);
          this.loadProjectMilestones(workItem.projectId);
          this.loadProjectCycles(workItem.projectId);
          this.isLoading.set(false);
        },
        error: () => {
          if (generation !== this.loadGeneration) {
            return;
          }

          this.loadError.set('Work item detail could not be loaded from the API.');
          this.isLoading.set(false);
        }
      });
  }

  updateWorkItem(): void {
    if (this.isUpdating() || this.workItem() === null) {
      return;
    }
    this.hasSubmittedDetail.set(true);
    this.updateError.set(null);
    this.saveNotice.set(null);

    if (this.detailForm.invalid || this.invalidPlanningInputs().length > 0) {
      this.detailForm.markAllAsTouched();
      return;
    }

    if (this.isArchivedProject()) {
      return;
    }

    this.isUpdating.set(true);
    this.syncReadOnlyState();
    this.workItemsApi
      .updateWorkItem(this.workItemId(), this.toUpdateRequest())
      .pipe(this.guardContext())
      .subscribe({
        next: (workItem) => {
          this.isUpdating.set(false);
          // Field saves own only edited fields, not concurrent discussion, status, files or hierarchy.
          this.workItem.update(current => current === null ? current : {
            ...current, title: workItem.title, description: workItem.description,
            descriptionFormat: workItem.descriptionFormat, type: workItem.type,
            priority: workItem.priority, assignee: workItem.assignee,
            milestone: workItem.milestone, cycle: workItem.cycle,
            labels: workItem.labels, dueDate: workItem.dueDate, estimatePoints: workItem.estimatePoints,
            updatedAt: current.updatedAt > workItem.updatedAt ? current.updatedAt : workItem.updatedAt,
            activity: current.updatedAt > workItem.updatedAt ? current.activity : workItem.activity
          });
          this.mergeAvailableLabels(workItem.labels);
          this.resetDetailForm(workItem);
          this.hasSubmittedDetail.set(false);
          this.saveNotice.set('Changes saved.');
          this.syncReadOnlyState();
        },
        error: () => {
          this.updateError.set('The work item could not be updated.');
          this.isUpdating.set(false);
          this.syncReadOnlyState();
        }
      });
  }

  discardDetailChanges(): void {
    const workItem = this.workItem();
    if (workItem !== null && !this.isUpdating() && !this.isArchivedProject()) {
      this.resetDetailForm(workItem);
      this.hasSubmittedDetail.set(false);
      this.updateError.set(null);
    }
  }

  applyParentChange(workItem: WorkItemDetailDto): void {
    if (workItem.id === this.workItemId()) {
      this.workItem.update((current) =>
        current === null ? current : {
          ...current,
          parent: workItem.parent,
          childSummary: workItem.childSummary,
          updatedAt: workItem.updatedAt,
          activity: workItem.activity
        }
      );
    }
  }

  transitionStatus(): void {
    if (this.isTransitioning()) return;
    if (this.isStatusTransitionReadOnly()) {
      if (this.isTerminalStatusReadOnly()) {
        this.statusError.set('Only owners and maintainers can reopen done or canceled work items.');
      }
      return;
    }

    const status = this.statusForm.getRawValue().status as WorkItemStatus;
    this.statusError.set(null);
    this.isTransitioning.set(true);
    this.syncReadOnlyState();

    this.workItemsApi
      .transitionWorkItem(this.workItemId(), { status })
      .pipe(this.guardContext())
      .subscribe({
        next: (workItem) => {
          this.workItem.update((current) =>
            current === null ? current : {
              ...current,
              status: workItem.status,
              boardPosition: workItem.boardPosition,
              updatedAt: workItem.updatedAt,
              activity: workItem.activity
            }
          );
          this.statusForm.reset({ status: workItem.status });
          this.isTransitioning.set(false);
          this.syncReadOnlyState();
        },
        error: () => {
          this.statusError.set('The requested status transition was rejected.');
          this.isTransitioning.set(false);
          this.syncReadOnlyState();
        }
      });
  }

  dependencyStateLabel(item: WorkItemDetailDto): string {
    const blockers = item.relationships.openBlockerCount;
    const blockedWork = item.relationships.openBlockedWorkCount;

    if (blockers > 0 && blockedWork > 0) {
      return `Blocked by ${blockers} and blocking ${blockedWork}`;
    }

    if (blockers > 0) {
      return `Blocked by ${blockers}`;
    }

    return `Blocking ${blockedWork}`;
  }

  toggleLabel(labelId: string, event: Event): void {
    if (this.isArchivedProject() || this.isUpdating()) {
      return;
    }

    this.saveNotice.set(null);
    const checked = (event.target as HTMLInputElement).checked;
    const selected = new Set(this.selectedLabelIds());

    if (checked) {
      selected.add(labelId);
    } else {
      selected.delete(labelId);
    }

    this.selectedLabelIds.set([...selected]);
  }

  isLabelSelected(labelId: string): boolean {
    return this.selectedLabelIds().includes(labelId);
  }

  loadProjectLabels(projectId: string): void {
    this.labelLoadError.set(null);

    this.projectsApi
      .listProjectLabels(projectId)
      .pipe(this.context.guard())
      .subscribe({
        next: (labels) => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.availableLabels.set(labels.filter((label) => !label.isArchived));
        },
        error: () => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.labelLoadError.set('Project labels could not be loaded from the API.');
        }
      });
  }

  loadProjectMilestones(projectId: string): void {
    this.milestoneLoadError.set(null);

    this.projectsApi
      .listProjectMilestones(projectId, { includeArchived: true })
      .pipe(this.context.guard())
      .subscribe({
        next: (milestones) => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.availableMilestones.set(this.sortMilestones(this.mergeCurrentMilestone(milestones)));
        },
        error: () => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.milestoneLoadError.set('Project milestones could not be loaded from the API.');
        }
      });
  }

  loadProjectCycles(projectId: string): void {
    this.cycleLoadError.set(null);

    this.cyclesApi
      .listCycles(projectId, { includeArchived: true })
      .pipe(this.context.guard())
      .subscribe({
        next: (cycles) => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.availableCycles.set(this.sortCycles(this.mergeCurrentCycle(cycles)));
        },
        error: () => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.cycleLoadError.set('Project cycles could not be loaded from the API.');
        }
      });
  }

  loadProject(projectId: string): void {
    this.projectsApi
      .getProject(projectId)
      .pipe(this.context.guard())
      .subscribe({
        next: (project) => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.project.set(project);
          this.syncReadOnlyState();
        },
        error: () => {
          if (this.workItem()?.projectId !== projectId) {
            return;
          }

          this.project.set(null);
          this.syncReadOnlyState();
        }
      });
  }

  showTitleError(): boolean {
    const control = this.detailForm.controls.title;
    return control.invalid && (control.touched || this.hasSubmittedDetail());
  }

  showDescriptionError(): boolean {
    const control = this.detailForm.controls.descriptionContent;
    return control.invalid && (control.touched || this.hasSubmittedDetail());
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
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

  memberDisplayName(member: MemberDto): string {
    return member.isActive ? member.name : `${member.name} (inactive)`;
  }

  private applyWorkItem(workItem: WorkItemDetailDto): void {
    this.workItem.set(workItem);
    this.mergeAvailableLabels(workItem.labels);
    this.resetDetailForm(workItem);
    this.statusForm.reset({ status: workItem.status });

    this.syncReadOnlyState();
  }

  private resetDetailForm(workItem: WorkItemDetailDto): void {
    this.invalidPlanningInputs.set([]);
    this.descriptionBaseline = { source: workItem.description, format: workItem.descriptionFormat };
    this.detailForm.controls.descriptionContent.setValidators(
      authoredContentValidator({ baseline: this.descriptionBaseline })
    );
    this.descriptionEditorIdentity.update((identity) => identity + 1);
    this.selectedLabelIds.set(
      workItem.labels.filter((label) => !label.isArchived).map((label) => label.id)
    );
    this.detailForm.reset({
      title: workItem.title,
      descriptionContent: { ...this.descriptionBaseline },
      type: workItem.type,
      priority: workItem.priority,
      assigneeId: workItem.assignee?.id ?? '',
      milestoneId: workItem.milestone?.id ?? '',
      cycleId: workItem.cycle?.id ?? '',
      estimatePoints: workItem.estimatePoints,
      dueDate: workItem.dueDate ?? ''
    });
    this.detailDraft.accept();
  }

  resetNavigationState(): void {
    this.isEditing.set(false);
    this.invalidPlanningInputs.set([]);
    this.saveNotice.set(null);
    this.descriptionBaseline = null;
    this.descriptionEditorIdentity.update((identity) => identity + 1);
    this.detailForm.controls.descriptionContent.setValidators(authoredContentValidator());
    this.project.set(null);
    this.workItem.set(null);
    this.selectedLabelIds.set([]);
    this.availableLabels.set([]);
    this.availableMilestones.set([]);
    this.availableCycles.set([]);
    this.isUpdating.set(false);
    this.isTransitioning.set(false);
    this.hasSubmittedDetail.set(false);
    this.loadError.set(null);
    this.updateError.set(null);
    this.statusError.set(null);
    this.labelLoadError.set(null);
    this.milestoneLoadError.set(null);
    this.cycleLoadError.set(null);
    this.detailForm.reset({
      title: '',
      descriptionContent: { source: '', format: 'markdown_v1' },
      type: 'task',
      priority: 'medium',
      assigneeId: '',
      milestoneId: '',
      cycleId: '', estimatePoints: null, dueDate: ''
    });
    this.statusForm.reset({ status: 'backlog' });
    this.syncReadOnlyState();
  }

  syncFilesTarget(fragment: string | null, workItemChanged: boolean): void {
    if (fragment !== workItemFilesFragment) {
      this.filesTargetGeneration.set(null);
      return;
    }

    if (workItemChanged || this.filesTargetGeneration() === null) {
      this.filesTargetGeneration.set(++this.nextFilesTargetGeneration);
    }
  }

  private toUpdateRequest(): UpdateWorkItemRequest {
    const formValue = this.detailForm.getRawValue();
    const description = formValue.descriptionContent;

    return {
      title: formValue.title.trim(),
      ...(this.descriptionBaseline !== null &&
        authoredContentEquals(description, this.descriptionBaseline)
        ? {}
        : { description: description.source, descriptionFormat: description.format }),
      type: formValue.type as WorkItemType,
      priority: formValue.priority as WorkItemPriority,
      assigneeId: formValue.assigneeId === '' ? null : formValue.assigneeId,
      milestoneId: formValue.milestoneId === '' ? null : formValue.milestoneId,
      cycleId: formValue.cycleId === '' ? null : formValue.cycleId,
      estimatePoints: formValue.estimatePoints,
      dueDate: formValue.dueDate === '' ? null : formValue.dueDate,
      labelIds: [
        ...this.selectedLabelIds(),
        ...this.archivedAttachedLabels().map((label) => label.id)
      ]
    };
  }

  private mergeCurrentMilestone(milestones: MilestoneDto[]): MilestoneDto[] {
    const current = this.workItem()?.milestone;

    if (current === null || current === undefined) {
      return milestones;
    }

    const milestonesById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
    milestonesById.set(current.id, current);
    return [...milestonesById.values()];
  }

  private mergeCurrentCycle(cycles: ProjectCycleDto[]): ProjectCycleDto[] {
    const current = this.workItem()?.cycle;

    if (current === null || current === undefined) {
      return cycles;
    }

    const cyclesById = new Map(cycles.map((cycle) => [cycle.id, cycle]));
    cyclesById.set(current.id, current);
    return [...cyclesById.values()];
  }

  private sortMilestones(milestones: MilestoneDto[]): MilestoneDto[] {
    return [...milestones].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private sortCycles(cycles: ProjectCycleDto[]): ProjectCycleDto[] {
    return [...cycles].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate);
      }

      return left.name.localeCompare(right.name);
    });
  }

  private mergeAvailableLabels(labels: LabelDto[]): void {
    const labelsById = new Map(this.availableLabels().map((label) => [label.id, label]));

    for (const label of labels) {
      labelsById.set(label.id, label);
    }

    this.availableLabels.set(
      [...labelsById.values()].sort((left, right) => left.name.localeCompare(right.name))
    );
  }

  private syncReadOnlyState(): void {
    const options = { emitEvent: false };
    if (this.isArchivedProject() || this.isUpdating()) this.detailForm.disable(options);
    else this.detailForm.enable(options);
    if (this.isStatusTransitionReadOnly() || this.isTransitioning()) this.statusForm.disable(options);
    else this.statusForm.enable(options);
  }

  guardContext<T>(isOperationCurrent: () => boolean = () => true): MonoTypeOperatorFunction<T> {
    return this.context.guardMutation(isOperationCurrent);
  }

  private parseSafeReturnUrl(rawReturnUrl: string | null): {
    path: string;
    queryParams: Record<string, string> | null;
  } | null {
    if (rawReturnUrl === null || rawReturnUrl.trim() === '') {
      return null;
    }

    if (
      !rawReturnUrl.startsWith('/') ||
      rawReturnUrl.startsWith('//') ||
      /^[a-z][a-z0-9+.-]*:/i.test(rawReturnUrl) ||
      this.hasControlCharacter(rawReturnUrl)
    ) {
      return null;
    }

    const [pathAndQuery] = rawReturnUrl.split('#', 1);
    const [path, queryString = ''] = pathAndQuery.split('?', 2);

    if (path === '' || path.includes('\\')) {
      return null;
    }

    const parsedQueryParams: Record<string, string> = {};
    new URLSearchParams(queryString).forEach((value, key) => {
      parsedQueryParams[key] = value;
    });

    return {
      path,
      queryParams: Object.keys(parsedQueryParams).length === 0 ? null : parsedQueryParams
    };
  }

  private hasControlCharacter(value: string): boolean {
    for (const character of value) {
      const code = character.charCodeAt(0);

      if (code <= 31 || code === 127) {
        return true;
      }
    }

    return false;
  }

  requestDiscardDetailChanges(): Promise<boolean> {
    return this.departure.change(() => {
      this.discardDetailChanges();
      this.isEditing.set(false);
      this.saveNotice.set(null);
    }, [this.detailDraftToken]);
  }

  private normalizedContent(value: AuthoredContentValue): AuthoredContentValue {
    return { source: normalizeAuthoredContentSource(value.source), format: value.format };
  }

  private detailDraftValue() {
    const value = this.detailForm.getRawValue();
    return {
      ...value, invalidPlanningInputs: this.invalidPlanningInputs(), estimatePoints: value.estimatePoints === null || Number.isInteger(value.estimatePoints) ? value.estimatePoints : String(value.estimatePoints), title: value.title.trim(),
      descriptionContent: this.normalizedContent(value.descriptionContent),
      labels: [...new Set(this.selectedLabelIds())].sort()
    };
  }

  registerDrafts(): void {
    const base = {
      context: () => this.context.contextKey(),
      routeKey: () => draftRouteKey('detail', this.workItemId())
    };
    this.detailDraftToken = this.departure.register({
      ...base, category: 'Work item details',
      revision: () => this.detailDraft.revision(),
      meaningful: () => this.workItem() !== null && this.detailDraft.meaningful(),
      pending: () => this.isUpdating(), discard: () => this.discardDetailChanges()
    }, this.destroyRef);
    this.departure.register({
      ...base, category: 'Status change', revision: () => 0,
      meaningful: () => false, pending: () => this.isTransitioning(), discard: () => undefined
    }, this.destroyRef);
    this.detailForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.saveNotice.set(null); this.departure.refresh(); });
  }
}

const estimateValidator: ValidatorFn = control => {
  const value: unknown = control.value;
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647)
    ? null : { estimate: true };
};

const calendarDateValidator: ValidatorFn = control => {
  const value: string = control.value;
  if (value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { calendarDate: true };
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) > 0
    ? null : { calendarDate: true };
};
