# Worktrail v0.1.8 Technical Design

## Summary

v0.1.8 adds Project Status Reports: a project-scoped workflow for generating, publishing, listing, and reading durable status updates.

The release should introduce:

- contract-owned status report DTOs and snapshot DTOs;
- one new Postgres table for published project status reports;
- a transport-neutral status report API service and endpoint handlers;
- a project-shell `Status` section with lazy Angular pages for list, draft, and detail;
- a generated draft based on existing project health, planning, milestone, work-risk, and recent-work data;
- immutable published reports with `snapshotVersion: 1`;
- project activity on publish;
- OpenAPI, seed, browser smoke, release notes, and pattern notes.

Unlike v0.1.7 milestone review, v0.1.8 intentionally persists a narrow snapshot. The workflow is status communication, and readers need the published report to remain stable after project data changes.

## Resolved Product Decisions

### Route Shape

Use separate project-shell child routes:

```text
/projects/:projectId/status
/projects/:projectId/status/new
/projects/:projectId/status/:reportId
```

Rationale:

- list, draft, and detail have different loading and permission states;
- direct report URLs should work on reload;
- a separate draft page avoids crowding the report list;
- routes fit the existing lazy-loaded project shell.

### Report Mutability

Published reports are immutable in v0.1.8.

Rationale:

- immutability keeps the first snapshot workflow honest;
- no approval, correction, audit, or notification workflow exists yet;
- update/delete endpoints can be added later without changing list/detail route shape.

### Snapshot Versioning

Store `snapshotVersion: 1` inside the JSONB snapshot.

Rationale:

- the snapshot is contract-owned but persisted as JSONB;
- future report formats can branch by version;
- this is low-cost insurance against report shape drift.

### Default Title

Generate an editable title:

```text
Status update - YYYY-MM-DD
```

Rationale:

- it gives a useful default;
- user editing keeps reports human-readable in lists.

### Seed Strategy

Seed one active project report for the main demo project. Add an archived-project report only if implementation needs it for a clean Playwright read-only path.

Rationale:

- one seeded report proves list/detail without adding noisy fixture history;
- archived behavior is cheap to cover in API and component tests.

## Current Architecture

Relevant existing pieces:

- `packages/contracts/src/projects.ts`
  - project DTOs and project summary DTOs.
- `packages/contracts/src/planning.ts`
  - `MilestoneProgressDto`;
  - `PlanningRiskItemDto`;
  - milestone review contracts.
- `packages/contracts/src/health.ts`
  - delivery-health states and reason DTOs.
- `packages/contracts/src/work-items.ts`
  - `WorkItemQuery`;
  - `workRisk` from v0.1.7.
- `packages/contracts/src/activity.ts`
  - project activity event types and DTOs.
- `apps/api/src/db/schema.ts`
  - Drizzle schema and enum checks.
- `apps/api/src/services/delivery-health-service.ts`
  - project and milestone health derivation.
- `apps/api/src/services/planning-service.ts`
  - planning risk and review data.
- `apps/api/src/services/milestone-review-service.ts`
  - useful local pattern for derived review sections and query-backed links.
- `apps/api/src/repositories/*`
  - repository registry and transaction helper.
- `apps/api/src/endpoints/*`
  - transport-neutral endpoint handlers.
- `apps/api/src/adapters/express/routes/project-routes.ts`
  - project-scoped Express route registration.
- `apps/web/src/app/features/projects/project-shell/project-shell.component.ts`
  - project shell navigation and project summary header.
- `apps/web/src/app/core/api/projects-api.ts`
  - project API client facade used by `WorktrailApiService`.

## Contracts

Add status report contracts to `packages/contracts/src/projects.ts` unless implementation pressure suggests a dedicated `status-reports.ts`. Keeping them in `projects.ts` is acceptable because reports are strictly project-scoped in v0.1.8.

### Snapshot Counts

```ts
export interface ProjectStatusReportCountSnapshotDto {
  openWorkCount: number;
  blockedWorkCount: number;
  dependencyBlockedWorkCount: number;
  blockingOpenWorkCount: number;
  overdueWorkCount: number;
  dueSoonWorkCount: number;
  unassignedActiveWorkCount: number;
  staleInProgressWorkCount: number;
}
```

These map directly to existing `ProjectDeliveryHealthDto` count fields.

### Snapshot Milestone

