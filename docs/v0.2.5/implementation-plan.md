# Worktrail v0.2.5 Implementation Plan

## Purpose

This plan turns the v0.2.5 PRD and technical design into sequential implementation phases.

v0.2.5 should add Work Breakdown. A project work item may contain direct child work, and each child
may have one same-project parent. The model remains intentionally two-level: an item may be a parent or
a child, never both. Every item keeps independent workflow, ownership, planning, estimation,
dependency, collaboration, and history behavior.

The release should preserve:

- existing stories, tasks, bugs, chores, and workflow transitions;
- current project/workspace list, board, My Work, Planning, Review, Portfolio, and report behavior;
- canonical URL, filter, saved-view, pinned-view, copy-link, return-URL, and export semantics;
- independent parent and child status, estimate, assignee, milestone, cycle, due date, labels, and
  priority;
- existing dependency meaning for `blocks` and `relates_to`;
- immutable status report and cycle closeout history;
- active-member and archived-project capability rules;
- transport-neutral endpoint handlers and local PostgreSQL operation;
- deterministic seed and browser test behavior;
- full local verification.

## Design Decisions

Use these decisions while implementing v0.2.5:

- Add nullable `work_items.parent_work_item_id` with a restrictive self-reference.
- Limit hierarchy to two levels.
- Require parent and child to share workspace and project.
- Prevent self-parenting, parent cycles, a child having children, and a parent becoming a child while
  it has children.
- Use transactional, ascending-ID row locks for hierarchy writes.
- Accept optional `parentWorkItemId` during work item creation.
- Use focused idempotent parent mutation:
  - `PUT /api/work-items/:workItemId/parent`;
  - required `{ parentWorkItemId: string | null }` body.
- Add bounded reads:
  - `GET /api/work-items/:workItemId/children?limit=25`;
  - `GET /api/work-items/:workItemId/parent-candidates?search=...`.
- Keep work item DTOs shallow with nullable `parent` and `childSummary`.
- Derive child counts and direct child estimate totals; do not persist rollups.
- Add `hierarchy=top_level|children|parents` and readable `parentKey=KEY-1` query state.
- Make `hierarchy` and `parentKey` mutually exclusive.
- Keep lists and boards flat.
- Do not cascade status, assignee, priority, labels, due date, estimate, milestone, or cycle.
- Do not infer dependency state from containment.
- Add `work_item.parent_changed` activity on the changed child.
- Do not add a hierarchy notification type or parent watcher fan-out.
- Add `parent_key` and `parent_title` to CSV export only.
- Keep old report and closeout snapshots valid; do not backfill or rewrite historical JSONB.
- Extend live planning/review rows with optional parent context in a backward-compatible shape.
- Extract focused Angular hierarchy components before expanding the large detail route.
- Do not add epics, recursive trees, nested boards, bulk reparenting, or automatic rollups.

## Phase Sizing

Each phase should leave the repository in a coherent, compiling state.

Implementation phases:

1. baseline planning;
2. shared contracts and compatibility scaffolding;
3. schema, migration, and hierarchy repository primitives;
4. hierarchy queries, derived summaries, and list enrichment;
5. transactional create/reparent service and activity;
6. endpoints, Express routes, OpenAPI, and Angular API client;
7. canonical frontend query, filters, and saved-view integration;
8. child creation and parent-management UI;
9. detail child section and operating-surface hierarchy context;
10. planning/review compatibility and CSV export;
11. seed data, browser smoke, responsive/accessibility verification;
12. documentation, metadata, and final verification.

Run focused contract tests after Phase 1, fresh/incremental migration and repository tests after Phases
2-3, service and API tests after Phases 4-5, focused Angular tests after Phases 6-9, browser smoke after
Phase 10, and full verification during Phase 11.

## Phase 0: Baseline Planning

Goal: confirm v0.2.5 planning inputs, repository state, and implementation choices before runtime
changes.

Scope:

- Confirm these planning documents exist:
  - `docs/v0.2.5/prd.md`;
  - `docs/v0.2.5/technical-design.md`;
  - `docs/v0.2.5/implementation-plan.md`.
