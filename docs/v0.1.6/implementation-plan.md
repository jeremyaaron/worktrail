# Worktrail v0.1.6 Implementation Plan

## Purpose

This plan turns the v0.1.6 PRD and technical design into sequential implementation phases. v0.1.6 should add project-scoped batch triage so maintainers can select visible project work items and apply common updates without opening each item detail page.

The release should preserve the local-first development experience, Angular static-hosting compatibility, transport-neutral API handler structure, Express local adapter, Postgres persistence, deterministic seed data, checked-in OpenAPI docs, CI verification, and clean setup from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.6:

- Keep batch triage project-scoped.
- Add `POST /api/projects/:projectId/work-items/bulk-update`.
- Use an explicit discriminated action request instead of a generic patch object.
- Cap one request at 50 work item ids.
- Reject duplicate work item ids and duplicate label ids.
- Require owners and maintainers for all bulk mutation actions in this release.
- Hide bulk mutation controls for contributors and archived projects.
- Reject archived project bulk updates at the API boundary.
- Use partial success with per-item results for item-specific failures.
- Use request-level rejection for invalid request shape, invalid action references, archived projects, and missing bulk permission.
- Treat unchanged valid rows as successful `unchanged` results without activity, notification, or timestamp churn.
- Reuse existing single-item validation rules for assignee, label, milestone, status transition, project writability, and notifications.
- Add `work_item.due_date_changed` activity because due date updates need audit parity.
- Reload the current project Work list after a bulk command completes.
- Clear successful and unchanged selections after completion.
- Keep failed selections selected only when those items remain visible after reload.
- Do not add cross-project bulk edit, bulk delete, bulk comments, durable selection sets, background jobs, custom permissions, or a reusable package in this release.

## Phase Sizing

Each phase should leave the repository in a coherent working state. This release touches shared contracts, activity event types, work item endpoint validation and routing, `WorkItemService`, API tests, OpenAPI, Angular API clients, the project Work page, responsive UI behavior, seed/browser smoke coverage, README, public site, release notes, and pattern extraction notes.

Implementation phases:

1. baseline planning;
2. contracts and activity type plumbing;
3. endpoint validation and route wiring;
4. service command core;
5. service side effects, unchanged handling, and edge cases;
6. API regression and OpenAPI;
7. Angular API client and request serialization;
8. project Work selection state;
9. bulk action bar and result feedback;
10. responsive polish and web tests;
11. seed data and Playwright smoke;
12. documentation, site, release notes, pattern extraction notes, and final verification.

Run focused contract/API tests after backend phases, focused web tests after frontend phases, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.1.6 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.1.6/prd.md` exists.
- Confirm `docs/v0.1.6/technical-design.md` exists.
- Confirm `docs/v0.1.6/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm sprint docs avoid discontinued extraction-target references.
- Confirm no runtime files have been changed for v0.1.6 yet.

Out of scope:

- Runtime implementation.
- Contract changes.
- API changes.
- UI changes.

Acceptance criteria:

- v0.1.6 planning inputs exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.
- Sprint docs use destination-neutral pattern extraction language.

Suggested commands:

```sh
find docs/v0.1.6 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-07.
- Confirmed v0.1.6 planning inputs exist:
  - `docs/v0.1.6/prd.md`;
  - `docs/v0.1.6/technical-design.md`;
  - `docs/v0.1.6/implementation-plan.md`.
- Confirmed implementation decisions:
  - keep batch triage project-scoped;
  - add `POST /api/projects/:projectId/work-items/bulk-update`;
  - use explicit discriminated bulk actions;
  - cap requests at 50 work item ids;
  - require owner/maintainer role for bulk mutation;
  - use partial success with per-item result reporting;
  - add due-date activity audit support;
  - reload the project Work list after bulk commands;
  - defer cross-project bulk edit, durable selections, background jobs, custom permissions, and reusable-package extraction.
- Confirmed active branch is `v0.1.6`.
- Confirmed current change state:
  - only `docs/v0.1.6/` is untracked;
  - no runtime files have been changed yet.
- Confirmed v0.1.6 docs avoid discontinued extraction-target references.
- Verified `git diff --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Contracts And Activity Type Plumbing

Goal: add shared request/response contracts and due-date activity typing without changing runtime behavior yet.

Scope:

- Update `packages/contracts/src/work-items.ts`:
  - add `BulkUpdateWorkItemsAction`;
  - add `BulkUpdateWorkItemsRequest`;
  - add `BulkUpdateWorkItemsResultStatus`;
  - add `BulkUpdateWorkItemsErrorCode`;
  - add `BulkUpdateWorkItemsErrorDto`;
  - add `BulkUpdateWorkItemsResultDto`;
  - add `BulkUpdateWorkItemsResponseDto`.
- Update `packages/contracts/src/activity.ts`:
  - add `work_item.due_date_changed` to `ActivityEventType`.
- Add or update contract tests for:
  - each bulk action shape;
  - response success, unchanged, and failed result shapes;
  - due-date activity event typing.
- Update TypeScript imports/fixtures that need the expanded activity event type.

Out of scope:

- Endpoint handler.
- Service implementation.
- OpenAPI.
- Angular API client.
- UI.

Acceptance criteria:

- Shared contract package compiles.
- Contract tests cover the new request and response surface.
- `work_item.due_date_changed` is accepted by shared activity typing.
- Existing contract consumers continue to compile.

Suggested commands:

```sh
npm test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/contracts
git diff --check
```

Status:

- Not started.

## Phase 2: Endpoint Validation And Route Wiring

Goal: expose the bulk-update HTTP boundary with strict validation and adapter-local route wiring.

Scope:

- Update `apps/api/src/endpoints/work-items.ts`:
  - import new bulk contract types;
  - add `bulkUpdateWorkItemsSchema`;
  - add duplicate-id validation helper;
  - add `bulkUpdateWorkItemsHandler`.
- Validate:
  - project id route param;
  - `workItemIds` length 1 to 50;
  - duplicate work item ids;
  - discriminated action payloads;
  - `labelIds` length 1 to 20 for label actions;
  - duplicate label ids;
  - `YYYY-MM-DD` due date format.
- Update `apps/api/src/adapters/express/routes/work-item-routes.ts`:
  - register `POST /api/projects/:projectId/work-items/bulk-update`;
  - place the route before `POST /api/projects/:projectId/work-items`.
- Add a temporary service method stub or minimal implementation only if required for compilation.

Out of scope:

- Full service behavior.
- API regression matrix.
- OpenAPI.
- Angular client.
- UI.

Acceptance criteria:

- API package compiles with the new route.
- Invalid request shapes fail at endpoint validation.
- Route wiring remains adapter-local and consistent with existing work item routes.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api -- work-items
git diff --check
```

Status:

- Not started.

## Phase 3: Service Command Core

Goal: implement the core `WorkItemService.bulkUpdateWorkItems` command with project scope, permission, partial result, and basic mutation behavior.

Scope:

- Add `bulkUpdateWorkItems(projectId, input)` to `WorkItemService`.
- Add owner/maintainer bulk permission enforcement.
- Require the route project and reject archived projects.
- Validate action-level references before per-item processing:
  - active assignee for `set_assignee`;
  - active project milestone for `set_milestone`;
  - active project labels for `add_labels` and `remove_labels`.
- Process requested ids in request order.
- Return aggregate counts:
  - `requestedCount`;
  - `succeededCount`;
  - `unchangedCount`;
  - `failedCount`.
- Return item-level results with:
  - work item id;
  - display key when safe;
  - `updated`, `unchanged`, or `failed` status;
  - updated list-item DTO for successful changed rows;
  - structured error for failed rows.
- Implement field updates for:
  - assignee;
  - priority;
  - milestone;
  - due date;
  - labels;
  - status.
- Use existing repository transaction support for item writes.
- Keep all behavior inside `WorkItemService` private helpers unless a small repository helper is clearly needed.

Out of scope:

- Complete notification/activity parity.
- Exhaustive API tests.
- Web client/UI.
- OpenAPI.

Acceptance criteria:

- Owners/maintainers can submit a valid bulk command.
- Contributors cannot submit a bulk command.
- Archived projects reject bulk commands.
- Cross-project or missing ids return item-level failures.
- Successful field updates return updated list-item DTOs.
- Basic partial success works.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api -- work-items
git diff --check
```

Status:

- Not started.

## Phase 4: Service Side Effects, Unchanged Handling, And Edge Cases

Goal: make the bulk service behavior production-shaped by preserving audit, notification, and no-op semantics.

Scope:

- Add due-date activity support to `recordUpdateActivity`.
- Ensure existing activity is recorded for successful changes:
  - assignee;
  - priority;
  - milestone;
  - label added;
  - label removed;
  - status.
- Ensure existing notification behavior is preserved:
  - assignee change notifications;
  - watched status change notifications.
