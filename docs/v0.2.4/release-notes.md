# Worktrail v0.2.4 Release Notes

## Summary

Worktrail v0.2.4 adds Cycle Closeout and Carryover. Owners and maintainers can preview the current
scope of an active cycle, choose one planned destination or unplanned work for every unfinished
item, and apply completion plus carryover as one transactional operation.

The completed cycle retains an immutable, versioned result. Cycle Review presents that historical
evidence separately from links and risk details that reflect current work state.

## User-Facing Changes

- Added role-aware `Close cycle` entry points from Cycle Review, Planning, and cycle management.
- Added a dedicated closeout route with:
  - cycle identity, goal, date range, target, and delivery health;
  - completed, canceled, unfinished, committed-point, and unfinished-point totals;
  - scannable unfinished work with assignee, status, priority, estimate, and dependency signals;
  - planned same-project destination choices;
  - an explicit unplanned option that clears cycle assignment without changing workflow status.
- Added stable loading, retry, conflict-refresh, submission, and no-unfinished-work states.
- Added durable completed-cycle results with:
  - closing timestamp and actor;
  - target, committed, and completed points;
  - completed, canceled, retained, and moved counts;
  - carryover outcome and destination-cycle navigation;
  - bounded historical item groups with links to current work details.
- Labeled immutable closeout evidence as `Snapshot` and current linked context as `Live view`.
- Added honest legacy copy for completed cycles without closeout history.
- Added compact closeout outcomes to Planning.
- Restricted generic cycle controls so completed status is reached through closeout rather than a
  direct status update.
- Added an isolated seeded Closeout Lab for local walkthroughs.
- Corrected the global header layout at medium desktop widths after responsive screenshot review.

## Technical Changes

- Added shared preview, command, result, closeout, destination, count, and versioned snapshot
  contracts.
- Added `GET /api/projects/{projectId}/cycles/{cycleId}/closeout-preview`.
- Added `POST /api/projects/{projectId}/cycles/{cycleId}/closeout`.
- Added runtime snapshot parsing and relational identity validation before closeout data is returned.
- Added `project_cycle_closeouts` with relational workspace/project/cycle/actor/destination ownership,
  one-closeout-per-cycle uniqueness, close timestamps, and versioned JSONB evidence.
- Added a `cycle.closed` activity event and reused work-item cycle-change activity for moved items.
- Applied closeout in one transaction: persist evidence, complete the source cycle, update unfinished
  assignments, and create activity.
- Added matching-request idempotency and conflicting-request protection.
- Removed direct public transition paths into newly completed cycles while preserving valid metadata
  correction behavior for existing completed cycles.
- Added a dedicated serial Playwright workflow that restores deterministic seed state afterward.
- Updated README, OpenAPI, package metadata, and the static product site for the v0.2.4 baseline.

## Compatibility Notes

- Migration `0014_dapper_hellfire_club.sql` is required.
- Existing completed cycles remain readable and return `closeout: null` when they predate closeout
  history.
- Existing planned, active, canceled, and archived cycle reads remain compatible.
- Completed and canceled work remains assigned to the source cycle.
- Carryover changes only cycle assignment and update time; it does not change workflow status or
  other work item metadata.
- A selected destination remains planned and is not activated automatically.
- Closeout creates activity but does not introduce closeout-specific notifications.

## Verification

Phase-level verification is recorded in `docs/v0.2.4/implementation-plan.md`.

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

- Velocity, throughput, burndown, burnup, cumulative-flow, and cycle trend analytics.
- Forecasting, capacity calendars, and commitment recommendations.
- Scheduled or date-triggered closeout and automatic cycle rollover.
- Split carryover across multiple destination cycles in one closeout.
- Automatic workflow status, due date, milestone, assignee, label, priority, or estimate changes.
- Retrospective notes, votes, action items, approvals, and sign-off workflows.
- Cycle-level comments, watchers, subscriptions, reminders, and closeout notifications.
- Reopen, undo, or closeout snapshot editing.
- Cross-project and portfolio-level cycle mutation.
