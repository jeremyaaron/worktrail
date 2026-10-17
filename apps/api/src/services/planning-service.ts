import type { ProjectPlanningCycleSummaryDto, ProjectPlanningSummaryDto } from '@worktrail/contracts';
import { assertPersistence, type Persistence } from '../repositories/persistence.js';
import type { ActorContext } from '../domain/actor.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Project, ProjectCycle, WorkItemEvaluation } from '../repositories/types.js';
import { DeliveryHealthService } from './delivery-health-service.js';
import { toProjectCycleDto, toProjectDto } from './dto.js';
import { createCycleEvaluation } from './cycle-review-model.js';
import { toProjectCycleCloseoutDto } from './project-cycle-closeout-mapper.js';
import { selectMilestoneReviewRiskSections, riskContextFromEvaluation, loadRiskReferences, enrichRiskItems } from './work-risk-sections.js';

export interface PlanningServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  persistence: Persistence;
  clock?: () => Date;
}

export class PlanningService {
  private readonly clock: () => Date;

  constructor(private readonly context: PlanningServiceContext) {
    assertPersistence(context.persistence);
    this.clock = context.clock ?? (() => new Date());
  }

  async getProjectPlanningSummary(projectId: string): Promise<ProjectPlanningSummaryDto> {
    return this.context.persistence.readConsistent(scope =>
      new PlanningService({ ...this.context, ...scope }).getProjectPlanningSummaryInScope(projectId)
    );
  }

  private async getProjectPlanningSummaryInScope(projectId: string): Promise<ProjectPlanningSummaryDto> {
    const project = await this.requireProject(projectId);
    const now = this.clock();
    const workItems = await this.context.repositories.workItems.listEvaluationByProject(projectId);
    const evaluationContext = riskContextFromEvaluation(workItems, now);
    const milestones = await this.context.repositories.milestones.listByProject(projectId, { includeArchived: true });
    const cycles = await this.context.repositories.projectCycles.listByProject(projectId);
    const activeCycle = cycles.find(cycle => cycle.status === 'active') ?? null;
    const upcomingCycle = cycles.find(cycle => cycle.status === 'planned' && cycle.startDate >= evaluationContext.today) ?? null;
    const recentlyCompletedCycle = cycles.filter(cycle => cycle.status === 'completed' && cycle.endDate <= evaluationContext.today)
      .sort((left, right) => right.endDate.localeCompare(left.endDate) || left.name.localeCompare(right.name))[0] ?? null;
    const health = new DeliveryHealthService().derive({
      project, workItems, milestones, now, evaluationContext,
      dependencyBlockedWorkItems: workItems.filter(item => item.dependencyBlocked),
      blockingOpenWorkItems: workItems.filter(item => item.blockingOpenWork)
    });
    // Selection is pure and precedes every member/milestone/parent enrichment read.
    const sections = selectMilestoneReviewRiskSections({ workItems, context: evaluationContext });
    const references = await loadRiskReferences(sections.flatMap(section => section.items), this.context.repositories);
    const preview = (type: typeof sections[number]['type']) => enrichRiskItems(sections.find(section => section.type === type)!.items, references);

    return {
      project: toProjectDto(project),
      deliveryHealth: health.deliveryHealth,
      milestoneProgress: health.milestoneProgress,
      planningReview: health.planningReview,
      activeCycle: await this.toCycleSummary(activeCycle, workItems, evaluationContext),
      upcomingCycle: await this.toCycleSummary(upcomingCycle, workItems, evaluationContext),
      recentlyCompletedCycle: await this.toCycleSummary(recentlyCompletedCycle, workItems, evaluationContext),
      blockedWork: preview('blocked'),
      overdueWork: preview('overdue'),
      dueSoonWork: preview('due_soon'),
      unassignedActiveWork: preview('unassigned_active'),
      staleInProgressWork: preview('stale_in_progress'),
      dependencyBlockedWork: preview('dependency_blocked'),
      blockingOpenWork: preview('blocking_open_work')
    };
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.context.repositories.projects.findById(projectId);
    if (project === null || project.workspaceId !== this.context.actor.workspaceId) throw new NotFoundError('Project not found.');
    return project;
  }

  private async toCycleSummary(
    cycle: ProjectCycle | null, workItems: WorkItemEvaluation[],
    context: ReturnType<typeof riskContextFromEvaluation>
  ): Promise<ProjectPlanningCycleSummaryDto | null> {
    if (cycle === null) return null;
    const scoped = workItems.filter(item => item.cycleId === cycle.id);
    const evaluation = createCycleEvaluation({ cycle, scopedWorkItems: scoped, context });
    const record = cycle.status === 'completed'
      ? await this.context.repositories.projectCycleCloseouts.findByCycleId(cycle.id) : null;
    const closeout = record === null ? null : await toProjectCycleCloseoutDto({
      closeout: record, repositories: this.context.repositories,
      expected: { workspaceId: cycle.workspaceId, projectId: cycle.projectId, cycleId: cycle.id }
    });
    return {
      cycle: toProjectCycleDto(cycle), progress: evaluation.progress, health: evaluation.health,
      scopedWorkQuery: { cycleId: cycle.id, sort: 'priority_desc' },
      closeout: closeout === null ? null : {
        closedAt: closeout.closedAt, closedBy: { id: closeout.closedBy.id, name: closeout.closedBy.name },
        counts: closeout.snapshot.counts, destination: closeout.snapshot.destination
      }
    };
  }
}