- Confirm active branch, commit baseline, worktree state, and index state.
- Confirm no runtime files have been changed for v0.2.5.
- Confirm the technical design records no blocking choices.
- Confirm v0.2.5 requires one additive migration, expected as `0015_*`.
- Confirm current work item permission behavior:
  - active members may create/edit ordinary work;
  - archived projects block writes;
  - terminal reopen restrictions remain separate.
- Confirm current detail route reload behavior already responds to `:workItemId` changes.
- Confirm no later user request changes sprint scope.

Out of scope:

- Runtime implementation.
- Contract edits.
- Migration generation.
- Tests beyond planning and diff hygiene.

Acceptance criteria:

- All three planning documents exist.
- Repository state is understood before implementation.
- No unresolved technical decision blocks Phase 1.
- The migration and command sequencing preserves a compiling repository.
- Scope remains bounded two-level Work Breakdown.

Suggested commands:

```sh
find docs/v0.2.5 -maxdepth 1 -type f | sort
git status --short --branch
git diff --cached --name-only
git log -1 --oneline --decorate
git diff --check
rg -n "No blocking technical choices|parent_work_item_id|PUT /api/work-items/:workItemId/parent|two-level" docs/v0.2.5/*.md
```

Status:

- Completed on 2026-07-14.
- Confirmed all v0.2.5 planning inputs exist:
  - `docs/v0.2.5/prd.md`;
  - `docs/v0.2.5/technical-design.md`;
  - `docs/v0.2.5/implementation-plan.md`.
- Confirmed active branch is `v0.2.5` at commit `5a38d9c`, the v0.2.4 merge baseline tagged
  `v0.2.4` and matching `main`/`origin/main`.
- Confirmed current change state:
  - `docs/v0.2.5/` is untracked and contains only the three planning documents;
  - the index is clean;
  - there are no tracked runtime, migration, test, package, README, OpenAPI, E2E, or site changes for
    v0.2.5.
- Confirmed migration sequencing:
  - `0014_dapper_hellfire_club.sql` is the current latest migration;
  - v0.2.5 requires one additive migration, expected as `0015_*`;
  - existing work items will remain top-level through a nullable parent column with no backfill.
- Confirmed current capability behavior that hierarchy work must preserve:
  - the local Express actor resolver rejects inactive members;
  - ordinary work item create/update methods do not add an owner/maintainer-only role restriction;
  - archived projects are rejected as read-only by `WorkItemService`;
  - project bulk triage remains owner/maintainer-only;
  - terminal work item reopen rules remain separate from ordinary hierarchy mutation.
- Confirmed `WorkItemDetailPageComponent` subscribes to distinct `:workItemId` parameter changes,
  resets navigation state, and reloads detail, providing the required baseline for parent/child
  same-route navigation.
- Confirmed the technical design resolves all blocking choices, including:
  - two-level same-project containment;
  - nullable self-reference persistence;
  - ascending-ID transactional locks;
  - focused parent command and bounded child/candidate reads;
  - readable `parentKey` query state;
  - independent planning/workflow fields;
  - activity without a new hierarchy notification type;
  - backward-compatible immutable report and closeout behavior.
- Confirmed no later request has changed the v0.2.5 Work Breakdown scope.
- Verified:
  - `find docs/v0.2.5 -maxdepth 1 -type f -print | sort`;
  - `git status --short --branch`;
  - `git diff --cached --name-only`;
  - `git diff --name-only`;
  - `git log -1 --oneline --decorate`;
  - `git branch -vv`;
  - `git diff --check`;
  - focused searches for hierarchy decisions, actor activity, archived-project enforcement, route
    reload behavior, and migration ordering.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Shared Contracts And Compatibility Scaffolding

Goal: define hierarchy contracts and vocabulary while keeping current runtime behavior compiling and
unchanged.

Scope:

- Extend `packages/contracts/src/work-items.ts` with:
  - `WorkItemParentDto`;
  - `WorkItemChildSummaryDto`;
  - `WorkItemChildrenDto`;
  - `WorkItemParentCandidateDto`;
  - `SetWorkItemParentRequest`;
  - `WorkItemHierarchyFilter`.
- Add required nullable fields to `WorkItemListItemDto`:
  - `parent`;
  - `childSummary`.
