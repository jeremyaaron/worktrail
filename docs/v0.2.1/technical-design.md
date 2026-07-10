# Worktrail v0.2.1 Technical Design

## Summary

v0.2.1 adds project cycle planning: project-scoped, methodology-neutral execution windows that can be assigned to work items, filtered in Work views, reviewed from Planning, and included in project report snapshots.

The release introduces:

- a `project_cycles` relational table;
- an optional `cycle_id` on work items;
- contract-owned cycle DTOs and cycle review DTOs;
- transport-neutral API handlers for cycle management and review;
- work item create/update/list/bulk support for cycle assignment;
- cycle-aware work item query serialization, saved views, pinned views, copy links, return URLs, and CSV export;
- Angular Planning integration and a cycle review route under the project shell;
- optional active cycle snapshot data in generated project reports;
- deterministic seed data and browser coverage.

The release also carries the already-committed `/work-items/:id` same-route navigation reliability fix as a v0.2.1 bugfix.

## Resolved Decisions

### User-Facing Name

Use `Cycle`.

Rationale:

- it is methodology-neutral;
- it avoids forcing Scrum terminology;
- it is short enough for labels, filters, and headings;
- users can name cycles "Sprint 14" or "QA hardening" if their team prefers.

### Route Shape

Use a full project-shell child route:

```text
/projects/:projectId/cycles/:cycleId
```

Rationale:

- cycle review is a shareable planning object, like milestone review;
- the route remains readable and reloadable;
- the existing project shell keeps project context visible;
- a full route is simpler than a drawer or query-backed Planning tab state.

### Planning Placement

Add cycle summary to the existing Planning Review view and add cycle management to the existing Planning `Milestones` management area as a new `Cycles` section.

Do not add a top-level project nav item for Cycles in v0.2.1.

Rationale:

- cycles are planning objects, not a separate application area;
- project shell nav is already balanced after v0.2.0;
- Planning can introduce the current/upcoming cycle and link to detailed review without becoming a separate cycle dashboard.

### Lifecycle Validation

Enforce:

- at most one active cycle per project at the database level;
- no overlapping non-archived `planned` or `active` cycle date ranges at the service level.

Completed and canceled cycles remain readable. The service does not block historical completed/canceled cycles from overlapping because imported or corrected history may be imperfect, and v0.2.1 does not include administrative delete/merge tooling.

### Report Snapshot Compatibility

Keep `ProjectStatusReportSnapshotDto.snapshotVersion` at `1` and add optional cycle snapshot data.

Rationale:

- existing reports remain valid without migration;
- new reports can include active cycle data;
- the v0.2.0 snapshot parser already supports explicit runtime validation;
- a snapshot version bump should be reserved for breaking shape changes, not additive optional sections.

### CSV Policy

CSV export includes cycle information. CSV import does not assign cycles in v0.2.1.

Rationale:

- export must reflect visible/listed work accurately;
- cycle assignment requires project-scoped validation and introduces migration concerns for portable CSVs;
- users can still bulk assign imported work after import;
- import support can be added later once cycle naming and migration use cases are clearer.

### Capacity Scope

Use optional integer `targetPoints` on cycles and existing `estimatePoints` on work items.

Do not add per-member capacity, velocity, burndown, or forecasting in v0.2.1.

## Current Architecture

Relevant existing backend pieces:

- `apps/api/src/db/schema.ts`
  - Drizzle/Postgres schema definitions.
- `apps/api/drizzle/`
  - committed SQL migrations.
- `apps/api/src/domain/constants.ts`
  - enum-style domain constants and exported literal types.
- `apps/api/src/endpoints/`
  - transport-neutral endpoint handlers.
- `apps/api/src/adapters/express/routes/`
  - local Express route registration.
- `apps/api/src/repositories/`
  - persistence access.
- `apps/api/src/services/work-item-service.ts`
  - work item create/update/list/bulk behavior.
- `apps/api/src/services/planning-service.ts`
  - project Planning summary read model.
