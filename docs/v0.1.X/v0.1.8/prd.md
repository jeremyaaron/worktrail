# Worktrail v0.1.8 PRD

## Summary

Worktrail v0.1.8 should make project status communication easier, more consistent, and more durable.

The last several releases made Worktrail strong at daily execution and project review:

- v0.1.2 made filtered work views trustworthy.
- v0.1.3 and v0.1.4 made saved workspace and project views reusable.
- v0.1.5 made important views visible as pinned operating lenses.
- v0.1.6 made project views actionable through project-scoped batch triage.
- v0.1.7 added focused milestone review pages with health, risk, recent movement, and query-backed action links.

The next gap is status reporting. Worktrail can now explain a project's current state, but the app does not help a maintainer turn that state into a durable update for a team, stakeholder, or future review. Teams still need a way to answer:

- What is the current project status?
- What changed since the last update?
- What are the main risks?
- What decisions or next steps should people know about?
- What did the team communicate at a specific point in time?

The product theme is Project Status Reports. The release should add a lightweight status-report workflow that composes existing project health, milestones, review signals, and query-backed work links into a saveable project update.

This sprint should intentionally introduce a narrow persisted snapshot because there is now a concrete workflow that needs it: status communication. It should not become forecasting, roadmap management, approval workflows, or a generic reporting engine.

## Context

Worktrail now supports:

- project overview and Planning delivery health;
- milestone review pages;
- project Work with reliable URL-backed filters;
- project saved views, pinned views, copy links, CSV export, and batch triage;
- dependency-aware planning and risk links;
- comments, watchers, notifications, activity, and member roles;
- archived project read-only behavior;
- OpenAPI, deterministic seed data, and Playwright smoke coverage.

These features help users inspect and act on work. They do not yet help users produce a repeatable, archived status update.

Status reporting is a common project-management ritual. A status update may be discussed in a meeting, copied into another tool, sent to stakeholders, or compared to the next update. It is also a useful product bridge between current-state review surfaces and future enterprise capabilities such as audit history, reporting exports, notifications, or managed deployment templates.

## Problem

Project status is currently implicit and scattered.

Current friction:

- project overview, Planning, milestone review, and filtered Work each show part of the story;
- a maintainer must manually assemble status updates outside the app;
- there is no durable record of what the project team communicated at a point in time;
- delivery-health signals are current-state only, so past status cannot be reconstructed accurately after work changes;
- risks can be reviewed, but there is no place to capture narrative context such as "what we are doing about it";
- contributors can inspect work, but there is no concise read-only status artifact for broad project context;
- future pattern extraction lacks evidence for narrow, workflow-driven snapshots.

Without status reports, Worktrail is strong as a working app but weaker as a coordination app. Real project teams need both.

## Goals

- Add project-scoped status reports.
- Let owners and maintainers draft a report from current project state.
- Persist a report snapshot with enough derived data to preserve what was communicated.
- Include editable narrative sections for:
  - summary;
  - highlights;
  - risks;
  - next steps.
- Include generated project status context:
  - health state;
  - open/blocked/overdue counts;
  - milestone summaries;
  - top current risks;
  - recent movement.
- Provide query-backed links from report sections into project Work and milestone review where useful.
- Provide a read-only report detail page that can be shared by URL inside the local app.
- Add a project Status tab or status-report entry point that fits the project shell.
- Preserve role and archive rules:
  - owners and maintainers can create reports for active projects;
  - contributors can read reports;
  - archived projects can read existing reports but cannot create new ones.
- Record project activity when a report is published.
- Update OpenAPI, deterministic seed data, smoke coverage, release notes, and destination-neutral pattern notes.

## Non-Goals

- Do not add forecasting, confidence scoring, velocity, burndown, burnup, or capacity planning.
- Do not add roadmap or timeline visualization.
- Do not add report approval, sign-off, review gates, or stakeholder acknowledgement.
- Do not add email, Slack, PDF, Markdown export, scheduled reports, or notification delivery.
- Do not add report comments or discussion threads.
- Do not add workspace-wide report rollups.
- Do not add custom report templates.
- Do not add rich-text editing.
- Do not add attachments.
- Do not add cross-project reports.
- Do not add analytics dashboards or charting libraries.
- Do not make status reports editable after publication unless the technical design finds a small, safe correction path.
- Do not extract a generic snapshot framework.

## Target Users

### Project Maintainer

Wants to generate a credible status update from the current project state, add concise narrative context, publish it, and share a URL.

### Workspace Owner

Wants teams to use consistent status communication without requiring a separate reporting tool.

### Contributor