- Add optional nullable `parent` to `PlanningRiskItemDto` for stored snapshot compatibility.
- Add optional nullable `parentWorkItemId` to `CreateWorkItemRequest`.
- Add `hierarchy` and `parentKey` to `WorkItemQuery`.
- Add `work_item.parent_changed` to:
  - shared `ActivityEventType`;
  - backend domain constants and schema-check vocabulary.
- Update contract exports if a new module is introduced.
- Keep current DTO mappers compiling by initially returning:
  - `parent: null`;
  - `childSummary: null`.
- Update shared test fixtures/builders and literal DTOs affected by required nullable list fields.
- Add focused contract tests for:
  - shallow parent identity;
  - child count equations and estimate fields;
  - required nullable parent command body;
  - child collection envelope;
  - hierarchy query values;
  - optional planning-risk parent compatibility;
  - activity vocabulary.

Out of scope:

- Database schema.
- Runtime parent reads or mutations.
- Query parsing behavior.
- Endpoints and Angular UI.

Acceptance criteria:

- Contracts compile and export all hierarchy types.
- Required work list fields are represented consistently in current fixtures.
- Current APIs still return null hierarchy context.
- No runtime behavior changes before persistence exists.
- Contract, API, and web workspaces remain type-correct.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/contracts
npm test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/api
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/contracts
git diff --check
```

Status:

- Completed on 2026-07-14.
- Added shared Work Breakdown contracts in `packages/contracts/src/work-items.ts`:
  - `WorkItemParentDto`;
  - `WorkItemChildSummaryDto`;
  - `WorkItemChildrenDto`;
  - `WorkItemParentCandidateDto`;
  - `SetWorkItemParentRequest`;
  - `WorkItemHierarchyFilter`.
- Extended shared work contracts with:
  - required nullable `parent` and `childSummary` fields on `WorkItemListItemDto` and inherited detail/
    workspace rows;
  - optional nullable `parentWorkItemId` on `CreateWorkItemRequest`;
  - `hierarchy` and `parentKey` on `WorkItemQuery`;
  - optional nullable `parent` on `PlanningRiskItemDto` so existing stored report snapshot rows may
    continue omitting it.
- Added `work_item.parent_changed` to shared and backend activity event vocabularies.
- Kept current runtime behavior compatible by making the central work item DTO mapper return explicit
  `parent: null` and `childSummary: null` until persistence/read enrichment is implemented.
- Updated the affected contract and Angular DTO fixtures with explicit null hierarchy state.
- Added `packages/contracts/src/work-item-hierarchy.contract.test.ts` covering:
  - shallow parent identity;
  - child count and direct estimate summary fields;
  - bounded child collection and parent candidate shapes;
  - set/clear command and create request parent identity;
  - hierarchy modes and readable exact-parent query state;
  - legacy/new planning-risk parent compatibility;
  - parent-change activity vocabulary.
- Confirmed existing exports already expose `work-items.ts`, so no contracts index change was needed.
- Made no schema, migration, repository, query parser, endpoint, API client, or hierarchy UI changes.
- Verified:
  - `npm run typecheck --workspace @worktrail/contracts`;
  - `npm test --workspace @worktrail/contracts` (8 files, 28 tests passed);
  - `npm test --workspace @worktrail/api` (29 files, 299 tests passed);
  - `npm test --workspace @worktrail/web` (298 tests passed);
  - `npm run typecheck` across API, web, and contracts;
  - `npm run lint` across API, web, and contracts;
  - `git diff --check`.
- No Phase 2 persistence behavior was pulled forward.

## Phase 2: Schema, Migration, And Hierarchy Repository Primitives

Goal: add parent persistence and the transaction-safe repository operations needed to enforce two-level
hierarchy.

Scope:

- Add nullable `parentWorkItemId` to `workItems` in `apps/api/src/db/schema.ts`.
- Use a restrictive self-reference with the Drizzle `AnyPgColumn` self-reference pattern.
- Add:
  - `work_items_no_self_parent_check`;
  - `(project_id, parent_work_item_id)` index.
- Regenerate the activity event check constraint so it accepts `work_item.parent_changed`.
- Generate additive Drizzle migration `0015_*` and metadata.
- Confirm the migration performs no parent backfill.
- Extend `UpdateWorkItemInput` with optional nullable `parentWorkItemId` without exposing it through the
  general update endpoint.
- Add repository primitives:
  - stable `findManyByIdsForUpdate`;
  - `listChildren` with deterministic ordering and limit;
  - `hasChildren`;
  - bounded `listEligibleParentCandidates`;
  - parent lookup required for activity mapping.
- Ensure lock input is unique and sorted before `FOR UPDATE`.
- Add repository/migration tests for:
  - existing rows default to null parent;
  - self-parent check;
  - restrictive foreign key;
  - parent index;
  - child ordering and limit;
  - candidate same-project filtering, child exclusion, terminal ranking, and cap;
  - stable lock order;
  - parent update and clear;
  - updated activity event constraint.
- Verify fresh and incremental migration paths.

Out of scope:

- Same-project and depth service validation.
- Parent/child DTO enrichment.
- Parent endpoint.
- Frontend behavior.

Acceptance criteria:

- Existing work items migrate as top-level work.
- PostgreSQL prevents dangling and self parent references.
- Repository methods provide bounded child/candidate reads and deterministic locks.
- The schema supports but does not yet expose hierarchy behavior.
- Existing repository tests remain green.

Suggested commands:

```sh
npm run db:migrate
npm run db:reset
npm run db:migrate
npm test --workspace @worktrail/api -- tests/repositories.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 3: Hierarchy Queries, Derived Summaries, And List Enrichment

