# Worktrail v0.1.0 Implementation Plan

## Purpose

This plan turns the v0.1.0 PRD and technical design into sequential implementation phases. v0.1.0 should consolidate Worktrail into a clearer product baseline by improving navigation, planning review, work discovery, My Work, mobile work lists, detail-page context, technical seams, CI/lint guardrails, documentation, and the public site.

The release remains local-first. It should preserve the Angular static-hosting path, transport-neutral API handlers, local Express adapter, Postgres persistence, deterministic seed data, production preview, checked-in OpenAPI reference, and clean verification from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.0:

- Use an Angular parent route component for the project shell.
- Keep project child pages lazy-loaded under `projects/:projectId`.
- Use route data for active project section metadata.
- Promote `/work-items` as `Work Items` in primary navigation.
- Rename the global `Workspace` nav item to `Workspace Settings`.
- Keep global creation at `/work-items/new`.
- Keep project-scoped creation at `/projects/:projectId/work-items/new`.
- Use in-page planning tabs with `Review` as the default and `Milestones` as the management tab.
- Persist the planning tab in `?view=review` or `?view=milestones`.
- Use a saved-view toolbar with a picker, save/update actions, and inline manage panel.
- Keep desktop work item tables.
- Add mobile work item cards through responsive rendering.
- Preserve current API routes and URL paths.
- Split contracts by domain while preserving the current package export surface.
- Consolidate work item query parsing and repository predicate construction.
- Add a shared backend risk-policy module.
- Split Express route registration by domain.
- Split the frontend API service into domain clients over one shared request utility.
- Add CI for install, typecheck, unit tests, and production build.
- Add low-churn ESLint coverage.
- Keep Playwright E2E out of required CI for this release unless it proves cheap and stable.
- Do not add a database migration unless implementation discovers a real data requirement.

## Phase Sizing

Each phase should leave the repository in a coherent working state. v0.1.0 is broader than recent feature releases, so phases are grouped around durable seams and user-visible surfaces:

1. baseline planning;
2. contract split and shared query/risk scaffolding;
3. backend query consolidation;
4. Express route registration split;
5. frontend API client split and shared UI utilities;
6. project shell and global navigation;
7. work item discovery filters, results, and saved views;
8. planning review and milestone management;
9. My Work daily queue;
10. work item detail context and panel extraction;
11. responsive work item cards and mobile polish;
12. CI/lint guardrails;
13. documentation, public site, and final verification.

Run API tests after backend phases, frontend tests after UI phases, and full verification during finalization. Prefer small behavior-preserving extractions before visible layout changes on large route components.

## Phase 0: Baseline Planning

Goal: confirm v0.1.0 planning inputs and resolve implementation choices before code changes.

Scope:

- Confirm `docs/v0.1.0/prd.md` exists.
- Confirm `docs/v0.1.0/technical-design.md` exists.
- Confirm `docs/v0.1.0/implementation-plan.md` exists.
- Confirm audit inputs exist:
  - `docs/v0.1.0/ux-audit.md`;
  - `docs/v0.1.0/tech-debt-audit.md`;
  - `docs/v0.1.0/site-audit.md`.
- Confirm design decisions listed above.
- Check repository status before implementation starts.
- Confirm active branch and any staged/untracked changes.

Out of scope:

- Runtime implementation.
- Contract restructuring.
- Frontend route changes.
- API refactors.
- CI/lint setup.

Acceptance criteria:

- The three v0.1.0 planning documents exist.
- The three v0.1.0 audit documents exist.
- No unresolved open decision blocks Phase 1.
- The worktree/index state is understood before implementation starts.

Suggested commands:

```sh
find docs/v0.1.0 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-05.
- Confirmed v0.1.0 planning documents exist:
  - `docs/v0.1.0/prd.md`;
  - `docs/v0.1.0/technical-design.md`;
  - `docs/v0.1.0/implementation-plan.md`.
- Confirmed v0.1.0 audit inputs exist:
  - `docs/v0.1.0/ux-audit.md`;
  - `docs/v0.1.0/tech-debt-audit.md`;
  - `docs/v0.1.0/site-audit.md`.
- Confirmed implementation decisions:
  - use an Angular parent route component for the project shell;
  - keep project child pages lazy-loaded under `projects/:projectId`;
  - use route data for active project section metadata;
  - promote `/work-items` as `Work Items` in primary navigation;
  - rename the global `Workspace` nav item to `Workspace Settings`;
  - keep global creation at `/work-items/new`;
  - keep project-scoped creation at `/projects/:projectId/work-items/new`;
  - use in-page planning tabs with `Review` as the default and `Milestones` as the management tab;
  - persist the planning tab in `?view=review` or `?view=milestones`;
  - use a saved-view toolbar with a picker, save/update actions, and inline manage panel;
  - keep desktop work item tables;
  - add mobile work item cards through responsive rendering;
  - preserve current API routes and URL paths;
  - split contracts by domain while preserving the current package export surface;
  - consolidate work item query parsing and repository predicate construction;
  - add a shared backend risk-policy module;
  - split Express route registration by domain;
  - split the frontend API service into domain clients over one shared request utility;
  - add CI for install, typecheck, unit tests, and production build;
  - add low-churn ESLint coverage;
  - keep Playwright E2E out of required CI for this release unless it proves cheap and stable;
  - do not add a database migration unless implementation discovers a real data requirement.
- Confirmed active branch is `main`.
- Confirmed current change state: `docs/v0.1.0/` is untracked and contains the audit documents plus the three planning documents.
- Verified `git diff --check`.
- No unresolved open decision blocks Phase 1.

## Phase 1: Contract Split And Query/Risk Scaffolding

Goal: create the shared type and test seams that later phases can build on without changing runtime behavior.

Scope:

- Split `packages/contracts/src/index.ts` into domain files:
  - `activity.ts`;
  - `csv.ts`;
  - `health.ts`;
  - `members.ts`;
  - `planning.ts`;
  - `projects.ts`;
  - `saved-work-views.ts`;
  - `workspace.ts`;
  - `work-items.ts`.
- Keep `packages/contracts/src/index.ts` as a barrel export.
- Preserve all existing public contract exports.
- Add lightweight contract tests or type-level runtime tests for representative work item query examples.
- Add `apps/api/src/domain/work-risk-policy.ts`.
- Move shared status sets and risk windows into the risk-policy module:
  - terminal statuses;
  - open statuses;
  - active-unassigned statuses;
  - due-soon window days;
  - stale in-progress threshold days.
- Add pure helper tests for risk-policy behavior.
- Add skeleton query normalization tests around existing behavior before refactoring implementation.

Out of scope:

- Repository query rewrite.
- Frontend filter extraction.
- API route changes.
- DTO shape changes unless required by the split.

Acceptance criteria:

- Contract imports still work from `@worktrail/contracts`.
- API and web compile against the split contract package.
- Risk-policy helper tests pass.
- Query normalization tests document existing expected behavior.
- No API response shape is intentionally changed.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/api
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/api
npm test --workspace @worktrail/web -- --watch=false
git diff --check
```

Status:

- Completed on 2026-07-05.
- Split `packages/contracts/src/index.ts` into domain files while preserving the public `@worktrail/contracts` barrel export:
  - `activity.ts`;
  - `csv.ts`;
  - `health.ts`;
  - `members.ts`;
  - `my-work.ts`;
  - `planning.ts`;
  - `projects.ts`;
  - `saved-work-views.ts`;
  - `workspace.ts`;
  - `work-items.ts`.
- Added `packages/contracts/src/work-item-query.contract.test.ts` with representative contract checks for:
  - workspace discovery query fields;
  - saved-view query storage;
  - health-reason query links;
  - nullable planning-review query links.
- Replaced the contracts package placeholder test script with Vitest and added the workspace dev dependency.
- Added `apps/api/src/domain/work-risk-policy.ts` with shared:
  - terminal/open status predicates;
  - active-unassigned status predicate;
  - due-soon window;
  - stale in-progress threshold;
  - overdue/due-soon/stale date helpers;
  - UTC date helpers.
