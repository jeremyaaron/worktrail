# Worktrail v0.0.1 Implementation Plan

## Purpose

This plan turns the Worktrail PRD and technical design into sequential implementation phases. Each phase should leave the repository in a working state with a coherent diff, useful tests, and enough documentation to keep the next phase straightforward.

v0.0.1 is a local-first MVP. The implementation should build a real Angular + API + Postgres app without overbuilding the future AWS deployment. The cloud path is protected through static frontend output, transport-neutral backend handlers, explicit actor context, SQL migrations, and a database choice that maps cleanly to managed Postgres later.

## Design Decisions

Use these decisions while implementing the approved PRD and technical design:

- Use the product name `Worktrail`.
- Use npm workspaces.
- Use Angular as a static SPA, with a future S3/CloudFront deployment path.
- Use a TypeScript Node.js API.
- Use Express only as the local HTTP adapter.
- Do not implement a Lambda adapter in v0.0.1; preserve the handler contract so it can be added later.
- Use PostgreSQL for local and future production parity.
- Use Drizzle ORM with committed SQL migrations.
- Use Zod for request validation and any schemas shared with the frontend.
- Use UUID primary keys and ISO timestamp strings at the API boundary.
- Use local placeholder actor selection, clearly marked as non-production behavior.
- Use project-scoped labels for v0.0.1.
- Defer human-friendly work item keys.
- Include due date and estimate in the schema if low-cost; expose them in the UI only if they do not slow core workflows.
- Include Playwright as one focused end-to-end smoke test after the core app works.
- Add project activity API support if it falls naturally out of the activity repository; do not make project activity UI a release blocker.
- No npm package release is needed for v0.0.1. A git tag can be considered after the MVP is verified.

## Phase Sizing

A phase should usually fit in one focused implementation pass when:

- it changes a small number of architectural surfaces;
- it has clear acceptance criteria;
- it can be reviewed without understanding unrelated future phases;
- it leaves `npm test`, targeted tests, or a build meaningfully improved;
- it avoids combining backend infrastructure, database changes, and broad UI work in one diff.

If a phase starts producing broad incidental refactors, split it before continuing.

## Phase 0: Baseline Documentation

Goal: confirm the product and technical direction before production code starts.

Scope:

- Confirm `docs/pm-reference-mvp.md` exists as the original scope.
- Confirm `docs/v0.0.1/prd.md` exists.
- Confirm `docs/v0.0.1/technical-design.md` exists.
- Confirm `docs/v0.0.1/implementation-plan.md` exists.
- Resolve remaining open technical choices in this plan.

Out of scope:

- Application scaffold.
- Dependency installation.
- Database setup.

Acceptance criteria:

- The three v0.0.1 planning documents exist.
- The implementation plan records the stack and scope decisions needed to start.
- No unresolved open question blocks Phase 1.

Suggested commands:

```sh
find docs -maxdepth 2 -type f | sort
git status --short --untracked-files=all
```

Status:

- Completed on 2026-07-03.
- Confirmed `docs/pm-reference-mvp.md` exists as the original scope definition.
- Confirmed `docs/v0.0.1/prd.md`, `docs/v0.0.1/technical-design.md`, and `docs/v0.0.1/implementation-plan.md` exist.
- Confirmed the current repository state is docs-only and untracked, which is expected for the initial planning pass.
- Resolved remaining scope choices:
  - use npm workspaces;
  - include one Playwright smoke test after the core app works;
  - do not implement a Lambda adapter in v0.0.1;
  - preserve the transport-neutral handler contract for future Lambda/API Gateway work;
  - add project activity backend support only if it falls naturally out of activity repository work;
  - do not make project activity UI a release blocker;
  - defer human-friendly work item keys;
  - use project-scoped labels;
  - use Postgres and Drizzle from the MVP rather than starting on SQLite.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Workspace And Tooling Scaffold

Goal: turn the documentation-only repository into a runnable npm workspace with Angular, API, and shared-contract package shells.

Scope:

- Create root `package.json` with npm workspaces.
- Create shared TypeScript configuration.
- Scaffold `apps/web` as an Angular app.
- Scaffold `apps/api` as a TypeScript Node package.
- Scaffold `packages/contracts` for shared DTOs and schemas.
- Add root scripts for:
  - `dev`;
  - `dev:web`;
  - `dev:api`;
  - `build`;
  - `build:web`;
  - `build:api`;
  - `test`;
  - `typecheck`;
  - `lint` if selected tooling makes it low-friction.
- Add Docker Compose for local Postgres.
- Add `.env.example` with local configuration.
- Update README with initial local setup commands.

Out of scope:

- Real API endpoints.
- Database migrations.
- Production UI.

Acceptance criteria:

- `npm install` succeeds.
- `npm run build` succeeds or has documented temporary no-op behavior for empty packages.
- `npm run typecheck` succeeds.
- Angular dev server can start.
- API dev server can start with a health placeholder.
- README has enough setup detail for the scaffold.

Suggested commands:

```sh
npm install
npm run typecheck
npm run build
npm test
```

Status:

- Completed on 2026-07-03.
- Created the root npm workspace scaffold with `apps/web`, `apps/api`, and `packages/contracts`.
- Pinned the Angular scaffold to Angular 20.x because the current local runtime is Node `20.19.1`; Angular 22 requires Node `22.22.3` or newer.
- Added root scripts for development, build, typecheck, tests, and Postgres Docker Compose lifecycle.
- Added a minimal Angular Worktrail shell and removed the generated Angular starter page.
- Added a minimal TypeScript API package with a local Express adapter and `GET /api/health`.
- Added a contracts package with an initial health response type.
- Added Docker Compose for local Postgres and `.env.example`.
- Updated the README with Phase 1 setup, service ports, and verification commands.
- `npm install` passed and generated `package-lock.json`.
- `npm run typecheck` passed across API, web, and contracts.
- `npm test` passed across API, web, and contracts. API and contracts currently have placeholder/no-op tests; Angular has the generated app shell tests.
- `npm run build` passed across contracts, API, and web.
- `npm run dev:api` started successfully, and `GET /api/health` returned `{"status":"ok","service":"worktrail-api"}`.
- `npm run dev:web` started successfully on `http://localhost:4200`; Angular analytics was disabled for the local project.
- `docker compose config` passed.
- `npm run db:start` could not be fully verified because the local Docker daemon was not running: `Cannot connect to the Docker daemon at unix:///Users/jeremyaaron/.docker/run/docker.sock`.
- `npm audit --omit=dev --audit-level=low` passed with zero runtime dependency vulnerabilities.
- Full `npm audit --audit-level=low` reports three low-severity development-tooling findings through Angular's compiler/build chain. The npm-suggested fix requires a breaking Angular downgrade, and Angular 22's fixed compiler requires a newer Node line than this environment currently has, so no dependency change was applied in Phase 1.

## Phase 2: Database Schema, Migrations, And Seed Data

Goal: establish real Postgres persistence before building resource behavior.

Scope:

- Add Drizzle configuration to `apps/api`.
- Define database schema for:
  - workspaces;
  - members;
  - projects;
  - work items;
  - labels;
  - work item labels;
  - comments;
  - activity events.
- Add check constraints for role, project status, work item type/status/priority, and activity event type.
- Add initial indexes from the technical design.
- Add migration generation and migration run scripts.
- Add database connection module.
- Add deterministic seed script.
- Add database reset script for local development.
- Seed:
  - one workspace;
  - owner, maintainer, and contributor members;
  - two active projects and one archived project;
  - work items across all statuses;
  - labels;
  - comments;
  - representative activity events.

Out of scope:

- API repository layer beyond what seed needs.
- Frontend data display.
- Full-text search.

Acceptance criteria:

- `npm run db:start` starts local Postgres through Docker Compose.
- `npm run db:migrate` applies migrations.
- `npm run db:seed` creates deterministic demo data.
- Re-running seed is either idempotent or clearly documented as requiring reset.
- Schema and migration files are committed.

Suggested commands:

```sh
npm run db:start
npm run db:migrate
npm run db:seed
npm run typecheck
```

Status:

- Completed on 2026-07-03.
- Added Drizzle ORM, node-postgres, drizzle-kit, and Postgres type dependencies to the API workspace.
- Added `apps/api/drizzle.config.ts`.
- Added the Drizzle schema at `apps/api/src/db/schema.ts` for:
  - workspaces;
  - members;
  - projects;
  - work items;
  - labels;
  - work item labels;
  - comments;
  - activity events.
- Added check constraints for member role, project status, work item type/status/priority, and activity event type.
- Added initial indexes from the technical design.
- Generated and committed the initial migration at `apps/api/drizzle/0000_aberrant_centennial.sql` with Drizzle metadata.
- Added database client, migration, reset, and seed scripts under `apps/api/src/db/`.
- Added root scripts for `db:generate`, `db:migrate`, `db:reset`, and `db:seed`.
- Added deterministic seed data with fixed UUIDs for one workspace, three members, two active projects, one archived project, work items across all statuses, labels, comments, and representative activity events.
- Seed inserts use upserts or conflict-do-nothing behavior so rerunning the seed does not create duplicate demo records.
- Updated README database setup and command documentation.
- `npm run db:generate` passed and produced the initial migration.
- `npm run typecheck` passed.
- `npm run build:api` passed.
- `npm run build` passed after the Phase 2 changes.
- `npm test` passed after the Phase 2 changes.
- `docker compose config` passed.
- `npm run db:start` could not be fully verified because the Docker daemon was not running.
- `npm run db:migrate` reached a local Postgres service but failed authentication for the default `worktrail` user, which indicates the project Docker database was not running and the existing local Postgres installation does not have the expected development credentials.
- `npm run db:seed` was not run because migrations could not be applied against a verified database in this environment.
- `npm audit --omit=dev --audit-level=low` passed with zero runtime dependency vulnerabilities.
- Full `npm audit --audit-level=low` now reports the existing Angular low-severity development-tooling findings plus moderate development-tooling findings through drizzle-kit transitive `@esbuild-kit` dependencies. No runtime dependency vulnerabilities are reported.

## Phase 3: Backend Foundation

Goal: build the API foundation without tying application logic to Express.

Scope:

- Add transport-neutral request/response handler types.
- Add Express adapter.
- Add JSON body parsing and CORS for local Angular development.
- Add typed application error classes.
- Add centralized error-to-response mapping.
- Add actor context model.
- Add local actor selection from development header with seeded-owner fallback.
- Add Zod validation helper.
- Add health endpoint.
- Add basic request logging.
- Add backend test setup with Vitest.

Out of scope:

- Lambda adapter implementation.
- Production auth.
- Resource endpoints beyond health.

Acceptance criteria:

- API server starts locally.
- `GET /api/health` returns a healthy response.
- Express request objects do not leak into service/domain code.
- Application errors map to consistent API error responses.
- Backend foundation tests pass.

Suggested commands:

```sh
npm run dev:api
npm test --workspace apps/api
npm run typecheck
```

Status:

- Completed on 2026-07-03.
- Added transport-neutral `AppRequest`, `AppResponse`, and `EndpointHandler` types.
- Added typed application errors and centralized API error response mapping.
- Added actor context with local seeded-owner fallback.
- Added Express actor resolution from development headers:
  - `x-worktrail-member-id`;
  - `x-worktrail-workspace-id`;
  - `x-worktrail-role`.
- Added Express endpoint adapter so route handlers no longer receive raw Express request/response objects.
- Converted `GET /api/health` to use the endpoint adapter.
- Added a Zod validation helper that throws structured validation errors.
- Added basic request logging for local API requests.
- Added backend tests with Vitest and Supertest covering:
  - health endpoint;
  - default local actor;
  - actor header override;
  - validation error mapping;
  - unexpected error masking;
  - validation helper success/failure.
- Adjusted API TypeScript config so tests are included in typecheck while production build output remains rooted at `src`.
- `npm test --workspace @worktrail/api` passed: 7 tests in 1 test file.
- `npm run typecheck --workspace @worktrail/api` passed.
- `npm run build:api` passed.
- `npm run dev:api` started successfully, and `GET /api/health` returned `{"status":"ok","service":"worktrail-api"}`.
- Full `npm run typecheck` passed.
- Full `npm test` passed.
- Full `npm run build` passed.

## Phase 4: Domain Rules And Repository Layer

Goal: implement reusable domain constants, workflow rules, permissions, and database repositories.

Scope:

- Add domain constants and TypeScript types for:
  - member roles;
  - project statuses;
  - work item types;
  - work item statuses;
  - work item priorities;
  - activity event types.
- Add workflow transition rule module.
- Add minimal permission helpers for:
  - terminal reopen;
  - project archive/reactivate;
  - contributor restrictions where cheap.
- Add repository interfaces and Drizzle implementations for:
  - members;
  - projects;
  - work items;
  - labels;
  - comments;
  - activity events.
- Add transaction helper.
- Add repository tests against Postgres for core reads/writes.

Out of scope:

- HTTP endpoints.
- Angular consumption.
- Complex RBAC.

Acceptance criteria:

- Workflow transition matrix is covered by tests.
- Maintainer/owner terminal reopen is allowed.
- Contributor terminal reopen is rejected.
- Repository tests can create and fetch projects, work items, comments, and activity.
- All write repositories can participate in a transaction.

Suggested commands:

```sh
npm test --workspace apps/api -- domain repositories
npm run typecheck
```

Status:

- Completed on 2026-07-03.
- Added domain constants and TypeScript types for member roles, project statuses, work item types/statuses/priorities, and activity event types.
- Updated the Drizzle schema to import the shared domain constants rather than owning duplicate enum-like values.
- Added workflow transition helpers with coverage for:
  - no-op transitions;
  - normal forward transitions;
  - blocked-to-open transitions;
  - invalid backward transitions;
  - maintainer/owner terminal reopen;
  - contributor terminal reopen rejection.
- Added permission helpers for project archive/reactivate, terminal reopen, and contributor assigned-work updates.
- Added repository factories for:
  - workspaces;
  - members;
  - projects;
  - work items;
  - labels;
  - comments;
  - activity events.
- Added a repository aggregate and transaction helper in `apps/api/src/repositories/index.ts`.
- Added Postgres-backed repository tests that create isolated test data and clean it up after each test.
- Repository tests cover creating and reading members, projects, labels, work items, comments, and activity events.
- Repository tests cover work item filtering by status, assignee, type, priority, and title search.
- Repository tests cover project and work item status updates.
- Repository tests cover repository use inside a transaction.
- `npm test --workspace @worktrail/api -- domain repositories` passed: 13 tests in 2 test files.
- `npm run typecheck --workspace @worktrail/api` passed.
- Full `npm test` passed: API 20 tests across 3 test files, plus existing web/contracts tests.
- Full `npm run build` passed.
- `npm run db:generate` reported no schema changes after moving constants into the domain layer.

## Phase 5: Project And Member API

Goal: expose project and member data through the real API.

Scope:

- Add DTOs and shared contracts for project and member responses.
- Add `MemberService`.
- Add `ProjectService`.
- Add endpoint handlers for:
  - `GET /api/members`;
  - `GET /api/projects`;
  - `POST /api/projects`;
  - `GET /api/projects/:projectId`;
  - `PATCH /api/projects/:projectId`;
  - `GET /api/projects/:projectId/summary`.
