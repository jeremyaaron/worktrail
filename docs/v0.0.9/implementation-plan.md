# Worktrail v0.0.9 Implementation Plan

## Purpose

This plan turns the v0.0.9 PRD and technical design into sequential implementation phases. v0.0.9 should make delivery confidence visible at the planning level by adding derived milestone health, project delivery-health summaries, explainable health reasons, and planning review surfaces.

The release remains local-first. It should preserve the Angular static-hosting path, transport-neutral API handlers, local Express adapter, Postgres migration discipline, deterministic seed data, production preview, checked-in OpenAPI reference, and clean verification from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.0.9:

- Derive delivery health at read time.
- Do not store health states in the database.
- Do not add a delivery-health schema migration.
- Use deterministic rules, not scores.
- Use stable contract enum tokens and clearer UI labels.
- Label `healthy` as "On track" in the frontend.
- Treat manually blocked work and dependency-blocked work as severe delivery-health signals.
- Treat overdue work as risk.
- Escalate milestone health to blocked when the milestone target date has passed and open work remains.
- Treat due-soon work, unassigned active work, stale in-progress work, and empty active milestones as at-risk signals.
- Treat completed milestones with reopened/open work as at risk.
- Treat canceled or archived milestones as inactive.
- Exclude inactive milestones from active delivery-risk counts.
- Include unmilestoned active risk in project health.
- Reuse `WorkItemQuery` for health-reason links.
- Render unsupported reason links as text with `query: null`.
- Keep existing planning risk lists.
- Add compact `deliveryHealth` to `ProjectSummaryDto`.
- Add detailed `deliveryHealth`, extended `milestoneProgress`, and `planningReview` to `ProjectPlanningSummaryDto`.
- Centralize backend derivation in a shared service module.
- Use updated timestamps for "recently changed" in v0.0.9.
- Defer charts, custom health formulas, activity-event review feeds, aggregate read models, caching, and cloud infrastructure.

## Phase Sizing

Each phase should leave the repository in a coherent working state. Build from shared contracts and pure backend derivation outward:

1. baseline planning;
2. shared contracts;
3. pure delivery-health derivation;
4. planning summary integration;
5. project summary integration;
6. deterministic seed data;
7. frontend display helpers;
8. project overview UI;
9. planning dashboard UI;
10. OpenAPI and e2e coverage;
11. product docs, site, extraction notes, and final verification.

Run API tests after backend phases, frontend tests after UI phases, and full verification during finalization. Keep seed data deterministic because health states depend on dates, dependencies, milestone assignment, and status counts.

## Phase 0: Baseline Planning

Goal: confirm v0.0.9 planning inputs and resolve implementation choices before code changes.

Scope:

- Confirm `docs/v0.0.9/prd.md` exists.
- Confirm `docs/v0.0.9/technical-design.md` exists.
- Confirm `docs/v0.0.9/implementation-plan.md` exists.
- Confirm design decisions listed above.
- Check repository status before implementation starts.
- Confirm the active branch and any staged changes.

Out of scope:

- Runtime implementation.
- Contract changes.
- Frontend changes.
- API documentation implementation.

Acceptance criteria:

- The three v0.0.9 planning documents exist.
- No unresolved open decision blocks Phase 1.
- The worktree/index state is understood before implementation starts.

Suggested commands:

```sh
find docs/v0.0.9 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-05.
- Confirmed `docs/v0.0.9/prd.md`, `docs/v0.0.9/technical-design.md`, and `docs/v0.0.9/implementation-plan.md` exist.
- Confirmed implementation decisions:
  - derive delivery health at read time;
  - do not store health states in the database;
  - do not add a delivery-health schema migration;
  - use deterministic rules, not scores;
  - label `healthy` as "On track" in the frontend;
  - treat manually blocked work and dependency-blocked work as severe delivery-health signals;
  - treat overdue work as risk;
  - escalate milestone health to blocked when the milestone target date has passed and open work remains;
  - treat due-soon work, unassigned active work, stale in-progress work, and empty active milestones as at-risk signals;
  - treat completed milestones with reopened/open work as at risk;
  - treat canceled or archived milestones as inactive;
  - exclude inactive milestones from active delivery-risk counts;
  - include unmilestoned active risk in project health;
  - reuse `WorkItemQuery` for health-reason links;
  - render unsupported reason links as text with `query: null`;
  - keep existing planning risk lists;
  - add compact `deliveryHealth` to `ProjectSummaryDto`;
  - add detailed `deliveryHealth`, extended `milestoneProgress`, and `planningReview` to `ProjectPlanningSummaryDto`;
  - centralize backend derivation in a shared service module;
  - use updated timestamps for "recently changed" in v0.0.9;
  - defer charts, custom health formulas, activity-event review feeds, aggregate read models, caching, and cloud infrastructure.
- Confirmed current branch is `v0.0.9`.
- Confirmed current change state: `docs/v0.0.9/` is untracked and contains the three planning documents; no code changes are present yet.
- Verified `git diff --check`.
- No unresolved open decision blocks Phase 1.

## Phase 1: Contracts And API Model

Goal: establish shared delivery-health and planning-review contracts.

Scope:

- Add contract types:
  - `DeliveryHealthState`;
  - `DeliveryHealthSeverity`;
  - `DeliveryHealthReasonKey`;
  - `PlanningReviewItemKind`.
- Add DTOs:
  - `DeliveryHealthReasonDto`;
  - `ProjectDeliveryHealthDto`;
  - `PlanningReviewItemDto`;
  - `PlanningReviewDto`.
- Extend `MilestoneProgressDto` with:
  - `openCount`;
  - `dependencyBlockedCount`;
  - `dueSoonCount`;
  - `unassignedActiveCount`;
  - `staleInProgressCount`;
  - `health`;
  - `reasons`.
- Extend `ProjectSummaryDto` with `deliveryHealth`.
- Extend `ProjectPlanningSummaryDto` with:
  - `deliveryHealth`;
  - `planningReview`.
- Update tests and test fixtures that construct these DTOs.
- Add neutral placeholder mapping only where needed to keep existing services compiling before later phases populate real values.

Out of scope:

- Derivation rules.
- UI rendering.
- OpenAPI updates.
- Seed data changes.

Acceptance criteria:

- Shared contracts compile.
- API compiles with temporary or real summary values.
- Web compiles after fixture updates.
- No endpoint behavior is intentionally changed yet beyond type compatibility.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/api
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added shared delivery-health contract types:
  - `DeliveryHealthState`;
  - `DeliveryHealthSeverity`;
  - `DeliveryHealthReasonKey`;
  - `PlanningReviewItemKind`.
- Added shared delivery-health DTOs:
  - `DeliveryHealthReasonDto`;
  - `ProjectDeliveryHealthDto`;
  - `PlanningReviewItemDto`;
  - `PlanningReviewDto`.
- Extended `MilestoneProgressDto` with open, dependency-blocked, due-soon, unassigned, stale, health, and reason fields.
- Extended `ProjectSummaryDto` with `deliveryHealth`.
- Extended `ProjectPlanningSummaryDto` with `deliveryHealth` and `planningReview`.
- Added temporary API placeholder helpers for neutral delivery health and empty planning review data.
- Updated `ProjectService.getProjectSummary` and `PlanningService.getProjectPlanningSummary` to satisfy the new contracts without changing real derivation behavior yet.
- Updated web and API test fixtures/assertions for the new DTO shape.
- Verified `npm run typecheck --workspace @worktrail/contracts`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm run typecheck --workspace @worktrail/web`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/web -- --watch=false`.
- Verified `git diff --check`.

## Phase 2: Delivery Health Derivation Service

Goal: implement pure backend delivery-health derivation with focused unit tests.

Scope:

- Add `apps/api/src/services/delivery-health-service.ts`.
- Implement a pure derivation API that accepts:
  - project;
  - work items;
  - dependency-blocked work items;
  - blocking-open-work items;
  - milestones;
  - current time.
- Derive milestone health according to the technical design.
- Derive project delivery health according to the technical design.
- Derive planning review sections:
  - `needsAttention`;
  - `upcoming`;
  - `recentlyChanged`.
- Add reason generation with supported `WorkItemQuery` links.
- Use `query: null` for reason sets that cannot be represented faithfully by the current query contract.
- Keep date handling UTC and deterministic.
- Add unit tests for milestone health rules, project health rules, reason query generation, and planning review ordering/limits.

Out of scope:

- Repository calls.
- Endpoint response wiring.
- UI rendering.
- Seed data.

Acceptance criteria:

- Derivation has no repository dependency.
- Health rules are covered by unit tests.
- Project and milestone health results are deterministic for a fixed clock.
- Reason queries only use supported `WorkItemQuery` fields.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- delivery-health-service
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `apps/api/src/services/delivery-health-service.ts`.
- Implemented pure service-side derivation for:
  - milestone health;
  - project delivery health;
  - delivery-health reasons;
  - reason `WorkItemQuery` links where supported;
  - planning review sections for needs attention, upcoming, and recently changed.
- Kept the derivation service independent from repositories and endpoint handlers.
- Kept UTC date-string handling deterministic for a supplied `now`.
- Added unit coverage in `apps/api/tests/delivery-health-service.test.ts` for:
  - empty active project health;
  - empty active milestone risk;
  - complete and inactive milestone states;
  - completed milestones with reopened/open work;
  - target-date, manual-blocked, and dependency-blocked milestone blocking;
  - due-soon, unassigned, and stale in-progress at-risk signals;
  - unmilestoned project risk;
  - archived project inactivity;
  - deterministic planning review sections.
- Verified `npm test --workspace @worktrail/api -- delivery-health-service`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `git diff --check`.

## Phase 3: Planning Summary Backend Integration

Goal: wire derived health into the existing planning summary response.

Scope:

- Update `PlanningService.getProjectPlanningSummary` to call the delivery-health derivation service with existing fetched data.
- Return:
  - `deliveryHealth`;
  - enriched `milestoneProgress`;
  - `planningReview`;
  - existing risk lists.
- Remove duplicated milestone progress count logic from `PlanningService` if the derivation service now owns it.
- Preserve existing planning risk list semantics and sorting.
- Update planning service tests or add tests for the complete response shape.
- Verify archived project read behavior remains unchanged.

Out of scope:

- Project overview summary integration.
- Frontend rendering.
- OpenAPI updates.

Acceptance criteria:

- `GET /projects/:projectId/planning/summary` returns health and review data.
- Existing risk lists still return expected data.
- Existing planning tests pass after fixture updates.
- No additional endpoint is introduced.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- planning-service
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 4: Project Summary Backend Integration

Goal: add compact delivery health to project overview summary.

Scope:

- Update `ProjectService.getProjectSummary` to fetch:
  - project work items;
  - dependency-blocked project work items;
  - blocking-open-work project work items;
  - project milestones including archived milestones.
- Call the shared delivery-health derivation service.
- Return `deliveryHealth` on `ProjectSummaryDto`.
- Preserve existing status counts and recent work items.
- Update project summary tests and fixtures.
- Watch query count and avoid unnecessary N+1 patterns.

Out of scope:

- New endpoint creation.
- Aggregate SQL optimization.
- Frontend overview rendering.

Acceptance criteria:

- `GET /projects/:projectId/summary` returns `deliveryHealth`.
- Existing summary status counts and recent work items are unchanged.
- Project summary tests cover at least healthy and blocked/at-risk examples.
- Typechecks pass.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- project-service
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 5: Seed Data For Delivery Health

Goal: update deterministic seed data so the product visibly demonstrates v0.0.9 health states.

Scope:

- Update seed data to include:
  - an on-track active milestone;
  - an at-risk milestone;
  - a blocked milestone with dependency-blocked work;
  - a completed milestone;
  - a canceled or archived milestone;
  - unmilestoned active risk;
  - upcoming work and milestone targets;
  - recently changed active work/milestones.
- Preserve deterministic date behavior.
- Keep existing v0.0.8 dependency examples intact where possible.
- Update backend tests that rely on seed counts only if required.
- Reset, migrate, and seed a local database to verify data validity.

Out of scope:

- UI implementation.
- OpenAPI examples.
- Additional database schema.

Acceptance criteria:

- Seed runs from a clean reset.
- Planning summary returns healthy, at-risk, blocked, complete, and inactive examples.
- Project overview has meaningful delivery-health reasons.
- Existing relationship/dependency seed scenarios still work.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 6: Frontend Delivery Health Helpers

Goal: add reusable frontend display helpers for health labels, tones, and query links.

Scope:

- Add shared helper functions for:
  - health state labels;
  - health state tones;
  - severity labels/tones if needed;
  - reason query param conversion.
- Add or update shared CSS styles for health pills/reason rows.
- Ensure health indicators use text plus color.
- Update frontend test fixtures for the new DTO fields.
- Add focused helper tests if the helper logic is non-trivial.

Out of scope:

- Project overview layout.
- Planning page layout.
- API changes.

Acceptance criteria:

- Web typecheck passes.
- Existing frontend tests compile with updated fixtures.
- Health label and query conversion behavior is deterministic.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- delivery-health
git diff --check
```

