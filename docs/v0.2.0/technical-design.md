# Worktrail v0.2.0 Technical Design

## Summary

Worktrail v0.2.0 consolidates the product and codebase after the v0.1.x feature run.

The release should keep existing capability while making the application feel less like a sequence of added features and more like one coherent operating product. The main implementation work is:

- project navigation and terminology cleanup;
- workspace and project work-list control consolidation;
- explicit project bulk triage mode;
- clearer live planning, milestone review, and published report framing;
- targeted work item detail layout cleanup;
- frontend orchestration extraction for work-list and saved-view behavior;
- backend risk-section consolidation and selective work item service splitting;
- runtime validation/versioning policy for persisted report snapshots;
- release metadata alignment;
- public site consolidation around the v0.2.0 baseline.

No database schema migration is expected. API route compatibility should be preserved. The design favors compatibility facades and focused extraction over broad rewrites.

## Resolved Decisions

### Project Report Navigation Label

Use `Reports` as the project shell navigation label.

Rationale:

- it is short enough for the existing project shell navigation;
- it avoids the overloaded `Status` label;
- it clearly points to published status reports without making the nav item overly narrow.

Keep the existing `/projects/:projectId/status` route path in v0.2.0. The route path is an implementation detail and existing deep links should continue to work. A `/reports` alias can be added later if route language becomes important enough to justify redirect and test churn.

### Release Metadata

Update package metadata to `0.2.0` in this release.

Rationale:

- Worktrail is an app, not a published library, but package metadata is still visible in workspace tooling;
- keeping root and workspace package versions behind the product release creates avoidable ambiguity;
- aligning versions makes tags, docs, package metadata, and release notes tell one story.

The git tag and release notes remain the authoritative release artifact. Package versions should mirror the release tag unless a future release process explicitly changes that policy.

### Work Item Service Splitting

Use targeted extraction behind compatibility facades.

v0.2.0 should not rewrite endpoint handlers around a new service graph. Instead:

- extract reusable risk-section policy and assembly first;
- extract project bulk triage behavior where it directly supports the UX change;
- extract smaller work item helpers only when code is already being touched;
- keep `WorkItemService` as the compatibility facade for existing endpoint handlers.

This gives the release useful ownership boundaries without making service splitting the main project.

### Work Item Detail Scope

Include a light read/act/collaborate/dependencies/history rebalance in v0.2.0, but do not make full edit-on-demand behavior a blocker.

The detail page is large enough that a complete interaction redesign could consume the sprint. v0.2.0 should improve section hierarchy, labels, and dependency/collaboration placement while preserving the existing edit form behavior.

### Public Site Screenshot

Treat the screenshot refresh as optional.

The required public-site work is information architecture and copy. Refreshing imagery is useful after the app cleanup lands, but the site should not block on new screenshot production if the existing asset remains acceptable.

### Frontend API Access Pattern

New frontend orchestration code should inject domain API clients or feature stores, not add new calls to `WorktrailApiService`.

`WorktrailApiService` can remain as a compatibility facade for older code. New stateful feature code should prefer:

- domain API clients under `apps/web/src/app/core/api/`;
- feature-local stores that compose those clients;
- pure query serialization and display helpers for cross-component behavior.

This continues the v0.1.0 direction without requiring a disruptive migration of every existing call site.

## Current Architecture

Relevant frontend pieces:

- `apps/web/src/app/app.routes.ts`
  - standalone Angular lazy route definitions;
  - project child routes under the project shell.
- `apps/web/src/app/features/projects/project-shell/project-shell.component.ts`
  - persistent project header and section navigation.
- `apps/web/src/app/features/work-items/workspace-work-item-list-page.component.ts`
  - workspace-wide work item discovery page.
- `apps/web/src/app/features/work-items/work-item-list-page.component.ts`
  - project-scoped work item list and bulk triage surface.
- `apps/web/src/app/features/work-items/components/`
  - reusable filter panel, active filter chips, result list, pinned views, and saved views toolbar.
- `apps/web/src/app/features/work-items/query/`
  - query serialization, filter labels, filter options, and filter state.
- `apps/web/src/app/features/projects/project-planning-page.component.ts`
  - project planning page composition.
