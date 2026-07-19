# Worktrail v0.1.7 Release Notes

## Summary

Worktrail v0.1.7 adds Milestone Review: a focused project-shell page for reviewing one milestone's current delivery state. The release turns existing planning, health, risk, dependency, and work-item query capabilities into a deeper review surface without adding persisted snapshots or new milestone workflow administration.

## User-Facing Changes

- Added milestone review pages at `/projects/:projectId/milestones/:milestoneId`.
- Added Planning links from milestone rows and milestone review items into the focused milestone review page.
- Added milestone review summary content:
  - milestone identity, project identity, lifecycle state, and target date;
  - progress counts and completion percentage;
  - delivery-health label and reason chips;
  - scope breakdowns for status, priority, ownership, due dates, and dependencies;
  - deterministic risk sections with capped preview rows;
  - recently changed milestone work.
- Added risk section links from milestone review into filtered project Work.
- Added visible project Work chips for review-driven risk filters:
  - `Risk: Unassigned active`;
  - `Risk: Stale in progress`.
- Preserved owner/maintainer project batch triage on filtered Work pages opened from milestone review.
- Preserved contributor read-only behavior for milestone review and filtered Work destinations.
- Hardened milestone review wrapping at desktop and mobile widths.

## Technical Changes

- Added shared milestone review DTOs in `@worktrail/contracts`.
- Added `WorkItemRiskFilter` and optional `workRisk` support to `WorkItemQuery`.
- Added API query parsing and repository filtering for:
  - `workRisk=unassigned_active`;
  - `workRisk=stale_in_progress`.
- Added `MilestoneReviewService` as a derived read-model service.
- Added `GET /api/projects/:projectId/milestones/:milestoneId/review`.
- Reused existing delivery-health derivation and risk-policy constants instead of duplicating milestone health rules.
- Added Angular API client support, lazy route registration, and milestone review page rendering.
- Preserved `workRisk` through project Work URL parsing, active chips, copy links, CSV export, and detail return URLs.
- Updated OpenAPI for the milestone review route, DTOs, and `workRisk` query parameter.
- Added API, contract, Angular component, query-helper, and Playwright coverage for the review workflow.

## Limitations

- Milestone review is current-state only.
- No persisted review snapshots are created.
- Forecasting, capacity planning, roadmap views, critical path analysis, milestone sign-off, custom health formulas, review history, and review notifications remain out of scope.
- `workRisk` is intentionally a URL/action-link filter in v0.1.7, not a visible advanced filter control.

## Verification

Final release verification is recorded in `docs/v0.1.7/implementation-plan.md`.
