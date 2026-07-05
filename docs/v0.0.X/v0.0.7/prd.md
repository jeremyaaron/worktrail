# Worktrail v0.0.7 PRD

## Summary

Worktrail v0.0.7 should make the application easier to adopt with real team data. v0.0.6 made Worktrail operationally credible by adding production preview, runtime validation, health/readiness, OpenAPI documentation, and an operator runbook. The next release should improve the path from "this looks useful" to "I can try this with my actual work."

The v0.0.7 theme is:

> Make Worktrail portable and easy to seed with real work.

This sprint should add a focused data portability slice: CSV work item import, CSV work item export, import dry-run validation, and operator/user documentation. It should not become a full migration platform, background job system, or third-party integration sprint. The goal is to lower adoption friction while exposing reusable patterns for file ingestion, bulk validation, transactional writes, user-facing error reports, and future cloud upload flows.

## Context

Worktrail is both a product and a reference application. It should continue to become a credible project tracker while revealing implementation patterns that may later inform `jawstack` and deployable reference solutions.

The current product has:

- Angular SPA frontend with lazy-loaded route components;
- TypeScript API with local Express adapter and transport-neutral endpoint handler structure;
- production-like local preview from built artifacts;
- runtime configuration validation;
- liveness and database readiness endpoints;
- checked-in OpenAPI reference;
- operator runbook;
- Postgres persistence through Drizzle migrations;
- deterministic seed data;
- My Work dashboard;
- cross-project work discovery;
- personal saved views;
- route-based quick work capture;
- project navigation summaries;
- workspace settings and member lifecycle administration;
- server-derived local actor roles backed by active workspace members;
- project settings, labels, milestones, planning dashboard, board, comments, and activity;
- archived-project write protection;
- Playwright smoke coverage across daily workflow, governance, planning, preview, and responsiveness;
- static GitHub Pages product site.

The app is now credible enough to evaluate seriously. The next adoption barrier is data entry. A user can create projects and work items manually, but importing existing work remains awkward. Teams evaluating a project tracker usually want to bring in a sample backlog, test workflow fit, and know they can get data back out.

## Problem

Worktrail currently relies on manual creation and deterministic seed data. That is enough for development, demos, and workflow QA, but it is not enough for realistic adoption evaluation.

Current gaps:

- There is no way to import a backlog from a spreadsheet or another tracker export.
- There is no dry-run validation report that tells users what will fail before data is written.
- There is no supported export path for work item data.
- Evaluators cannot easily prove data portability.
- Bulk data errors would currently need to be debugged row by row through manual entry.
- The product has not exercised file parsing, bulk validation, partial failure reporting, or transactional bulk writes.
- The future cloud path will need upload/ingestion patterns, but there is not yet a concrete local version to learn from.

These gaps reduce adoptability. A serious reference app should make it safe to try with real-ish data and easy to leave with that data.

## Goals

- Add a project-scoped CSV import flow for work items.
- Add a dry-run mode that validates an import file without writing data.
- Add a clear validation report with row numbers, field names, messages, and importable row counts.
- Add an apply mode that creates valid work items transactionally after validation succeeds.
- Add CSV export for work items from project and workspace discovery contexts.
- Preserve server-side validation and permission checks.
- Preserve deterministic seed and test behavior.
- Keep import/export useful in local development and production preview.
- Document the CSV template, supported columns, validation rules, and operational caveats.
- Update the OpenAPI reference for import/export endpoints if endpoints are added.
- Capture extraction notes for data portability, file ingestion, dry-run validation, and bulk command patterns.

## Non-Goals

- Jira, Asana, Linear, Trello, GitHub Projects, or CSV dialect-specific importers.
- Full workspace import/export.
- Binary attachments.
- Background jobs or queues.
- Streaming uploads.
- Very large file processing.
- Scheduled imports.
- Webhooks.
- Email notifications.
- Import rollback UI after apply.
- Deduplication against arbitrary existing tracker IDs beyond the scoped columns described here.
- Importing comments, activity events, members, labels, milestones, or projects in this sprint.
- Custom fields.
- Custom workflows.
- Production authentication.
- Cloud object storage integration.
- Hosted infrastructure.

