import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  CreatableProjectCycleStatus,
  CreateProjectCycleRequest,
  MilestoneDto,
  MilestoneStatus,
  MutableProjectCycleStatus,
  ProjectCycleDto,
  ProjectCycleStatus,
  ProjectDto,
  ProjectPlanningSummaryDto
} from '@worktrail/contracts';
import { Subscription } from 'rxjs';
import { NavigationSectionTargetDirective } from '../../shared/navigation/section-target';

import { CyclesApi } from '../../core/api/cycles-api';
import { PlanningApi } from '../../core/api/planning-api';
import { ProjectsApi } from '../../core/api/projects-api';
import { CurrentUserService } from '../../core/current-user.service';
import { PageContext } from '../../core/navigation/page-context';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import {
  CycleManagerComponent,
  type CycleUpdateRequest
} from './planning/cycle-manager.component';
import { MilestoneManagerComponent, type MilestoneUpdateRequest } from './planning/milestone-manager.component';
import { PlanningMutationState } from './planning/planning-mutation-state';
import { PlanningReviewComponent } from './planning/planning-review.component';

const milestoneStatuses: MilestoneStatus[] = ['planned', 'active', 'completed', 'canceled'];
const creatableCycleStatuses: CreatableProjectCycleStatus[] = ['planned', 'active'];
const mutableCycleStatuses: MutableProjectCycleStatus[] = ['planned', 'active', 'canceled'];
const statusOrder = new Map<MilestoneStatus, number>(
  milestoneStatuses.map((status, index) => [status, index])
);
const cycleStatusOrder = new Map<ProjectCycleStatus, number>([
  ['active', 0],
  ['planned', 1],
  ['completed', 2],
  ['canceled', 3]
]);

type PlanningView = 'review' | 'cycles' | 'milestones';
const planningViews: { value: PlanningView; label: string }[] = [
  { value: 'review', label: 'Review' },
  { value: 'cycles', label: 'Cycles' },
  { value: 'milestones', label: 'Milestones' }
];