- `apps/api/src/services/milestone-review-service.ts`
  - derived review-page pattern for planning objects.
- `apps/api/src/services/work-risk-sections.ts`
  - shared risk-section definitions and item assembly.
- `apps/api/src/services/project-status-report-service.ts`
  - draft, publish, snapshot, and detail behavior.
- `apps/api/src/validation/project-status-report-snapshot.ts`
  - runtime validation for persisted report snapshots.

Relevant existing frontend pieces:

- `apps/web/src/app/app.routes.ts`
  - standalone lazy Angular routes.
- `apps/web/src/app/features/projects/project-shell/project-shell.component.ts`
  - persistent project shell.
- `apps/web/src/app/features/projects/project-planning-page.component.ts`
  - Planning Review and Milestones management.
- `apps/web/src/app/features/projects/project-milestone-review-page.component.ts`
  - route-backed derived review page pattern.
- `apps/web/src/app/features/work-items/work-item-list-page.component.ts`
  - project Work page and bulk edit mode.
- `apps/web/src/app/features/work-items/workspace-work-item-list-page.component.ts`
  - workspace-wide Work Items discovery.
- `apps/web/src/app/features/work-items/work-item-create-page.component.ts`
  - global and project-scoped create flow.
- `apps/web/src/app/features/work-items/work-item-detail-page.component.ts`
  - work item edit/detail/collaboration surface.
- `apps/web/src/app/features/work-items/query/`
  - work item query serialization and filter labels.
- `apps/web/src/app/features/work-items/state/`
  - work-list query, saved-view, and bulk triage stores.
- `apps/web/src/app/core/api/`
  - domain API clients.

Relevant shared contracts:

- `packages/contracts/src/work-items.ts`
- `packages/contracts/src/planning.ts`
- `packages/contracts/src/projects.ts`
- `packages/contracts/src/index.ts`

## Data Model

### Domain Constants

Add cycle statuses to `apps/api/src/domain/constants.ts`:

```ts
export const projectCycleStatuses = ['planned', 'active', 'completed', 'canceled'] as const;
export type ProjectCycleStatus = (typeof projectCycleStatuses)[number];
```

The contract package should define the public type independently:

```ts
export type ProjectCycleStatus = 'planned' | 'active' | 'completed' | 'canceled';
```

### `project_cycles`

Add `project_cycles` to `apps/api/src/db/schema.ts`.

Proposed columns:

```ts
export const projectCycles = pgTable(
  'project_cycles',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    goal: text('goal').notNull().default(''),
    status: text('status').$type<ProjectCycleStatus>().notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    targetPoints: integer('target_points'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archivedById: uuid('archived_by_id').references(() => members.id),
    ...timestamps
  },
  (table) => [
    check('project_cycles_status_check', enumCheckSql('status', projectCycleStatuses)),
    check('project_cycles_date_range_check', sql`${table.startDate} <= ${table.endDate}`),
    check(
      'project_cycles_target_points_check',
      sql`${table.targetPoints} is null or ${table.targetPoints} > 0`
    ),
    index('project_cycles_workspace_id_idx').on(table.workspaceId),
    index('project_cycles_project_id_status_idx').on(table.projectId, table.status),
    index('project_cycles_project_id_start_date_idx').on(table.projectId, table.startDate),
    index('project_cycles_project_id_archived_at_idx').on(table.projectId, table.archivedAt),
    uniqueIndex('project_cycles_project_id_active_unique')
      .on(table.projectId)
      .where(sql`${table.status} = 'active' and ${table.archivedAt} is null`),
    uniqueIndex('project_cycles_project_id_active_name_unique')
      .on(table.projectId, sql`lower(${table.name})`)
      .where(sql`${table.archivedAt} is null`)
  ]
);
```

Name uniqueness mirrors milestones and prevents duplicate active cycle names within a project.

### `work_items.cycle_id`

Add nullable `cycle_id` to `work_items`:

```ts
cycleId: uuid('cycle_id').references(() => projectCycles.id),
```