- Updated workflow, planning, delivery health, My Work, and relationship services to consume the shared policy where behavior already matched.
- Preserved My Work's existing stale-assigned status behavior while sharing its stale window and date helpers.
- Added risk-policy tests in `apps/api/tests/domain.test.ts`.
- Added `apps/api/tests/work-item-query.test.ts` to document current query normalization behavior before Phase 2 repository query consolidation.
- Verified `npm run typecheck --workspace @worktrail/contracts`.
- Verified `npm test --workspace @worktrail/contracts`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm run typecheck --workspace @worktrail/web`.
- Verified `npm test --workspace @worktrail/web -- --watch=false`.
- Verified `git diff --check`.

## Phase 2: Backend Work Item Query Consolidation

Goal: make project and workspace work item list behavior use one canonical query path.

Scope:

- Update `apps/api/src/validation/work-item-query.ts` to expose canonical project and workspace query parsers.
- Normalize empty strings, invalid values, repeated params, defaults, and sort behavior consistently.
- Add `apps/api/src/repositories/work-item-query-builder.ts`.
- Move Drizzle-specific predicate construction into query-builder helpers:
  - project scope;
  - status;
  - assignee;
  - reporter;
  - type;
  - priority;
  - label;
  - milestone;
  - due date;
  - dependency;
  - search;
  - archived mode;
  - ordering.
- Refactor `work-item-repository.ts` to use shared query-builder helpers.
- Ensure project list, workspace list, project export, and workspace export preserve existing behavior.
- Use risk-policy constants where date windows or status sets are needed.
- Add or update API tests for query behavior parity.

Out of scope:

- Frontend filter UI changes.
- Saved-view UI changes.
- New filters.
- OpenAPI changes unless behavior is intentionally clarified.

Acceptance criteria:

- Existing work item list and export behavior is preserved.
- New tests cover representative project and workspace query examples.
- Adding a new filter would have one obvious backend query path.
- API tests pass.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added canonical parser entry points in `apps/api/src/validation/work-item-query.ts`:
  - `parseProjectWorkItemQuery`;
  - `parseWorkspaceWorkItemQuery`;
  - retained `parseWorkItemQuery` as a compatibility alias.
- Removed endpoint-local project work item filter parsing from `apps/api/src/endpoints/work-items.ts`.
- Updated project list and project CSV export handlers to use `parseProjectWorkItemQuery`.
- Updated workspace list and workspace CSV export handlers to use `parseWorkspaceWorkItemQuery`.
- Added `apps/api/src/repositories/work-item-query-builder.ts`.
- Moved shared Drizzle SQL predicate construction into query-builder helpers for:
  - project scope;
  - workspace scope;
  - archived project mode;
  - status and work state;
  - blocked flag;
  - assignee/reporter;
  - type/priority;
  - label/milestone;
  - due date state;
  - dependency filters;
  - search.
- Moved shared order construction into query-builder helpers for project and workspace lists.
- Refactored `work-item-repository.ts` to delegate project and workspace list filtering/ordering to query-builder helpers.
- Reused risk-policy constants for open, terminal, and due-soon SQL behavior where practical.
- Updated relationship dependency counts to derive terminal-status SQL from the shared risk-policy constants.
- Extended work item query tests for project and workspace parser behavior.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `git diff --check`.
- No OpenAPI changes were required because route paths and documented query behavior were preserved.

## Phase 3: Express Route Registration Split

Goal: reduce the Express adapter routing monolith while preserving transport-neutral endpoint handlers and route behavior.

Scope:

- Add route registrar modules under `apps/api/src/adapters/express/routes/`:
  - `health-routes.ts`;
  - `member-routes.ts`;
  - `planning-routes.ts`;
  - `project-routes.ts`;
  - `saved-work-view-routes.ts`;
  - `work-item-routes.ts`;
  - `workspace-routes.ts`.
- Add a shared Express route context type for repositories and optional database access.
- Move route registration from `server.ts` into the registrar modules.
- Keep `createExpressApp` responsible for middleware, health/liveness basics, static assets, test routes, and invoking registrars.
- Preserve all route paths, HTTP methods, handler options, and adapter behavior.
- Add route registration smoke coverage if existing tests do not cover the split sufficiently.

Out of scope:

- Endpoint handler rewrites.
- API path changes.
- Lambda/API Gateway adapter implementation.

Acceptance criteria:

- API tests continue to pass.
- `server.ts` is materially smaller and focused on app assembly.
- All existing API routes remain reachable.
- No OpenAPI changes are required from this phase.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added shared Express route context in `apps/api/src/adapters/express/routes/context.ts`.
- Added route registrar modules:
  - `health-routes.ts`;
  - `member-routes.ts`;
  - `planning-routes.ts`;
  - `project-routes.ts`;
  - `saved-work-view-routes.ts`;
  - `work-item-routes.ts`;
  - `workspace-routes.ts`.
- Moved health, workspace, member, project, planning, saved-view, and work-item route registration out of `server.ts`.
- Kept `createExpressApp` responsible for:
  - Express app creation;
  - CORS;
  - JSON parsing;
  - request logging;
  - route registrar invocation;
  - test routes;
  - static asset serving;
  - SPA fallback behavior.
- Preserved existing route paths, HTTP methods, handler construction, and adapter options.
- Added route registration smoke coverage in `apps/api/tests/server.test.ts` to catch dropped or reordered API routes.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `git diff --check`.
- No OpenAPI changes were required because route paths and behavior were preserved.

## Phase 4: Frontend API Clients And Shared UI Utilities

Goal: split frontend API access by domain and create shared frontend helpers before extracting large UI surfaces.

Scope:

- Add `apps/web/src/app/core/api/api-client.ts` for low-level request behavior:
  - URL construction;
  - actor header;
  - JSON parsing;
  - error normalization;
  - download helpers where needed.
- Add domain clients:
  - `planning-api.ts`;
  - `projects-api.ts`;
  - `saved-views-api.ts`;
  - `work-items-api.ts`;
  - `workspace-api.ts`.
- Keep or adapt `WorktrailApiService` as a compatibility facade if needed during migration.
- Move repeated helpers into shared modules:
  - API error message extraction;
  - member display names;
  - token formatting;
  - status/priority/dependency display labels.
- Add frontend work item query modules:
  - filter options;
  - filter state;
  - filter labels;
  - query serialization.
- Update tests for API clients and shared query helpers.

Out of scope:

- Large route component layout changes.
- Project shell.
- Saved-view toolbar UI.
- Planning page tab split.

Acceptance criteria:

- Existing pages still load through either domain clients or compatibility facade.
- New frontend code has domain-specific API clients available.
- Shared filter/query helpers are covered by focused tests.
- Web typecheck and tests pass.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `ApiClient` for shared Angular HTTP behavior, including base URL construction, actor headers, typed JSON requests, query-param normalization, and blob download responses.
- Added domain API clients for workspace/member, project/label/milestone, planning, saved-view, and work-item APIs.
- Converted `WorktrailApiService` into a compatibility facade over the domain clients so existing route components continue using their current API surface while future phases can migrate incrementally.
- Added shared frontend helpers for API error extraction, member display names, token formatting, work-item filter options, filter state, lookup-backed filter labels, and project/workspace query serialization.
- Added focused specs for error extraction, display formatting, work-item query serialization, and work-item filter labels.
- Verified:
  - `npm run typecheck --workspace @worktrail/web`
  - `npm test --workspace @worktrail/web -- --watch=false`

## Phase 5: Project Shell And Primary Navigation

Goal: make project pages feel like one coherent project workspace and promote cross-project work discovery.

Scope:

- Update global app shell navigation:
  - add `Work Items`;
  - rename `Workspace` to `Workspace Settings`;
  - shorten `Create work item` to `Create` if it improves fit.
- Add `ProjectShellComponent` under `features/projects/project-shell/`.
- Refactor project routes under the parent `projects/:projectId` route.
- Render persistent project header:
  - project name;
  - key;
  - status;
  - delivery health;
  - archived/read-only notice.
- Render project subnavigation:
  - Overview;
  - Work;
  - Board;
  - Planning;
  - Settings.
- Keep active section state visible.
- Add predictable shell actions where they can be link-only and low-state.
- Preserve existing project URLs.
- Update route tests and shell component tests.

Out of scope:

- Reworking individual project page internals.
- Export action integration if it depends on child filter state.
- New project summary endpoint fields.

Acceptance criteria:

- `/projects/:projectId` and all existing child paths still work.
- Any project route shows project identity and active section.
- Top-level nav exposes `Work Items`.
- Workspace administration is labeled clearly.
- Web tests pass.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `ProjectShellComponent` with persistent project identity, project key, status, delivery-health state, archived/read-only notice, shell actions, and section navigation.
- Refactored project routes under the `projects/:projectId` shell while preserving existing project URLs for overview, work, board, planning, settings, create, and import.
- Enabled Angular route param inheritance so existing child project pages continue reading `projectId` from `ActivatedRoute`.
- Updated global navigation to expose `Work Items`, label workspace administration as `Workspace Settings`, and shorten the global create action to `Create`.
- Added route and shell component coverage for the nested route shape, active project shell display, and archived project read-only behavior.
- Verified:
  - `npm run typecheck --workspace @worktrail/web`
  - `npm test --workspace @worktrail/web -- --watch=false`

## Phase 6: Work Discovery Filters, Results, And Saved Views

Goal: make project and workspace work item discovery share one filter/result pattern and make saved views compact by default.

Scope:

- Add `WorkItemFilterPanelComponent`.
- Add `ActiveFilterChipsComponent`.
- Add `WorkItemResultListComponent`.
- Add `SavedViewsToolbarComponent`.
- Refactor `work-item-list-page.component.ts` to use shared filter/result components.
- Refactor `workspace-work-item-list-page.component.ts` to use shared filter/result components and saved-view toolbar.
- Group filters into core and advanced sections.
- Ensure active chips reflect applied filters only.
- Add removable filter chips.
- Move saved-view rename/delete into an inline manage panel.
- Preserve current saved-view create/update/delete capability.
- Preserve current project and workspace filter capabilities.
- Normalize labels:
  - `Status: Blocked`;
  - `Blocked by dependency`;
  - `Blocking other work`.
- Update component tests.

Out of scope:

- New backend filters.
- Bulk editing.
- Saved-view sharing.
- Mobile result card polish beyond structural support if deferred to Phase 10.

Acceptance criteria:

- Workspace `Work Items` opens with results closer to the top and saved views compact.
- Project and workspace filter labels are consistent.
- Filter chips can remove applied filters.
- Saved-view management is available without dominating the default page.
- Existing saved views continue to load and apply.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added shared work discovery components:
  - `WorkItemFilterPanelComponent` for core/advanced filter grouping;
  - `ActiveFilterChipsComponent` with removable applied filter chips;
  - `WorkItemResultListComponent` for project and workspace work item result tables;
  - `SavedViewsToolbarComponent` with compact default saved-view presentation and inline manage panel.
- Refactored project work item discovery to use the shared filter panel, active chips, and result list while preserving existing export, query-param, archived-project, and filter behavior.
- Refactored workspace work item discovery to use the shared filter panel, active chips, result list, and compact saved-view toolbar while preserving saved-view create/open/rename/update/delete behavior.
- Added chip removal handlers that clear the applied filter through the existing URL query flow.
- Added focused component tests for active filter chips and saved-view toolbar behavior; existing project/workspace list tests continue covering API and route-query behavior.
- Verified:
  - `npm run typecheck --workspace @worktrail/web`
  - `npm test --workspace @worktrail/web -- --watch=false`

## Phase 7: Planning Review And Milestone Management

Goal: make Planning review-first while preserving complete milestone management.

Scope:

- Split the planning route component into focused components:
  - `PlanningReviewComponent`;
  - `MilestoneManagerComponent`;
  - optional `MilestoneProgressListComponent`.
- Add in-page planning view control:
  - `Review`;
  - `Milestones`.
- Persist selected view in `?view=review` or `?view=milestones`.
- Default missing/invalid view to `Review`.
- Move delivery health, reasons, needs attention, upcoming, recently changed, milestone progress, and risk sections into Review.
- Move create/edit/archive/reactivate milestone controls into Milestones.
- Render compact read-only milestone summaries for contributors or archived projects.
- Collapse long risk lists after a small number of items.
- Ensure health reason links use current filter query behavior and consistent terminology.
- Update planning component tests.

Out of scope:

- New planning endpoint unless existing data proves insufficient.
- Charts.
- Forecasting.
- Custom health rules.

Acceptance criteria:

- Planning opens on Review.
- A project owner can identify top risks before interacting with milestone edit controls.
- Milestone management remains discoverable and complete.
- Contributor/read-only states do not show disabled edit forms as the primary milestone presentation.
- Web tests pass.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `Review` and `Milestones` planning views with `Review` as the default and selected view persisted through `?view=review` or `?view=milestones`.
- Split the planning surface into focused `PlanningReviewComponent` and `MilestoneManagerComponent` wrappers while preserving the existing route-owned data loading and mutation behavior.
- Moved milestone create/edit/archive/reactivate controls behind the Milestones view so Planning opens as a review-first dashboard.
- Rendered read-only milestone summaries for contributors and archived projects without presenting disabled edit forms as the primary state.
- Collapsed long planning risk lists to the first four items with a compact overflow affordance to the filtered work item list when available.
- Updated planning page tests for default Review behavior, Milestones view switching, milestone mutation flows, and read-only milestone states.
- Verified:
  - `npm run typecheck --workspace @worktrail/web`
  - `npm test --workspace @worktrail/web -- --watch=false`
  - `git diff --check`

## Phase 8: My Work Daily Queue

Goal: make My Work a prioritized daily action queue with less duplication.

Scope:

- Add feature-local My Work components if useful:
  - `DailyQueueComponent`;
  - `MyWorkSummaryComponent`.
- Build a `Needs attention` queue from assigned work signals:
  - overdue;
  - due soon;
  - status blocked;
  - blocked by dependency;
  - stale in-progress;
  - other current urgent assigned signals.
- Dedupe queue items by work item id.
- Use summary cards as queue filters or section controls.
- Collapse or hide empty low-signal sections.
- Keep reported-by-me visible as secondary content.
- Apply section-appropriate sorting.
- Extend My Work DTO only if current data cannot support stable ordering.
- Update component and service tests.

Out of scope:

- Notifications.
- Personal preferences.
- Saved My Work views.
- New assignment model.

Acceptance criteria:

- A contributor can open My Work and identify the next actionable items quickly.
- The same item is not repeatedly shown across default sections without clear value.
- Empty states are compact.
- Existing My Work data continues to load.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added feature-local My Work components:
  - `DailyQueueComponent` for the review-first attention queue;
  - `MyWorkSummaryComponent` for summary cards that focus the queue and expose full-list links.
- Extended the My Work contract and API response with `reportedByMe` so reported work can remain visible as real secondary content.
- Reworked My Work into a deduped `Needs attention` queue built from assigned-work signals:
  - overdue;
  - due soon;
  - blocked status;
  - dependency-blocked assigned work;
  - stale in-progress work;
  - urgent assigned work without stronger risk signals.
- Demoted reported-by-me and recently-updated work into secondary sections, excluding items already shown in the attention queue.
- Replaced repeated empty section panels with compact empty states and hid empty low-signal recently-updated content.
- Updated API and web tests for the new `reportedByMe` field, queue deduping, queue filtering from summary cards, and compact empty states.
- Verified:
  - `npm run typecheck --workspace @worktrail/web`
  - `npm test --workspace @worktrail/web -- --watch=false`
  - `npm run typecheck --workspace @worktrail/api`
  - `npm test --workspace @worktrail/api`

## Phase 9: Work Item Detail Context And Panel Extraction

Goal: make work item detail easier to read first and edit second, while reducing the size of the route component.

Scope:

- Add focused detail components:
  - header summary;
  - relationship panel;
  - comment thread;
  - activity timeline;
  - details form/edit section if practical.
- Surface near the title:
  - display key;
  - status;
  - assignee;
  - milestone;
  - due date;
  - priority;
  - labels;
  - dependency state.
- Add safe return context support through query params.
- Validate return URLs as internal-only paths.
- Fall back to project work list or workspace work items when return context is missing.
- Ensure links from work lists, board cards, My Work, planning, and health reasons can provide return context where practical.
- Keep existing edit, relationship, comment, and activity behavior.
- Update detail tests.

Out of scope:

- Full read/edit mode rewrite if component extraction already delivers the readability improvement.
- Rich text comments.
- Activity filtering.

Acceptance criteria:

- Detail page state is understandable before editing fields.
- Common navigation paths can return to their originating list/board context.
- Invalid external return paths are ignored.
- Existing relationship, comment, activity, and edit tests continue to pass.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added focused detail components:
  - `WorkItemDetailSummaryComponent` for read-first title, display key, status, priority, assignee, milestone, due date, labels, and dependency state;
  - `ActivityTimelineComponent` for activity rendering and empty state ownership.
- Kept edit, status transition, relationship, comment, and activity refresh behavior route-owned to avoid destabilizing existing mutations.
- Added safe `returnUrl` query-param support on detail:
  - accepts internal app paths only;
  - rejects external URLs, protocol URLs, protocol-relative URLs, malformed paths, and control characters;
  - preserves safe query parameters;
  - falls back to the project work list or workspace work items.
- Added return context from project work lists, workspace work lists, board cards, My Work queue/secondary rows, and planning review/risk rows.
- Updated detail, workspace list, My Work, and planning tests for return context behavior.
- Verified:
  - `npm run typecheck --workspace @worktrail/web`
  - `npm test --workspace @worktrail/web -- --watch=false`

## Phase 10: Responsive Work Item Cards And Mobile Polish

Goal: make core work item scanning intentionally readable on mobile.

Scope:

- Complete mobile card rendering in `WorkItemResultListComponent`.
- Ensure mobile cards show:
  - title;
  - display key;
  - project for workspace lists;
  - status;
  - priority;
  - assignee;
  - milestone;
  - due date;
  - dependency signal.
- Collapse dense filters behind a compact mobile control.
- Keep active filter chips visible above results.
- Ensure saved-view management does not appear before results unless explicitly opened.
- Review project subnav behavior on narrow widths.
- Review actor selector dominance on narrow widths.
- Add or update responsive tests where practical.
- Use Playwright screenshots/checks if a local dev server is needed to validate layout.

Out of scope:

- Native mobile app behavior.
- Gesture-specific features.
- Complete visual redesign.

Acceptance criteria:

- Work item lists do not require interpreting clipped table columns on common mobile widths.
- No page-level horizontal overflow is introduced.
- Filters remain understandable on mobile.
- Project subnav and top nav remain usable at narrow widths.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false
npm run build --workspace @worktrail/web
git diff --check
```