Goal: make hierarchy readable and queryable through existing work list services without adding writes.

Scope:

- Add repository batch reads:
  - parent self-join for returned child IDs;
  - grouped child summaries for returned parent IDs.
- Derive:
  - total;
  - open;
  - done;
  - canceled;
  - estimated;
  - unestimated;
  - summed direct child estimate points.
- Keep hierarchy enrichment to at most two set-based queries per list response.
- Extend `toWorkItemListItemDto` inputs with parent and child summary context.
- Add `WorkItemService.loadHierarchyContext` or equivalent shared batch helper.
- Populate hierarchy fields for:
  - project work lists;
  - workspace work lists;
  - individual work item detail.
- Extend backend query parsing and normalization for:
  - `hierarchy=top_level`;
  - `hierarchy=children`;
  - `hierarchy=parents`;
  - exact `parentKey`.
- Normalize `parentKey` and reject `hierarchy` plus `parentKey`.
- Extend repository query conditions for project and workspace list paths.
- Add service/repository tests for:
  - parent and child summary DTOs;
  - top-level rows without hierarchy noise;
  - all hierarchy query modes;
  - exact parent key;
  - stale key empty result;
  - query composition with project, archived-project, status, cycle, milestone, assignee, dependency,
    search, and sort where representative;
  - no hierarchy N+1 reads;
  - direct estimate and terminal-count semantics.

Out of scope:

- Parent creation or mutation.
- Child/candidate endpoints.
- Frontend query controls.
- Planning risk rows and CSV.

Acceptance criteria:

- Existing work list responses include accurate shallow hierarchy context.
- Hierarchy queries work on project and workspace services.
- Exact-parent filtering uses immutable display keys.
- Derived child summaries are current and not persisted.
- No recursive DTOs or per-row hierarchy reads are introduced.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/work-item-query-builder.test.ts
npm test --workspace @worktrail/api -- tests/work-item-service.test.ts
npm test --workspace @worktrail/api -- tests/work-items.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 4: Transactional Create/Reparent Service And Activity

Goal: implement atomic, concurrency-safe child creation and parent replacement inside the work item
domain.

Scope:

- Extend work item creation to accept `parentWorkItemId`.
- During child creation:
  - lock the proposed parent;
  - require actor-workspace and same-project ownership;
  - require the proposed parent is top-level;
  - allow an existing parent with children;
  - allow open or terminal parent status;
  - preserve ordinary project/reference validation;
  - insert parent identity atomically with the child.
- Extend created activity values/metadata with compact parent identity when present.
- Preserve current reporter/assignee auto-watch and assignment notification behavior.
- Add `WorkItemService.setParent` using one transaction.
- Implement stable lock and revalidation behavior for:
  - set;
  - replace;
  - clear;
  - matching no-op.
- Enforce:
  - no self parent;
  - same workspace/project;
  - proposed parent is top-level;
  - current item has no children before becoming a child;
  - archived project write rejection.
