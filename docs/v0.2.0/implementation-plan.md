# Worktrail v0.2.0 Implementation Plan

## Purpose

This plan turns the v0.2.0 PRD and technical design into sequential implementation phases.

v0.2.0 is a consolidation release. It should make the expanded v0.1.x product feel coherent, reduce duplicated control surfaces, extract the most useful repeated orchestration, and update the public face of Worktrail around the current product baseline.

The release should preserve:

- local-first development;
- Angular static-hosting compatibility;
- transport-neutral API endpoint handlers;
- the local Express adapter;
- Postgres persistence;
- deterministic seed data;
- checked-in OpenAPI docs;
- GitHub Pages public site deployment;
- full local verification.

No database schema migration is planned.

## Design Decisions

Use these decisions while implementing v0.2.0:

- Use `Reports` as the project shell navigation label.
- Preserve existing `/projects/:projectId/status` route paths for compatibility.
- Update root and workspace package metadata to `0.2.0`.
- Keep git tags and release notes as authoritative release artifacts, with package versions mirroring the product release.
- Do targeted extraction behind compatibility facades.
- Keep `WorkItemService` endpoint-facing while extracting helpers only where the v0.2.0 work benefits directly.
- Add shared risk-section assembly for Planning, Milestone Review, and Reports.
- Add versioned runtime parsing for status report snapshots.
- Prefer domain API clients and feature-local stores for new frontend orchestration.
- Keep `WorktrailApiService` only as a compatibility facade for older code.
- Keep saved-view, copy-link, return-URL, CSV export, and query behavior stable.
- Make project bulk triage an explicit mode.
- Improve Work Item Detail hierarchy without requiring a full edit-on-demand redesign.
- Treat public-site screenshot refresh as optional.
- Keep pattern notes destination-neutral.

## Phase Sizing

Each phase should leave the repository in a coherent working state.

Implementation phases:

1. baseline planning;
2. release metadata and baseline verification;
3. project navigation and terminology cleanup;
4. work-list state extraction scaffold;
5. saved-view control consolidation;
6. workspace/project work-list layout consolidation;
7. explicit project bulk triage mode;
8. backend risk-section consolidation;
9. status report snapshot validation;
10. planning, milestone review, report, and detail framing;
11. public site consolidation;
12. documentation, release notes, pattern notes, and final verification.

Run focused web tests after frontend phases, focused API tests after backend phases, and full verification in Phase 12. Prefer behavior-preserving extraction before user-visible layout changes on large route components.

## Phase 0: Baseline Planning

Goal: confirm v0.2.0 planning inputs and resolve implementation choices before runtime changes.

Scope:

- Confirm v0.2.0 audit inputs exist:
  - `docs/v0.2.0/ux-audit.md`;
  - `docs/v0.2.0/tech-debt-audit.md`;
  - `docs/v0.2.0/site-audit.md`.
- Confirm planning documents exist:
  - `docs/v0.2.0/prd.md`;
  - `docs/v0.2.0/technical-design.md`;
  - `docs/v0.2.0/implementation-plan.md`.
- Confirm design decisions listed above.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm whether a `v0.2.0` branch should be checked out before runtime work begins.

Out of scope:

- Runtime implementation.
- UI changes.
- API changes.
- Documentation beyond planning status.

Acceptance criteria:

- The three v0.2.0 audit documents exist.
- The three v0.2.0 planning documents exist.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.

Suggested commands:

```sh
find docs/v0.2.0 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-09.
- Confirmed v0.2.0 audit inputs exist:
  - `docs/v0.2.0/ux-audit.md`;
  - `docs/v0.2.0/tech-debt-audit.md`;
  - `docs/v0.2.0/site-audit.md`.
- Confirmed v0.2.0 planning documents exist:
  - `docs/v0.2.0/prd.md`;
  - `docs/v0.2.0/technical-design.md`;
  - `docs/v0.2.0/implementation-plan.md`.
- Confirmed implementation decisions:
  - use `Reports` as the project shell navigation label;
  - preserve existing `/projects/:projectId/status` route paths for compatibility;
  - update root and workspace package metadata to `0.2.0`;
  - keep package versions aligned with product release tags unless a future release process changes that policy;
  - use targeted extraction behind compatibility facades;
  - keep `WorkItemService` endpoint-facing while extracting helpers only where v0.2.0 work benefits directly;
  - add shared risk-section assembly for Planning, Milestone Review, and Reports;
  - add versioned runtime parsing for status report snapshots;
  - prefer domain API clients and feature-local stores for new frontend orchestration;
  - keep `WorktrailApiService` as a compatibility facade for older code;
  - make project bulk triage an explicit mode;
  - improve Work Item Detail hierarchy without requiring a full edit-on-demand redesign;
  - treat public-site screenshot refresh as optional.
- Confirmed active branch is `v0.2.0`; no branch checkout is needed before runtime work begins.
- Confirmed current change state: `docs/v0.2.0/` is untracked and contains only v0.2.0 audit and planning documents.
- Verified:
  - `find docs/v0.2.0 -maxdepth 1 -type f | sort`;
  - `git status --short --branch`;
  - `git diff --check`;
  - `git branch --show-current`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Release Metadata And Baseline Verification

Goal: align version identity and confirm the current product baseline before code movement starts.

Scope:

- Update package metadata to `0.2.0`:
  - root `package.json`;
  - `apps/api/package.json`;
  - `apps/web/package.json`;
  - `packages/contracts/package.json`;
  - lockfile entries as needed.
- Confirm no package publish workflow needs adjustment.
- Run baseline verification before refactors:
  - lint;
  - typecheck;
  - unit/API/web tests;
  - production build.
- Record any pre-existing failure before changing implementation code.

Out of scope:

- Feature implementation.
- API behavior changes.
- UI layout changes.

Acceptance criteria:

- Package metadata consistently reports `0.2.0`.
- Lockfile is updated if required.
- Baseline verification is green, or any pre-existing failure is recorded with cause and next action.

Suggested commands:

```sh
npm install --package-lock-only
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Status:

- Completed on 2026-07-09.
- Updated first-party package metadata to `0.2.0`:
  - root `package.json`;
  - `apps/api/package.json`;
  - `apps/web/package.json`;
  - `packages/contracts/package.json`.
- Updated the API workspace dependency on `@worktrail/contracts` to `0.2.0`.
- Refreshed `package-lock.json` with `npm install --package-lock-only`.
- Confirmed no package publish workflow adjustment is needed; all packages remain private.
- Initial full `npm test` found the known My Work queue ordering/date issue captured by the v0.2.0 tech-debt audit.
- Fixed the baseline by freezing the My Work component spec date to `2026-07-08T12:00:00.000Z`, preserving the fixture's intended due-today behavior and avoiding date-dependent queue ordering drift.
- Verified:
  - `npm install --package-lock-only`;
  - `npm run lint`;
  - `npm run typecheck`;
  - focused My Work web spec;
  - `npm test`;
  - `npm run build`.
- npm audit after lockfile refresh reported 6 existing vulnerabilities:
  - 2 low;
  - 4 moderate.
- No dependency audit remediation was performed in Phase 1 because it would change dependency versions outside the release-metadata and baseline-verification scope.

## Phase 2: Project Navigation And Terminology Cleanup

Goal: make project pages use one clear project navigation model and replace overloaded report terminology.

Scope:

- Update project shell navigation label from `Status` to `Reports`.
- Preserve existing report route paths under `/status`.
- Update related page titles, headings, and empty-state copy to use report-oriented language.
- Remove page-local project navigation duplicated by the project shell.
- Keep page-specific commands in child page headers.
- Clarify labels where terminology currently overlaps:
  - workspace-wide work discovery versus project work;
  - pinned shortcuts versus saved views versus manage views;
  - blocked status versus dependency-blocked filter state.
