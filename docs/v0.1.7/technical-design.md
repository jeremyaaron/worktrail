# Worktrail v0.1.7 Technical Design

## Summary

v0.1.7 adds Milestone Review: a route-backed, derived review page for a single project milestone.

The release should introduce:

- a lazy-loaded Angular project-shell child route at `/projects/:projectId/milestones/:milestoneId`;
- a transport-neutral API handler exposed by the local Express adapter at `GET /api/projects/:projectId/milestones/:milestoneId/review`;
- contract-owned milestone review DTOs;
- derived review logic built from existing projects, milestones, work items, members, relationships, delivery-health rules, and query contracts;
- exact query-backed action links from milestone review into project Work;
- Planning page links into milestone review;
- deterministic seed and Playwright coverage.

No schema migration is planned for v0.1.7. Milestone review is a read model, not a persisted snapshot.

## Resolved Product Decisions

### Route Shape

Use a full page under the existing project shell:

```text
/projects/:projectId/milestones/:milestoneId
```

Rationale:

- the milestone is a project planning object, not just a Planning tab state;
- the URL is short and shareable;
- the existing project shell keeps Overview, Work, Board, Planning, and Settings navigation visible;
- a full page avoids route-backed drawer complexity and works better for direct links, reloads, and mobile.

### API Shape

Use a project-scoped planning read endpoint:

```text
GET /api/projects/:projectId/milestones/:milestoneId/review
```

Rationale:

- the response is a derived planning read model;
- route project id protects against cross-project milestone leakage;
- the handler remains transport-neutral and easy to adapt to Lambda/API Gateway later.

### Recent Movement Policy

Use the 8 most recently updated work items assigned to the milestone.

Rationale:

- no new activity endpoint is required;
- work item `updatedAt` is already available and deterministic enough for seed/browser tests;
- a capped list keeps the page scannable.

### Query Accuracy

Add a narrow query field for milestone review risk links:

```ts
export type WorkItemRiskFilter = 'unassigned_active' | 'stale_in_progress';
```

Extend `WorkItemQuery` with:

```ts
workRisk?: WorkItemRiskFilter;
```

Rationale:

- project Work can already represent milestone, status, due-date state, dependency state, and sort;
- project Work cannot exactly represent "unassigned active" or "stale in progress" today;
- approximate links would undermine the reliable-query work from v0.1.2;
- a narrow URL-backed risk filter is smaller than adding a full advanced query builder;
- no visible filter control is required in v0.1.7.

### Copy Link

Do not add a dedicated copy-link button on milestone review in v0.1.7. The route is shareable by browser URL. Existing Work-page copy links remain available after following risk links.

## Current Architecture

Relevant existing pieces:

- `packages/contracts/src/planning.ts`
  - `MilestoneDto`;
  - `MilestoneProgressDto`;
  - `PlanningRiskItemDto`;
  - `ProjectPlanningSummaryDto`.
- `packages/contracts/src/work-items.ts`
  - `WorkItemQuery`;
  - `DueDateState`;
  - `DependencyFilter`;
  - `AssigneeState`;
  - `WorkItemState`.
- `apps/api/src/services/planning-service.ts`
  - derives project planning summary;
  - loads project work items, dependency-blocked work, blocking-open work, milestones, and members.
- `apps/api/src/services/delivery-health-service.ts`
  - derives project delivery health;
  - derives milestone progress and reason chips;
  - derives project-level planning review sections.
- `apps/api/src/domain/work-risk-policy.ts`
  - owns due-soon window, stale window, open/terminal status sets, active-unassigned status set.
- `apps/api/src/repositories/work-item-query-builder.ts`
  - already supports project query fields including `workState` and `assigneeState`;
  - supports due-date and dependency conditions.
- `apps/web/src/app/features/projects/project-planning-page.component.ts`
  - renders Planning Review and Milestones tabs;
  - loads `ProjectPlanningSummaryDto`;
  - has milestone progress and reason-chip routing logic.
- `apps/web/src/app/features/work-items/query/work-item-query-serialization.ts`
  - serializes project and workspace Work Item query state;
  - project serialization does not currently include `workState`, `assigneeState`, `blocked`, or a risk-specific field.