## Target Users

Primary:

- Project owners evaluating Worktrail with a real backlog sample.
- Maintainers who want to seed a project quickly from a spreadsheet.
- Contributors who need exported filtered work item lists for offline review or reporting.
- The project owner evaluating reusable patterns for `jawstack`.

Secondary:

- Developers evaluating Worktrail as a serious reference app.
- Teams that value data portability before adopting a tracker.
- Future maintainers who need a concrete local ingestion pattern before adding cloud upload or third-party imports.

## Positioning

Worktrail should remain a focused project tracker. v0.0.7 should not pretend to be an enterprise migration product. It should make basic data movement practical, clear, and trustworthy.

Suggested v0.0.7 positioning:

> A focused project tracker that can start from a spreadsheet, validate before writing, and export the work it manages.

## Product Principles

- Import should be safe before it is fast.
- Dry-run validation is a first-class workflow, not an optional developer trick.
- Users should understand every rejected row without reading server logs.
- Bulk apply should be transactional for the scoped MVP.
- Export should reflect the filters users are already looking at.
- CSV columns should map to product language, not database internals.
- Server validation remains authoritative.
- Archived projects remain protected from writes.
- Data portability should increase trust without creating a broad integration surface too early.
- Implementation should reveal reusable ingestion patterns without abstracting them prematurely.

## Scope

### 1. CSV Import Template

Define and document the supported CSV work item import format.

Required columns:

- `title`
- `type`
- `priority`

Optional columns:

- `description`
- `status`
- `assignee_email`
- `reporter_email`
- `label_names`
- `milestone_name`
- `due_date`
- `estimate_points`

Column behavior:

- `title` is required and must satisfy the existing work item title rules.
- `type` must be one of the existing work item types.
- `priority` must be one of the existing priorities.
- `status`, if omitted, defaults to `backlog`.
- `description`, if omitted, defaults to an empty string.
- `assignee_email`, if present, must match an active workspace member.
- `reporter_email`, if present, must match an active workspace member; if omitted, the acting member is the reporter.
- `label_names`, if present, should support comma-separated label names matching active project labels.
- `milestone_name`, if present, must match an active project milestone.
- `due_date`, if present, must be an ISO date in `YYYY-MM-DD` form.
- `estimate_points`, if present, must be a non-negative number accepted by current work item validation.

Acceptance criteria:

- Documentation includes a CSV template with headers and at least three sample rows.
- The app exposes the template from the import UI or links clearly to documentation.
- Unsupported columns are either ignored with warnings or rejected consistently; the technical design should decide.

### 2. Import Dry Run

Add a project-scoped dry-run flow that validates a CSV file without writing work items.

Required behavior:

- User selects an active project.
- User uploads or pastes a CSV file through the project import UI.
- API parses rows and validates each row.
- API resolves references for assignee, reporter, labels, and milestone.
- API returns a structured import preview.
- Preview includes:
  - total rows;
  - valid rows;
  - invalid rows;
  - warnings;
  - row-level errors;
  - normalized values for valid rows where useful.
- UI renders the validation report clearly.
- Apply is disabled while any row has errors.
- Archived projects cannot be imported into.

Acceptance criteria:

- A valid seeded CSV returns a preview with all rows importable.
- An invalid CSV returns row-specific errors without creating work items.
- Missing optional values show expected defaults in the preview.
- Archived project import attempts are rejected.

### 3. Import Apply

Add an apply action that creates work items after a successful dry run.

Required behavior:

- Apply uses the validated import payload or reruns validation server-side before writing.
- Apply creates work items in the selected project.
- Apply runs in a transaction.
- If validation fails at apply time, no work items are created.
- Created work items receive normal display keys and board positions.
- Created work items create normal activity events.
- User sees a success summary with links to created work items and the project list/board.
- Permissions match normal work item creation.

Acceptance criteria:

- A valid CSV can create multiple work items in one apply.
- Display keys are sequential and project-scoped.
- Created work items appear in project list, board, and cross-project discovery.
- Created work items are visible in activity where existing creation activity is expected.
- A validation failure during apply creates no partial work items.

### 4. Work Item CSV Export

