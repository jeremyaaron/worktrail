# Worktrail

Worktrail is a project management reference app. The v0.2.4 baseline is a local-first Angular + TypeScript API + Postgres application focused on daily team workflow, workspace portfolio review, collaboration updates, reliable filtered work views, pinned workspace and project operating lenses, explicit project batch triage, milestone review, cycle planning and closeout, published project reports and Markdown sharing, cross-project discovery, dependency-aware planning, workspace governance, data portability, and production-shaped application boundaries.

The app includes My Work, Portfolio review, Action Inbox, top-level Work Items discovery, URL-backed filters, copyable filtered-view links, personal saved views, workspace-shared saved views, project-scoped personal and shared saved views, pinned saved-view shortcuts, project-scoped bulk updates, quick work capture, persistent project workspaces, live planning review, live milestone review, cycle management and review, generated report drafts, immutable published report snapshots with cycle context, Markdown copy/download for published reports, print-friendly report detail pages, milestone/cycle/work links from reports, milestone management, durable boards, work item relationships, dependency-blocked signals, project delivery health, comments, mentions, work item watchers, activity, CSV import/export, production-like preview, health/readiness checks, checked-in API documentation, CI, lint, and responsive work item scanning.

The app is intentionally built as a credible product surface before generalizing reusable patterns. It runs locally today, while preserving a path toward an S3/CloudFront Angular frontend with API Gateway/Lambda-style endpoint handlers and managed Postgres.

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
  v0.1.x/  Incremental v0.1 product sprint docs
  v0.2.0/  Consolidated Operating Baseline PRD, technical design, implementation plan, audits, release notes, and pattern notes
  v0.2.1/  Cycle Planning PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.2/  Saved Views Ergonomics PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.3/  Portfolio Review PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.4/  Cycle Closeout PRD, technical design, implementation plan, release notes, and pattern notes
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

The detailed operator guide is in [docs/v0.0.X/v0.0.6/operations-runbook.md](docs/v0.0.X/v0.0.6/operations-runbook.md).

## API Reference

The checked-in OpenAPI reference lives at [docs/api/openapi.yaml](docs/api/openapi.yaml). It documents the implemented route surface, representative DTOs, development-only local actor headers, readiness behavior, and the common structured error shape.

## Portfolio Review

v0.2.3 adds a top-level Portfolio review at `/portfolio`. Portfolio is a read-only workspace operating surface that compares active projects without requiring a user to open each project individually.

Portfolio support includes:

- active-project summary counts for on-track, at-risk, blocked, overdue, dependency-pressure, and stale-or-missing-report projects;
- bounded attention sections for delivery risk, communication freshness, current execution, and dependency pressure;
- project comparison rows with delivery health, health reasons, work counts, report freshness, latest report details, active milestone context, and active cycle context;
- action links into existing Overview, Work, Planning, Reports, latest report, milestone review, cycle review, and risk-specific filtered Work pages;
- canonical `WorkItemQuery` conversion for Portfolio drill-down links, using each link's project or workspace query scope;
- deterministic seed data that shows blocked/risky projects, a healthy comparison project, fresh and missing report states, active planning context, and dependency pressure.

Portfolio is derived at read time from existing projects, work items, delivery health, milestones, cycles, and status reports. It does not add stored portfolio snapshots, new planning hierarchy, charts, custom sorting, exports, portfolio filters, historical portfolio review, or cross-project mutation workflows.

## Reliable Filtered Views And Saved Work Views

v0.1.2 treats work item query state as a product contract. v0.1.3 extends that contract into team-shared workspace saved views. v0.1.4 adds project-scoped saved views for reusable project operating lenses. v0.1.5 promotes important saved views into pinned shortcuts on the relevant workspace or project Work page. Project work item lists, workspace discovery, active filter chips, personal saved views, workspace-shared saved views, project personal/shared saved views, pinned shortcuts, dashboard links, delivery-health links, detail return URLs, copy-link actions, and CSV export all use the same applied `WorkItemQuery` semantics.

Key behavior:

- Filtered workspace and project work item URLs are shareable and reloadable.
- Active filter chips describe the applied query, not pending form edits.
- Dropdown filter changes apply immediately; search updates after a short debounce.
- "Copy link" copies the current applied filtered view with canonical query parameters.
- Personal saved views store normalized query state and remain private to the selected actor within their scope.
- Workspace-shared saved views store normalized cross-project discovery queries and are visible to all active workspace members.
- Project-scoped saved views store normalized project Work page queries and are isolated from workspace discovery views and other projects.
- Pinned saved views are compact shortcuts for existing saved views; pinning does not change the saved query, scope, visibility, or canonical route behavior.
- Workspace pinned views appear on top-level Work Items, while project pinned views appear on the owning project Work page.
- Shared pinned views appear before personal pinned views, with each group sorted alphabetically by saved-view name.
- Owners and maintainers can create, rename, update, and delete workspace-shared saved views and shared project saved views.
- Owners and maintainers can pin and unpin shared workspace and shared project saved views.
- Contributors can create personal project views and open shared workspace/project views, but cannot manage shared views.
- Contributors can open shared pinned views, but shared pin/unpin controls are hidden from contributor paths.
- Personal saved views can be pinned or unpinned only by their owner.
- Project saved views remain openable for archived projects, but archived projects block project-scoped saved-view create, update, and delete operations.
- Archived projects still show existing pinned project shortcuts, but archived project saved views cannot be pinned or unpinned.
- Personal and shared saved views open through canonical URL parameters, so copy links and CSV exports stay aligned with the applied query.
- Saved views can be opened from a compact selector without expanding management controls.
- Opening a saved view shows local confirmation that the results below were updated.
- `Manage views` edits one selected saved view at a time instead of rendering rename and mutation controls for every saved view.
- Read-only shared and archived-project saved views keep an uncluttered open-only management path.
- Saved-view summaries count meaningful filters only; default sort and default archived-project mode stay quiet.
- CSV export uses the currently applied filters, so exports match the visible filtered result set rather than draft form values.
- Dashboard, planning, and delivery-health reason links route into filtered work item lists using the same query conversion rules.

Saved-view scopes are explicit:

- `workspace` scope belongs to the top-level Work Items discovery page. It supports workspace-only filters such as project and archived-project mode.
- `project` scope belongs to one project Work page. It strips workspace-only fields and uses that project's route, copy-link, return-URL, and CSV-export behavior.
- `personal` visibility means the saved view is listed and mutable only for the owner.
- `workspace` visibility means the saved view is shared with active workspace members in the current scope. For project scope, that means a shared project operating lens.

## Project Batch Triage

v0.1.6 adds project-scoped batch triage on the project Work page. Owners and maintainers can select visible project work items, apply one explicit update, and review updated, unchanged, and failed result counts without opening each item.

Supported project batch actions:

- assign to member;
- clear assignee;
- set priority;
- set milestone;
- clear milestone;
- set due date;
- clear due date;
- add labels;
- remove labels;
- transition status.

Batch triage is intentionally project-only in v0.1.6. It does not operate across workspace discovery results, board columns, archived projects, or custom query-wide selection sets. Contributors can still open project work and shared project views, but selection and bulk mutation controls are hidden. Archived projects remain readable and keep existing project views openable, but project bulk mutation is blocked in both the UI and API.

The bulk API uses `POST /api/projects/{projectId}/work-items/bulk-update` with an explicit action request. One request can include up to 50 work item ids. Invalid request shape, invalid action references, archived projects, and missing permission reject the request. Item-specific failures return per-row results, so successful and unchanged rows can clear while failed rows remain recoverable in the current visible list.

## Milestone Review

v0.1.7 adds a milestone review page at `/projects/:projectId/milestones/:milestoneId`. The page is a derived, read-only operating surface for one milestone. It shows milestone identity, progress, delivery health, scope breakdowns, focused risk sections, and recently changed milestone work without persisting review snapshots.

Milestone review links are query-backed:

- Planning milestone names open the milestone review page.
- Risk sections link into the project Work page with canonical milestone, status, dependency, due-date, and risk query parameters.
- Project Work shows visible chips such as `Risk: Unassigned active` and `Risk: Stale in progress` when those review links are opened.
- Copy-link and CSV export behavior continues to use the applied project Work query after following a milestone review risk link.
- Owners and maintainers can use existing project batch triage from the linked Work page, while contributors can read the review and filtered work without mutation controls.

Milestone review is intentionally current-state only in v0.1.7. Forecasting, roadmap views, critical path analysis, capacity planning, milestone sign-off, historical review snapshots, saved review reports, custom health formulas, and notification rules are deferred.

## Cycle Planning

v0.2.1 adds project-scoped cycles for methodology-neutral execution windows. Cycles are distinct from milestones: milestones represent delivery targets, while cycles represent timeboxed work commitments. Owners and maintainers can create, update, archive, reactivate, and review cycles on active projects. Contributors can read cycle lists, cycle review pages, cycle-filtered work, and report cycle snapshots without mutation controls.