## Contracts

Add milestone review DTOs to `packages/contracts/src/planning.ts`.

### Risk Type

```ts
export type MilestoneReviewRiskType =
  | 'blocked'
  | 'dependency_blocked'
  | 'overdue'
  | 'due_soon'
  | 'unassigned_active'
  | 'stale_in_progress'
  | 'blocking_open_work';
```

### Scope Breakdown

```ts
export interface MilestoneReviewScopeBreakdownDto {
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
```

Use complete status and priority records with zeroes filled in. This keeps the frontend simple and avoids missing-key checks.

### Risk Section

```ts
export interface MilestoneReviewRiskSectionDto {
  type: MilestoneReviewRiskType;
  title: string;
  description: string;
  count: number;
  query: WorkItemQuery;
  items: PlanningRiskItemDto[];
}
```

`items` is capped for preview. `count` is the full section count.

### Recent Movement

Use `PlanningRiskItemDto[]` for recent movement. The type already carries:

- id;
- display key;
- title;
- status;
- priority;
- assignee;
- due date;
- milestone;
- updated timestamp.

### Milestone Review DTO

```ts
export interface MilestoneReviewDto {
  project: ProjectDto;
  milestone: MilestoneDto;
  progress: MilestoneProgressDto;
  scopedWorkQuery: WorkItemQuery;
  scopeBreakdown: MilestoneReviewScopeBreakdownDto;
  riskSections: MilestoneReviewRiskSectionDto[];
  recentlyChangedWork: PlanningRiskItemDto[];
}
```

### Work Item Query Extension

Add to `packages/contracts/src/work-items.ts`:

```ts
export type WorkItemRiskFilter = 'unassigned_active' | 'stale_in_progress';
```

Extend `WorkItemQuery`:

```ts
workRisk?: WorkItemRiskFilter;
```

Rules:

- `workRisk=unassigned_active` means `assigneeId is null` and status is `ready` or `in_progress`.
- `workRisk=stale_in_progress` means status is `in_progress` and `updatedAt` is older than the shared stale window.
- `workRisk` can combine with `milestoneId`, `projectId`, `labelId`, etc.
- If `status` conflicts with `workRisk`, both conditions apply and can produce an empty result. Do not silently drop user query state.

## API Design

### Endpoint

Add handler in `apps/api/src/endpoints/planning.ts`:

```ts
export function getMilestoneReviewHandler(
  options: PlanningHandlerOptions
): EndpointHandler<MilestoneReviewDto>
```

Parameter schema:

```ts
const milestoneReviewParamSchema = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid()
});
```

Register in `apps/api/src/adapters/express/routes/planning-routes.ts`:

```ts
app.get(
  '/api/projects/:projectId/milestones/:milestoneId/review',
  adaptEndpoint(getMilestoneReviewHandler({ repositories: context.repositories }), options)
);
```

### Service Boundary

Prefer a new `MilestoneReviewService` in `apps/api/src/services/milestone-review-service.ts`.

Rationale:

- `PlanningService` is already responsible for the project-wide summary;
- milestone review is a detailed read model with its own section and query construction;
- a dedicated service keeps tests focused and avoids making `PlanningService` too broad.

Service context:

```ts
export interface MilestoneReviewServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
}
```

Primary method:

```ts
async getMilestoneReview(
  projectId: string,
  milestoneId: string
): Promise<MilestoneReviewDto>
```

### Load Strategy

For one request, load:

- project by id;
- milestones for the project with archived included;
- project work items sorted by `board_order`;
- dependency-blocked work items for the project;
- blocking-open work items for the project;
- workspace members.

Use existing repository calls:

```ts
repositories.projects.findById(projectId)
repositories.milestones.listByProject(projectId, { includeArchived: true })
repositories.workItems.listByProject(projectId, { sort: 'board_order' })
repositories.workItems.listByProject(projectId, {
  dependency: 'dependency_blocked',
  sort: 'priority_desc'
})
repositories.workItems.listByProject(projectId, {
  dependency: 'blocking_open_work',
  sort: 'priority_desc'
})
repositories.members.listByWorkspace(actor.workspaceId)
```

