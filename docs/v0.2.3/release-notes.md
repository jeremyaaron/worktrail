# Worktrail v0.2.3 Release Notes

## Summary

Worktrail v0.2.3 adds Workspace Portfolio Review: a read-only, top-level operating surface for comparing active project health, communication freshness, current execution context, and dependency pressure.

Portfolio helps a workspace maintainer decide where to look first without opening every project. It reuses existing Worktrail delivery-health, planning, cycle, report, dependency, and query-link behavior rather than creating a separate portfolio management model.

## User-Facing Changes

- Added primary navigation entry and lazy route at `/portfolio`.
- Added active-project summary counts for:
  - active projects;
  - on-track projects;
  - at-risk projects;
  - blocked projects;
  - overdue projects;
  - dependency-pressure projects;
  - stale or missing report projects.
- Added bounded attention sections for:
  - Needs attention;
  - Communication freshness;
  - Current execution;
  - Dependency pressure.
- Added project comparison rows with:
  - delivery health and top health reasons;
  - open, blocked, dependency-blocked, and overdue work counts;
  - report freshness and latest report details;
  - active milestone and active cycle context;
  - links into Overview, Work, Planning, Reports, latest report, milestone review, cycle review, and risk-specific filtered Work views.
- Added seeded `Reference Operations` project to demonstrate a healthy active project beside blocked and dependency-heavy projects.
- Added focused Playwright coverage for Portfolio read-and-drill behavior.

## Technical Changes

- Added shared Portfolio DTO contracts in `@worktrail/contracts`.
- Added Angular API client/facade support for `GET /api/portfolio`.
- Added `PortfolioService` as a derived read model over existing repositories.
- Reused `DeliveryHealthService` for project health semantics.
- Kept Portfolio read-only and avoided database migrations.
- Added transport-neutral endpoint handler and Express route for `GET /api/portfolio`.
- Updated OpenAPI with the Portfolio route and nested response schemas.
- Split the Portfolio UI into focused child components to keep component style budgets clear:
  - summary strip;
  - attention sections;
  - project comparison rows;
  - shared display/link helpers.
- Converted Portfolio drill-down links through existing `WorkItemQuery` router serialization using each link's query scope.
- Updated README and static product site for the v0.2.3 baseline.
- Updated first-party package metadata to `0.2.3`.

## Compatibility Notes

- No database migration is required.
- Existing project, work item, planning, cycle, milestone, status report, saved view, and dependency APIs remain compatible.
- Portfolio excludes archived projects from its primary review.
- Report freshness is treated as a communication signal, not as delivery health.
- Portfolio links open existing Worktrail surfaces and do not introduce new mutation paths.
- Seed data now includes one additional active project and one additional published status report.

## Verification

Phase-level verification is recorded in `docs/v0.2.3/implementation-plan.md`.

Recommended release checks:

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
```

## Deferred

- Portfolio filters and custom sorting.
- Portfolio charts or trend visualization.
- Portfolio export.
- Stored portfolio snapshots.
- Historical portfolio review.
- Portfolio-level comments, subscriptions, or notifications.
- Cross-project bulk mutation from Portfolio.
- Forecasting, roadmap reporting, and critical path analysis.