Cycle planning support includes:

- cycle lifecycle management from the project Planning page;
- one active non-archived cycle per project;
- non-overlapping planned/active cycle date ranges within a project;
- optional target points compared with committed and completed work estimates;
- work item cycle assignment on create, detail edit, and project bulk triage;
- project and workspace work-list cycle filters with active chips, copyable URLs, saved views, pinned views, and CSV export support;
- cycle review pages at `/projects/:projectId/cycles/:cycleId`;
- focused cycle progress, scope breakdown, health, risk sections, and recently changed work;
- Planning summaries for active, upcoming, and recently completed cycles;
- active-cycle snapshot sections in generated and published project status reports;
- deterministic seed cycles for local walkthroughs and browser smoke tests.

Cycles are intentionally compact in v0.2.1. Velocity charts, ceremony management, rollover automation, capacity calendars, cycle forecasting, and CSV import cycle assignment are deferred.

## Cycle Closeout

v0.2.4 completes the cycle lifecycle with a guided closeout workflow. Owners and maintainers can preview an active cycle's closing scope, choose one planned destination for all unfinished work or return it to unplanned work, and apply completion plus carryover as one transactional command.

Closeout behavior includes:

- a read-only preview with cycle identity, health, scope counts, estimate totals, unfinished work, and dependency signals;
- planned same-project destination choices plus an explicit unplanned option that clears cycle assignment without changing workflow status;
- atomic cycle completion, immutable closeout evidence, unfinished-work reassignment, and activity creation;
- naturally idempotent retries for the same destination and conflicts for incompatible repeated decisions;
- completed and canceled work retained on the source cycle;
- carried work preserving status, milestone, assignee, labels, estimate, priority, and due date;
- completed Cycle Review results with closing actor/time, target and estimate outcomes, retained/moved counts, destination links, and bounded snapshot item groups;
- clear `Snapshot` framing for closeout evidence and `Live view` framing for links and current work state;
- compact recent-closeout results and role-aware close actions in Planning;
- honest legacy messaging for completed cycles created before closeout history existed.

Closeout is deliberate and one-way in this baseline. It does not activate the destination cycle, split work across multiple destinations, change workflow statuses, broadcast notifications, or provide reopen/undo.

## Project Reports

Project reports live at `/projects/:projectId/status` and appear as `Reports` in the project shell. Owners and maintainers can generate a report draft from current project state, edit the narrative fields, and publish an immutable report with a stored snapshot. Anyone who can read a published report can copy it as Markdown, download it as Markdown, or open the browser print flow. Contributors can read and export published reports. Archived projects remain readable and exportable, including their existing reports, but cannot publish new reports.

Report workflow:

- The Reports page shows the latest report, previous reports, and a create entry point when the selected actor can publish.
- Draft generation captures project identity, delivery health, health reasons, work counts, active/planned milestone snapshots, active cycle context, risk sections, and recent work.
- Draft pages distinguish generated evidence from editable narrative.
- Owners and maintainers can edit title, report date, summary, highlights, risks, and next steps before publishing.
- Published reports are immutable.
- Published detail pages clearly distinguish stored snapshot values from links that open current project data.
- Published detail pages include `Copy Markdown`, `Download Markdown`, and `Print` actions.
- Markdown exports are rendered server-side from the stored published report and returned from `GET /api/projects/:projectId/status-reports/:reportId/export.md`.
- Markdown exports include metadata, narrative, snapshot counts, health reasons, milestones, active cycle context when present, risk sections, recent work, and relative links back into Worktrail.
- Print styling hides app chrome and sharing controls so browser print output focuses on the report content.
- Milestone rows link to current milestone review pages.
- Cycle snapshot rows link to current cycle review pages.
- Risk sections link to current filtered project Work pages using canonical query parameters.
- Work item preview rows link to current work item detail pages with a return URL back to the report.
- Seed data includes a published Worktrail App weekly status report for local walkthroughs and browser smoke tests.
- Stored report snapshots are parsed through an explicit versioned runtime validator before list, detail, and Markdown export responses are assembled.

Reports are intentionally lightweight. The current baseline does not add post-publication edits, report delete/archive, PDF generation, scheduled delivery, email/push distribution, approvals, comments, custom templates, subscriptions, recipients, public links, export history, analytics, workspace rollups, forecasting, or roadmap reporting.

## CSV Import And Export