- Update project shell and route tests.

Out of scope:

- Route aliasing from `/status` to `/reports`.
- Visual redesign of project shell.
- Saved-view layout restructuring beyond terminology required by this phase.

Acceptance criteria:

- `/projects/:projectId/*` pages show one project section navigation model.
- Project nav uses `Reports`.
- Existing `/status` links still work.
- Tests cover the changed project shell label and removed duplicate nav where practical.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include '**/project-shell*.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-09.
- Updated the project shell section label from `Status` to `Reports` while preserving the existing `/projects/:projectId/status` route path.
- Updated report route titles to use `Reports`, `New Report`, and `Report`.
- Updated report list, draft, and detail page copy so the project section reads as `Reports` and published reports are framed as snapshots.
- Removed duplicated project section navigation from project child page headers:
  - Overview;
  - Work;
  - Board;
  - Planning;
  - Settings;
  - Import;
  - placeholder project page.
- Preserved workflow-specific links such as risk links, milestone review back-links, import result links, copy/export/import actions, and report routes.
- Left real project/work item status terminology intact where it refers to lifecycle state or workflow status.
- Updated web specs for:
  - project shell navigation labels;
  - report page copy;
  - planning page relying on shell-owned navigation;
  - overview page no longer rendering local project actions.
- Verified:
  - focused affected web specs;
  - `npm run lint --workspace @worktrail/web`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm test --workspace @worktrail/web -- --watch=false --browsers=ChromeHeadless`.

## Phase 3: Work-List State Extraction Scaffold

Goal: extract shared work-list query and saved-view orchestration enough to support the UI consolidation safely.

Scope:

- Add feature-local state folder:
  - `apps/web/src/app/features/work-items/state/`.
- Add `work-list-query.store.ts` or equivalent helper responsible for:
  - route query parsing;
  - active query derivation;
  - pending filter state;
  - canonical query navigation;
  - reset behavior;
  - copy-link/export query construction.
- Add `saved-views.store.ts` or equivalent helper responsible for:
  - load state;
  - create/update/rename/pin/delete orchestration;
  - pinned shortcut derivation;
  - scope-aware permission behavior.
- Keep existing components working while stores are introduced.
- Add focused tests for the extracted state.

Out of scope:

- Large visual layout changes.
- Project bulk triage behavior.
- Backend saved-view contract changes.

Acceptance criteria:

- Workspace and project work-list pages can share extracted query/saved-view behavior.
- Existing saved-view and filter behavior remains stable.
- Store/helper tests cover representative workspace and project paths.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include '**/work-items/state/**/*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include '**/work-item*list*.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-09.
- Added feature-local work-item state helpers:
  - `apps/web/src/app/features/work-items/state/work-list-query.store.ts`;
  - `apps/web/src/app/features/work-items/state/saved-views.store.ts`.
- Extracted shared work-list query behavior into `WorkListQueryStore`:
  - route query parsing for workspace and project lists;
  - active versus pending filter state;
  - active and pending query derivation;
  - canonical router query-param construction;
  - reset behavior;
  - return URL and copy-link URL construction;
  - meaningful query field counting for saved-view labels.
- Wired workspace and project work-list pages through `WorkListQueryStore` for:
  - route query parsing;
  - apply-filter navigation query params;
  - saved-view open navigation query params;
  - detail return URLs;
  - copy-view-link URLs;
  - export/list active query derivation.
- Added `SavedViewsStore` as the shared saved-view orchestration scaffold for upcoming toolbar consolidation:
  - load state and load errors;
  - create, rename, query update, pin, and delete orchestration;
  - draft-name synchronization;
  - personal/shared grouping;
  - pinned personal/shared shortcut derivation;
  - scope-aware personal/shared permission checks.
- Added focused state tests:
  - `apps/web/src/app/features/work-items/state/work-list-query.store.spec.ts`;
  - `apps/web/src/app/features/work-items/state/saved-views.store.spec.ts`.
- Verified:
  - `npm test --workspace @worktrail/web -- --watch=false --browsers=ChromeHeadless --include 'src/app/features/work-items/state/**/*.spec.ts'`;
  - `npm test --workspace @worktrail/web -- --watch=false --browsers=ChromeHeadless --include 'src/app/features/work-items/*work-item-list-page.component.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`.