- `apps/web/src/app/features/projects/planning/planning-review.component.ts`
  - planning review presentation.
- `apps/web/src/app/features/projects/project-milestone-review-page.component.ts`
  - milestone review page.
- `apps/web/src/app/features/projects/status-reports/`
  - report list, draft, and detail pages.
- `apps/web/src/app/features/work-items/work-item-detail-page.component.ts`
  - work item detail, update, comments, watchers, relationships, and activity.
- `apps/web/src/app/core/api/`
  - domain API clients over the shared request utility.

Relevant backend pieces:

- `apps/api/src/endpoints/`
  - transport-neutral endpoint handlers.
- `apps/api/src/adapters/express/routes/`
  - Express route registration.
- `apps/api/src/services/work-item-service.ts`
  - broad work item query, command, DTO, board, bulk, and side-effect behavior.
- `apps/api/src/services/planning-service.ts`
  - planning review data assembly.
- `apps/api/src/services/milestone-review-service.ts`
  - milestone-scoped review data assembly.
- `apps/api/src/services/project-status-report-service.ts`
  - draft, publish, detail, and report snapshot assembly.
- `apps/api/src/domain/work-risk-policy.ts`
  - existing work risk policy concepts.
- `apps/api/src/validation/work-item-query.ts`
  - normalized work item query parsing.
- `apps/api/src/db/seed.ts`
  - deterministic demo seed data.
- `packages/contracts/src/`
  - shared DTO and request contracts.

Relevant public-site pieces:

- `site/index.html`
  - static product/reference site.
- `.github/workflows/pages.yml`
  - GitHub Pages deployment.

## Route And Navigation Design

### Project Shell Navigation

The project shell remains the single owner of project section navigation.

Update nav labels:

- `Overview`
- `Work`
- `Board`
- `Planning`
- `Reports`
- `Settings`

Existing route data can continue to use the current section keys where practical. The visible user-facing label should be updated from `Status` to `Reports`.

Project child pages should not render duplicate page-local project navigation. Page headers should only contain:

- the page title and short description;
- commands unique to that page;
- contextual links that move the user into a specific workflow, not a duplicate section menu.

### Route Compatibility

Keep existing route paths:

- `/projects/:projectId/status`
- `/projects/:projectId/status/new`
- `/projects/:projectId/status/:reportId`
- `/projects/:projectId/status/:reportId/markdown`

Do not add `/reports` aliases in v0.2.0 unless implementation reveals a low-cost path that does not complicate tests or OpenAPI docs. Labels and headings carry the product language change for this release.

## Frontend Design

### Work List State Ownership

Introduce feature-local state helpers under:

```text
apps/web/src/app/features/work-items/state/
```

The goal is not to create a generic framework. The goal is to move repeated orchestration out of route components when the behavior is already duplicated between workspace and project work lists.

Recommended files:

```text
work-list-query.store.ts
saved-views.store.ts
project-bulk-triage.store.ts
work-list-page-config.ts
```

Use Angular `signal`, `computed`, and `effect` where they simplify local state. Continue to use RxJS at API boundaries where Angular HTTP naturally returns observables.

#### WorkListQueryStore

Responsibilities:

- read query parameters into normalized work item filter state;
- expose active query, active chips, and pending filter form state;
- update the router with canonical query params;
- reset filters;
- build copy-link targets;
- expose export state and result messages.

Non-responsibilities:

- rendering the filter panel;
- deciding permissions;
- loading saved views;
- loading table/card result rows.

The store should use existing pure helpers in `features/work-items/query/` and `shared/work-items/work-item-query-params.ts` rather than replacing them.

#### SavedViewsStore

Responsibilities:

- load saved views for a scope;
- derive pinned shortcuts and manageable saved views;
- create saved views from the current query;
- update saved-view query;
- rename saved views;
- pin/unpin saved views;
- delete saved views;
- expose loading, saving, and error state.

Inputs:

- scope type: `workspace` or `project`;
- project id when project-scoped;
- current user and project permission state;
- current normalized query.

Non-responsibilities:

- deciding work item result rendering;
- mutating work items;
- serializing arbitrary route state outside the supported work item query fields.

