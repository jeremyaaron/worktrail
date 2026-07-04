# Worktrail v0.0.5 Implementation Plan

## Purpose

This plan turns the v0.0.5 PRD and technical design into sequential implementation phases. v0.0.5 should make Worktrail useful as a daily operating surface by adding My Work, cross-project discovery, personal saved views, quick work capture, and project navigation polish.

The release remains local-first. It should preserve the Angular static-hosting path, transport-neutral API handlers, Postgres migration discipline, deterministic seed data, lazy-loaded routes, and clean verification from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.0.5:

- Add `/my-work` as the default app route.
- Add `/work-items` as the workspace-level cross-project discovery route.
- Keep project-scoped work item list behavior intact.
- Add route-based quick create at `/work-items/new`.
- Keep `/projects/:projectId/work-items/new` supported and backed by the same create experience.
- Implement saved views only for cross-project discovery.
- Implement personal saved views only in v0.0.5.
- Store saved view query state as validated PostgreSQL `jsonb`.
- Add a dedicated My Work/dashboard service.
- Extend work item repository/query support for workspace-scoped discovery.
- Add project navigation summary data instead of replacing `GET /projects`.
- Defer workspace-visible saved views, pinned projects, full-text search indexes, configurable dashboards, notifications, production auth, AWS infrastructure, and Lambda/API Gateway adapters.

## Phase Sizing

Each phase should leave the repository in a coherent working state. Prefer vertical slices with contracts, backend behavior, frontend usage, and focused tests when practical. If a phase starts touching schema, multiple services, multiple route components, and e2e in one step, split it before continuing.

Because v0.0.5 adds workspace-level query paths and saved query persistence, run backend tests after API phases and full verification before finalization. Keep an eye on Angular bundle budgets whenever adding route components or shared UI helpers.

## Phase 0: Baseline Planning

Goal: confirm v0.0.5 planning inputs and resolve implementation choices before code changes.

Scope:

- Confirm `docs/v0.0.5/prd.md` exists.
- Confirm `docs/v0.0.5/technical-design.md` exists.
- Confirm `docs/v0.0.5/implementation-plan.md` exists.
- Confirm design decisions listed above.
- Check repository status before implementation starts.
- Confirm the active branch and any staged changes.

Out of scope:

- Dependency changes.
- Schema changes.
- Feature implementation.

Acceptance criteria:

- The three v0.0.5 planning documents exist.
- No unresolved open decision blocks Phase 1.
- The worktree/index state is understood before implementation starts.

Suggested commands:

```sh
find docs/v0.0.5 -maxdepth 1 -type f | sort
git status --short --branch
```

Status:

- Completed on 2026-07-04.
- Confirmed `docs/v0.0.5/prd.md`, `docs/v0.0.5/technical-design.md`, and `docs/v0.0.5/implementation-plan.md` exist.
- Confirmed implementation decisions:
  - `/my-work` becomes the default app route;
  - `/work-items` becomes the workspace-level cross-project discovery route;
  - project-scoped work item list behavior remains intact;
  - route-based quick create is added at `/work-items/new`;
  - `/projects/:projectId/work-items/new` remains supported by the same create experience;
  - saved views apply only to cross-project discovery in v0.0.5;
  - saved views are personal-only in v0.0.5;
  - saved view query state is stored as validated PostgreSQL `jsonb`;
  - a dedicated My Work/dashboard service is added;
  - work item repository/query support is extended for workspace-scoped discovery;
  - project navigation summary data is added without replacing `GET /projects`;
  - workspace-visible saved views, pinned projects, full-text search indexes, configurable dashboards, notifications, production auth, AWS infrastructure, and Lambda/API Gateway adapters stay out of scope.
- Confirmed current branch is `v0.0.5`.
- Confirmed current change state: `docs/v0.0.5/` is untracked and contains the three planning documents; no code changes are present yet.
- No unresolved open decision blocks Phase 1.

## Phase 1: Contracts, Schema, Migration, And Seed

Goal: establish the v0.0.5 shared API shape and persistence foundation.

Scope:

- Extend shared contracts with:
  - `ArchivedProjectMode`;
  - `AssigneeState`;
  - `WorkItemState`;
  - `WorkItemQuery`;
  - `WorkspaceWorkItemListItemDto`;
  - `MyWorkSummaryCountDto`;
  - `MyWorkDashboardDto`;
  - `SavedWorkViewVisibility`;
  - `SavedWorkViewDto`;
  - `CreateSavedWorkViewRequest`;
  - `UpdateSavedWorkViewRequest`;
  - `ProjectNavigationSummaryDto`.