@Component({
  selector: 'app-project-planning-page',
  imports: [
    NavigationSectionTargetDirective,
    ErrorPanelComponent,
    CycleManagerComponent,
    LoadingIndicatorComponent,
    MilestoneManagerComponent,
    PlanningReviewComponent,
    RouterLink,
  ],
  template: `
    <section [appNavigationSectionTarget]="navigationFragment()" [navigationIdentity]="navigationIdentity()" [navigationReady]="planningSummary()">

    <section class="page-header">
      <div>
        <p class="eyebrow">Planning · Live view</p>
        <h1>{{ project()?.name ?? 'Project planning' }}</h1>
        @if (project(); as project) {
          <p>
            <span class="key-pill">{{ project.key }}</span>
            <span [class.status-pill--archived]="project.status === 'archived'" class="status-pill">
              {{ project.status }}
            </span>
          </p>
        }
      </div>
      @if (project()) { <nav aria-label="Planning report links"><a [routerLink]="['/projects',projectId(),'status']">Reports</a>@if (canCreateReport()) {<a [routerLink]="['/projects',projectId(),'status','new']">Draft report</a>}</nav> }
    </section>

    @if (isLoadingProject()) {
      <app-loading-indicator label="Loading planning" />
    } @else if (projectLoadError()) {
      <app-error-panel [message]="projectLoadError() ?? ''" (retry)="loadProject()" />
    } @else if (project(); as project) {
      @if (project.status === 'archived') {
        <section class="notice" aria-label="Archived project">
          <strong>Archived project</strong>
          <p>Milestones remain readable. Reactivate the project before changing planning data.</p>
        </section>
      } @else if (!canManageMilestones()) {
        <section class="notice" aria-label="Read-only planning">
          <strong>Read-only planning</strong>
          <p>Owners and maintainers can change cycles and milestones. Contributors can review them here.</p>
        </section>
      }

      <div class="planning-view-control" role="group" aria-label="Planning view">
        @for (view of planningViews; track view.value) {
          <button
            type="button"
            [attr.aria-pressed]="selectedPlanningView() === view.value"
            (click)="setPlanningView(view.value)"
          >
            {{ view.label }}
          </button>
        }
      </div>

      <section class="planning-grid" aria-label="Planning sections">
        @if (selectedPlanningView() === 'cycles') {
          <app-cycle-manager
            [projectId]="projectId()"
            [cycleForm]="cycleForm"
            [cycles]="cycles()"
            [creatableCycleStatuses]="creatableCycleStatuses"
            [mutableCycleStatuses]="mutableCycleStatuses"
            [canManageCycles]="canManageCycles()"
            [isLoadingCycles]="isLoadingCycles()"
            [isCreatingCycle]="isCreatingCycle()"
            [hasSubmittedCycleCreate]="hasSubmittedCycleCreate()"
            [mutatingCycleId]="mutatingCycleId()"
            [cycleLoadError]="cycleLoadError()"
            [cycleCreateError]="cycleCreateError()"
            [mutationErrors]="cycleChanges.errors()" [mutationMessages]="cycleChanges.messages()" [writeBlocked]="isLoadingCycles() || isCreatingCycle() || mutatingCycleId() !== null"
            [cycleSuccessMessage]="cycleSuccessMessage()"
            (create)="createCycle()"
            (retryLoad)="loadCycles()"
            (update)="updateCycleFromRequest($event)"
            (archive)="archiveCycle($event)"
            (reactivate)="reactivateCycle($event)"
          />
        } @else if (selectedPlanningView() === 'milestones') {
          <app-milestone-manager [projectId]="projectId()" [milestoneForm]="milestoneForm" [milestones]="milestones()" [milestoneStatuses]="milestoneStatuses"
 [canManageMilestones]="canManageMilestones()" [isLoadingMilestones]="isLoadingMilestones()" [isCreatingMilestone]="isCreatingMilestone()"
 [hasSubmittedCreate]="hasSubmittedCreate()" [mutatingMilestoneId]="mutatingMilestoneId()" [milestoneLoadError]="milestoneLoadError()"
 [createError]="createError()" [successMessage]="successMessage()" [mutationErrors]="milestoneChanges.errors()" [mutationMessages]="milestoneChanges.messages()"
 [writeBlocked]="isLoadingMilestones() || isCreatingMilestone() || mutatingMilestoneId() !== null" (create)="createMilestone()" (retryLoad)="loadMilestones()"
 (update)="updateMilestoneFromRequest($event)" (archive)="archiveMilestone($event)" (reactivate)="reactivateMilestone($event)" />
        } @else {
          @if (isLoadingSummary()) { <app-loading-indicator label="Loading planning dashboard" /> }
 @else if (planningSummaryLoadError()) { <app-error-panel [message]="planningSummaryLoadError() ?? ''" (retry)="loadPlanningSummary()" /> }
 @else if (planningSummary(); as summary) { <app-planning-review [projectId]="projectId()" [summary]="summary" [canManageCycles]="canManageCycles()" [originFragment]="navigationFragment()" /> }
        }
      </section>
    }

    </section>
  `,
  styles: `
    .page-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: start;
      margin-bottom: 24px;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      color: #111827;
      line-height: 1.25;
    }

    h1 {
      margin-bottom: 8px;
      font-size: 1.75rem;
    }

    p {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    nav a,
    button {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #ffffff;
      color: #1f2937;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
    }

    nav a:hover,
    button:not(:disabled):hover {
      border-color: #94a3b8;
      background: #f8fafc;
      cursor: pointer;
    }

    button[type="submit"] {
      border-color: #1d4ed8;
      background: #2563eb;
      color: #ffffff;
    }

    button[type="submit"]:not(:disabled):hover {
      background: #1d4ed8;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .notice {
      margin-bottom: 20px;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fff7ed;
    }

    .notice strong {
      display: block;
      margin-bottom: 4px;
      color: #9a3412;
      font-size: 0.875rem;
    }

    .planning-view-control {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .planning-view-control button[aria-pressed='true'] {
      border-color: #1d4ed8;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .key-pill,
    .status-pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 8px;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .status-pill {
      margin-left: 6px;
      border-color: #bbf7d0;
      color: #166534;
    }

    .status-pill--archived {
      border-color: #cbd5e1;
      color: #64748b;
    }

    .planning-grid {
      display: block;
    }

    @media (max-width: 900px) {
      .page-header,
      .planning-grid {
        grid-template-columns: 1fr;
      }

      nav {
        justify-content: flex-start;
      }
    }
  `
})
export class ProjectPlanningPageComponent implements OnDestroy, OnInit {
  private readonly context = new PageContext();
  readonly navigationFragment = this.context.fragment;
  readonly navigationIdentity = computed(() => this.context.contextKey());
  private readonly planningApi = inject(PlanningApi);
  private readonly projectsApi = inject(ProjectsApi);
  private readonly cyclesApi = inject(CyclesApi);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();
  private projectRead = new Subscription();
  private summaryRead = new Subscription();
  private milestonesRead = new Subscription();
  private cyclesRead = new Subscription();