- Implement project summary counts by status.
- Record activity only if project-level project events are added later; not required now.
- Add service and endpoint tests.

Out of scope:

- Work item list and detail endpoints.
- Project activity UI.
- Full workspace administration.

Acceptance criteria:

- Seeded projects and members are returned through the API.
- Project creation validates required fields.
- Project archive/reactivate respects maintainer/owner permission.
- Project summary returns status counts and recent work item metadata when available.
- Endpoint tests cover success and validation/error paths.

Suggested commands:

```sh
npm test --workspace apps/api -- projects members
npm run typecheck
```

Status:

- Completed on 2026-07-03.
- Added shared project/member DTO and request/response contract types in `packages/contracts`.
- Added `MemberService`.
- Added `ProjectService`.
- Added service DTO mappers for members, projects, and recent work item summaries.
- Added project repository update support.
- Added work item repository support for project summary counts and recent project work items.
- Added endpoint handlers for:
  - `GET /api/members`;
  - `GET /api/projects`;
  - `POST /api/projects`;
  - `GET /api/projects/:projectId`;
  - `PATCH /api/projects/:projectId`;
  - `GET /api/projects/:projectId/summary`.
- Mounted project/member routes in the Express app when repositories are provided.
- Updated `main.ts` to create the Postgres pool, Drizzle client, repository set, and route-enabled Express app.
- Added Zod validation for project create/update bodies and project id params.
- Implemented project create, list, get, update/archive/reactivate, and summary behavior.
- Implemented maintainer/owner permission checks for archive/reactivate.
- Added project/member endpoint tests against local Postgres with isolated test workspaces and cleanup.
- Adjusted TypeScript path behavior so source typecheck reads contract sources while production API build consumes built contract declarations.
- `npm test --workspace @worktrail/api -- projects members` passed: 8 tests in 1 test file.
- `npm run typecheck --workspace @worktrail/api` passed.
- Full `npm run typecheck` passed.
- Full `npm test` passed: API 28 tests across 4 test files, plus existing web/contracts tests.
- Full `npm run build` passed.
- `npm run dev:api` started successfully.
- Runtime checks against the seeded local database passed:
  - `GET /api/members`;
  - `GET /api/projects`;
  - `GET /api/projects/10000000-0000-4000-8000-000000000201/summary`.

## Phase 6: Work Item API

Goal: implement the central work item create, list, detail, update, filter, and transition behavior.

Scope:

- Add DTOs and schemas for work item list items, details, create, update, filters, and transitions.
- Add `WorkItemService`.
- Implement work item creation.
- Implement project-scoped work item list with filters:
  - status;
  - assignee;
  - type;
  - label;
  - priority;
  - title search.
- Implement sorting by updated date and priority.
- Implement work item detail loading.
- Implement generic field update for title, description, type, priority, assignee, labels, due date, and estimate.
- Implement explicit transition endpoint:
  - `POST /api/work-items/:workItemId/transitions`.
- Record activity for create and tracked field changes.
- Add service and endpoint tests.

Out of scope:

- Comments.
- Angular screens.
- Drag-and-drop.

Acceptance criteria:

- Work items can be created from project context.
- Required fields are validated.
- List filters work for status and assignee at minimum.
- Status transition rules are enforced.
- Assignment updates work.
- Activity events are created for creation, status, assignee, priority, title, description, and label changes.
- Endpoint tests cover valid and invalid transitions.

Suggested commands:

```sh
npm test --workspace apps/api -- work-items activity
npm run typecheck
```

Status:

- Completed on 2026-07-03.
- Added shared work item, label, create/update, transition, filter, and sort contract types in `packages/contracts`.
- Added work item DTO mapping for list and detail responses.
- Added work item repository support for:
  - label filtering;
  - title search;
  - updated-date and priority sorting;
  - status counts;
  - recent project work item summaries;
  - generic field updates.
- Added label repository support for:
  - lookup by ids;
  - listing labels by work item;
  - listing labels for multiple work items;
  - replacing a work item's labels.
- Added `WorkItemService`.
- Implemented project-scoped work item listing with filters for status, assignee, type, label, priority, and title search.
- Implemented work item creation from project context.
- Implemented work item detail loading.
- Implemented generic work item field update for title, description, type, priority, assignee, labels, due date, and estimate.
- Implemented explicit status transition behavior through `POST /api/work-items/:workItemId/transitions`.
- Added workflow enforcement to transitions.
- Added activity recording for:
  - work item created;
  - title changed;
  - description changed;
  - priority changed;
  - assignee changed;
  - label added;
  - label removed;
  - status changed.
- Added endpoint handlers for:
  - `GET /api/projects/:projectId/work-items`;
  - `POST /api/projects/:projectId/work-items`;
  - `GET /api/work-items/:workItemId`;
  - `PATCH /api/work-items/:workItemId`;
  - `POST /api/work-items/:workItemId/transitions`.