- Add backend domain constants for saved view visibility if useful.
- Extend Drizzle schema with:
  - `saved_work_views`;
  - visibility check constraint;
  - workspace/owner/updated index;
  - case-insensitive owner/name uniqueness;
  - workspace-level work item query indexes.
- Update repository inferred types.
- Generate and review a Drizzle migration.
- Update deterministic seed data with:
  - saved work views for seeded active members;
  - enough cross-project work item variety for dashboard/discovery demos;
  - due-soon, overdue, blocked, stale, assigned, reported, and unassigned examples.
- Add temporary DTO mapping helpers as needed.

Out of scope:

- Saved view endpoints.
- My Work endpoint.
- Cross-project discovery endpoint.
- Frontend routes.

Acceptance criteria:

- Migration applies after local reset.
- Seed data demonstrates v0.0.5 dashboard and saved view scenarios.
- Contracts compile after temporary call-site updates.
- Existing app behavior is not intentionally changed.

Suggested commands:

```sh
npm run db:generate
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-04.
- Extended shared contracts with:
  - `ArchivedProjectMode`;
  - `AssigneeState`;
  - `WorkItemQuery`;
  - `WorkspaceWorkItemListItemDto`;
  - `MyWorkSummaryCountDto`;
  - `MyWorkDashboardDto`;
  - `SavedWorkViewVisibility`;
  - `SavedWorkViewDto`;
  - `CreateSavedWorkViewRequest`;
  - `UpdateSavedWorkViewRequest`;
  - `ProjectNavigationSummaryDto`.
- Added backend `savedWorkViewVisibilities` domain constants.
- Extended the Drizzle schema with:
  - `saved_work_views`;
  - saved view visibility check constraint;
  - saved view workspace/owner/updated index;
  - saved view case-insensitive owner/name unique index;
  - workspace-level work item indexes for status, assignee, reporter, priority, due date, and updated timestamp.
- Generated migration `0004_modern_jane_foster.sql` and reviewed the generated SQL.
- Updated repository inferred types with `SavedWorkView` and `NewSavedWorkView`.
- Updated deterministic seed data with:
  - active unassigned work;
  - contributor-assigned overdue/stale work;
  - owner-assigned blocked cloud work;
  - label coverage for the new work items;
  - 12 personal saved work views, four for each active seeded member.
- Added `AssigneeState` / `assigneeState` to represent unassigned saved views without overloading `assigneeId` with a non-UUID sentinel.
- Verified `npm run db:reset && npm run db:migrate && npm run db:seed`.
- Verified seeded saved views and work item variety through the existing API database helper.
- Verified `npm run typecheck`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm test`.
- Verified `npm run build`; production Angular initial bundle remains 342.04 kB raw and 94.38 kB estimated transfer.

## Phase 2: Work Item Query Validation And Workspace Discovery Backend

Goal: add server-side cross-project work item discovery with validated query state.

Scope:

- Add a shared backend parser/normalizer for `WorkItemQuery`.
- Normalize empty strings, default sort, default archived-project mode, and bounded search text.
- Validate enum fields, UUID fields, blocked/status combinations, and milestone/project consistency where practical.
- Validate that `assigneeState=unassigned` is not combined with `assigneeId`.
- Validate that `workState` is not combined with a specific `status`.
- Add repository support for workspace-scoped work item listing:
  - project filter;
  - status;
  - type;
  - priority;
  - assignee;
  - reporter;
  - label;
  - milestone;
  - due date state;
  - blocked state;
  - archived project inclusion;
  - search;
  - sort.
- Add DTO mapping for `WorkspaceWorkItemListItemDto`.
- Add service method `WorkItemService.listWorkspaceWorkItems`.
- Add `GET /work-items`.
- Add backend tests for filters, sorts, archived project modes, inactive historical members, and invalid query handling.

Out of scope:

- Saved view persistence behavior.
- My Work dashboard endpoint.
- Frontend discovery page.

Acceptance criteria:

- `GET /work-items` returns active-project work by default.
- Archived project work is included only when requested.
- Returned rows include project identity.
- Invalid query combinations return clear validation errors.
- Existing project-scoped work item list behavior remains intact.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-item
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-04.
- Added shared backend work item query parsing and normalization in `validation/work-item-query.ts`.
- Normalized empty strings, default `sort=updated_desc`, default `archivedProjects=exclude`, and search text capped at 120 characters.
- Validated enum fields, UUID fields, `blocked=true` status conflicts, and `assigneeState=unassigned` conflicts with `assigneeId`.
- Added `normalizeWorkItemQuery` for future saved-view persistence reuse.
- Extended the work item repository with `listByWorkspace`, including:
  - project filter;
  - status;
  - type;
  - priority;
  - assignee;
  - assignee state;
  - reporter;
  - label;
  - milestone;
  - due date state;
  - blocked state;
  - archived project inclusion;
  - search;
  - sort.
- Added `WorkspaceWorkItemListItemDto` mapping with project identity.
- Added `WorkItemService.listWorkspaceWorkItems`.
- Added `GET /api/work-items` before parameterized work item routes.
- Added API tests for:
  - active-project default behavior;
  - project identity in returned rows;
  - search, label, milestone, assignee state, and priority sort filters;
  - archived project `include` and `only` modes;
  - inactive historical assignee display;
  - invalid blocked/status and assignee query combinations.
- Verified `npm test --workspace @worktrail/api -- work-items`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm run typecheck --workspace @worktrail/api`.

## Phase 3: My Work Dashboard Backend

Goal: add the server-side daily dashboard for the current active actor.

Scope:

- Add `MyWorkService`.
- Add `GET /my-work`.
- Compute summary counts:
  - assigned open;
  - due soon;
  - overdue;
  - blocked;
  - stale assigned;
  - reported open.
- Compute limited dashboard sections:
  - assigned to me;
  - due soon or overdue;
  - blocked relevant;
  - recently updated.
- Use a 7-day stale threshold for assigned `in_progress` or `blocked` work.
- Exclude archived project work by default.
- Return query payloads on summary counts for links into `/work-items`.
- Add tests for dashboard counts, sections, actor scoping, stale threshold, archived-project exclusion, and empty states.

Out of scope:

- Dashboard Angular page.
- Saved views.
- Notifications or digests.

Acceptance criteria:

- `GET /my-work` returns actor-aware summary counts and sections.
- Dashboard links can be represented as `WorkItemQuery` objects.
- Counts reflect all matches while sections stay limited.
- Existing API tests remain green.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- my-work
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-04.
- Added `WorkItemState` / `workState` to `WorkItemQuery` so dashboard links can target non-terminal or terminal work accurately.
- Extended query validation and workspace discovery filtering for `workState`.
- Added `MyWorkService`.
- Added `GET /api/my-work`.
- Computed summary counts:
  - assigned open;
  - due soon;
  - overdue;
  - blocked;
  - stale assigned;
  - reported open.
- Computed limited dashboard sections:
  - assigned to me;
  - due soon or overdue;
  - blocked relevant;
  - recently updated.
- Used a 7-day stale threshold for assigned `in_progress` or `blocked` work.
- Excluded archived project work from dashboard counts and sections by default.
- Returned `WorkItemQuery` payloads on summary counts for links into `/work-items`.
- Added backend tests for:
  - dashboard counts and section computation;
  - actor scoping;
  - stale assigned threshold;
  - archived-project exclusion;
  - empty dashboard states;
  - `GET /api/my-work`;
  - invalid `status` plus `workState` query combinations.
- Verified `npm test --workspace @worktrail/api -- my-work`.
- Verified `npm test --workspace @worktrail/api -- my-work work-items`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm run typecheck --workspace @worktrail/api`.

## Phase 4: Saved Work Views Backend

Goal: add personal saved views backed by validated query payloads.

Scope:

- Add saved work view repository.
- Add `SavedWorkViewService`.
- Add endpoints:
  - `GET /saved-work-views`;
  - `POST /saved-work-views`;
  - `PATCH /saved-work-views/:savedViewId`;
  - `DELETE /saved-work-views/:savedViewId`.
- Normalize and validate saved view names.
- Persist normalized `WorkItemQuery` payloads.
- Enforce actor ownership for list/update/delete.
- Enforce duplicate name conflict rules.
- Treat missing or unauthorized saved views as `404`.
- Add backend tests for create/list/update/delete, duplicate names, invalid payloads, ownership, and stale references.

Out of scope:

- Workspace-visible saved views.
- Frontend saved view UI.
- Saved views for project-scoped lists.

Acceptance criteria:

- Active members can manage their own personal saved views.
- Actors cannot see or mutate another member's saved views.
- Saved queries are normalized before storage.
- Invalid saved query payloads are rejected.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- saved
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-04.
- Added saved work view repository support:
  - create;
  - find by id;
  - list personal views by workspace/owner;
  - find by owner/name case-insensitively;
  - update;
  - delete.