- Record one `work_item.parent_changed` activity event on real changes.
- Store stable old/new parent ID, display key, and title in activity values.
- Do not create hierarchy notifications or mirrored parent activity.
- Add service tests for:
  - valid child create;
  - invalid proposed parent;
  - set/replace/clear/no-op;
  - terminal parent;
  - self/cross-project/cross-workspace/depth rejection;
  - archived project;
  - activity values and absence on no-op;
  - existing assignment notifications;
  - no hierarchy notification fan-out;
  - injected rollback;
  - concurrent inverse assignment;
  - concurrent child creation versus assigning that parent under another item.

Out of scope:

- HTTP handlers.
- Angular API client or forms.
- Bulk reparenting.
- Automatic status/planning changes.

Acceptance criteria:

- All public service writes preserve the two-level invariant under concurrency.
- Child creation and reparenting are atomic.
- Matching commands are idempotent no-ops.
- Activity is complete and notification behavior remains intentionally bounded.
- Failed mutations leave work and activity unchanged.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/work-item-service.test.ts
npm test --workspace @worktrail/api -- tests/notifications.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 5: Endpoints, Express Routes, OpenAPI, And Angular API Client

Goal: expose complete hierarchy behavior through transport-neutral handlers and typed frontend API
methods.

Scope:

- Extend create request validation with optional nullable UUID `parentWorkItemId`.
- Add validation and endpoint handlers for:
  - `PUT /api/work-items/:workItemId/parent`;
  - `GET /api/work-items/:workItemId/children?limit=...`;
  - `GET /api/work-items/:workItemId/parent-candidates?search=...`.
- Implement child collection envelope:
  - default limit 25;
  - maximum 100;
  - `totalCount`;
  - `hasMore`.
- Cap parent candidates at 20 and preserve deterministic sorting.
- Register Express routes before generic work item routes where specificity matters.
- Update exact route inventory tests.
- Add Angular `WorkItemsApi` and facade methods for:
  - list children;
  - list candidates;
  - set/clear parent.
- Ensure project/workspace list and export HTTP query parsers accept hierarchy query fields.
- Update `docs/api/openapi.yaml` with:
  - new schemas;
  - new query parameters;
  - create request parent field;
  - work item response hierarchy fields;
  - new paths and error examples.
- Add endpoint/API-client tests for:
  - success and no-op;
  - malformed IDs/bodies/limits/search;
  - structured 400/404/409 responses;
  - actor-workspace isolation;
  - archived project;
  - child truncation;
  - candidate eligibility;
  - API client HTTP methods, paths, params, and response types.

Out of scope:

- Angular controls and pages.
- Saved-view serialization.
- CSV parent columns.

Acceptance criteria:

- Every hierarchy service behavior has an adapter-neutral endpoint.
- Express registration and OpenAPI match runtime behavior.
- Angular has typed API methods but does not expose unfinished UI.
- Endpoint errors preserve existing application error conventions.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/work-items.test.ts tests/server.test.ts
npm test --workspace @worktrail/web -- --include 'src/app/core/worktrail-api.service.spec.ts'
npm run typecheck --workspace @worktrail/api
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/api
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 6: Canonical Frontend Query, Filters, And Saved-View Integration

Goal: integrate hierarchy with the full applied-query lifecycle before rendering new hierarchy controls
on operating surfaces.

Scope:

- Extend project and workspace filter state with visible `hierarchy` and hidden `parentKey`.
- Extend:
  - form-to-query conversion;
  - query-to-form conversion;
  - route parameter parse/serialize;
  - HTTP parameter serialization;
  - query compaction and defaults;
  - return URLs;
  - copied links;
  - saved-view normalization and validation;
  - filter summaries/counts;
  - active filter labels and clear behavior.
- Add `Work breakdown` filter options:
  - All work;
  - Top-level work;
  - Child work;
  - Parents with children.
