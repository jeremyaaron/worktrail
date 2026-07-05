# Worktrail v0.0.9 Technical Design

## Overview

Worktrail v0.0.9 adds delivery health to the planning experience. v0.0.8 made dependency risk visible through work item relationships and dependency filters. This release rolls those execution signals into milestone and project-level planning confidence.

The release adds:

- derived milestone health;
- project delivery-health summaries;
- explainable health reasons with work item query links;
- planning review sections for attention, upcoming work, and recent changes;
- a compact delivery-health panel on project overview;
- richer planning dashboard health indicators;
- deterministic seed data for healthy, at-risk, and blocked delivery states;
- OpenAPI, README, product site, and extraction-note updates.

The design preserves current architectural boundaries:

- Angular standalone lazy route components;
- shared contracts in `packages/contracts`;
- transport-neutral endpoint handlers;
- local Express adapter;
- backend service/repository layering;
- Drizzle-managed Postgres schema and migrations;
- deterministic seed data;
- production preview from built artifacts.

v0.0.9 should not add a forecasting engine, Gantt chart, notification system, custom health formulas, saved dashboard configuration, portfolio reporting, or cloud infrastructure.

## Design Decisions

- Derive delivery health at read time.
- Do not store health states in the database.
- Use deterministic rules, not scores.
- Use stable enum tokens in contracts and clearer labels in the UI.
- Label `healthy` as "On track" in the frontend.
- Treat manually blocked work and dependency-blocked work as severe delivery-health signals.
- Treat overdue work as risk; escalate milestone health to blocked when the milestone target date has passed and open work remains.
- Treat due-soon, unassigned active, stale in-progress, and empty active milestones as at-risk signals.
- Treat completed milestones with reopened/open work as at risk instead of complete.
- Treat canceled or archived milestones as inactive and exclude them from active delivery-risk counts.
- Include unmilestoned active risk in project health.
- Reuse `WorkItemQuery` for health-reason links.
- Keep the existing planning risk lists and add health/review structure above them.
- Add a compact `deliveryHealth` object to `ProjectSummaryDto` so the overview route does not need to call the planning endpoint.
- Extend the planning summary response with detailed delivery-health and planning-review data.
- Prefer a shared backend delivery-health derivation module over duplicating rules in project and planning services.
- Keep v0.0.9 read-model aggregation service-side. Repository changes should be limited to existing list/count methods unless implementation discovers a material query performance issue.

## Health Model

### Contract Health States

```ts
export type DeliveryHealthState =
  | 'healthy'
  | 'at_risk'
  | 'blocked'
  | 'complete'
  | 'inactive';
```

Frontend labels:

- `healthy`: On track
- `at_risk`: At risk
- `blocked`: Blocked
- `complete`: Complete
- `inactive`: Inactive

### Reason Severity

```ts
export type DeliveryHealthSeverity = 'info' | 'warning' | 'critical';
```

Severity is not the health state. It only controls display priority and visual treatment for individual reasons.

### Reason Keys

```ts
export type DeliveryHealthReasonKey =
  | 'all_work_done'
  | 'blocked_work'
  | 'blocking_open_work'
  | 'completed_with_open_work'
  | 'dependency_blocked'
  | 'due_soon'
  | 'empty_active_milestone'
  | 'inactive_milestone'
  | 'open_work'
  | 'overdue_work'
  | 'stale_in_progress'
  | 'target_date_past'
  | 'unassigned_active'
  | 'unmilestoned_risk';
```

The key list can be expanded later, but v0.0.9 should keep it limited to reasons the UI can explain and link to.

### Milestone Rules

Milestone health is derived in this order:

1. `inactive` when the milestone is archived or canceled.
2. `at_risk` when the milestone status is completed but open work remains.
3. `complete` when the milestone status is completed or all assigned work is terminal and at least one work item exists.
4. `blocked` when the milestone target date is past and open work remains.
5. `blocked` when assigned open work has `status = blocked`.
6. `blocked` when assigned open work is dependency-blocked.
7. `at_risk` when assigned open work is overdue.
8. `at_risk` when assigned open work is due soon.
9. `at_risk` when assigned active work is unassigned.
10. `at_risk` when assigned in-progress work is stale.
11. `at_risk` when a planned or active milestone has no assigned work.
12. `healthy` otherwise.

Terminal work item statuses remain:

```ts
['done', 'canceled']
```

Open statuses remain:

```ts
['backlog', 'ready', 'in_progress', 'blocked']
```

Active unassigned statuses remain:

```ts
['ready', 'in_progress']
```

Due-soon window remains 7 days. Stale in-progress threshold remains 7 days.

### Project Rules

Project delivery health is derived from active/planned milestones plus unmilestoned active work.

Project health is:

1. `inactive` when the project is archived.
2. `blocked` when any active/planned milestone is blocked.
3. `blocked` when unmilestoned active work has blocked or dependency-blocked risk.
4. `at_risk` when any active/planned milestone is at risk.
5. `at_risk` when unmilestoned active work has overdue, due-soon, unassigned, stale, or blocking-open-work risk.
6. `healthy` when active delivery work exists with no risk.
7. `healthy` when no active delivery work exists and the project is active.

The last rule intentionally avoids making a brand-new empty project appear broken on the overview page. Empty active milestones still appear at risk because a milestone represents a named delivery target with no scope.

## Shared Contracts

Add the delivery-health primitives near the existing domain type aliases in `packages/contracts/src/index.ts`:

```ts
export type DeliveryHealthState = 'healthy' | 'at_risk' | 'blocked' | 'complete' | 'inactive';
export type DeliveryHealthSeverity = 'info' | 'warning' | 'critical';
export type DeliveryHealthReasonKey =
  | 'all_work_done'
  | 'blocked_work'
  | 'blocking_open_work'
  | 'completed_with_open_work'
  | 'dependency_blocked'
  | 'due_soon'
  | 'empty_active_milestone'
  | 'inactive_milestone'
  | 'open_work'
  | 'overdue_work'
  | 'stale_in_progress'
  | 'target_date_past'
  | 'unassigned_active'
  | 'unmilestoned_risk';
```

Add reason and summary DTOs:

```ts
export interface DeliveryHealthReasonDto {
  key: DeliveryHealthReasonKey;
  severity: DeliveryHealthSeverity;
  message: string;
  count: number;
  query: WorkItemQuery | null;
}

export interface ProjectDeliveryHealthDto {
  health: DeliveryHealthState;
  activeMilestoneCount: number;
  healthyMilestoneCount: number;
  atRiskMilestoneCount: number;
  blockedMilestoneCount: number;
  completeMilestoneCount: number;
  inactiveMilestoneCount: number;
  openWorkCount: number;
  blockedWorkCount: number;
  dependencyBlockedWorkCount: number;
  blockingOpenWorkCount: number;
  overdueWorkCount: number;
  dueSoonWorkCount: number;
  unassignedActiveWorkCount: number;
  staleInProgressWorkCount: number;
  unmilestonedActiveRiskCount: number;
  reasons: DeliveryHealthReasonDto[];
}
```

Extend the existing milestone progress DTO rather than replacing the `milestoneProgress` field. This keeps the planning page model stable while allowing richer health display.

```ts
export interface MilestoneProgressDto {
  milestone: MilestoneDto;
  totalCount: number;
  doneCount: number;
  openCount: number;
  blockedCount: number;
  dependencyBlockedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  unassignedActiveCount: number;
  staleInProgressCount: number;
  health: DeliveryHealthState;
  reasons: DeliveryHealthReasonDto[];
}
```

Add planning review DTOs:

```ts
export type PlanningReviewItemKind = 'work_item' | 'milestone' | 'activity';

export interface PlanningReviewItemDto {
  id: string;
  kind: PlanningReviewItemKind;
  title: string;
  detail: string;
  severity: DeliveryHealthSeverity;
  workItemId: string | null;
  milestoneId: string | null;
  displayKey: string | null;
  dueDate: string | null;
  updatedAt: string;
  query: WorkItemQuery | null;
}

export interface PlanningReviewDto {
  needsAttention: PlanningReviewItemDto[];
  upcoming: PlanningReviewItemDto[];
  recentlyChanged: PlanningReviewItemDto[];
}
```

Extend existing summary DTOs:

```ts
export interface ProjectSummaryDto {
  project: ProjectDto;
  countsByStatus: ProjectStatusCountDto[];
  recentWorkItems: RecentWorkItemDto[];
  deliveryHealth: ProjectDeliveryHealthDto;
}

export interface ProjectPlanningSummaryDto {
  project: ProjectDto;
  deliveryHealth: ProjectDeliveryHealthDto;
  milestoneProgress: MilestoneProgressDto[];
  planningReview: PlanningReviewDto;
  blockedWork: PlanningRiskItemDto[];
  overdueWork: PlanningRiskItemDto[];
  dueSoonWork: PlanningRiskItemDto[];
  unassignedActiveWork: PlanningRiskItemDto[];
  staleInProgressWork: PlanningRiskItemDto[];
  dependencyBlockedWork: PlanningRiskItemDto[];
  blockingOpenWork: PlanningRiskItemDto[];
}
```