## Phase 4: Saved-View Control Consolidation

Goal: reduce default saved-view administration noise while preserving all saved-view capability.

Scope:

- Keep pinned shortcuts visible.
- Move saved-view creation behind a compact `Save view` action.
- Move rename, update query, pin/unpin, and delete controls behind `Manage views`.
- Keep active filter chips visible outside any collapsed filter or manage panel.
- Preserve workspace and project saved-view permission rules.
- Preserve canonical query, copy-link, return-URL, and export behavior.
- Update component styles for desktop and mobile scanability.
- Add or update component tests for:
  - pinned shortcuts;
  - save view;
  - manage views;
  - permission-gated actions;
  - active chips.

Out of scope:

- Modal/dialog introduction unless inline management remains unusable.
- Backend saved-view changes.
- Bulk edit mode.

Acceptance criteria:

- Saved-view management forms do not dominate the default work-list page.
- All existing saved-view actions remain available.
- Workspace and project behavior stays aligned.
- Mobile users can reach views and filters without scrolling past full management forms.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include '**/saved-views*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include '**/pinned-saved-views*.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-09.
- Consolidated `SavedViewsToolbarComponent` so saved-view administration no longer dominates the default work-list page:
  - creation now lives behind a compact `Save view` disclosure;
  - open, rename, update query, pin/unpin, and delete controls now live behind `Manage views`;
  - shared/personal counts, load errors, mutation errors, and permission helper copy remain visible;
  - read-only users can still open saved views from the manage panel without mutation controls.
- Kept pinned shortcuts visible outside the saved-view management surface through `PinnedSavedViewsComponent`.
- Preserved workspace and project permission behavior:
  - contributors cannot manage shared saved views;
  - archived project saved views remain read-only;
  - personal saved views remain manageable where allowed.
- Tightened saved-view component tests around the compact default state:
  - explicit `Save view` disclosure;
  - explicit `Manage views` disclosure;
  - pinned shortcut rendering;
  - permission-gated actions;
  - project/workspace saved-view copy and query summaries.
- Fixed the Phase 3 query-store integration so page-level `appliedFilterValues` aliases the shared query store's active filter signal, preserving existing hidden-filter export/copy behavior.
- Verified:
  - `npm test --workspace @worktrail/web -- --watch=false --browsers=ChromeHeadless --include 'src/app/features/work-items/components/*saved-views*.component.spec.ts'`;
  - `npm test --workspace @worktrail/web -- --watch=false --browsers=ChromeHeadless --include 'src/app/features/work-items/workspace-work-item-list-page.component.spec.ts' --include 'src/app/features/work-items/work-items-page.component.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`.

## Phase 5: Workspace And Project Work-List Layout Consolidation

Goal: make work-list pages lead with operating views, filters, actions, and results instead of dense controls.

Scope:

- Apply consistent zones to workspace and project work lists:
  - page header;
  - view shortcuts;
  - filters and active chips;
  - actions;
  - results.
- Keep result tables/cards stable.
- Keep first result row higher on desktop and mobile by reducing control stacking.
- Preserve copy link, CSV export, import, create, saved views, filters, sort, and return-URL behavior.
- Update mobile styles so filters can be collapsed while active chips remain visible.
- Update tests for work-list rendering and query behavior.

Out of scope:

- Project bulk mode implementation, except reserving the entry point location.
- API changes.
- Full design-system rewrite.