- Mounted work item routes in the Express app.
- Added Postgres-backed endpoint tests covering create, validation, list filtering, detail scoping, update/activity recording, valid transition/activity recording, and invalid transition rejection.
- `npm test --workspace @worktrail/api -- work-items activity` passed: 7 tests in 1 test file.
- `npm run typecheck --workspace @worktrail/api` passed.
- Full `npm run typecheck` passed.
- Full `npm test` passed: API 35 tests across 5 test files, plus existing web/contracts tests.
- Full `npm run build` passed.
- `npm run db:generate` reported no schema changes.
- Runtime checks against the seeded local database passed:
  - `GET /api/projects/10000000-0000-4000-8000-000000000201/work-items?status=ready&assigneeId=10000000-0000-4000-8000-000000000102`;
  - `GET /api/work-items/10000000-0000-4000-8000-000000000403`.

## Phase 7: Comments And Activity API

Goal: finish collaboration and timeline behavior on the backend.

Scope:

- Add `CommentService`.
- Add or finalize `ActivityService`.
- Add endpoint handlers for:
  - `GET /api/work-items/:workItemId/comments`;
  - `POST /api/work-items/:workItemId/comments`;
  - `GET /api/work-items/:workItemId/activity`;
  - `GET /api/projects/:projectId/activity` if the repository query is already straightforward.
- Include comments and activity in work item detail response if it reduces frontend round trips.
- Record `comment.added` activity inside the same transaction as comment creation.
- Add service and endpoint tests.

Out of scope:

- Comment editing/deletion.
- Notifications.
- Project activity UI as a release blocker.

Acceptance criteria:

- Comments can be added to work items.
- Comments show author and timestamp.
- Work item activity returns the expected timeline events.
- Comment creation records activity.
- Project activity endpoint exists if it can reuse repository support without extra product work.

Suggested commands:

```sh
npm test --workspace apps/api -- comments activity
npm run typecheck
```

Status:

- Completed on 2026-07-03.
- Added shared contract DTOs for:
  - comments;
  - activity events;
  - comment creation requests;
  - work item details with embedded comments and activity.
- Added `CommentService` for listing comments and adding comments.
- Added `ActivityService` for work item and project timeline reads.
- Added `GET /api/work-items/:workItemId/comments`.
- Added `POST /api/work-items/:workItemId/comments`.
- Added `GET /api/work-items/:workItemId/activity`.
- Added `GET /api/projects/:projectId/activity`.
- Updated work item detail responses to include ordered comments and timeline activity.
- Recorded `comment.added` activity in the same database transaction as comment creation.
- Updated comment repository reads to return comments in creation order.
- Added Postgres-backed endpoint tests for comment creation, validation, comment listing, detail inclusion, work item activity, project activity, and workspace scoping.
- `npm test --workspace @worktrail/api -- comments activity` passed: 5 tests in 1 test file.
- `npm run typecheck --workspace @worktrail/api` passed.
- `npm run typecheck` passed across all workspaces.
- `npm test` passed across all workspaces: API 40 tests in 6 files, Angular 2 tests, contracts no-op test.
- `npm run build` passed across contracts, API, and web.
- Runtime smoke against the seeded local API passed:
  - `GET /api/work-items/10000000-0000-4000-8000-000000000403` returned 2 comments and 6 activity entries;
  - `GET /api/work-items/10000000-0000-4000-8000-000000000403/comments` returned 2 comments;
  - `GET /api/work-items/10000000-0000-4000-8000-000000000403/activity` returned 6 activity entries;
  - `GET /api/projects/10000000-0000-4000-8000-000000000201/activity` returned 6 activity entries.

## Phase 8: Angular App Shell And API Client

Goal: make the Angular app consume the real API and establish the product shell.

Scope:

- Configure Angular environments for local API base URL.
- Add local development proxy for `/api`.
- Add shared API client service or feature API services.
- Add typed DTO imports from `packages/contracts` where useful.
- Add app shell layout.
- Add top-level navigation.
- Add local current-user selector backed by seeded members.
- Add loading, empty, and error UI primitives.
- Add route configuration for projects and work item screens.

Out of scope:

- Full project and work item feature UI.
- Production auth.
- Complex state management library.

Acceptance criteria:

- Angular app starts and calls the API.
- Current user can be selected locally.
- API errors render through a common pattern.
- Routes exist for the planned MVP screens.
- Web typecheck/build passes.

Suggested commands:

```sh
npm run dev:web
npm run build:web
npm run typecheck
```

Status:

- Completed on 2026-07-03.
- Configured the Angular environment to use same-origin `/api`.
- Added an Angular development proxy from `/api` to the local API on `http://localhost:3000`.
- Updated `npm run dev:web` to start Angular with the proxy configuration.
- Added `provideHttpClient()` to the Angular application config.
- Added a typed `WorktrailApiService` for members, projects, project summary, work items, comments, and activity endpoints.
- Added `CurrentUserService` with local selected-member persistence and actor header generation.
- Added a top-level Worktrail shell with primary navigation and a local current-user selector backed by `GET /api/members`.
- Added shared loading, empty, and error UI primitives.
- Added route configuration and placeholder screens for:
  - `/projects`;
  - `/projects/:projectId`;
  - `/projects/:projectId/work-items`;
  - `/projects/:projectId/board`;
  - `/work-items/:workItemId`.
