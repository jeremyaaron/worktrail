# Worktrail

Worktrail is a project management reference app. The v0.1.2 baseline is a local-first Angular + TypeScript API + Postgres application focused on daily team workflow, collaboration updates, reliable filtered work views, cross-project discovery, dependency-aware planning, workspace governance, data portability, and production-shaped application boundaries.

The app includes My Work, Action Inbox, top-level Work Items discovery, URL-backed filters, copyable filtered-view links, saved views, quick work capture, persistent project workspaces, planning review, milestone management, durable boards, work item relationships, dependency-blocked signals, project delivery health, comments, mentions, work item watchers, activity, CSV import/export, production-like preview, health/readiness checks, checked-in API documentation, CI, lint, and responsive work item scanning.

The app is intentionally built as a credible product surface before extracting broader framework patterns. It runs locally today, while preserving a path toward an S3/CloudFront Angular frontend with API Gateway/Lambda-style endpoint handlers and managed Postgres.

## Repository Layout

```text
apps/
  api/      TypeScript Node API with a local Express adapter
  web/      Angular SPA
packages/
  contracts/ Shared DTO and API contract types
docs/
  v0.0.X/  Archived v0.0.1-v0.0.9 sprint docs
  v0.1.0/  Consolidation PRD, technical design, implementation plan, audits, and extraction notes
  v0.1.1/  Action Inbox PRD, technical design, implementation plan, release notes, and extraction notes
  v0.1.2/  Reliable filtered views PRD, technical design, implementation plan, release notes, and extraction notes
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

Production preview builds contracts, the API, and the Angular app, then runs compiled API code while Express serves the built Angular assets and `/api/*` routes from one origin.

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

## Reliable Filtered Views

v0.1.2 treats work item query state as a product contract. Project work item lists, workspace discovery, active filter chips, saved views, dashboard links, delivery-health links, detail return URLs, copy-link actions, and CSV export all use the same applied `WorkItemQuery` semantics.

Key behavior:

- Filtered workspace and project work item URLs are shareable and reloadable.
- Active filter chips describe the applied query, not pending form edits.
- Dropdown filter changes apply immediately; search updates after a short debounce.
- "Copy link" copies the current applied filtered view with canonical query parameters.
- Personal saved views store normalized query state and open through canonical URL parameters.
- Saved-view summaries count meaningful filters only; default sort and default archived-project mode stay quiet.
- CSV export uses the currently applied filters, so exports match the visible filtered result set rather than draft form values.
- Dashboard, planning, and delivery-health reason links route into filtered work item lists using the same query conversion rules.

## CSV Import And Export

v0.0.7 added project-scoped CSV work item import and CSV export for both project lists and workspace discovery. v0.1.2 tightened export trust by routing export requests through applied canonical query state.

Import is a two-step flow:

1. Preview validates a CSV file and returns normalized rows without creating work.
2. Apply revalidates the same CSV and creates all rows transactionally.

If any row is invalid during apply, no work items are created. Project and workspace exports use the same applied filters as the visible list or discovery view, so exported CSV matches the current result set rather than pending draft search input.

The detailed CSV guide is in [docs/v0.0.7/csv-import-export.md](docs/v0.0.7/csv-import-export.md).

## Relationships And Dependency Signals

v0.0.8 adds work item relationships and derived dependency visibility.

Relationship support includes:

- directional `blocks` relationships;
- symmetric `relates_to` relationships;
- same-project and cross-project relationships within the same workspace;
- duplicate, self-link, cross-workspace, archived-project, and blocking-cycle rejection;
- relationship add/remove controls on the work item detail page;
- grouped detail views for `Blocked by`, `Blocks`, and `Related work`;
- relationship activity events on the work item where the relationship command is performed.

Dependency signals are derived from open blocking relationships. A work item is dependency-blocked when it has at least one open upstream blocker. Terminal blockers, currently `done` and `canceled`, do not keep downstream work dependency-blocked.

The project work item list, cross-project workspace discovery, saved work views, and CSV export all support the same dependency filter values:

- `dependency=dependency_blocked` finds open work blocked by upstream open work.
- `dependency=blocking_open_work` finds open work that blocks downstream open work.

My Work includes a dependency-blocked assigned summary and section. Planning includes dependency-blocked work and blocking-open-work risk sections. The OpenAPI reference documents the relationship endpoints, dependency query parameter, and relationship DTOs.

## Delivery Health And Planning Review

Derived delivery health appears on project overview and planning surfaces.

Delivery-health support includes:

- project-level health states: on track, at risk, blocked, complete, and inactive;
- compact delivery-health panels on project overview;
- detailed planning delivery-health summaries with active, on-track, at-risk, blocked, and open-work counts;
- milestone health labels and explainable reason chips;
- reason links into filtered project work item lists when the current work-item query model supports the reason;
- planning review sections for needs attention, upcoming work, and recently changed work;
- deterministic seed examples for blocked, at-risk, healthy, complete, inactive, and unmilestoned risk scenarios.

Delivery health is derived at read time from milestones, work item status, due dates, assignees, stale in-progress work, and dependency relationships. It is not stored in the database and does not trigger automatic workflow transitions.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
```

CI runs `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` on pull requests and pushes to `main`. The verify job provisions a Postgres service, sets `DATABASE_URL`, and runs `npm run db:reset && npm run db:migrate && npm run db:seed` before tests. Playwright remains a local smoke test because it provisions and resets a local Postgres-backed app.

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
- same-project, cross-project, and related-work relationships;
- dependency-blocked examples where open blockers count and terminal blockers do not;
- active work item watchers, comment mention metadata, unread notifications, and one read notification;
- personal saved work views for each active seeded member;
- project labels, comments, deleted-comment tombstones, project activity, and workspace activity events.

Use the `Acting as` selector in the top bar to switch the local placeholder actor. The selector only shows active members. This is intentionally local-only behavior and is not production authentication; the API derives the actor role and active state from the selected member record instead of trusting a client-supplied role.

Suggested walkthrough:

1. Open My Work and review the selected actor's assigned open, due soon, overdue, blocked, stale, and reported work counts.
2. Click a My Work summary count to open the cross-project Work Items page with URL-backed filters applied.
3. Change cross-project filters for project, assignee, reporter, status, type, label, milestone, priority, due date, blocked state, archived projects, and sort.
4. Save a useful cross-project filter as a personal saved view, reload the page, and reopen it.
5. Copy the filtered workspace view link, open it in another tab, and confirm the same applied chips and results appear.
6. Use the global Create work item route, select a project, choose project-dependent labels or milestones, create work, and open the created item.
7. Open Projects, search by project name or key, and review project summary signals for open, blocked, overdue, status, and last updated state.
8. Open Workspace Settings and review role summaries, members, and workspace activity.
9. As Avery Owner, create a contributor, promote the member to maintainer, deactivate the member, and reactivate the member.
10. Confirm the actor selector updates when active members are created, changed, deactivated, and reactivated.
11. Switch to a maintainer and confirm project creation is available, then create a project with an explicit key.
12. Switch to a contributor and confirm member administration is unavailable with clear helper copy.
13. Open the Worktrail App project.
14. Review the project key, status counts, recently updated work, and activity.
15. Open Planning and review milestone progress, overdue/due-soon work, blocked work, unassigned work, and stale work.
16. Review dependency-blocked and blocking-open-work planning sections, then follow a dependency list link into filtered project work.
17. Create a milestone, then create a work item assigned to that milestone.
18. Use the project work item list search and filters. Dropdown filters apply immediately, while search applies after a short debounce.
19. Filter by dependency state to find dependency-blocked work or work blocking downstream items.
20. Copy the filtered project work item list link and reload it to confirm the same applied view.
21. Save a dependency-filtered view, reload, and reopen it.
22. Export the currently filtered project work item list to CSV.
23. Import a small CSV through the project import page, review dry-run validation, apply it, and confirm created work appears in the project list and board.
24. Export a filtered cross-project workspace discovery view to CSV.
25. Open Inbox and review unread notifications for the selected actor.
26. Mark an individual notification read, switch to All, and mark it unread again.
27. Open the board, drag cards within a column to set planning order, reload, and confirm the order persists.
28. Move a card through valid workflow columns with drag/drop or the status menu.
29. Open the work item detail page, update fields, change milestone assignment, watch or unwatch the item, mention an active member in a new comment, add and edit another comment, delete a comment, and review activity.
30. Switch to the mentioned actor and confirm the mention appears as an unread Inbox notification linking back to the work item.
31. Add a blocking relationship, confirm the downstream dependency signal appears, move the blocker to done, and confirm the dependency signal clears.
32. Open the archived project to confirm read-only project, milestone, work item, label, comment, relationship, import, and transition behavior.

Suggested delivery-health checks:

1. Open the Worktrail App project overview and review the compact delivery-health panel.
2. Follow a delivery-health reason link into a filtered project work item list.
3. Open Planning and review project delivery health, milestone health labels, and milestone reason chips.
4. Review Needs attention, Upcoming, and Recently changed planning review sections.
5. Confirm blocked and dependency-blocked seed items affect project health, while the healthy milestone remains on track.

## v0.1.2 Baseline Capabilities

- My Work dashboard for the selected active actor.
- Prioritized My Work daily queue for assigned, due-soon, overdue, blocked, dependency-blocked, stale, reported, and recently updated work.
- Inbox with unread/all views for actor-scoped collaboration notifications.
- Unread notification count badge in primary navigation and Inbox summary from My Work.
- Notification read/unread actions and mark-all-read support.
- Top-level Work Items destination for cross-project discovery.
- Dashboard summary counts linked to filtered cross-project discovery.
- Cross-project work item discovery with URL-backed search, filters, sorts, project identity, archived-project modes, and active filter pills.
- Canonical work item query helpers for form state, route params, saved views, return URLs, dashboard links, delivery-health links, and exports.
- Copy-link actions for workspace and project filtered work item views.
- Reloadable filtered URLs whose active chips and result set survive browser refresh.
- Compact mobile work item cards for readable work scanning on narrow screens.
- Personal saved work views with create, open, rename, update, delete, duplicate-name validation, and stale-query tolerance.
- Saved-view summaries that suppress default query noise and count meaningful applied filters.
- Global quick work capture at `/work-items/new` with active project selection and project-dependent labels and milestones.
- Project-scoped work item creation still works with the project preselected and the same success actions.
- Persistent project shell with project identity, status, delivery health, and consistent Overview, Work, Board, Planning, and Settings navigation.
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
- Review-first planning with Planning Review and Milestones views.
- Project work item list search and filters for status, type, priority, assignee, reporter, label, milestone, due date, dependency state, and sort.
- Project-scoped CSV import with dry-run preview, normalized rows, row-level validation errors, and transactional apply.
- Project and workspace CSV export that serializes the currently applied filters through canonical query params.
- CSV import/export guide under `docs/v0.0.7/csv-import-export.md`.
- Work item relationships with directional `blocks` and symmetric `relates_to` semantics.
- Cross-project relationships inside the same workspace with project identity shown in relationship rows.
- Blocking-cycle, duplicate, self-link, cross-workspace, and archived-project relationship write validation.
- Work item detail relationship sections for inbound blockers, outbound blocked work, and related work.
- Derived dependency counts on list rows, including compact `Blocked by` and `Blocks` indicators.
- Dependency filters on project work item lists and cross-project workspace discovery.
- Saved work views and CSV export support for dependency filters.
- My Work dependency-blocked assigned summary and section.
- Planning dependency risk sections for dependency-blocked work and work blocking open downstream items.
- Project overview delivery-health panel with health state, milestone risk counts, open-work count, top reasons, and planning link.
- Planning delivery-health summary with active, on-track, at-risk, blocked, and open-work counts.
- Milestone health labels and explainable health reason chips on planning progress rows.
- Planning review sections for needs attention, upcoming work, and recently changed work.
- Delivery-health reason links into filtered project work item lists where the reason can be represented by current query parameters.
- Deterministic seed data for healthy, at-risk, blocked, complete, inactive, and unmilestoned delivery-health examples.
- Relationship activity events for add/remove commands.
- In-app notification persistence for assignments, mentions, watched comments, watched work changes, and dependency blocker changes.
- Work item watch/unwatch controls with watcher count and compact watcher list on detail pages.
- Automatic watching for work item reporters, assignees, and newly assigned members.
- Comment mentions through an active-member picker, persisted mention metadata, and readable mention chips.
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
- ESLint guardrails for API, web, and contracts workspaces.
- GitHub Actions CI for lint, typecheck, tests with a Postgres service, and production build.

## v0.1.2 Limitations

- Authentication is represented by local request headers and the top-bar actor selector.
- Permissions are enforced against local member records and are useful for exercising policy paths, but they are not production authentication.
- Production preview is not a secure public deployment and should not be exposed as an authenticated product.
- Delivery health is deterministic and rule-based; custom health formulas, forecasting, critical path analysis, charts, delivery-health notifications, and saved review snapshots are deferred.
- Notifications are in-app only. Email, push, WebSockets, digests, notification preferences, deletion/archive controls, and background delivery workers are deferred.
- Comment mentions are selected through an active-member picker. Rich-text editing and free-text `@name` parsing are deferred.
- Watchers are work-item scoped only. Project-level and workspace-level watching are deferred.
- Saved views are personal only in v0.1.2; workspace-visible shared saved views are deferred.
- Copy-link support uses browser clipboard APIs and a textarea fallback. Native share sheets, short links, and permission customization are deferred.
- CSV import is project-scoped and limited to 1 MiB and 250 data rows per file.
- CSV import supports Worktrail's current columns only; third-party tracker migration mappings are deferred.
- CSV export is a direct file download; export history, scheduled exports, and alternate formats are deferred.
- Relationships support only `blocks` and `relates_to`; custom relationship types, hierarchy, and graph visualization are deferred.
- Dependency-blocked state is derived from current open blockers; critical path analysis, external dependency alerts, and automation rules are deferred.
- Relationship activity is recorded on the command context item only to avoid noisy cross-project activity.
- Custom workflows, file attachments, and production auth are intentionally out of scope.
- Invitations, multi-workspace switching, custom roles, project-specific membership, pinned projects, recent projects, and audit export are intentionally out of scope.
- The local Express adapter is the only runtime adapter in v0.1.2, though endpoint handlers are structured so a Lambda/API Gateway adapter can be added later.
- AWS deployment assets are not included yet; the Angular static build and transport-neutral handlers preserve that path.
- Readiness checks database connectivity only; migration drift detection, metrics, tracing, and managed deployment runbooks are deferred.

## Database Status

The current schema includes workspace activity, member lifecycle metadata, project keys, scoped work item display keys, labels, milestones, comments, comment mentions, project activity, due dates, durable board positions, work item relationships, work item watchers, notifications, and personal saved work views.

Useful database commands:

```sh
npm run db:generate  # generate a migration from the Drizzle schema
npm run db:migrate   # apply committed migrations
npm run db:seed      # upsert deterministic demo data
npm run db:reset     # drop and recreate the local public schema
```

`npm run db:reset` refuses to run against non-local database hosts unless `WORKTRAIL_ALLOW_DATABASE_RESET=true` is set.

The default development database URL is documented in [.env.example](.env.example).
