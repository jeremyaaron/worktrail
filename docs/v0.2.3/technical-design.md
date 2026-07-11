# Worktrail v0.2.3 Technical Design

## Summary

v0.2.3 adds a workspace-level Portfolio review surface.

The implementation should introduce a read-only cross-project aggregation that answers:

- which active projects need attention;
- why they need attention;
- whether project communication is fresh;
- what active cycle or milestone context exists;
- where users should click next to act.

The release should not add a new planning hierarchy, persistence model, or mutation workflow. Portfolio is a derived read model built from existing projects, work items, delivery health, milestones, cycles, and status reports.

## Resolved Decisions

### Route

Use `/portfolio` as the workspace-level route.

Rationale:

- it is short and clearly top-level;
- it does not overload `/projects`, which should remain project navigation/search;
- it leaves room for future workspace-level pages without nesting everything under `/workspace`;
- it matches the user-facing mental model: Portfolio is a workspace operating view, not one project.

### API Endpoint

Add:

```text
GET /api/portfolio
```

Rationale:

- the page needs one cross-project read model, not many frontend fan-out calls;
- the handler remains transport-neutral like existing endpoints;
- a future API Gateway/Lambda adapter can map the same endpoint handler without frontend changes;
- permissions remain tied to the actor's workspace context.

### Persistence

Do not add a database migration for v0.2.3.

Rationale:

- all required data already exists;
- the first release is read-only and can derive current state;
- materialized portfolio snapshots would add invalidation and freshness concerns before the product need is proven.

### Archived Projects

Exclude archived projects from the primary Portfolio review in v0.2.3.

Rationale:

- Portfolio is focused on active execution;
- archived projects remain reachable from Projects and direct project routes;
- including archived rows would dilute urgency ordering and create more read-only edge states.

Archived projects should not be counted in Portfolio summary totals. This can be revisited when portfolio filtering or historical review is added.

### Report Freshness

Use a 14-day stale report threshold.

Rationale:

- it is simple and product-readable;
- it fits a weekly/biweekly status cadence without forcing a ceremony;
- it avoids configurable policy work in the first release.

Freshness values:

```ts
type PortfolioReportFreshness = 'fresh' | 'stale' | 'missing';
```

Report freshness is a communication signal and must not change delivery health.

### Sorting

Use fixed urgency-first ordering in v0.2.3.

Do not add a sortable grid.

Rationale:

- the page's job is to surface operational urgency;
- sorting controls can be added after the row model stabilizes;
- a table-like dense layout can still be scan-friendly without data-grid behavior.

### Link Target Policy

Project-specific risk links should route to project Work or project review pages.

Workspace-level summary links should route to Portfolio sections or workspace Work Items only when they represent a cross-project query.

Rationale:

- project Work preserves project-level context, saved views, bulk triage, and project filters;
- workspace Work Items is best for cross-project discovery;
- every drill-down should land on the surface where action is already supported.

## Current Implementation Context

Relevant existing backend pieces:

```text
apps/api/src/endpoints/projects.ts
apps/api/src/adapters/express/routes/project-routes.ts
apps/api/src/services/project-service.ts
apps/api/src/services/delivery-health-service.ts
apps/api/src/services/work-item-query-link.ts
apps/api/src/services/work-risk-sections.ts
apps/api/src/repositories/project-repository.ts
apps/api/src/repositories/work-item-repository.ts
apps/api/src/repositories/milestone-repository.ts
apps/api/src/repositories/project-cycle-repository.ts
apps/api/src/repositories/project-status-report-repository.ts
```

Relevant frontend pieces:

```text
apps/web/src/app/app.routes.ts
apps/web/src/app/app.component.ts
apps/web/src/app/core/worktrail-api.service.ts
apps/web/src/app/core/api/projects-api.ts
apps/web/src/app/shared/delivery-health/delivery-health-display.ts
apps/web/src/app/features/projects/project-list-page.component.ts
apps/web/src/app/features/work-items/query/work-item-query-serialization.ts
```