Add indexes:

```ts
index('work_items_project_id_cycle_id_idx').on(table.projectId, table.cycleId),
index('work_items_workspace_id_cycle_id_idx').on(table.workspaceId, table.cycleId)
```

Same-project validation cannot be fully expressed with a simple foreign key because `cycle_id` only references the cycle id. The service layer must validate:

- the cycle exists;
- the cycle belongs to the actor workspace;
- the cycle belongs to the same project as the work item;
- the cycle is not archived for new assignments.

### Migration

Generate a new Drizzle migration under `apps/api/drizzle/`.

Expected SQL behavior:

- create `project_cycles`;
- add `cycle_id` to `work_items`;
- add indexes and checks;
- add partial unique index for one active cycle per project;
- existing work items keep `cycle_id = null`;
- no report snapshot migration is required.

## Contracts

### New `cycles.ts`

Add `packages/contracts/src/cycles.ts`.

```ts
import type { DeliveryHealthReasonDto, DeliveryHealthState } from './health.js';
import type { MemberDto } from './members.js';
import type { ProjectDto } from './projects.js';
import type {
  WorkItemPriority,
  WorkItemQuery,
  WorkItemStatus
} from './work-items.js';
import type { PlanningRiskItemDto } from './planning.js';

export type ProjectCycleStatus = 'planned' | 'active' | 'completed' | 'canceled';

export interface ProjectCycleDto {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  goal: string;
  status: ProjectCycleStatus;
  startDate: string;
  endDate: string;
  targetPoints: number | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectCycleRequest {
  name: string;
  goal?: string;
  status?: ProjectCycleStatus;
  startDate: string;
  endDate: string;
  targetPoints?: number | null;
}

export interface UpdateProjectCycleRequest {
  name?: string;
  goal?: string;
  status?: ProjectCycleStatus;
  startDate?: string;
  endDate?: string;
  targetPoints?: number | null;
}
```

### Cycle Review DTOs

Add:

```ts
export type CycleReviewRiskType =
  | 'blocked'
  | 'dependency_blocked'
  | 'overdue'
  | 'due_soon'
  | 'unassigned_active'
  | 'stale_in_progress'
  | 'blocking_open_work';

export interface CycleReviewProgressDto {
  totalCount: number;
  openCount: number;
  doneCount: number;
  blockedCount: number;
  dependencyBlockedCount: number;
  committedEstimatePoints: number;
  completedEstimatePoints: number;
  unestimatedCount: number;
  targetPoints: number | null;
}

export interface CycleReviewScopeBreakdownDto {
  statusCounts: Record<WorkItemStatus, number>;
  priorityCounts: Record<WorkItemPriority, number>;
  assignedCount: number;
  unassignedCount: number;
  dueDate: {
    overdueCount: number;
    dueSoonCount: number;
    laterCount: number;
    noneCount: number;
  };
  dependency: {
    dependencyBlockedCount: number;
    blockingOpenWorkCount: number;
  };
}

export interface CycleReviewRiskSectionDto {
  type: CycleReviewRiskType;
  title: string;
  description: string;
  count: number;
  query: WorkItemQuery;
  items: PlanningRiskItemDto[];
}

export interface ProjectCycleReviewDto {
  project: ProjectDto;
  cycle: ProjectCycleDto;
  progress: CycleReviewProgressDto;
  health: {
    health: DeliveryHealthState;
    reasons: DeliveryHealthReasonDto[];
  };
  scopedWorkQuery: WorkItemQuery;
  scopeBreakdown: CycleReviewScopeBreakdownDto;
  riskSections: CycleReviewRiskSectionDto[];
  recentlyChangedWork: PlanningRiskItemDto[];
}
```

Health should be derived with simple explainable rules in v0.2.1:

- `complete` when the cycle is completed;
- `inactive` when canceled or archived;
- `blocked` when blocked/dependency-blocked work exists in an active cycle;
- `at_risk` when active/planned cycle has overdue, stale, unassigned active, or over-target work;
- `on_track` otherwise.

