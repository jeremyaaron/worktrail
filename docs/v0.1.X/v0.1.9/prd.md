# Worktrail v0.1.9 PRD

## Summary

Worktrail v0.1.9 should make published project status reports easier to share, reuse, and trust outside the immediate report detail page.

v0.1.8 added Project Status Reports:

- generated drafts from current project state;
- editable narrative fields;
- immutable published snapshots;
- report history;
- contributor read access;
- live links from historical reports into current project Work, milestone review, and work item detail pages.

That made Worktrail stronger as a coordination app, but a status report is only fully useful when it can leave the app cleanly. A project maintainer should be able to publish a report, copy it into a meeting note or update thread, print it for review, or download a durable text artifact without manually reformatting the page.

The product theme is Status Report Sharing. The release should add practical export and sharing affordances for published status reports while staying narrow:

- copy a report as Markdown;
- download a report as Markdown;
- provide print-friendly report rendering;
- expose a server-rendered Markdown export route for stable automation and future adapters;
- keep the exported content faithful to the immutable report snapshot;
- keep live app links available where they make sense.

This sprint should not become email delivery, PDF generation, approval workflow, stakeholder subscriptions, or a generic report rendering platform.

## Context

Worktrail now supports:

- project status report creation and immutable report history;
- generated report snapshots with project health, milestone, risk, and recent-work context;
- query-backed links from reports into current project Work;
- milestone review pages;
- reliable filtered Work URLs;
- copy-link behavior for filtered views;
- CSV import/export for work item result sets;
- OpenAPI and deterministic seed data.

The app already has a pattern for portable work data through CSV export and shareable navigation through canonical URLs. Status reports need a different kind of portability: human-readable, structured text that preserves the published narrative and snapshot values.

Markdown is the right first export format because it is low infrastructure, easy to inspect, easy to paste into GitHub, Slack, email, docs, tickets, and meeting notes, and does not require a binary rendering pipeline.

## Problem

Published status reports are durable inside Worktrail, but they are not yet portable.

Current friction:

- a maintainer must manually select and format report sections to share them elsewhere;
- copied browser text includes UI noise and loses hierarchy;
- there is no stable file artifact for a published report;
- print output likely includes navigation and layout chrome that are not useful in a report packet;
- future cloud/deployment patterns lack evidence for non-JSON endpoint responses tied to immutable application records;
- OpenAPI documents the status report JSON API, but there is no report export surface.

This limits adoption. Teams often communicate status in external channels even when the source of truth lives in a project tool.

## Goals

- Add a clean Markdown representation for each published project status report.
- Let users copy a report as Markdown from the report detail page.
- Let users download a report as a `.md` file from the report detail page.
- Add a server-side Markdown export endpoint for published reports.
- Ensure exported content is based on the stored report snapshot, not recomputed current state.
- Include useful links back into Worktrail for current follow-up:
  - project;
  - milestone review;
  - risk-filtered project Work;
  - work item detail.
- Make the report detail page print-friendly.
- Preserve role and archive rules:
  - owners, maintainers, and contributors can export reports they can read;
  - archived project reports remain exportable;
  - unpublished drafts cannot be exported.
- Keep report copy/download controls role-neutral for readers.
- Add deterministic seed and Playwright coverage for the export/copy/print affordances.
- Update OpenAPI, README, public site if warranted, release notes, and destination-neutral pattern notes.

## Non-Goals

- Do not add PDF generation.
- Do not add email, Slack, webhook, RSS, calendar, or scheduled delivery.
- Do not add report subscriptions, recipients, or notification preferences.
- Do not add report approval, acknowledgement, sign-off, or comment workflows.
- Do not add rich-text editing.
- Do not add custom report templates.
- Do not add workspace-wide rollup reports.
- Do not add public unauthenticated report links.
- Do not add short links.
- Do not add export history.
- Do not add report analytics.
- Do not make published reports editable.
- Do not create a generic document rendering framework unless the technical design finds a very small helper that removes real duplication.

## Target Users

### Project Maintainer

Wants to publish a status report, copy it into a stakeholder update, download it into project notes, or print it for a review meeting without reformatting the content manually.

### Workspace Owner

Wants teams to share consistent status updates while keeping Worktrail as the source of truth for the report snapshot.

### Contributor

