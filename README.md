# Worktrail

Worktrail is a project management reference app. The v0.0.7 release is a local-first Angular + TypeScript API + Postgres application that focuses on daily team workflow, operational credibility, and data portability: My Work, cross-project discovery, saved views, quick work capture, workspace governance, planning, durable boards, comments, activity, CSV import/export, production-like preview, health/readiness checks, and checked-in API documentation.

The app is intentionally built as a credible product surface before extracting broader framework patterns. It runs locally today, while preserving a path toward an S3/CloudFront Angular frontend with API Gateway/Lambda-style endpoint handlers and managed Postgres.

## Repository Layout

```text
apps/
  api/      TypeScript Node API with a local Express adapter
  web/      Angular SPA
packages/
  contracts/ Shared DTO and API contract types
docs/
  v0.0.1/  MVP PRD, technical design, implementation plan, and extraction notes
  v0.0.2/  Adoption sprint PRD, technical design, implementation plan, and extraction notes
  v0.0.3/  Planning sprint PRD, technical design, implementation plan, and extraction notes
  v0.0.4/  Governance sprint PRD, technical design, implementation plan, and extraction notes
  v0.0.5/  Daily workflow PRD, technical design, implementation plan, and extraction notes
  v0.0.6/  Operations sprint PRD, technical design, implementation plan, runbook, and extraction notes
  v0.0.7/  CSV import/export PRD, technical design, implementation plan, guide, and extraction notes
  api/     OpenAPI reference
site/       Static GitHub Pages product site
e2e/        Playwright smoke tests
```

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- Docker, for the local Postgres container
- Playwright browser dependencies for end-to-end smoke tests

## Local Setup

Install dependencies:

```sh
npm install
```

Install the Playwright Chromium browser used by the e2e smoke test:

```sh
npx playwright install chromium
```

Start local Postgres:

```sh
npm run db:start
```

Apply migrations and seed demo data:

```sh
npm run db:migrate
npm run db:seed
```

Start the API and web app together:

```sh
npm run dev
```

Or run them separately:

```sh
npm run dev:api
npm run dev:web
```

Local services:

- Web: <http://localhost:4200>
- API: <http://localhost:3000>
- API liveness: <http://localhost:3000/api/health/live>
- API readiness: <http://localhost:3000/api/health/ready>
- Postgres: `localhost:5432`

## Production Preview

v0.0.6 introduced a production-like local preview. It builds contracts, the API, and the Angular app, then runs compiled API code while Express serves the built Angular assets and `/api/*` routes from one origin.

After migrations and seed data are in place:

```sh
DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run preview
```

Equivalent explicit sequence:

```sh
npm run build
DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run start:prod
```

Production preview requires an explicit `DATABASE_URL`. It is useful for local operational inspection, but it is not a secure internet-facing deployment and does not add production authentication.

Preview checks:

```sh
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
curl -I http://localhost:3000/my-work
curl -I http://localhost:3000/work-items/new
```

The detailed operator guide is in [docs/v0.0.6/operations-runbook.md](docs/v0.0.6/operations-runbook.md).

## API Reference

The checked-in OpenAPI reference lives at [docs/api/openapi.yaml](docs/api/openapi.yaml). It documents the implemented route surface, representative DTOs, development-only local actor headers, readiness behavior, and the common structured error shape.

## CSV Import And Export

v0.0.7 adds project-scoped CSV work item import and CSV export for both project lists and workspace discovery.

Import is a two-step flow:

1. Preview validates a CSV file and returns normalized rows without creating work.
2. Apply revalidates the same CSV and creates all rows transactionally.

If any row is invalid during apply, no work items are created. Project and workspace exports use the same applied filters as the visible list or discovery view, so exported CSV matches the current result set rather than pending draft search input.

The detailed CSV guide is in [docs/v0.0.7/csv-import-export.md](docs/v0.0.7/csv-import-export.md).

## Verification

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
```

`npm run test:e2e` starts the local API and Angular dev server through Playwright. By default it runs:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
```