- Preserve exact `parentKey` while users edit/apply unrelated filters.
- When a visible hierarchy value is selected, omit/replace exact parent state on Apply.
- Add exact-parent chip `Parent: KEY-1`.
- Ensure draft hierarchy changes do not create active chips or results before Apply.
- Add project and workspace page integration.
- Add tests for:
  - parse/serialize round trips;
  - normalization and malformed state;
  - hidden parent preservation;
  - hierarchy replacement of exact parent;
  - chip labels and clearing;
  - filter counts;
  - saved personal/shared views;
  - pinned views;
  - stale parent key;
  - copy links, return URLs, and export params;
  - project/workspace parity;
  - Apply lifecycle.

Out of scope:

- Parent picker.
- Child creation.
- List and board hierarchy rendering.

Acceptance criteria:

- Hierarchy query state is canonical across every existing work-view pathway.
- Exact-parent drill-down can survive later filter edits.
- Saved and pinned hierarchy views reload the same visible/applied state.
- Filter chips continue representing only applied state.
- Existing query behavior does not regress.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/query/*.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/state/*.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/*work-item-list-page.component.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 7: Child Creation And Parent-Management UI

Goal: let users create child work and safely assign, replace, or clear a parent from work item detail.

Scope:

- Add focused standalone parent components rather than expanding detail-page inline markup:
  - parent context;
  - parent picker/management.
- Show compact linked parent identity near child detail summary.
- Add project-scoped `Add child work item` route link from eligible top-level detail.
- Pass:
  - `parentWorkItemId`;
  - a safe return URL to parent detail.
- Extend the existing create page to:
  - read parent query state;
  - load and validate parent identity;
  - display parent key/title/status;
  - submit `parentWorkItemId`;
  - preserve entered form values on conflict;
  - offer return-to-parent after success.
- Do not silently inherit parent cycle or milestone.
- Implement parent candidate search with:
  - debounce;
  - two-character threshold;
  - exact key support;
  - loading, empty, terminal, error, and stale states;
  - keyboard-operable selection.
- Implement focused Save and Clear commands.
- Disable no-op save.
- Hide or disable mutation for archived projects and structurally ineligible parent items.
- Preserve all existing detail editing, transition, relationship, comment, and watcher behavior.
- Add Angular tests for:
  - route preselection and reload;
  - valid create request;
  - parent load mismatch/error;
  - parent context link;
  - search/debounce/result selection;
  - terminal candidate labels;
  - set/replace/clear/no-op;
  - structured errors without state loss;
  - archived and item-with-children paths;
  - parent-to-child and child-to-parent same-route reload.

Out of scope:

- Child row section.
- Work list/board hierarchy context.
- Drag-to-reparent.

Acceptance criteria:

- Child creation reuses the complete existing work form.
- Parent management is clear, bounded, keyboard operable, and server validated.
- Same-route parent/child navigation never leaves stale detail.
- Archived and structurally invalid actions are not presented as available.
- Detail component organization and style budgets remain healthy.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/work-item-create-page.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/work-item-detail-page.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/*parent*.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 8: Detail Child Section And Operating-Surface Hierarchy Context

Goal: make hierarchy understandable from parent detail, work lists, board, and My Work without replacing
flat operating surfaces.

Scope:

- Add a focused child-work component with:
  - total/open/done/canceled counts;
  - estimated/unestimated counts and direct child estimate total;
  - independent loading/error/empty states;
  - bounded child rows;
  - `Add child work item`;
  - `View all child work` exact-parent query link.
- Load child rows only when detail `childSummary` is non-null.
- Use `WorkItemChildrenDto.totalCount/hasMore` to keep detail bounded.
- Refresh child state after navigation or relevant mutation.
- Extend shared work result list/card rendering:
  - child rows show `Child of KEY-1`;
  - parent rows show compact child count/progress;
  - plain top-level rows show no hierarchy metadata;
  - workspace rows preserve project identity priority.
- Extend board cards:
  - child parent key;
  - compact parent child summary where space permits;
  - stable card dimensions;
  - unchanged drag/status behavior.
- Extend My Work shared rows/cards with parent context.
- Preserve return URLs on parent/detail links where applicable.
- Add Angular tests for:
  - child section counts and rows;
  - truncation/view-all query;
  - loading/empty/error;
  - list project/workspace hierarchy context;
  - top-level no-noise behavior;
  - board rendering and unchanged move payload;
  - My Work context;
  - mobile/long-title template behavior.

Out of scope:

- Nested list or board layout.
- Planning risk DTO integration.
- CSV export columns.

Acceptance criteria:

- A parent detail explains its direct child execution state.
- Exact-parent drill-down opens the correct applied Work result.
- Child identity is recognizable across daily work surfaces.
- Lists and boards remain flat, dense, and operationally readable.
- Hierarchy does not alter drag/drop or workflow commands.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/work-item-child-work.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/work-item-result-list.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/work-item-board-page.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/my-work/*.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 9: Planning/Review Compatibility And CSV Export

Goal: carry compact parent context into bounded live review rows and preserve hierarchy in exported work
without corrupting immutable history.

Scope:

- Add set-based parent enrichment for live `PlanningRiskItemDto` rows.
- Populate parent context in:
  - project Planning risk sections;
  - Milestone Review;
  - Cycle Review;
  - current status-report draft evidence where the same live row mapper is used.
- Render compact parent keys in live risk rows without displacing primary risk signals.
- Update status-report snapshot validation so old payloads may omit optional `parent`.
- Retain optional parent context in newly published status report work rows.
- Render parent context defensively in report detail and Markdown when present.
- Do not alter cycle closeout snapshot v1.
- Add `parent_key` and `parent_title` to project/workspace CSV exports.
- Keep CSV import schema and apply behavior unchanged.
- Update import/export documentation to identify parent columns as export-only.
- Add tests for:
  - live planning/review parent context;
  - set-based enrichment;
  - old status report snapshot compatibility;
  - new snapshot behavior chosen during implementation;
  - unchanged closeout snapshot parsing;
  - CSV column headers/order and populated/empty values;
  - hierarchy-filtered project/workspace export;
  - import ignoring no unsupported hierarchy additions.

Out of scope:

- Snapshot backfill.
- Parent-aware report analytics or closeout history.
- CSV parent import.

Acceptance criteria:

- Live planning and review rows identify child context compactly.
- Existing immutable reports and closeouts remain readable.
- CSV exports preserve parent key and title.
- CSV import remains stable and explicitly does not claim hierarchy support.
- No report or planning totals change because hierarchy exists.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/planning-service.test.ts
npm test --workspace @worktrail/api -- tests/project-cycle-service.test.ts tests/milestone-review-service.test.ts
npm test --workspace @worktrail/api -- tests/status-reports.test.ts tests/work-item-csv-export-service.test.ts
npm test --workspace @worktrail/web -- --include 'src/app/features/projects/**/*.spec.ts'
npm run typecheck
npm run lint
git diff --check
```

Status:

- Not started.

## Phase 10: Seed Data, Browser Smoke, And Responsive/Accessibility Verification

Goal: make Work Breakdown demonstrable on a clean local setup and verify its primary workflow in a real
browser.

Scope:

- Add deterministic hierarchy seed data with:
  - one parent story;
  - at least four children across open, in-progress, done, and canceled states;
  - mixed assignees/priorities;
  - parent and child direct estimates;
  - one unestimated child;
  - one dependency-blocked child;
  - mixed current/planned/no-cycle placement;
  - mixed milestone placement;
  - terminal parent candidate;
  - plain top-level work without children.
- Keep hierarchy scenario isolated from destructive Closeout Lab assumptions.
- Add seed assertions for same-project and two-level integrity.
- Add focused serial Playwright coverage:
  - open seeded parent and verify summary;
  - create child from parent;
  - return and verify child appears;
  - navigate parent/child without stale detail;
  - replace or clear a parent;
  - verify parent-change activity;
  - open exact-parent Work drill-down and verify URL/chip/result;
  - verify hierarchy context on list and board;
  - exercise a saved/copy hierarchy view where practical;
  - restore deterministic state if shared seed is mutated.
- Inspect desktop and mobile screenshots for:
  - detail hierarchy sections;
  - parent picker;
  - project/workspace lists;
  - board cards;
  - filter control/chips;
  - My Work or review context.
- Verify keyboard and accessible-label behavior for parent links, candidate selection, Save/Clear,
  child rows, and filter state.
- Verify long keys/titles, zoom, wrapping, card dimensions, page overflow, and text overlap.
- Resolve any component style or production bundle warnings introduced by hierarchy UI.

Out of scope:

- Full visual regression infrastructure.
- Arbitrary-depth stress tests.

Acceptance criteria:

- Fresh seed demonstrates Work Breakdown immediately.
- The primary create/manage/filter workflow passes in Playwright.
- Parent/child route navigation is proven against stale component state.
- Desktop/mobile layouts are readable and non-overlapping.
- No unexplained style or initial-bundle budget warning remains.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npx playwright test -g "work breakdown|child work|parent work"
npm run test:e2e
npm run build
git diff --check
```