Wants to read or copy the latest status report without needing owner/maintainer permissions.

### Stakeholder Reader

In the current local app, this maps to an active member who can read a report URL. They want a clear status artifact that can be pasted into the communication channel they already use.

### Reference-App Developer

Wants product evidence for immutable-record exports, deterministic text rendering, non-JSON endpoint responses, clipboard UX, download flows, and print-specific UI polish.

## Product Principles

- **Portable, not distributed:** v0.1.9 should help users move report content, not deliver it to recipients automatically.
- **Snapshot fidelity first:** exported report values must match the published snapshot.
- **Links remain current:** exported reports can include links that open current Worktrail pages for follow-up.
- **Markdown before binary:** structured text is enough to prove value without a PDF/rendering service.
- **Readable outside the app:** the exported content should stand on its own when pasted into a document or message.
- **Reader controls are safe:** anyone who can read a report should be able to copy, download, or print it.
- **Keep future delivery optional:** the export shape should not force email, Slack, or template abstractions prematurely.

## Scope

### 1. Report Markdown Contract

Define a deterministic Markdown representation for `ProjectStatusReportDetailDto`.

Requirements:

- Include report metadata:
  - title;
  - project key and name;
  - status date;
  - health state;
  - author;
  - published timestamp;
  - snapshot timestamp.
- Include narrative sections:
  - summary;
  - highlights;
  - risks;
  - next steps.
- Include snapshot sections:
  - health reasons;
  - count summary;
  - milestone snapshots;
  - risk sections;
  - recent work.
- Include a short note that counts and listed values are the published snapshot.
- Include Worktrail links for:
  - project;
  - milestone rows;
  - risk sections;
  - work item rows.
- Ensure empty optional narrative sections render cleanly.
- Ensure Markdown escaping handles user-entered titles, narrative text, milestone names, and work item titles.
- Keep the first format stable and simple enough to test with exact assertions.

Acceptance criteria:

- The same report always produces the same Markdown output except for configured base URL changes.
- Exported Markdown is readable without Worktrail UI context.
- Exported Markdown includes snapshot values and does not recompute report state.
- Links are valid relative or absolute Worktrail URLs, as defined by the technical design.

### 2. Markdown Export API

Add a report Markdown export endpoint.

Candidate route:

```text
GET /api/projects/:projectId/status-reports/:reportId/export.md
```

Requirements:

- Reuse existing report read permission behavior.
- Return `text/markdown; charset=utf-8`.
- Return a useful `Content-Disposition` filename for downloads.
- Use the stored published report.
- Return not found for report/project mismatches.
- Preserve archived-project read/export behavior.
- Add OpenAPI documentation for the endpoint.

Acceptance criteria:

- Owners, maintainers, and contributors can export reports they can read.
- Archived project reports can be exported.
- The endpoint does not expose reports across project or workspace boundaries.
- The response body matches the deterministic Markdown contract.

### 3. Report Detail Copy And Download Controls

Add reader-facing sharing controls to the report detail page.

Requirements:

- Add `Copy Markdown` action.
- Add `Download Markdown` action.
- Keep controls visible for any actor who can read the report.
- Show clear success/failure feedback for copy.
- Use browser clipboard APIs with the existing fallback pattern where appropriate.
- Download the server-rendered Markdown file, not a client-only approximation.
- Keep actions out of the print output.
- Avoid cluttering the report hero on mobile.

Acceptance criteria:

- A reader can copy the report Markdown and see success feedback.
- A reader can download a `.md` file.
- Contributor paths show copy/download controls without create/publish controls.
- Copy and download do not mutate the report.
- The UI remains usable at common desktop and mobile widths.

### 4. Print-Friendly Report Detail

Make published report detail pages suitable for browser printing.

Requirements:

- Add print CSS that removes:
  - global app navigation;
  - project shell navigation;
  - action buttons;
  - non-report chrome.
- Preserve:
  - report title and metadata;
  - narrative sections;
  - health/count summaries;
  - milestones;
  - risk sections;
  - recent work.
- Ensure links remain visible enough for printed/PDF output where practical.
- Avoid page-breaking inside compact report cards where feasible.

Acceptance criteria:

- Browser print preview shows a report-focused artifact rather than the full app shell.
- Report content is not clipped or overlapped.
- The printable page still identifies that values are from a published snapshot.