The Playwright suite resets, migrates, and seeds before the browser run, then restores deterministic seed data after mutation-heavy tests. That means the local `public` schema for the configured database is dropped and recreated. Set `WORKTRAIL_E2E_SKIP_DB_RESET=true` only when you intentionally want to run the smoke test against an already prepared local database. Set `WORKTRAIL_E2E_SKIP_DB_RESTORE=true` only when you intentionally want to inspect post-test mutations.

## Public Site

The static GitHub Pages site lives in `site/`. The Pages workflow publishes that directory when changes land on `main`.

## Demo Walkthrough

After migrating and seeding the database, open <http://localhost:4200>.

Seeded data includes:

- one workspace;
- active owner, maintainer, and contributor members;
- one inactive historical member with seeded references;
- two active projects and one archived project;
- project milestones with due dates and lifecycle state;
- work items across every status with persisted board positions;
- personal saved work views for each active seeded member;
- project labels, comments, deleted-comment tombstones, project activity, and workspace activity events.

Use the `Acting as` selector in the top bar to switch the local placeholder actor. The selector only shows active members. This is intentionally local-only behavior and is not production authentication; the API derives the actor role and active state from the selected member record instead of trusting a client-supplied role.

Suggested v0.0.7 walkthrough:

1. Open My Work and review the selected actor's assigned open, due soon, overdue, blocked, stale, and reported work counts.
2. Click a My Work summary count to open the cross-project Work Items page with URL-backed filters applied.
3. Change cross-project filters for project, assignee, reporter, status, type, label, milestone, priority, due date, blocked state, archived projects, and sort.
4. Save a useful cross-project filter as a personal saved view, reload the page, and reopen it.
5. Use the global Create work item route, select a project, choose project-dependent labels or milestones, create work, and open the created item.
6. Open Projects, search by project name or key, and review project summary signals for open, blocked, overdue, status, and last updated state.
7. Open Workspace and review role summaries, members, and workspace activity.
8. As Avery Owner, create a contributor, promote the member to maintainer, deactivate the member, and reactivate the member.
9. Confirm the actor selector updates when active members are created, changed, deactivated, and reactivated.
10. Switch to a maintainer and confirm project creation is available, then create a project with an explicit key.
11. Switch to a contributor and confirm member administration is unavailable with clear helper copy.
12. Open the Worktrail App project.
13. Review the project key, status counts, recently updated work, and activity.
14. Open Planning and review milestone progress, overdue/due-soon work, blocked work, unassigned work, and stale work.
15. Create a milestone, then create a work item assigned to that milestone.
16. Use the project work item list search and filters. Dropdown filters apply immediately, while search applies after a short debounce.
17. Export the currently filtered project work item list to CSV.
18. Import a small CSV through the project import page, review dry-run validation, apply it, and confirm created work appears in the project list and board.
19. Export a filtered cross-project workspace discovery view to CSV.
20. Open the board, drag cards within a column to set planning order, reload, and confirm the order persists.
21. Move a card through valid workflow columns with drag/drop or the status menu.
22. Open the work item detail page, update fields, change milestone assignment, add and edit a comment, delete a comment, and review activity.
23. Open the archived project to confirm read-only project, milestone, work item, label, comment, import, and transition behavior.

## v0.0.7 Capabilities