v0.0.7 added project-scoped CSV work item import and CSV export for both project lists and workspace discovery. v0.1.2 tightened export trust by routing export requests through applied canonical query state.

Import is a two-step flow:

1. Preview validates a CSV file and returns normalized rows without creating work.
2. Apply revalidates the same CSV and creates all rows transactionally.

If any row is invalid during apply, no work items are created. Project and workspace exports use the same applied filters as the visible list or discovery view, so exported CSV matches the current result set rather than pending draft search input. Exports include cycle context and direct parent key/title context where present. CSV import does not assign cycles or parent relationships.

The detailed CSV guide is in [docs/v0.0.X/v0.0.7/csv-import-export.md](docs/v0.0.X/v0.0.7/csv-import-export.md).

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

My Work includes a dependency-blocked assigned summary and section. Planning and cycle review include dependency-blocked work and blocking-open-work risk sections. The OpenAPI reference documents the relationship endpoints, dependency query parameter, and relationship DTOs.

## Delivery Health, Planning, And Review

Derived delivery health appears on project overview and planning surfaces.

Delivery-health support includes:

- project-level health states: on track, at risk, blocked, complete, and inactive;
- compact delivery-health panels on project overview;
- detailed planning delivery-health summaries with active, on-track, at-risk, blocked, and open-work counts;
- live-view framing on Planning, Milestone Review, and Cycle Review pages;
- cycle summaries for active, upcoming, and recently completed project execution windows;
- cycle review pages with target progress, scope breakdown, risk, and recent-movement detail;
- a Planning-to-Reports bridge for publishing a shareable snapshot from current state;
- milestone health labels and explainable reason chips;
- milestone review pages with scoped health, risk, and recent-movement detail;
- reason links into filtered project work item lists when the current work-item query model supports the reason;
- planning review sections for needs attention, upcoming work, and recently changed work;
- deterministic seed examples for blocked, at-risk, healthy, complete, inactive, and unmilestoned risk scenarios.

Delivery health is derived at read time from milestones, cycles, work item status, due dates, assignees, stale in-progress work, estimates, and dependency relationships. It is not stored in the database and does not trigger automatic workflow transitions.

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
- four active projects and one archived project;
- project milestones with due dates and lifecycle state;
- active, upcoming, and completed Worktrail App cycles with target points and scoped work;
- an isolated Closeout Lab with an active source cycle, planned destination, mixed terminal and unfinished scope, and dependency-blocked carryover;
- work items across every status with persisted board positions;
- same-project, cross-project, and related-work relationships;
- dependency-blocked examples where open blockers count and terminal blockers do not;
- active work item watchers, comment mention metadata, unread notifications, and one read notification;
- personal saved work views for each active seeded member, workspace-shared saved views for team operating lenses, and project-scoped shared/personal saved views for project rituals;
- published Worktrail App and Reference Operations status reports with snapshot data for milestone, cycle, risk, recent-work, and Portfolio review;
- project labels, comments, deleted-comment tombstones, project activity, and workspace activity events.

Use the `Acting as` selector in the top bar to switch the local placeholder actor. The selector only shows active members. This is intentionally local-only behavior and is not production authentication; the API derives the actor role and active state from the selected member record instead of trusting a client-supplied role.

Suggested walkthrough:

1. Open My Work and review the selected actor's assigned open, due soon, overdue, blocked, stale, and reported work counts.
1. Click a My Work summary count to open the cross-project Work Items page with URL-backed filters applied.
1. Change cross-project filters for project, assignee, reporter, status, type, label, milestone, priority, due date, blocked state, archived projects, and sort.
1. Open a seeded workspace shared view such as `Dependency risks`, confirm the active chips and result set match the saved query, and copy the filtered workspace view link.
1. Save a useful cross-project filter as a personal saved view, reload the page, and reopen it.
1. As an owner or maintainer, save the applied workspace filter as a shared saved view, then rename, update, and delete it from the saved-view manager.
1. Switch to a contributor, open a shared saved view, and confirm shared-view management controls are not available.
1. Copy the filtered workspace view link, open it in another tab, and confirm the same applied chips and results appear.
1. Use the global Create work item route, select a project, choose project-dependent labels or milestones, create work, and open the created item.
1. Open Portfolio and compare Worktrail App, Cloud Readiness, and Reference Operations across delivery health, report freshness, planning context, and dependency pressure.
1. Follow a Portfolio dependency-pressure link into filtered project Work, then return and open the latest Worktrail App report from Portfolio.
1. Open Projects, search by project name or key, and review project summary signals for open, blocked, overdue, status, and last updated state.
1. Open Workspace Settings and review role summaries, members, and workspace activity.
1. As Avery Owner, create a contributor, promote the member to maintainer, deactivate the member, and reactivate the member.
1. Confirm the actor selector updates when active members are created, changed, deactivated, and reactivated.
1. Switch to a maintainer and confirm project creation is available, then create a project with an explicit key.
1. Switch to a contributor and confirm member administration is unavailable with clear helper copy.
1. Open the Worktrail App project.
1. Review the project key, status counts, recently updated work, and activity.
1. Open Planning and review delivery health, cycle context, milestone progress, overdue/due-soon work, blocked work, unassigned work, and stale work.
1. Open the Cycles planning view, review the seeded active cycle, and open the cycle review page.
1. Follow a cycle risk link into filtered project work and confirm the cycle chip remains applied.
1. Create a work item in the active cycle, then update or clear cycle assignment from the detail page.
1. Use project bulk edit to set or clear cycle assignment for selected visible work.
1. Open Closeout Lab, switch to Morgan Maintainer, and review the active `Closeout Demonstration` cycle.
1. Choose `Close cycle`, verify the mixed completed, canceled, estimated, unestimated, and dependency-blocked scope, and keep `Follow-up Validation` selected.
1. Confirm closeout, review the immutable snapshot result, and distinguish it from the current live context below.
1. Follow the destination-cycle link, then open a carried snapshot item and verify its current cycle assignment and cycle-change activity.
1. Open a milestone review page, inspect progress, health, risk, and recent movement, then follow a risk link into filtered project work.
1. Review dependency-blocked and blocking-open-work planning sections, then follow a dependency list link into filtered project work.
1. Open Project Status, review the seeded weekly report with cycle context, copy it as Markdown, download the Markdown export, print the page, and follow one milestone, cycle, or risk link into current project data.
1. As an owner or maintainer, create a new status report, edit the narrative, publish it, and confirm the detail page shows a published snapshot notice.
1. Switch to a contributor and confirm published reports remain readable and exportable while the create action is unavailable.
1. Create a milestone, then create a work item assigned to that milestone.
1. Use the project work item list search and filters. Dropdown filters apply immediately, while search applies after a short debounce.
1. Filter by dependency state to find dependency-blocked work or work blocking downstream items.
1. Copy the filtered project work item list link and reload it to confirm the same applied view.
1. Open a seeded pinned workspace view such as `Dependency risks` directly from the pinned shortcuts area.
1. Open a seeded project shared view such as `Ready for QA`, confirm the project URL, active chips, and rows match the saved query, then copy the filtered project link.
1. Pin a personal saved view from the saved-view manager, navigate away, and reopen it from the pinned shortcuts area.
1. Switch to a contributor, open a shared pinned project view, and confirm shared project management controls are unavailable while personal project views remain available.
1. Save a dependency-filtered project view, reload, and reopen it.
1. As an owner or maintainer, select visible project work items, apply a project batch triage action such as adding a label, and review updated, unchanged, and failed result counts.
1. Switch to a contributor and confirm project batch mutation controls are unavailable.
1. Export the currently filtered project work item list to CSV.
1. Import a small CSV through the project import page, review dry-run validation, apply it, and confirm created work appears in the project list and board.
1. Export a filtered cross-project workspace discovery view to CSV.
1. Open Inbox and review unread notifications for the selected actor.
1. Mark an individual notification read, switch to All, and mark it unread again.
1. Open the board, drag cards within a column to set planning order, reload, and confirm the order persists.
1. Move a card through valid workflow columns with drag/drop or the status menu.
1. Open the work item detail page, update fields, change milestone and cycle assignment, watch or unwatch the item, mention an active member in a new comment, add and edit another comment, delete a comment, and review activity.
1. Switch to the mentioned actor and confirm the mention appears as an unread Inbox notification linking back to the work item.
1. Add a blocking relationship, confirm the downstream dependency signal appears, move the blocker to done, and confirm the dependency signal clears.
1. Open the archived project to confirm read-only project, milestone, cycle, work item, label, comment, relationship, import, transition, saved-view mutation, batch triage, and status report behavior.