- Added a lightweight projects route that calls `GET /api/projects` and renders API-backed project readiness data.
- Updated Angular app tests for the API-backed member selector and shell navigation.
- `npm run typecheck --workspace @worktrail/web` passed.
- `npm test --workspace @worktrail/web` passed: 2 tests.
- `npm run typecheck` passed across all workspaces.
- `npm test` passed across all workspaces: API 40 tests in 6 files, Angular 2 tests, contracts no-op test.
- `npm run build` passed across contracts, API, and web.
- Runtime development smoke passed:
  - `npm run dev:api` started on `http://localhost:3000`;
  - `npm run dev:web` started on `http://localhost:4200` with the proxy config;
  - `GET http://localhost:4200/projects` returned the Angular app shell;
  - `GET http://localhost:4200/api/members` proxied successfully and returned 3 seeded members.

## Phase 9: Project Views

Goal: implement project list and project home screens.

Scope:

- Build project list view.
- Add active/archived filtering if the API supports it.
- Add project creation form.
- Build project home view with:
  - summary;
  - counts by status;
  - recently updated work items or recent activity;
  - navigation to list and board;
  - create work item action.
- Add frontend tests for project list and creation validation.

Out of scope:

- Work item list implementation.
- Project administration beyond MVP archive/reactivate if already available.

Acceptance criteria:

- Users can view projects.
- Users can create a project.
- Empty project state is handled.
- Project home displays summary counts from API data.
- Frontend tests cover project list rendering and create validation.

Suggested commands:

```sh
npm test --workspace apps/web -- projects
npm run build:web
```

Status:

- Completed on 2026-07-03.
- Replaced the Phase 8 project readiness route with a real project list screen.
- Added client-side project status filtering for all, active, and archived projects.
- Added an inline project creation form backed by `POST /api/projects`.
- Added client-side create validation with a visible required-name message and no API post for invalid submissions.
- Added create success behavior that inserts the created project into the active project list.
- Added a project home screen backed by `GET /api/projects/:projectId/summary`.
- Project home displays:
  - project metadata;
  - work item counts by status;
  - recently updated work items;
  - navigation to work item list and board;
  - a create work item action routed to `/projects/:projectId/work-items/new`.
- Added a placeholder route for `/projects/:projectId/work-items/new` so the project home action has a stable destination for Phase 10.
- Added Angular tests covering project list rendering, archived filtering, create validation, project creation, and project summary rendering.
- `npm test --workspace @worktrail/web -- --include src/app/features/projects/projects-page.component.spec.ts` passed: 4 tests.
- `npm run typecheck --workspace @worktrail/web` passed.
- `npm run typecheck` passed across all workspaces.
- `npm test` passed across all workspaces: API 40 tests in 6 files, Angular 6 tests, contracts no-op test.
- `npm run build` passed across contracts, API, and web.
- Runtime development smoke passed through the Angular proxy:
  - `GET http://localhost:4200/projects` returned the Angular app shell;
  - `GET http://localhost:4200/api/projects` returned 3 seeded projects with active and archived statuses;
  - `GET http://localhost:4200/api/projects/10000000-0000-4000-8000-000000000201/summary` returned the seeded Worktrail App summary with 6 status counts and 5 recent work items.

## Phase 10: Work Item List And Create Flow

Goal: implement the dense work item list and work item creation loop.

Scope:

- Build project-scoped work item list.
- Add filters for:
  - status;
  - assignee;
  - type;
  - label;
  - priority.
- Add title search.
- Add sort controls for updated date and priority.
- Keep filters in query parameters where practical.
- Build create work item route/form.
- Add validation messages.
- Return to detail or list after successful creation.
- Add frontend tests for filters and create validation.

Out of scope:

- Board view.
- Detail comments and activity UI.
- Bulk edits.

Acceptance criteria:

- Users can view a dense project work item list.
- Status and assignee filters work end to end.
- Search by title works.
- Users can create a work item from project context.
- Required field errors are visible.
- Created work item persists after page reload.

Suggested commands:

```sh
npm test --workspace apps/web -- work-items
npm run build:web
```

Status:

- Completed on 2026-07-03.
- Added a project-scoped work item list route at `/projects/:projectId/work-items`.
- Added dense work item rows with title, type, labels, status, assignee, priority, and updated date.
- Added list filters for:
  - status;
  - assignee;
  - type;
  - label;
  - priority.
- Added title search.
- Added sort controls for updated date and priority.
- Kept list filters in route query parameters and sent them through to the API.
- Added a work item create route at `/projects/:projectId/work-items/new`.
- Added create form fields for title, description, type, priority, assignee, due date, and estimate.
- Added required title validation with no API post for invalid submissions.
- Added create success navigation to `/work-items/:workItemId`.
- Extended the Angular API client to support typed work item list filters.
- Added Angular tests covering filtered list API calls, route query-param persistence, create validation, create POST payload, and post-create navigation.
- `npm test --workspace @worktrail/web -- --include src/app/features/work-items/work-items-page.component.spec.ts` passed: 4 tests.
- `npm run typecheck --workspace @worktrail/web` passed.
- `npm run typecheck` passed across all workspaces.
- `npm test` passed across all workspaces: API 40 tests in 6 files, Angular 10 tests, contracts no-op test.
- `npm run build` passed across contracts, API, and web.
- Runtime development smoke passed through the Angular proxy without mutating local seed data:
  - `GET http://localhost:4200/projects/10000000-0000-4000-8000-000000000201/work-items?status=in_progress&search=api` returned the Angular app shell;
  - `GET http://localhost:4200/projects/10000000-0000-4000-8000-000000000201/work-items/new` returned the Angular app shell;
  - `GET http://localhost:4200/api/projects/10000000-0000-4000-8000-000000000201/work-items?status=in_progress&sort=priority_desc` returned one seeded `in_progress` work item.

