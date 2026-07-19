# Worktrail v0.1.6 Release Notes

## Summary

Worktrail v0.1.6 adds Project Batch Triage: owner and maintainer users can select visible rows on a project Work page and apply one common update to the selected project work items.

The release builds on reliable filtered views, project saved views, and pinned project operating lenses. Those lenses can now be used as an action surface instead of only a review surface.

Batch triage is intentionally scoped to one project. Labels and milestones are project-local, and keeping the first batch workflow project-scoped avoids cross-project ambiguity while still covering high-value triage tasks.

## Product Highlights

- Added multi-select checkboxes to project Work list rows and mobile cards.
- Added select-all-visible behavior for the currently loaded project result set.
- Added a compact bulk action bar that appears when project rows are selected.
- Supported project bulk actions for:
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
- Added structured result feedback for updated, unchanged, and failed rows.
- Kept failed rows selected when they remain visible after reload.
- Cleared successful and unchanged selections after completion.
- Confirmed multi-item status transitions before submission.
- Hid selection and batch mutation controls from contributor paths.
- Hid selection and batch mutation controls for archived projects.
- Preserved project filters, saved views, pinned views, copy links, CSV export, and detail return URLs.

## Technical Highlights

- Added `BulkUpdateWorkItemsAction`, `BulkUpdateWorkItemsRequest`, and `BulkUpdateWorkItemsResponseDto` contract types.
- Added `POST /api/projects/{projectId}/work-items/bulk-update`.
- Added strict endpoint validation for request shape, duplicate work item ids, duplicate label ids, label count, request count, and due-date format.
- Capped bulk update requests at 50 work item ids.
- Required owner or maintainer role for all bulk mutations.
- Reused project writability, assignee, milestone, label, workflow transition, activity, and notification rules from single-item paths.
- Added `work_item.due_date_changed` activity coverage for due-date edits.
- Returned per-item result rows in request order with `updated`, `unchanged`, or `failed` status.
- Treated unchanged rows as successful without timestamp, activity, or notification churn.
- Added Angular API client support for the bulk endpoint.
- Added project Work page local selection state, request serialization, result reconciliation, and failure recovery.
- Added focused contract, API, OpenAPI, web component, web page, and Playwright coverage.

## Documentation And Site

- Updated README capability, walkthrough, limitation, and API descriptions for project batch triage.
- Updated the static product site to present v0.1.6 as the current baseline.
- Added destination-neutral pattern notes for temporary selection state, explicit batch commands, partial-success envelopes, and side-effect boundaries.
- Confirmed OpenAPI already documents the bulk update endpoint and schemas.

## Verification

Final local verification for this release candidate:

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run test:e2e
git diff --check
git status --short --branch
```

The Playwright suite includes browser coverage for selecting seeded project rows, applying a project bulk label action, verifying result counts, verifying updated list rows, and confirming contributor absence paths.

## Known Limitations

- Batch triage is project-scoped only.
- Workspace-wide bulk edit is deferred.
- Board bulk actions are deferred.
- Bulk delete, bulk comments, bulk relationship editing, and bulk imports beyond CSV import are deferred.
- Selection is temporary page interaction state and is cleared on filter/query/saved-view changes.
- Selection is explicit visible-row selection only; query-wide durable selections are deferred.
- Bulk status transitions use existing workflow rules and may partially fail by row.
- Bulk labels depend on project label options available to the project Work page.
- Authentication remains local actor selection and request-header scaffolding.
- The local Express adapter remains the only runtime adapter.