Acceptance criteria:

- Workspace and project work-list pages share a clear control hierarchy.
- Existing work-list workflows still pass tests.
- Active chips accurately represent applied filters, not pending edits.
- The pages remain usable on mobile without excessive pre-results stacking.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include '**/workspace-work-item-list*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include '**/work-item-list*.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-09.
- Consolidated workspace and project work-list templates into explicit operating zones:
  - page header;
  - saved-view shortcuts and saved-view management;
  - active filter chips and filter panel;
  - project action mode;
  - results.
- Moved active filter chips above the collapsible filter panel so applied filters remain visible even when filters are collapsed on mobile.
- Kept pinned saved-view shortcuts visible above saved-view management.
- Preserved existing header actions:
  - copy link;
  - CSV export;
  - workspace create;
  - project import and create.
- Preserved project bulk-action behavior while placing it in the new `work-list-actions` zone.
- Normalized parent page spacing around zones so the result list depends on consistent grid gaps instead of stacked section margins.
- Updated focused work-list specs to verify:
  - workspace/project zone rendering;
  - active chips precede the collapsible filter panel;
  - existing query, action, saved-view, and result behavior remains intact.
- Verified:
  - `npm test --workspace @worktrail/web -- --watch=false --browsers=ChromeHeadless --include 'src/app/features/work-items/workspace-work-item-list-page.component.spec.ts' --include 'src/app/features/work-items/work-items-page.component.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`.

## Phase 6: Explicit Project Bulk Triage Mode

Goal: make project bulk triage a deliberate, recoverable workflow instead of an always-present list affordance.

Scope:

- Add `project-bulk-triage.store.ts` or equivalent helper for:
  - enter/exit mode;
  - selected ids;
  - visible selected rows;
  - apply state;
  - partial-success summary;
  - selection reset.
- Add a `Bulk edit` entry point for owners/maintainers on project Work.
- Hide selection checkboxes until bulk mode is active.
- Keep `Exit bulk edit` visible while mode is active.
- Keep selection count, action selector, apply/cancel controls, and result summary together.
- Preserve partial-success behavior:
  - updated rows;
  - unchanged rows;
  - failed rows;
  - failed item recovery path.
- Preserve contributor and archived-project read-only behavior.
- Add focused tests for mode and permissions.

Out of scope:

- New bulk actions beyond existing supported actions.
- Backend contract redesign unless existing behavior has a defect.
- Drag/drop or board changes.

Acceptance criteria:

- Maintainers can enter bulk mode, select visible work, apply an update, understand the result, and exit.
- Contributors and archived projects do not expose mutation-oriented bulk controls.
- Active filters and saved-view context survive entering and exiting bulk mode.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include '**/project-bulk*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include '**/work-item-list*.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-09.
- Added `ProjectBulkTriageStore` for project bulk mode state:
  - enter and exit mode;
  - selected ids and selected visible rows;
  - all-visible selection;
  - selection pruning after reloads;
  - apply state;
  - error/result feedback;
  - partial-success recovery by retaining failed rows.
- Added an explicit `Bulk edit` entry point for owners and maintainers on project work lists.
- Hid selection checkboxes until bulk edit mode is active.
- Added an always-visible `Exit bulk edit` control while mode is active.
- Kept selection count, action selector, apply/clear controls, and result summary grouped in the bulk action zone.
- Preserved read-only behavior:
  - contributors do not see bulk mutation controls;
  - archived projects do not see bulk mutation controls.
- Preserved existing bulk actions and API request shape.
- Updated focused tests for:
  - bulk mode entry;
  - hidden selection before mode entry;
  - contributor/archive permissions;
  - selection pruning;
  - partial-success failed-row recovery;
  - existing bulk action serialization.