  readonly planningViews = planningViews;
  readonly selectedPlanningView = signal<PlanningView>('review');
  readonly milestoneStatuses = milestoneStatuses;
  readonly creatableCycleStatuses = creatableCycleStatuses;
  readonly mutableCycleStatuses = mutableCycleStatuses;
  readonly project = signal<ProjectDto | null>(null);
  readonly milestones = signal<MilestoneDto[]>([]);
  readonly cycles = signal<ProjectCycleDto[]>([]);
  readonly planningSummary = signal<ProjectPlanningSummaryDto | null>(null);
  readonly isLoadingProject = signal(false);
  readonly isLoadingMilestones = signal(false);
  readonly isLoadingCycles = signal(false);
  readonly isLoadingSummary = signal(false);
  readonly isCreatingMilestone = signal(false);
  readonly isCreatingCycle = signal(false);
  readonly milestoneChanges = new PlanningMutationState();
  readonly cycleChanges = new PlanningMutationState();
  readonly mutatingMilestoneId = this.milestoneChanges.pendingId;
  readonly mutatingCycleId = this.cycleChanges.pendingId;
  readonly hasSubmittedCreate = signal(false);
  readonly hasSubmittedCycleCreate = signal(false);
  readonly projectLoadError = signal<string | null>(null);
  readonly milestoneLoadError = signal<string | null>(null);
  readonly cycleLoadError = signal<string | null>(null);
  readonly planningSummaryLoadError = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly cycleCreateError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly cycleSuccessMessage = signal<string | null>(null);
  readonly projectId = computed(() => this.context.param('projectId'));
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');
  readonly canManageMilestones = computed(() => {
    const member = this.currentUser.selectedMember();
    return (
      member?.isActive === true && this.project()?.status === 'active' &&
      (member?.role === 'owner' || member?.role === 'maintainer')
    );
  });
  readonly canManageCycles = computed(() => this.canManageMilestones());
  readonly canCreateReport = computed(() => this.canManageMilestones());