Project-level delivery health already derives:

- open work;
- blocked work;
- dependency-blocked work;
- work blocking downstream open work;
- overdue work;
- due-soon work;
- unassigned active work;
- stale in-progress work;
- active/at-risk/blocked milestone state.

Portfolio should reuse these semantics instead of defining new health rules.

## Backend Design

### Contracts

Add portfolio DTOs to `packages/contracts/src/projects.ts` unless the file becomes too broad. If it does, use a new `portfolio.ts` export and re-export from `packages/contracts/src/index.ts`.

Recommended DTOs:

```ts
export type PortfolioReportFreshness = 'fresh' | 'stale' | 'missing';

export type PortfolioAttentionType =
  | 'delivery_risk'
  | 'dependency_pressure'
  | 'communication_freshness'
  | 'current_execution';

export interface PortfolioSummaryDto {
  activeProjectCount: number;
  blockedProjectCount: number;
  atRiskProjectCount: number;
  onTrackProjectCount: number;
  overdueProjectCount: number;
  dependencyPressureProjectCount: number;
  missingOrStaleReportProjectCount: number;
}

export interface PortfolioReportSummaryDto {
  freshness: PortfolioReportFreshness;
  thresholdDays: number;
  latestReport: ProjectStatusReportSummaryDto | null;
  daysSincePublished: number | null;
}

export interface PortfolioPlanningSummaryDto {
  activeMilestone: {
    id: string;
    name: string;
    health: DeliveryHealthState;
    openCount: number;
    targetDate: string | null;
  } | null;
  activeCycle: {
    id: string;
    name: string;
    health: DeliveryHealthState;
    openWorkCount: number;
    endDate: string;
    targetPoints: number | null;
  } | null;
}

export interface PortfolioLinkDto {
  label: string;
  route: string;
  query?: WorkItemQuery;
}

export interface PortfolioProjectRowDto {
  project: ProjectDto;
  deliveryHealth: ProjectDeliveryHealthDto;
  openWorkItemCount: number;
  blockedWorkItemCount: number;
  dependencyBlockedWorkItemCount: number;
  blockingOpenWorkItemCount: number;
  overdueWorkItemCount: number;
  staleInProgressWorkItemCount: number;
  updatedAt: string;
  report: PortfolioReportSummaryDto;
  planning: PortfolioPlanningSummaryDto;
  links: {
    overview: PortfolioLinkDto;
    work: PortfolioLinkDto;
    planning: PortfolioLinkDto;
    reports: PortfolioLinkDto;
    latestReport?: PortfolioLinkDto;
    activeMilestone?: PortfolioLinkDto;
    activeCycle?: PortfolioLinkDto;
    blockedWork?: PortfolioLinkDto;
    dependencyBlockedWork?: PortfolioLinkDto;
    overdueWork?: PortfolioLinkDto;
    staleWork?: PortfolioLinkDto;
  };
}

export interface PortfolioAttentionItemDto {
  type: PortfolioAttentionType;
  project: ProjectDto;
  title: string;
  message: string;
  severity: DeliveryHealthSeverity;
  link: PortfolioLinkDto;
}

export interface PortfolioDto {
  generatedAt: string;
  reportFreshnessThresholdDays: number;
  summary: PortfolioSummaryDto;
  attention: {
    needsAttention: PortfolioAttentionItemDto[];
    communicationFreshness: PortfolioAttentionItemDto[];
    currentExecution: PortfolioAttentionItemDto[];
    dependencyPressure: PortfolioAttentionItemDto[];
  };
  projects: PortfolioProjectRowDto[];
}
```

Implementation may adjust naming, but the shape should preserve these boundaries:

- summary counts;
- row model;
- attention items;
- links;
- report freshness;
- planning context.

### Endpoint

Add a new endpoint module:

```text
apps/api/src/endpoints/portfolio.ts
```

Handler:

```ts
export function getPortfolioHandler(repositories: Repositories): EndpointHandler<PortfolioDto> {
  return async (request) => {
    const service = new PortfolioService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.getPortfolio()
    };
  };
}
```

Register route in the Express adapter. It may live in `project-routes.ts` because the data is project-centered, or in a new `portfolio-routes.ts` if route grouping becomes cleaner. Prefer a new route file only if it avoids crowding `project-routes.ts`.

### Service

Add:

```text
apps/api/src/services/portfolio-service.ts
```

Responsibilities:

- load active projects for the actor workspace;
- load workspace work items with active projects only;
- load milestones for active projects;
- load active cycles for active projects;
- load latest status report for active projects;
- derive delivery health per project using `DeliveryHealthService`;
- derive report freshness;
- build row links;
- sort rows by urgency;
- build attention sections.

Suggested flow:

```ts
async getPortfolio(): Promise<PortfolioDto> {
  const now = this.clock();
  const projects = (await repositories.projects.listByWorkspace(workspaceId))
    .filter((project) => project.status === 'active');

  const workItemRecords = await repositories.workItems.listByWorkspace(workspaceId, {
    archivedProjects: 'exclude',
    sort: 'updated_desc'
  });

  const dependencyBlockedRecords = await repositories.workItems.listByWorkspace(workspaceId, {
    archivedProjects: 'exclude',
    dependency: 'dependency_blocked',
    sort: 'priority_desc'
  });

  const blockingOpenRecords = await repositories.workItems.listByWorkspace(workspaceId, {
    archivedProjects: 'exclude',
    dependency: 'blocking_open_work',
    sort: 'priority_desc'
  });

  // Milestones/cycles/reports can initially fan out by project.
  // If that becomes noisy, add batch repository helpers.
}
```

Fan-out is acceptable for the local seeded scale, but use `Promise.all` only outside transaction-scoped repository contexts. This service is read-only and should not wrap a transaction.

If implementation becomes too chatty or tests show it awkward, add batch repository helpers:

- `milestones.listByWorkspaceProjects(projectIds, options)`;
- `projectCycles.listActiveByWorkspaceProjects(projectIds)`;
- `projectStatusReports.findLatestByWorkspaceProjects(projectIds)`.

Batch helpers are preferred if implementation needs more than one simple fan-out loop for the same entity.

### Health Derivation

Use `DeliveryHealthService.derive` per project.

Inputs per project:

- the project;
- all project work items;
- dependency-blocked project work items;
- blocking-open project work items;
- milestones for that project;
- `now` from service clock.

The row should use `deliveryHealth` directly for:

- health state;
- health reasons;
- open work count;
- blocked work count;
- dependency blocked count;
- blocking open work count;
- overdue count;
- stale in-progress count.

Do not separately recompute project health in Portfolio.

### Active Milestone Selection

Use the derived `milestoneProgress` from `DeliveryHealthService`.

Select one primary active milestone per project:

1. health `blocked`;
2. health `at_risk`;
3. health `healthy`;
4. earliest target date;
5. name ascending.

Only include milestone review links for a selected milestone.

### Active Cycle Selection

Use `projectCycles.findActiveByProject(projectId)` for v0.2.3.

To compute cycle health, either:

- reuse existing `ProjectCycleService` review logic if it can be called without duplicating permission/project reads; or
- compute a compact cycle summary inside `PortfolioService` using the same rules already used for cycle review.

Preferred implementation:

- add a small exported helper in `project-cycle-service.ts` only if current logic is reusable without broad service coupling;
- otherwise derive a compact active-cycle summary in `PortfolioService` from project work items assigned to the active cycle, dependency-blocked ids, and existing work-risk helpers.

Avoid making Portfolio depend on a full project cycle review DTO if the page only needs health, counts, target points, and a link.

### Report Freshness

Use latest published report per active project.

Rules:

- no report: `missing`;
- latest `publishedAt` older than 14 days from service clock: `stale`;
- otherwise: `fresh`.