Completed in Phase 10:

- Added mobile work item cards that replace the dense results table at narrow widths.
- Included title, display key, type, project badge/detail for workspace lists, status, priority, assignee, milestone, due date, labels, and dependency signal on the mobile card surface.
- Collapsed the dense filter panel behind a compact mobile `Filters` control while keeping active filter chips outside the panel.
- Kept saved-view management behind its existing explicit disclosure control.
- Tightened global nav, actor selector, and project subnav behavior for narrow screens.
- Added component tests for mobile result-card content/linking and compact filter toggle/apply behavior.
- Verified:
  - `npm run typecheck --workspace @worktrail/web`
  - `npm test --workspace @worktrail/web -- --watch=false`
  - `npm run build --workspace @worktrail/web`
  - `git diff --check`

## Phase 11: CI And Lint Guardrails

Goal: add lightweight project guardrails appropriate for a growing reference app.

Scope:

- Add `.github/workflows/ci.yml`.
- Run CI on pull requests and pushes to `main`.
- Configure CI for:
  - checkout;
  - Node 20;
  - `npm ci`;
  - `npm run typecheck`;
  - `npm test`;
  - `npm run build`.
- Add ESLint dependencies and config for low-churn TypeScript checks.
- Add workspace lint scripts for API, web, and contracts where practical.
- Keep the root `npm run lint` script working.
- Fix lint findings introduced by the initial rule set.
- Decide whether lint is included in CI immediately or staged as a documented local check if initial Angular lint setup is too noisy.