- Added `SavedWorkViewService`.
- Added saved work view DTO mapping.
- Added endpoints:
  - `GET /api/saved-work-views`;
  - `POST /api/saved-work-views`;
  - `PATCH /api/saved-work-views/:savedViewId`;
  - `DELETE /api/saved-work-views/:savedViewId`.
- Normalized saved view names with trimmed display names.
- Persisted normalized `WorkItemQuery` payloads using `normalizeWorkItemQuery`.
- Enforced actor ownership for list, update, and delete.
- Enforced duplicate name conflicts for create and rename.
- Returned `404` for missing or non-owned saved views.
- Preserved stale UUID references in saved queries while rejecting invalid query shapes.
- Added backend tests for:
  - create/list behavior;
  - query normalization;
  - update/delete behavior;
  - duplicate names on create and rename;
  - actor ownership isolation;
  - invalid saved query rejection;
  - stale reference persistence.
- Verified `npm test --workspace @worktrail/api -- saved-work-views`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm run typecheck --workspace @worktrail/api`.

## Phase 5: Project Navigation Summary Backend

Goal: support richer project list navigation without breaking existing project APIs.

Scope:

- Add project summary repository query or service method for navigation summaries.
- Add `GET /projects/navigation-summary`.
- Compute:
  - project;
  - open work item count;
  - blocked work item count;
  - overdue work item count;
  - recently updated timestamp.
- Sort active projects first, then recently updated.
- Include archived projects with clear project status in DTO.
- Add backend tests for counts, archived project ordering, and empty projects.

Out of scope:

- Project pinned/recent persistence.
- Frontend project list search UI.

Acceptance criteria:

- Existing `GET /projects` remains compatible.
- Navigation summaries reflect seeded work item state.
- Archived projects are included but can be visually separated by the frontend.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- project
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-04.
- Added `ProjectService.listProjectNavigationSummaries`.
- Added `GET /api/projects/navigation-summary`.
- Computed project navigation fields:
  - project;
  - open work item count;
  - blocked work item count;
  - overdue work item count;
  - recently updated timestamp.
- Used the service clock for deterministic overdue calculation.
- Sorted active projects before archived projects, then by most recent project/work-item update.
- Used project `updatedAt` for empty projects.
- Included archived projects with their status and work item counts.
- Added backend tests for:
  - active-before-archived ordering;
  - recent-work ordering;
  - open, blocked, and overdue counts;
  - empty project summaries;
  - archived project summaries;
  - `GET /api/projects/navigation-summary`.
- Verified `npm test --workspace @worktrail/api -- projects-members`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm run typecheck --workspace @worktrail/api`.

## Phase 6: API Client, Routes, And Shared Frontend Helpers

Goal: wire frontend contracts and route structure before building full UI surfaces.

Scope:

- Extend `WorktrailApiService` with:
  - `getMyWork`;
  - `listWorkspaceWorkItems`;
  - saved work view CRUD methods;
  - `listProjectNavigationSummaries`.
- Add lazy routes:
  - `/my-work`;
  - `/work-items`;
  - `/work-items/new`.
- Change default route from `/projects` to `/my-work`.
- Keep existing project-scoped create route.
- Add small query-param helpers for `WorkItemQuery`.
- Add shared display helpers only where they reduce concrete duplication:
  - project badge/title;
  - work item row metadata;
  - filter pill labels.
- Update app navigation to include My Work, Projects, Workspace, and Create work item.
- Add or update frontend tests for routing and API client parameter behavior where practical.

Out of scope:

- Full My Work UI.
- Full cross-project discovery UI.
- Saved view management UI.
- Quick create form changes beyond route plumbing.

Acceptance criteria:

- App routes compile with lazy components or placeholders.
- Default route points to My Work.
- API client produces expected query params.
- Existing frontend tests pass after navigation changes.

Suggested commands:

```sh
npm test --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-04.
- Extended `WorktrailApiService` with:
  - `getMyWork`;
  - `listWorkspaceWorkItems`;
  - saved work view list/create/update/delete methods;
  - `listProjectNavigationSummaries`.
- Added shared work item query-param helpers for workspace and project-scoped filter requests.
- Added small shared display helpers for project badges/titles, work item metadata, status/priority labels, and filter pill labels.
- Added lazy route placeholders for:
  - `/my-work`;
  - `/work-items`;
  - `/work-items/new`.
- Changed the default and wildcard routes to `/my-work`.
- Kept `projects/:projectId/work-items/new` on the existing project-scoped create component.
- Updated the app shell navigation with My Work, Projects, Workspace, and Create work item links.
- Added route tests for the My Work default route and workspace work item route ordering.
- Added API client tests for My Work, project navigation summaries, workspace work item query params, and saved work view CRUD requests.
- Verified `npm run typecheck --workspace @worktrail/web`.
- Verified `npm test --workspace @worktrail/web`.
- Verified `npm run build --workspace @worktrail/web`; production initial bundle is 343.06 kB raw and 95.22 kB estimated transfer.
- Verified `git diff --check`.

## Phase 7: My Work Frontend

Goal: build the personal dashboard page.

Scope:

- Add `MyWorkPageComponent`.
- Load dashboard DTO from `GET /my-work`.
- Refresh when the selected local actor changes.
- Render actor name and role.
- Render summary counts as links to `/work-items` with applied query params.
- Render dashboard sections:
  - assigned to me;
  - due soon or overdue;
  - blocked relevant;
  - recently updated.
- Use dense, operational row layouts with project identity, display key, status, priority, due date, assignee, milestone, and updated time where useful.
- Add specific empty states.
- Add loading and error states.
- Add component tests for rendering, empty states, query links, and actor refresh.

Out of scope:

- Saved view UI.
- Quick create flow.
- Dashboard customization.

Acceptance criteria:

- My Work is useful as the default app screen.
- Summary counts link to workspace discovery with applied URL filters.
- Actor changes refresh dashboard data.
- Page remains usable at common desktop widths.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- my-work
npm test --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-04.
- Replaced the My Work placeholder with a dashboard backed by `GET /my-work`.
- Reloads dashboard data when the selected local actor changes.
- Renders the current dashboard actor name and role in the page header.
- Renders summary count tiles as links to `/work-items` with the backend-provided query params applied.
- Renders dashboard sections for:
  - assigned to me;
  - due soon or overdue;
  - blocked relevant work;
  - recently updated work.
- Added dense work item rows with project identity, display key, type/status/priority metadata, milestone, due date, assignee, and updated date.
- Added loading, API error/retry, no-active-member, and section-specific empty states.
- Added component tests for summary links, row rendering, empty states, actor-change refresh, and error retry.
- Verified `npm test --workspace @worktrail/web -- --include='src/app/features/my-work/my-work-page.component.spec.ts'`.
- Verified `npm run typecheck --workspace @worktrail/web`.
- Verified `npm test --workspace @worktrail/web`.
- Verified `npm run build --workspace @worktrail/web`; production initial bundle remains 343.06 kB raw and 95.22 kB estimated transfer.

## Phase 8: Cross-Project Work Discovery Frontend

Goal: build the workspace-level work item discovery page.

Scope:

- Add `WorkspaceWorkItemListPageComponent`.
- Load `GET /work-items` from URL-backed `WorkItemQuery`.
- Render cross-project result rows with project identity.
- Add filters for:
  - project;
  - status;
  - type;
  - priority;
  - assignee;
  - reporter;
  - label;
  - milestone after project selection;
  - due date state;
  - blocked;
  - archived project inclusion.
- Add sort controls.
- Keep search debounced and URL-backed.
- Apply dropdown filters immediately.
- Show filter pills only for applied filters.
- Add reset action.
- Add loading, error, and empty states.
- Add component tests for URL state, filter application, pills, reset, and result links.

Out of scope:

- Saved view management UI.
- Project-scoped list redesign.
- Full-text search.

Acceptance criteria:

- Users can find work across active projects without choosing a project first.
- Dashboard links land on correctly filtered results.
- Archived project inclusion is explicit.
- Project-level work item list behavior remains stable.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- work-item
npm test --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

## Phase 9: Saved Views Frontend

Goal: make cross-project discovery queries reusable.

Scope:

- Load saved views on the workspace work item discovery page.
- Add UI to save the current applied query as a named personal view.
- Add UI to open a saved view and update URL query params.
- Add UI to rename a saved view.
- Add UI to update a saved view from the current applied query.
- Add UI to delete a saved view.
- Display duplicate-name and validation errors inline.
- Handle stale saved views that return no results.
- Add component tests for save/open/update/rename/delete flows.

Out of scope:

- Workspace-visible saved views.
- Saved views on project-scoped lists.
- Complex foldering or pinning of saved views.

Acceptance criteria:

- A user can save, reload, reopen, update, rename, and delete a personal saved view.
- Opening a saved view updates the URL.
- Saved view operations do not mutate work items.
- Stale/no-result saved views do not break the page.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- saved
npm test --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

## Phase 10: Quick Work Capture Frontend

Goal: allow users to create work without navigating into a project first.

Scope:

- Refactor or extend the existing work item create component to support optional route `projectId`.
- Add `/work-items/new` route behavior:
  - project selection first;
  - active projects only as create targets;
  - project-dependent labels and milestones;
  - existing assignee/member controls;
  - existing due date, estimate, description, type, priority, and label fields.
- Keep `/projects/:projectId/work-items/new` behavior working with project preselected.
- Default reporter remains current actor server-side.
- Add success actions:
  - open created work item;
  - create another;
  - return to My Work or previous project context.
- Add inline disabled copy for archived project or permission constraints.
- Add component tests for project selection, dependent fields, validation errors, and success actions.

Out of scope:

- Modal overlay command palette.
- Bulk create.
- Template-based create.

Acceptance criteria:

- Users can create a work item from `/work-items/new`.
- Project-scoped create still works.
- Project selection drives labels and milestones correctly.
- Create failures preserve entered values.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- create
npm test --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

## Phase 11: Project Navigation Polish Frontend

Goal: make project navigation more useful as project count grows.

Scope:

- Update project list to use `GET /projects/navigation-summary`.
- Add project search by name/key.
- Show project key, status, open count, blocked count, overdue count, and updated timestamp.
- Keep project creation behavior from v0.0.4.
- Separate or visually distinguish archived projects.
- Add responsive checks for project list layout.
- Add component tests for search, summary signals, archived project display, and project creation regression.

Out of scope:

- Pinned projects.
- Recent projects persistence.
- Portfolio views.

Acceptance criteria:

- Users can quickly find projects by name or key.
- Active projects are prioritized.
- Archived projects remain discoverable.
- Project creation and role-aware disabled states still work.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- project
npm test --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

## Phase 12: E2E, Accessibility, Responsiveness, And Regression

Goal: validate the v0.0.5 daily workflow through the browser and protect prior sprint behavior.

Scope:

- Extend Playwright smoke test to:
  - open My Work as a seeded actor;
  - follow a dashboard count to filtered cross-project discovery;
  - save a filtered view;
  - reload and reopen the saved view;
  - create a work item from `/work-items/new`;
  - confirm the created item appears in cross-project discovery.
- Preserve existing v0.0.4 governance workflow coverage.
- Preserve existing v0.0.3 planning/adoption workflow coverage.
- Add or update responsive overflow checks for:
  - My Work;
  - workspace work item discovery;
  - quick create;
  - project list;
  - existing project pages.
- Check keyboard/focus behavior for filter controls, saved view actions, and quick create form controls.
- Restore deterministic seed data after e2e mutation.

Out of scope:

- Visual snapshot testing.
- Full accessibility audit tooling beyond practical keyboard/focus and semantic checks.

Acceptance criteria:

- E2E smoke covers the main v0.0.5 daily workflow.
- Existing governance and planning smoke paths still pass.
- No common desktop width has incoherent horizontal overflow.
- Local database is restored to seed data after e2e mutation.

Suggested commands:

```sh
npm run test:e2e
npm run build
npm run db:reset && npm run db:migrate && npm run db:seed
git diff --check
```

## Phase 13: Documentation, Site, Extraction Notes, And Release Finalization

Goal: prepare v0.0.5 for merge and release.

Scope:

- Update `README.md`:
  - repository layout;
  - capabilities;
  - limitations;
  - local actor caveats;
  - demo walkthrough;
  - verification notes.
- Update static product site for:
  - My Work dashboard;
  - cross-project discovery;
  - personal saved views;
  - quick work capture;
  - project navigation polish.
- Add `docs/v0.0.5/jawstack-extraction-notes.md`.
- Update package versions to `0.0.5` if release/tagging is in scope at execution time.
- Run final verification.
- Document known warnings if any remain.

Out of scope:

- Publishing npm packages unless explicitly requested.
- Creating a release tag unless explicitly requested.

Acceptance criteria:

- Documentation and public site reflect v0.0.5 capabilities.
- Extraction notes capture reusable patterns and deferred abstractions.
- Full verification passes or known residual issues are documented.
- Worktree changes are ready for review.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
git status --short --branch
```