Status:

- Not started.

## Phase 7: Project Overview Delivery Health UI

Goal: show compact project delivery health on the project overview route.

Scope:

- Update `ProjectHomePageComponent` to render:
  - delivery-health label;
  - active milestone count;
  - at-risk and blocked milestone counts;
  - open work count;
  - top reasons;
  - link to Planning;
  - reason links when `reason.query !== null`.
- Preserve existing status count tiles, recent work, project metadata, and archived-project notice.
- Keep the panel compact and responsive.
- Update project overview component tests.

Out of scope:

- Detailed planning review UI.
- New API endpoint.
- Charts.

Acceptance criteria:

- Project overview communicates delivery health without overwhelming the page.
- Reason links navigate to project work item lists with expected query params when supported.
- Archived projects render inactive/read-only health cleanly.
- Frontend tests pass for the component.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- project-home-page
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 8: Planning Dashboard Health And Review UI

Goal: add detailed delivery-health and planning-review surfaces to the planning page.

Scope:

- Update `ProjectPlanningPageComponent` to render:
  - delivery-health summary;
  - milestone health labels;
  - milestone reason chips/links;
  - planning review sections:
    - Needs attention;
    - Upcoming;
    - Recently changed.
- Keep existing risk metric tiles and detailed risk sections.
- Ensure no horizontal overflow on narrow screens.
- Ensure health/reason links are keyboard-accessible.
- Update planning page component tests.

