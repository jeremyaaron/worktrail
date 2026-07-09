# Worktrail v0.2.0 Technical Debt Audit

## Summary

Worktrail's architecture has improved since the v0.1.0 technical audit. Several earlier pressure points were addressed: contracts are split by domain, Express route registration is modularized, work item query SQL is centralized, delivery risk constants exist in a domain module, and the frontend has reusable list, filter, saved-view, pinned-view, and summary components.

The current technical debt is not architectural collapse. It is consolidation debt. The codebase has enough patterns now, but newer features still tend to accrete orchestration in route components and aggregate services. v0.2.0 should focus on extracting shared state and domain helpers before the next feature slate multiplies the same patterns.

Recommended v0.2.0 technical theme:

> Keep the architecture, but move repeated workflow orchestration out of route components and aggregate services.

## Audit Basis

This audit reviewed:

- The previous v0.1.0 technical audit in `docs/v0.1.0/tech-debt-audit.md`.
- API source under `apps/api/src`.
- Angular source under `apps/web/src/app`.
- Contract package source under `packages/contracts/src`.
- DB schema and migrations under `apps/api/src/db` and `apps/api/drizzle`.
- Test files and repository scripts.

Verification run during this audit:

- `npm run typecheck` passed.
- `npm run lint` passed.
- API tests passed: 22 files, 244 tests.
- Contract tests passed: 5 files, 14 tests.
- Web tests had 237 passing tests and 1 failing test in `MyWorkPageComponent`.

No product code was modified. This document is the only intended repository change from this audit.

## What Improved Since v0.1.0

Several earlier recommendations were acted on.

- `packages/contracts/src/index.ts` is now a barrel export instead of one large contract file.
- Contract tests now cover query, bulk update, milestone review, notifications, and status reports.
- Express route registration has been split into focused route modules under `apps/api/src/adapters/express/routes`.
- Work item query construction has a dedicated `work-item-query-builder.ts`.
- Work risk policy constants and predicates are centralized in `apps/api/src/domain/work-risk-policy.ts`.
- The frontend has reusable components for active filter chips, filter panels, saved views, pinned views, result lists, daily queues, activity timelines, and detail summaries.
- Status report Markdown rendering is isolated in `status-report-markdown-renderer.ts`.

Those improvements changed the shape of the remaining debt. The codebase is less monolithic at the package and route level, but several page and service seams have now reached their second scaling limit.

## Highest-Impact Findings

### 1. Frontend Route Components Are Still The Largest Scaling Limit

The biggest files in the application are still Angular route components that combine data loading, form state, URL synchronization, mutation handling, template markup, and page styles.

Largest non-test source files:

- `apps/web/src/app/features/work-items/work-item-list-page.component.ts`: 2,035 lines.
- `apps/web/src/app/features/work-items/work-item-detail-page.component.ts`: 1,939 lines.
- `apps/web/src/app/features/projects/project-planning-page.component.ts`: 1,837 lines.
- `apps/web/src/app/features/work-items/workspace-work-item-list-page.component.ts`: 1,576 lines.
- `apps/web/src/app/features/projects/project-settings-page.component.ts`: 1,046 lines.

This is the clearest refactoring opportunity. The issue is not just line count. The issue is mixed ownership. These files are page containers, state stores, form adapters, mutation coordinators, and presentational components at once.

Recommendation:

- Move page state and effects into feature-local stores/facades.
- Keep route components responsible for route params, composition, and page-level loading/error boundaries.
- Keep presentational components responsible for rendering and user events only.
- Extract styles and templates only when it follows an ownership split; do not do a mechanical line-count split.

Suggested first targets:

- `ProjectWorkPageStore` for project Work filters, saved views, selection, bulk triage, export, and copy-link state.
- `WorkspaceWorkPageStore` or a shared `WorkListPageStore` for cross-project list behavior.
- `WorkItemDetailStore` for detail load, details update, status transition, relationships, comments, watchers, and activity refresh.
- `ProjectPlanningStore` for project/milestone/planning-summary loading and view switching.

Acceptance target:

- New feature work on a route should touch one focused store and one focused component, not a 1,500+ line route component.