Use existing `DeliveryHealthState` labels, but keep cycle health derivation local to cycles so it does not silently alter project/milestone health formulas.

### Planning DTO Extension

Extend `ProjectPlanningSummaryDto` in `planning.ts`:

```ts
export interface ProjectPlanningCycleSummaryDto {
  cycle: ProjectCycleDto;
  progress: CycleReviewProgressDto;
  health: {
    health: DeliveryHealthState;
    reasons: DeliveryHealthReasonDto[];
  };
  scopedWorkQuery: WorkItemQuery;
}

export interface ProjectPlanningSummaryDto {
  // existing fields...
  activeCycle: ProjectPlanningCycleSummaryDto | null;
  upcomingCycle: ProjectPlanningCycleSummaryDto | null;
  recentlyCompletedCycle: ProjectPlanningCycleSummaryDto | null;
}
```

### Work Item DTO Extension

Add cycle to work item DTOs:

```ts
export interface WorkItemListItemDto {
  // existing fields...
  cycle: ProjectCycleDto | null;
}
```

Extend requests:

```ts
export interface CreateWorkItemRequest {
  // existing fields...
  cycleId?: string | null;
}

export interface UpdateWorkItemRequest {
  // existing fields...
  cycleId?: string | null;
}
```

Extend `WorkItemQuery`:

```ts
cycleId?: string;
```

Extend `BulkUpdateWorkItemsAction`:

```ts
| { type: 'set_cycle'; cycleId: string }
| { type: 'clear_cycle' }
```

### Project Report Snapshot Extension

In `packages/contracts/src/projects.ts`, add optional cycle snapshot data to `ProjectStatusReportSnapshotDto`.

```ts
export interface ProjectStatusReportCycleSnapshotDto {
  id: string;
  name: string;
  goal: string;
  status: ProjectCycleStatus;
  startDate: string;
  endDate: string;
  targetPoints: number | null;
  committedEstimatePoints: number;
  completedEstimatePoints: number;
  openWorkCount: number;
  blockedWorkCount: number;
  dependencyBlockedWorkCount: number;
  unestimatedWorkCount: number;
  health: DeliveryHealthState;
  reasons: DeliveryHealthReasonDto[];
  links: ProjectStatusReportLinkDto[];
}

export interface ProjectStatusReportSnapshotDto {
  snapshotVersion: 1;
  // existing fields...
  cycle?: ProjectStatusReportCycleSnapshotDto | null;
}
```

`cycle` is optional for backward compatibility and should be `null` when no active cycle exists during draft generation.

## API Design

### New Endpoints

Add `apps/api/src/endpoints/cycles.ts`.

Routes:

```text
GET    /api/projects/:projectId/cycles
POST   /api/projects/:projectId/cycles
GET    /api/projects/:projectId/cycles/:cycleId
PATCH  /api/projects/:projectId/cycles/:cycleId
POST   /api/projects/:projectId/cycles/:cycleId/archive
POST   /api/projects/:projectId/cycles/:cycleId/reactivate
GET    /api/projects/:projectId/cycles/:cycleId/review
```

Register them in `apps/api/src/adapters/express/routes/planning-routes.ts` or a new `cycle-routes.ts`.

Use a new route file if the implementation gets more than a few registrations:

```text
apps/api/src/adapters/express/routes/cycle-routes.ts
```

The endpoint handlers should stay transport-neutral and use the existing `adaptEndpoint` path.

### Service Boundary

Add `apps/api/src/services/project-cycle-service.ts`.

Responsibilities:

- list cycles by project;
- create/update/archive/reactivate cycles;
- validate permissions and project membership;
- enforce one active cycle and planned/active overlap rules;
- build cycle review DTOs;
- expose helpers for planning/report services to fetch active/upcoming/recent cycles;
- validate work item cycle assignment references.

Do not put cycle lifecycle behavior inside `PlanningService`.

### Repository Boundary

Add repository methods following existing repository patterns:

```ts
projectCycles.listByProject(projectId, options)
projectCycles.findById(cycleId)
projectCycles.create(input)
projectCycles.update(cycleId, patch)
projectCycles.findActiveByProject(projectId)
projectCycles.findUpcomingByProject(projectId)
projectCycles.findRecentlyCompletedByProject(projectId)
projectCycles.findOverlappingPlannedOrActive(projectId, startDate, endDate, excludeCycleId?)
```

Add `ProjectCycle` to repository `types.ts`.

### Validation

Add request validators:

```text
apps/api/src/validation/project-cycle.ts
```

Validation rules:

- `name`: required on create, trimmed, max 120;
- `goal`: optional, trimmed, max 2000, default `''`;
- `status`: one of `planned`, `active`, `completed`, `canceled`;
- `startDate`/`endDate`: ISO `YYYY-MM-DD`, required on create;
- `startDate <= endDate`;
- `targetPoints`: nullable positive integer, max 999.

Service-level validation:

- project must exist in actor workspace;
- project must be active for mutations;
- actor must be owner or maintainer for mutations;
- cycle must belong to route project;
- archived cycles cannot be mutated except reactivation;
- active cycle uniqueness;
- planned/active date overlap.

### Error Behavior

Use existing structured application errors:

- `NotFoundError` for missing project/cycle/cross-project ids;
- `ForbiddenError` for contributor mutation attempts;
- `ConflictError` for archived project/cycle writes, active-cycle conflicts, and overlap conflicts;
- `ValidationError` for invalid request shape or invalid references.

## Work Item Integration

### Create And Update

Update `WorkItemService`:

- validate `cycleId` on create/update;
- hydrate `cycle` into list/detail DTOs;
- record `work_item.cycle_changed` activity when cycle assignment changes;
- include cycle assignment in watcher notification policy if current planning-field changes notify watchers.

Add activity event type:

```ts
'work_item.cycle_changed'
```

Notification behavior:

- do not add a new notification type in v0.2.1 unless the current watcher policy cannot represent the change;
- if planning-field changes currently produce watched work-change notifications, include cycle changes in that path;
- otherwise activity coverage is sufficient for v0.2.1.

### Bulk Update

Extend project bulk update:

- `set_cycle`;
- `clear_cycle`.

Validation:

- `set_cycle` requires a cycle in the same project;
- archived cycles are invalid assignment targets;
- archived project behavior remains blocked;
- item-specific failures return existing per-row result structure.

### Query Builder

Extend work item query validation and repository query builder:

- parse `cycleId`;
- filter by `work_items.cycle_id`;
- include cycle join/hydration for list DTOs;
- include cycle lookup maps in DTO assembly.

Cycle filter must work in both workspace-wide and project work lists. In workspace mode, cycle options should be loaded by selected project when a project filter is active; see frontend design for UX handling.

## Cycle Review Derivation

Cycle review should reuse existing work-risk assembly where possible.

Add a cycle-scoped risk assembly path to `work-risk-sections.ts`:

```ts
createCycleRiskSections({
  projectId,
  cycleId,
  workItems,
  relationships,
  members,
  now
})
```

The implementation can share the same generic risk section builder used by milestone review and reports if the current structure supports it. The important design rule is that risk definitions live in one place.

Cycle review data:

- load project;
- load cycle;
- load cycle-scoped work items;
- derive dependency counts using existing relationship/dependency logic;
- build progress counts;
- build scope breakdown;
- build risk sections;
- build recently changed work from the 8 most recently updated cycle items;
- build query links with `cycleId` plus existing risk parameters.

Progress calculations:

- `committedEstimatePoints`: sum non-null `estimatePoints` for all cycle work;
- `completedEstimatePoints`: sum non-null `estimatePoints` for `done` work;
- `unestimatedCount`: count cycle work with `estimatePoints === null`;
- `openCount`: non-terminal statuses;
- `doneCount`: status `done`;
- `blockedCount`: status `blocked`;
- `dependencyBlockedCount`: open dependency-blocked work.