Out of scope:

- Drag/drop changes.
- New charting dependency.
- Saved dashboard configuration.

Acceptance criteria:

- Planning page shows project and milestone delivery health.
- Planning review sections render populated and empty states correctly.
- Existing risk sections remain readable.
- Reason links use existing work item list filters where available.
- Frontend tests pass for the component.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- project-planning-page
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 9: OpenAPI And E2E Coverage

Goal: update API reference and add smoke coverage for health-driven planning workflows.

Scope:

- Update `docs/openapi/worktrail.openapi.yaml` for:
  - delivery-health enums;
  - delivery-health reason DTO;
  - project delivery-health DTO;
  - extended milestone progress DTO;
  - planning review DTOs;
  - extended project summary response;
  - extended planning summary response.
- Extend an existing Playwright planning/dependency workflow or add a focused v0.0.9 smoke test.
- Verify:
  - planning health labels render;
  - a health reason link opens a filtered work item list;
  - project overview health panel renders.
- Keep E2E coverage focused and stable.

Out of scope:

- Exhaustive health-rule browser tests.
- Visual regression tooling.
- Generated client tooling.

Acceptance criteria:

- OpenAPI describes the implemented response shape.
- E2E smoke coverage proves the end-to-end health path.
- Existing E2E tests remain stable.

Suggested commands:

```sh
npm run e2e --workspace @worktrail/web
npm run typecheck --workspace @worktrail/api
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 10: Product Documentation, Site, Extraction Notes, And Final Verification

Goal: complete release documentation and run final verification.

Scope:

- Update `README.md` with delivery-health and planning-review capabilities.
- Update the static product site with v0.0.9 capabilities.
- Add v0.0.9 extraction notes covering:
  - pure dashboard derivation service;
  - explainable health reasons;
  - query-linked metrics;
  - compact overview plus detailed planning surface pattern.
- Update `docs/v0.0.9/prd.md` and `docs/v0.0.9/technical-design.md` only if implementation changed the scope or decisions.
- Run full repo verification.
- Inspect build output for budget warnings.
- Confirm production preview still serves the Angular app and API from built artifacts.
- Record final phase status in this implementation plan.

Out of scope:

- npm package release.
- Git tag creation unless explicitly requested.
- Cloud deployment changes.

Acceptance criteria:

- Documentation matches implemented capabilities.
- Product site mentions delivery health and planning review.
- Extraction notes capture reusable patterns.
- Full verification passes or any residual issue is explicitly documented.
- v0.0.9 is ready for user QA/UAT.

Suggested commands:

```sh
npm run check
npm run build
npm run preview
git diff --check
git status --short --branch
```

Status:

- Not started.

## Release Verification

Before considering v0.0.9 complete, verify:

```sh
npm run check
npm run build
npm run e2e --workspace @worktrail/web
git diff --check
git status --short --branch
```

Manual QA checklist:

- Project overview shows delivery health.
- Project overview health reasons link where supported.
- Planning dashboard shows project health.
- Milestone progress rows show health labels and reasons.
- Needs attention, Upcoming, and Recently changed sections render.
- Blocked/dependency-blocked seed scenarios affect health.
- Healthy seed scenario remains on track.
- Completed and inactive milestone states display correctly.
- Existing planning risk sections still work.
- Existing dependency filters still work.
- Existing My Work, board, list, detail, import/export, and admin paths are not regressed.
- Mobile/narrow viewport planning layout has no horizontal page scroll.

## Risks And Watchpoints

- Health rules may feel too opinionated. Keep reasons explicit and avoid scores.
- Project summary may become heavier because it now needs work/milestone/dependency data. Accept this for v0.0.9 and defer aggregate read-model optimization.
- Some reason sets may not map exactly to current list filters. Use `query: null` instead of misleading links.
- Planning page density may increase. Keep the health panel compact and preserve existing risk sections.
- Seed date changes can make health examples brittle. Keep all dates deterministic.
- Duplicate derivation logic can drift. Keep rules centralized in the delivery-health service.