Wants to read the latest project status and understand priorities, risks, and next steps without seeing controls they cannot use.

### Stakeholder Reader

In the current local app, this maps to an active member viewing a report URL. They want a concise, readable artifact rather than a dense project work list.

### Reference-App Developer

Wants product evidence for workflow-driven snapshots, generated drafts, immutable report records, role-aware publication, and query-backed report action links.

## Product Principles

- **Reports summarize decisions, not every row:** a status report should be concise and useful in a meeting or update thread.
- **Snapshot only when the workflow requires it:** reports need durable state because communication is point-in-time; ordinary review pages should remain derived.
- **Generated first, human finished:** Worktrail should prefill useful project context, then let a maintainer add the judgment that raw data cannot provide.
- **Action links stay live:** reports can preserve snapshot counts, but links should route to current Work or milestone review for follow-up action.
- **Published means stable:** readers should not see a report's core communicated state change just because project work changed later.
- **Read-only is a first-class path:** contributors should be able to read reports cleanly.
- **Keep the first report format narrow:** enough structure to prove the pattern, not a reporting platform.

## Scope

### 1. Status Report List And Entry Point

Add a project-scoped status report area.

Candidate route:

```text
/projects/:projectId/status
```

Requirements:

- Add a project-shell navigation entry, likely `Status`.
- Show the latest status report prominently.
- Show a compact list of previous reports, newest first.
- Show report metadata:
  - title;
  - status date;
  - health state;
  - author;
  - published timestamp.
- Provide a `Create report` action for owners and maintainers on active projects.
- Hide or disable creation for contributors and archived projects with clear copy.
- Preserve project shell context and responsive layout.

Acceptance criteria:

- Users can navigate to project status reports from the project shell.
- Owners and maintainers can start report creation from an active project.
- Contributors can read the report list without seeing misleading create controls.
- Archived projects show existing reports but block new report creation.

### 2. Generated Draft From Current State

Create a report draft from current project state.

Requirements:

- Generate a default report title, such as `Status update - {date}`.
- Capture a generated snapshot containing:
  - project id, key, name, and status;
  - project delivery-health state and reason labels;
  - open, blocked, overdue, due-soon, unassigned active, stale in-progress, and dependency-blocked counts;
  - active milestone summaries with progress and health;
  - top current risks;
  - recently changed work.
- Prefill editable narrative fields:
  - summary;
  - highlights;
  - risks;
  - next steps.
- Keep generated narrative suggestions plain text and deterministic.
- Let the user edit narrative fields before publishing.
- Do not save abandoned drafts in v0.1.8 unless the technical design finds it materially simpler.

Acceptance criteria:

- A maintainer can start a draft that reflects the current project state.
- Generated context is visible before publishing.
- Narrative fields can be edited before publication.
- Refreshing or abandoning an unpublished draft does not create a published report.

### 3. Publish Status Report

Persist a published status report.

Requirements:

- Add a project-scoped create/publish command.
- Persist:
  - project id;
  - author member id;
  - title;
  - status date;
  - narrative fields;
  - generated snapshot JSON;
  - published timestamp.
- Validate:
  - actor belongs to the workspace;
  - actor can manage project status reports;
  - project exists in actor workspace;
  - project is not archived;
  - required title and summary constraints;
  - narrative field length limits.
- Record project activity when a report is published.
- Return the published report DTO.

Acceptance criteria:

- Owners and maintainers can publish a status report for active projects.
- Contributors cannot publish reports.
- Archived projects reject report creation.
- Published reports survive reload and database reseed only when seeded intentionally.
- Project activity records the report publication.

### 4. Status Report Detail

Add a read-only report detail page.

Candidate route:

```text
/projects/:projectId/status/:reportId
```

Requirements:

- Show report metadata:
  - title;
  - project;
  - author;
  - status date;
  - published timestamp.
- Show narrative sections:
  - summary;
  - highlights;
  - risks;
  - next steps.
- Show snapshot context:
  - health state and reasons;
  - project count summary;
  - milestone summaries;
  - top risks;
  - recent movement.
- Make the report URL shareable inside the app.
- Keep report snapshot values stable after underlying work changes.
- Use links from snapshot sections into current app surfaces where useful:
  - project Work for current filtered work;
  - milestone review for milestone details;
  - work item detail for recent movement or risk rows.
- Make clear that links open current project data, while the report content is the published snapshot.

Acceptance criteria:

- A published report opens by direct URL.
- Contributors can read the report detail page.
- The report remains readable for archived projects.
- Snapshot counts do not silently recompute after publication.
- Links from report content route to valid current app pages.