- Verified:
  - `npm test --workspace @worktrail/web -- --watch=false --browsers=ChromeHeadless --include 'src/app/features/work-items/state/project-bulk-triage.store.spec.ts' --include 'src/app/features/work-items/work-items-page.component.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`.

## Phase 7: Backend Risk-Section Consolidation

Goal: define risk sections once and reuse them across Planning, Milestone Review, and Reports.

Scope:

- Add `apps/api/src/services/work-risk-sections.ts`.
- Move shared risk metadata and item assembly into the new module:
  - type;
  - title;
  - description;
  - predicate;
  - sorting;
  - preview limit;
  - planning-risk item DTO assembly.
- Update:
  - `PlanningService`;
  - `MilestoneReviewService`;
  - `ProjectStatusReportService`.
- Preserve existing response shapes and report snapshot semantics.
- Add tests proving project-wide and milestone-scoped risk sections still match expected behavior.
- Extract `WorkItemService` helpers only if directly needed by this work.

Out of scope:

- Full `WorkItemService` decomposition.
- New risk categories unless required to preserve existing behavior.
- Database changes.

Acceptance criteria:

- Risk section definitions live in one place.
- Planning, Milestone Review, and Reports use the shared assembly path.
- Existing API tests pass.
- Adding or changing a risk category no longer requires parallel edits across three services.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/planning*.test.ts
npm test --workspace @worktrail/api -- tests/*status-report*.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-09.
- Added `apps/api/src/services/work-risk-sections.ts` as the shared home for:
  - risk section type/title/description metadata;
  - project-wide and milestone-scoped query assembly;
  - risk predicates and sort ordering;
  - preview limiting;
  - `PlanningRiskItemDto` hydration.
- Updated `PlanningService` to reuse shared planning-risk item assembly and shared risk sort helpers while preserving its existing summary bucket behavior.
- Updated `MilestoneReviewService` to build all risk sections through the shared risk-section definitions.
- Updated `ProjectStatusReportService` to build snapshot risk sections through the same shared definitions, preserving snapshot version `1` shape.
- Added `apps/api/tests/work-risk-sections.test.ts` to prove milestone-scoped sections and project-wide report risks stay aligned.
- Verified:
  - `npm test --workspace @worktrail/api -- tests/work-risk-sections.test.ts`;
  - `npm test --workspace @worktrail/api -- tests/planning.test.ts`;
  - `npm test --workspace @worktrail/api -- tests/status-reports.test.ts`;
  - `npm test --workspace @worktrail/api`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`.

## Phase 8: Status Report Snapshot Validation

Goal: add explicit runtime validation/versioning for persisted status report snapshots.

Scope:

- Add `apps/api/src/validation/project-status-report-snapshot.ts`.
- Parse stored report snapshots before:
  - returning report detail;
  - rendering Markdown export;
  - any other stored-snapshot read path.
- Preserve the current snapshot shape as version `1`.
- Ensure publish behavior writes a valid versioned snapshot.
- Return a controlled application error for invalid stored payloads.
- Add tests for:
  - seeded/published report snapshot acceptance;
  - invalid snapshot rejection;
  - Markdown export using parsed snapshot data.

Out of scope:

- New report fields beyond version metadata if needed.
- Snapshot migrations.
- Report editing/deleting.

Acceptance criteria:

- Persisted report snapshots have an explicit parser.
- Existing seeded and newly published reports remain readable.
- Invalid stored JSON fails predictably.
- Markdown export and detail rendering continue to use immutable stored snapshot data.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/*status-report*.test.ts
npm test --workspace @worktrail/api -- tests/status-report-markdown-renderer.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-09.
- Added `apps/api/src/validation/project-status-report-snapshot.ts` as the explicit versioned parser for status report snapshot payloads.
- Reused the snapshot schema from the status report endpoint request validator to avoid a second divergent snapshot schema.
- Updated `ProjectStatusReportService` to parse stored snapshots before:
  - listing report summaries;
  - returning report detail;
  - rendering Markdown export.
- Updated publish flow so both generated snapshots and client-supplied draft snapshots pass through the version `1` parser before persistence.
- Invalid persisted snapshots now fail with a controlled `CONFLICT` response instead of an unhandled runtime error.
- Added route-level tests for invalid stored snapshots across list, detail, and Markdown export paths, plus invalid request snapshot rejection.
- Verified:
  - `npm test --workspace @worktrail/api -- tests/status-reports.test.ts`;
  - `npm test --workspace @worktrail/api -- tests/status-report-markdown-renderer.test.ts`;
  - `npm test --workspace @worktrail/api`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`.

## Phase 9: Planning, Reports, And Work Item Detail Framing

Goal: clarify live-versus-published workflows and improve Work Item Detail scanability.

Scope:

- Add consistent framing labels:
  - Planning: `Live view`;
  - Milestone Review: `Live view`;
  - Reports list/detail: `Published snapshots`;
  - Report draft: `Draft report`.
- Add a Planning-to-Reports bridge:
  - link to Reports;
  - link to create a draft when allowed;
  - copy that explains current state versus published snapshot.
- Clarify report draft areas:
  - generated evidence;
  - editable narrative.
- Group report detail share/export actions:
  - copy Markdown;
  - download Markdown;
  - print.
- Reorganize Work Item Detail section hierarchy:
  - Summary;
  - Act;
  - Collaborate;
  - Dependencies;
  - History.
- Move watcher affordances closer to collaboration/header context as practical.
- Make blocking/blocked-by state more prominent.
- Add or update tests for affected pages.

Out of scope:

- Full edit-on-demand detail redesign.
- New report delivery/sharing channels.
- New dependency model.

Acceptance criteria:

- Users can distinguish live planning/review from published reports from page copy alone.
- Report sharing actions are grouped.
- Work Item Detail exposes current state, likely action, collaboration state, dependency state, and history more clearly.
- Existing update, comment, watcher, relationship, activity, print, copy, and download behavior remains intact.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include '**/project-planning*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include '**/project-milestone-review*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include '**/project-status-report*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include '**/work-item-detail*.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-09.
- Added live/published/draft framing labels across:
  - Planning;
  - Milestone Review;
  - Reports list/detail;
  - Report draft.
