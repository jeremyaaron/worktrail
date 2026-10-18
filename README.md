# Worktrail

Worktrail is a project management reference app. The v0.3.0 baseline is a local-first Angular +
TypeScript API + Postgres application focused on readable descriptions and discussion, fast workspace
navigation and bounded multi-entity search, files in work-item context, scalable work discovery, daily team workflow, two-level work
breakdown, workspace portfolio review, collaboration updates, reliable filtered work views, pinned
workspace and project operating lenses, explicit project batch triage, milestone review, cycle planning
and closeout, published project reports and Markdown sharing, dependency-aware planning, workspace
governance, data portability, and production-shaped application boundaries.

The app includes shell-level Quick Find, My Work, Portfolio review, Action Inbox, top-level Work Items
discovery, URL-backed filters, copyable filtered-view links, personal saved views, workspace-shared
saved views, project-scoped personal and shared saved views, pinned saved-view shortcuts,
project-scoped bulk updates, quick work capture, persistent project workspaces, bounded work item
attachments, live planning review, live milestone review, cycle management and review, generated
report drafts, immutable published report snapshots with cycle context, Markdown copy/download for
published reports, print-friendly report detail pages, milestone/cycle/work links from reports,
milestone management, durable boards, work item relationships, dependency-blocked signals, project
delivery health, formatted descriptions and comments with source editing and preview, explicit
mentions, work item watchers, activity, CSV import/export, production-like preview, health/readiness
checks, checked-in API documentation, CI, lint, and responsive work item
scanning.

The app is intentionally built as a credible product surface before generalizing reusable patterns. It runs locally today, while preserving a path toward an S3/CloudFront Angular frontend with API Gateway/Lambda-style endpoint handlers and managed Postgres.

## Repository Layout

```text
apps/
  api/      TypeScript Node API with a local Express adapter
  web/      Angular SPA
packages/
  contracts/ Shared DTO and API contract types
docs/
  v0.0.X/  Archived v0.0.1-v0.0.9 sprint docs
  v0.1.X/  Archived v0.1.0-v0.1.9 sprint docs
  v0.2.0/  Consolidated Operating Baseline PRD, technical design, implementation plan, audits, release notes, and pattern notes
  v0.2.1/  Cycle Planning PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.2/  Saved Views Ergonomics PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.3/  Portfolio Review PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.4/  Cycle Closeout PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.5/  Work Breakdown PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.6/  Scalable Work Discovery PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.7/  Files in Context PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.8/  Quick Find PRD, technical design, implementation plan, release notes, and pattern notes
  v0.2.9/  Readable Work PRD, design, plan, release/pattern notes, CSV example, and verification evidence
  v0.3.0/  Connected Work PRD, design, plan, audits, release/pattern notes, limits, and verification evidence
  development.md Current implementation owners and invariants
  operations.md Current local operation, upgrade, and backup guidance
  api/     OpenAPI reference
site/       Static GitHub Pages product site
e2e/        Playwright smoke tests
```

## Requirements

