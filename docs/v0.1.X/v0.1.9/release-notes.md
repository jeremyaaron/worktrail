# Worktrail v0.1.9 Release Notes

## Summary

Worktrail v0.1.9 adds Status Report Sharing. Published project status reports can now be copied as Markdown, downloaded as Markdown, and printed from a report-focused browser layout.

The release keeps reports lightweight and portable. Markdown is rendered server-side from the immutable published report snapshot, while links in the export continue to open current Worktrail project, milestone, work, and work item pages.

## User-Facing Changes

- Added `Copy Markdown` on published status report detail pages.
- Added `Download Markdown` on published status report detail pages.
- Added `Print` on published status report detail pages.
- Added success and failure feedback for copy and download actions.
- Added print-focused report detail styling that hides app chrome and action controls.
- Markdown exports include:
  - report title and metadata;
  - published snapshot notice;
  - summary, highlights, risks, and next steps;
  - snapshot counts;
  - delivery-health reasons;
  - milestone snapshots;
  - risk sections;
  - recent work;
  - relative Worktrail links for follow-up.
- Contributors can copy, download, and print reports they can read.
- Existing reports for archived projects remain readable and exportable.

## Technical Changes

- Added a pure API-side Markdown renderer for `ProjectStatusReportDetailDto`.
- Added deterministic Markdown filename generation.
- Added project work item query link serialization for project-scoped status report risk links.
- Added `GET /api/projects/:projectId/status-reports/:reportId/export.md`.
- The export endpoint returns:
  - `text/markdown; charset=utf-8`;
  - `Content-Disposition: attachment`;
  - raw Markdown response body.
- Reused existing report read permissions and archived-project read behavior for export.
- Updated OpenAPI with the Markdown export route and non-JSON response content.
- Added Angular API client support for the Markdown blob response.
- Reused existing clipboard and download helpers in the report detail UI.
- Added Playwright smoke coverage for seeded report copy/download/contributor/mobile paths.

## Limitations

- No PDF generation.
- No scheduled delivery, email, Slack, webhook, RSS, or subscription workflow.
- No recipients, approvals, acknowledgements, comments, or report sign-off.
- No custom report templates.
- No public unauthenticated links or short links.
- No export history or analytics.
- Published reports remain immutable.

## Verification

Final release verification is recorded in `docs/v0.1.9/implementation-plan.md`.
