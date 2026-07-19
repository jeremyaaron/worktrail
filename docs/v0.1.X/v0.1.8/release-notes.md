# Worktrail v0.1.8 Release Notes

## Summary

Worktrail v0.1.8 adds Project Status Reports: a project-scoped workflow for generating an editable status update from current project state, publishing an immutable report snapshot, and reading report history with live links back into current milestone review, project Work, and work item detail pages.

## User-Facing Changes

- Added project Status pages at:
  - `/projects/:projectId/status`;
  - `/projects/:projectId/status/new`;
  - `/projects/:projectId/status/:reportId`.
- Added a project-shell Status navigation item.
- Added a status report list page with:
  - latest report highlight;
  - previous report list;
  - owner/maintainer create action;
  - contributor and archived-project absence copy.
- Added generated status report drafts for active projects.
- Drafts include current snapshot context for:
  - project identity;
  - delivery health;
  - health reasons;
  - work counts;
  - active/planned milestone snapshots;
  - risk sections;
  - recent work.
- Owners and maintainers can edit report title, status date, summary, highlights, risks, and next steps before publishing.
- Published report detail pages show:
  - metadata, author, status date, published timestamp, and snapshot timestamp;
  - summary, highlights, risks, and next steps;
  - health and reason chips;
  - count summary;
  - milestone snapshots;
  - risk sections;
  - recent work.
- Published report pages clarify that displayed values are the stored snapshot while links open current project data.
- Milestone snapshot rows link to current milestone review pages.
- Risk sections link to current filtered project Work pages.
- Work item preview rows link to current work item detail pages with return URLs back to the report.
- Contributors can read published reports.
- Archived projects can read existing reports but cannot publish new reports.
- Seed data now includes one published Worktrail App status report.

## Technical Changes

- Added shared project status report contracts in `@worktrail/contracts`.
- Added `status_report.published` project activity type.
- Added `project_status_reports` Postgres table with JSONB snapshot storage.
- Added Drizzle migration and repository support for status report create/list/detail/latest access.
- Added `ProjectStatusReportService` with:
  - draft generation;
  - snapshot generation;
  - publish validation;
  - immutable report creation;
  - project activity insertion;
  - contributor/archived read behavior.
- Added transport-neutral endpoint handlers and Express routes:
  - `GET /api/projects/:projectId/status-reports`;
  - `GET /api/projects/:projectId/status-reports/draft`;
  - `POST /api/projects/:projectId/status-reports`;
  - `GET /api/projects/:projectId/status-reports/:reportId`.
- Updated OpenAPI for report routes, DTOs, request shape, local actor headers, and errors.
- Added Angular API client support, lazy routes, list page, draft page, and detail page.
- Seed generation uses the report service with deterministic clock/id injection so seeded report snapshots follow the production publish path.
- Added API, contract, Angular component, and Playwright coverage for the status report workflow.

## Limitations

- Published reports are immutable.
- No post-publication edits, report delete/archive, scheduled delivery, email/push distribution, exports, approvals, comments, custom templates, workspace rollups, forecasting, or roadmap reporting.
- Generated drafts are not autosaved.
- Report links intentionally open current project data, which may differ from the stored snapshot values.
- Status reports remain project-scoped; there is no workspace-level reporting dashboard.

## Verification

Final release verification is recorded in `docs/v0.1.8/implementation-plan.md`.