Out of scope:

- Required Playwright E2E in CI unless it proves stable and cheap.
- Aggressive style-only linting.
- Prettier migration.
- Commit hooks.

Acceptance criteria:

- CI workflow is checked in and uses standard repo commands.
- `npm run lint` has real coverage or documented workspace coverage.
- Lint catches common defects without forcing broad unrelated rewrites.
- Typecheck, test, and build still pass locally.

Suggested commands:

```sh
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Completed in Phase 11:

- Added `.github/workflows/ci.yml` for pull requests and pushes to `main`.
- Configured CI to run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
- Added a root ESLint flat config with low-churn TypeScript, Angular TypeScript, and Angular template coverage.
- Added workspace `lint` scripts for API, web, and contracts while preserving the root `npm run lint` command.
- Included lint in CI immediately because the baseline rule set was clean after targeted fixes.
- Fixed initial lint findings:
  - removed an unused delivery-health priority rank;
  - renamed the My Work summary output away from the native `select` event name;
  - removed unused test imports;
  - rewrote the safe return URL control-character check without a control-character regex.
- Verified:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `git diff --check`

## Phase 12: Documentation And Public Site Refresh

Goal: align documentation and the public site with the v0.1.0 product baseline.

Scope:

- Update `README.md` with v0.1.0 baseline capabilities and local verification.
- Update operations docs if CI, preview, readiness, or verification guidance changes.
- Update extraction notes for:
  - project shell;
  - query consolidation;
  - risk policy;
  - route registration;
  - API client split;
  - feature-local component extraction.
- Update OpenAPI only if endpoint behavior or documented query behavior changes.
- Refresh `site/index.html` copy:
  - shorter hero;
  - product workflow groups;
  - v0.1.0 baseline section;
  - clearer developer/reference value;
  - concise current-scope limitations.
- Update `site/styles.css` only as needed for the refreshed hierarchy.
- Refresh the primary screenshot after UX consolidation if needed.
- Ensure GitHub Pages deployment workflow remains compatible.

Out of scope:

- Site generator.
- Multi-page marketing site.
- Hosted documentation portal.

Acceptance criteria:

- README reflects the current app capabilities and verification commands.
- Public site reads as a consolidated v0.1.0 baseline, not release-history prose.
- Product and developer value are both clear.
- Site remains static and deployable by the existing Pages workflow.

Suggested commands:

```sh
npm run build
git diff --check
```

Completed in Phase 12:

- Updated `README.md` around the v0.1.0 baseline, current capabilities, limitations, CI, lint, and verification commands.
- Updated the operations runbook with v0.1.0 preview framing and CI/lint verification guidance.
- Added `docs/v0.1.0/jawstack-extraction-notes.md` covering:
  - project shell;
  - query consolidation;
  - risk policy;
  - route registration split;
  - API client split;
  - feature-local component extraction;
  - CI/lint guardrails.
- Refreshed `site/index.html` around grouped product workflows, v0.1.0 baseline value, developer/reference value, operations, and current-scope limitations.
- Updated `site/styles.css` for grouped capability lists and the baseline value grid.
- Left OpenAPI unchanged because Phase 12 did not change endpoint behavior or query semantics.
- Kept the existing primary screenshot because the public site refresh was hierarchy/copy focused and the board image remains a representative product signal.
- Verified the existing GitHub Pages workflow remains compatible because the site is still static under `site/`.
- Verified:
  - `npm run build`
  - `git diff --check`

## Phase 13: Final Verification And Release Notes

Goal: finish v0.1.0 with full verification and clear release documentation.

Scope:

- Run full local verification:
  - lint;
  - typecheck;
  - unit tests;
  - production build.
- Run Playwright smoke tests if local Postgres and app startup are available.
- Manually inspect core flows:
  - My Work;
  - Work Items;
  - Projects;
  - project shell subnav;
  - Planning Review/Milestones;
  - saved views;
  - work item detail return context;
  - mobile work item lists;
  - public site.
- Update implementation plan phase statuses as completed.
- Add release notes or summary documentation for v0.1.0.
- Confirm no generated artifacts are unintentionally included.
- Confirm repository status before handoff.

Out of scope:

- Creating the release tag unless explicitly requested.
- Publishing/deploying beyond existing workflows unless explicitly requested.

Acceptance criteria:

- Full verification passes or any failures are documented with specific residual risk.
- v0.1.0 documentation is complete.
- Implementation plan reflects completed phases.
- Worktree status is understood.
- The release is ready for user QA/UAT.

Suggested commands:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
git status --short --branch
git diff --check
```