1. Open the Worktrail App project overview and review the compact delivery-health panel.
2. Follow a delivery-health reason link into a filtered project work item list.
3. Open Planning and review project delivery health, cycle summaries, milestone health labels, and milestone reason chips.
4. Review Needs attention, Upcoming, and Recently changed planning review sections.
5. Open milestone review from Planning and follow a risk section into project Work with milestone and risk chips applied.
6. Open cycle review from Planning and follow a risk section into project Work with cycle and risk chips applied.
7. Confirm blocked and dependency-blocked seed items affect project and cycle health, while the healthy milestone remains on track.

## Current Baseline Capabilities

- My Work dashboard for the selected active actor.
- Prioritized My Work daily queue for assigned, due-soon, overdue, blocked, dependency-blocked, stale, reported, and recently updated work.
- Inbox with unread/all views for actor-scoped collaboration notifications.
- Unread notification count badge in primary navigation and Inbox summary from My Work.
- Notification read/unread actions and mark-all-read support.
- Top-level Portfolio review for workspace-wide active project comparison.
- Portfolio summary counts for active, on-track, at-risk, blocked, overdue, dependency-pressure, and stale/missing-report projects.
- Portfolio attention sections for delivery risk, communication freshness, current execution, and dependency pressure.
- Portfolio project rows with delivery health, health reasons, work metrics, report freshness, latest report details, active milestone context, and active cycle context.
- Portfolio drill-down links into Overview, Work, Planning, Reports, latest reports, milestone review, cycle review, and risk-specific filtered Work views.
- Top-level Work Items destination for cross-project discovery.
- Dashboard summary counts linked to filtered cross-project discovery.
- Cross-project work item discovery with URL-backed search, filters, sorts, project identity, archived-project modes, and active filter pills.
- Canonical work item query helpers for form state, route params, saved views, return URLs, dashboard links, delivery-health links, and exports.
- Copy-link actions for workspace and project filtered work item views.
- Reloadable filtered URLs whose active chips and result set survive browser refresh.
- Compact mobile work item cards for readable work scanning on narrow screens.
- Personal saved work views with create, open, rename, update, delete, duplicate-name validation, and stale-query tolerance.
- Workspace-shared saved work views visible to all active members.
- Owner and maintainer shared-view management for create, open, rename, update, and delete.
- Contributor read-only access to workspace-shared saved views with role-aware UI copy.
- Project-scoped saved work views on project Work pages, split into shared project views and personal project views.
- Seeded shared project views for release blockers, ready-for-QA queues, unassigned project work, current milestone risk, and open dependency risks.
- Pinned saved-view shortcuts on workspace Work Items and project Work pages.
- Pinned shared workspace views for seeded operating lenses such as dependency risks and ready-for-pickup queues.
- Pinned shared project views for seeded project lenses such as release blockers and ready-for-QA queues.
- Pinned personal views visible only to the owning actor.
- Pin and unpin controls in the saved-view manager for mutable saved views.
- Shared pinned-view activity for workspace and project operating-surface changes.
- Owner and maintainer management for shared project views, with contributor read access and personal project-view creation.
- Archived projects keep project saved views openable while blocking project-scoped saved-view mutations.
- Project Work page multi-select for owners and maintainers.
- Explicit project bulk edit mode that hides selection controls until the mode is entered.
- Project-scoped bulk updates for assignee, priority, milestone, due date, labels, and status transitions.
- Bulk update result summaries for updated, unchanged, and failed rows.
- Partial-success handling that clears successful and unchanged selections while retaining failed visible rows.
- Contributor and archived-project absence paths for project bulk mutation controls.
- Milestone review pages for focused progress, health, scope, risk, and recent movement.
- Query-backed milestone review risk links into project Work.
- Project cycle lifecycle management for planned, active, completed, and canceled cycles.
- One active non-archived cycle per project and overlap validation for planned/active cycles.
- Work item cycle assignment on create, detail edit, and project bulk triage.
- Cycle filters on project and workspace work lists with active chips, copy links, saved views, pinned views, and CSV export support.
- Cycle review pages for focused progress, target points, scope, health, risk, and recent movement.
- Query-backed cycle review links into project Work.
- Planning summaries for active, upcoming, and recently completed cycles.
- Guided owner/maintainer cycle closeout with a read-only preview and one explicit carryover destination.
- Transactional source-cycle completion, immutable closeout evidence, unfinished-work reassignment, and bounded activity fan-out.
- Idempotent matching closeout retries and conflict protection for incompatible repeat decisions.
- Completed Cycle Review snapshot results with closing actor/time, target and estimate totals, retained/moved counts, destination links, and historical item summaries.
- Explicit snapshot-versus-live framing and honest legacy completed-cycle behavior when no closeout record exists.
- Compact Planning closeout outcomes and role-aware closeout entry points.
- Active-cycle context in generated and published project status report snapshots.
- Hidden `workRisk` query support with visible project Work chips for review-driven risk states.
- Project status report list, draft, publish, and detail pages under the project shell.
- Project shell navigation labels report routes as `Reports` while preserving existing `/status` paths.
- Generated status report drafts that reuse current project health, milestone, active-cycle, risk, and recent-work signals.
- Report drafts split generated evidence from editable narrative.
- Immutable published status reports with stored JSON snapshots and edited narrative fields.
- Runtime validation for persisted report snapshots before list, detail, and Markdown export responses.
- Status report links from stored milestone snapshots into current milestone review pages.
- Status report links from stored risk sections into current filtered project Work pages.
- Status report work item preview links with return URLs back to the report.
- Server-rendered Markdown export endpoint for published status reports, including active-cycle snapshot sections when present.
- Reader-facing status report actions for copying Markdown, downloading Markdown, and browser print.
- Print-friendly status report detail layout that hides app chrome and action controls.
- Contributor read access to published reports, including reports for archived projects.
- Contributor export access to published reports, including reports for archived projects.
- Owner/maintainer-only report publishing for active projects.
- Saved-view summaries that suppress default query noise and count meaningful applied filters, including cycle filters.
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
- Planning links from milestone rows and milestone review items to focused milestone review pages.
- Project work item list search and filters for status, type, priority, assignee, reporter, label, milestone, cycle, due date, dependency state, and sort.
- Project-scoped CSV import with dry-run preview, normalized rows, row-level validation errors, and transactional apply.
- Project and workspace CSV export that serializes the currently applied filters through canonical query params and includes cycle data for assigned work.
- CSV import/export guide under `docs/v0.0.X/v0.0.7/csv-import-export.md`.
- Work item relationships with directional `blocks` and symmetric `relates_to` semantics.
- Cross-project relationships inside the same workspace with project identity shown in relationship rows.
- Blocking-cycle, duplicate, self-link, cross-workspace, and archived-project relationship write validation.
- Work item detail relationship sections for inbound blockers, outbound blocked work, and related work.
- Derived dependency counts on list rows, including compact `Blocked by` and `Blocks` indicators.
- Dependency filters on project work item lists and cross-project workspace discovery.
- Saved work views and CSV export support for dependency filters.
- My Work dependency-blocked assigned summary and section.
- Planning and cycle review dependency risk sections for dependency-blocked work and work blocking open downstream items.
- Project overview delivery-health panel with health state, milestone risk counts, open-work count, top reasons, and planning link.
- Planning delivery-health summary with active, on-track, at-risk, blocked, and open-work counts.
- Cycle health summary with committed estimate points, completed estimate points, target point comparisons, dependency risk, unestimated work, and unassigned work signals.
- Milestone health labels and explainable health reason chips on planning progress rows.
- Planning review sections for needs attention, upcoming work, and recently changed work.
- Delivery-health reason links into filtered project work item lists where the reason can be represented by current query parameters.
- Deterministic seed data for healthy, at-risk, blocked, complete, inactive, unmilestoned, and current-cycle delivery-health examples.
- Relationship activity events for add/remove commands.
- In-app notification persistence for assignments, mentions, watched comments, watched work changes, and dependency blocker changes.
- Work item watch/unwatch controls with watcher count and compact watcher list on detail pages.
- Work item detail sections grouped around Summary, Act, Collaborate, Dependencies, and History.
- Dependency alerts on work item detail pages when work is blocked by open work or blocking downstream open work.
- Automatic watching for work item reporters, assignees, and newly assigned members.
- Comment mentions through an active-member picker, persisted mention metadata, and readable mention chips.
- Persisted board ordering for same-status reorder and cross-status movement.
- Angular CDK drag/drop board interaction backed by server-side workflow validation.
- Comment add/edit/delete with role-aware UI affordances and deleted-comment tombstones.
- Workspace, project, milestone, label, work item, board movement, shared saved view, personal saved view, and comment lifecycle coverage through tests and activity where applicable.
- Archived projects remain readable and block project, milestone, work item, label, comment, and transition writes.
- Runtime configuration validation with development defaults and production-mode requirements.
- Production preview from built Angular and compiled API artifacts.
- Express static serving with SPA deep-link fallback that does not swallow `/api/*` routes.
- Liveness and database readiness endpoints at `/api/health/live` and `/api/health/ready`.
- OpenAPI reference under `docs/api/openapi.yaml`.
- Operations runbook for runtime modes, environment variables, migrations, seed/reset flow, preview, health checks, troubleshooting, and future cloud mapping.
- ESLint guardrails for API, web, and contracts workspaces.
- GitHub Actions CI for lint, typecheck, tests with a Postgres service, and production build.