Add CSV export for work item lists.

Required behavior:

- Project work item list can export the current filtered result set.
- Workspace work item discovery can export the current filtered result set.
- Exported columns are stable and documented.
- Export includes human-readable values:
  - project key;
  - display key;
  - title;
  - type;
  - status;
  - priority;
  - assignee name/email;
  - reporter name/email;
  - label names;
  - milestone name;
  - due date;
  - estimate points;
  - created at;
  - updated at.
- Export respects archived-project filter behavior for workspace discovery.
- Export should not require a new screen.

Acceptance criteria:

- Export from a project list downloads or returns a CSV containing only that project's filtered rows.
- Export from workspace discovery downloads or returns a CSV matching the visible filters.
- Empty result exports still include headers.
- Export can be opened by common spreadsheet tools.

### 5. Import/Export UI

Add focused UI surfaces without redesigning the app.

Required behavior:

- Add an import entry point from project-scoped work item pages or project settings.
- Add export buttons to project work item list and workspace work item discovery.
- Keep controls permission-aware.
- Show validation states, loading states, error states, and success states.
- Keep copy direct and operator-friendly.
- Do not add visible tutorial text beyond what is needed for the workflow.

Acceptance criteria:

- Owner/maintainer users can import into active projects if they can create work items.
- Contributor users see the same import restrictions as normal creation.
- Export is available to users who can view the relevant work item list.
- UI remains usable at common desktop widths and does not regress mobile layouts.

### 6. Documentation And API Reference

Update release documentation for data portability.

Required behavior:

- Add CSV import/export documentation under `docs/v0.0.7/`.
- Update README for v0.0.7 capabilities and limitations during finalization.
- Update the product site during finalization.
- Update OpenAPI if import/export endpoints are added.
- Add `jawstack` extraction notes for import/export patterns during finalization.

Acceptance criteria:

- A new evaluator can find the CSV template and import/export instructions.
- API docs represent any new endpoints.
- Release notes clearly state what import/export does and does not support.

## UX Requirements

The import experience should feel like a work tool, not a wizard.

Required UX:

- Import entry point is easy to find from a project work item context.
- The file selection/paste area is compact and functional.
- Dry-run results are dense and scannable.
- Errors use row numbers and field names.
- Successful preview makes the apply action obvious.
- Apply success provides links to created work and project views.
- Export uses standard browser download behavior where practical.
- Import/export controls do not crowd primary list actions.

Suggested import report sections:

- Summary counts.
- Errors table.
- Warnings table if warnings are supported.
- Preview table for normalized rows.
- Apply action.

## API Requirements

The technical design should choose exact route names, but likely API operations include:

- validate work item CSV import for a project;
- apply a validated work item CSV import for a project;
- export project work items as CSV;
- export workspace work items as CSV.

Possible route shapes:

```text
POST /api/projects/{projectId}/work-items/imports/preview
POST /api/projects/{projectId}/work-items/imports
GET /api/projects/{projectId}/work-items/export
GET /api/work-items/export
```

API behavior:

- Validate content type and payload size.
- Return structured JSON for preview/apply responses.
- Return `text/csv` for export responses.
- Keep endpoint handlers transport-neutral where practical.
- Keep parsing and formatting logic out of Express-specific code where practical.
- Avoid leaking raw parser or database errors to users.

## Data Requirements

No new persistent import job table is required for the MVP unless the technical design finds it necessary.

Likely data changes:

- No schema change for basic import/export.
- Existing work item, label, milestone, member, and activity tables should be sufficient.

Potential future data:

- persisted import batches;
- import source metadata;
- import audit table;
- external source IDs;
- retryable background jobs.

## Security And Safety

- Import must enforce the same actor and project permission rules as normal work item creation.
- Archived project write protection must apply.
- CSV parsing must have explicit size and row-count limits.
- Import errors must not include raw stack traces.
- Export must not expose data outside the current actor's workspace.
- Local actor behavior remains development scaffolding, not production authentication.
- Production preview remains a local operational path, not a public deployment.

Initial limits should be conservative. Suggested defaults:

- maximum file size: 1 MB;
- maximum rows: 250;
- maximum cell length: aligned with existing field validation where possible.