Health reasons should be deterministic and small:

- over target points;
- blocked work;
- dependency-blocked work;
- overdue work;
- stale in-progress work;
- unassigned active work;
- unestimated work.

## Planning Integration

Update `PlanningService` to include cycle summaries.

Data selection:

- active cycle: non-archived `status = active`;
- upcoming cycle: earliest non-archived `planned` cycle with `startDate >= today`;
- recently completed cycle: latest non-archived completed cycle by `endDate`.

Planning page UX:

- add a compact `Current cycle` panel in Planning Review when active cycle exists;
- show empty state "No active cycle" with link or helper for owners/maintainers to manage cycles;
- show `Upcoming cycle` if present;
- show current cycle metrics:
  - dates/days remaining;
  - target points;
  - committed/completed points;
  - open/done/blocked/dependency-blocked/unassigned counts;
  - cycle health.
- cycle name links to `/projects/:projectId/cycles/:cycleId`;
- risk/count links route to project Work with `cycleId` and matching query params.

Cycle management UX:

- add a `Cycles` section to the existing Planning management view;
- keep milestone management intact;
- owners/maintainers can create/update/archive/reactivate cycles;
- contributors see read-only cycle list and helper copy.

## Frontend Design

### API Client

Add `apps/web/src/app/core/api/cycles-api.ts`.

Methods:

```ts
listProjectCycles(projectId: string): Observable<ProjectCycleDto[]>
createProjectCycle(projectId: string, request: CreateProjectCycleRequest): Observable<ProjectCycleDto>
getProjectCycle(projectId: string, cycleId: string): Observable<ProjectCycleDto>
updateProjectCycle(projectId: string, cycleId: string, request: UpdateProjectCycleRequest): Observable<ProjectCycleDto>
archiveProjectCycle(projectId: string, cycleId: string): Observable<ProjectCycleDto>
reactivateProjectCycle(projectId: string, cycleId: string): Observable<ProjectCycleDto>
getProjectCycleReview(projectId: string, cycleId: string): Observable<ProjectCycleReviewDto>
```

New code should use this domain API client. `WorktrailApiService` can expose compatibility methods if existing large components still route through it.

### Routes

Add lazy project-shell child route:

```ts
{
  path: 'cycles/:cycleId',
  loadComponent: () =>
    import('./features/projects/project-cycle-review-page.component').then(
      (m) => m.ProjectCycleReviewPageComponent
    )
}
```

No project nav label is added in v0.2.1.

### Cycle Review Page

Add:

```text
apps/web/src/app/features/projects/project-cycle-review-page.component.ts
```

The page should mirror milestone review structure:

- loading/error states;
- cycle identity and live-view label;
- progress summary;
- health/reason chips;
- scope breakdown;
- risk sections;
- recently changed work;
- links to project Work filtered by cycle/risk;
- item links with return URL back to cycle review.

### Planning Page

Extend `project-planning-page.component.ts` carefully.

Because this component is already large, prefer extracting cycle UI into small standalone components if the implementation becomes noisy:

```text
apps/web/src/app/features/projects/planning/cycle-summary.component.ts
apps/web/src/app/features/projects/planning/cycle-manager.component.ts
```

Do not block v0.2.1 on a full Planning component split.

### Work Item Create And Detail

Add cycle option loading:

- global create:
  - after project selection, load active/planned non-archived cycles for the selected project;
  - allow no cycle;
  - default to no cycle, not auto-select active cycle.
- project create:
  - load active/planned non-archived project cycles;
  - allow no cycle.
- detail:
  - load active/planned cycles plus current assigned cycle if archived/completed/canceled;
  - preserve current assignment while editing unrelated fields.

### Work Lists And Query State

Extend existing query helpers:

- `work-item-query-serialization.ts`;
- `work-item-filter-state.ts`;
- `work-item-filter-labels.ts`;
- `work-item-filter-panel.component.ts`;
- `WorkListQueryStore`.

Add `cycleId` to:

- pending filter form values;
- applied query;
- route query params;
- active filter chips;
- saved-view meaningful filter count;
- CSV export query building;
- copy-link/return URL construction.

Cycle filter options:

- project Work:
  - load cycles for current project;
  - include archived/current referenced cycle names for label resolution when needed.
- workspace Work Items:
  - if `projectId` filter is set, load cycles for that project and show cycle dropdown;
  - if no project filter is set, hide/disable cycle dropdown with helper copy, because cycle names are project-scoped and duplicate names are allowed across projects.

This keeps the first implementation honest and avoids a global cross-project cycle selector with ambiguous names.

### Saved Views And Pinned Views

No saved-view schema change is required because saved views store normalized query JSON.

Updates required:

- allow `cycleId` through query validation;
- include cycle label in summaries;
- ensure stale cycle ids remain tolerated like stale labels/milestones;
- seeded saved views may include one cycle-filtered view.

### Bulk Triage

Extend `ProjectBulkTriageStore` and bulk action form:

- add `set_cycle`;
- add `clear_cycle`;
- load cycle options in project Work;
- keep controls inside explicit bulk edit mode.

## Report Integration

### Draft Generation

In `ProjectStatusReportService.createSnapshot`, load the active cycle summary from `ProjectCycleService` or a pure helper it exposes.

When an active cycle exists:

- include cycle snapshot;
- include cycle links:
  - cycle review;
  - filtered cycle work;
  - filtered risk work when compact enough.

When no active cycle exists:

- set `cycle: null` or omit field depending on final contract. Prefer `cycle: null` for generated snapshots and optional field for backward compatibility.

### Snapshot Validation

Extend `project-status-report-snapshot.ts`:

- `cycle` optional;
- when present, validate UUIDs, dates, counts, health, reasons, and links;
- keep `snapshotVersion: 1`.

Existing snapshots without `cycle` remain valid.

### Detail And Markdown

Update:

- report detail page to render a `Cycle snapshot` section when present;
- Markdown renderer to include a `## Current Cycle` section when present;
- report contract tests and renderer tests.

## CSV Export

Update CSV export columns:

- add `cycle_name` after `milestone_name`, or add `cycle_name` near planning fields;
- leave import columns unchanged in v0.2.1.

Document that CSV import does not assign cycles yet.

## Seed Data

Update `apps/api/src/db/seed.ts`.

Seed deterministic cycles for Worktrail App:

- active: `v0.2.1 Cycle Planning`;
- upcoming: `v0.2.2 Adoption Polish`;
- completed: `v0.2.0 Consolidation`;
- canceled or archived example only if needed for read-only coverage.

Assign existing seeded work into cycles:

- include blocked/dependency-blocked work in active cycle;
- include unassigned active work;
- include estimated and unestimated work;
- include at least one work item that has both milestone and cycle;
- include at least one completed work item in completed cycle.

Seed one shared project saved view:

- `Current cycle risks`;
- query includes active cycle id and either dependency/risk filter.

Pin it if the UI needs immediate demo value.

## OpenAPI

Update `docs/api/openapi.yaml` for:

- cycle routes;
- cycle DTOs;
- cycle review DTOs;
- `cycleId` query parameter on work item lists;
- work item create/update request cycle field;
- work item list/detail response cycle field;
- bulk update `set_cycle` and `clear_cycle` actions;
- status report snapshot optional cycle section;
- CSV export notes if column docs are present.

## Testing Strategy

### Contracts

Add or update:

- `packages/contracts/src/cycles.contract.test.ts`;
- `work-item-query.contract.test.ts`;
- `work-item-bulk-update.contract.test.ts`;
- `project-status-reports.contract.test.ts`.

### API

Add:

- `apps/api/tests/project-cycles.test.ts`;
- `apps/api/tests/project-cycle-review.test.ts`;

Update:

- work item create/update/list tests;
- bulk update tests;
- planning tests;
- status report tests;
- Markdown renderer tests;
- CSV export tests.

Key API cases:

- owner/maintainer can create/update/archive/reactivate;
- contributor cannot mutate;
- archived project blocks mutation;
- one active cycle conflict;
- planned/active overlap conflict;
- work item cycle validation;
- cycle query filtering;
- bulk set/clear cycle;
- cycle review derivation;
- existing reports without cycle parse correctly.

### Web

Add/update tests for:

- cycle manager component or Planning page cycle section;
- cycle review page;
- work item create/detail cycle fields;
- work list query serialization/filter labels;
- workspace/project work list cycle filter behavior;
- saved views with cycle filters;
- project bulk triage cycle actions;
- report detail cycle snapshot rendering.

### E2E

Extend `e2e/worktrail-smoke.spec.ts` with a cycle workflow:

- open Planning and inspect current cycle;
- open cycle review;
- follow risk link to project Work;
- enter bulk edit and set/clear cycle on selected work;
- save or open a cycle-filtered view;
- publish/read a report with cycle context.

Keep the test concise enough to avoid another timeout-heavy smoke suite.

## Rollout And Backward Compatibility

- Existing work items get no cycle assignment.
- Existing saved views continue to load because `cycleId` is optional.
- Existing reports continue to parse because `cycle` snapshot data is optional.
- Existing CSV imports continue to work unchanged.
- Existing milestone and Planning routes remain unchanged.
- Existing `/work-items/:id` route-refresh bugfix remains covered by component tests.

## Performance Considerations

Cycle query filters should be covered by indexes on `work_items(project_id, cycle_id)` and `work_items(workspace_id, cycle_id)`.

Cycle review loads are project-scoped and should remain bounded by current local app expectations. Avoid N+1 lookups by:

- loading cycle work in one query;
- loading labels/milestones/cycles/members into maps;
- reusing existing DTO assembly patterns.

Report draft generation should not do separate expensive cycle queries if Planning/cycle summary helpers already load the needed active-cycle work.

## Security And Permissions

This release does not change authentication.

Permission checks remain based on selected active workspace member:

- active workspace members can read project cycles for projects in their workspace;
- owners/maintainers can mutate cycles on active projects;
- contributors cannot mutate cycles or cycle assignment;
- archived projects block cycle mutations and assignment changes;
- cross-workspace and cross-project ids return not found or validation errors without leaking data.

## Documentation Impact

Update:

- README capability and walkthrough sections;
- public site product capability copy if cycle planning is promoted;
- `docs/v0.2.1/release-notes.md` during finalization;
- `docs/v0.2.1/pattern-notes.md` during finalization;
- OpenAPI.

Pattern notes should remain destination-neutral and focus on:

- timeboxed planning objects;
- optional query dimensions;
- derived review pages;
- additive snapshot sections;
- cross-surface feature rollout.

## Implementation Notes

Suggested implementation order:

1. contracts and schema;
2. repository/service lifecycle;
3. API endpoints;
4. work item cycle assignment/query hydration;
5. Planning cycle summary;
6. cycle review;
7. frontend create/detail/list/bulk integration;
8. report snapshot/Markdown integration;
9. seed/E2E/docs.

## Open Questions

These can be resolved during implementation planning:

- Should completed/canceled cycles be hidden by default in the Planning cycle manager or shown collapsed?
- Should active cycle assignment be offered as a one-click default on work item create, or should v0.2.1 keep default assignment explicit?
- Should cycle status transitions have named buttons (`Activate`, `Complete`, `Cancel`) in addition to the status dropdown?

## Recommendation

Proceed with this design.

The design adds real product utility while staying inside Worktrail's established architecture:

- local-first Postgres persistence;
- shared DTO contracts;
- transport-neutral API handlers;
- Angular lazy routes and feature-local state;
- query-backed work views;
- derived review surfaces;
- immutable report snapshots;
- deterministic seed data.

The important constraint is to keep cycles focused on current execution commitments. Forecasting, velocity, member capacity, and agile ceremony management should remain out of scope until Worktrail has stronger evidence that those features are needed.