## API Surface

No new endpoint is required.

Updated responses:

- `GET /api/projects/:projectId/summary`
  - Adds compact `deliveryHealth`.
- `GET /api/projects/:projectId/planning-summary`
  - Adds detailed `deliveryHealth`.
  - Extends `milestoneProgress` items.
  - Adds `planningReview`.

OpenAPI must be regenerated or updated for:

- new delivery-health enums;
- new reason DTO;
- new project delivery-health DTO;
- extended milestone progress DTO;
- new planning review DTOs;
- changed project summary and planning summary schemas.

## Backend Design

### Shared Derivation Module

Add a focused backend module:

```txt
apps/api/src/services/delivery-health-service.ts
```

Recommended exported shape:

```ts
export interface DeliveryHealthInput {
  project: Project;
  workItems: WorkItem[];
  dependencyBlockedWorkItems: WorkItem[];
  blockingOpenWorkItems: WorkItem[];
  milestones: Milestone[];
  now: Date;
}

export interface DeliveryHealthResult {
  deliveryHealth: ProjectDeliveryHealthDto;
  milestoneProgress: MilestoneProgressDto[];
  planningReview: PlanningReviewDto;
}

export class DeliveryHealthService {
  derive(input: DeliveryHealthInput): DeliveryHealthResult;
}
```

This service should be pure except for date handling supplied through `now`. It should not call repositories. That keeps tests fast and makes the derivation reusable from both project and planning services.

### Planning Service Integration

`PlanningService.getProjectPlanningSummary` already fetches:

- project;
- all project work items;
- dependency-blocked project work items;
- open blocking project work items;
- milestones;
- members.

Update it to:

1. Instantiate or call the delivery-health derivation with the existing fetched data.
2. Return `deliveryHealth`, derived `milestoneProgress`, and `planningReview`.
3. Keep current risk list fields.
4. Keep risk item mapping local or move shared mapping only if implementation shows meaningful duplication.

### Project Service Integration

`ProjectService.getProjectSummary` currently fetches counts and recent work items only.

Update it to fetch the minimum additional data needed for `deliveryHealth`:

- project work items;
- dependency-blocked project work items;
- open blocking project work items;
- project milestones including archived milestones.

Then call the same derivation service and return only `deliveryHealth` from the result. The overview page should not need planning review details.

This creates more work in the project summary endpoint than today, but it keeps the overview useful and consistent. The current local MVP data set is small, and the work remains isolated behind service methods that can later be optimized with aggregate SQL or cached read models.

### Dependency Sets

Build sets once inside the derivation service:

```ts
const dependencyBlockedIds = new Set(dependencyBlockedWorkItems.map((item) => item.id));
const blockingOpenWorkIds = new Set(blockingOpenWorkItems.map((item) => item.id));
```

Use those sets when calculating milestone and project counts.

### Reason Queries

Reasons should include a `WorkItemQuery` when the existing list route can reproduce the underlying set.

Milestone reason examples:

```ts
{
  key: 'blocked_work',
  severity: 'critical',
  message: '2 blocked work items',
  count: 2,
  query: { milestoneId: milestone.id, status: 'blocked', sort: 'priority_desc' }
}
```

```ts
{
  key: 'dependency_blocked',
  severity: 'critical',
  message: '1 work item blocked by open dependency',
  count: 1,
  query: {
    milestoneId: milestone.id,
    dependency: 'dependency_blocked',
    sort: 'priority_desc'
  }
}
```

Project reason examples:

```ts
{
  key: 'unmilestoned_risk',
  severity: 'warning',
  message: '3 active risk items have no milestone',
  count: 3,
  query: { milestoneId: 'none', workState: 'open', sort: 'priority_desc' }
}
```

The current `WorkItemQuery` contract does not support `milestoneId = 'none'`. Do not add that sentinel in v0.0.9 unless implementation proves it is low-churn and useful across the app. If unsupported, set `query: null` for unmilestoned reasons and still render the reason text. The existing unassigned, due date, status, dependency, and milestone filters are sufficient for most links.

### Planning Review Derivation

The planning review should be deterministic and should use data already fetched for planning.

`needsAttention`:

- top blocked work;
- top dependency-blocked work;
- top overdue work;
- stale in-progress work;
- unassigned active work;
- blocked or at-risk milestones.