### 5. Seed, Smoke, And Documentation

Update release surface and tests.

Requirements:

- Reuse the seeded v0.1.8 Worktrail App status report for export smoke tests.
- Add Playwright coverage for:
  - opening a seeded report;
  - copying Markdown;
  - downloading Markdown;
  - verifying downloaded content includes report title, snapshot note, counts, and a link;
  - contributor export path;
  - mobile layout sanity if sharing controls affect responsive layout.
- Add API tests for the Markdown endpoint.
- Add focused unit tests for Markdown rendering/escaping.
- Update README and public site if product copy should mention status report sharing.
- Add release notes and destination-neutral pattern notes.

Acceptance criteria:

- Fresh seed data supports report export smoke coverage.
- API, unit, and Playwright tests cover the export path.
- Documentation accurately describes implemented capabilities and limitations.

## Data And API Requirements

v0.1.9 should not require a new database table.

Expected API addition:

```text
GET /api/projects/:projectId/status-reports/:reportId/export.md
```

Potential implementation details for the technical design:

- Add a small `StatusReportMarkdownRenderer` or equivalent service function.
- Keep rendering deterministic and server-side.
- Accept a base URL/config value only if needed for absolute links.
- Use existing report read service behavior for authorization and archived-project handling.
- Return raw text through the transport-neutral endpoint response shape if current handlers support it; otherwise extend the response shape narrowly for text responses.

## UX Requirements

- Sharing controls should sit near report-level actions, likely beside `Back to status`.
- Controls should be labelled plainly:
  - `Copy Markdown`;
  - `Download Markdown`;
  - `Print`.
- Feedback should be short and non-disruptive.
- Failure copy should be actionable but not noisy:
  - `Could not copy report Markdown.`;
  - `Could not download report Markdown.`
- Long report titles and long work item names must not overflow the action layout.
- On mobile, controls may wrap into a compact action row.
- Print styles should prioritize clean content over exact visual parity with the app.

## Security And Permissions

- Export permissions match report detail read permissions.
- Local actor headers remain development-only behavior.
- No public unauthenticated report URLs.
- Do not trust client-supplied role data.
- Do not expose reports across workspaces or project ids.
- Download filename should be sanitized and deterministic.
- Markdown escaping should prevent malformed output from user-entered report fields.

## Observability And Activity

- Do not add activity events for copy/download/print in v0.1.9.
- Do not add export history.
- Existing `status_report.published` activity remains the durable report lifecycle event.

## Open Questions

1. Should exported links be relative app paths or absolute URLs?
2. Should the API use `Content-Disposition: attachment` by default, or let the UI drive download behavior?
3. Should the detail page include a visible `Print` button, or rely on browser print after adding print styles?
4. Should Markdown include all risk sections or only non-empty sections?
5. Should recently changed work include all stored recent work or remain capped exactly as the snapshot stores it?

## Recommended Answers

- Use relative links in Markdown unless a base URL configuration already exists or can be added without widening deployment scope. Relative links are stable for local and future single-origin deployments.
- Return `Content-Disposition: attachment` with a deterministic filename from the export endpoint.
- Include a visible `Print` button on the report detail page because it makes the new print polish discoverable.
- Include all risk sections with concise empty states, matching the report detail page and preserving snapshot structure.
- Use exactly the stored recent work in the snapshot. Do not expand or recompute the report.

## Success Criteria

- A maintainer can publish a report, copy Markdown, paste it elsewhere, and retain clear structure.
- A contributor can open a published report and download the Markdown artifact.
- Exported Markdown includes narrative, metadata, snapshot counts, milestones, risks, recent work, and useful Worktrail links.
- Browser print output is report-focused and omits app/navigation chrome.
- API and Playwright coverage prove export behavior from deterministic seed data.
- No new persistence is required.
- OpenAPI and release docs match the implemented export surface.

## Out Of Scope For Future Consideration

These remain intentionally deferred:

- PDF generation;
- scheduled report delivery;
- email/Slack/webhook integrations;
- external public report links;
- report recipients and subscriptions;
- approval/sign-off workflows;
- report comments;
- report templates;
- workspace rollups;
- report analytics;
- report edit/correction workflows;
- generic document rendering infrastructure.