Status:

- Not started.

## Phase 11: Documentation, Metadata, And Final Verification

Goal: complete v0.2.5 with accurate product/operator documentation, release artifacts, metadata, and a
green verification baseline.

Scope:

- Update README:
  - current baseline and repository layout;
  - Work Breakdown capability section;
  - hierarchy query/export behavior;
  - seeded walkthrough;
  - limitations and deferred recursive/automation/import behavior;
  - clear containment-versus-dependency semantics.
- Add `docs/v0.2.5/release-notes.md`.
- Add destination-neutral `docs/v0.2.5/pattern-notes.md` covering evidence such as:
  - bounded self-reference;
  - transactional row locking for graph-like invariants;
  - shallow DTO enrichment;
  - readable keys for URL state and UUIDs for writes;
  - derived summaries rather than mutable counters;
  - optional additive snapshot compatibility;
  - deliberate non-abstractions.
- Update PRD and technical design status only after implementation is complete.
- Update OpenAPI version if not already done.
- Update static product site with accurate Work Breakdown capability/limitations.
- Update package versions to `0.2.5`:
  - root;
  - API;
  - web;
  - contracts;
  - local workspace dependency metadata;
  - lockfile workspace metadata.
- Review all phase status records for accuracy.
- Check for stale v0.2.4 baseline claims and discontinued pattern-destination references.
- Run clean install or lockfile verification as appropriate.
- Run fresh database setup and full verification.
- Review production dependency audit and build budgets.
- Record residual risks and deferred opportunities honestly.

