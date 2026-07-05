# Worktrail v0.0.9 PRD

## Summary

Worktrail v0.0.9 should make project delivery health easier to understand. v0.0.8 made execution risk concrete by adding relationships, dependency-blocked signals, dependency filters, relationship activity, and relationship-aware planning surfaces. The next release should help teams answer whether a project or milestone is on track before they inspect individual work items one by one.

The v0.0.9 theme is:

> Make delivery confidence visible at the planning level.

This sprint should add a focused delivery-health slice: milestone health, dependency-aware readiness signals, project planning review summaries, and lightweight delivery metrics. It should not become a full analytics platform, Gantt chart, forecasting engine, portfolio management system, or notification sprint. The goal is to make Worktrail more useful for weekly planning and stakeholder review while exposing reusable patterns for metric aggregation, health-state derivation, dashboard query composition, and explainable project status signals.

## Context

Worktrail is both a product and a reference application. Each sprint should make the product more useful while revealing implementation patterns that may later inform `jawstack` and one-click deployable reference solutions.

The current product has:

- Angular SPA frontend with lazy-loaded route components;
- TypeScript API with a local Express adapter and transport-neutral endpoint handler structure;
- production-like local preview from built artifacts;
- runtime configuration validation;
- liveness and database readiness endpoints;
- checked-in OpenAPI reference;
- operator runbook;
- Postgres persistence through Drizzle migrations;
- deterministic seed data;
- My Work dashboard;
- cross-project work discovery;
- personal saved views;
- route-based quick work capture;
- project navigation summaries;
- workspace settings and member lifecycle administration;
- server-derived local actor roles backed by active workspace members;
- project settings, labels, milestones, planning dashboard, board, comments, and activity;
- archived-project write protection;
- CSV import/export;
- work item relationships;
- dependency-blocked signals and dependency filters;
- relationship-aware My Work and planning surfaces;
- Playwright smoke coverage across daily workflow, governance, planning, import/export, dependency workflow, and responsiveness;
- static GitHub Pages product site.

Worktrail can now hold realistic work, import and export data, model dependencies, and surface operational risk. The next missing layer is a concise answer to "how healthy is this plan?" A user can inspect milestones, lists, boards, and dependency sections today, but the product does not yet summarize delivery health in a way that a project owner can quickly act on.

## Problem

Worktrail currently exposes useful raw planning data: milestones, statuses, due dates, blockers, stale work, dependency-blocked work, and unassigned work. However, users still need to mentally combine these signals.

Current gaps:

- A milestone does not have an explicit health state.
- Project planning surfaces show risk lists but do not summarize why a plan is healthy, at risk, or blocked.
- There is no concise review surface for "what changed since the last planning check?"
- Dependency risk is visible, but not rolled into milestone readiness.
- Overdue, blocked, dependency-blocked, unassigned, and stale work are shown separately without a derived confidence model.
- Project owners cannot quickly identify which milestone needs attention first.
- The app has not exercised a reusable pattern for explainable dashboard metrics that link back into filtered work lists.

These gaps reduce usability for project owners and maintainers. As teams add more work and dependencies, they need a higher-level operating view that remains explainable and actionable.

## Goals

- Add delivery-health signals for active and planned milestones.
- Add project-level planning review metrics that summarize current execution risk.
- Make dependency risk part of milestone and project delivery confidence.
- Provide explainable health reasons, not opaque scores.
- Link every metric and health reason back into filtered work lists where practical.
- Keep health derivation deterministic and easy to test.
- Preserve local-first setup, existing permissions, and archived-project read behavior.
- Update seed data to demonstrate healthy, at-risk, and blocked planning states.
- Update OpenAPI, README, product site, and extraction notes.
- Capture reusable patterns for metric aggregation, health-state derivation, explainable dashboards, and cloud-friendly read models.

## Non-Goals

- Gantt charts.
- Critical path forecasting.
- AI estimates, probabilistic delivery predictions, or generated project status reports.
- Automated notifications.
- Slack, email, webhook, or calendar integrations.
- Project portfolio management across many workspaces.
- Custom health formulas.
- Custom dashboards.
- Time tracking.
- Burndown charts.
- Velocity forecasting.
- Sprint/cycle entities.
- Financial cost tracking.
- Production authentication.
- Hosted cloud infrastructure.

## Target Users

Primary:

- Project owners reviewing whether active milestones are on track.
- Maintainers preparing for weekly planning or stakeholder updates.
- Contributors trying to understand which risks matter most.
- Teams evaluating whether Worktrail can support real delivery review.
- The project owner evaluating reusable dashboard and metric patterns for `jawstack`.

Secondary:

- Developers evaluating Worktrail as a serious reference app.
- Future maintainers who need explainable aggregation patterns before adding larger analytics features.
- Teams that imported work and added dependencies, then need a compact operating view.

## Positioning

Worktrail should remain a focused project tracker. v0.0.9 should not pretend to be an enterprise reporting suite. It should make delivery health visible, grounded in the work items already in the system, and easy to inspect.

Suggested v0.0.9 positioning:

> A focused project tracker that explains which milestones are healthy, at risk, or blocked, and why.

## Product Principles

- Health signals should be explainable.
- Derived status should never hide the underlying work items.
- Every important planning signal should link to an inspectable list.
- Dependency risk should affect delivery health without creating automatic workflow transitions.
- Metrics should use existing data before adding new data entry burden.
- The first health model should be deterministic and conservative.
- Owners should see enough information to act, not a decorative analytics dashboard.
- Archived projects remain readable and protected from writes.
- Implementation should reveal reusable dashboard patterns without abstracting them prematurely.

## Scope

### 1. Milestone Health Model

Add a derived milestone health model for active and planned project milestones.

Health states:

- `healthy`: no meaningful open delivery risk is present.
- `at_risk`: risk exists but does not fully block delivery.
- `blocked`: at least one severe delivery risk is present.
- `complete`: milestone work is fully done or milestone status is completed.
- `inactive`: milestone is canceled or archived.

The technical design may refine these names if there is a better contract shape, but the product should preserve these meanings.

Inputs:

- total work item count;
- done count;
- open count;
- blocked-status count;
- dependency-blocked count;
- overdue count;
- due-soon count;
- unassigned active count;
- stale in-progress count;
- target date;
- milestone status;
- archived state.

Required behavior:

- Health is derived server-side.
- Health includes reasons.
- Reasons include counts and linkable query information where practical.
- Health is shown in Planning milestone progress.
- Health is shown in project overview where milestone summary already appears or can fit cleanly.
- Archived/canceled milestones remain readable but do not count as active delivery risk.

Acceptance criteria:

- A milestone with overdue or blocked work is not shown as healthy.
- A milestone with dependency-blocked work shows an explicit dependency reason.
- A completed milestone shows complete regardless of historical overdue data.
- A canceled or archived milestone shows inactive/read-only state.
- Health reasons link into filtered project work item lists where query semantics support it.

### 2. Project Delivery Health Summary

Add a project-level delivery health summary to the planning dashboard and project overview.

Required summary signals:

- active milestone count;
- healthy milestone count;
- at-risk milestone count;
- blocked milestone count;
- open work count;
- overdue work count;
- blocked-status work count;
- dependency-blocked work count;
- work blocking open downstream items count;
- unassigned active work count;
- stale in-progress work count.

Required behavior:

- Project delivery health is derived from active project work and active/planned milestones.
- Project health state uses the milestone health model plus unmilestoned active risk.
- Project health includes a small set of top reasons.
- Each top reason links to a filtered list when possible.
- The project overview gets a compact delivery-health panel.
- The Planning dashboard gets a more detailed delivery-health panel above or near current risk sections.

Acceptance criteria:

- Project overview gives a quick "healthy / at risk / blocked" signal.
- Planning gives enough detail to explain the signal.
- Dependency-blocked and blocking-open-work signals contribute to project delivery health.
- Existing planning risk sections remain available and readable.

### 3. Planning Review Surface

Add a concise planning review section that helps owners run a weekly project check.

Required review sections:

- "Needs attention": top risk reasons grouped by severity.
- "Upcoming": due-soon work and milestones approaching target dates.
- "Recently changed": recently updated active work, dependency changes, and milestone changes where data is already available.

This should reuse existing activity and work item data. It should not introduce a new review entity or saved review snapshots in v0.0.9.

Required behavior:

- Planning review appears on the project Planning route.
- Each review section is limited to a small number of items.
- Items link to work item detail, milestone-related filtered lists, or project activity where appropriate.
- Empty states explain when there is nothing requiring attention.
- Review copy should be operational, not celebratory.

Acceptance criteria:

- A project owner can scan Planning and identify the top delivery risks without reading every risk section.
- Recently changed work includes enough context to be useful.
- Review sections remain readable on desktop and common tablet-width layouts.

### 4. Delivery Metrics API Contract

Extend planning-related contracts to expose delivery health and review data.

Expected additions:

- `MilestoneHealthDto`;
- `ProjectDeliveryHealthDto`;
- `DeliveryHealthReasonDto`;
- `PlanningReviewItemDto`;
- additions to `ProjectPlanningSummaryDto`;
- optional additions to `ProjectSummaryDto` if project overview uses the same summary data.

Required behavior:

- DTOs remain serializable and frontend-friendly.
- Health reason query payloads reuse existing `WorkItemQuery` semantics where possible.
- Contracts avoid embedding UI-only copy that should live in Angular.
- API routes remain transport-neutral.

Acceptance criteria:

- Contracts compile.
- API returns deterministic health states and reasons for seeded data.
- Frontend renders health data without duplicating the core health calculation.

### 5. Backend Health Derivation

Add backend service logic to calculate milestone and project delivery health.

Required behavior:

- Use existing repositories where practical.
- Batch or aggregate work item data rather than issuing per-milestone N+1 queries.
- Include dependency counts from relationship data.
- Keep health derivation pure enough for focused tests.
- Treat archived projects as readable.
- Use existing permission/read policy.

Acceptance criteria:

- Service tests cover healthy, at-risk, blocked, complete, and inactive milestone health.
- Service tests cover project-level health.
- Dependency-blocked work affects health.
- Terminal blocker transitions clear dependency-related health reasons through existing dependency derivation.

### 6. Frontend Delivery Health UI

Update Angular surfaces to show health clearly.

Required UI updates:

- Planning dashboard:
  - project delivery health header/panel;
  - milestone health indicators and reasons;
  - planning review section;
  - existing risk sections preserved.
- Project overview:
  - compact delivery health panel;
  - milestone health summary if it fits without clutter.
- Work item list links:
  - support health reason links using existing query params.

Required UI behavior:

- Health indicators must not rely on color alone.
- Use concise labels and counts.
- Keep page density appropriate for operational review.
- Avoid marketing-style cards or nested card layouts.
- Preserve responsive readability.

Acceptance criteria:

- Planning page shows project health, milestone health, and review sections.
- Project overview shows compact delivery health.
- Health reasons navigate to filtered work item lists.
- Empty and no-risk states are clear.
- Existing planning and project overview tests continue to pass.

### 7. Seed Data

Update deterministic seed data to demonstrate delivery health states.

Required seeded scenarios:

- a healthy active milestone;
- an at-risk milestone with due-soon or stale work;
- a blocked milestone with blocked-status or dependency-blocked work;
- a completed milestone;
- a canceled or archived milestone;
- an unmilestoned active risk contributing to project-level health.

Acceptance criteria:

- Seeded Planning page demonstrates all major health states.
- Tests relying on seeded counts remain deterministic.
- Demo walkthrough can point to visible health examples.

### 8. Documentation And Extraction Notes

Update release-facing docs.

Required docs:

- README:
  - delivery health;
  - milestone health;
  - planning review;
  - limitations.
- Product site:
  - delivery health messaging.
- OpenAPI:
  - delivery health DTOs and extended planning/project summary responses.
- `docs/v0.0.9/jawstack-extraction-notes.md`:
  - metric aggregation;
  - health-state derivation;
  - explainable dashboard reasons;
  - linkable dashboard metrics;
  - avoiding N+1 dashboard queries;
  - cloud-readiness implications for dashboard read models.

Acceptance criteria:

- Release docs reflect implemented v0.0.9 behavior.
- Extraction notes identify patterns without proposing a generic analytics framework too early.

## UX Requirements

Planning should feel like an operating surface, not an analytics landing page.

Required UX traits:

- concise health labels;
- reason counts with plain language;
- direct links to filtered lists;
- compact density;
- stable layout dimensions;
- accessible status text independent of color;
- no decorative charts unless they make the data easier to compare.

Visual guidance:

- Use badges, compact panels, and list rows rather than oversized hero-style visuals.
- Keep card radius at or below existing app conventions.
- Do not introduce a charting library unless the technical design identifies a clear need.
- Avoid one-note color palettes; health states should use existing neutral UI with restrained semantic accents.

## API Requirements

The API should expose delivery health through existing project/planning routes where possible.

Likely route impact:

- Extend `GET /api/projects/:projectId/planning-summary`.
- Optionally extend `GET /api/projects/:projectId/summary`.

The technical design should decide whether to:

- keep all delivery health data in planning summary and have project overview call planning summary when needed; or
- add compact delivery health to project summary to avoid over-fetching on overview.

Constraints:

- Keep handlers transport-neutral.
- Keep derived calculations in services, not Angular.
- Keep query links compatible with existing list filter query params.
- Avoid introducing a new reporting API surface unless existing summaries cannot carry the data cleanly.

## Data Requirements

No new persisted table is required unless the technical design identifies a strong need.

Preferred approach:

- derive health from milestones, work items, relationships, activity, and existing timestamps;
- add no new persistence for health states;
- keep seed data and tests deterministic.

Potential future data not in scope:

- saved planning review snapshots;
- manual health overrides;
- team capacity;
- estimates-to-completion;
- historical health trend records.

## Permission Requirements