- Node.js 24 LTS (`nvm use` selects the repository's `.nvmrc`)
- npm 11
- Git and Docker with Compose, for the local PostgreSQL 16 container (or a separate existing PostgreSQL database)
- Playwright Chromium is required only for browser verification, not for using the app

## Local Setup

This is a fresh demo path. Choose this or the independent compiled-preview path below; do not run
both against existing working data. The Node commands use nvm; another manager selecting Node 24
and npm 11 is equivalent. From a fresh clone:

```sh
git clone https://github.com/jeremyaaron/worktrail.git
cd worktrail
nvm install
nvm use
npm ci
export NODE_ENV=development
export API_PORT=3000
export CORS_ORIGIN=http://localhost:4200
export WORKTRAIL_SERVE_STATIC=false
export DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail
export WORKTRAIL_ATTACHMENT_STORAGE_DRIVER=local
export WORKTRAIL_ATTACHMENT_STORAGE_PATH="$PWD/.worktrail/attachments"
npm run db:start
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:4200>. Keep the same absolute attachment root for seed and API runtime.
Seeding initializes the marked store and writes the sample files; changing the root afterward does
not move those bytes. No `.env` file is required for these explicit commands. See `.env.example`
for optional persisted configuration, and do not commit connection credentials.

If PostgreSQL already occupies 5432, omit `npm run db:start`. Create a separate `worktrail` demo
database owned by your local role and export its `DATABASE_URL` before migration/seed. The role needs
schema creation/migration privileges, not CREATEDB for ordinary app operation. Never seed an existing
working database to test installation. Port conflicts should be resolved deliberately, not by
stopping an unrelated service. The default Angular proxy expects the API at port 3000.

The combined process is long-running. Stop it with Ctrl+C; alternatively run `npm run dev:api` and
`npm run dev:web` in separate terminals with the same configuration. Browser checks additionally
require `npx playwright install chromium` (Linux CI: `npx playwright install --with-deps chromium`).

Local services:

- Web: <http://localhost:4200>
- API: <http://localhost:3000>
- API liveness: <http://localhost:3000/api/health/live>
- API readiness: <http://localhost:3000/api/health/ready>
- Postgres: `localhost:5432`

## Production Preview

This is an independent fresh demo setup, not commands to append after the development server.
Requires Git, Node 24/npm 11 and Docker with Compose, or an independently provisioned PostgreSQL 16
database. Stop a conflicting development API before starting preview on port 3000. From a fresh clone:

```sh
git clone https://github.com/jeremyaaron/worktrail.git
cd worktrail
nvm install
nvm use
npm ci
export NODE_ENV=production
export API_PORT=3000
export CORS_ORIGIN=false
export WORKTRAIL_SERVE_STATIC=true
export DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail
export WORKTRAIL_ATTACHMENT_STORAGE_DRIVER=local
export WORKTRAIL_ATTACHMENT_STORAGE_PATH="$PWD/.worktrail/preview-attachments"
export WORKTRAIL_STATIC_ASSETS_PATH="$PWD/apps/web/dist/worktrail-web/browser"
npm run db:start
npm run db:migrate
npm run db:seed
npm run preview
```

Open <http://localhost:3000>. This builds contracts, API and Angular, then runs compiled API code with
Express serving the built web assets and `/api/*` from one origin. The attachment root is established
before seeding and reused at runtime. For an existing PostgreSQL server, use the separate-database
guidance above and omit `db:start`. No development storage fallback is intended.

The final command is equivalent to:

```sh
npm run build
npm run start:prod
```

When switching an existing installation between development and preview, retain its original
database and absolute attachment root; do not reset or reseed it. Preview is for local inspection,
not secure internet-facing deployment. It does not add authentication, malware scanning, managed
object storage or multi-instance coordination.

Preview checks:

```sh
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
curl -I http://localhost:3000/my-work
curl -I http://localhost:3000/work-items/new
```

Current operating, upgrade and reset guidance is in [docs/operations.md](docs/operations.md).
The [older operations runbook](docs/v0.0.X/v0.0.6/operations-runbook.md) is historical context, not the
current setup authority. The [developer guide](docs/development.md) names actual implementation owners.

### Attachment Persistence And Backup

Attachment metadata lives in PostgreSQL while immutable bytes live under
`WORKTRAIL_ATTACHMENT_STORAGE_PATH`. Development defaults to `.worktrail/attachments`; production
mode requires an explicit absolute path. API startup initializes a versioned store marker and refuses
unsafe roots. `storage:reset` only removes a marked Worktrail store and remains separate from the
database-only `db:reset` command.

Back up and restore PostgreSQL and the complete attachment storage root as one operational data set.
For a consistent backup, stop attachment mutations or otherwise coordinate the database snapshot and
filesystem copy. Restoring only one side can leave metadata without bytes or unreferenced objects. The
local adapter is intended for one API instance with persistent local disk; shared multi-instance
operation requires a future object-store adapter and coordination design.

## API Reference

The checked-in OpenAPI reference lives at [docs/api/openapi.yaml](docs/api/openapi.yaml). It documents the implemented route surface, representative DTOs, development-only local actor headers, readiness behavior, and the common structured error shape.

## Readable Work

v0.2.9 adds structured descriptions and comments with a shared source editor, formatting toolbar,
format selector, and preview. New descriptions and comments in the Angular app default to Markdown;
existing edits preserve their stored format. Choose Plain text to retain literal punctuation, or
deliberately convert to Markdown. Preview never saves a draft, and cancel/reset restores its context.

v0.3.0 protects unsaved work-item fields, new/edited comments and recipients,
creation forms, and report narratives with a shared Stay/Discard decision. It also protects reused
record routes, actor/project changes, and Quick Find navigation. Pending writes block departure rather
than offer cancellation. A conditional browser unload warning protects reload/close where supported;
drafts are not autosaved or stored for recovery after a crash. Report evidence refresh preserves edits.

Work-item detail is read-first: project and planning facts, description,
independent status/watch actions and discussion precede administrative forms. Edit opens fields,
including setting/clearing estimate and due date. Parent management, children, dependency management,
watchers and history are expandable. Closed child work includes Done and Canceled; parent estimates
remain independent of child totals. Field saves/cancellation preserve unrelated discussion and files.

Inspection links retain a validated origin and at most one immediate work item.
Parent/child and dependency links, create success, reviews/reports, and Quick Find can return to the
original filtered list and page, including after reload, without growing a nested URL stack. Return
links describe their destination. Discussion, Files, Dependencies, History, and identifiable Inbox
comments support loaded section focus; missing or deleted comment targets fall back to Discussion.
Local URL validation does not replace record authorization.

The `markdown_v1` profile supports paragraphs and visible line breaks, headings, ordered/unordered
lists, emphasis, quotations, inline code, fenced/indented code blocks, and explicit HTTP(S) links.
Images display alternative text only. Raw HTML remains literal; tables, strikethrough, interactive
task checkboxes, syntax highlighting, arbitrary attributes, and embedded content are not supported.
Rejected links remain unlinked readable text. Naked URLs are not automatically linked. Code scrolls
within its own region on narrow screens. Parsing/projection failures display complete literal source.
This is a bounded Markdown profile, not full CommonMark/GFM or a WYSIWYG editor.

Source plus its format (`plain_text` or `markdown_v1`) is authoritative; generated HTML is neither
stored nor inserted. Markdown presentation uses a finite application-owned tree and static Angular
templates. Relative destinations (including `/api/...`), non-HTTP(S) schemes, and credential-bearing
URLs are rejected. Valid absolute HTTP(S) links may be same-origin or external; they are not a trusted
destination allowlist. Viewing or previewing content does not fetch image or embed assets.

API compatibility and input rules:

- Work-item detail includes `descriptionFormat`; comments include `bodyFormat`.
- API creation defaults an omitted format to `plain_text`, even though the Angular app explicitly
  sends Markdown for new content. Existing API clients do not acquire Markdown by accident.
- Updates preserve omitted source/format fields. A description format-only update is supported;
  comment updates still require `body`, even when converting format.
- New or changed pairs normalize CRLF/lone CR to LF without trimming indentation, leading/trailing
  spaces, or blank lines. New/changed source is limited to 10,000 **UTF-16 code units**, not bytes,
  graphemes, or Unicode code points. Descriptions may be empty; new/changed comments must not be blank.
- Unchanged legacy pairs remain valid even when oversized or historically blank. Equivalent
  normalized source preserves historical bytes. Converting an oversized record requires shortening
  its source in the same request; a blank legacy comment needs nonblank source to convert.
- Source-and-format no-ops preserve timestamps and emit no activity or notifications. Real changes
  remain auditable. Explicit mention selection is separate from Markdown; typing `@name` creates no
  recipient, and editing a comment does not change its mentions or resend creation notifications.
- Archived descriptions/comments remain readable but cannot be changed. Deleted comments expose
  tombstones without original source. Source-text search, summary CSV exports, published reports,
  and closeout snapshots retain their previous semantics.

Existing installations should run `npm run db:migrate` to apply additive migration
`apps/api/drizzle/20261012032935_nosy_junta/migration.sql` (originally `0019_nosy_junta.sql`);
it backfills existing records as plain text without rewriting their source.
Do not reset or reseed working data to upgrade. See the [current release notes](docs/v0.3.0/release-notes.md),
[verification evidence](docs/v0.3.0/verification-notes.md#phase-21-final-release-verification), and
[known limits](docs/v0.3.0/known-limits.md) for compatibility and residual risk.

## Quick Find

v0.2.8 adds Quick Find as a bounded workspace navigation and search surface available throughout the
application. Open it from the search button in the top bar or with `Command+K` on macOS and `Ctrl+K`
elsewhere. Launch waits for member bootstrap and route navigation to finish; an unresolved draft
departure or pending write retains its existing protection.

With an empty query, Quick Find offers global destinations and project destinations when the current
route has project context, including a successfully authorized work-item detail. Queries are
normalized to 2-120 Unicode code points and search:

- work item display keys, titles, and descriptions;
- project keys, names, and descriptions;
- milestone names and descriptions;
- cycle names;
- published report titles and summaries;
- attachment filenames, with navigation to the owning work item's Files section.

Results are grouped by record type and ranked through deterministic exact, prefix, and substring tiers.
Readable archived and completed records remain discoverable with visible lifecycle context. Each group
returns at most five records and a `hasMore` signal rather than an exact total. Broad work-item matches
can continue into the canonical workspace Work Items page; other result groups do not have dedicated
overflow pages in this release.

Result type and Project in preview narrow the returned bounded groups, not the entire matching
workspace set. Refine the search text to find records outside a non-work preview. Work-item overflow
continues into Work Items with the search and selected project applied. Filenames are distinct from
file contents, and snippets are rendered as text.

Closing Quick Find retains only the query and preview refinements in memory for the current
actor/workspace, making successive inspections possible without retyping. Reopening performs a
fresh authorized search and resets selection; results are not cached. Actor/workspace changes and
page reload clear that session.

Quick Find sends search text in the JSON body of `POST /api/quick-find`, never in the page URL. Normal
request logs record the route rather than the query or request body, responses are marked
`private, no-store`, and actor/workspace authorization is applied before results are projected.

Quick Find is not fuzzy, semantic, language-aware, personalized, or backed by an external search
service. It does not search comments, activity, notifications, complete report bodies, or attachment
contents, and it does not provide mutation commands, saved global searches, exact totals, or hosted
search infrastructure.

## Project Navigation

Projects opens a searchable directory. Owners and maintainers use New project to open creation;
successful creation returns focus to the new project, while failures preserve the draft. Contributor
directory access does not expose creation controls. Workspace Settings is the labeled gear utility
in the top bar and remains readable by contributors. Milestone, cycle and closeout routes identify
Planning as their active project section, with compact project identity above the page heading.

## Portfolio Review

v0.2.3 adds a top-level Portfolio review at `/portfolio`. Portfolio is a read-only workspace operating surface that compares active projects without requiring a user to open each project individually.

Portfolio support includes:

- active-project summary counts for on-track, at-risk, blocked, overdue, dependency-pressure, and stale-or-missing-report projects;
- disclosed attention previews for delivery risk, communication freshness, current execution, and dependency pressure; preview lengths are not workspace totals;
- container-responsive project comparison rows leading with identity, health/top reason, planning context, report freshness and one next action; Details and links exposes secondary metrics and destinations;
- immediate name/key, health and report-freshness filters across all returned active-project rows, with visible/total counts; summary totals remain workspace-wide;
- action links into existing Overview, Work, Planning, Reports, latest report, milestone review, cycle review, and risk-specific filtered Work pages;
- canonical `WorkItemQuery` conversion for Portfolio drill-down links, using each link's project or workspace query scope;
- deterministic seed data that shows blocked/risky projects, a healthy comparison project, fresh and missing report states, active planning context, and dependency pressure.

Portfolio is derived at read time from existing projects, work items, delivery health, milestones, cycles, and status reports. Its local comparison filters are not saved or URL-backed queries. It does not add stored portfolio snapshots, new planning hierarchy, charts, custom sorting, exports, historical portfolio review, or cross-project mutation workflows.

## Reliable Filtered Views And Saved Work Views

v0.1.2 treats work item query state as a product contract. v0.1.3 extends that contract into team-shared workspace saved views. v0.1.4 adds project-scoped saved views for reusable project operating lenses. v0.1.5 promotes important saved views into pinned shortcuts on the relevant workspace or project Work page. Project work item lists, workspace discovery, active filter chips, personal saved views, workspace-shared saved views, project personal/shared saved views, pinned shortcuts, dashboard links, delivery-health links, detail return URLs, copy-link actions, and CSV export all use the same applied `WorkItemQuery` semantics.

Key behavior:

- Filtered workspace and project work item URLs are shareable and reloadable.
- Active filter chips describe the applied query, not pending form edits.
- Search and filter controls are drafts until Apply; active chips and results describe the accepted query.
- "Copy link" copies the current applied filtered view with canonical query parameters.
- Personal saved views store normalized query state and remain private to the selected actor within their scope.
- Workspace-shared saved views store normalized cross-project discovery queries and are visible to all active workspace members.
- Project-scoped saved views store normalized project Work page queries and are isolated from workspace discovery views and other projects.
- Pinned saved views are compact shortcuts for existing saved views; pinning does not change the saved query, scope, visibility, or canonical route behavior.
- Workspace pinned views appear on top-level Work Items, while project pinned views appear on the owning project Work page.
- Shared pinned views appear before personal pinned views, with each group sorted alphabetically by saved-view name.
- Owners and maintainers can create, rename, update, and delete workspace-shared saved views and shared project saved views.
- Owners and maintainers can pin and unpin shared workspace and shared project saved views.
- Contributors can create personal project views and open shared workspace/project views, but cannot manage shared views.
- Contributors can open shared pinned views, but shared pin/unpin controls are hidden from contributor paths.
- Personal saved views can be pinned or unpinned only by their owner.
- Project saved views remain openable for archived projects, but archived projects block project-scoped saved-view create, update, and delete operations.
- Archived projects still show existing pinned project shortcuts, but archived project saved views cannot be pinned or unpinned.
- Personal and shared saved views open through canonical URL parameters, so copy links and CSV exports stay aligned with the applied query.
- Saved views can be opened from a compact selector without expanding management controls.
- Both Work lists show `Named`, `Modified`, or `Custom` state for the explicitly opened view.
  Only applied filters and sort affect that state; pending form edits and pagination do not.
- `Update query` explicitly replaces a saved definition. Applying filters never silently rewrites it.
- Results confirmation appears only after the matching latest request succeeds, not immediately on Open.
- `Manage views` edits one selected saved view at a time instead of rendering rename and mutation controls for every saved view.
- Read-only shared and archived-project saved views keep an uncluttered open-only management path.
- Saved-view summaries count meaningful filters only; default sort and default archived-project mode stay quiet.
- CSV export uses the currently applied filters, so exports match the visible filtered result set rather than draft form values.
- Dashboard, planning, and delivery-health reason links route into filtered work item lists using the same query conversion rules.

Saved-view scopes are explicit:

- `workspace` scope belongs to the top-level Work Items discovery page. It supports workspace-only filters such as project and archived-project mode.
- `project` scope belongs to one project Work page. It strips workspace-only fields and uses that project's route, copy-link, return-URL, and CSV-export behavior.
- `personal` visibility means the saved view is listed and mutable only for the owner.
- `workspace` visibility means the saved view is shared with active workspace members in the current scope. For project scope, that means a shared project operating lens.

## Scalable Work Discovery

v0.2.6 bounds the project Work and workspace Work Items reads with server-backed pagination while
preserving the existing applied-query contract.

- Interactive lists default to 25 rows and support page sizes of 10, 25, 50, and 100.
- Range, page-size, and previous/next controls sit above results, with synchronized numbered pagination
  below. Desktop rows expose table headers/cells; mobile cards retain visible-page bulk selection.
- The server returns the exact matching count, normalized page, total pages, and previous/next state;
  each response enriches only the visible rows.
- Page and non-default page-size values are URL-backed, survive reload and work-item detail return
  navigation, and participate in browser history. Changing filters, sort, actor, project, saved view,
  or page size starts again at page 1.
- Saved views store durable filters and sort only. Opening a saved or pinned view starts at page 1 with
  the default page size rather than restoring an obsolete result position.
- Project batch triage selects explicit IDs from the visible page only. Navigating or changing the
  applied query clears selection with a status notice. Selection controls are disabled during a bulk write.
- Project and workspace CSV export ignores paging and exports the complete applied result set up to
  10,000 matching rows. Larger exports fail with actionable guidance and no partial file.
- Separate page requests reflect current data rather than a frozen snapshot, so edits can move rows
  between offset-based pages. Each individual response uses a repeatable-read transaction so its exact
  count, page bounds, rows, and enrichment agree.
- The project board uses a separate complete-board endpoint because truncating workflow columns would
  break drag/drop semantics. Focused internal planning and review reads also remain intentionally
  complete and unpaged.

Migration `0016_scalable_search.sql` enables PostgreSQL `pg_trgm` and adds GIN trigram indexes for the
existing display-key, title, and description substring search. The database migration role must be
allowed to install that extension.

## Files In Context

v0.2.7 adds bounded attachments to work item detail. Active members can select multiple files for
sequential upload to active-project work items, inspect compact metadata and capacity, download exact
authorized bytes, and remove files under explicit ownership rules. Uploaders may remove their own
files; owners and maintainers may remove any file. Archived projects remain readable and downloadable
but expose no attachment mutation actions.

The server accepts PNG, JPEG, GIF, WebP, PDF, UTF-8 TXT/Markdown/CSV, JSON, DOCX, XLSX, and PPTX. It
validates filename extension, declared media type, bounded content evidence, and Open XML package
shape where applicable. Limits are 4 MiB per file, 20 live attachments per work item, 50 MiB aggregate
bytes per work item, and 180 Unicode code points per normalized filename.

Downloads are authorized through the API, integrity-checked against stored size and SHA-256 metadata,
forced to `attachment` disposition, marked `private, no-store`, and sent with `nosniff`. Paths, storage
keys, and checksums are not public DTO or ordinary activity fields. Upload and removal activity is
retained without changing the work item's updated timestamp or notifying watchers.

This is not a document-management or content-safety system. Files are not scanned, previewed, rendered
inline, indexed, versioned, or included in reports, exports, notifications, or closeout snapshots. The
current byte adapter uses persistent local disk only; S3, presigned transfer, background processing,
orphan reconciliation, retention policies, and horizontally scaled storage are deferred.

## Project Batch Triage

v0.1.6 adds project-scoped batch triage on the project Work page. Owners and maintainers can select work items on the visible page, apply one explicit update, and review updated, unchanged, and failed result counts without opening each item.

Supported project batch actions:

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

Batch triage is intentionally project-only in v0.1.6. It does not operate across workspace discovery results, board columns, archived projects, or custom query-wide selection sets. Contributors can still open project work and shared project views, but selection and bulk mutation controls are hidden. Archived projects remain readable and keep existing project views openable, but project bulk mutation is blocked in both the UI and API.

The bulk API uses `POST /api/projects/{projectId}/work-items/bulk-update` with an explicit action request. One request can include up to 50 work item ids. Invalid request shape, invalid action references, archived projects, and missing permission reject the request. Item-specific failures return per-row results, so successful and unchanged rows can clear while failed rows remain recoverable in the current visible list.

## Work Breakdown

v0.2.5 adds a bounded parent/child model for decomposing a project deliverable into independently
operated work. A top-level work item may contain direct children, and a child may have one parent in
the same project. A child cannot contain children, so Worktrail never presents or accepts a recursive
tree.

Work Breakdown support includes:

- creating child work directly from an eligible parent with the project and parent preselected;
- assigning, replacing, or clearing a parent from child detail with idempotent no-op handling;
- same-workspace, same-project, self-parent, and exactly-two-level validation under transactional row
  locks;
- parent detail summaries for total, open, done, canceled, estimated, unestimated, and direct child
  estimate points;
- bounded direct-child rows with status, assignee, estimate, and parent/child return navigation;
- compact `Child of` or child-summary context on project/workspace lists, board cards, My Work, live
  Planning, Milestone Review, Cycle Review, report drafts, published report detail, and Markdown;
- canonical `hierarchy=top_level|children|parents` filters and exact `parentKey=WT-12` drill-downs;
- hierarchy query state preserved through applied URLs, filter chips, copy links, saved views, pinned
  views, return URLs, and project/workspace CSV export;
- `parent_key` and `parent_title` export columns for direct hierarchy context;
- activity only for real parent changes, with no hierarchy-specific notification category.

Containment and dependency are intentionally separate. Parent assignment does not block a child,
make a parent depend on its children, move workflow status, assign a milestone or cycle, or roll child
estimates into the parent's own estimate. Every parent and child keeps independent workflow and
planning fields. Child summary points are a derived total shown alongside, not a replacement for, the
parent's direct estimate.

## Milestone Review

v0.1.7 adds a milestone review page at `/projects/:projectId/milestones/:milestoneId`. The page is a derived, read-only operating surface for one milestone. It shows milestone identity, progress, delivery health, scope breakdowns, focused risk sections, and recently changed milestone work without persisting review snapshots.

Milestone review links are query-backed:

- Planning milestone names open the milestone review page.
- Risk sections link into the project Work page with canonical milestone, status, dependency, due-date, and risk query parameters.
- Project Work shows visible chips such as `Risk: Unassigned active` and `Risk: Stale in progress` when those review links are opened.
- Copy-link and CSV export behavior continues to use the applied project Work query after following a milestone review risk link.
- Owners and maintainers can use existing project batch triage from the linked Work page, while contributors can read the review and filtered work without mutation controls.

Milestone review is intentionally current-state only in v0.1.7. Forecasting, roadmap views, critical path analysis, capacity planning, milestone sign-off, historical review snapshots, saved review reports, custom health formulas, and notification rules are deferred.

## Cycle Planning

v0.2.1 adds project-scoped cycles for methodology-neutral execution windows. Cycles are distinct from milestones: milestones represent delivery targets, while cycles represent timeboxed work commitments. Owners and maintainers can create, update, archive, reactivate, and review cycles on active projects. Contributors can read cycle lists, cycle review pages, cycle-filtered work, and report cycle snapshots without mutation controls.

Cycle planning support includes:

- cycle lifecycle management from the project Planning page;
- one active non-archived cycle per project;
- non-overlapping planned/active cycle date ranges within a project;
- optional target points compared with committed and completed work estimates;
- work item cycle assignment on create, detail edit, and project bulk triage;
- project and workspace work-list cycle filters with active chips, copyable URLs, saved views, pinned views, and CSV export support;
- cycle review pages at `/projects/:projectId/cycles/:cycleId`;
- focused cycle progress, scope breakdown, health, risk sections, and recently changed work;
- Planning summaries for active, upcoming, and recently completed cycles;
- active-cycle snapshot sections in generated and published project status reports;
- deterministic seed cycles for local walkthroughs and browser smoke tests.

Cycles are intentionally compact in v0.2.1. Velocity charts, ceremony management, rollover automation, capacity calendars, cycle forecasting, and CSV import cycle assignment are deferred.

## Cycle Closeout

v0.2.4 completes the cycle lifecycle with a guided closeout workflow. Owners and maintainers can preview an active cycle's closing scope, choose one planned destination for all unfinished work or return it to unplanned work, and apply completion plus carryover as one transactional command.

v0.3.0 refines this flow with complete historical groups, deliberate destination selection, collapsed current context, and frozen-outcome sharing.

Closeout behavior includes:

- a read-only preview with cycle identity, health, scope counts, estimate totals, unfinished work, and dependency signals;
- initially unselected planned same-project destinations and an explicit Unplanned choice; unfinished scope requires a deliberate decision even when no planned destination exists;
- atomic cycle completion, immutable closeout evidence, unfinished-work reassignment, and activity creation;
- naturally idempotent retries for the same destination and conflicts for incompatible repeated decisions;
- completed and canceled work retained on the source cycle;
- carried work preserving status, milestone, assignee, labels, estimate, priority, and due date;
- completed Cycle Review leads with frozen project/cycle identity, closing actor/time, health, counts, estimate outcomes, and destination;
- complete Done, Canceled and Unfinished at close groups with independent ten-row pagination and Show all, not a truncated historical preview;
- Current record/destination links with bounded outcome returns, plus a separate collapsed Current context for live assignments and risks;
- Markdown copy/download and print over the complete authorized frozen evidence, independent of the visible page and later record edits;
- compact recent-closeout results and role-aware close actions in Planning;
- honest legacy messaging for completed cycles created before closeout history existed.

Closeout is deliberate and one-way in this baseline. It does not activate the destination cycle, split work across multiple destinations, change workflow statuses, broadcast notifications, or provide reopen/undo.

## Project Reports

Project reports live at `/projects/:projectId/status` and appear as `Reports` in the project shell. Owners and maintainers can generate a report draft from current project state, edit the narrative fields, and publish an immutable report with a stored snapshot. Anyone who can read a published report can copy it as Markdown, download it as Markdown, or open the browser print flow. Contributors can read and export published reports. Archived projects remain readable and exportable, including their existing reports, but cannot publish new reports.

Report workflow:

- The Reports page shows the latest report, previous reports, and a create entry point when the selected actor can publish.
- Draft generation captures project identity, delivery health, health reasons, work counts, active/planned milestone snapshots, active cycle context, risk sections, and recent work.
- Draft pages distinguish generated evidence from editable narrative.
- Owners and maintainers can edit title, report date, summary, highlights, risks, and next steps before publishing.
- Published reports are immutable.
- Published detail pages clearly distinguish stored snapshot values from links that open current project data.
- Published detail pages include `Copy Markdown`, `Download Markdown`, and `Print` actions.
- Markdown exports are rendered server-side from the stored published report and returned from `GET /api/projects/:projectId/status-reports/:reportId/export.md`.
- Markdown exports include metadata, narrative, snapshot counts, health reasons, milestones, active cycle context when present, risk sections, recent work, and relative links back into Worktrail.
- Print styling hides app chrome and sharing controls so browser print output focuses on the report content.
- Milestone rows link to current milestone review pages.
- Cycle snapshot rows link to current cycle review pages.
- Risk sections link to current filtered project Work pages using canonical query parameters.
- Work item preview rows link to current work item detail pages with a return URL back to the report.
- Seed data includes a published Worktrail App weekly status report for local walkthroughs and browser smoke tests.
- Stored report snapshots are parsed through an explicit versioned runtime validator before list, detail, and Markdown export responses are assembled.

Reports are intentionally lightweight. The current baseline does not add post-publication edits, report delete/archive, PDF generation, scheduled delivery, email/push distribution, approvals, comments, custom templates, subscriptions, recipients, public links, export history, analytics, workspace rollups, forecasting, or roadmap reporting.

## CSV Import And Export

v0.0.7 added project-scoped CSV work item import and CSV export for both project lists and workspace discovery. v0.1.2 tightened export trust by routing export requests through applied canonical query state. v0.2.6 keeps exports independent of the visible page and adds a 10,000-row synchronous safety limit.

Import is a two-step flow:

1. Preview validates a CSV file and returns normalized rows without creating work.
2. Apply revalidates the same CSV and creates all rows transactionally.

If any row is invalid during apply, no work items are created. Project and workspace exports use the same applied filters as the visible list or discovery view, but ignore page and page size so the CSV contains every matching row rather than only the visible page. Exports include cycle context and direct parent key/title context where present. A synchronous export is limited to 10,000 matching rows; an oversized request returns an error without a partial download. CSV import does not assign cycles or parent relationships.

Optional `description_format` accepts `plain_text` or `markdown_v1`; missing or blank values default
to plain text. Quoted multiline descriptions preserve whitespace while normalizing line endings to
LF, with a 10,000 normalized UTF-16 code-unit limit. Preview shows the format and a bounded escaped
source excerpt, not rendered content. Summary exports deliberately omit description/format and are
not round-trip import files. A ready-to-import [multiline example](docs/v0.2.9/authored-work-items.csv)
demonstrates Markdown, explicit plain text, and the blank-format default.

The detailed CSV guide is in [docs/v0.0.X/v0.0.7/csv-import-export.md](docs/v0.0.X/v0.0.7/csv-import-export.md).

## Relationships And Dependency Signals

v0.0.8 adds work item relationships and derived dependency visibility.

Relationship support includes:

- directional `blocks` relationships;
- symmetric `relates_to` relationships;
- same-project and cross-project relationships within the same workspace;
- duplicate, self-link, cross-workspace, archived-project, and blocking-cycle rejection;
- relationship add/remove controls on the work item detail page;
- grouped detail views for `Blocked by`, `Blocks`, and `Related work`;
- relationship activity events on the work item where the relationship command is performed.

Dependency signals are derived from open blocking relationships. A work item is dependency-blocked when it has at least one open upstream blocker. Terminal blockers, currently `done` and `canceled`, do not keep downstream work dependency-blocked.

The project work item list, cross-project workspace discovery, saved work views, and CSV export all support the same dependency filter values:

- `dependency=dependency_blocked` finds open work blocked by upstream open work.
- `dependency=blocking_open_work` finds open work that blocks downstream open work.

My Work includes a dependency-blocked assigned summary and section. Planning and cycle review include dependency-blocked work and blocking-open-work risk sections. The OpenAPI reference documents the relationship endpoints, dependency query parameter, and relationship DTOs.

## Delivery Health, Planning, And Review

Derived delivery health appears on project overview and planning surfaces.

Delivery-health support includes:

- project-level health states: on track, at risk, blocked, complete, and inactive;
- compact delivery-health panels on project overview;
- compact Planning delivery-health summaries with explicitly labeled milestone and open-work counts;
- live-view framing on Planning, Milestone Review, and Cycle Review pages;
- execution-first cycle summaries with active dates, goal, scope, estimate gaps and closeout readiness,
  followed by upcoming and recently completed windows;
- cycle review pages with target progress, scope breakdown, risk, and recent-movement detail;
- contextual Reports/Draft report commands without a large report promotion ahead of live evidence;
- milestone health labels and explainable reason chips;
- milestone review pages with scoped health, risk, and recent-movement detail;
- reason links into filtered project work item lists when the current work-item query model supports the reason;
- populated Planning risk groups with exact counts/continuation, separate milestone targets and
  disclosed recent-review groups; zero-risk categories collapse to a quiet scoped state;
- existing cycle/milestone records before disclosed creation and per-record editing, with independent
  drafts, row-specific mutation feedback and existing contributor/archived-project read-only rules;
- deterministic seed examples for blocked, at-risk, healthy, complete, inactive, and unmilestoned risk scenarios.

Delivery health is derived at read time from milestones, cycles, work item status, due dates, assignees, stale in-progress work, estimates, and dependency relationships. It is not stored in the database and does not trigger automatic workflow transitions.

Work lists support estimated/unestimated filtering, including saved/pinned views, copy and return links,
and CSV export. Zero is estimated; only a missing estimate is unestimated. Filters remain drafts until
Apply; chips describe applied results. Risk sections use explicit units and category sums are risk
signals, not unique-ticket totals. New report/closeout snapshots use v2 with precise unestimated-work
links; v1 evidence remains readable, publishable and replayable.
See the [query, risk and snapshot policy](docs/v0.3.0/query-policy.md).

Aggregate dashboards evaluate narrow work facts and enrich selected previews, not every matching work
item. Planning risk previews show five rows with exact totals and full-list continuation; Portfolio
metadata is batched across projects. Complete boards and historical closeout evidence remain complete.
See the [aggregate read measurements and limits](docs/v0.3.0/aggregate-evidence.md).

## Verification

For the Drizzle migration boundary, `npm run verify:upgrade` independently installs v0.3.0 and the
current snapshot, proves populated-data/attachment preservation, and runs backend/compiled-API
acceptance in disposable PostgreSQL. It needs Docker and the local `v0.3.0` tag, not Chromium.
See [upgrade and rollback guidance](docs/operations.md#v031-toolchain-boundary). This explicit
boundary proof is not an extra default CI job or a per-edit requirement.

The verification runner owns disposable resources for the full workflow and focused checks:

```sh
npm run verify
npm run verify -- --mode=checks
npm run verify -- --mode=api
npm run verify -- --mode=api --api-tests=server,work-item-csv-http
npm run verify -- --mode=web
npm run test:e2e
npm run test:preview
npm run test:editor
npm run test:site
npm run check:site
```

Run `npm ci` first. Full/web/E2E/preview/editor/site modes also need `npx playwright install chromium`
(Linux may need `npx playwright install --with-deps chromium`). Start Docker Desktop for
full/checks/API/E2E/preview modes, or explicitly select service provisioning below.
Process ownership uses macOS/Linux `ps` and POSIX process groups. Web, editor and site modes never
provision or connect to PostgreSQL. `npm run check:site` is the browser-free, read-only site check;
site mode additionally renders the real Pages subpath with keyboard/reflow/motion assertions.

`npm run verify` defaults to full verification: strict production and bounded development dependency
audits, lint, scoped test/config typechecks, workspace typechecks, scratch schema generation,
resource/API/contracts/Angular tests, production build,
standalone editor, application E2E, compiled preview, and static/rendered site checks including local
assets/fragments, repository documentation paths and release metadata. Angular unit tests use
Vitest 4 in real Chromium through the standard Angular `test` target. There is no legacy runner
partition. Independent CI jobs retain their own failure reports.
Standard runner modes do not install dependencies or browser binaries themselves.

For focused frontend checks without a database or application server:

```sh
npm test --workspace @worktrail/web
npm run test:web
npm test --workspace @worktrail/web -- --include=src/app/core/api/attachments-api.spec.ts
npm run test:web -- '--filter=display helpers'
npm run test:web -- --watch --include=src/app/core/api/attachments-api.spec.ts
npm run test:web -- --watch --headed --include=src/testing/web-toolchain.spec.ts
```

The default covers every discovered spec. Repeat `--include` for multiple literal paths; no globs.
An empty or missing selection fails. Automated runs own their source snapshot, loopback ports and
build/cache outputs, then remove them. Explicit `--watch` reads live working source; `--headed`
opens Chromium for interactive debugging and requires watch mode. Interactive sessions are not
acceptance evidence. Stop them with Ctrl+C. Reports and failure screenshots remain under
`test-results/verification/<run-id>/web/`. See
[developer guidance](docs/development.md#testing-and-verification).

Fresh installation checks are separate, deliberately slower commands:

```sh
npm run verify:setup -- development
npm run verify:setup -- preview
```

Each installs the lockfile into a new owned source snapshot, provisions its own PostgreSQL container,
sets one absolute attachment root before seed/runtime, reloads a deep link and compares both seeded
downloads byte-for-byte. Runtime startup uses the same source/compiled application with owned
identity wrappers and random ports instead of ordinary local defaults. These are not remote-clone
or deployment checks. See [local verification scope](docs/operations.md#isolated-verification).

Use checks proportional to the change, not full verification after every implementation phase.
API mode includes backend source/test lint, backend typechecking, resource-safety tests, and API tests;
it does not run Angular, editor, application E2E, production build/preview, or site checks.
`--api-tests` selects comma-separated filenames from `apps/api/tests` without `.test.ts`; nonexistent
files and path/option injection are rejected. Omit it for the whole API suite. Database-backed tests
still require the owned runner, even when selecting a single file. E2E/editor/preview modes support `--grep`.
API test console output is retained for failing tests only; test results and failure diagnostics remain visible.
Backend-only edits normally need affected API checks; shared HTTP/persistence infrastructure warrants
the full API suite. Frontend/shared-contract edits include affected consumers and browser flows;
documentation-only edits need links/format checks. Full verification remains the release-closeout
and CI merge gate, and is appropriate for genuinely cross-cutting/toolchain changes. Omitted checks
are not applicable, not claimed passed. Successful unchanged-code evidence can be reused after
documentation-only updates. Machine-readable contracts, fixtures, and build inputs are not docs-only.

Each run snapshots source, configuration, and documentation into a private temporary workspace.
Build outputs and Angular caches cannot overwrite the working checkout or another run's preview.
Installed dependencies are shared read-only; compiled contracts resolve inside the private workspace.
Source/configuration changes after startup require a new invocation for affected checks, including
in interactive UI mode; documentation-only updates do not invalidate unchanged-code evidence.

By default, database-using modes create their own PostgreSQL 16 Docker container/database and absolute temporary
attachment root. The runner migrates, seeds matching attachment objects before browser startup,
and generates an absolute Angular proxy for its selected API port. It never reuses an unrelated
server, resets working data, or restores the developer's demo database after tests.

To provision a separate test database on an explicitly selected service, set
`WORKTRAIL_VERIFY_ADMIN_DATABASE_URL` to its administrative PostgreSQL connection, then run:

```sh
npm run verify -- --mode=api --database=service
```

This requires CREATE DATABASE privileges and never resets the administrative database. Omit
`--mode=api` for the full workflow. Do not put credentials in committed files or verification reports.
Every test mutation requires matching private
run/database/storage ownership; a local hostname, test-looking name, `CI=true`, or skip flag is not proof.
Direct database-backed package tests without that context refuse to run. The existing API unit
project remains database-independent, and unknown new test files default to guarded integration.

SIGINT/SIGTERM and failure cleanup preserve the primary outcome. If a crash or ownership mismatch
leaves resources, retain the private manifest path printed at startup and inspect it locally before:

```sh
npm run verify -- --cleanup /absolute/run/manifest.json
```

Cleanup refuses active owners or mismatched identities; it is not permission to remove arbitrary
databases/directories/processes. Sanitized gate summaries, browser JSON reports, traces, and screenshots
remain under `test-results/verification/<runId>/`. Browser acceptance uses zero retries.
See the [v0.3.0 verification evidence](docs/v0.3.0/verification-notes.md).
The [developer ownership guide](docs/development.md) describes persistence scopes, database effects,
query sequencing, test fakes, and project lock participation. The
[cycle diagnostic guide](docs/cycle-diagnostics.md) covers read-only schedule inspection and deliberate
operator remediation with `npm run db:cycle-diagnostics`.

Ports are selected automatically. To request ports or select a focused browser regression:

```sh
npm run test:e2e -- --api-port=44031 --web-port=44032 '--grep=workspace filters'
npm run test:preview -- --preview-port=44033
npm run test:e2e:ui
npm run verify -- --mode=e2e --shard=1/3
```

An explicitly occupied port fails without stopping its occupant. Automatic bind handoff collisions
retry server allocation at most three times, not the tests. Legacy `API_PORT`,
`WORKTRAIL_E2E_WEB_PORT`, `WORKTRAIL_PREVIEW_PORT`, and `WORKTRAIL_EDITOR_TEST_PORT` requests are also
honored; the runner supplies the corresponding base URLs, storage, and proxy configuration.
UI mode is interactive, not automated acceptance; closing it does not mark its tests as passed.

Database-independent checks and resource lifecycle regressions are also available:

```sh
npm run test:verification
npm run test:verification:integration
npm run audit:dependencies
npm run test --workspace @worktrail/api -- --project=unit
npm run lint:verification
npm run typecheck:verification
```

The lifecycle command requires Docker and proves service provisioning, rejection, interruption,
concurrent browser isolation, and cleanup. Direct Playwright invocations are internal and require
the matching owned stage; use the root commands instead. Skip flags grant no ownership authority.

CI runs the full coverage in independent required jobs: backend/contracts/tooling (`--mode=checks`),
frontend (`--mode=web`), three application browser shards, compiled preview, editor and site. Each
application shard runs one worker against its own disposable PostgreSQL 16 service/database/store;
tests never run concurrently against a shared fixture. Matrix fail-fast is disabled and browser
retries remain zero, so failures do not suppress later tests or other shards. The existing `Verify`
status requires every job to succeed, including rejecting skipped or canceled jobs. Superseded runs
on the same PR/ref are canceled; this does not truncate the current commit's failure reporting.

Comprehensive CI runs on pull requests only; merges into `main` do not repeat it. Direct pushes to
`main` are not verified, so use PRs with required checks against the current base branch. The separate
Pages workflow still validates and deploys the public site on pushes to `main`.

Sanitized summaries and browser evidence are uploaded for every job, not just failures. This shortens
the serial critical path at the cost of additional runner setup; actual GitHub timing must be measured
after publication. Local `npm run verify` still runs the complete serial release workflow.
`--mode=checks` includes audits, verification/backend/contracts lint and types, schema generation,
resource/API/contracts tests and contracts/API builds, without repeating frontend checks. Shards
accept bounded `N/M` selections only in non-interactive E2E mode; omitting `--shard` runs all journeys.

`npm run audit:dependencies` reports production and full audits
separately and validates the installed workspace peer graph. Production findings always fail.
Reviewed development exceptions are exact advisory/
package/path/version/severity records with an owner, exposure limits, mitigation, follow-up, and expiry;
unknown findings, stale records, transport failures, or expired exceptions fail the gate.
See the [current dependency disposition](docs/v0.3.1/dependency-remediation.md) and
[exception data](docs/security/development-audit-exceptions.json). The independent v0.3.1 Phase 8 installation
reports zero production/full audit findings, valid workspace peers and no active exceptions. This is a point-in-time
audit result, not a guarantee against undisclosed vulnerabilities; release acceptance is still pending.

## Public Site

The static product site lives in [site/index.html](site/index.html), with the configured Pages address
<https://jeremyaaron.github.io/worktrail/>. The main-branch Pages workflow validates local assets,
fragments, repository documentation paths and release metadata before uploading `site/`.
`npm run check:site` performs that read-only check; `npm run test:site` adds owned rendered acceptance
at the actual repository subpath without a database. See [site/setup evidence](docs/v0.3.0/site-setup-evidence.md).

## Demo Walkthrough

After migrating and seeding the database, open <http://localhost:4200>.

Seeded data includes:

- one workspace;
- active owner, maintainer, and contributor members;
- one inactive historical member with seeded references;
- four active projects and one archived project;
- project milestones with due dates and lifecycle state;
- active, upcoming, and completed Worktrail App cycles with target points and scoped work;
- an isolated Closeout Lab with an active source cycle, planned destination, mixed terminal and unfinished scope, and dependency-blocked carryover;
- work items across every status with persisted board positions;
- two exact downloadable attachments on `WT-3`, with distinct seeded uploaders and activity;
- 18 active Worktrail App items, which produce two pages when the page size is set to 10;
- same-project, cross-project, and related-work relationships;
- dependency-blocked examples where open blockers count and terminal blockers do not;
- active work item watchers, comment mention metadata, unread notifications, and one read notification;
- personal saved work views for each active seeded member, workspace-shared saved views for team operating lenses, and project-scoped shared/personal saved views for project rituals;
- published Worktrail App and Reference Operations status reports with snapshot data for milestone, cycle, risk, recent-work, and Portfolio review;
- project labels, comments, deleted-comment tombstones, project activity, and workspace activity events.
- Markdown requirements on `WT-1`, reproduction steps and inert unsupported source on `WT-2`,
  literal plain text and a code-bearing comment with explicit mentions on `WT-3`, and formatted
  read-only context on archived `LEGACY-1`.

Use the `Acting as` selector in the top bar to switch the local placeholder actor. The selector only shows active members. This is intentionally local-only behavior and is not production authentication; the API derives the actor role and active state from the selected member record instead of trusting a client-supplied role.

Suggested walkthrough:

1. Open My Work and review the selected actor's assigned open, due soon, overdue, blocked, stale, and reported work counts.
1. Click a My Work summary count to open the cross-project Work Items page with URL-backed filters applied.
1. Change cross-project filters for project, assignee, reporter, status, type, label, milestone, priority, due date, blocked state, archived projects, and sort.
1. Open a seeded workspace shared view such as `Dependency risks`, confirm the active chips and result set match the saved query, and copy the filtered workspace view link.
1. Save a useful cross-project filter as a personal saved view, reload the page, and reopen it.
1. As an owner or maintainer, save the applied workspace filter as a shared saved view, then rename, update, and delete it from the saved-view manager.
1. Switch to a contributor, open a shared saved view, and confirm shared-view management controls are not available.
1. Copy the filtered workspace view link, open it in another tab, and confirm the same applied chips and results appear.
1. Use the global Create work item route, select a project, choose project-dependent labels or milestones, create work, and open the created item.
1. Open Portfolio and compare Worktrail App, Cloud Readiness, and Reference Operations across delivery health, report freshness, planning context, and dependency pressure.
1. Filter Portfolio by health or report freshness, follow its primary dependency-pressure action into project Work, then return and expand Details and links to open the latest Worktrail App report. Attention previews are a separate disclosure below the comparison.
1. Open Projects, search by project name or key, and review project summary signals for open, blocked, overdue, status, and last updated state.
1. Open Workspace Settings from the top-bar gear and review role summaries, members, and workspace activity.
1. As Avery Owner, create a contributor, promote the member to maintainer, deactivate the member, and reactivate the member.
1. Confirm the actor selector updates when active members are created, changed, deactivated, and reactivated.
1. Switch to a maintainer, open Projects and select New project, then create a project with an explicit key and confirm focus returns to its directory link.
1. Switch to a contributor and confirm member administration is unavailable with clear helper copy.
1. Open the Worktrail App project.
1. Open Work, change the page size to 10, move to page 2, open a work item, and use the return link to confirm the page position is preserved.
1. From page 2, export CSV and confirm the file contains all filtered Worktrail App rows rather than only the visible page.
1. Review the project key, status counts, recently updated work, and activity.
1. Open seeded parent `WT-12`, review its five direct children and derived summary, and use `Add child work item` to create another child with the parent preselected.
1. Open a seeded child, replace and restore its parent, and confirm parent-change activity without dependency or workflow changes.
1. Use `View all child work`, the pinned `Child work` view, and the board to inspect exact-parent filters and compact hierarchy context.
1. Open Planning and review delivery health, cycle context, milestone progress, overdue/due-soon work, blocked work, unassigned work, and stale work.
1. Open the Cycles planning view, review the seeded active cycle, and open the cycle review page.
1. Follow a cycle risk link into filtered project work and confirm the cycle chip remains applied.
1. Create a work item in the active cycle, then update or clear cycle assignment from the detail page.
1. Use project bulk edit to set or clear cycle assignment for selected visible work.
1. Open Closeout Lab, switch to Morgan Maintainer, and review the active `Closeout Demonstration` cycle.
1. Choose `Close cycle`, verify the mixed completed, canceled, estimated, unestimated, and dependency-blocked scope, and explicitly select `Follow-up Validation` (nothing is selected initially).
1. Confirm closeout, review the immutable outcome, and open Current context only when inspecting live assignments/risks.
1. Follow the destination-cycle link, then open a carried snapshot item and verify its current cycle assignment and cycle-change activity.
1. In Closeout Lab's Cycles view, open either `Historical carryover: 12 unfinished` versioned scenario. Page through all twelve original commitments or choose Show all; compare a Current record's revised title, status, estimate and assignment with its unchanged historical row. Copy/download Markdown or print while on a partial page and confirm all twelve records are included. See [historical outcome evidence](docs/v0.3.0/historical-closeout-evidence.md) for direct scenario routes and limitations.
1. Open a milestone review page, inspect progress, health, risk, and recent movement, then follow a risk link into filtered project work.
1. Review dependency-blocked and blocking-open-work planning sections, then follow a dependency list link into filtered project work.
1. Open Project Status, review the seeded weekly report with cycle context, copy it as Markdown, download the Markdown export, print the page, and follow one milestone, cycle, or risk link into current project data.
1. As an owner or maintainer, create a new status report, edit the narrative, publish it, and confirm the detail page shows a published snapshot notice.
1. Switch to a contributor and confirm published reports remain readable and exportable while the create action is unavailable.
1. Create a milestone, then create a work item assigned to that milestone.
1. Edit the project work list search and filters, then select Apply; confirm active chips and results change together.
1. Filter by dependency state to find dependency-blocked work or work blocking downstream items.
1. Copy the filtered project work item list link and reload it to confirm the same applied view.
1. Open a seeded pinned workspace view such as `Dependency risks` directly from the pinned shortcuts area.
1. Open a seeded project shared view such as `Ready for QA`, confirm the project URL, active chips, and rows match the saved query, then copy the filtered project link.
1. Pin a personal saved view from the saved-view manager, navigate away, and reopen it from the pinned shortcuts area.
1. Switch to a contributor, open a shared pinned project view, and confirm shared project management controls are unavailable while personal project views remain available.
1. Save a dependency-filtered project view, reload, and reopen it.
1. As an owner or maintainer, select visible project work items, apply a project batch triage action such as adding a label, and review updated, unchanged, and failed result counts.
1. Switch to a contributor and confirm project batch mutation controls are unavailable.
1. Export the currently filtered project work item list to CSV.
1. Import a small CSV through the project import page, review dry-run validation, apply it, and confirm created work appears in the project list and board.
1. Export a filtered cross-project workspace discovery view to CSV.
1. Open Inbox and review unread notifications for the selected actor.
1. Mark an individual notification read, switch to All, and mark it unread again.
1. Open the board, drag cards within a column to set planning order, reload, and confirm the order persists.
1. Move a card through valid workflow columns with drag/drop or the status menu.
1. Open `WT-1` and read its requirements; preview a description edit before saving. Open `WT-3` and
   confirm its legacy punctuation is literal while its formatted code comment remains readable.
1. Open the work item detail page, update fields, change milestone and cycle assignment, watch or unwatch the item, mention an active member in a new comment, add and edit another comment, delete a comment, and review activity.
1. Switch to the mentioned actor and confirm the mention appears as an unread Inbox notification linking back to the work item.
1. Add a blocking relationship, confirm the downstream dependency signal appears, move the blocker to done, and confirm the dependency signal clears.
1. Open the archived project to confirm read-only project, milestone, cycle, work item, label, comment, relationship, import, transition, saved-view mutation, batch triage, and status report behavior.


1. Open the Worktrail App project overview and review the compact delivery-health panel.
2. Follow a delivery-health reason link into a filtered project work item list.
3. Open Planning and review project delivery health, cycle summaries, milestone health labels, and milestone reason chips.
4. Review Needs attention, Upcoming, and Recently changed planning review sections.
5. Open milestone review from Planning and follow a risk section into project Work with milestone and risk chips applied.
6. Open cycle review from Planning and follow a risk section into project Work with cycle and risk chips applied.
7. Confirm blocked and dependency-blocked seed items affect project and cycle health, while the healthy milestone remains on track.

## Current Baseline Capabilities

- My Work dashboard for the selected active actor.
- Prioritized My Work daily queue for assigned, due-soon, overdue, blocked, dependency-blocked, stale, reported, and recently updated work.
- Inbox with unread/all views for actor-scoped collaboration notifications.
- Unread notification count badge in primary navigation and Inbox summary from My Work.
- Notification read/unread actions and mark-all-read support.
- Top-level Portfolio review for workspace-wide active project comparison.
- Portfolio summary counts for active, on-track, at-risk, blocked, overdue, dependency-pressure, and stale/missing-report projects.
- Portfolio attention sections for delivery risk, communication freshness, current execution, and dependency pressure.
- Portfolio project rows with delivery health, health reasons, work metrics, report freshness, latest report details, active milestone context, and active cycle context.
- Portfolio drill-down links into Overview, Work, Planning, Reports, latest reports, milestone review, cycle review, and risk-specific filtered Work views.
- Top-level Work Items destination for cross-project discovery.
- Dashboard summary counts linked to filtered cross-project discovery.
- Cross-project work item discovery with URL-backed search, filters, sorts, project identity, archived-project modes, and active filter pills.
- Server-backed pagination for project Work and workspace Work Items with exact totals, visible ranges, direct page navigation, and 10/25/50/100 row sizes.
- URL-backed page navigation that preserves non-default page state through reload, copied links, browser history, and work-item detail return URLs.
- Durable saved-view query state kept separate from transient page and page-size state.
- Canonical work item query helpers for form state, route params, saved views, return URLs, dashboard links, delivery-health links, and exports.
- Copy-link actions for workspace and project filtered work item views.
- Reloadable filtered URLs whose active chips and result set survive browser refresh.
- Compact mobile work item cards for readable work scanning on narrow screens.
- Personal saved work views with create, open, rename, update, delete, duplicate-name validation, and stale-query tolerance.
- Workspace-shared saved work views visible to all active members.
- Owner and maintainer shared-view management for create, open, rename, update, and delete.
- Contributor read-only access to workspace-shared saved views with role-aware UI copy.
- Project-scoped saved work views on project Work pages, split into shared project views and personal project views.
- Seeded shared project views for release blockers, ready-for-QA queues, unassigned project work, current milestone risk, and open dependency risks.
- Pinned saved-view shortcuts on workspace Work Items and project Work pages.
- Pinned shared workspace views for seeded operating lenses such as dependency risks and ready-for-pickup queues.
- Pinned shared project views for seeded project lenses such as release blockers and ready-for-QA queues.
- Pinned personal views visible only to the owning actor.
- Pin and unpin controls in the saved-view manager for mutable saved views.
- Shared pinned-view activity for workspace and project operating-surface changes.
- Owner and maintainer management for shared project views, with contributor read access and personal project-view creation.
- Archived projects keep project saved views openable while blocking project-scoped saved-view mutations.
- Project Work page multi-select for owners and maintainers, explicitly limited to loaded rows on the visible page.
- Explicit project bulk edit mode that hides selection controls until the mode is entered.
- Project-scoped bulk updates for assignee, priority, milestone, due date, labels, and status transitions.
- Bulk update result summaries for updated, unchanged, and failed rows.
- Partial-success handling that clears successful and unchanged selections while retaining failed visible rows.
- Contributor and archived-project absence paths for project bulk mutation controls.
- Same-project, exactly-two-level Work Breakdown with one optional direct parent per work item.
- Parent-aware child creation and focused assign, replace, clear, no-op, conflict, and archived-project paths.
- Transactional hierarchy validation with deterministic row-lock ordering.
- Parent detail summaries and bounded direct-child rows with parent/child return navigation.
- Compact parent and child-summary context on lists, board cards, My Work, and live review/report surfaces.
- Canonical top-level, child, parent-with-children, and exact-parent query state across URLs, chips, copy links, saved/pinned views, return URLs, and CSV export.
- Direct parent key/title columns in project and workspace CSV exports.
- Seeded `WT-12` through `WT-18` Work Breakdown walkthrough and pinned shared `Child work` view.
- Milestone review pages for focused progress, health, scope, risk, and recent movement.
- Query-backed milestone review risk links into project Work.
- Project cycle lifecycle management for planned, active, completed, and canceled cycles.
- One active non-archived cycle per project and overlap validation for planned/active cycles.
- Work item cycle assignment on create, detail edit, and project bulk triage.
- Cycle filters on project and workspace work lists with active chips, copy links, saved views, pinned views, and CSV export support.
- Cycle review pages for focused progress, target points, scope, health, risk, and recent movement.
- Query-backed cycle review links into project Work.
- Planning summaries for active, upcoming, and recently completed cycles.
- Guided owner/maintainer cycle closeout with a read-only preview and one explicit carryover destination.
- Transactional source-cycle completion, immutable closeout evidence, unfinished-work reassignment, and bounded activity fan-out.
- Idempotent matching closeout retries and conflict protection for incompatible repeat decisions.
- Completed Cycle Review snapshot results with closing actor/time, target and estimate totals, retained/moved counts, destination links, and historical item summaries.
- Explicit snapshot-versus-live framing and honest legacy completed-cycle behavior when no closeout record exists.
- Compact Planning closeout outcomes and role-aware closeout entry points.
- Active-cycle context in generated and published project status report snapshots.
- Hidden `workRisk` query support with visible project Work chips for review-driven risk states.
- Project status report list, draft, publish, and detail pages under the project shell.
- Project shell navigation labels report routes as `Reports` while preserving existing `/status` paths.
- Generated status report drafts that reuse current project health, milestone, active-cycle, risk, and recent-work signals.
- Report drafts split generated evidence from editable narrative.
- Immutable published status reports with stored JSON snapshots and edited narrative fields.
- Runtime validation for persisted report snapshots before list, detail, and Markdown export responses.
- Status report links from stored milestone snapshots into current milestone review pages.
- Status report links from stored risk sections into current filtered project Work pages.
- Status report work item preview links with return URLs back to the report.
- Server-rendered Markdown export endpoint for published status reports, including active-cycle snapshot sections when present.
- Reader-facing status report actions for copying Markdown, downloading Markdown, and browser print.
- Print-friendly status report detail layout that hides app chrome and action controls.
- Contributor read access to published reports, including reports for archived projects.
- Contributor export access to published reports, including reports for archived projects.
- Owner/maintainer-only report publishing for active projects.
- Saved-view summaries that suppress default query noise and count meaningful applied filters, including cycle filters.
- Global quick work capture at `/work-items/new` with active project selection and project-dependent labels and milestones.
- Project-scoped work item creation still works with the project preselected and the same success actions.
- Persistent project shell with project identity, status, delivery health, and consistent Overview, Work, Board, Planning, and Settings navigation.
- Project navigation summaries with project search by name/key, active/archived grouping, open count, blocked count, overdue count, and updated timestamp.
- Workspace settings for workspace name, role summary, member administration, and workspace activity.
- Owner-only member creation, profile editing, role changes, deactivation, and reactivation.
- Server-derived actor roles from selected member records.
- Active/inactive member handling across actor selection, assignment controls, filters, historical assignees, comments, and activity display.
- Permission-aware UI copy for owner-only, owner/maintainer-only, archived-project, inactive-member, and terminal-work-item states.
- Project creation with optional explicit project keys and role-aware disabled states.
- Lazy-loaded Angular route components that keep the production initial bundle below the configured warning budget.
- Project keys and immutable work item display keys.
- Project settings for metadata, archive/reactivate, and label administration.
- Project-scoped milestones with due dates, archive/reactivate behavior, assignment on create/edit, and activity coverage.
- Planning dashboard with milestone progress, due-soon/overdue work, blocked work, unassigned work, stale work, and links back into filtered lists.
- Review-first planning with Planning Review and Milestones views.
- Planning links from milestone rows and milestone review items to focused milestone review pages.
- Project work item list search and filters for status, type, priority, assignee, reporter, label, milestone, cycle, due date, dependency state, and sort.
- Project-scoped CSV import with dry-run preview, normalized rows, row-level validation errors, and transactional apply.
- Project and workspace CSV export that serializes the currently applied filters through canonical query params, ignores paging, includes cycle and direct-parent context where present, and rejects more than 10,000 matching rows without returning a partial file.
- CSV import/export guide under `docs/v0.0.X/v0.0.7/csv-import-export.md`.
- Work item relationships with directional `blocks` and symmetric `relates_to` semantics.
- Cross-project relationships inside the same workspace with project identity shown in relationship rows.
- Blocking-cycle, duplicate, self-link, cross-workspace, and archived-project relationship write validation.
- Work item detail relationship sections for inbound blockers, outbound blocked work, and related work.
- Derived dependency counts on list rows, including compact `Blocked by` and `Blocks` indicators.
- Dependency filters on project work item lists and cross-project workspace discovery.
- Saved work views and CSV export support for dependency filters.
- My Work dependency-blocked assigned summary and section.
- Planning and cycle review dependency risk sections for dependency-blocked work and work blocking open downstream items.
- Project overview delivery-health panel with health state, milestone risk counts, open-work count, top reasons, and planning link.
- Planning delivery-health summary with active, on-track, at-risk, blocked, and open-work counts.
- Cycle health summary with committed estimate points, completed estimate points, target point comparisons, dependency risk, unestimated work, and unassigned work signals.
- Milestone health labels and explainable health reason chips on planning progress rows.
- Planning review sections for needs attention, upcoming work, and recently changed work.
- Delivery-health reason links into filtered project work item lists where the reason can be represented by current query parameters.
- Deterministic seed data for healthy, at-risk, blocked, complete, inactive, unmilestoned, and current-cycle delivery-health examples.
- Relationship activity events for add/remove commands.
- In-app notification persistence for assignments, mentions, watched comments, watched work changes, and dependency blocker changes.
- Work item watch/unwatch controls with watcher count and compact watcher list on detail pages.
- Work item detail sections grouped around Summary, Act, Collaborate, Dependencies, and History.
- Independently loaded work item attachment metadata, policy, usage, and role-aware capabilities.
- Sequential multi-file attachment upload with per-file progress, partial failure, retry, and compact
  responsive queue states.
- Authorized integrity-checked attachment download with forced download disposition and defensive
  cache/content headers.
- Uploader, owner, and maintainer attachment removal with retained safe activity and archived-project
  read-only behavior.
- Dependency alerts on work item detail pages when work is blocked by open work or blocking downstream open work.
- Automatic watching for work item reporters, assignees, and newly assigned members.
- Comment mentions through an active-member picker, persisted mention metadata, and readable mention chips.
- Persisted board ordering for same-status reorder and cross-status movement.
- Angular CDK drag/drop board interaction backed by server-side workflow validation.
- Comment add/edit/delete with role-aware UI affordances and deleted-comment tombstones.
- Explicit plain-text/Markdown source formats for descriptions and comments, a shared authoring
  toolbar and faithful preview, inert allowlisted presentation, and unchanged legacy-source support.
- Workspace, project, milestone, label, work item, board movement, shared saved view, personal saved view, and comment lifecycle coverage through tests and activity where applicable.
- Archived projects remain readable and block project, milestone, work item, label, comment, and transition writes.
- Runtime configuration validation with development defaults and production-mode requirements.
- Production preview from built Angular and compiled API artifacts.
- Express static serving with SPA deep-link fallback that does not swallow `/api/*` routes.
- Liveness and database readiness endpoints at `/api/health/live` and `/api/health/ready`.
- OpenAPI reference under `docs/api/openapi.yaml`.
- Operations runbook for runtime modes, environment variables, migrations, seed/reset flow, preview, health checks, troubleshooting, and future cloud mapping.
- ESLint guardrails for API, web, and contracts workspaces.
- GitHub Actions CI for production audit, lint, typecheck, package/editor/application browser tests,
  and compiled production build/preview with a disposable Postgres service.

## Current Limitations

- Authentication is represented by local request headers and the top-bar actor selector.
- Permissions are enforced against local member records and are useful for exercising policy paths, but they are not production authentication.
- Production preview is not a secure public deployment and should not be exposed as an authenticated product.
- Milestone review and delivery health are deterministic and rule-based; custom health formulas, forecasting, capacity planning, roadmap views, critical path analysis, charts, delivery-health notifications, and milestone sign-off are deferred.
- Cycle planning is intentionally lightweight. Velocity charts, ceremony management, automatic rollover/closeout, member capacity calendars, cycle forecasting, cycle templates, retrospective tooling, closeout notifications, split carryover destinations, and safe reopen/undo are deferred.
- Project status reports are immutable after publication. Report edits, report delete/archive, PDF generation, scheduled delivery, email/push distribution, approvals, comments, custom templates, subscriptions, recipients, public links, export history, analytics, workspace rollups, forecasting, and roadmap reporting are deferred.
- Notifications are in-app only. Email, push, WebSockets, digests, notification preferences, deletion/archive controls, and background delivery workers are deferred.
- Descriptions/comments support a bounded Markdown source profile, not WYSIWYG editing, full GFM,
  tables, interactive task lists, inline images, syntax highlighting, or coauthoring. Report narrative
  and snapshots are not migrated to this content model.
- Comment mentions are selected through an active-member picker. Free-text `@name` parsing is deferred.
- Watchers are work-item scoped only. Project-level and workspace-level watching are deferred.
- Saved views support workspace and project scopes with personal/shared visibility and pinned shortcuts. Custom pinned ordering, saved-view folders, icons, colors, descriptions, ownership transfer, custom permissions, short links, and analytics are deferred.
- Portfolio review is read-only and active-project focused. Comparison filters are local over the complete returned rows; saved/URL-backed Portfolio queries, custom sorting, charts, exports, stored snapshots, historical review, and cross-project mutation workflows are deferred.
- Batch triage is project-scoped and works on explicit visible selections only. Cross-project bulk edit, board bulk actions, bulk delete, bulk comments, query-wide durable selection sets, background jobs, and custom bulk permissions are deferred.
- Copy-link support uses browser clipboard APIs and a textarea fallback. Native share sheets, short links, and permission customization are deferred.
- CSV import is project-scoped and limited to 1 MiB and 250 data rows per file.
- CSV import supports Worktrail's current columns only; third-party tracker migration mappings are deferred.
- CSV import does not assign cycles or parent relationships; cycle and hierarchy data are currently export-only.
- CSV and status report Markdown export are direct file downloads; export history, scheduled exports, and additional report formats are deferred.
- Project and workspace Work pagination uses exact counts and offset windows. Separate page requests are not snapshot-isolated, deep offsets and exact counts may become expensive at larger scale, and intervening writes can move rows between pages.
- The project board intentionally loads the complete project projection so status columns and drag/drop ordering are not truncated. Board pagination or another large-board interaction model is deferred.
- Focused internal aggregate reads for My Work, planning, reviews, reports, and Portfolio remain complete purpose-specific projections and need separate scaling evidence if workspace volume grows substantially.
- CSV export is synchronous and assembled in memory for up to 10,000 matching rows. Background export jobs and object storage are deferred.
- Work Breakdown is limited to one same-project parent and one child level. Recursive trees, epics, child ordering, hierarchy automation, bulk reparenting, hierarchy import, and automatic status or estimate rollups are deferred.
- Relationships support only `blocks` and `relates_to`; custom relationship types and graph visualization are deferred. Containment is modeled separately and never changes dependency state.
- Dependency-blocked state is derived from current open blockers; critical path analysis, external dependency alerts, and automation rules are deferred.
- Relationship activity is recorded on the command context item only to avoid noisy cross-project activity.
- Attachments are limited to 4 MiB per file, 20 files and 50 MiB per work item, supported types, and
  direct request/response transfer. Malware scanning, previews, inline rendering, versioning, search,
  retention automation, report/export embedding, and background or resumable transfer are deferred.
- Attachment bytes use one marked local filesystem root. S3, presigned URLs, shared multi-instance
  storage, orphan reconciliation, managed backup, and cloud deployment assets are not included.
- Custom workflows and production auth are intentionally out of scope.
- Invitations, multi-workspace switching, custom roles, project-specific membership, pinned projects, recent projects, and audit export are intentionally out of scope.
- The local Express adapter is the only runtime adapter in the current baseline, though endpoint handlers are structured so a Lambda/API Gateway adapter can be added later.
- AWS deployment assets are not included yet; the Angular static build and transport-neutral handlers preserve that path.
- Readiness checks database connectivity only; migration drift detection, metrics, tracing, and managed deployment runbooks are deferred.

## Database Status

The current schema includes workspace activity, member lifecycle metadata, project keys, scoped work item display keys, labels, milestones, project cycles, immutable project cycle closeouts with versioned JSONB evidence, work item cycle assignments, an indexed nullable work item parent self-reference, attachment metadata and integrity evidence, comments, comment mentions, explicit description/comment source formats, project activity, due dates, durable board positions, work item relationships, work item watchers, notifications, workspace-scoped saved work views, project-scoped saved work views, saved-view pinned state, immutable project status report snapshots, and `pg_trgm` GIN indexes for work-item display-key, title, and description search.

Useful database commands:

```sh
npm run db:generate  # generate a migration from the Drizzle schema
npm run db:migrate   # apply committed migrations
npm run db:seed      # upsert deterministic demo data
npm run db:reset     # drop and recreate the local public schema
npm run storage:reset # remove the marked local attachment store
```

`npm run db:reset` refuses to run against non-local database hosts unless `WORKTRAIL_ALLOW_DATABASE_RESET=true` is set.
It remains database-only. `npm run storage:reset` rejects relative paths, filesystem root, the home
directory, the repository root, and directories without Worktrail's attachment-store marker.

The default development database URL is documented in [.env.example](.env.example).