### 2. Work List Orchestration Is Duplicated Above Shared Components

The project Work and workspace Work Items pages share useful UI components and query serialization helpers, but each page still owns a parallel copy of the orchestration around those components.

Duplicated concerns include:

- filter constants and default form values;
- route query param subscriptions;
- debounce and immediate-apply behavior;
- copy-link status;
- CSV export status;
- saved-view load/error/mutation state;
- saved-view draft names;
- save, rename, update query, pin/unpin, delete flows;
- saved-view sorting and replacement;
- active query derivation.

Project Work adds bulk triage on top of that, which makes it even harder to safely evolve.

Recommendation:

- Extract a shared saved-view controller/store for load, draft names, permissions, mutations, sorting, and replacement.
- Extract a shared work-list query controller for route params, form state, active query, copy-link, and export.
- Keep project/workspace differences as configuration:
  - scope;
  - route path;
  - allowed fields;
  - shared-view permission rule;
  - export method;
  - option loaders.
- Keep bulk triage as a project-only controller layered on top of the project work-list store.

Why this matters:

- The next filter, saved-view feature, export behavior, or mobile filter change currently needs two careful implementations.
- UX consolidation from the v0.2.0 UX audit will otherwise require editing both large pages in parallel.

Suggested v0.2.0 acceptance check:

- A saved-view behavior change can be implemented once and verified through project and workspace page tests.

### 3. `WorkItemService` Is Too Broad For The Next Feature Cycle

`apps/api/src/services/work-item-service.ts` is 1,370 lines and still carries too many responsibilities:

- project and workspace listing;
- detail hydration;
- create/update/status transition/board move;
- bulk update;
- label, assignee, reporter, milestone validation;
- board position calculations;
- DTO assembly;
- activity event recording;
- notification side effects;
- transaction wrapper logic.

The service has remained coherent enough because the domain is still small, but it has become the central write-path choke point. Every new work item feature risks touching command logic, query logic, DTO assembly, and side effects in the same file.

Recommendation:

- Split command and query paths:
  - `WorkItemQueryService`: project list, workspace list, detail hydration.
  - `WorkItemCommandService`: create, update, transition, board move.
  - `WorkItemBulkUpdateService`: project batch updates and partial-success result mapping.
  - `WorkItemDtoAssembler`: list/detail/workspace DTO hydration.
  - `BoardPositionService`: top insertion, move, and compaction.
  - `WorkItemActivityRecorder`: activity events for field changes.
- Keep the current `WorkItemService` temporarily as a facade if that reduces endpoint churn.

Why this matters:

- It will make mutation side effects easier to reason about.
- It will make future workflows such as subscriptions, approvals, or richer dependency events safer to add.
- It will reduce large test fixture pressure in `apps/api/tests/work-items.test.ts`, currently 2,781 lines.

Suggested v0.2.0 acceptance check:

- Adding a new field to work item update should not require reading bulk update, board movement, list DTO assembly, and notification code in one file.

### 4. Planning, Milestone Review, And Status Reports Duplicate Risk Section Assembly

The risk policy constants are centralized, but the higher-level risk section assembly is duplicated across:

- `PlanningService`;
- `MilestoneReviewService`;
- `ProjectStatusReportService`;
- `DeliveryHealthService`;
- frontend planning and report rendering.

Repeated concepts include:

- `createEvaluationContext`;
- priority ranking;
- due-date and priority sort functions;
- `toRiskItems`;
- risk section metadata;
- fixed risk section ordering;
- query construction for blocked, dependency-blocked, overdue, due soon, unassigned, stale, and blocking-open-work.

Recommendation:

- Create a backend `delivery-risk-sections.ts` or `work-risk-sections.ts` module.
- Encode each risk section once:
  - type;
  - title;
  - description;
  - query builder;
  - predicate;
  - sort;
  - preview limit handling.
- Allow a project-wide or milestone-scoped input to add `milestoneId` to generated queries.
- Extract `PlanningRiskItemDto` assembly into a shared DTO helper.
- Keep report snapshot-specific shaping in `ProjectStatusReportService`, but feed it from the shared risk section builder.

Why this matters:

- The same risk category should behave identically in Planning, Milestone Review, Status Reports, saved view links, and work list filters.
- A new risk type should not require edits across four services and several frontend components.

Suggested v0.2.0 acceptance check:

- Adding a new risk section requires one backend policy definition plus page-specific rendering/tests.

### 5. Runtime Validation And Contract Types Are Still Separate Worlds

The contracts package is now split and tested, which is good. Runtime validation still lives separately in endpoint schemas and service normalization code. This is manageable today, but it is already visible in work item queries and status report snapshots.

Examples:

- `WorkItemQuery` is a TypeScript contract, while API parsing is implemented separately with Zod in `apps/api/src/validation/work-item-query.ts`.
- Frontend query serialization is another separate implementation in `work-item-query-serialization.ts` and `work-item-query-params.ts`.
- Status report snapshots are stored in JSONB as `ProjectStatusReportSnapshotDto`, but runtime validation only checks `snapshotVersion`, project identity, `generatedAt`, and cross-project risk queries.
- Saved view queries are also JSONB and rely on normalization at service boundaries.

Recommendation:

- Decide whether contracts remain compile-time only or become schema-backed.
- If compile-time only, add explicit API validation tests for each contract-shaped JSON payload that can be persisted or shared.
- If schema-backed, colocate Zod schemas with contract domains or generate them from one source.
- For status report snapshots, add a versioned parser:
  - parse v1 fully enough to reject malformed stored/imported JSON;
  - return a typed internal snapshot;
  - provide a migration hook for future snapshot versions.
- For saved-view queries, keep accepting tolerant inputs, but centralize normalization and supported-field stripping in one shared API module.

Why this matters:

- JSONB fields are long-lived product data.
- Status reports are immutable, so snapshot compatibility becomes a product promise once reports can survive schema changes.

Suggested v0.2.0 acceptance check:

- Persisted JSON payloads have explicit runtime parsers and tests, not only TypeScript annotations.

### 6. Transaction Wiring Is Repeated Across Services

Many services accept an optional `db?: WorktrailDb`, then implement a local `withWriteRepositories` wrapper around `withRepositoriesTransaction`. The pattern appears in work items, CSV import, projects, members, labels, milestones, comments, relationships, and status reports.

The repetition is small per service, but it leaks infrastructure shape into application services.

Recommendation:

- Introduce a request/application context with:
  - `repositories`;
  - `runInTransaction(callback)`;
  - actor;
  - clock;
  - id generator where needed.
- Let tests provide a no-op `runInTransaction` when real DB transactions are not required.
- Keep repository factories and Drizzle details out of domain services.

Why this matters:

- Multi-entity writes are increasing.
- A standard transaction runner will make future side effects easier to audit and test.
- It will remove repeated optional-DB branching.

Suggested v0.2.0 acceptance check:

- Services no longer need to know whether `db` exists; they only ask the context to run transactional work.

### 7. The Frontend API Layer Is In A Transitional State

The frontend now has domain clients under `apps/web/src/app/core/api`, but route components still inject `WorktrailApiService`, a 390-line compatibility facade. This was explicitly acceptable as temporary migration scaffolding in the v0.1.0 technical design. It is now the default dependency for nearly every feature page.

Recommendation:

- Decide whether `WorktrailApiService` is permanent or transitional.
- If permanent, rename it to reflect that role, keep it intentionally organized by domain, and consider splitting its type imports.
- If transitional, migrate route stores/components to inject domain clients directly.
- Avoid adding more methods to the facade without a placement rule.

Why this matters:

- The domain clients are clearer than the all-in-one facade.
- Keeping both layers without a policy creates two possible places for every API concern.

Suggested v0.2.0 acceptance check:

- New frontend features have a clear rule: inject the domain API client or a feature store, not the global compatibility facade by default.

### 8. Tests Are Broad, But Some Are Coupled To Large Components And Ordering Details

Coverage is meaningful and generally healthy. The verification run surfaced one failing web test:

- `MyWorkPageComponent renders a deduped attention queue and secondary reported work`
- Expected queue order placed the dependency-blocked item before the due-soon item.
- Actual queue order placed the due-soon item before the dependency-blocked item.

