# Worktrail v0.1.8 Implementation Plan

## Purpose

This plan turns the v0.1.8 PRD and technical design into sequential implementation phases. v0.1.8 should add Project Status Reports: a project-scoped workflow for generating a status report draft from current project state, editing narrative fields, publishing an immutable snapshot, reading report history, and following live links back into current Work and milestone review surfaces.

The release should preserve the local-first development experience, Angular static-hosting compatibility, transport-neutral API handler structure, Express local adapter, Postgres persistence, deterministic seed data, checked-in OpenAPI docs, CI verification, and clean setup from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.8:

- Add project-shell routes:
  - `/projects/:projectId/status`;
  - `/projects/:projectId/status/new`;
  - `/projects/:projectId/status/:reportId`.
- Add API routes:
  - `GET /api/projects/:projectId/status-reports`;
  - `GET /api/projects/:projectId/status-reports/draft`;
  - `POST /api/projects/:projectId/status-reports`;
  - `GET /api/projects/:projectId/status-reports/:reportId`.
- Add one persisted table: `project_status_reports`.
- Store report snapshots as contract-owned JSONB with `snapshotVersion: 1`.
- Keep published reports immutable in v0.1.8.
- Generate an editable default title: `Status update - YYYY-MM-DD`.
- Allow publishing the reviewed draft snapshot when supplied by the client, after ownership/version validation.
- Regenerate a snapshot at publish time if the client does not supply one.
- Add `status_report.published` to project activity.
- Reuse `DeliveryHealthService`, work-risk policy helpers, existing `workRisk`, existing `WorkItemQuery`, and existing DTO conversion patterns.
- Keep risk preview rows capped at 5.
- Keep recent work capped at 8.
- List/detail reports are readable by contributors and for archived projects.
- Draft/publish are owner/maintainer-only and active-project-only.
- Do not add report edits, report delete/archive, custom templates, scheduled delivery, exports, approvals, comments, workspace rollups, forecasting, roadmaps, or production auth.
- Keep pattern notes destination-neutral.

## Phase Sizing

Each phase should leave the repository in a coherent working state. This release touches shared contracts, activity constants, Drizzle schema and migration metadata, repository registry, a new API service, endpoint routing, API tests, OpenAPI, Angular API clients, project-shell routes/nav, three new Angular pages, optional local snapshot rendering helpers, seed data, Playwright smoke coverage, README, public site, release notes, and pattern notes.

Implementation phases:

1. baseline planning;
2. contracts and activity type;
3. schema, migration, and repository;
4. status report service and snapshot generation;
5. endpoint handlers, Express routes, and API tests;
6. OpenAPI;
7. Angular API client, routes, and project shell nav;
8. status report list page;
9. status report draft and publish page;
10. status report detail and snapshot rendering;
11. seed data, Playwright smoke, and responsive polish;
12. documentation, site, release notes, pattern notes, and final verification.

Run focused contract/API tests after backend phases, focused web tests after frontend phases, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.1.8 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.1.8/prd.md` exists.
- Confirm `docs/v0.1.8/technical-design.md` exists.
- Confirm `docs/v0.1.8/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm sprint docs avoid discontinued extraction-target references.
- Confirm no runtime files have been changed for v0.1.8 yet.
- Confirm whether a `v0.1.8` branch should be checked out before runtime work begins.

Out of scope:

- Runtime implementation.
- Contract changes.
- API changes.
- UI changes.

Acceptance criteria:

- v0.1.8 planning inputs exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.
- Sprint docs use destination-neutral pattern extraction language.

Suggested commands:

```sh
find docs/v0.1.8 -maxdepth 1 -type f | sort
git status --short --branch
rg -n "jawstack|TODO|TBD" docs/v0.1.8
git diff --check
```

Status:

- Not started.

## Phase 1: Contracts And Activity Type

Goal: add shared status report contracts and project activity type without runtime behavior changes.

Scope:

- Update `packages/contracts/src/projects.ts` with:
  - `ProjectStatusReportCountSnapshotDto`;
  - `ProjectStatusReportMilestoneSnapshotDto`;
  - `ProjectStatusReportLinkType`;
  - `ProjectStatusReportLinkDto`;
  - `ProjectStatusReportRiskType`;
  - `ProjectStatusReportRiskSnapshotDto`;
  - `ProjectStatusReportSnapshotDto`;
  - `ProjectStatusReportSummaryDto`;
  - `ProjectStatusReportDetailDto`;
  - `ProjectStatusReportDraftDto`;
  - `CreateProjectStatusReportRequest`.
- Import and reuse existing health, planning, member, project, and work query contracts.
- Update `packages/contracts/src/activity.ts`:
  - add `status_report.published` to `ActivityEventType`.
- Update or add contract tests for:
  - snapshot version;
  - nested snapshot DTO shape;
  - report summary/detail/draft shape;
  - create request shape;
  - `workRisk` inside report risk queries;
  - activity event type.
- Update exports/imports affected by expanded project contracts.

Out of scope:

- Database schema.
- API service implementation.
- OpenAPI.
- Angular pages.

Acceptance criteria:

- Shared contract package compiles.
- Status report DTOs are exported from `@worktrail/contracts`.
- `status_report.published` is a valid contract activity event type.
- Existing contract consumers continue to compile.

Suggested commands:

```sh
npm test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/contracts
npm run lint --workspace @worktrail/contracts
git diff --check
```

Status:

- Not started.

## Phase 2: Schema, Migration, And Repository

Goal: add persistent status report storage and repository access.

Scope:

- Update `apps/api/src/domain/constants.ts`:
  - add `status_report.published` to `activityEventTypes`.
- Update `apps/api/src/db/schema.ts`:
  - add `projectStatusReports`;
  - include `snapshot` as JSONB typed to `ProjectStatusReportSnapshotDto`;
  - include indexes for project published order, workspace/project lookup, and author lookup.
- Generate and commit Drizzle migration and metadata.
- Update `apps/api/src/repositories/types.ts`:
  - add `ProjectStatusReport`;
  - add `NewProjectStatusReport`.
- Add `apps/api/src/repositories/project-status-report-repository.ts` with:
  - `create`;
  - `findById`;
  - `listByProject`;
  - `findLatestByProject`.
- Register repository in `apps/api/src/repositories/index.ts`.
- Add focused repository/schema tests if existing test seams make that worthwhile.
- Update any activity event type inventory tests.

Out of scope:

- Status report service behavior.
- Endpoint handlers.
- Seed report creation.
- Angular work.

Acceptance criteria:

- Migrations apply from a clean reset.
- Repository can create, list, and fetch reports.
- Activity event enum check includes `status_report.published`.
- API workspace compiles.

Suggested commands:

```sh
npm run db:generate --workspace @worktrail/api
npm run db:reset
npm run db:migrate
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 3: Status Report Service And Snapshot Generation

Goal: implement report draft, publish, list, and detail behavior behind a service boundary.

Scope:

- Add `apps/api/src/services/project-status-report-service.ts`.
- Implement:
  - `listProjectStatusReports(projectId)`;
  - `getProjectStatusReport(projectId, reportId)`;
  - `getProjectStatusReportDraft(projectId)`;
  - `publishProjectStatusReport(projectId, input)`.
- Add private helpers for:
  - project validation;
  - owner/maintainer active-project write validation;
  - snapshot generation;
  - client snapshot ownership/version validation;
  - deterministic draft narrative generation;
  - summary/detail DTO conversion.
- Reuse:
  - `DeliveryHealthService`;
  - `work-risk-policy`;
  - existing dependency query repository calls;
  - existing member/milestone/project/work item DTO converters where possible.
- Keep report snapshots deterministic:
  - `snapshotVersion: 1`;
  - risk section order fixed;
  - risk preview cap at 5;
  - recent work cap at 8;
  - active/planned milestone summary rows.
- Publish in a transaction when `db` is available.
- Insert `status_report.published` activity on publish.
- Add DTO conversion helpers in `apps/api/src/services/dto.ts` if appropriate.
- Add focused service tests where endpoint tests would be too broad.

Out of scope:

- HTTP endpoint validation.
- OpenAPI.
- Angular work.
- Seed data.

Acceptance criteria:

- Service can generate a draft from current project state.
- Service can publish an immutable report.
- Contributors cannot publish.
- Archived projects cannot draft/publish.
- List/detail read paths work for contributors and archived projects.
- Publish records project activity.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/status-reports.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 4: Endpoint Handlers, Express Routes, And API Tests

Goal: expose status reports through transport-neutral endpoint handlers and local Express routes.

Scope:

- Add `apps/api/src/endpoints/status-reports.ts`.
- Add Zod validation for:
  - route params;
  - create request body;
  - status date;
  - title length;
  - narrative length/defaults;
  - optional snapshot shape at the structural level needed before service validation.
- Add handlers:
  - `listProjectStatusReportsHandler`;
  - `getProjectStatusReportDraftHandler`;
  - `publishProjectStatusReportHandler`;
  - `getProjectStatusReportHandler`.
- Register routes in `apps/api/src/adapters/express/routes/project-routes.ts`.
- Ensure `/draft` is registered before `/:reportId`.
- Update `apps/api/tests/server.test.ts` route inventory.
- Add `apps/api/tests/status-reports.test.ts` covering:
  - draft generation;
  - owner/maintainer publish;
  - contributor publish rejection;
  - archived project publish rejection;
  - list newest-first;
  - detail;
  - wrong-project report not found;
  - activity event creation;
  - snapshot stability after a source work item changes where practical.

Out of scope:

- OpenAPI.
- Angular client.
- Seed data.

Acceptance criteria:

- All four API routes work through the Express adapter.
- Endpoint handlers stay transport-neutral.
- Validation errors use existing structured error behavior.
- API tests cover permission, archive, not-found, draft, publish, list, detail, and activity paths.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/status-reports.test.ts tests/server.test.ts
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 5: OpenAPI

Goal: document the implemented status report API surface.

Scope:

- Update `docs/api/openapi.yaml` with paths:
  - `GET /api/projects/{projectId}/status-reports`;
  - `GET /api/projects/{projectId}/status-reports/draft`;
  - `POST /api/projects/{projectId}/status-reports`;
  - `GET /api/projects/{projectId}/status-reports/{reportId}`.
- Add schemas:
  - `ProjectStatusReportSummary`;
  - `ProjectStatusReportDetail`;
  - `ProjectStatusReportDraft`;
  - `CreateProjectStatusReportRequest`;
  - `ProjectStatusReportSnapshot`;
  - `ProjectStatusReportCountSnapshot`;
  - `ProjectStatusReportMilestoneSnapshot`;
  - `ProjectStatusReportRiskSnapshot`;
  - `ProjectStatusReportRiskType`.
- Reference existing schemas where possible:
  - `Project`;
  - `Member`;
  - `ProjectDeliveryHealth`;
  - `DeliveryHealthReason`;
  - `PlanningRiskItem`;
  - `WorkItemQuery`.
- Document common errors:
  - validation;
  - forbidden;
  - not found;
  - archived project write rejection.
- Confirm OpenAPI has no stale references to v0.1.7-only route surface.

Out of scope:

- Runtime code changes unless docs reveal a missing route/schema mismatch.
- Angular work.

Acceptance criteria:

- OpenAPI matches implemented route surface and DTO shape.
- Schema names are consistent with existing OpenAPI style.
- API tests still pass after documentation-only changes.

Suggested commands:

```sh
rg -n "status-reports|ProjectStatusReport|status_report" docs/api/openapi.yaml
npm test --workspace @worktrail/api -- tests/status-reports.test.ts tests/server.test.ts
git diff --check
```

Status:

- Not started.

## Phase 6: Angular API Client, Routes, And Project Shell Nav

Goal: wire status report routes and API methods without full page implementation.

Scope:

- Update `apps/web/src/app/core/api/projects-api.ts`:
  - `listProjectStatusReports`;
  - `getProjectStatusReportDraft`;
  - `publishProjectStatusReport`;
  - `getProjectStatusReport`.
- Update `apps/web/src/app/core/worktrail-api.service.ts` to expose those methods.
- Add API client tests for paths, methods, params, and body shape.
- Add placeholder or skeletal lazy components for:
  - `ProjectStatusReportListPageComponent`;
  - `ProjectStatusReportDraftPageComponent`;
  - `ProjectStatusReportDetailPageComponent`.
- Update `apps/web/src/app/app.routes.ts`:
  - add `status`;
  - add `status/new` before `status/:reportId`;
  - add `status/:reportId`.
- Update `apps/web/src/app/app.routes.spec.ts`.
- Update `ProjectShellComponent` nav to include `Status` between Planning and Settings.
- Update `project-shell.component.spec.ts` for the nav.
- Keep placeholder pages simple enough to be replaced in later phases.

Out of scope:

- Full list/draft/detail UI.
- Snapshot rendering.
- Playwright.

Acceptance criteria:

- Routes lazy-load.
- Project shell shows Status.
- API client paths are covered.
- Production build still passes.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/core/worktrail-api.service.spec.ts --include src/app/app.routes.spec.ts --include src/app/features/projects/project-shell/project-shell.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 7: Status Report List Page

Goal: implement project status report list and entry point.

Scope:

- Implement `ProjectStatusReportListPageComponent`.
- Load:
  - project summary;
  - report summaries.
- Render:
  - latest report prominently;
  - previous reports newest-first;
  - empty state;
  - title;
  - status date;
  - health;
  - author;
  - published timestamp.
- Add `Create report` link to `/projects/:projectId/status/new` for active owner/maintainer paths.
- Hide or disable creation for contributors and archived projects with clear copy.
- Reuse existing delivery-health display helpers.
- Add responsive styling and overflow handling for long report titles/project names.
- Add component tests for:
  - loading state;
  - error state;
  - empty state;
  - latest and previous report rendering;
  - create action visibility;
  - archived/contributor absence copy.

Out of scope:

- Draft publish flow.
- Detail snapshot rendering.
- Seed data.

Acceptance criteria:

- Users can navigate to project status reports from project shell.
- Report summaries are readable and link to detail pages.
- Create action respects role/archive state.
- Layout works at common desktop and mobile widths in component-level coverage where practical.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/project-status-report-list-page.component.spec.ts --include src/app/features/projects/project-shell/project-shell.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 8: Status Report Draft And Publish Page

Goal: implement generated draft review, narrative editing, and publish flow.

Scope:

- Implement `ProjectStatusReportDraftPageComponent`.
- Load draft DTO from API.
- Initialize reactive form:
  - title;
  - status date;
  - summary;
  - highlights;
  - risks;
  - next steps.
- Render generated snapshot context read-only enough to review before publishing:
  - health;
  - counts;
  - milestone summary;
  - top risks;
  - recent work.
- Publish using `CreateProjectStatusReportRequest`, including the reviewed snapshot.
- Navigate to `/projects/:projectId/status/:reportId` after publish success.
- Add stable loading, submitting, success navigation, validation, and API error states.
- Gracefully handle forbidden/archived direct route access.
- Add component tests for:
  - generated draft rendering;
  - form validation;
  - successful publish request body;
  - navigation after publish;
  - API error;
  - contributor/archived forbidden copy.

Out of scope:

- Report detail page.
- Autosave drafts.
- Rich-text editing.

Acceptance criteria:

- Owner/maintainer can edit draft narrative and publish.
- Invalid form cannot publish.
- Published request includes the reviewed snapshot.
- Direct forbidden/archived route access does not show a broken form.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/project-status-report-draft-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 9: Status Report Detail And Snapshot Rendering

Goal: implement read-only published report detail and current-data links.

Scope:

- Implement `ProjectStatusReportDetailPageComponent`.
- Add a local snapshot display component if it removes meaningful duplication between draft and detail.
- Render:
  - report metadata;
  - author;
  - status date;
  - published timestamp;
  - summary;
  - highlights;
  - risks;
  - next steps;
  - health and reason chips;
  - count summary;
  - milestone snapshots;
  - risk sections;
  - recent work.
- Build live links:
  - milestone rows to `/projects/:projectId/milestones/:milestoneId`;
  - risk sections to `/projects/:projectId/work-items` with serialized query params;
  - work item rows to `/work-items/:workItemId` with return URL back to the report.
- Clearly indicate that report content is the published snapshot while links open current project data.
- Add responsive styling and overflow handling for long titles and work names.
- Add tests for:
  - metadata/narrative rendering;
  - snapshot rendering;
  - risk query links;
  - milestone links;
  - work item return URLs;
  - contributor read path;
  - archived project read path if component seams allow it.

Out of scope:

- Editing reports.
- Exporting reports.
- Comments/discussion.

Acceptance criteria:

- Published reports open by direct URL.
- Contributors can read reports.
- Snapshot values render from stored DTOs rather than recomputing.
- Links route to valid current app pages.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/project-status-report-detail-page.component.spec.ts --include src/app/features/projects/project-status-report-draft-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 10: Seed Data, Playwright Smoke, And Responsive Polish

Goal: prove the status report workflow in a browser from deterministic seed data.

Scope:

- Update `apps/api/src/db/seed.ts`:
  - seed one active project status report for the main project;
  - use deterministic ids and timestamps;
  - include useful narrative, milestone snapshot, risk snapshot, and recent work;
  - add archived-project report only if it materially improves smoke coverage.
- Ensure seed reset/migrate/seed remains deterministic.
- Add Playwright coverage in `e2e/worktrail-smoke.spec.ts`:
  - open Worktrail App project Status;
  - verify seeded latest report;
  - create a new report as owner;
  - edit one narrative field;
  - publish;
  - verify detail page;
  - follow one risk or milestone link;
  - switch to contributor and verify create is unavailable;
  - check report detail at mobile width for overflow.
- Fix obvious layout issues:
  - long report titles;
  - long milestone/work item titles;
  - nav wrapping/overflow;
  - cramped snapshot sections;
  - unstable publish button state.

Out of scope:

- New product scope.
- Visual snapshot infrastructure.
- Production preview.

Acceptance criteria:

- Seed data supports report list/detail from a fresh reset/migrate/seed.
- Playwright covers seeded report read, publish flow, live link follow-up, and contributor absence path.
- Responsive report layouts remain usable at common desktop and mobile widths.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run test:e2e
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 11: Documentation, Site, Release Notes, Pattern Notes, And Final Verification

Goal: complete the release surface and verify the repository end to end.

Scope:

- Update README:
  - v0.1.8 baseline;
  - project status report capability;
  - generated draft/published snapshot behavior;
  - report permissions and archived-project read-only behavior;
  - limitations around no exports, delivery, approvals, templates, or forecasting.
- Update public static site if status reports should be mentioned in product copy.
- Add `docs/v0.1.8/release-notes.md`.
- Add `docs/v0.1.8/pattern-extraction-notes.md` covering:
  - workflow-driven snapshots;
  - generated drafts;
  - immutable report records;
  - live links from historical reports;
  - report permissions and archive behavior;
  - criteria for deferring generic reporting infrastructure.
- Confirm documentation avoids discontinued extraction-target references.
- Confirm OpenAPI is current.
- Run final verification.
- Record final verification results in the implementation plan.

Out of scope:

- New product scope.
- Release tagging unless explicitly requested.

Acceptance criteria:

- README and public site match implemented capabilities.
- Release notes summarize user-facing and technical changes.
- Pattern notes are destination-neutral.
- OpenAPI matches the route surface.
- Full verification passes or any failures are documented with concrete cause.

Suggested commands:

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

Status:

- Not started.