- Do not notify for failed or unchanged rows.
- Do not record activity for failed or unchanged rows.
- Do not update `updatedAt` for unchanged rows.
- Mark valid no-op rows as `unchanged`:
  - current assignee/priority/milestone/due date/status already matches;
  - all requested labels are already present for add;
  - none of the requested labels are present for remove.
- Map expected item-specific errors:
  - `NOT_FOUND`;
  - `NOT_IN_PROJECT`;
  - `WORKFLOW_TRANSITION_ERROR`;
  - `VALIDATION_ERROR`.
- Keep invalid action references request-level where possible.

Out of scope:

- OpenAPI.
- Angular client/UI.
- Playwright.

Acceptance criteria:

- Bulk changes are auditable per affected work item.
- Due-date changes create `work_item.due_date_changed` activity.
- Assignee/status bulk changes keep notification behavior.
- No-op rows do not churn timestamps, activity, or notifications.
- Item-level failures are clear and stable.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api -- work-items notifications activity
git diff --check
```

Status:

- Not started.

## Phase 5: API Regression And OpenAPI

Goal: lock down the backend behavior and document the implemented HTTP surface.

Scope:

- Add API tests for endpoint validation:
  - empty ids;
  - too many ids;
  - duplicate ids;
  - invalid action type/value;
  - duplicate label ids;
  - invalid date format.
- Add API tests for request-level failures:
  - contributor forbidden;
  - archived project rejection;
  - invalid assignee;
  - invalid milestone;
  - invalid labels.
- Add API tests for supported actions:
  - set/clear assignee;
  - set priority;
  - set/clear milestone;
  - set/clear due date;
  - add/remove labels;
  - transition status.
- Add API tests for partial result behavior:
  - one valid and one invalid item;
  - workflow transition item failure;
  - unchanged result.
- Add API tests for side effects:
  - activity rows;
  - assignee/status notifications where existing behavior applies.
- Update `docs/api/openapi.yaml`:
  - OpenAPI info version;
  - bulk-update path;
  - request schema;
  - response schema;
  - error shape notes;
  - `work_item.due_date_changed` activity event enum/examples if activity events are enumerated.
- Update OpenAPI guard tests.

Out of scope:

- Angular client.
- UI.
- Browser smoke.

Acceptance criteria:

- API tests cover the bulk-update behavior matrix.
- OpenAPI documents the new route and schemas.
- OpenAPI tests pass.
- Existing work item update/transition tests still pass.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-items.test.ts openapi.test.ts
ruby -e "require 'yaml'; YAML.load_file('docs/api/openapi.yaml'); puts 'YAML parsed'"
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 6: Angular API Client And Request Serialization

Goal: add web client support for the bulk-update endpoint and isolate request serialization before page UI work.

Scope:

- Update `apps/web/src/app/core/api/work-items-api.ts`:
  - import bulk request/response contract types;
  - add `bulkUpdateProjectWorkItems`.
- Update `apps/web/src/app/core/worktrail-api.service.ts`:
  - expose `bulkUpdateProjectWorkItems`.
- Add or update web API client tests:
  - verify URL;
  - verify HTTP method;
  - verify request body.
- Add focused helper functions if useful for:
  - action form value to `BulkUpdateWorkItemsAction`;
  - result summary text;
  - failed-row selection ids.

Out of scope:

- Project Work page template changes.
- Selection UI.
- Playwright.

Acceptance criteria:

- Angular API client posts to `/api/projects/:projectId/work-items/bulk-update`.
- Shared contract types are used end to end.
- Web package compiles.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- worktrail-api.service
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 7: Project Work Selection State

Goal: add local multi-select behavior to the project Work page without submitting bulk actions yet.

Scope:

- Update `WorkItemListPageComponent` state:
  - selected work item ids;
  - selected id set;
  - selected visible rows;
  - all-visible selected state;
  - selected count.
- Add methods:
  - toggle one row;
  - toggle all visible rows;
  - clear selection;
  - prune selection to visible rows;
  - check row selected state.
- Add row and select-all-visible checkboxes to project Work page markup.
- Keep row links and detail return URLs working.
- Clear selection when:
  - filters change;
  - filters clear;
  - saved/pinned view opens;
  - route query params change;
  - loaded result set no longer contains selected ids.
- Hide selection controls for archived projects and contributors if the action surface would be unavailable.
- Keep workspace Work Items page unchanged.

Out of scope:

- Bulk action form.
- API submission.
- Result feedback.
- Playwright.

Acceptance criteria:

- Maintainers can select one, many, or all visible project rows.
- Selected count updates correctly.
- Selection is temporary and route/query scoped.
- Existing project Work page filter, saved view, pinned view, CSV, and row navigation behavior still works.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- work-items-page.component
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 8: Bulk Action Bar And Result Feedback

Goal: connect selection to real bulk action submission and user-visible results.

Scope:

- Add owner/maintainer capability signal for bulk mutation.
- Add compact bulk action bar that appears only when rows are selected.
- Add action selection and relevant value controls for:
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
- Use active project-local members, labels, and milestones as options.
- Disable Apply until the selected action has required values.
- Confirm multi-item status transitions.
- Submit `BulkUpdateWorkItemsRequest`.
- Show loading, error, and result states.
- Reload the current list after completion.
- Clear successful and unchanged selections.
- Keep failed selections selected when still visible.
- Show result counts and failed rows by display key or fallback label.

Out of scope:

- Major visual redesign of the Work page.
- Cross-project actions.
- Board bulk actions.

Acceptance criteria:

- A maintainer can apply each supported action from selected project rows.
- The UI clearly reports updated, unchanged, and failed counts.
- Failed rows are understandable and recoverable.
- Changed rows leaving the current filter do not create stale list state.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- work-items-page.component
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 9: Responsive Polish And Web Tests

Goal: make the project Work page batch triage interaction usable across viewport sizes and covered by focused web tests.

Scope:

- Polish checkbox sizing and row alignment.
- Ensure the action bar wraps cleanly on mobile and desktop.
- Ensure labels and controls do not overlap.
- Add accessible names for row checkboxes and select-all-visible checkbox.
- Ensure result feedback is readable without relying on color alone.
- Add or extend component tests for:
  - selection and select-all-visible;
  - selection clearing on query/saved-view changes;
  - archived/contributor absence path;
  - action serialization;
  - Apply disabled states;
  - successful result summary;
  - partial failure summary;
  - failed row reselection after reload.

Out of scope:

- Browser smoke.
- Documentation.

Acceptance criteria:

- Project Work page remains scannable with selection controls.
- Bulk action bar works at mobile and desktop widths.
- Component tests cover the key UI state transitions.
- No Angular template type errors.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- work-items-page.component
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 10: Seed Data And Playwright Smoke

Goal: prove batch triage works from deterministic seeded project work in a browser.

Scope:

- Review existing seed data for a reliable project batch triage scenario.
- Add or adjust seed data only if needed for:
  - at least two visible selectable work items in one useful project lens;
  - an active label or milestone that can be applied;
  - deterministic display keys/titles for test selection.
- Add Playwright smoke for:
  - maintainer/owner opens a project Work page;
  - selects two visible rows;
  - applies one low-risk bulk action, preferably add label or set milestone;
  - verifies result summary;
  - verifies updated list or detail/activity evidence.
- Add Playwright coverage for one absence path:
  - contributor cannot see mutation controls; or
  - archived project cannot expose bulk mutation controls.
- Keep the test deterministic and short.

Out of scope:

- Exhaustive browser coverage for every action type.
- Non-deterministic ordering assertions.

Acceptance criteria:

- Seed data supports the browser scenario from a fresh reset/migrate/seed.
- Playwright smoke covers one successful project bulk action.
- Playwright smoke covers one read-only absence path.
- The e2e suite remains deterministic.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run e2e
git diff --check
```

Status:

- Not started.

## Phase 11: Documentation, Site, Release Notes, Pattern Notes, And Final Verification

Goal: complete the release surface and verify the repository end to end.

Scope:

- Update README:
  - project batch triage capability;
  - supported actions;
  - project-only scope;
  - owner/maintainer permission;
  - archived project behavior.
- Update public static site if batch triage should be mentioned in product copy.
- Add `docs/v0.1.6/release-notes.md`.
- Add `docs/v0.1.6/pattern-extraction-notes.md` covering:
  - temporary selection state;
  - explicit batch command request/response contracts;
  - partial success result envelopes;
  - activity and notification side effects.
- Confirm documentation avoids discontinued extraction-target references.
- Confirm OpenAPI is current.
- Run final verification.
- Record final verification results in the implementation plan.

Out of scope:

- New product scope.
- Release tagging unless explicitly requested.

Acceptance criteria:

- README and public site match implemented capabilities.
- Release notes summarize user-facing and technical changes.
- Pattern notes are destination-neutral.
- OpenAPI matches the route surface.
- Full verification passes or any failures are documented with concrete cause.

Suggested commands:

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run e2e
git diff --check
git status --short --branch
```

Status:

- Not started.