```ts
export interface ProjectStatusReportMilestoneSnapshotDto {
  id: string;
  name: string;
  status: MilestoneStatus;
  targetDate: string | null;
  totalCount: number;
  openCount: number;
  doneCount: number;
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

Use denormalized milestone identity fields so historical reports remain readable even if milestone names change later.

### Snapshot Link

```ts
export type ProjectStatusReportLinkType =
  | 'project_work'
  | 'milestone_review'
  | 'work_item';

export interface ProjectStatusReportLinkDto {
  type: ProjectStatusReportLinkType;
  label: string;
  projectId: string;
  query?: WorkItemQuery;
  milestoneId?: string;
  workItemId?: string;
}
```

The API returns semantic links, not concrete Angular URLs. The web layer owns route construction.

### Snapshot Risk

```ts
export type ProjectStatusReportRiskType =
  | 'blocked'
  | 'dependency_blocked'
  | 'overdue'
  | 'due_soon'
  | 'unassigned_active'
  | 'stale_in_progress'
  | 'blocking_open_work';

export interface ProjectStatusReportRiskSnapshotDto {
  type: ProjectStatusReportRiskType;
  title: string;
  count: number;
  query: WorkItemQuery;
  items: PlanningRiskItemDto[];
}
```

Risk item previews should be capped at 5. Counts represent the full risk count at publish time.

### Snapshot DTO

```ts
export interface ProjectStatusReportSnapshotDto {
  snapshotVersion: 1;
  generatedAt: string;
  project: {
    id: string;
    key: string;
    name: string;
    status: ProjectStatus;
  };
  health: ProjectDeliveryHealthDto;
  counts: ProjectStatusReportCountSnapshotDto;
  milestones: ProjectStatusReportMilestoneSnapshotDto[];
  risks: ProjectStatusReportRiskSnapshotDto[];
  recentWork: PlanningRiskItemDto[];
}
```

Design notes:

- `ProjectDeliveryHealthDto` is included as-is because it is already a stable contract.
- Milestones are snapshot-specific because they need denormalized identity and progress fields.
- `recentWork` uses `PlanningRiskItemDto` to match existing recent/risk display shape.

### Summary, Detail, Draft, Create Request

```ts
export interface ProjectStatusReportSummaryDto {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  statusDate: string;
  health: DeliveryHealthState;
  author: MemberDto;
  publishedAt: string;
  createdAt: string;
}

export interface ProjectStatusReportDetailDto extends ProjectStatusReportSummaryDto {
  project: ProjectDto;
  summary: string;
  highlights: string;
  risks: string;
  nextSteps: string;
  snapshot: ProjectStatusReportSnapshotDto;
}

export interface ProjectStatusReportDraftDto {
  project: ProjectDto;
  title: string;
  statusDate: string;
  summary: string;
  highlights: string;
  risks: string;
  nextSteps: string;
  snapshot: ProjectStatusReportSnapshotDto;
}