Use day-level comparison, not exact hour comparison, to avoid brittle tests:

- convert `publishedAt` and `now` to UTC date strings;
- compute whole-day difference.

### Links

`PortfolioLinkDto.route` should be an app route path, not a full URL.

Examples:

```ts
overview: { label: 'Overview', route: `/projects/${project.id}` }
work: { label: 'Work', route: `/projects/${project.id}/work-items` }
planning: { label: 'Planning', route: `/projects/${project.id}/planning` }
reports: { label: 'Reports', route: `/projects/${project.id}/status` }
latestReport: { label: 'Latest report', route: `/projects/${project.id}/status/${report.id}` }
activeMilestone: { label: 'Review milestone', route: `/projects/${project.id}/milestones/${milestone.id}` }
activeCycle: { label: 'Review cycle', route: `/projects/${project.id}/cycles/${cycle.id}` }
blockedWork: {
  label: 'Blocked work',
  route: `/projects/${project.id}/work-items`,
  query: { status: 'blocked', sort: 'priority_desc' }
}
```

Frontend will convert `query` into Angular query params with existing `workItemQueryToRouterQueryParams`.

Do not embed `returnUrl` in `WorkItemQuery`. Return URLs are route-query context and should be added by frontend links that navigate to work item detail, not portfolio-to-list links.

### Attention Sections

Build bounded sections with a maximum of five items each.

`needsAttention`:

- projects with `deliveryHealth.health` of `blocked` or `at_risk`;
- order by health severity and urgency rank;
- link to Planning by default unless the top reason has a more specific Work query.

`communicationFreshness`:

- projects with report `missing` or `stale`;
- missing before stale;
- link to Reports.

`currentExecution`:

- projects with active cycles or active milestones;
- prefer items with blocked/at-risk cycle or milestone health;
- link to active Cycle Review or Milestone Review.

`dependencyPressure`:

- projects with dependency-blocked work or blocking-open-work;
- link to project Work with dependency query.

### Urgency Ranking

Use a deterministic rank helper:

```ts
function portfolioUrgencyRank(row: PortfolioProjectRowDto): number {
  if (row.deliveryHealth.health === 'blocked') return 0;
  if (row.dependencyBlockedWorkItemCount > 0) return 1;
  if (row.overdueWorkItemCount > 0) return 2;
  if (row.deliveryHealth.health === 'at_risk') return 3;
  if (row.report.freshness !== 'fresh') return 4;
  if (row.deliveryHealth.health === 'healthy') return 5;
  return 6;
}
```

Tie-breakers:

1. higher blocked count;
2. higher dependency-blocked count;
3. higher overdue count;
4. most recent `updatedAt`;
5. project name ascending.

### Permissions

Portfolio is readable by any active workspace member, matching project list/read behavior.

Do not add owner/maintainer-only mutation controls. Links may still route to pages where existing permission rules determine what actions are visible.

### Errors

Use existing structured errors.

Expected failure modes:

- inactive/invalid actor: handled by existing actor context;
- repository failure: existing adapter returns structured server error;
- no active projects: return `200` with empty summary and empty arrays.

## Frontend Design

### API Client

Add:

```ts
getPortfolio(): Observable<PortfolioDto>
```

to:

```text
apps/web/src/app/core/api/projects-api.ts
apps/web/src/app/core/worktrail-api.service.ts
```

Endpoint path:

```text
/api/portfolio
```

### Route

Add a lazy route:

```ts
{
  path: 'portfolio',
  loadComponent: () =>
    import('./features/portfolio/portfolio-page.component').then(
      (module) => module.PortfolioPageComponent
    )
}
```

Add a route spec expectation similar to existing route tests.

### Primary Navigation

Add a top-level navigation item:

```text
Portfolio
```

Recommended order:

```text
My Work | Inbox | Portfolio | Work Items | Projects | Workspace Settings
```

Rationale:

- Portfolio is an operating view, closer to My Work/Inbox than project administration;
- Work Items remains the cross-project query surface;
- Projects remains the project directory.

If the current nav becomes too crowded at narrow widths, wrap rather than hiding the route in v0.2.3. A broader navigation redesign is out of scope.

### Component Structure

Add:

```text
apps/web/src/app/features/portfolio/portfolio-page.component.ts
```

Keep route component self-contained for the first release, but extract if styles/template become too large:

```text
portfolio-summary.component.ts
portfolio-attention-section.component.ts
portfolio-project-table.component.ts
portfolio-project-card-list.component.ts
```

Extraction trigger:

- route component styles approach budget warning;
- template becomes hard to test;
- repeated row rendering is needed for desktop and mobile.

### Page Layout

Desktop layout:

1. compact page header;
2. summary strip;
3. attention sections grid;
4. project comparison table.

Mobile layout:

1. page header;
2. summary as two-column compact stat grid;
3. attention sections stacked;
4. project rows as stacked compact records.

Avoid hero treatment, marketing copy, large cards, or nested cards. This is an operating tool.

### Display Rules

Summary:

- show labels and counts;
- use existing health color classes where possible;
- counts should not be icon-only.

Attention sections:

- hide sections with no items only if the empty state would add noise;
- for all-clear cases, show one compact `No portfolio risks surfaced` empty state near attention sections.

Project rows:

- health chip;
- report freshness chip;
- compact reason text;
- counts;
- planning context;
- action links.

Use table markup on desktop if the design remains readable. Use CSS to switch to stacked records on mobile rather than rendering two divergent data trees unless necessary.

### Link Handling

For `PortfolioLinkDto` with no `query`, bind:

```html
<a [routerLink]="link.route">...</a>
```

For links with `query`, convert through existing query helpers:

```ts
portfolioQueryParams(link: PortfolioLinkDto) {
  return link.query ? workItemQueryToRouterQueryParams(link.query, 'project') : {};
}
```

Because `route` is a string path, Angular can use `[routerLink]="link.route"`. If query conversion differs by route target, add a `scope` or `kind` field to `PortfolioLinkDto`; do not infer from string parsing unless implementation remains trivial and well-tested.

Recommended adjustment:

```ts
export interface PortfolioLinkDto {
  label: string;
  route: string;
  query?: WorkItemQuery;
  queryScope?: 'workspace' | 'project';
}
```

### Loading And Error States

Use existing shared components:

- `app-loading-indicator`;
- `app-error-state`;
- `app-empty-state`.

Empty state:

```text
No active projects
Create or reactivate a project to start portfolio review.
```

Only show create-project link if the selected actor already has permission through existing capability APIs or if the link routes to Projects where permission copy already exists. To avoid another API dependency, linking to Projects is enough for v0.2.3.

## Data And Seed Design

Existing seed likely already supports most portfolio states:

- Worktrail App active project with risks, cycles, milestones, dependencies, and a published report;
- Platform project active project with work and saved views;
- archived project for non-primary route behavior.

Seed changes should be minimal:

- ensure at least one active project has no published report or a stale published report;
- ensure seeded dates are relative enough or frozen enough that report freshness tests do not rot;
- ensure one active project has dependency pressure and one appears healthier.

If adding a second seeded published report is needed, prefer using existing `ProjectStatusReportService` to generate it so snapshot shape remains valid.

## Testing Design

### API Tests

Add tests for:

- `GET /api/portfolio` returns active project rows and summary counts;
- archived projects are excluded from rows and summary;
- delivery health is derived consistently with project summary/planning semantics;
- report freshness returns `fresh`, `stale`, and `missing`;
- attention sections are bounded and sorted by urgency;
- drill-down links include expected routes and canonical work queries;
- contributor can read portfolio;
- empty workspace returns empty arrays/counts.

Use service tests for ranking/freshness helpers if endpoint setup becomes too broad.

### Contract Tests