The existing `saved-views-toolbar` and `pinned-saved-views` components can be adapted rather than deleted. The default page state should show pinned shortcuts and compact saved-view actions, with management behind a `Manage views` control.

#### ProjectBulkTriageStore

Responsibilities:

- enter and exit bulk mode;
- track selected work item ids;
- expose selected visible rows;
- apply a bulk update request;
- preserve partial-success details;
- reset selection after successful or abandoned operations.

Inputs:

- project id;
- current visible work item rows;
- current actor/project mutability state;
- project-scoped work item API client.

Bulk mode should not alter the active work-list query. Exiting bulk mode leaves filters, sort, pagination, and saved-view context intact.

### Work List Page Layout

Workspace and project work lists should share the same page rhythm:

1. Header
   - eyebrow/title/description;
   - primary actions.
2. View zone
   - pinned shortcuts;
   - saved-view picker or compact saved-view actions.
3. Filter zone
   - compact filter entry point;
   - active chips always visible when filters are applied.
4. Action zone
   - copy link;
   - export CSV;
   - import/create when applicable;
   - project bulk edit entry point when applicable.
5. Results
   - table on desktop;
   - cards on mobile;
   - empty state.

Saved-view creation and management forms should not appear by default. They can render inline behind `Save view` and `Manage views` controls. A modal is not required for v0.2.0 unless implementation shows the inline panel still dominates the page.

### Project Bulk Mode UI

When not in bulk mode:

- no selection checkboxes in the result list;
- show a single project-level `Bulk edit` or `Triage` action when the actor can mutate the project;
- keep the normal result list optimized for scanning.

When in bulk mode:

- show selection checkboxes;
- show selected count;
- show a compact action selector;
- show apply/cancel controls;
- show partial-success summary after apply;
- keep `Exit bulk edit` visible.

Archived projects and read-only actors should not see the entry point.

### Planning, Milestone Review, And Reports Framing

Apply consistent framing:

- Planning: `Live view`
- Milestone Review: `Live view`
- Reports list/detail: `Published snapshots`
- Report draft: `Draft report`

Planning should include a compact bridge to reports:

- if reports exist, link to `Reports`;
- if the user can publish reports, link to create a draft;
- copy should make clear that reports preserve a snapshot while planning reflects current state.

Report draft should distinguish:

- generated evidence from current project data;
- editable narrative fields that become part of the published report.

Report detail should group sharing controls:

- copy Markdown;
- download Markdown;
- print.

### Work Item Detail Layout

Keep existing behavior but improve page hierarchy.

Recommended section model:

- Summary
  - title, key, type, status, priority, labels, project, milestone, owner, estimate.
- Act
  - editable planning/status fields and save behavior.
- Collaborate
  - watchers, comments, mentions.
- Dependencies
  - blocking and blocked-by relationships with stronger state labels.
- History
  - activity timeline.

Do not introduce a tab system unless the current markup becomes harder to scan after section cleanup. Accordions may be used only for secondary sections on mobile if they reduce vertical stacking without hiding primary state.

### Mobile Layout

The primary mobile issue is control stacking before content.

Use CSS and component composition to:

- keep page title and primary action visible before secondary controls;
- collapse filter controls while keeping active chips visible;
- keep pinned shortcuts accessible without showing management forms;
- avoid repeating project navigation below the shell;
- keep bulk mode controls compact and sticky only if the sticky area does not cover result rows.

## Backend Design

### Risk Section Consolidation

Add a shared risk-section module under:

```text
apps/api/src/services/work-risk-sections.ts
```

The module should define risk section policy once and expose assembly helpers for project-wide and milestone-scoped contexts.

Recommended shape:

```ts
export type WorkRiskSectionScope = 'project' | 'milestone';

export interface WorkRiskSectionDefinition {
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly previewLimit: number;
  matches(workItem: WorkRiskSectionWorkItem): boolean;
  compare?(left: WorkRiskSectionWorkItem, right: WorkRiskSectionWorkItem): number;
}

export interface WorkRiskSectionResult {
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly items: PlanningRiskItemDto[];
}
```

Actual types should use existing contract names rather than widening DTOs unnecessarily.

The shared module should serve:

- `PlanningService`;
- `MilestoneReviewService`;
- `ProjectStatusReportService`.

Expected risk categories should remain compatible with existing reports and UI rendering. If existing categories differ between project-wide and milestone-scoped surfaces, the definition layer can expose scope-specific filtering while keeping shared metadata and item assembly.

### Work Item Service Facade

Keep `WorkItemService` as the endpoint-facing facade.

Add focused helpers only where they reduce touched code:

```text
apps/api/src/services/work-item-bulk-update-service.ts
apps/api/src/services/work-item-dto-assembler.ts
apps/api/src/services/board-position-service.ts
```

Priority:

1. Extract bulk update behavior if project bulk triage changes touch it.
2. Extract DTO assembly helpers if risk-section or detail code needs the same row-to-DTO mapping.
3. Defer board positioning unless current edits touch board ordering.

Endpoint handlers should not need to know which internal service owns each concern in v0.2.0.

### Runtime Snapshot Validation

Add versioned runtime parsing for stored project status report snapshots under:

```text
apps/api/src/validation/project-status-report-snapshot.ts
```

Expected behavior:

- parse stored JSON through a schema before returning report detail or rendering Markdown;
- preserve support for the current snapshot shape as version `1`;
- fail with a controlled application error if stored JSON is invalid;
- keep publish behavior producing the same schema version.

Use the existing validation approach and dependencies. If `zod` is already used for endpoint validation in this area, reuse it. Do not introduce a new validation library.

### Saved View Query Normalization

Continue to normalize work item query state at the API boundary.

As frontend work-list extraction proceeds, ensure the frontend uses one supported-field policy when:

- applying filters;
- saving a view;
- updating a saved view query;
- copying a link;
- exporting CSV.

Backend validation remains authoritative. Frontend normalization exists to avoid surprising users with chips or saved views that cannot round-trip.

### Seed Data

Seed splitting is optional for v0.2.0.

If implementation touches seed data materially, split it into domain files under:

```text
apps/api/src/db/seeds/
```

Suggested files:

```text
workspace-seed.ts
project-seed.ts
label-seed.ts
milestone-seed.ts
work-item-seed.ts
relationship-seed.ts
saved-view-seed.ts
report-seed.ts
```

If seed data is not otherwise touched, document the split as a follow-up rather than spending v0.2.0 effort on mechanical movement.

## Data Model

No schema migration is planned.

Existing tables remain sufficient:

- projects;
- work items;
- labels;
- milestones;
- saved work views;
- comments and mentions;
- watchers;
- relationships;
- notifications;
- activity events;
- project status reports.

Report snapshot validation should be a runtime parser over the existing JSON payload, not a new table or column.

## Contracts And API

No new API route is required.

Potential contract changes:

- status report snapshot types may gain an explicit schema version if not already present;
- existing DTOs may gain display metadata only if the UI cleanup cannot derive it safely;
- saved-view request/response contracts should remain stable unless tests reveal a missing field.

OpenAPI should be updated only if contract shapes or documented labels change. Route paths should remain stable.

## Public Site Design

Update `site/index.html` around the v0.2.0 baseline.

Recommended page structure:

1. Hero
   - one product sentence;
   - one developer-reference sentence;
   - concise primary links.
2. Audience signal band
   - for users;
   - for builders;
   - for operators.
3. Product workflow pillars
   - start the day;
   - find and shape work;
   - operate projects;
   - share status.
4. v0.2.0 baseline
   - current product baseline, not release chronology.
5. Architecture layers
   - frontend;
   - API boundary;
   - domain;
   - persistence;
   - operations.
6. Current scope
   - non-goal cards for authentication/hosting, enterprise administration, and automation/report delivery.
7. Footer
   - README;
   - v0.2.0 PRD;
   - v0.2.0 technical design;
   - audits;
   - OpenAPI;
   - runbook/reference docs.

The site should stay candid and implementation-grounded. It should not become a generic SaaS marketing page.

## Testing Strategy

### Frontend Unit And Component Tests

Add or update tests for:

- project shell navigation label changes;
- absence of duplicate project-local navigation where removed;
- work-list query store behavior;
- saved-view store load/create/update/pin/delete behavior;
- active chips staying visible while pending filter edits wait for apply;
- workspace and project work-list control layout states;
- project bulk mode enter/select/apply/exit behavior;
- read-only and archived-project bulk mode absence;
- planning/report framing labels;
- report detail share/export grouping;
- work item detail section headings and preserved actions.

Prefer focused tests around extracted stores and presentational components over brittle full-page DOM assertions.

### API Tests

Add or update tests for:

- shared risk sections matching current planning/report expectations;
- milestone-scoped risk filtering;
- status report snapshot parser accepting seeded/published reports;
- status report snapshot parser rejecting invalid payloads through a controlled error path;
- bulk update behavior if service extraction changes internals.

Existing endpoint tests should continue to prove route compatibility.

### E2E And Build Verification

Run the existing verification set:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If Playwright coverage exists for affected flows, update and run the relevant smoke tests:

```bash
npm run e2e
```

If `npm run e2e` requires local Postgres state that cannot be prepared in the current environment, document the skipped reason in the implementation plan final verification notes.

## Implementation Notes

### Sequencing Guidance

Implementation should start with compatibility-safe cleanup before deeper extraction:

1. confirm green baseline;
2. update package version metadata;
3. update project shell labels and remove duplicate child navigation;
4. extract work-list/saved-view state used by both workspace and project pages;
5. consolidate work-list controls;
6. implement explicit project bulk mode;
7. extract backend risk sections;
8. add report snapshot parser;
9. update planning/report/detail framing;
10. update public site and docs;
11. run final verification.

This order keeps user-visible changes tied to the extraction that makes them safer.

### Compatibility Rules

- Do not change persisted data shape without a migration.
- Do not remove existing saved-view behavior.
- Do not change route paths for report pages.
- Do not change CSV export semantics.
- Do not change Markdown export semantics.
- Do not weaken read-only or archived-project behavior.
- Do not make broad visual-system changes outside affected surfaces.

## Risks And Mitigations

### Saved View Regression

Risk: consolidating work-list controls could break pinned views, query updates, or permission-specific behavior.

Mitigation:

- extract saved-view orchestration behind tests before changing the page layout;
- keep backend validation authoritative;
- test both workspace and project scopes.

### Over-Extraction

Risk: v0.2.0 could spend too much effort splitting services and stores without enough user-visible improvement.

Mitigation:

- extract only behavior needed by the UX consolidation;
- keep compatibility facades;
- defer mechanical line-count cleanup.

### Route Label And Path Mismatch

Risk: the UI says `Reports` while the path remains `/status`.

Mitigation:

- document the compatibility choice;
- keep titles, headings, and nav labels consistent;
- consider route aliases in a later release if needed.

### Report Snapshot Parser Breakage

Risk: parser strictness could reject existing seeded or user-published reports.

Mitigation:

- test seeded reports;
- parse the current shape as version `1`;
- fail only on truly invalid stored payloads.

### Public Site Over-Correction

Risk: removing release chronology could hide meaningful product capability.

Mitigation:

- organize around current workflows and architecture layers;
- keep docs links available for deeper history.

## Deferred Work

- `/projects/:projectId/reports` route aliases and redirects.
- Full edit-on-demand work item detail redesign.
- Full `WorkItemService` decomposition.
- Transaction context abstraction.
- Seed data split if seed files are not otherwise touched.
- Public site screenshot refresh if existing visual still represents the app adequately.
- Production authentication, hosting, invitations, roles, and deployment automation.

## Open Implementation Questions

These do not block the technical direction:

- During implementation, should `Bulk edit` or `Triage` be the final button label? Default to `Bulk edit` unless page copy shows `Triage` is clearer.
- Should work-list saved-view management use an inline panel or a lightweight dialog? Default to inline panel unless mobile stacking remains poor.
- Should the first work item detail cleanup use accordions on mobile? Default to section headings first; add accordions only if the page remains difficult to scan.

## Bottom Line

v0.2.0 should preserve the architecture that has worked so far while correcting the drift introduced by rapid feature growth.

The technical posture is targeted consolidation: stable routes, no schema churn, shared work-list orchestration, shared risk-section policy, explicit snapshot validation, clearer release metadata, and a public site that describes the product as it exists now.