export interface CreateProjectStatusReportRequest {
  title: string;
  statusDate: string;
  summary: string;
  highlights?: string;
  risks?: string;
  nextSteps?: string;
  snapshot?: ProjectStatusReportSnapshotDto;
}
```

Allowing an optional client-submitted snapshot lets the user publish the exact draft they reviewed. The service must validate that the snapshot belongs to the route project and has `snapshotVersion: 1`. If no snapshot is provided, the API regenerates one at publish time.

## Data Model

Add `project_status_reports` to `apps/api/src/db/schema.ts`.

Recommended Drizzle shape:

```ts
export const projectStatusReports = pgTable(
  'project_status_reports',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    authorMemberId: uuid('author_member_id')
      .notNull()
      .references(() => members.id),
    title: text('title').notNull(),
    statusDate: date('status_date', { mode: 'string' }).notNull(),
    summary: text('summary').notNull(),
    highlights: text('highlights').notNull().default(''),
    risks: text('risks').notNull().default(''),
    nextSteps: text('next_steps').notNull().default(''),
    snapshot: jsonb('snapshot').$type<ProjectStatusReportSnapshotDto>().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull()
  },
  (table) => [
    index('project_status_reports_project_published_idx').on(
      table.projectId,
      table.publishedAt.desc()
    ),
    index('project_status_reports_workspace_project_idx').on(
      table.workspaceId,
      table.projectId
    ),
    index('project_status_reports_author_idx').on(table.authorMemberId)
  ]
);
```

No `updatedAt` is needed because v0.1.8 reports are immutable.

Migration:

- update `schema.ts`;
- run `npm run db:generate --workspace @worktrail/api`;
- commit the generated SQL and Drizzle metadata.

## Constants And Activity

Add project activity event type:

```ts
'status_report.published'
```

Touch points:

- `packages/contracts/src/activity.ts`;
- `apps/api/src/domain/constants.ts`;
- activity event check constraint through generated migration;
- any tests asserting activity event type inventories.

Activity event on publish:

```ts
{
  eventType: 'status_report.published',
  summary: `Published status report "${title}"`,
  previousValue: null,
  newValue: {
    reportId,
    title,
    statusDate
  },
  metadata: {
    reportId
  }
}
```

Do not emit workspace activity in v0.1.8. Reports are project-scoped.

## Repository Layer

Add `apps/api/src/repositories/project-status-report-repository.ts`.

Methods:

```ts
create(input: NewProjectStatusReport): Promise<ProjectStatusReport>;
findById(reportId: string): Promise<ProjectStatusReport | null>;
listByProject(projectId: string): Promise<ProjectStatusReport[]>;
findLatestByProject(projectId: string): Promise<ProjectStatusReport | null>;
```

Add repository types:

- `ProjectStatusReport`;
- `NewProjectStatusReport`.

Register repository in:

- `apps/api/src/repositories/index.ts`;
- tests or helpers that use repository keys.

Ordering:

- list reports by `publishedAt desc`, then `createdAt desc`.

## Service Layer

Add `apps/api/src/services/project-status-report-service.ts`.

Constructor context:

```ts
export interface ProjectStatusReportServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
}
```

Public methods:

```ts
listProjectStatusReports(projectId: string): Promise<ProjectStatusReportSummaryDto[]>;
getProjectStatusReport(projectId: string, reportId: string): Promise<ProjectStatusReportDetailDto>;
getProjectStatusReportDraft(projectId: string): Promise<ProjectStatusReportDraftDto>;
publishProjectStatusReport(
  projectId: string,
  input: CreateProjectStatusReportRequest
): Promise<ProjectStatusReportDetailDto>;
```

### Project Validation

Use one private `requireProject(projectId)` helper:

- project must exist;
- project workspace must match actor workspace.

Creation additionally requires:

- project status is `active`;
- actor role is `owner` or `maintainer`.

Read methods allow archived projects and contributors.

### Snapshot Generation

Create a private `generateSnapshot(project, now)` method.

Inputs to load:

- project work items sorted by priority or updated time where needed;
- dependency-blocked work items;
- blocking-open work items;
- project milestones including archived where useful for display, but active report snapshot should include only planned/active milestones by default;
- workspace members.

Reuse:

- `DeliveryHealthService.derive` for project health, milestone progress, and planning review;
- `work-risk-policy` for risk windows;
- `workRisk` query semantics from v0.1.7;
- DTO converters from `dto.ts`.

Snapshot policy:

- `generatedAt`: API clock ISO timestamp;
- `snapshotVersion`: `1`;
- counts copied from `ProjectDeliveryHealthDto`;
- milestones: planned/active milestones first, then any blocked/at-risk completed/canceled only if needed by health reasons. Recommended initial rule: include planned and active milestones only.
- risks: deterministic sections in this order:
  1. blocked;
  2. dependency blocked;
  3. overdue;
  4. due soon;
  5. unassigned active;
  6. stale in progress;
  7. blocking open work.
- risk preview cap: 5;
- recent work cap: 8, sorted by `updatedAt desc`.

### Draft Narrative Generation

Draft fields should be deterministic plain text.

Recommended defaults:

- `summary`: one sentence based on health and open work, for example `Project is at risk with 12 open work items and 2 blocked items.`
- `highlights`: empty string unless recently completed work is easy to derive without extra scope.
- `risks`: join top non-empty risk section titles and counts, or `No major delivery risks are currently flagged.`
- `nextSteps`: empty string.

Keep this simple. The user owns the real narrative.

### Publish Behavior

Use a transaction when `db` is available:

1. validate project and actor;
2. validate and normalize input;
3. choose snapshot:
   - client snapshot if valid and route-project-owned;
   - otherwise regenerated snapshot;
4. insert report;
5. insert `status_report.published` activity event;
6. return detail DTO.

If `db` is not available, the service can still call repositories sequentially for tests that do not need transaction semantics, but production route registration should pass `db`.

### Snapshot Validation

Validate only structural and ownership-critical fields:

- `snapshotVersion === 1`;
- `snapshot.project.id === project.id`;
- `snapshot.project.key` and `snapshot.project.name` are non-empty;
- `snapshot.generatedAt` is a valid ISO-ish string;
- risk queries do not reference another project concept;
- milestone ids in milestone links belong to the route project where practical.

Do not recompute and deep-compare every count at publish time. That would make a reviewed draft fragile if work changes between draft and publish.

### Text Validation

Use Zod endpoint validation:

- `title`: trimmed, 1 to 120 characters;
- `statusDate`: ISO date string, `YYYY-MM-DD`;
- `summary`: trimmed, 1 to 4000 characters;
- `highlights`: trimmed, max 4000, default `''`;
- `risks`: trimmed, max 4000, default `''`;
- `nextSteps`: trimmed, max 4000, default `''`.

## Endpoint Layer

Add `apps/api/src/endpoints/status-reports.ts`.

Handlers:

```ts
listProjectStatusReportsHandler(options): EndpointHandler<ProjectStatusReportSummaryDto[]>
getProjectStatusReportDraftHandler(options): EndpointHandler<ProjectStatusReportDraftDto>
publishProjectStatusReportHandler(options): EndpointHandler<ProjectStatusReportDetailDto>
getProjectStatusReportHandler(options): EndpointHandler<ProjectStatusReportDetailDto>
```

Route params:

```ts
projectId: uuid
reportId: uuid
```

Create body:

```ts
CreateProjectStatusReportRequest
```

Status codes:

- list: `200`;
- draft: `200`;
- publish: `201`;
- detail: `200`;
- not found: existing `404` behavior;
- validation: existing `400` behavior;
- permission: existing forbidden behavior;
- archived publish: existing conflict/validation style used for archived project writes.

## Express Routes

Register in `apps/api/src/adapters/express/routes/project-routes.ts`:

```ts
app.get(
  '/api/projects/:projectId/status-reports',
  adaptEndpoint(listProjectStatusReportsHandler(options), adapterOptions)
);
app.get(
  '/api/projects/:projectId/status-reports/draft',
  adaptEndpoint(getProjectStatusReportDraftHandler(options), adapterOptions)
);
app.post(
  '/api/projects/:projectId/status-reports',
  adaptEndpoint(publishProjectStatusReportHandler(options), adapterOptions)
);
app.get(
  '/api/projects/:projectId/status-reports/:reportId',
  adaptEndpoint(getProjectStatusReportHandler(options), adapterOptions)
);
```

Ordering matters: register `/draft` before `/:reportId`.

Update route inventory tests in `apps/api/tests/server.test.ts`.

## API DTO Conversion

Add converters in `apps/api/src/services/dto.ts`:

- `toProjectStatusReportSummaryDto(report, author)`;
- `toProjectStatusReportDetailDto(report, project, author)`.

Author loading:

- use `members.findById`;
- allow inactive historical authors if workspace matches;
- if author is missing, fail with not found rather than inventing a placeholder.

## Frontend API

Add methods to `ProjectsApi`:

```ts
listProjectStatusReports(projectId: string): Observable<ProjectStatusReportSummaryDto[]>;
getProjectStatusReportDraft(projectId: string): Observable<ProjectStatusReportDraftDto>;
publishProjectStatusReport(
  projectId: string,
  input: CreateProjectStatusReportRequest
): Observable<ProjectStatusReportDetailDto>;
getProjectStatusReport(
  projectId: string,
  reportId: string
): Observable<ProjectStatusReportDetailDto>;
```

Expose through `WorktrailApiService`.

Add API client tests for paths, methods, and body shape.

## Angular Routes

Update project-shell children in `apps/web/src/app/app.routes.ts`:

```ts
{
  path: 'status',
  loadComponent: () =>
    import('./features/projects/project-status-report-list-page.component').then(
      (module) => module.ProjectStatusReportListPageComponent
    ),
  title: 'Status Reports | Worktrail'
},
{
  path: 'status/new',
  loadComponent: () =>
    import('./features/projects/project-status-report-draft-page.component').then(
      (module) => module.ProjectStatusReportDraftPageComponent
    ),
  title: 'New Status Report | Worktrail'
},
{
  path: 'status/:reportId',
  loadComponent: () =>
    import('./features/projects/project-status-report-detail-page.component').then(
      (module) => module.ProjectStatusReportDetailPageComponent
    ),
  title: 'Status Report | Worktrail'
}
```

Ordering matters: `status/new` before `status/:reportId`.

Update project shell nav:

```text
Overview | Work | Board | Planning | Status | Settings
```

The current shell nav already scrolls horizontally on narrow widths. Add regression coverage for the new label.

## Angular Components

### Status Report List Page

File:

```text
apps/web/src/app/features/projects/project-status-report-list-page.component.ts
```

Responsibilities:

- load project summary and report list;
- show latest report;
- show previous reports;
- route to detail;
- route to draft for active owner/maintainer users;
- show contributor and archived-project absence copy.

The component can infer create availability from project status plus workspace capabilities/current actor if already exposed. If the web app does not have a clean role capability helper for project mutation, use the same local logic as existing project batch triage controls.

### Status Report Draft Page

File:

```text
apps/web/src/app/features/projects/project-status-report-draft-page.component.ts
```

Responsibilities:

- load draft DTO;
- initialize reactive form with title, status date, summary, highlights, risks, next steps;
- render generated snapshot context read-only;
- publish via API;
- navigate to detail on success;
- show validation/API errors;
- block publish while invalid or submitting.

Form controls:

- title: required, max 120;
- status date: required;
- summary: required, max 4000;
- highlights/risks/next steps: max 4000.

Do not autosave drafts in v0.1.8.

### Status Report Detail Page

File:

```text
apps/web/src/app/features/projects/project-status-report-detail-page.component.ts
```

Responsibilities:

- load detail DTO;
- show metadata and narrative sections;
- show snapshot health, counts, milestones, risks, and recent work;
- render links into current app surfaces:
  - milestone rows to `/projects/:projectId/milestones/:milestoneId`;
  - risk queries to `/projects/:projectId/work-items` with serialized query params;
  - work items to `/work-items/:workItemId` with return URL back to the report.
- label links as current-data navigation where needed.

Use existing helper functions for:

- delivery-health labels and tones;
- work item status/priority display if available;
- project Work query serialization.

## Shared Web Helpers

If the three pages duplicate snapshot rendering heavily, add a local component:

```text
apps/web/src/app/features/projects/status-reports/status-report-snapshot.component.ts
```

Keep it local to the project feature, not global shared UI, unless another feature already needs it.

Recommended inputs:

```ts
snapshot: ProjectStatusReportSnapshotDto;
projectId: string;
returnUrl?: string;
```

Use this component from draft and detail pages.

## URL And Query Links

Report links should use semantic snapshot data and existing query serialization.

Risk query mapping:

- blocked: `{ status: 'blocked', sort: 'priority_desc' }`;
- dependency blocked: `{ dependency: 'dependency_blocked', sort: 'priority_desc' }`;
- overdue: `{ due: 'overdue', sort: 'priority_desc' }`;
- due soon: `{ due: 'due_soon', sort: 'priority_desc' }`;
- unassigned active: `{ workRisk: 'unassigned_active', sort: 'priority_desc' }`;
- stale in progress: `{ workRisk: 'stale_in_progress', sort: 'priority_desc' }`;
- blocking open work: `{ dependency: 'blocking_open_work', sort: 'priority_desc' }`.

Do not add new query fields for v0.1.8.

Report links are live current-data links. The report content remains the published snapshot.

## Permissions

API:

- list/detail/draft require active actor in project workspace;
- list/detail allow contributors and archived projects;
- draft should require owner/maintainer and active project because it exists only to publish;
- publish requires owner/maintainer and active project.

Frontend:

- contributors can see list/detail but no create button;
- archived projects can see list/detail but no create button;
- draft route should handle API forbidden/archived errors gracefully if accessed directly.

Use existing actor context and role policy. Do not trust client role data.

## Archived And Historical Behavior

Archived projects:

- list existing reports;
- read report details;
- reject draft and publish.

Historical authors:

- display inactive members normally through `MemberDto`;
- no actor selection changes are needed.

Changed source data:

- project and milestone names in snapshot remain as published;
- live links may open current names/state;
- report detail copy should indicate links open current data.

## OpenAPI

Update `docs/api/openapi.yaml` with:

- paths:
  - `GET /api/projects/{projectId}/status-reports`;
  - `GET /api/projects/{projectId}/status-reports/draft`;
  - `POST /api/projects/{projectId}/status-reports`;
  - `GET /api/projects/{projectId}/status-reports/{reportId}`;
- schemas:
  - `ProjectStatusReportSummary`;
  - `ProjectStatusReportDetail`;
  - `ProjectStatusReportDraft`;
  - `CreateProjectStatusReportRequest`;
  - `ProjectStatusReportSnapshot`;
  - snapshot child schemas;
- common errors for validation, not found, forbidden, and archived-project write attempts.

## Seed Data

Add one seeded report for the main active project.

Recommended seed behavior:

- create after work items, milestones, and relationships are seeded;
- use deterministic ids;
- use a deterministic snapshot generated by helper functions or a static snapshot that matches seed data closely enough for demo purposes.

Prefer using the same snapshot generation service during seed only if doing so does not make seed setup circular or slow. A static seed snapshot is acceptable if tests do not assert every count.

Seeded report should include:

- non-empty summary;
- at least one risk narrative;
- at least one milestone snapshot;
- at least one risk link;
- recent work.

## Testing

### Contract Tests

Add tests for:

- create request shape;
- draft/detail/summary DTO shape;
- snapshot version and nested snapshot sections;
- risk/query snapshot carrying `workRisk`.

Suggested command:

```sh
npm test --workspace @worktrail/contracts
```

### API Tests

Add `apps/api/tests/status-reports.test.ts`.

Coverage:

- draft generation returns current project state and editable defaults;
- owner/maintainer can publish;
- contributor publish is rejected;
- archived project publish is rejected;
- list returns summaries newest first;
- detail returns snapshot and narrative;
- cross-project report id is not found under wrong project route;
- publish creates `status_report.published` project activity;
- stored snapshot remains stable after a work item changes, if practical.

Update:

- route inventory tests;
- activity event type tests if present;
- migration/schema tests if present.

### Web Tests

Component/API tests:

- route inventory includes `status`, `status/new`, and `status/:reportId`;
- project shell nav includes Status;
- API client methods use expected paths;
- list page renders empty/seeded/contributor/archived states;
- draft page loads generated context, validates required fields, publishes, and navigates;
- detail page renders narrative/snapshot sections and builds links.

### Playwright

Add one smoke path:

1. open Worktrail App project Status;
2. verify seeded latest report;
3. create a new report as owner;
4. edit summary or next steps;
5. publish;
6. verify detail page;
7. follow one risk or milestone link;
8. switch to contributor and verify create is unavailable;
9. check report detail at a mobile width for overflow.

## Implementation Order

Recommended phases:

1. contracts and PRD/design closure;
2. schema, migration, constants, repository;
3. status report service and snapshot generation;
4. endpoint handlers, Express routes, API tests;
5. OpenAPI;
6. Angular API client and route/nav registration;
7. report list page;
8. report draft/publish page;
9. report detail/snapshot rendering;
10. seed and Playwright smoke;
11. docs, site, release notes, pattern notes, final verification.

## Verification

Final verification should run:

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

## Risks And Mitigations

### Snapshot Shape Drift

Persisted JSONB can become difficult to reason about if the shape is informal.

Mitigation: define snapshot DTOs in contracts, validate `snapshotVersion`, and keep v0.1.8 immutable.

### Duplicate Risk Logic

Report generation could drift from Planning and milestone review.

Mitigation: reuse `DeliveryHealthService`, `work-risk-policy`, and v0.1.7 risk query semantics.

### Confusing Historical And Live Data

Report detail contains historical snapshot data but links to current app surfaces.

Mitigation: label links as current-data links and keep snapshot values visually grouped as published status.

### Navigation Crowding

Adding Status could crowd project shell navigation.

Mitigation: keep the label short, rely on existing horizontal nav behavior, and add responsive tests.

### Overbuilt Reporting

Status reports could become a full reporting platform.

Mitigation: one fixed project-scoped report format, immutable publish only, no exports, no scheduled delivery, no custom templates.

## Deferred Work

- editable/correctable published reports;
- report deletion/archive;
- Markdown/PDF export;
- email or chat delivery;
- scheduled reports;
- report comments;
- approvals/sign-off;
- workspace or portfolio rollups;
- custom templates;
- richer history comparison;
- external stakeholder access;
- production authentication and hosted deployment assets.