The component sorts by severity, due date, priority, and updated time. The test is asserting a specific rendered route order from a large component fixture, which makes it sensitive to queue ranking changes.

Other test size signals mirror source size:

- `apps/api/tests/work-items.test.ts`: 2,781 lines.
- `apps/web/src/app/features/work-items/work-items-page.component.spec.ts`: 1,962 lines.
- `apps/api/tests/saved-work-views.test.ts`: 1,573 lines.
- `apps/web/src/app/features/work-items/work-item-detail-page.component.spec.ts`: 1,152 lines.

Recommendation:

- Extract My Work queue ranking into a pure function or small service with focused unit tests.
- Use deterministic clocks in frontend queue tests instead of `new Date()` inside component logic.
- Test route components for composition and wiring, not all ranking/business rules.
- Split large API integration tests by capability when the service extraction happens.
- Prefer behavior-level assertions over incidental DOM ordering when ordering is not the behavior under test.

Why this matters:

- Tests should protect intended behavior, not freeze implementation details.
- Large component specs become slow to update and hard for agents to reason about.

Suggested v0.2.0 acceptance check:

- The full `npm test` suite is green, and queue ranking rules are tested in a focused unit.

### 9. Seed Data Is Now A Product Fixture System In One File

`apps/api/src/db/seed.ts` is 1,569 lines. It now defines members, projects, labels, milestones, work items, relationships, watchers, notifications, comments, activity, saved views, and status reports.

This is valuable because the demo surface is rich. The debt is that one file owns all fixture identity, setup order, and scenario design.

Recommendation:

- Split seed data by domain:
  - members/workspace;
  - projects;
  - labels/milestones;
  - work items;
  - relationships/watchers/comments;
  - saved views;
  - status reports.
- Keep stable IDs in one `seed-ids.ts`.
- Add comments that describe the product scenario each fixture supports.
- Consider reusable fixture builders for tests and seed data where they overlap.

Why this matters:

- Demo data is now part of the product experience.
- New features will need seeded examples; adding them to one giant file increases accidental breakage risk.

Suggested v0.2.0 acceptance check:

- A new feature can add seed examples without editing unrelated seed sections.

### 10. Release Metadata Has Drifted From Product Tags

The repository and workspace packages still report version `0.1.0` while the product documentation and tags are at v0.1.9 and planning for v0.2.0.

This may be intentional because Worktrail's sprint tags are the release signal and package publishing is not in scope. However, it is now ambiguous.

Recommendation:

- Choose one policy:
  - update root/workspace package versions to the product baseline at v0.2.0; or
  - document that package versions are static internal metadata and tags/docs carry product release identity.
- If versions are updated, include root, `@worktrail/api`, `@worktrail/web`, and `@worktrail/contracts`.

Why this matters:

- Build logs, dependency metadata, generated artifacts, and future automation will otherwise report a misleading version.

Suggested v0.2.0 acceptance check:

- A developer can tell from repository metadata or docs what version number is authoritative.

## Backend Refactoring Opportunities

### Work Item Command Side Effects

Work item create/update/transition/bulk flows record activity and notifications inline. That is understandable, but side effects are now central enough to deserve a small domain boundary.

Recommendation:

- Extract activity recording into `WorkItemActivityRecorder`.
- Extract notification calls behind a `WorkItemNotificationPublisher` or keep `NotificationService` but call it from command helpers.
- Return command outcome objects that describe changed fields, then let side-effect helpers publish from those outcomes.

This will make watcher and notification changes safer.

### DTO Assembly

DTO assembly has improved in places, but list/detail hydration still lives inside `WorkItemService`. There are also repeated `PlanningRiskItemDto` assemblers in planning, milestone review, and status reports.

Recommendation:

- Create DTO assemblers for:
  - work item list/detail;
  - planning risk item;
  - report snapshot sections.
- Keep assemblers pure where possible and pass preloaded lookup maps.

This reduces service size and makes query batching easier later.

### Delivery Health Facade

`DeliveryHealthService` is appropriately domain-heavy and well tested, but it is still a large pure service. It is also now consumed by project summaries, planning, milestone review, and status report snapshots.