v0.0.9 delivery health is read-only derived data.

Expected behavior:

- Owners, maintainers, and contributors can read health summaries for readable projects.
- Archived projects show read-only health based on archived data where useful.
- No new write permission model is introduced.
- Existing project read/write protections remain unchanged.

## Testing Requirements

Backend tests should cover:

- milestone health derivation;
- project health derivation;
- health reasons and counts;
- dependency risk contribution;
- terminal blocker clearing dependency risk;
- archived/canceled/completed milestone behavior;
- no N+1-prone service behavior where practical to assert through repository call structure or focused integration tests.

Frontend tests should cover:

- Planning health panel rendering;
- milestone health rendering;
- planning review rendering;
- project overview delivery health rendering;
- health reason links;
- empty/no-risk states;
- responsive layout risk if the implementation changes dense panels.

E2E smoke coverage should include:

- view Planning health on seeded data;
- follow a health reason link to a filtered list;
- complete or otherwise clear one risk and confirm the derived health/reason changes where feasible without making the smoke flow too brittle.

## Documentation Requirements

Update:

- `README.md`;
- static product site under `site/`;
- `docs/api/openapi.yaml`;
- `docs/v0.0.9/technical-design.md`;
- `docs/v0.0.9/implementation-plan.md`;
- `docs/v0.0.9/jawstack-extraction-notes.md`.

## Success Metrics

Product success:

- Project owners can identify the riskiest milestone from Planning without manually scanning all work items.
- Health reasons are specific enough to act on.
- Dependency risk contributes to planning confidence.
- Project overview gives a useful delivery signal without duplicating the full Planning page.

Engineering success:

- Health derivation is deterministic and tested.
- Dashboard data is aggregated without obvious N+1 query behavior.
- Existing list query semantics power health reason links.
- No unnecessary persistence is added.
- Docs and OpenAPI match implemented behavior.

Reference-app success:

- Worktrail gains a reusable pattern for explainable derived dashboard state.
- Extraction notes capture metric/health derivation lessons without creating a premature analytics abstraction.

## Risks

- Health logic could become arbitrary or hard to explain.
- Too many metrics could clutter Planning.
- Project overview could duplicate too much of Planning.
- Health reasons could drift from list query filters.
- Dependency and milestone calculations could introduce slow queries as data grows.
- Seed data changes could destabilize existing tests.
- A dashboard-heavy sprint could over-index on reporting instead of actionable workflow.

## Mitigations

- Keep the health model small and reason-based.
- Link health reasons to the underlying work items.
- Start with deterministic thresholds and document them.
- Reuse existing query DTOs for reason links.
- Batch or aggregate work item and relationship data.
- Keep project overview compact and Planning detailed.
- Add focused service tests for health state edge cases.
- Keep charts out unless they clearly improve scanability.

## Open Questions

1. Should project overview fetch full planning summary data or receive a compact delivery health extension on project summary?
2. Should `blocked` milestone health require blocked-status work only, or should dependency-blocked work also make a milestone blocked instead of at risk?
3. Should overdue work always make a milestone blocked, or only at risk unless target date has passed?
4. Should unassigned active work affect milestone health or only project-level health?
5. Should recently changed review items include activity events, work item updated timestamps, or both?
6. Should completed milestones with reopened work show complete or at risk?
7. Should health states be named `healthy / at_risk / blocked`, or use `on_track / at_risk / blocked` for user-facing clarity?

## Initial Recommendations

- Add compact delivery health to project summary if project overview needs it; keep detailed review sections in planning summary.
- Treat manually blocked work and dependency-blocked work as `blocked` health reasons for milestones.
- Treat overdue work as `blocked` only when the milestone target date is also past or the overdue item is high/urgent; otherwise treat it as `at_risk`.
- Let unassigned active work affect milestone health when assigned to that milestone; otherwise it contributes to project-level health.
- Use both activity and updated timestamps for "recently changed," but keep the first implementation simple and deterministic.
- If a completed milestone has reopened work, show it as at risk with an explicit "completed milestone has open work" reason.
- Use user-facing labels `On track`, `At risk`, `Blocked`, `Complete`, and `Inactive`, while contract values can remain stable enum tokens.

## Completion Criteria

v0.0.9 is complete when:

- Planning shows project delivery health, milestone health, health reasons, and planning review sections;
- project overview shows a compact delivery health signal;
- dependency-blocked work contributes to health derivation;
- health reasons link back into filtered work item lists where possible;
- seeded data demonstrates meaningful health states;
- backend and frontend tests cover the health model and rendering;
- e2e smoke covers at least one health reason link;
- OpenAPI, README, product site, and extraction notes are updated;
- versions are updated to `0.0.9` if release finalization is in scope;
- full verification passes.
