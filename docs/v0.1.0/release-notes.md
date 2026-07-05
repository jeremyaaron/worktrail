# Worktrail v0.1.0 Release Notes

## Summary

Worktrail v0.1.0 is a consolidation release. It turns the v0.0.x feature set into a clearer product baseline with stronger navigation, planning hierarchy, work discovery, mobile scanning, code ownership seams, and release guardrails.

The release does not introduce production authentication, hosted infrastructure, or a new product pillar. It improves the experience and maintainability of the existing local-first reference app.

## Product Highlights

- Promoted cross-project work discovery to a top-level `Work Items` destination.
- Added a persistent project shell with project identity, status, delivery health, and consistent `Overview`, `Work`, `Board`, `Planning`, and `Settings` sections.
- Reworked planning into review-first `Review` and milestone-administration `Milestones` views.
- Improved My Work with a prioritized daily queue and explicit full-list links from summary filters.
- Added mobile work item cards so narrow screens do not require interpreting clipped table columns.
- Preserved active filter chips above results and made dense filters compact on mobile.
- Kept saved-view management behind an explicit `Manage saved views` disclosure.
- Improved work item detail return context, summary, comments, relationships, activity, and safe return URL handling.

## Technical Highlights

- Split shared contracts by domain while preserving the `@worktrail/contracts` export surface.
- Consolidated work item query parsing, normalization, frontend serialization, active labels, and repository predicate construction.
- Added a shared backend work-risk policy module for due-soon, overdue, stale, open, and active-unassigned rules.
- Split Express route registration by domain while preserving transport-neutral endpoint handlers.
- Split frontend API calls into domain clients over a shared request utility.
- Extracted feature-local UI components for work item filters, result lists, saved views, planning review, My Work, and detail panels.
- Added low-churn ESLint coverage for API, web, and contracts.
- Added GitHub Actions CI for pull requests and pushes to `main`.

## Documentation And Site

- Refreshed the README around the v0.1.0 baseline.
- Updated the operations runbook with CI/lint verification guidance.
- Added v0.1.0 jawstack extraction notes.
- Refreshed the static product site around grouped workflows, baseline value, architecture, operations, and limitations.

## Verification

Final local verification for this release candidate:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
git diff --check
```

Playwright smoke tests reset, migrate, seed, and restore the local Postgres database.

## Known Limitations

- Authentication remains local actor selection and request-header scaffolding.
- Saved views remain personal only.
- CSV import remains project-scoped.
- Relationships are limited to `blocks` and `relates_to`.
- Delivery health is deterministic and rule-based, not configurable forecasting.
- The local Express adapter is the only runtime adapter.
- AWS deployment assets are not included yet.