## Phase 11: Work Item Detail, Comments, And Activity UI

Goal: implement the main collaboration surface.

Scope:

- Build work item detail route.
- Display title, description, status, type, priority, assignee, reporter, labels, timestamps, due date, and estimate where available.
- Add editable controls for status, assignee, priority, type, labels, title, and description.
- Use the explicit transition endpoint for status changes.
- Add comment list and comment form.
- Add activity timeline.
- Add loading, empty, and error states.
- Add frontend tests for comment submission and field updates.

Out of scope:

- Comment editing/deletion.
- Rich text editor.
- File attachments.

Acceptance criteria:

- Users can open work item detail.
- Users can update editable fields.
- Status changes respect backend workflow errors.
- Users can add comments.
- Activity timeline updates after meaningful changes and comments.
- Detail page remains usable on narrower viewports.

Suggested commands:

```sh
npm test --workspace apps/web -- work-item-detail
npm run build:web
```

Status:

- Completed on 2026-07-03.
- Added a real work item detail route at `/work-items/:workItemId`.
- Displayed title, description, status, type, priority, assignee, reporter, attached labels, timestamps, due date, and estimate.
- Added editable controls for title, description, type, priority, assignee, and currently attached labels.
- Added explicit status transition handling through `POST /api/work-items/:workItemId/transitions`.
- Added workflow rejection error UI for failed status transitions.
- Added comment list and comment form backed by `POST /api/work-items/:workItemId/comments`.
- Refreshed the detail payload after comment submission so comments and activity timeline update together.
- Added activity timeline rendering from the embedded detail activity payload.
- Added loading, empty, and error states for detail, comments, and activity.
- Added responsive layout behavior for narrower viewports.
- Added Angular tests covering detail rendering, editable field updates, rejected status transitions, comment submission, and post-comment comment/activity refresh.
- `npm test --workspace @worktrail/web -- --include src/app/features/work-items/work-item-detail-page.component.spec.ts` passed: 4 tests.
- `npm run typecheck --workspace @worktrail/web` passed.
- `npm run typecheck` passed across all workspaces.
- `npm test` passed across all workspaces: API 40 tests in 6 files, Angular 14 tests, contracts no-op test.
- `npm run build` passed across contracts, API, and web.
- Runtime development smoke passed through the Angular proxy without mutating local seed data:
  - `GET http://localhost:4200/work-items/10000000-0000-4000-8000-000000000403` returned the Angular app shell;
  - `GET http://localhost:4200/api/work-items/10000000-0000-4000-8000-000000000403` returned the seeded work item detail with 2 comments and 6 activity entries.

## Phase 12: Board View

Goal: implement the status board without adding unnecessary drag-and-drop complexity.

Scope:

- Build project-scoped board view.
- Render one column per status.
- Render compact cards with title, type, priority, assignee, and labels.
- Add status menu on each card.
- Call transition endpoint when status changes.
- Refresh board state after transitions.
- Add empty column states.
- Add frontend test for board status update interaction.

Out of scope:

- Drag-and-drop.
- Swimlanes.
- WIP limits.
- Custom workflows.

Acceptance criteria:

- Board shows all statuses.
- Cards are grouped by current status.
- Users can move cards through the status menu.
- Invalid transitions return clear UI errors.
- Board remains readable at common laptop widths.

Suggested commands:

```sh
npm test --workspace apps/web -- board
npm run build:web
```

Status:

- Completed on 2026-07-03.
- Added a project-scoped board route at `/projects/:projectId/board`.
- Rendered one board column per work item status:
  - backlog;
  - ready;
  - in progress;
  - blocked;
  - done;
  - canceled.
- Grouped cards by current work item status.
- Rendered compact cards with title, type, priority, assignee, and labels.
- Added a status menu on each card.
- Called `POST /api/work-items/:workItemId/transitions` when a card status changes.
- Refreshed the board from `GET /api/projects/:projectId/work-items` after successful transitions.
- Added clear UI errors for rejected transitions.
- Added empty states for board columns with no cards.
- Kept the board readable at common laptop widths with horizontally scrollable fixed-width columns.
- Added Angular tests covering column rendering, grouped cards, successful status update and refresh, and rejected transition errors.
- `npm test --workspace @worktrail/web -- --include src/app/features/work-items/work-item-board-page.component.spec.ts` passed: 3 tests.
- `npm run typecheck --workspace @worktrail/web` passed.
- `npm run typecheck` passed across all workspaces.
- `npm test` passed across all workspaces: API 40 tests in 6 files, Angular 17 tests, contracts no-op test.
- `npm run build` passed across contracts, API, and web.
- Runtime development smoke passed through the Angular proxy without mutating local seed data:
  - `GET http://localhost:4200/projects/10000000-0000-4000-8000-000000000201/board` returned the Angular app shell;
  - `GET http://localhost:4200/api/projects/10000000-0000-4000-8000-000000000201/work-items?sort=priority_desc` returned 6 seeded work items across all six statuses.

