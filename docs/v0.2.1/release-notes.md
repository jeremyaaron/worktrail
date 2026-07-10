# Worktrail v0.2.1 Release Notes

## Summary

Worktrail v0.2.1 adds Cycle Planning: project-scoped, methodology-neutral execution windows that sit alongside milestones without replacing them.

Teams can now create and manage cycles, assign work into a cycle, filter and save cycle-backed work views, review current cycle health and risk, and publish project status reports that preserve active-cycle context.

The release also includes a work item detail navigation reliability fix and a late Planning page component extraction that cleared the production style budget warning without raising budgets.

## User-Facing Changes

- Planning now includes cycle summaries for active, upcoming, and recently completed cycles.
- Owners and maintainers can create, update, archive, and reactivate cycles from Planning.
- Contributors can read cycle lists and cycle reviews without mutation controls.
- Cycle review pages are available at `/projects/:projectId/cycles/:cycleId`.
- Cycle review shows target progress, committed and completed estimate points, scope breakdown, health, risk sections, and recently changed cycle work.
- Work items can be assigned to a cycle from create, detail edit, and project bulk triage flows.
- Project and workspace work lists support cycle filters.
- Cycle filters participate in active chips, URL reloads, copy links, saved views, pinned views, return URLs, and CSV export.
- Project status report drafts include active-cycle context when a project has an active cycle.
- Published reports preserve cycle snapshot data and render it on detail, Markdown copy, and Markdown download paths.
- Seed data now includes active, upcoming, and completed Worktrail App cycles, plus cycle-scoped risk examples.
- Static public site and README copy now describe the v0.2.1 cycle-aware baseline.

## Bug Fixes And Reliability

- Fixed same-route work item detail navigation so opening a related/blocking work item from `/work-items/:id` updates the page when only the route parameter changes.
- Cleared the `project-planning-page.component.ts` production style budget warning by extracting cycle management and cycle summary rendering into focused Planning child components.
- Cleared the pg seed deprecation warning by avoiding concurrent queries on the same transaction client during cycle review generation inside status report publishing.
- Cleaned E2E subprocess environment handling so Playwright DB setup and server subprocesses do not inherit conflicting `NO_COLOR` and `FORCE_COLOR` settings.

## Technical Changes

- Added shared cycle contracts and review DTOs in `@worktrail/contracts`.
- Added `project_cycles` persistence and nullable `work_items.cycle_id`.
- Added cycle repository, service lifecycle validation, review read model, endpoint handlers, Express routes, and OpenAPI documentation.
- Enforced one active non-archived cycle per project.
- Enforced non-overlapping non-archived planned/active cycle ranges at the service layer.
- Added work item cycle assignment validation, activity, notifications where existing policy applies, and bulk `set_cycle`/`clear_cycle` actions.
- Added cycle-aware query serialization, filter labels, saved-view summaries, pinned-view behavior, and CSV export fields.
- Added Angular cycle API client, shared cycle display helpers, cycle options helper, cycle manager component, cycle summary panel component, and cycle review page.
- Added status report cycle snapshot parsing, rendering, and Markdown export support while keeping snapshot version `1` because the cycle section is optional and additive.
- Updated first-party package metadata to `0.2.1`.

## Compatibility Notes

- A database migration is required for `project_cycles` and `work_items.cycle_id`.
- Existing work items migrate with no cycle assignment.
- Existing status report snapshots remain readable without cycle sections.
- Existing saved views continue to load without cycle filters.
- CSV export includes cycle fields, but CSV import does not assign cycles in v0.2.1.
- Cycle review is live current state; published report cycle sections are immutable snapshots.
- Local setup remains the same: install dependencies, start Postgres, migrate, seed, and run the app.

## Verification

Phase-level verification is recorded in `docs/v0.2.1/implementation-plan.md`.

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
git diff --check
```

## Deferred

- CSV import cycle assignment.
- Velocity, forecasting, burndown, rollover automation, ceremony management, and member capacity calendars.
- Cycle templates, custom cycle fields, and cycle notification rules.
- Cross-project cycles or workspace-wide planning cycles.
- Production authentication and external deployment assets.
- Report edits, approvals, scheduled delivery, recipients, public links, PDF generation, and export history.