Completed in Phase 13:

- Added `docs/v0.1.0/release-notes.md` with the v0.1.0 product highlights, technical highlights, documentation/site updates, verification evidence, and known limitations.
- Bumped package metadata to `0.1.0` for:
  - root workspace package;
  - `@worktrail/api`;
  - `@worktrail/web`;
  - `@worktrail/contracts`.
- Updated `package-lock.json` after the package version bump.
- Fixed a saved-view toolbar submit bug discovered during E2E verification by using a native submit handler that prevents default form navigation.
- Updated Playwright smoke coverage for the v0.1.0 project shell, planning tabs, saved-view manager, My Work summary-to-list flow, dependency workflow, and responsive smoke assertions.
- Confirmed Playwright database reset/migrate/seed setup remains functional.
- Confirmed no generated test or build artifacts are intentionally included in the release changes.
- Confirmed repository status before handoff.
- Verified:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
  - `git diff --check`

## Verification Cadence

Use this cadence unless a phase requires broader checks:

- Backend-only phases: API typecheck and API tests.
- Contract phases: contracts, API, and web typecheck.
- Frontend-only phases: web typecheck and web tests.
- Cross-stack phases: root typecheck and tests.
- Final phase: lint, typecheck, tests, build, and E2E when available.

Prefer focused checks while iterating, then broaden before closing each phase.

## Deferred Items

Defer these unless the user explicitly changes scope:

- hosted authentication and tenancy;
- notifications;
- charts and forecasting;
- bulk editing;
- custom workflow/status configuration;
- integrations;
- cloud infrastructure templates;
- generated API/client pipeline;
- full design-system package;
- NgRx or another global state framework;
- mandatory E2E in CI.