### 5. Status Report API

Add transport-neutral API handlers for status reports.

Candidate routes:

```text
GET /api/projects/:projectId/status-reports
GET /api/projects/:projectId/status-reports/draft
POST /api/projects/:projectId/status-reports
GET /api/projects/:projectId/status-reports/:reportId
```

Requirements:

- Keep endpoint handlers transport-neutral and registered through the local Express adapter.
- Use shared DTO contracts.
- Return structured validation errors consistent with existing API behavior.
- Keep report list responses compact.
- Keep detail responses complete enough to render without additional report-specific calls.
- Avoid adding update/delete endpoints in v0.1.8 unless the technical design finds an unavoidable correction requirement.

Acceptance criteria:

- API routes are documented in OpenAPI.
- API tests cover permission, archived-project, not-found, draft generation, publish, list, and detail behavior.
- Endpoint handlers preserve the future Lambda/API Gateway path.

### 6. Data Model

Add persistent status report storage.

Candidate table:

```text
project_status_reports
```

Candidate fields:

- `id`;
- `workspace_id`;
- `project_id`;
- `author_member_id`;
- `title`;
- `status_date`;
- `summary`;
- `highlights`;
- `risks`;
- `next_steps`;
- `snapshot_json`;
- `published_at`;
- `created_at`.

Requirements:

- Keep reports project-scoped.
- Store the generated snapshot as JSONB unless the technical design identifies a clear need for relational child tables.
- Include enough foreign keys to enforce workspace/project/member integrity.
- Ensure archived member authors can still display historically.
- Add deterministic seed reports for at least one active project and one archived/read-only scenario if useful for testing.

Acceptance criteria:

- Migrations apply from a clean database.
- Seed data creates at least one useful report scenario.
- Existing reset/migrate/seed flow remains deterministic.

### 7. Query-Backed Report Links

Use existing query contracts for report follow-up links.

Requirements:

- Include current project Work links for report risk groups where an exact query exists.
- Link milestone snapshot rows to milestone review pages.
- Link risk/recent work items to work item detail pages with return URLs back to the report.
- Do not invent report-specific query semantics unless current `WorkItemQuery` cannot represent a necessary link.
- If a new query field is required, keep it narrow, visible as an active chip, and documented.

Acceptance criteria:

- Report links are shareable and reloadable.
- Destination active chips truthfully explain applied filters.
- Copy-link and CSV export behavior on destination Work pages remain aligned with applied query state.

### 8. Permissions And Archived Behavior

Apply existing role and archive patterns.

Requirements:

- Owners and maintainers can create and publish reports for active projects.
- Contributors can list and read reports.
- Archived projects can list and read reports.
- Archived projects cannot create reports.
- Inactive historical authors remain displayable.
- Local actor selector behavior remains unchanged.

Acceptance criteria:

- UI and API permissions match.
- Contributor create controls are absent or clearly unavailable.
- Archived-project creation attempts are blocked in API tests.

### 9. Responsive UX And Accessibility

Build report pages as readable operating documents, not dashboards.

Requirements:

- Use a dense but readable project-app layout.
- Avoid card nesting.
- Keep report narrative and generated context readable on mobile and common desktop widths.
- Ensure long titles, project names, milestone names, and work item titles wrap safely.
- Use semantic headings for report sections.
- Use plain text areas for narrative entry.
- Preserve keyboard-friendly form flow and visible focus states.

Acceptance criteria:

- Report list, draft, and detail pages are usable at common desktop widths and mobile widths.
- No report text overflows its container.
- Create/publish actions have stable loading and error states.

### 10. Documentation, Site, And Pattern Notes

Close the release with updated docs.

Requirements:

- Update README for project status reports.
- Update public static site if status reports materially change the product story.
- Add release notes.
- Add destination-neutral pattern notes covering:
  - workflow-driven snapshots;
  - generated drafts;
  - immutable report records;
  - live links from historical reports;
  - report permissions and archive behavior.
- Confirm docs use destination-neutral pattern extraction language.
- Update OpenAPI.

Acceptance criteria:

- Docs match implemented behavior.
- Pattern notes describe reusable evidence without naming a specific extraction destination.
- Final verification passes or failures are documented with concrete cause.

## Data And Contracts

Expected shared contract additions:

- `ProjectStatusReportSummaryDto`;
- `ProjectStatusReportDetailDto`;
- `ProjectStatusReportDraftDto`;
- `ProjectStatusReportSnapshotDto`;
- `ProjectStatusReportCreateRequest`;
- related snapshot DTOs for health, counts, milestones, risks, and recent work.