Validation:

- project must exist;
- project must belong to actor workspace;
- milestone must exist in loaded project milestones;
- milestone project id must match route project id.

Return `NotFoundError('Project not found.')` or `NotFoundError('Milestone not found.')` without exposing cross-workspace ownership details.

### Derivation Algorithm

1. Create the same evaluation window used by delivery health:
   - today;
   - due-soon end;
   - stale cutoff.
2. Derive project health with `DeliveryHealthService.derive`.
3. Find the `MilestoneProgressDto` for `milestoneId`.
4. Filter scoped work:
   - `workItem.milestoneId === milestoneId`.
5. Build member and milestone maps.
6. Build dependency id sets from dependency query results:
   - dependency-blocked ids;
   - blocking-open ids.
7. Build scope breakdown.
8. Build risk sections.
9. Build recently changed work.

If `DeliveryHealthService.derive` does not return progress for a valid milestone, synthesize an empty progress row from the milestone. This is defensive; current behavior should include all loaded milestones.

### Risk Sections

Preview limit: 5 items per section.

Sort policies:

| Section | Filter | Sort |
| --- | --- | --- |
| blocked | open scoped work with `status === 'blocked'` | priority desc, updated desc |
| dependency blocked | open scoped work whose id is in dependency-blocked set | priority desc, updated desc |
| overdue | open scoped work with overdue due date | due date asc, priority desc |
| due soon | open scoped work with due date inside due-soon window | due date asc, priority desc |
| unassigned active | scoped work with no assignee and status `ready` or `in_progress` | priority desc, updated desc |
| stale in progress | scoped work with stale in-progress policy | updated asc |
| blocking open work | open scoped work whose id is in blocking-open set | priority desc, updated desc |

All risk sections are returned, even when `count` is zero. This keeps frontend ordering and empty-state rendering deterministic.

### Risk Section Queries

Every section should include a project Work query.

| Section | Query |
| --- | --- |
| scoped work | `{ milestoneId, sort: 'priority_desc' }` |
| blocked | `{ milestoneId, status: 'blocked', sort: 'priority_desc' }` |
| dependency blocked | `{ milestoneId, dependency: 'dependency_blocked', sort: 'priority_desc' }` |
| overdue | `{ milestoneId, dueDateState: 'overdue', sort: 'due_date_asc' }` |
| due soon | `{ milestoneId, dueDateState: 'due_soon', sort: 'due_date_asc' }` |
| unassigned active | `{ milestoneId, workRisk: 'unassigned_active', sort: 'priority_desc' }` |
| stale in progress | `{ milestoneId, workRisk: 'stale_in_progress', sort: 'updated_asc' }` |
| blocking open work | `{ milestoneId, dependency: 'blocking_open_work', sort: 'priority_desc' }` |

Do not put `projectId` in project-scoped route queries. The route already supplies the project.

### Scope Breakdown

Build from all scoped work, not only open work.

Due date counts:

- `overdueCount`: open scoped work with due date before today;
- `dueSoonCount`: open scoped work with due date from today through due-soon end;
- `laterCount`: scoped work with a due date after due-soon end, including terminal work;
- `noneCount`: scoped work with no due date.

Dependency counts:

- count open scoped work in dependency-blocked id set;
- count open scoped work in blocking-open id set.

### Recent Movement

Filter scoped work, sort by `updatedAt` descending, take 8, map to `PlanningRiskItemDto`.

Work item detail return URLs should be built on the frontend. The API should not include route strings.

## Query Contract Changes

### Contracts

Add `WorkItemRiskFilter` and `workRisk` to `WorkItemQuery`.

### API Validation

Update `apps/api/src/validation/work-item-query.ts` to parse:

```ts
workRisk: z.enum(['unassigned_active', 'stale_in_progress']).optional()
```

### Repository Query Builder

Extend `ProjectWorkItemQuery` to include `workRisk`.

Add conditions in `buildCommonWorkItemConditions`:

```ts
if (filters.workRisk === 'unassigned_active') {
  conditions.push(sql`${workItems.assigneeId} is null`);
  conditions.push(inArray(workItems.status, activeUnassignedWorkItemStatuses));
}

if (filters.workRisk === 'stale_in_progress') {
  conditions.push(eq(workItems.status, 'in_progress'));
  conditions.push(sql`${workItems.updatedAt} < now() - (${staleInProgressDays} * interval '1 day')`);
}
```

Prefer importing policy constants from `work-risk-policy.ts` rather than duplicating status lists or day counts.

### Angular Query Serialization

Update `apps/web/src/app/features/work-items/query/work-item-query-serialization.ts`:

- add `workRisk` to `ProjectWorkItemFilters`;
- include project `workState` and `assigneeState` only if needed for current code paths;
- include `workRisk` in:
  - `projectRouterQueryParamsFromQuery`;
  - `projectFormValueFromQueryParams` through a new form-state field or route-only query tracking;
  - `projectFormValueFromQuery`;
  - router link query params.

Recommendation:

- add `workRisk` to `ProjectWorkItemFilterFormValue`;
- keep it as a hidden form field with no visible dropdown in v0.1.7;
- active filter chips should show it and allow clearing it;
- filter apply/reset should preserve or clear it predictably.

When the user opens the visible filter form and clicks Apply, use the hidden field value unless the user removes the active chip or resets filters.

### Filter Labels

Update project active filter labels:

- `workRisk=unassigned_active` -> `Risk: Unassigned active`;
- `workRisk=stale_in_progress` -> `Risk: Stale in progress`.

This is important because milestone review links should not land users on an invisible filter state.

## Frontend Design

### Route

Add a lazy-loaded project-shell child route:

```ts
{
  path: 'milestones/:milestoneId',
  loadComponent: () =>
    import('./features/projects/project-milestone-review-page.component').then(
      (module) => module.ProjectMilestoneReviewPageComponent
    ),
  title: 'Milestone Review | Worktrail'
}
```

### API Client

Add to `apps/web/src/app/core/api/planning-api.ts`:

```ts
getMilestoneReview(projectId: string, milestoneId: string): Observable<MilestoneReviewDto>
```

Expose through `WorktrailApiService`:

```ts
getMilestoneReview(projectId: string, milestoneId: string): Observable<MilestoneReviewDto>
```

### Page Component

Add:

```text
apps/web/src/app/features/projects/project-milestone-review-page.component.ts
apps/web/src/app/features/projects/project-milestone-review-page.component.spec.ts
```

Component responsibilities:

- read `projectId` and `milestoneId` from route params;
- load milestone review;
- render loading, error, and content states;
- render archived/read-only notices from project/milestone state;
- build project Work router links from `WorkItemQuery`;
- build work item detail links with return URL back to current milestone review route;
- use existing delivery-health display helpers for health labels, tones, and reason labels where possible.

Avoid loading project separately if `MilestoneReviewDto.project` contains enough context. Project shell already owns broader project navigation.

### Layout

Recommended structure:

1. Header band:
   - eyebrow `Milestone`;
   - milestone name;
   - project key/name;
   - status pill;
   - target date;
   - archived indicator where relevant;
   - actions: `Back to Planning`, `Open scoped work`.
2. Summary metrics:
   - total;
   - open;
   - done;
   - blocked;
   - dependency blocked;
   - completion percentage.
3. Health panel:
   - health label;
   - reason chips;
   - empty-scope message when total is zero.
4. Scope breakdown:
   - status counts;
   - priority counts;
   - assignment;
   - due-date state;
   - dependency state.
5. Risk sections:
   - fixed ordering;
   - capped preview rows;
   - `Open ... work` link per section.
6. Recently changed:
   - capped preview rows;
   - each row links to detail with return URL.

Use unframed full-width sections and compact panels consistent with the current app. Cards are acceptable for repeated risk sections and work rows, but do not nest cards.

### Planning Integration

Update `ProjectPlanningPageComponent`:

- milestone progress rows should include a `Review milestone` link to `/projects/:projectId/milestones/:milestoneId`;
- planning review items with `milestoneId` and `kind === 'milestone'` should link to milestone review;
- existing reason chips that already route to filtered Work should stay as direct Work links;
- milestone management tab should remain focused on create/edit/archive/reactivate.

Do not move milestone management into the milestone review page in v0.1.7.

### Work Item Links

For recent movement and risk preview item links:

```text
/work-items/:workItemId?returnUrl=/projects/:projectId/milestones/:milestoneId
```

Use the existing return URL pattern used by Work list pages. Encode through Angular `queryParams`.

### Project Work Links

Use `routerLink`:

```text
/projects/:projectId/work-items
```

with query params from `routerLinkQueryParamsFromWorkItemQuery(query, 'project')`.

After landing on project Work:

- active chips should show milestone and risk labels;
- copy link should use applied query state;
- CSV export should use applied query state;
- owner/maintainer selection and batch triage should remain available;
- contributor absence paths should remain unchanged.

## Backend Implementation Details

### Helper Extraction

Create helper functions near `MilestoneReviewService` or in a small local module:

- `createEmptyMilestoneProgress(milestone): MilestoneProgressDto`;
- `toPlanningRiskItems(workItems, memberById, milestoneById): PlanningRiskItemDto[]`;
- `sortByPriorityThenUpdatedDesc`;
- `sortByDueDateThenPriority`;
- `sortByUpdatedAsc`;
- `createRiskSection(...)`.

If `PlanningService` and `MilestoneReviewService` end up duplicating mapping/sorting code, extract a small `planning-risk-items.ts` helper. Keep it backend-internal; do not add a package abstraction.

### Delivery Health Reuse

Use `DeliveryHealthService.derive` to get milestone progress and health reasons. Do not reimplement milestone health state.

The milestone review service can still compute its own section counts and preview lists because those are presentation-specific.

### Time Consistency

Use a single `now` value per request:

```ts
const now = this.clock();
```

Pass the same `now` to delivery health and local risk derivation.

Tests should inject a fixed clock, as existing planning/delivery-health tests do.

### Archived And Completed Behavior

- archived projects: review endpoint returns read model;
- archived milestones: review endpoint returns read model;
- completed/canceled milestones: render the same page with current scope/risk sections; risk sections will usually be empty if work is terminal, but do not hide them;
- no write behavior is added.

## OpenAPI

Update `docs/api/openapi.yaml`:

- add path:

```yaml
/api/projects/{projectId}/milestones/{milestoneId}/review:
  get:
    summary: Get milestone review
```

- add schemas:
  - `MilestoneReview`;
  - `MilestoneReviewScopeBreakdown`;
  - `MilestoneReviewRiskSection`;
  - `MilestoneReviewRiskType`;
  - `WorkItemRiskFilter`;
- update `WorkItemQuery` schema with `workRisk`.

Add API OpenAPI test assertions where current tests verify route/schema coverage.

## Seed Data

Review current seed data before changing it. The existing Worktrail App project likely already has:

- a current milestone risk saved view;
- blocked/dependency examples;
- due-soon/overdue examples;
- healthy milestone contrast.

Only change seed data if the Playwright milestone review scenario cannot be deterministic from existing rows.

Desired seeded scenario:

- open project `WT`;
- Planning has an at-risk or blocked active milestone;
- milestone review shows at least:
  - total work greater than zero;
  - one risk section with count greater than zero;
  - one recently changed row;
  - one risk link that opens project Work with active chips;
  - owner/maintainer batch triage visible on destination Work page.

If seed changes are required, avoid introducing fragile date assumptions beyond the existing fixed seed dates.

## Testing Plan

### Contract Tests

If no runtime helpers are added in contracts, TypeScript type coverage through API/web builds is enough.

If query serialization helpers are updated, extend existing tests in:

```text
apps/web/src/app/features/work-items/query/work-item-query-serialization.spec.ts
apps/web/src/app/features/work-items/query/work-item-filter-labels.spec.ts
```

Cases:

- project `workRisk` serializes to router query params;
- project `workRisk` parses from query params;
- work-risk chips render readable labels;
- clearing/resetting removes `workRisk`.

### API Tests

Add tests around the endpoint/service:

- active milestone review returns project, milestone, progress, breakdown, risks, recent movement;
- empty milestone returns zero progress and empty risk sections;
- risky milestone returns expected section counts and query payloads;
- archived project milestone review is readable;
- archived milestone review is readable;
- milestone from another project returns not found;
- project from another workspace returns not found;
- `workRisk=unassigned_active` filters project and workspace lists correctly if workspace support is allowed;
- `workRisk=stale_in_progress` respects injected or deterministic stale policy where possible.

Keep date-sensitive tests fixed with an injected clock or deterministic seed timestamps.

### Web Unit Tests

Add page tests for:

- loading and rendering milestone review;
- rendering empty milestone state;
- rendering risk sections and action links;
- rendering recent movement detail links with return URL;
- rendering archived/read-only notices;
- surfacing API errors and retrying;
- Planning page includes milestone review links.

Extend project Work page/query tests for hidden `workRisk` query state if needed.

### Playwright

Add one smoke test to `e2e/worktrail-smoke.spec.ts`:

1. reset/migrate/seed through existing Playwright setup;
2. open Project Planning for seeded Worktrail App project;
3. click `Review milestone` for a known seeded milestone;
4. assert milestone title, health, scoped counts, and a non-empty risk section;
5. click a risk link;
6. assert project Work active chips include milestone and risk/status;
7. assert owner/maintainer bulk selection controls are present;
8. switch actor to contributor and open the same milestone review or destination Work page;
9. assert review content remains readable and batch controls are absent.

Use accessible names where possible. Avoid text that is likely to change from generated dates unless seed data is fixed.

### Final Verification

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run test:e2e
git diff --check
git status --short --branch
```

## Implementation Phases

The implementation plan should break this into roughly:

1. Phase 0: baseline validation and final design decisions.
2. Phase 1: contracts and query model.
3. Phase 2: API milestone review service and endpoint.
4. Phase 3: OpenAPI and API tests.
5. Phase 4: Angular API client, route, and page shell.
6. Phase 5: milestone review rendering and query links.
7. Phase 6: project Work `workRisk` query integration and active chips.
8. Phase 7: Planning page integration.
9. Phase 8: seed review and Playwright smoke.
10. Phase 9: polish, responsive checks, and regression tests.
11. Phase 10: docs, site, release notes, pattern notes, and final verification.

## Risks And Mitigations

### Query Model Scope Creep

Adding `workRisk` could become an advanced query system.

Mitigation: support only `unassigned_active` and `stale_in_progress` in v0.1.7, do not add visible advanced filter controls, and document the field as a URL/action-link filter.

### Delivery Health Divergence

Milestone review could accidentally compute health differently from Planning.

Mitigation: use `DeliveryHealthService.derive` for milestone progress and health reasons. Only compute page-specific previews separately.

### Page Density

The milestone review page could become too noisy.

Mitigation: cap section previews, use compact summaries, and link to project Work for deeper inspection and mutation.

### Date-Sensitive Tests

Overdue, due soon, and stale tests can be brittle.

Mitigation: use fixed clocks in API tests and existing deterministic seed date patterns in Playwright.

### Hidden Query State Confusion

`workRisk` is URL-backed but not exposed as a visible dropdown.

Mitigation: active filter chips must show `Risk: ...`; clearing chips and reset must remove it; the PRD/docs should call this an action-link filter, not a general filter control.

## Documentation Plan

During finalization:

- update README baseline and walkthrough for milestone review;
- update README limitations to note no forecasts/snapshots/roadmaps;
- update public site current-scope copy if milestone review materially changes the product story;
- add `docs/v0.1.7/release-notes.md`;
- add `docs/v0.1.7/pattern-extraction-notes.md` covering:
  - derived review surfaces;
  - query-backed action links;
  - read-only operating pages;
  - aggregation of existing health/risk rules;
  - criteria for deferring persisted snapshots.

Keep pattern notes destination-neutral.