  readonly milestoneForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    status: ['planned' as MilestoneStatus],
    targetDate: ['']
  });
  readonly cycleForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    goal: [''],
    status: ['planned' as CreatableProjectCycleStatus],
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    targetPoints: ['']
  });

  ngOnInit(): void {
    this.context.start(() => {
      this.selectedPlanningView.set('review');
      this.project.set(null);
      this.milestones.set([]);
      this.cycles.set([]);
      this.planningSummary.set(null);
      this.isLoadingProject.set(false);
      this.isLoadingMilestones.set(false);
      this.isLoadingCycles.set(false);
      this.isLoadingSummary.set(false);
      this.isCreatingMilestone.set(false);
      this.isCreatingCycle.set(false);
      this.mutatingMilestoneId.set(null);
      this.mutatingCycleId.set(null);
      this.milestoneChanges.reset();
      this.cycleChanges.reset();
      this.hasSubmittedCreate.set(false);
      this.hasSubmittedCycleCreate.set(false);
      this.projectLoadError.set(null);
      this.milestoneLoadError.set(null);
      this.cycleLoadError.set(null);
      this.planningSummaryLoadError.set(null);
      this.createError.set(null);
      this.cycleCreateError.set(null);
      this.successMessage.set(null);
      this.cycleSuccessMessage.set(null);
      this.milestoneForm.reset(undefined, { emitEvent: false });
      this.cycleForm.reset(undefined, { emitEvent: false });
      this.loadProject();
    });
    this.subscriptions.add(
      this.context.queryParamMap$.subscribe((params) => {
        const requestedView = params.get('view');
        const nextView = this.toPlanningView(requestedView);
        this.selectedPlanningView.set(nextView);

        if (requestedView !== nextView) {
          this.persistPlanningView(nextView, true);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.projectRead.unsubscribe(); this.summaryRead.unsubscribe(); this.milestonesRead.unsubscribe(); this.cyclesRead.unsubscribe();
  }

  setPlanningView(view: PlanningView): void {
    this.selectedPlanningView.set(view);
    this.persistPlanningView(view);
  }

  private persistPlanningView(view: PlanningView, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
      replaceUrl
    });
  }

  loadProject(): void {
    this.projectRead.unsubscribe();
    this.isLoadingProject.set(true);
    this.projectLoadError.set(null);
    this.projectRead = this.projectsApi.getProject(this.projectId()).pipe(this.context.guard()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.isLoadingProject.set(false);
        this.loadMilestones();
        this.loadCycles();
        this.loadPlanningSummary();
      },
      error: () => {
        this.projectLoadError.set('Project planning could not be loaded from the API.');
        this.isLoadingProject.set(false);
      }
    });
  }

  loadPlanningSummary(): void {
    this.summaryRead.unsubscribe();
    this.isLoadingSummary.set(true);
    this.planningSummaryLoadError.set(null);
    this.summaryRead = this.planningApi.getProjectPlanningSummary(this.projectId()).pipe(this.context.guard()).subscribe({
      next: (summary) => {
        this.planningSummary.set(summary);
        this.isLoadingSummary.set(false);
      },
      error: () => {
        this.planningSummaryLoadError.set('Planning dashboard could not be loaded from the API.');
        this.isLoadingSummary.set(false);
      }
    });
  }

  loadMilestones(): void {
    if (this.isCreatingMilestone() || this.mutatingMilestoneId() !== null) return;
    this.milestonesRead.unsubscribe();
    this.isLoadingMilestones.set(true);
    this.milestoneLoadError.set(null);
    this.milestonesRead = this.projectsApi.listProjectMilestones(this.projectId(), { includeArchived: true }).pipe(this.context.guard()).subscribe({
      next: (milestones) => {
        this.milestones.set(this.sortMilestones(milestones));
        this.isLoadingMilestones.set(false);
      },
      error: () => {
        this.milestoneLoadError.set('Project milestones could not be loaded from the API.');
        this.isLoadingMilestones.set(false);
      }
    });
  }

  loadCycles(): void {
    if (this.isCreatingCycle() || this.mutatingCycleId() !== null) return;
    this.cyclesRead.unsubscribe();
    this.isLoadingCycles.set(true);
    this.cycleLoadError.set(null);
    this.cyclesRead = this.cyclesApi.listCycles(this.projectId(), { includeArchived: true }).pipe(this.context.guard()).subscribe({
      next: (cycles) => {
        this.cycles.set(this.sortCycles(cycles));
        this.isLoadingCycles.set(false);
      },
      error: () => {
        this.cycleLoadError.set('Project cycles could not be loaded from the API.');
        this.isLoadingCycles.set(false);
      }
    });
  }

  createMilestone(): void {
    if (this.isLoadingMilestones() || this.isCreatingMilestone() || this.mutatingMilestoneId() !== null) return;
    this.hasSubmittedCreate.set(true);
    this.createError.set(null);

    this.successMessage.set(null);

    if (!this.canManageMilestones()) {
      this.createError.set(this.milestonePermissionMessage());
      return;
    }

    if (this.milestoneForm.invalid) {
      this.milestoneForm.markAllAsTouched();
      return;
    }

    const formValue = this.milestoneForm.getRawValue();
    this.isCreatingMilestone.set(true);
    this.projectsApi
      .createMilestone(this.projectId(), {
        name: formValue.name.trim(),
        description: formValue.description.trim(),
        status: formValue.status,
        targetDate: formValue.targetDate === '' ? null : formValue.targetDate
      }).pipe(this.context.guardMutation())
      .subscribe({
        next: (milestone) => {
          this.upsertMilestone(milestone);
          this.milestoneForm.reset({ name: '', description: '', status: 'planned', targetDate: '' });
          this.hasSubmittedCreate.set(false);
          this.isCreatingMilestone.set(false);
          this.successMessage.set('Milestone created.');
          this.loadPlanningSummary();
        },
        error: (error: unknown) => {
          this.createError.set(this.toErrorMessage(error, 'Milestone could not be created.'));
          this.isCreatingMilestone.set(false);
        }
      });
  }

  createCycle(): void {
    if (this.isLoadingCycles() || this.isCreatingCycle() || this.mutatingCycleId() !== null) return;
    this.hasSubmittedCycleCreate.set(true);
    this.cycleCreateError.set(null);

    this.cycleSuccessMessage.set(null);

    if (!this.canManageCycles()) {
      this.cycleCreateError.set(this.cyclePermissionMessage());
      return;
    }

    if (this.cycleForm.invalid) {
      this.cycleForm.markAllAsTouched();
      return;
    }

    const formValue = this.cycleForm.getRawValue();
    const fields = this.toCycleFields({
      name: formValue.name,
      goal: formValue.goal,
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      targetPoints: formValue.targetPoints
    }, 'create');

    if (fields === null) {
      return;
    }

    const request: CreateProjectCycleRequest = { ...fields, status: formValue.status };

    this.isCreatingCycle.set(true);
    this.cyclesApi.createCycle(this.projectId(), request).pipe(this.context.guardMutation()).subscribe({
      next: (cycle) => {
        this.upsertCycle(cycle);
        this.cycleForm.reset({
          name: '',
          goal: '',
          status: 'planned',
          startDate: '',
          endDate: '',
          targetPoints: ''
        });
        this.hasSubmittedCycleCreate.set(false);
        this.isCreatingCycle.set(false);
        this.cycleSuccessMessage.set('Cycle created.');
        this.loadPlanningSummary();
      },
      error: (error: unknown) => {
        this.cycleCreateError.set(this.toErrorMessage(error, 'Cycle could not be created.'));
        this.isCreatingCycle.set(false);
      }
    });
  }

  updateMilestone(
    milestone: MilestoneDto,
    name: string,
    description: string,
    status: string,
    targetDate: string
  ): void {
    if (this.isLoadingMilestones() || this.isCreatingMilestone() || this.mutatingMilestoneId() !== null) return;

    if (!this.canManageMilestones()) {
      this.milestoneChanges.fail(milestone.id, this.milestonePermissionMessage());
      return;
    }

    const nextName = name.trim();

    if (nextName === '') {
      this.milestoneChanges.fail(milestone.id, 'Milestone name is required.');
      return;
    }

    this.milestoneChanges.begin(milestone.id);
    this.projectsApi
      .updateMilestone(milestone.id, {
        name: nextName,
        description: description.trim(),
        status: status as MilestoneStatus,
        targetDate: targetDate === '' ? null : targetDate
      }).pipe(this.context.guardMutation())
      .subscribe({
        next: (updated) => {
          this.upsertMilestone(updated);
          this.milestoneChanges.succeed(milestone.id, 'Milestone saved.');
          this.loadPlanningSummary();
        },
        error: (error: unknown) => {
          this.milestoneChanges.fail(milestone.id, this.toErrorMessage(error, 'Milestone could not be saved.'));
        }
      });
  }

  updateCycle(
    cycle: ProjectCycleDto,
    name: string,
    goal: string,
    status: string,
    startDate: string,
    endDate: string,
    targetPoints: string
  ): void {
    if (this.isLoadingCycles() || this.isCreatingCycle() || this.mutatingCycleId() !== null) return;

    if (!this.canManageCycles()) {
      this.cycleChanges.fail(cycle.id, this.cyclePermissionMessage());
      return;
    }

    const fields = this.toCycleFields({
      name,
      goal,
      startDate,
      endDate,
      targetPoints
    }, cycle.id);

    if (fields === null) {
      return;
    }

    const mutableStatus = mutableCycleStatuses.find((candidate) => candidate === status);

    if (cycle.status !== 'completed' && mutableStatus === undefined) {
      this.cycleChanges.fail(cycle.id, 'Select a valid cycle status.');
      return;
    }

    const request = {
      ...fields,
      ...(cycle.status === 'completed' ? {} : { status: mutableStatus })
    };

    this.cycleChanges.begin(cycle.id);
    this.cyclesApi.updateCycle(this.projectId(), cycle.id, request).pipe(this.context.guardMutation()).subscribe({
      next: (updated) => {
        this.upsertCycle(updated);
        this.cycleChanges.succeed(cycle.id, 'Cycle saved.');
        this.loadPlanningSummary();
      },
      error: (error: unknown) => {
        this.cycleChanges.fail(cycle.id, this.toErrorMessage(error, 'Cycle could not be saved.'));
      }
    });
  }

  updateMilestoneFromRequest(request: MilestoneUpdateRequest): void {
    this.updateMilestone(request.milestone, request.name, request.description, request.status, request.targetDate);
  }

  updateCycleFromRequest(request: CycleUpdateRequest): void {
    this.updateCycle(
      request.cycle,
      request.name,
      request.goal,
      request.status,
      request.startDate,
      request.endDate,
      request.targetPoints
    );
  }

  archiveMilestone(milestone: MilestoneDto): void {
    this.runMilestoneCommand(
      milestone,
      'Milestone archived.',
      'Milestone could not be archived.',
      () => this.projectsApi.archiveMilestone(milestone.id)
    );
  }

  reactivateMilestone(milestone: MilestoneDto): void {
    this.runMilestoneCommand(
      milestone,
      'Milestone reactivated.',
      'Milestone could not be reactivated.',
      () => this.projectsApi.reactivateMilestone(milestone.id)
    );
  }

  archiveCycle(cycle: ProjectCycleDto): void {
    this.runCycleCommand(
      cycle,
      'Cycle archived.',
      'Cycle could not be archived.',
      () => this.cyclesApi.archiveCycle(this.projectId(), cycle.id)
    );
  }

  reactivateCycle(cycle: ProjectCycleDto): void {
    this.runCycleCommand(
      cycle,
      'Cycle reactivated.',
      'Cycle could not be reactivated.',
      () => this.cyclesApi.reactivateCycle(this.projectId(), cycle.id)
    );
  }

  private runMilestoneCommand(
    milestone: MilestoneDto,
    successMessage: string,
    fallbackError: string,
    command: () => ReturnType<ProjectsApi['archiveMilestone']>
  ): void {
    if (this.isLoadingMilestones() || this.isCreatingMilestone() || this.mutatingMilestoneId() !== null) return;

    if (!this.canManageMilestones()) {
      this.milestoneChanges.fail(milestone.id, this.milestonePermissionMessage());
      return;
    }

    this.milestoneChanges.begin(milestone.id);
    command().pipe(this.context.guardMutation()).subscribe({
      next: (updated) => {
        this.upsertMilestone(updated);
        this.milestoneChanges.succeed(milestone.id, successMessage);
        this.loadPlanningSummary();
      },
      error: (error: unknown) => {
        this.milestoneChanges.fail(milestone.id, this.toErrorMessage(error, fallbackError));
      }
    });
  }

  private runCycleCommand(
    cycle: ProjectCycleDto,
    successMessage: string,
    fallbackError: string,
    command: () => ReturnType<CyclesApi['archiveCycle']>
  ): void {
    if (this.isLoadingCycles() || this.isCreatingCycle() || this.mutatingCycleId() !== null) return;

    if (!this.canManageCycles()) {
      this.cycleChanges.fail(cycle.id, this.cyclePermissionMessage());
      return;
    }

    this.cycleChanges.begin(cycle.id);
    command().pipe(this.context.guardMutation()).subscribe({
      next: (updated) => {
        this.upsertCycle(updated);
        this.cycleChanges.succeed(cycle.id, successMessage);
        this.loadPlanningSummary();
      },
      error: (error: unknown) => {
        this.cycleChanges.fail(cycle.id, this.toErrorMessage(error, fallbackError));
      }
    });
  }

  private upsertMilestone(milestone: MilestoneDto): void {
    const milestonesById = new Map(this.milestones().map((item) => [item.id, item]));
    milestonesById.set(milestone.id, milestone);
    this.milestones.set(this.sortMilestones([...milestonesById.values()]));
  }

  private upsertCycle(cycle: ProjectCycleDto): void {
    const cyclesById = new Map(this.cycles().map((item) => [item.id, item]));
    cyclesById.set(cycle.id, cycle);
    this.cycles.set(this.sortCycles([...cyclesById.values()]));
  }

  private sortMilestones(milestones: MilestoneDto[]): MilestoneDto[] {
    return [...milestones].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      const statusCompare =
        (statusOrder.get(left.status) ?? 0) - (statusOrder.get(right.status) ?? 0);

      if (statusCompare !== 0) {
        return statusCompare;
      }

      const targetCompare = (left.targetDate ?? '9999-12-31').localeCompare(
        right.targetDate ?? '9999-12-31'
      );

      if (targetCompare !== 0) {
        return targetCompare;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private sortCycles(cycles: ProjectCycleDto[]): ProjectCycleDto[] {
    return [...cycles].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      const statusCompare =
        (cycleStatusOrder.get(left.status) ?? 0) - (cycleStatusOrder.get(right.status) ?? 0);

      if (statusCompare !== 0) {
        return statusCompare;
      }

      const startCompare = left.startDate.localeCompare(right.startDate);

      if (startCompare !== 0) {
        return startCompare;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private toCycleFields(
    input: {
      name: string;
      goal: string;
      startDate: string;
      endDate: string;
      targetPoints: string;
    },
    target: string
  ): Omit<CreateProjectCycleRequest, 'status'> | null {
    const name = input.name.trim();
    const startDate = input.startDate.trim();
    const endDate = input.endDate.trim();

    if (name === '') {
      this.setCycleValidationMessage('Cycle name is required.', target);
      return null;
    }

    if (startDate === '' || endDate === '') {
      this.setCycleValidationMessage('Cycle start and end dates are required.', target);
      return null;
    }

    if (startDate > endDate) {
      this.setCycleValidationMessage('Cycle start date must be on or before end date.', target);
      return null;
    }

    const targetPoints = this.parseCycleTargetPoints(input.targetPoints, target);

    if (targetPoints === undefined) {
      return null;
    }

    return {
      name,
      goal: input.goal.trim(),
      startDate,
      endDate,
      targetPoints
    };
  }

  private parseCycleTargetPoints(
    value: string,
    target: string
  ): number | null | undefined {
    const trimmed = String(value ?? '').trim();

    if (trimmed === '') {
      return null;
    }

    const parsed = Number(trimmed);

    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 999) {
      this.setCycleValidationMessage(
        'Cycle target points must be a whole number from 1 to 999.',
        target
      );
      return undefined;
    }

    return parsed;
  }

  private setCycleValidationMessage(message: string, target: string): void {
    if (target === 'create') {
      this.cycleCreateError.set(message);
      return;
    }

    this.cycleChanges.fail(target, message);
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { error?: { message?: unknown } } | null)?.error?.message;

      if (typeof message === 'string' && message.trim() !== '') {
        return message;
      }
    }

    return fallback;
  }

  private milestonePermissionMessage(): string {
    return this.isArchivedProject()
      ? 'Archived projects are read-only.'
      : 'Only owners and maintainers can manage milestones.';
  }

  private cyclePermissionMessage(): string {
    return this.isArchivedProject()
      ? 'Archived projects are read-only.'
      : 'Only owners and maintainers can manage cycles.';
  }

  private toPlanningView(value: string | null): PlanningView {
    if (value === 'cycles' || value === 'milestones') {
      return value;
    }

    return 'review';
  }
}