Expected query behavior:

- Prefer existing `WorkItemQuery` fields for report links.
- Reuse `workRisk` from v0.1.7 where it fits.
- Avoid hidden filters unless they have visible destination chips.

## UX Notes

Candidate project shell navigation:

```text
Overview | Work | Board | Planning | Status | Settings
```

Candidate report list layout:

- latest report header;
- `Create report` action;
- report rows with title, health, status date, author, and published timestamp.

Candidate draft page layout:

- generated context summary on top;
- narrative fields below;
- publish action in a stable command area.

Candidate detail page layout:

- report metadata;
- narrative sections;
- generated snapshot sections;
- current-data link callouts.

The report detail page should read like a status artifact, not a configuration form.

## Security And Permissions

v0.1.8 still uses local actor headers and selected member context. It does not add production authentication.

Permission behavior should follow existing local role rules:

- owner: create and read project status reports;
- maintainer: create and read project status reports;
- contributor: read project status reports;
- inactive member: not selectable as actor but can remain visible as historical author.

API permission checks must not trust client-provided role data.

## Activity And Audit

Publishing a report should create a project activity event.

Recommended activity copy:

```text
Published status report "{title}"
```

Do not add a separate audit export in v0.1.8.

## Seed And Demo Expectations

Seed data should support a deterministic walkthrough:

1. Open the Worktrail App project.
2. Open Status.
3. Read a seeded latest report.
4. Create a new draft as owner or maintainer.
5. Edit narrative fields and publish.
6. Open the published report by URL.
7. Follow a report risk or milestone link into current project surfaces.
8. Switch to contributor and confirm reports are readable but creation is unavailable.
9. Open archived project status reports if seeded and confirm read-only behavior.

## Testing Requirements

### Contract Tests

- DTO shape for draft, create request, summary, detail, and snapshot.
- Snapshot DTO supports health, counts, milestones, risks, and recent work.

### API Tests

- draft generation for active project;
- report publish by owner/maintainer;
- publish rejection for contributor;
- publish rejection for archived project;
- list reports;
- get report detail;
- report not found and cross-project access behavior;
- project activity event on publish;
- snapshot remains stored after underlying work changes where practical to test.

### Web Tests

- project Status route registration and lazy loading;
- list page empty, seeded, contributor, and archived states;
- draft page generated context and editable fields;
- publish loading/success/error states;
- detail page rendering and current-data links.

### Playwright Smoke

- owner opens Status, creates/publishes a report, opens detail, and follows one link;
- contributor can read reports but cannot create;
- responsive check for report detail at common desktop and mobile widths.

## Success Metrics

The release is successful when:

- a project maintainer can publish a useful status report from seeded project state in under a minute;
- a contributor can open the same report and understand status without mutation controls;
- a published report remains stable across reloads;
- report links route to current project Work, milestone review, or work detail pages correctly;
- the implementation adds a narrow snapshot pattern without turning into a reporting platform;
- full verification passes:

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
```

## Risks

### Snapshot Scope Creep

Status reports could expand into a generic reporting system.

Mitigation: support one project-scoped report format with fixed sections and no custom templates.

### Snapshot Drift Confusion

Users may confuse historical report values with current linked work.

Mitigation: clearly label report content as published snapshot and current-data links as live destinations.

### JSONB Shape Instability

Snapshot JSON can become hard to migrate if treated casually.

Mitigation: define contract-owned snapshot DTOs and include snapshot versioning if the technical design finds it useful.

### Duplicate Health Logic

Report generation could duplicate project health and risk rules.

Mitigation: reuse existing delivery-health, planning, milestone review, and work-risk services where possible.

### Navigation Weight

Adding a Status tab may crowd project navigation.

Mitigation: keep label short and validate responsive wrapping in the project shell.

## Open Decisions

1. Should status report creation use a separate draft route, or should the list page open an inline draft composer?
2. Should published reports be immutable in v0.1.8, or should owners/maintainers be allowed to correct narrative fields after publication?
3. Should the snapshot JSON include a `snapshotVersion` field from day one?
4. Should reports be titled by user input only, or should `Status update - {date}` remain the default editable title?
5. Should seeded data include an archived-project report scenario, or should archived behavior be covered only by tests?

## Recommended Decisions

- Use separate list, draft, and detail routes to keep each page simple and testable.
- Treat published reports as immutable in v0.1.8.
- Include `snapshotVersion: 1` in the snapshot JSON to make future migration safer.
- Provide an editable default title.
- Seed one active project report; add archived-project report seed only if it improves the Playwright path without making seed data noisy.