The technical design should confirm exact limits.

## Accessibility And Responsiveness

- Import controls must be keyboard accessible.
- File input and apply buttons must have clear labels.
- Error tables must not rely on color alone.
- Validation report tables should remain readable at tablet and desktop widths.
- Mobile can stack import report sections, but text must not overflow controls.

## Testing Requirements

Backend:

- CSV parser unit tests.
- Import validation success.
- Import validation row errors.
- Unknown references.
- Archived project rejection.
- Permission rejection.
- Transactional apply success.
- Transactional apply failure with no partial writes.
- Export CSV escaping and headers.
- Project export filter behavior.
- Workspace export filter behavior.

Frontend:

- Import page/component happy path.
- Validation error rendering.
- Apply disabled with errors.
- Apply success state.
- Export button URL/query behavior.
- Permission/archived disabled states.

E2E:

- Smoke test importing a small valid CSV into an active project.
- Confirm imported work appears in list or board.
- Smoke test exporting a filtered list and validating headers if reliable.

Documentation:

- Guard test or simple check for CSV template documentation if practical.

## Performance Requirements

v0.0.7 import/export is intentionally small-scale.

- Validate 250 rows quickly in local development.
- Export current list filters without noticeable delay for seeded data.
- Avoid client-side parsing as the authoritative validation path.
- Avoid loading unrelated workspace data repeatedly if repository helpers already provide scoped lookup data.

## Observability And Operations

- Preview and normal API logs should record import/export request completion through existing request logging.
- The operations runbook should mention import file limits and recovery from validation failures if appropriate.
- No metrics stack is required.
- No persistent import audit dashboard is required.

## Documentation Requirements

Add or update:

- `docs/v0.0.7/prd.md`;
- `docs/v0.0.7/technical-design.md`;
- `docs/v0.0.7/implementation-plan.md`;
- `docs/v0.0.7/jawstack-extraction-notes.md` during finalization;
- CSV import/export user documentation under `docs/v0.0.7/` or an appropriate docs path;
- README during finalization;
- product site during finalization;
- OpenAPI during implementation if API routes are added.

## Release Verification

Expected final verification:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
```

If import/export touches database seed state in e2e, finalization should restore deterministic seed data with:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
```

## Success Metrics

Because this remains a local reference app, success is measured by functional readiness:

- A user can import a small backlog into an active seeded project.
- A user can see validation errors before any write occurs.
- A successful import creates normal work items with display keys, board positions, and activity.
- A user can export filtered project and workspace work item lists.
- Documentation makes the supported CSV format clear.
- Existing v0.0.6 production preview and operational checks continue to pass.

## Risks

- CSV parsing can absorb time in edge cases if scope is not kept narrow.
- Partial import behavior can become confusing if apply is not transactional.
- Import UI can become too wizard-like and disrupt the dense app workflow.
- Matching labels/milestones/members by display names can create ambiguity.
- Export can drift from visible filters if filter serialization is duplicated.
- E2E tests that download files can become brittle if implemented too broadly.

## Open Decisions

1. Should import accept file upload only, paste-only, or both?
2. Should unknown optional columns be rejected or returned as warnings?
3. Should `label_names` use comma-separated names in one column or repeated columns?
4. Should import create missing labels or require labels to already exist?
5. Should apply use a server-issued preview token or rerun validation from the submitted CSV?
6. Should export be implemented as `GET` endpoints with query params or `POST` endpoints with a query body?
7. What exact file size and row count limits should v0.0.7 enforce?
8. Should imports be contributor-accessible when normal work item creation is contributor-accessible, or owner/maintainer-only for the MVP?

## Initial Recommendations

- Support file upload only for v0.0.7; paste support can wait.
- Reject unknown columns in dry run with a clear file-level error.
- Use comma-separated `label_names` in a single column.
- Require labels and milestones to already exist; do not create catalog data during work item import.
- Rerun validation from the submitted CSV during apply rather than adding preview persistence.
- Use `GET` export endpoints with the same query params as list endpoints.
- Start with 1 MB and 250-row limits.
- Use the same permission rule as normal work item creation for imports.