If a new `portfolio.ts` contract file is added, add compile-level tests only if local patterns require it. Runtime validation is not required for response DTOs unless persisted JSON is involved.

### Angular Unit Tests

Add tests for `PortfolioPageComponent`:

- calls `getPortfolio`;
- renders summary counts;
- renders attention sections;
- renders project rows;
- renders report freshness states;
- renders empty state;
- routes query links with expected query params;
- renders error state.

Add API service tests for `/api/portfolio`.

Add route/nav tests for `/portfolio` and top-level navigation.

### E2E Smoke

Add one seeded smoke path:

1. open `/portfolio`;
2. verify summary counts and known seeded project names;
3. verify an attention item;
4. follow a dependency or blocked-work link;
5. confirm the Work page opens with expected active chip and row;
6. return to Portfolio using browser back or link as appropriate;
7. follow latest report or Reports link.

Keep this focused. Do not test every row link in Playwright.

### Verification

Phase and release verification should include:

```sh
npm install --package-lock-only
npm run db:reset
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
```

## Performance Considerations

v0.2.3 can derive Portfolio synchronously per request.

Initial local scale is small. For future scale:

- add batch repository helpers before adding materialized tables;
- keep response DTO bounded and avoid returning work item lists in project rows;
- cap attention sections at five items;
- avoid N+1 report/cycle queries if data volume grows;
- consider a cached/materialized read model only after Portfolio is proven and deployed with larger datasets.

No frontend virtual scrolling or data grid is needed in v0.2.3.

## Security And Permissions

Portfolio reads only projects and related data inside the actor workspace.

Rules:

- use `request.actor.workspaceId` for every workspace query;
- never accept workspace id from route/query input;
- include active projects only;
- return no mutation affordance DTOs;
- rely on linked destination pages for existing owner/maintainer/contributor behavior.

## OpenAPI

Update `docs/api/openapi.yaml` with:

```text
GET /api/portfolio
```

Include representative schemas:

- `Portfolio`;
- `PortfolioSummary`;
- `PortfolioProjectRow`;
- `PortfolioReportSummary`;
- `PortfolioAttentionItem`;
- `PortfolioLink`.

Keep schemas concise; avoid duplicating every nested existing DTO where references already exist.

## Documentation

Update:

- README baseline feature list;
- README repository layout;
- README walkthrough;
- README current limitations if needed;
- `docs/v0.2.3/release-notes.md`;
- `docs/v0.2.3/pattern-notes.md`;
- static site only if the feature materially changes the public story.

Pattern notes should focus on:

- derived portfolio read models;
- freshness as a separate communication signal;
- route-to-action links;
- read-first cross-feature aggregation.

## Risks

### Service Fan-Out

Risk: Portfolio performs many per-project reads.

Mitigation: keep first implementation clear, then add batch repository helpers if implementation or tests show excessive fan-out.

### Duplicate Health Logic

Risk: Portfolio introduces health rules that drift from Planning and Project Summary.

Mitigation: use `DeliveryHealthService` as the only project health derivation path.

### Report Freshness Ambiguity

Risk: users may interpret stale communication as delivery risk.

Mitigation: display freshness separately from delivery health and use distinct copy.

### Page Density

Risk: Portfolio becomes another overloaded dashboard.

Mitigation: compact summary, bounded attention sections, and row comparison first. Defer charts, filters, sorting, and exports.

### Time-Based Test Rot

Risk: freshness and stale-work tests rot as calendar dates move.

Mitigation: inject service clock in backend tests and avoid hard-coded "recent" dates that eventually become stale.

## Deferred

- archived-project portfolio filter;
- custom sorting/filtering;
- portfolio saved views;
- project tags/groups;
- portfolio export;
- workspace rollup reports;
- portfolio snapshots;
- materialized portfolio read model;
- report freshness notifications;
- report cadence configuration;
- cross-project bulk mutation;
- program/initiative hierarchy;
- charts, forecasting, roadmap, and capacity planning.