Recommendation:

- Keep `DeliveryHealthService.derive` as the public facade.
- Internally split milestone progress, project health, planning review, reason creation, and risk contexts.
- Reuse the same evaluation context and risk predicates from the recommended risk-section module.

This is not as urgent as route component extraction, but it will pay off before adding forecasting or custom health rules.

## Frontend Refactoring Opportunities

### Feature Stores Before More Components

The frontend already has useful presentational components. The next extraction should be stateful feature stores, not more template-only components.

Recommended stores:

- `SavedViewsStore`: load, draft names, mutation errors, pinning, replacement.
- `WorkItemQueryStore`: URL params, form value conversion, active query, chips.
- `ProjectBulkTriageStore`: selection, action form, result envelope, failed rows.
- `MyWorkQueueStore`: queue reasons, sorting, summary filtering, secondary dedupe.
- `WorkItemDetailStore`: detail state, side panels, comments, relationships, watchers.

### API Error Handling

`extractApiErrorMessage` exists, but many components still set local fallback strings and manage mutation errors independently.

Recommendation:

- Standardize a small mutation state helper:
  - idle/loading/success/error;
  - fallback message;
  - reset behavior.
- Use it in saved views, bulk triage, comments, relationships, status reports, and settings.

### CSS And Template Ownership

Large route components carry large inline templates and styles. Moving state out first will make it easier to decide where template/style splits belong.

Recommendation:

- Prefer extracting cohesive child components with their own templates/styles.
- Avoid moving styles to global CSS unless the styles are genuinely shared tokens or utilities.
- Keep feature-local styling close to feature-local components.

## Testing And Verification

Current verification result:

- Typecheck: passed.
- Lint: passed.
- API tests: passed.
- Contracts tests: passed.
- Web tests: failed 1 of 238.

The failing web test should be fixed before v0.2.0 cleanup begins or made the first task in that cleanup. It is small, but it matters because audits should leave the baseline with a trusted green suite.

Recommended test priorities:

- Fix or clarify My Work queue ordering.
- Extract queue ranking tests into pure units.
- Add tests for shared saved-view/store behavior as it is extracted.
- Add versioned runtime parser tests for status report snapshots.
- Add regression tests around project/workspace work-list query parity after store extraction.

## Recommended v0.2.0 Work Plan

### Must Do

- Fix the failing My Work web test or the underlying queue ordering ambiguity.
- Extract shared saved-view/list-query orchestration from project and workspace Work pages.
- Split `WorkItemService` enough to separate command, query, bulk, DTO assembly, and side effects.
- Extract shared risk-section assembly for Planning, Milestone Review, and Status Reports.
- Decide the `WorktrailApiService` facade policy.

### Should Do

- Add versioned runtime parsing for status report snapshots.
- Standardize transaction context instead of repeated optional `db` wrappers.
- Split seed data into domain files with stable ID ownership.
- Extract My Work queue ranking into a focused service/function.
- Align package version metadata or document the release metadata policy.

### Could Do

- Split `DeliveryHealthService` internals while keeping its facade.
- Introduce shared mutation-state helpers for frontend forms/actions.
- Add bundle-size tracking after route component/store extraction.
- Split the largest test files as service/page boundaries are extracted.

## Success Criteria For v0.2.0

The codebase should feel ready for the next nine sprints when:

- The full local verification suite is green.
- Work-list behavior is shared rather than duplicated between workspace and project pages.
- Route components compose stores/components instead of owning all orchestration.
- Work item command/query/DTO/side-effect responsibilities are no longer concentrated in one service.
- Risk sections are defined once and reused by live planning, milestone review, and report snapshots.
- Persisted JSON payloads have explicit validation and versioning policy.
- Release version metadata is either aligned or intentionally documented.

## Bottom Line

Worktrail's foundation is solid. The main risk for v0.2.0 is that existing features are now powerful enough to make every future feature touch large pages and large services. The best cleanup is targeted extraction of repeated orchestration and domain policy, not a rewrite.

Do the cleanup around the workflows that will keep growing: work lists, work item detail, delivery risk, reports, and notifications. That will make v0.2.x feature work faster and less brittle.