## Current Limitations

- Authentication is represented by local request headers and the top-bar actor selector.
- Permissions are enforced against local member records and are useful for exercising policy paths, but they are not production authentication.
- Production preview is not a secure public deployment and should not be exposed as an authenticated product.
- Milestone review and delivery health are deterministic and rule-based; custom health formulas, forecasting, capacity planning, roadmap views, critical path analysis, charts, delivery-health notifications, and milestone sign-off are deferred.
- Cycle planning is intentionally lightweight. Velocity charts, ceremony management, automatic rollover/closeout, member capacity calendars, cycle forecasting, cycle templates, retrospective tooling, closeout notifications, split carryover destinations, and safe reopen/undo are deferred.
- Project status reports are immutable after publication. Report edits, report delete/archive, PDF generation, scheduled delivery, email/push distribution, approvals, comments, custom templates, subscriptions, recipients, public links, export history, analytics, workspace rollups, forecasting, and roadmap reporting are deferred.
- Notifications are in-app only. Email, push, WebSockets, digests, notification preferences, deletion/archive controls, and background delivery workers are deferred.
- Comment mentions are selected through an active-member picker. Rich-text editing and free-text `@name` parsing are deferred.
- Watchers are work-item scoped only. Project-level and workspace-level watching are deferred.
- Saved views support workspace and project scopes with personal/shared visibility and pinned shortcuts. Custom pinned ordering, saved-view folders, icons, colors, descriptions, ownership transfer, custom permissions, short links, and analytics are deferred.
- Portfolio review is read-only and active-project focused. Portfolio filters, custom sorting, charts, exports, stored portfolio snapshots, historical portfolio review, and cross-project mutation workflows are deferred.
- Batch triage is project-scoped and works on explicit visible selections only. Cross-project bulk edit, board bulk actions, bulk delete, bulk comments, query-wide durable selection sets, background jobs, and custom bulk permissions are deferred.
- Copy-link support uses browser clipboard APIs and a textarea fallback. Native share sheets, short links, and permission customization are deferred.
- CSV import is project-scoped and limited to 1 MiB and 250 data rows per file.
- CSV import supports Worktrail's current columns only; third-party tracker migration mappings are deferred.
- CSV import does not assign cycles yet; cycle data is currently export-only.
- CSV and status report Markdown export are direct file downloads; export history, scheduled exports, and additional report formats are deferred.
- Relationships support only `blocks` and `relates_to`; custom relationship types, hierarchy, and graph visualization are deferred.
- Dependency-blocked state is derived from current open blockers; critical path analysis, external dependency alerts, and automation rules are deferred.
- Relationship activity is recorded on the command context item only to avoid noisy cross-project activity.
- Custom workflows, file attachments, and production auth are intentionally out of scope.
- Invitations, multi-workspace switching, custom roles, project-specific membership, pinned projects, recent projects, and audit export are intentionally out of scope.
- The local Express adapter is the only runtime adapter in the current baseline, though endpoint handlers are structured so a Lambda/API Gateway adapter can be added later.
- AWS deployment assets are not included yet; the Angular static build and transport-neutral handlers preserve that path.
- Readiness checks database connectivity only; migration drift detection, metrics, tracing, and managed deployment runbooks are deferred.

## Database Status

The current schema includes workspace activity, member lifecycle metadata, project keys, scoped work item display keys, labels, milestones, project cycles, immutable project cycle closeouts with versioned JSONB evidence, work item cycle assignments, comments, comment mentions, project activity, due dates, durable board positions, work item relationships, work item watchers, notifications, workspace-scoped saved work views, project-scoped saved work views, saved-view pinned state, and immutable project status report snapshots.

Useful database commands:

```sh
npm run db:generate  # generate a migration from the Drizzle schema
npm run db:migrate   # apply committed migrations
npm run db:seed      # upsert deterministic demo data
npm run db:reset     # drop and recreate the local public schema
```

`npm run db:reset` refuses to run against non-local database hosts unless `WORKTRAIL_ALLOW_DATABASE_RESET=true` is set.

The default development database URL is documented in [.env.example](.env.example).
