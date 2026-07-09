# Worktrail v0.2.0 Release Notes

## Summary

Worktrail v0.2.0 is the Consolidated Operating Baseline release. It does not chase a large new feature area; it makes the v0.1.x product surface more coherent, easier to scan, and easier to maintain.

The release clarifies live planning versus published report snapshots, reduces default work-list control noise, makes project bulk triage an explicit mode, improves Work Item Detail hierarchy, consolidates shared risk-section assembly, validates persisted report snapshots, and refreshes the public site around the current product/reference baseline.

## User-Facing Changes

- Project shell navigation now labels the report area as `Reports` while preserving existing `/projects/:projectId/status` routes.
- Workspace and project work-list pages use clearer zones for saved views, filters, actions, and results.
- Saved-view creation now lives behind `Save view`.
- Saved-view administration now lives behind `Manage views`.
- Pinned saved-view shortcuts remain visible by default.
- Active filter chips continue to describe the applied query, not pending form edits.
- Project bulk triage now starts through an explicit `Bulk edit` mode.
- Selection controls are hidden until bulk edit mode is active.
- Planning and Milestone Review pages are labeled as live views.
- Reports are framed as published snapshots.
- Report drafts split generated evidence from editable narrative.
- Planning includes a bridge to published reports and draft report creation when the selected actor can publish.
- Published report share/export actions are grouped together.
- Work Item Detail is reorganized around Summary, Act, Collaborate, Dependencies, and History.
- Watcher controls are closer to collaboration context.
- Dependency alerts are more prominent when work is blocked by open work or blocking downstream open work.
- The static public site presents Worktrail as a coherent v0.2.0 product/reference baseline instead of a sprint chronology.

## Technical Changes

- Updated first-party package metadata to `0.2.0`.
- Added shared work-list query state through `WorkListQueryStore`.
- Added shared saved-view orchestration through `SavedViewsStore`.
- Added project bulk edit state through `ProjectBulkTriageStore`.
- Consolidated Planning, Milestone Review, and Report risk-section assembly in `apps/api/src/services/work-risk-sections.ts`.
- Added versioned runtime parsing for persisted project report snapshots in `apps/api/src/validation/project-status-report-snapshot.ts`.
- Invalid persisted report snapshots now return controlled API errors instead of surfacing unhandled runtime failures.
- Kept report route paths and API contracts stable.
- Preserved existing saved-view, copy-link, return-URL, CSV export, and query semantics.
- Cleared the production build style budget warning introduced during the Planning-to-Reports bridge work.

## Compatibility Notes

- No database schema migration is required for v0.2.0.
- Existing `/projects/:projectId/status` routes remain valid.
- OpenAPI route and DTO contracts remain accurate; no route-level OpenAPI update was required for this consolidation phase.
- Local setup remains unchanged: install dependencies, start Postgres, migrate, seed, then run the API and Angular app.

## Verification

Phase-level verification is recorded in `docs/v0.2.0/implementation-plan.md`.

Recommended release checks:

```sh
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

## Deferred

- Production authentication and external deployment assets.
- Report edits, approvals, scheduled delivery, recipients, public links, PDF generation, and export history.
- Query-wide bulk mutation and cross-project bulk edit.
- Custom workflows, custom health formulas, forecasting, capacity planning, roadmap views, and critical path analysis.
- Saved-view folders, custom ordering, icons, ownership transfer, and analytics.