- My Work dashboard for the selected active actor.
- Dashboard summary counts linked to filtered cross-project discovery.
- Cross-project work item discovery with URL-backed search, filters, sorts, project identity, archived-project modes, and active filter pills.
- Personal saved work views with create, open, rename, update, delete, duplicate-name validation, and stale-query tolerance.
- Global quick work capture at `/work-items/new` with active project selection and project-dependent labels and milestones.
- Project-scoped work item creation still works with the project preselected and the same success actions.
- Project navigation summaries with project search by name/key, active/archived grouping, open count, blocked count, overdue count, and updated timestamp.
- Workspace settings for workspace name, role summary, member administration, and workspace activity.
- Owner-only member creation, profile editing, role changes, deactivation, and reactivation.
- Server-derived actor roles from selected member records.
- Active/inactive member handling across actor selection, assignment controls, filters, historical assignees, comments, and activity display.
- Permission-aware UI copy for owner-only, owner/maintainer-only, archived-project, inactive-member, and terminal-work-item states.
- Project creation with optional explicit project keys and role-aware disabled states.
- Lazy-loaded Angular route components that keep the production initial bundle below the configured warning budget.
- Project keys and immutable work item display keys.
- Project settings for metadata, archive/reactivate, and label administration.
- Project-scoped milestones with due dates, archive/reactivate behavior, assignment on create/edit, and activity coverage.
- Planning dashboard with milestone progress, due-soon/overdue work, blocked work, unassigned work, stale work, and links back into filtered lists.
- Project work item list search and filters for status, type, priority, assignee, reporter, label, milestone, due date, and sort.
- Project-scoped CSV import with dry-run preview, normalized rows, row-level validation errors, and transactional apply.
- Project and workspace CSV export that serializes the currently applied filters.
- CSV import/export guide under `docs/v0.0.7/csv-import-export.md`.
- Persisted board ordering for same-status reorder and cross-status movement.
- Angular CDK drag/drop board interaction backed by server-side workflow validation.
- Comment add/edit/delete with role-aware UI affordances and deleted-comment tombstones.
- Workspace, project, milestone, label, work item, board movement, saved view, and comment lifecycle coverage through tests and activity where applicable.
- Archived projects remain readable and block project, milestone, work item, label, comment, and transition writes.
- Runtime configuration validation with development defaults and production-mode requirements.
- Production preview from built Angular and compiled API artifacts.
- Express static serving with SPA deep-link fallback that does not swallow `/api/*` routes.
- Liveness and database readiness endpoints at `/api/health/live` and `/api/health/ready`.
- OpenAPI reference under `docs/api/openapi.yaml`.
- Operations runbook for runtime modes, environment variables, migrations, seed/reset flow, preview, health checks, troubleshooting, and future cloud mapping.

## v0.0.7 Limitations

- Authentication is represented by local request headers and the top-bar actor selector.
- Permissions are enforced against local member records and are useful for exercising policy paths, but they are not production authentication.
- Production preview is not a secure public deployment and should not be exposed as an authenticated product.
- Saved views are personal only in v0.0.7; workspace-visible shared saved views are deferred.
- CSV import is project-scoped and limited to 1 MiB and 250 data rows per file.
- CSV import supports Worktrail's current columns only; third-party tracker migration mappings are deferred.
- CSV export is a direct file download; export history, scheduled exports, and alternate formats are deferred.
- Custom workflows, file attachments, notifications, and production auth are intentionally out of scope.
- Invitations, multi-workspace switching, custom roles, project-specific membership, pinned projects, recent projects, and audit export are intentionally out of scope.
- The local Express adapter is the only runtime adapter in v0.0.7, though endpoint handlers are structured so a Lambda/API Gateway adapter can be added later.
- AWS deployment assets are not included yet; the Angular static build and transport-neutral handlers preserve that path.
- Readiness checks database connectivity only; migration drift detection, metrics, tracing, and managed deployment runbooks are deferred.

## Database Status

The current schema includes workspace activity, member lifecycle metadata, project keys, scoped work item display keys, labels, milestones, comments, project activity, due dates, durable board positions, and personal saved work views.

Useful database commands:

```sh
npm run db:generate  # generate a migration from the Drizzle schema
npm run db:migrate   # apply committed migrations
npm run db:seed      # upsert deterministic demo data
npm run db:reset     # drop and recreate the local public schema
```

`npm run db:reset` refuses to run against non-local database hosts unless `WORKTRAIL_ALLOW_DATABASE_RESET=true` is set.

The default development database URL is documented in [.env.example](.env.example).