Out of scope:

- Creating a tag, GitHub release, or deployment unless separately requested.
- Production authentication or AWS infrastructure.
- v0.2.6 planning.

Acceptance criteria:

- README, OpenAPI, release notes, pattern notes, metadata, and public site match implemented behavior.
- All Phase 0-11 statuses are accurate.
- Fresh migration/seed and full tests pass.
- No stale baseline or unsupported hierarchy claim remains.
- Production dependency audit passes or any unavoidable finding is documented with concrete risk.
- Production build has no unexplained budget warning.

Suggested commands:

```sh
npm install --package-lock-only
npm run db:reset
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
git status --short --branch
```

Status:

- Not started.

## Phase Completion Protocol

When executing a phase:

- Re-read that phase and the latest user request before editing.
- Inspect overlapping user changes and preserve them.
- Implement only the current phase unless compilation requires a tightly coupled compatibility change.
- Run the phase's focused verification.
- Update the phase `Status` with:
  - completion date;
  - concrete files and behaviors delivered;
  - exact verification performed;
  - any intentional deviation from the draft plan.
- Keep later phases marked `Not started` until their work is actually complete.
- Do not defer failures in hierarchy depth, same-project ownership, transaction rollback, row-lock order,
  query state, archived-project enforcement, or snapshot compatibility to finalization.
- If implementation evidence requires a contract change, update the technical design before silently
  diverging.

## Release Completion Criteria

v0.2.5 is complete when:

- users can create child work directly from an eligible parent;
- users can assign, replace, and clear valid parents;
- hierarchy remains same-project and exactly two-level under concurrent writes;
- no-op retries create no update, activity, or notification noise;
- parent/child context is clear on detail, list, board, My Work, and live review surfaces;
- exact-parent and hierarchy-mode filters survive apply, reload, save, pin, copy, return, and export;
- lists and boards remain flat and operationally readable;
- parent and child workflow/planning fields remain independent;
- containment never changes dependency state;
- activity explains real parent changes;
- no new hierarchy notification category is introduced;
- old status report and closeout snapshots remain readable;
- CSV exports include parent key/title and CSV import remains honest about not supporting hierarchy;
- seed and E2E demonstrate the workflow;
- README, OpenAPI, release notes, pattern notes, package metadata, and public site are current;
- full verification is green.