- Added a Planning-to-Reports bridge with links to published reports and draft creation when the actor can create reports.
- Clarified report draft layout by labeling editable narrative separately from generated evidence.
- Strengthened report detail sharing/export grouping while preserving copy Markdown, download Markdown, and print behavior.
- Reorganized Work Item Detail into clearer sections:
  - Summary;
  - Act;
  - Collaborate;
  - Dependencies;
  - History.
- Moved watcher controls into the collaboration area beside comments.
- Added a dependency alert when a work item is blocked by open work or blocking downstream open work.
- Updated focused component specs to cover the new framing labels and section hierarchy.
- Verified:
  - `npm test --workspace @worktrail/web -- --watch=false --include '**/project-planning*.spec.ts'`;
  - `npm test --workspace @worktrail/web -- --watch=false --include '**/project-milestone-review*.spec.ts'`;
  - `npm test --workspace @worktrail/web -- --watch=false --include '**/project-status-report*.spec.ts'`;
  - `npm test --workspace @worktrail/web -- --watch=false --include '**/work-item-detail*.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 10: Public Site Consolidation

Goal: update the static site to present Worktrail as a coherent v0.2.0 product/reference baseline.

Scope:

- Update `site/index.html`.
- Remove sprint-by-sprint chronology from the main narrative.
- Tighten hero copy around:
  - one product sentence;
  - one developer-reference sentence.
- Reframe the signal band around users, builders, and operators.
- Consolidate product sections into workflow pillars:
  - start the day;
  - find and shape work;
  - operate projects;
  - share status.
- Add or update `v0.2.0 baseline` section.
- Group architecture into:
  - frontend;
  - API boundary;
  - domain;
  - persistence;
  - operations.
- Convert scope caveats into concise non-goal cards.
- Update footer links to:
  - README;
  - v0.2.0 PRD;
  - v0.2.0 technical design;
  - v0.2.0 audits;
  - OpenAPI;
  - relevant run/reference docs.
- Refresh screenshot only if an up-to-date asset is easy to produce after UI cleanup.

Out of scope:

- Marketing-style SaaS landing page.
- New Pages deployment workflow.
- Screenshot work that blocks the release.

Acceptance criteria:

- Site copy describes the current product, not release chronology.
- Architecture reads as layers.
- Scope remains candid and scannable.
- v0.2.0 docs and audits are reachable.

Suggested commands:

```sh
npm run build
git diff --check
```

Status:

- Not started.

## Phase 11: Documentation, Release Notes, And Pattern Notes

Goal: update the release documentation surface to match implemented v0.2.0 behavior.

Scope:

- Add `docs/v0.2.0/release-notes.md`.
- Add `docs/v0.2.0/pattern-notes.md` using destination-neutral language.
- Update README for the v0.2.0 baseline:
  - capabilities;
  - local setup if changed;
  - verification commands;
  - docs links.
- Update OpenAPI only if routes/contracts changed.
- Update any runbook/reference docs affected by implementation.
- Add final implementation-plan status notes for each completed phase.

Out of scope:

- Historical release archive reshaping unless links break.
- New deployment automation.

Acceptance criteria:

- README, public site, release notes, and pattern notes align with implemented behavior.
- OpenAPI remains accurate.
- Implementation plan records phase completion and verification notes.

Suggested commands:

```sh
rg -n "v0\\.1\\.9|Status|status reports|jawstack|jaws" README.md docs site packages apps --glob '!node_modules/**'
npm run typecheck
git diff --check
```

Status:

- Not started.

## Phase 12: Final Verification

Goal: verify the v0.2.0 release candidate end to end.

Scope:

- Run full local verification:
  - lint;
  - typecheck;
  - tests;
  - build.
- Run Playwright/E2E if available and local Postgres state can be prepared.
- Confirm generated OpenAPI or docs artifacts are current.
- Confirm package version metadata is consistent.
- Confirm no stray dev server or test process remains running.
- Review `git status --short --branch`.
- Record final verification results in this implementation plan.

Out of scope:

- New feature work.
- Opportunistic refactors.

Acceptance criteria:

- Full verification passes, or any failure is documented with cause and follow-up.
- Worktree state is understood.
- v0.2.0 docs are complete.
- The release is ready for user QA/UAT or PR creation.

Suggested commands:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run e2e
git status --short --branch
git diff --check
```

Status:

- Not started.

## Verification Policy

Use focused verification during phases and full verification at the end.

Minimum expected checks:

- frontend-only change:
  - relevant web tests;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`.
- backend-only change:
  - relevant API tests;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`.
- contract or package metadata change:
  - `npm run typecheck`;
  - relevant package tests;
  - lockfile sanity.
- docs/site-only change:
  - `git diff --check`;
  - build when site or Angular assets may be affected.

Full release verification should run in Phase 12.

## Deferred Work

These items are intentionally not required for v0.2.0:

- `/projects/:projectId/reports` route aliases and redirects.
- Full edit-on-demand Work Item Detail redesign.
- Full `WorkItemService` decomposition.
- Transaction context abstraction.
- Seed data split if seed files are not otherwise touched.
- Public site screenshot refresh if existing visual remains acceptable.
- Production authentication, hosting, invitations, roles, and deployment automation.

## Bottom Line

v0.2.0 should be implemented as a consolidation pass, not a feature grab bag.

The work should leave Worktrail cleaner to use, safer to extend, and easier to present publicly, while preserving the stable local-first architecture that has carried the project through v0.1.x.