## Phase 13: Product Quality Pass

Goal: bring the MVP from functional to demo-usable.

Scope:

- Review navigation, spacing, typography, and information density.
- Add or improve empty states for:
  - projects;
  - list filters with no results;
  - board columns;
  - comments;
  - activity.
- Review responsive layout for narrow and desktop viewports.
- Review loading and failure states.
- Ensure labels, priorities, statuses, and assignees are visually distinguishable.
- Ensure no core workflow depends on a full page refresh.
- Add README screenshots or usage notes if useful.
- Capture `jawstack` extraction notes in docs.

Out of scope:

- New product features.
- Visual redesign beyond MVP polish.
- Mobile-specific product experience.

Acceptance criteria:

- The app can be demoed from seed data without awkward dead ends.
- Core text fits in its UI containers.
- Local setup documentation matches actual commands.
- Known v0.0.1 limitations are documented.

Suggested commands:

```sh
npm run build
npm test
```

Status:

- Completed on 2026-07-03.
- Fixed QA/UAT issues found during the product-quality pass:
  - detail-page label checkboxes now render at normal control size;
  - detail-page labels load from a project label catalog, so labels can be added back after removal;
  - board status menus now reflect each card's current status, including backlog;
  - board layout now uses the available desktop width instead of constraining columns into an unnecessarily narrow content shell;
  - create-work-item estimate handling now accepts numeric form values without throwing before the API request.
- Added `GET /api/projects/:projectId/labels` so the frontend can present all project labels without depending only on the labels already attached to a work item.
- Improved visual distinction for statuses, priorities, labels, assignees, and work item types in list rows and board cards.
- Added status color accents to project home summary tiles.
- Reviewed and tightened text wrapping in dense card/list surfaces so core labels and titles fit their containers.
- Added README usage notes with a demo walkthrough and documented v0.0.1 limitations.
- Added `docs/v0.0.1/jawstack-extraction-notes.md` with candidate patterns and anti-patterns observed from the MVP implementation.
- `npm run typecheck` passed across API, web, and contracts.
- `npm test` passed across all workspaces: API 41 tests in 6 files, Angular 18 tests, contracts no-op test.
- `npm run build` passed across contracts, API, and web.

## Phase 14: End-To-End Smoke Test And Release Readiness

Goal: verify the MVP as a complete local app.

Scope:

- Add Playwright with one focused smoke path.
- Smoke path:
  1. open projects;
  2. open a project;
  3. create a work item;
  4. move it to in progress;
  5. add a comment;
  6. verify activity appears.
- Add test database reset/seed support for the e2e run.
- Verify clean checkout setup commands.
- Run full typecheck, tests, and builds.
- Update README with final MVP commands.
- Decide whether to create a git tag after user review.

Out of scope:

- Large e2e suite.
- AWS deployment.
- npm release.

Acceptance criteria:

- `npm install` works from a clean checkout.
- Database start, migrate, and seed commands work.
- `npm run dev` starts local web and API servers.
- Playwright smoke test passes.
- Backend tests pass.
- Frontend tests pass.
- Typecheck passes.
- Production build passes.
- README accurately documents local setup and known local-only behavior.

Suggested commands:

```sh
npm install
npm run db:start
npm run db:migrate
npm run db:seed
npm test
npm run test:e2e
npm run typecheck
npm run build
```

## Implementation Notes

### Dependency Discipline

Prefer dependencies that are directly justified by the design:

- Angular packages for the web app.
- Express for local API transport.
- Drizzle and Postgres driver for persistence.
- Zod for validation.
- Vitest for backend tests.
- Playwright for one e2e smoke path.
- A small process runner such as `concurrently` only if it materially improves `npm run dev`.

Avoid adding UI frameworks, global state libraries, background job systems, telemetry stacks, or AWS deployment frameworks in v0.0.1 unless a later phase exposes a concrete need.

### Definition Of Done For Each Phase

Each implementation phase should end with:

- relevant tests passing;
- typecheck passing if code was changed;
- build passing when the phase affects build output;
- README or docs updated when commands or setup change;
- no unrelated refactors mixed into the diff;
- clear notes for deferred work.

### Handling Scope Pressure

If timeline pressure appears, preserve these before polish:

- database migrations and seed data;
- transport-neutral backend handler boundary;
- project list/home;
- work item list/create/detail;
- status transition workflow;
- comments;
- activity recording;
- documented local setup.

Defer these first:

- project activity UI;
- due date and estimate UI;
- Playwright beyond the single smoke path;
- contributor permission restrictions beyond terminal reopen/archive checks;
- Lambda adapter stub code;
- drag-and-drop board interactions.