Sort order:

1. critical before warning before info;
2. overdue due date ascending;
3. priority descending;
4. updated timestamp ascending for stale work;
5. title/display key.

Limit to 8 items.

`upcoming`:

- due-soon open work;
- active/planned milestones with target dates in the next 14 days.

Sort by date ascending, then priority descending. Limit to 8 items.

`recentlyChanged`:

- recently updated open work items, newest first;
- recently updated active/planned milestones, newest first.

Limit to 8 items.

Do not query activity events for v0.0.9 unless implementation discovers the needed repository method already exists and is low-churn. Updated timestamps provide enough value for the first planning review surface.

### Date Handling

Use UTC date strings, matching existing planning-service behavior:

```ts
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
```

Call `clock()` once per public service method and pass the same `now` into all derived calculations.

## Repository and Database Design

No schema migration is required for delivery health.

Seed data updates may require only changes to:

```txt
apps/api/src/db/seed.ts
```

Repository changes should be avoided unless needed for efficient summary fetching. Existing methods already provide:

- project work item lists;
- dependency-filtered work item lists;
- milestone lists;
- recent project work items;
- status counts.

If implementation identifies duplicated expensive list calls between `ProjectService.getProjectSummary` and future surfaces, defer optimization to a later read-model sprint.

## Frontend Design

### Shared Display Helpers

Add small display helpers near existing work item display utilities:

```txt
apps/web/src/app/shared/delivery-health/
```

or, if the implementation remains tiny:

```txt
apps/web/src/app/shared/work-items/work-item-display.ts
```

Recommended helpers:

- `deliveryHealthLabel(state)`;
- `deliveryHealthTone(state)`;
- `deliveryHealthReasonLabel(reason)`;
- `deliveryHealthQueryParams(reason)`.

Health indicators must use text plus color. Do not rely on color only.

### Project Overview

Update `ProjectHomePageComponent` to add a compact delivery-health panel after the status count tiles or as the first item in the existing home grid.

The panel should show:

- health label;
- active milestone count;
- blocked milestone count;
- at-risk milestone count;
- open work count;
- top two or three reasons;
- link to Planning;
- linked reason rows when `reason.query !== null`.

The overview panel should remain compact and operational. It should not become a dashboard hero.

### Planning Dashboard

Update `ProjectPlanningPageComponent`:

- Add a delivery-health summary block at the top of the planning dashboard panel.
- Update milestone progress rows to show health labels and reason chips/links.
- Add planning review sections before the existing risk section list:
  - Needs attention;
  - Upcoming;
  - Recently changed.
- Keep existing risk metric tiles and detailed risk sections.

Reason links use:

```html
[routerLink]="['/projects', projectId(), 'work-items']"
[queryParams]="toQueryParams(reason.query)"
```

The existing `workItemQueryToHttpParams` is API-oriented. For router links, use a plain-object converter that omits empty values and preserves enum strings.

### Empty States

Planning dashboard empty states:

- No active milestones: keep current empty state.
- Healthy project with no reasons: show a compact "No delivery risks found" state.
- No planning review items: show a compact "No review items" message per section.

### Responsive Behavior

The planning page already uses a two-column layout. v0.0.9 should keep:

- planning controls readable on desktop;
- stacked panels on narrow screens;
- no horizontal page scroll;
- compact review rows with wrapping text;
- stable health pill sizing.

## Styling

Health tones:

- `healthy`: green accent, "On track";
- `at_risk`: amber accent, "At risk";
- `blocked`: red accent, "Blocked";
- `complete`: blue or neutral accent, "Complete";
- `inactive`: gray accent, "Inactive".

The UI should avoid a single-color dashboard. Health tones should be accents on restrained white/neutral panels, consistent with existing Worktrail styling.

## Seed Data

Update seed data to demonstrate:

- an on-track active milestone;
- an at-risk milestone with due-soon or stale work;
- a blocked milestone with a dependency-blocked item;
- a completed milestone;
- a canceled or archived milestone;
- unmilestoned active risk;
- project overview with a meaningful health state;
- planning review sections with at least one item each.

Seed data should remain deterministic and should not depend on the real current date. Use the existing seed date pattern and relative helper dates already in the seed script.

## OpenAPI

Update:

```txt
docs/api/openapi.yaml
```

Required schema changes:

- `DeliveryHealthState`;
- `DeliveryHealthSeverity`;
- `DeliveryHealthReasonKey`;
- `DeliveryHealthReason`;
- `ProjectDeliveryHealth`;
- extended `MilestoneProgress`;
- `PlanningReviewItemKind`;
- `PlanningReviewItem`;
- `PlanningReview`;
- extended `ProjectSummary`;
- extended `ProjectPlanningSummary`.

Validate that examples remain consistent with seed data where examples exist.

## Tests

### Contract and Type Checks

Existing TypeScript checks should catch frontend/backend contract drift.

Run:

```sh
npm run check
```

### API Unit Tests

Add focused tests for the derivation service:

- empty active project is healthy;
- empty active milestone is at risk;
- canceled milestone is inactive;
- completed milestone with no open work is complete;
- completed milestone with open work is at risk;
- milestone with blocked work is blocked;
- milestone with dependency-blocked work is blocked;
- milestone target date in the past with open work is blocked;
- milestone with due-soon work is at risk;
- milestone with stale in-progress work is at risk;
- project is blocked when any active milestone is blocked;
- project is at risk from unmilestoned overdue/unassigned/stale work;
- reason queries are populated for supported filter combinations.

Add or update service tests for:

- `PlanningService.getProjectPlanningSummary`;
- `ProjectService.getProjectSummary`.

### Frontend Unit Tests

Update project overview and planning specs to assert:

- delivery-health labels render;
- top reasons render;
- linked reasons route to project work item lists with expected query params;
- planning review sections render;
- empty states render when sections are empty.

### E2E

Extend the existing planning/dependency workflow smoke test or add a focused test that:

1. opens project planning;
2. verifies health states from seed data;
3. follows a health reason link;
4. verifies the work item list is filtered with the expected query state.

Avoid expanding E2E coverage too broadly. The derivation rules should be primarily unit-tested.

## Performance

v0.0.9 uses service-side derivation over already-needed project data. This is acceptable for local MVP and small-team deployments.

Expected costs:

- planning summary: similar to v0.0.8, plus in-memory derivation;
- project summary: adds project work/milestone/dependency reads;
- frontend: minor rendering increase.

Future optimization path:

- repository aggregate queries for project summary;
- dependency count joins instead of filtered list calls;
- cached read-model table for project delivery health;
- scheduled or event-driven health refresh in cloud deployments.

Do not implement these optimizations in v0.0.9.

## Security and Permissions

No new write capability is introduced.

Read behavior follows existing project summary and planning summary access rules:

- actor must belong to the workspace;
- project must belong to the actor workspace;
- archived projects remain readable;
- archived projects remain write-protected by existing services.

Reason queries should not leak cross-workspace IDs. All linked work item list routes already scope by project or workspace context and backend actor workspace.

## Cloud and Deployment Considerations

The design keeps endpoint handlers transport-neutral. Delivery health derivation is pure service code, so the same handlers can continue to run under local Express or future Lambda/API Gateway adapters.

No background jobs, queues, triggers, or cache invalidation mechanisms are introduced. That keeps local setup simple and avoids premature cloud coupling.

The future cloud path can introduce:

- aggregate SQL;
- cacheable project summary responses;
- event-driven read-model updates;
- CDN-hosted Angular S3 deployment;
- API Gateway/Lambda endpoint adapters.

## Documentation

Update:

- `README.md`;
- `docs/api/openapi.yaml`;
- `docs/product-site/index.html`;
- `docs/v0.0.9/prd.md` if implementation changes scope;
- `docs/v0.0.9/implementation-plan.md` after design approval;
- extraction notes for dashboard derivation, explainable health reasons, and query-linked metrics.

The product site should mention delivery health and planning review as current capabilities after implementation.

## Risks

- Health rules may feel opinionated. Keep reasons explicit and avoid opaque scoring.
- Project summary may become heavier. Accept for v0.0.9 and defer aggregate read-model optimization.
- Reason links may not perfectly represent every derived set. Use `query: null` when the list route cannot faithfully reproduce the set.
- Planning page density may increase. Keep the health panel compact and preserve existing risk sections.
- Duplicate derivation logic could drift. Centralize rules in one backend module and unit-test it.

## Resolved Open Decisions

- Use Angular-only UI primitives; do not add a charting library.
- Do not add a schema migration for health state.
- Add health to existing summary endpoints instead of creating a new endpoint.
- Reuse `WorkItemQuery` for health links.
- Do not add `milestoneId = none` filtering unless implementation finds a low-churn path; unsupported reasons can render without links.
- Use updated timestamps for "recently changed" in v0.0.9 rather than querying activity events.
- Keep project overview compact and put detailed review workflow on Planning.
