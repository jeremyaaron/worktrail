# Worktrail v0.3.0 Technical Design

## Status

Implementation baseline, confirmed during Phase 0 on October 17, 2026. This design implements the
direction in the [PRD](prd.md), informed by the
[UX audit](ux-audit.md), [technical debt audit](tech-debt-audit.md), and
[public site audit](site-audit.md). The [implementation plan](implementation-plan.md) records Phase 0
inventories, closed choices, sequencing, and acceptance. Phases 1-8 verification, toolchain,
persistence, batched queries, project/cycle coordination, authoritative work/relationship commands,
and import transport safety are complete; implementation is in progress.

## Summary

v0.3.0 consolidates Worktrail around one journey: find relevant work, understand it, act, and return
to the review that brought the user there. It retains Angular, transport-neutral TypeScript endpoint
handlers, PostgreSQL/Drizzle, local actor selection, and local attachment storage.

The release changes ownership and presentation where existing behavior has become inconsistent:

- Make route and actor identity reactive, and protect meaningful drafts before either changes.
- Share safe navigation context, section targeting, saved-view state, and filter presentation.
- Make work-item detail read-first, complete estimate/due-date editing, and disclose administration.
- Make current Planning execution and complete historical closeout outcomes distinct experiences.
- Add an exact estimate-state filter throughout the existing work-query pipeline.
- Serialize lifecycle decisions and lock authoritative work state before mutation and side effects.
- Batch reference hydration and select bounded previews before enriching them.
- Make isolated verification the default executable workflow, then align documentation and the site.

There is no new runtime service, authentication system, cloud deployment, background worker, draft
database, or general-purpose application framework. Existing routes remain valid. The only new
work-discovery predicate is estimate state.

## Resolved Decisions

| Area | Decision |
| --- | --- |
| Draft recovery | One in-memory departure coordinator; Stay/Discard and native unload warning, not autosave |
| Reused routes | Reactive inherited route identity plus guards that also run on reused editable routes |
| Actor changes | Confirm before committing the actor; use the same draft coordinator as navigation |
| Return navigation | Keep safe `returnUrl` as origin; add one bounded immediate-record parameter, never nested return stacks |
| Detail composition | One record coordinator with focused read/edit, discussion, relationships, files, and history owners |
| Estimate query | `estimateState: 'estimated' \| 'unestimated'`; omission means Any; zero is estimated |
| Historical query compatibility | Freeze v1 types/parsers; introduce v2 producers/readers where precise new risk queries require them |
| Cycle schedule safety | PostgreSQL transaction-scoped project advisory locks, with shared/exclusive participation by affected commands |
| Mutation consistency | Locked current rows, explicit transaction capability, one documented lock order |
| List performance | Batch hydrator inside consistent reads; at most 20 statements for representative 100-row pages |
| Aggregate performance | Narrow evaluation projections, bounded selection before DTO enrichment, batched project references |
| Import transport | Dedicated import JSON limit of `6 * 1 MiB + 4 KiB`; normal JSON and binary limits stay separate |
| Saved views | Harden and adopt the existing `SavedViewsStore` in both production work-list pages |
| Verification | Owned runner defaults to disposable PostgreSQL in Docker; CI service mode creates a separate owned database |
| Toolchain | Compatible, separately reviewable updates first; advisory-specific, expiring exceptions rather than forced fixes |
| Public site | Static Pages site with four workflows, two fresh product proof points at most, and independent setup paths |

### Phase 0 Implementation Choices

- Use `scripts/verify.mjs` with focused support in `scripts/verification/`. A shared ownership module
  serves the runner and test bootstrap; do not import executing seed/reset/performance entry points.
- A run lives beneath an OS-temporary `worktrail-verify-` directory, with a private `manifest.json`,
  a separate root ownership marker, and a resettable `attachments/` child. Database names use
  `worktrail_verify_<run UUID without hyphens>`. Store the run/nonce marker in the database comment,
  outside both resettable `public` and `drizzle` schemas.
- `WORKTRAIL_VERIFY_MANIFEST` and `WORKTRAIL_VERIFY_NONCE` identify internal validated test execution;
  explicit `WORKTRAIL_VERIFY_ADMIN_DATABASE_URL` provisions service mode. Neither an environment
  flag nor a manifest alone authorizes mutation: compare the live DB identity/comment and storage
  markers. Never fall back to ordinary application configuration for provisioning.
- Default to Docker and API mode in Phase 1; full/browser/editor/site modes arrive in Phase 2.
  Unsupported modes fail clearly until implemented. Add `--cleanup <manifest-path>` for explicit
  validated abandoned-run cleanup. Preserve evidence in the caller's output location, not in the
  temporary resource tree that cleanup deletes.
- Classify database-using API test files into a guarded integration project, with a database-free
  unit project, retaining the existing Vitest contracts-source alias. Use Node's built-in test runner
  for resource-owner tests so testing guard failures itself does not require PostgreSQL.
- Project metadata/lifecycle, watcher, and saved-view writes need explicit transaction adoption,
  not just a new wrapper around already-transactional services. Include project-scoped report/view
  writes in shared project coordination. Milestone/label administration uses exclusive project
  coordination so reference lifecycle changes cannot race ordinary assignment validation.
- Extend project query/form serialization to preserve existing `workState`, `assigneeState`, and
  `blocked` predicates, and preserve workspace `assigneeState: 'assigned'`. Existing API predicates
  are not new discovery features. Keep `projectId`/`archivedProjects` workspace-only and page state
  separate; stable chips identify every retained applicable field.
- Use `countUnit: 'work_items' | 'milestones' | 'scope_conditions'` for current health reasons and the
  applicable work/scope subset for risk sections. V2 freezes these units; v1 never acquires invented units.
- Keep all 19 summary CSV columns unchanged. Description source/format preservation applies to the
  existing authored-content/import paths, not a new export schema.
- Put the current developer guide at `docs/development.md` and development-audit exception data at
  `docs/security/development-audit-exceptions.json`. Phase 3 owns actual remediation/exception records.

## Architecture And Ownership

### Preserve Existing Boundaries

The request path remains Express adapter -> endpoint handler -> application service -> repository.
Transport parsing, response headers, and streaming stay in adapters. Authorization, lifecycle rules,
and transaction decisions stay in application services. SQL, row locks, and batch reads stay in
repositories. Contracts contain wire types and small pure data policies, not Angular or Drizzle.

Angular routes remain lazy. New feature state owners are route-scoped unless their behavior genuinely
spans routes. The departure coordinator, current navigation context, and identity-scoped Quick Find
session are small root services; they must not statically import detail, Markdown, Planning, or
Quick Find dialog implementations into the initial application graph.

### Current And Proposed Owners

Paths below identify current files; new filenames are proposed implementation boundaries.

| Current Boundary | v0.3.0 Ownership |
| --- | --- |
| `apps/web/src/app/core/current-user.service.ts`, `app.ts` | Actor commit remains in the user service; shell requests guarded transitions |
| `apps/web/src/app/app.routes.ts` | Route metadata, editable-route guards, and navigation ownership |
| `features/work-items/work-item-detail-page.component.ts` | Record identity/load coordination and focused section composition |
| `features/work-items/state/saved-views.store.ts` | Actual saved-view loads/mutations/selection in both Work pages |
| `features/work-items/query/` | Canonical query policy, applied/draft separation, keyed filter descriptors |
| `features/projects/project-planning-page.component.ts` | Current execution coordination; disclosed cycle/milestone management owners |
| `features/quick-find/` | Lazy dialog, bounded result navigation, retained query but not retained result authority |
| `apps/api/src/repositories/index.ts` | Typed database executor and explicit write/consistent-read capabilities |
| `apps/api/src/services/work-item-service.ts` | Compatibility facade over focused query/hydration and touched command owners |
| `apps/api/src/services/work-risk-sections.ts` | Scope-aware risk definitions, count meaning, and exact drill-downs |
| `apps/api/src/validation/*-snapshot.ts` | Explicit historical version readers and producer validation |
| `scripts/`, `e2e/`, Playwright configs | One resource owner, shared safety checks, runner-selected ports and storage |
| `site/`, README, current developer/operations docs | One current baseline, working setup, and honest operating limits |

Suggested focused owners include `WorkItemDetailStore`, `WorkItemEditStore`, `WorkItemDiscussionStore`,
`WorkItemRelationshipsStore`, and Planning cycle/milestone management stores. Reuse the existing files
and components when their responsibility already fits. Do not create a generic entity store or
extract files merely to meet a line-count target.

Touched/new frontend owners inject `WorkItemsApi`, `SavedViewsApi`, `PlanningApi`, `CyclesApi`, or the
other existing focused client. Keep `WorktrailApiService` only as a documented compatibility facade
for untouched consumers. Move hydration/query behavior first on the API; extract command, hierarchy,
board-positioning, and activity helpers as their locking paths are changed.

## Reactive Context And Draft Protection

### Authoritative Context

Represent a page's effective context with primitive identity values:

```ts
interface PageContextKey {
  workspaceId: string;
  memberId: string;
  projectId: string | null;
  recordId: string | null;
  pageKind: string;
}
```

Derive inherited project/record parameters from observable route state, using `paramMap` and the
relevant `pathFromRoot` ancestors, then combine with the committed actor. Convert that stream to
signals where templates need signals. Do not wrap `route.snapshot` reads in `computed()` and expect
them to become reactive. Snapshots are suitable for reading the proposed target inside a guard.
For an already mounted editor, buffer a proposed route identity until `NavigationEnd`; a param
emission during an unfinished navigation must not reset its draft. Initial activation and committed
actor changes use the same identity owner without waiting for a second navigation event.

Every context owner has a generation that changes only when its effective identity changes. Primary
loads and option loads use `switchMap`/teardown; mutation callbacks also check the captured generation
and identity before updating current state. Cancellation of an HTTP subscription does not establish
that a submitted mutation was cancelled on the server.

On an accepted context change, clear old authorized data, options, messages, selections, and view
identity before loading the next context. Check generations in error and finalization callbacks as
well as success callbacks, so an old request cannot clear a new spinner or publish a stale error.
Report evidence refresh is a same-context operation and must not reinitialize narrative fields.

Apply this to project shell/home, Planning, milestone/cycle/report routes, both work lists, detail,
and their auxiliary saved-view/member/reference requests. Real router tests must change inherited
project IDs as well as leaf record IDs; replacing a fake snapshot alone is insufficient evidence.

Phase 11 implementation details and router/request regression evidence are recorded in
[reactive context evidence](reactive-context-evidence.md). Owners use component-local `PageContext`,
synchronous committed-actor events, cancelling read guards and non-cancelling submitted-write guards.
Clipboard/file promises additionally check captured ownership before completion/finalization effects.
Child creation retains entered fields when only its parent query changes; report evidence refresh
does not initialize an existing narrative a second time. Departure decisions remain Phase 12 work.

### Draft Participants

Add a small `DraftDepartureCoordinator` under `core/navigation`. Page owners register participants
that expose their context key, meaningful-change predicate, pending-write state, and discard/reset
action. The coordinator retains callbacks, not a second copy of authored source.

| Participant | Meaningful Baseline |
| --- | --- |
| Detail fields/description | Last accepted server values, including source and format |
| New comment | Empty source/default format and no explicitly selected recipients |
| Comment edit | Original source/format and editable recipient state, where applicable |
| Work creation | Initialized form defaults, including preselected project/parent |
| Report narrative | Initial editable title/date/narrative values, independent of generated evidence |

Use field/value equality with the existing persistence normalization policy, including source/format
pairs, sorted set-valued IDs, nullable dates/numbers, and explicit mention recipients. Do not use
`form.dirty` as the decision. Formatting preview, selection changes, and disclosure changes alone do
not make a draft meaningful. Restoring the baseline makes it clean. Preserve existing source
grandfathering and whitespace behavior; this is not a new normalization policy.

Independent detail/comment drafts register independently. A successful edit refreshes only that
participant's baseline. A background record refresh cannot silently reset another editor. A confirmed
explicit local discard resets its participant and does not trigger a second confirmation.

### One Departure Decision

Use the existing CDK dialog capability with a small lazy Stay/Discard dialog. Default focus is Stay;
Escape means Stay. Preserve the triggering control and editor selection so rejected navigation or
actor changes restore the original interaction. The dialog names affected draft categories, not
their content. It never submits or saves implicitly.

Route protection has two entry points into the same coordinator:

1. `CanDeactivateFn` handles leaving an editable route.
2. A `CanActivateFn` on each editable route, with `runGuardsAndResolvers: 'always'`, handles a reused
   component whose effective identity changes, including inherited project/create context changes.

The activation guard consults registered current participants and compares the proposed identity,
not the presence of a newly constructed component. A fragment or safe return-context change on the
same record is not a departure. Relevant create-form seed parameters are part of that form's identity.
An in-form project/parent context change that would reinitialize creation fields also requests this
decision before resetting values; ordinary field edits do not constitute departures.
Angular exposes both [deactivation guards](https://angular.dev/api/router/CanDeactivateFn) and
[guard rerun policies](https://angular.dev/api/router/RunGuardsAndResolvers); verify their combined
behavior against the installed Angular version with real navigation tests.

Deduplicate decisions by router navigation ID and captured draft revision. Do not cancel every
`NavigationStart` and replay URLs. A Discard decision authorizes that departure; do not actually clear
drafts until the navigation commits. A later lazy-load/guard failure must leave the original draft
intact. Expire approvals on cancellation/error and reject an approval if its context/revision changed.
Dispose registrations with their owner, and apply accepted discard only to the captured old
participant generation, never to a newly registered editor for the destination record.

The shell requests an asynchronous actor change through the coordinator before calling the user
service's commit operation or writing localStorage. Bootstrap reconciliation can set the initial
actor without a prompt before editors exist. The member selector displays the committed value while
confirmation is pending and returns to it on Stay. No feature may bypass this path for an interactive
actor change.

Serialize departure attempts: one confirmation at a time, no queued actor/URL changes behind a dialog.
While a relevant mutation is pending, reject in-app departures and actor changes with a concise busy
status; do not offer Discard as mutation cancellation. On success, establish the new baseline before
programmatic success navigation. On failure, retain the draft and release the pending state.

Register `beforeunload` only while meaningful drafts or relevant pending writes exist. Use the browser's
native warning without custom text or a save promise. It cannot guarantee warning on every mobile
shutdown or recover work after a crash. Keep authored source out of URLs, logs, and browser storage.

Quick Find navigation awaits router success before dismissing its dialog. A Stay decision must not
close the search interaction or lose its query; handle its focus alongside the departure dialog rather
than relying on `closeOnNavigation` to dismiss before the decision.

## Navigation Context And Section Targets

### Bounded Return Encoding

Create shared parsing/building helpers under `shared/navigation`, backed by Angular `UrlTree` rather
than string concatenation. Keep `returnUrl` as the durable origin and add `returnTo` as an optional
immediate work-item detail URL. Both are ordinary encoded query values, not recursively encoded
objects or browser-only history entries.

```text
origin: /work-items?labelId=...&page=3&pageSize=25
parent: /work-items/P?returnUrl=<origin>
child:  /work-items/C?returnUrl=<origin>&returnTo=%2Fwork-items%2FP
back:   /work-items/P?returnUrl=<origin>
origin: /work-items?labelId=...&page=3&pageSize=25
```

On every record-to-record link, carry the existing origin unchanged and replace the immediate record
with the current record's bare safe URL/recognized fragment. Never embed its `returnUrl` or `returnTo`.
On an immediate return, consume `returnTo` and retain the origin. Browser history remains useful but
is not the only return mechanism. This intentionally remembers an origin and one record, not an
arbitrary traversal stack.

For legacy links where `returnUrl` itself is a safe work-item detail URL, accept it as the immediate
destination and use a safe project Work fallback as origin. New links use the bounded encoding. Create
success retains the originating list/review and, for child creation, the parent as immediate context.
Quick Find carries the current safe page as origin, or inherits an existing record origin and uses
that record as immediate context. Its retained query remains separate from return URLs.

### Safe Local URL Policy

Validate allowlisted application routes and their known query fields. Work-list queries/page state
use the canonical codec; Planning subviews and recognized section fragments have explicit allowlists.
Preserve established safe query parameters rather than reducing links to a route path.

Reject schemes, protocol-relative paths, backslashes, control characters, auxiliary outlets, unknown
route shapes, recursive navigation parameters, malformed encodings, and self-return loops. Bound each
decoded return target to 4 KiB and the complete constructed navigation URL to 12 KiB. Oversized or
invalid context falls back to project Work or workspace Work, not a partially interpreted redirect.
Never decode repeatedly or treat URL context as authorization. Resource loads still enforce the actor's
workspace and record permissions.

Return labels derive from the validated destination type, such as Back to cycle review or Back to
filtered work. Resolve accessible names from current authorized data when available, but do not put
author content into the label or expose names from unavailable records. Preserve fragments in return
targets, including recognized Planning subviews and `#files`.

### Section Targeting

Use stable fragments for `discussion`, `files`, `dependencies`, and `history`, and comment targets of
the form `comment-<id>`. Extend the existing files-target behavior instead of introducing unrelated
scroll implementations. Process targets after the current record/section has loaded; include fragment
changes on the same route. Open the relevant disclosure, scroll with sticky-header offset, and focus
the section heading or identified comment container with `tabindex="-1"`.

Inbox links use an existing identifiable comment ID when available, otherwise Discussion. If a
comment was deleted or cannot be resolved, focus Discussion without exposing cached deleted content.
File results target Files and preserve current metadata/byte authorization. Targeting does not select
another record's node while a stale load is completing. Respect reduced motion and do not reset scroll
on ordinary same-record data refreshes.

## Query, Risk, And Snapshot Contracts

Phase 9 implementation policy and exhaustive field/round-trip matrix are recorded in
[query-policy.md](query-policy.md). Explicit false retains its historical unrestricted-status meaning.
The existing over-target health count is points-over-target (`estimate_points`); its risk section is
one `scope_conditions`. Version 1 Markdown keeps its historical serializer independently of live links.

### Estimate State

Extend `WorkItemQuery` and its project/workspace HTTP schemas with:

```ts
type WorkItemEstimateState = 'estimated' | 'unestimated';
// WorkItemQuery.estimateState?: WorkItemEstimateState
```

Any is omission, not a third stored value. `estimated` means `estimate_points IS NOT NULL`;
`unestimated` means `IS NULL`. Zero is estimated. Predicates combine with existing filters using AND;
they do not imply open work on their own. An unestimated cycle-risk drill-down explicitly sends
`cycleId`, `workState: 'open'`, `estimateState: 'unestimated'`, and the established risk sort.

Use the existing PATCH contract for estimate and due date. Empty controls map to null, not omission;
unchanged fields can be omitted. Normalize Angular numeric inputs as numbers or null rather than
calling `.trim()` on values that may be numbers. Validate nonnegative integer estimates, including
zero, and valid date-only strings. Do not add estimate bulk editing or hierarchy rollups.

### Live Query Policy

Keep the existing work-query modules and `WorkListQueryStore`; extend their field coverage rather
than replacing them with a generic schema framework. Define an exhaustive field-key policy for live
queries that lists defaults, supported scope, stable display key, and value encoding. API validation
and SQL remain at their existing boundaries; shared pure constants/types plus parity fixtures make
field drift visible.

Every live field, including `workRisk`, `hierarchy`, `parentKey`, `assigneeState`, `blocked: false`, and
the new estimate field, must survive the applicable paths:

| Path | Required Behavior |
| --- | --- |
| HTTP/API client | Validate and serialize recognized fields without truthiness-based omissions |
| Repository predicates | Apply scope and filters identically for count, page, and export |
| Form/URL | Draft changes remain unapplied; Apply commits and resets page as appropriate |
| Chips | Use applied canonical query and stable field keys, not parsed English labels |
| Saved/opened/pinned views | Store canonical query independent of page/page size |
| Copy/return links | Preserve applied query, sort, and applicable page position |
| API-produced links | Use the same complete live allowlist rather than the current narrower subset |

Add contract fixtures covering omitted defaults, booleans, exact parent keys, conflicting/invalid
values, and old saved queries. Server requests retain validation errors; URL parsing follows the
existing documented tolerant/canonical behavior. Do not broaden saved-view mutation permissions or
persist pagination as part of a saved definition.

### Risk Meaning And Dates

Parameterize risk descriptions by project/milestone/cycle scope. Add explicit count units to live
reason/section DTOs where counts can represent different entities: work items, milestones, or scope
conditions. Preserve the existing numeric `count`; render its correct unit rather than implying every
value counts tickets. Over target is one scope condition and is not added to a work-item count.

Within a work-risk category, count distinct IDs. Where a display combines category memberships, label
the sum Risk signals. An aggregate labeled Items must use the distinct union before preview truncation,
never the sum or length of returned preview rows. Do not add a distinct-count endpoint merely to
support a label when an existing signal total is sufficient.

Keep five-item risk previews and eight-item dashboard previews, with explicit preview wording and
exact query continuation where supported. Exact counts are evaluated before slicing. Snapshot arrays
are a separate case and must remain completely inspectable.

Move the small UTC date/risk primitives needed by both runtimes into a pure contract policy module;
retain an API re-export if it reduces churn. Capture one `now` per request/evaluation. Date-only due
values compare against its UTC day; due-soon is today through seven days ahead inclusive; stale
in-progress retains the existing strict timestamp cutoff of seven UTC days. Do not use local
`setDate()` arithmetic before converting to ISO. Preserve current health precedence and lifecycle
exceptions. Tests cover cutoff equality, UTC midnight, DST transitions, zero estimates, and overlapping
risk categories.

Child progress reads Closed = Done + Canceled, with both subtotals visible. Cycle completion retains
its existing Done-based meaning. Parent estimate and summed child estimates remain independent and
must be labeled separately; assigning both to one cycle counts both records under existing rules.

### Frozen Snapshot Versions

The current report and closeout types reuse live health/query types, while their parsers effectively
freeze older subsets. v0.3.0 must separate those types before evolving live risk links.

Use explicit `ProjectStatusReportSnapshotV1Dto` and `ProjectCycleCloseoutSnapshotV1Dto` types with
frozen query/health definitions matching the existing parsers. Preserve their current accepted shapes,
optional fields, refinements, and unknown-field handling. Do not strengthen a v1 parser incidentally
by spreading the current query schema into it.

Precise unestimated links are also generated in cycle health that is captured by report and closeout
producers. Therefore choose an additive **v2** for both new snapshot producers rather than strip
`estimateState`, persist an imprecise v1 link, or silently expand v1. V2 has the existing evidence
structure plus explicitly frozen current query fields and count units. It is not an alias to whatever
`WorkItemQuery` becomes in the next release.

Read APIs expose a discriminated v1/v2 union. Parse by `snapshotVersion`, validate record/project/cycle
binding as today, and reject unsupported versions with controlled errors. New drafts and closeouts
produce v2. Report publication can still accept a valid v1 draft from an older client; closeout replay
returns the originally stored version. Existing export/Markdown/print presenters use a version-aware
read adapter rather than mutating stored objects.

The v1 adapter does not invent count units, precise filters, or evidence absent from the snapshot.
Use existing frozen messages when their count meaning is ambiguous. Historical query links are
explicitly links to current work using that stored query, not reconstructions of the frozen item set.
Current links never replace historical title/status/assignee/estimate values.

Both snapshot columns are already JSONB; versioned types/parsers require no historical-data rewrite.
Check schema/SQL constraints before concluding no DDL is necessary. Golden v1 fixtures must remain
readable and unchanged after new v2 production, subsequent work edits, and an upgrade migration pass.

## Frontend Experience

### Work-Item Detail

The first region contains key/title, named project link, readable description, status transition,
planning facts, blocker summary, parent context, and compact watch state. An explicit Edit action opens
the detail/description editor; status transition stays independent. Due date and estimate appear in
both read and edit presentation. Permissions and archived read-only behavior determine available
commands, not whether facts remain visible.

Separate persisted record state from edit drafts. Saving one panel updates accepted values and the
corresponding read facts without rebuilding unrelated comment, relationship, or file state. Reuse the
authored-content editor/viewer and their source/format/no-op rules. Keep invalid or failed drafts
visible with inline errors.

Parent management is a Set/Change parent disclosure rather than a permanent search form. Show a
compact child summary with Closed/Done/Canceled meaning, expandable rows, and an exact existing list
destination. Preserve the two-level hierarchy, authoritative server validation, and independently
assigned fields. Dependency links use shared navigation context.

Discussion, Files, Dependencies, and History get recognizable section navigation. Watcher lists,
relationship administration, and activity history can be disclosed without hiding their state/count
signals. Keep file upload, pending/removal states, limits, and integrity messages within the existing
attachment owner; do not put attachment bytes in the record store or weaken compensation behavior.

Use semantic headings/regions and icon tools with tooltips where available. Avoid nested cards and
new marketing-style explanatory blocks. Extract section styles with their components rather than
raising component budgets.

### Planning And Historical Outcomes

Planning opens with compact project health and current execution: active cycle/date/scope, actionable
risks, and closeout readiness. Draft report remains a compact command/link. Milestone targets and
cycle execution are separate labeled sections. Existing records precede creation; creation and
per-record editing use focused disclosure components with their own pending/error state.

Collapse zero-risk categories into one quiet no-risks state or a category disclosure. Do not render
nine large empty panels. Keep risk continuation links exact and scoped.

A completed cycle renders Outcome at close first. Display frozen project/cycle identity, close time,
destination, counts, and the full stored completed/canceled/unfinished groups. Use local pagination
of 10 rows per group, with group totals and Show all; pagination is only a presentation of the stored
array. It must not fetch a current query to fill historical rows. Print and Markdown exports continue
to include all stored evidence.

Current context is a separate collapsed region, loaded only when requested where practical. It can
show current work/review facts and links labeled Current, without overwriting outcome labels. If a
current record is unavailable, retain the frozen row and give a controlled unavailable state.

Closeout initializes destination selection to an explicit unselected sentinel when unfinished items
exist. Use native option/radio controls for eligible cycle versus Unplanned, with no automatic choice.
Show the selected destination and affected count immediately before submission. If no unfinished work
exists, omit destination controls and submit the established none/null semantics. The API continues to
validate current destination eligibility under lock; the UI decision is not a new persistence field.

### Work Lists And Saved Views

Harden `SavedViewsStore` before adopting it: context generation, cancelled loads, guarded mutation
callbacks, explicit busy states, destruction cleanup, and existing personal/shared ownership checks.
Current defaults that assume mutation permission must not bypass page/API policy. Use it in both Work
pages and remove their superseded load/mutation state.

Track the explicitly opened view ID and its accepted canonical definition. The displayed state is:

- Named when applied query/sort equals the opened definition.
- Modified when that definition remains selected but applied query/sort differs.
- Custom when no accessible explicitly opened view is selected.

Page and page size do not modify the definition. Form changes before Apply do not change this state
or applied chips. Pinned opening follows the identical path. A successful definition Update replaces
the baseline; ordinary filter application never rewrites shared views. Deletion, permission loss, or
actor/project changes clear inaccessible selection. Replacing the opened view's accepted definition
must preserve its identity rather than matching another view by equal query.

Announce results updated only after the latest corresponding query load succeeds. Do not retain an
Opened message when results are stale or a load failed. Shared keyed filter descriptors drive labels
and removal; remove the current English-label parsing and workspace omission of work-risk chips.

Place range/page-size/previous-next controls above results and retain convenient bottom pagination.
Both locations share one owner. Clear visible-ID selection on page/query/context changes and make that
state change apparent; no all-matches selection is introduced. Repair table header/cell semantics and
selected/active announcements in touched controls.

### Portfolio And Shell

Portfolio uses the actual content container to choose dense rows versus stacked layouts, not viewport
breakpoints that assume a wider parent. Use `minmax(0, ...)`, `min-width: 0`, wrapping, and container
queries or equivalent measured breakpoints. Do not conceal overflowing grid tracks with clipping.

Primary row content is project, health/top reason, current planning, report freshness, and one useful
next action. Secondary links/details are disclosed. Name, health, and freshness refinement runs over
the complete returned project rows, without another request or saved Portfolio query. Show visible
versus total project count; label returned attention collections as bounded previews, not full totals.

Add route navigation metadata so milestone/cycle/closeout routes select Planning without changing
their URLs. Use `aria-current` where appropriate. Make project context compact at mobile widths,
move Workspace Settings to the utility area without removing contributor read access, and make the
Projects page directory-first with creation disclosed. Register authorized detail project identity
for Quick Find; do not infer it solely from a missing `:projectId` route parameter.

### Quick Find

Retain only the user's query and local refinement state in memory, keyed to committed workspace and
member identity. Reopening refreshes authorized results and resets stale active-result selection.
Actor/workspace changes clear the session; reload clears it naturally. Do not retain results as a
permission cache, persist history, or reopen the dialog automatically after record return.

For bounded non-work groups, offer type/project refinement rather than fake View all destinations.
Keep the real Work Items continuation with its canonical search query. Attachment copy distinguishes
filename search from file-content search, which is not supported. Markdown-source excerpts remain
escaped source snippets, not generated HTML or implied full-document rendering.

## Persistence And Concurrent Commands

### Explicit Transaction Capabilities

Replace optional database fallbacks in touched services with required capabilities supplied at the
composition root. A small concrete runner provides `write(callback)` and `readConsistent(callback)`.
The callback receives transaction-bound repositories and lock operations. Inner application helpers
receive that context; they do not start another transaction or fall back to global repositories.

Type repositories against a Drizzle executor supported by both the root database and a transaction,
rather than casting transactions through `unknown as WorktrailDb`. The production composition owns
the root database; unit tests supply explicit fake capabilities, and integration tests use real ones.
Read-only repeatable-read remains the policy for count/window/enrichment and aggregate responses.
Write transactions use read committed plus explicit locking/revalidation.

Side effects that belong to a command, including DB activity, notifications, hierarchy changes, and
closeout snapshots, commit or roll back with its database changes. Attachment object-store writes
retain their existing compensation rules; a database transaction is not a distributed storage
transaction. No HTTP response or notification publication occurs before the enclosing commit.

Phase 4 implementation: `repositories/persistence.ts` owns root transactions and supplies bound
repositories, locks, and participating capabilities. Existing service entry points forward to private
scope-bound bodies so their context-based helpers cannot accidentally read/write through root
repositories. `RepositoryExecutor` accepts the actual database/transaction query APIs. Nested reads
inside writes inherit read committed; only independent read scopes start repeatable-read/read-only
transactions. Writes and lock acquisition are rejected in read-only scopes, and capability/lock reuse
after callback exit is rejected. Repository closures must still remain inside the callback.
Database calls sharing a transaction connection are sequential rather than eagerly aggregated.
Bulk commits remain per item; attachment upload object writes/compensation stay outside transaction
callbacks. Existing removal deletes its object inside the database callback; storage is not atomic
with PostgreSQL, and Phase 6 does not redesign that behavior.
The [current developer guide](../development.md) records ownership and the complete staged lock
inventory. Advisory helpers exist and are tested, but project-gate adoption and lifecycle race repair
remain Phases 6-7, not a guarantee of this capability migration.

Phase 6 implementation: all inventoried project-dependent write entries now acquire the selected
shared/exclusive project gates through `project-write-coordination.ts` before authoritative lifecycle
checks. Both relationship endpoint projects are acquired together in sorted order. Workspace saved
views and Inbox read-state remain independent. Bulk rereads project writability inside each item
transaction; import retains one atomic apply and uses `createWorkItemWithScope` rather than a
repository-only creation bypass. Cycle edits lock/reread current rows, and closeout locks all source/
destination cycle IDs in one ordered query before enumeration. Known unique-index violations map to
controlled conflicts. The [operator diagnostic](../cycle-diagnostics.md) performs read-only inspection
without schedule repair or schema changes. Synchronized real-connection tests cover participation,
competing schedules, post-wait archive/reference validation, closeout scope/replay, and independent
writers. Work-row/hierarchy/graph/board ordering and command extraction remain Phase 7, not completed
by the project gate. Historical completed/canceled assignment behavior remains unchanged.

Phase 7 implementation: the existing work service is now a forwarding facade over query, detail-read,
single-command, and per-item bulk owners. A concrete write-policy owner shares existing reference
rules; board-position and activity owners retain their algorithms behind the scoped commands.
`work-item-command-locks.ts` plans hierarchy/board keys before counters/cycles/work rows and returns
locked current state. Child creation allocates the project counter before parent rows. Type/parent
edits share the hierarchy key without introducing type-specific parent restrictions. Cycle assignment
returns a controlled conflict when its discovered source-cycle set changes while waiting, not a
late earlier-order lock or implicit retry.

Validated UUID casing is canonicalized before advisory ordering, identity hashing, reentry, and
upgrade checks. Work-row lookup uses the discovered canonical ID rather than raw caller spelling.
Equivalent uppercase/lowercase UUID inputs cannot create different gates for the same PostgreSQL row.

Status and board decisions, bulk field/status comparisons, and activity/notification previous values
use protected current work. Board moves lock the complete destination-column set plus moving row in
ID order before any possible compaction. Position assignment retains board order, physical updates
follow ID order, and the mover is excluded until its final update. No-op status/already-positioned
board commands retain timestamps. Description-only PATCH takes no board/hierarchy key. Import plans
its keys before its row loop; bulk domain failures roll back outside the callback before being
converted to existing per-item error results.

Relationship add/remove uses sorted project keys, the workspace dependency graph key, sorted endpoint
rows, and then the edge row on removal; permission and reachability use current protected state.
Comments and explicit watches lock work before their dependent rows, compatible with attachment and
automatic watcher paths. Real synchronized tests cover these paths, including disjoint endpoint
cycles and complete-column compaction. These are supported application protocols, not arbitrary SQL
deadlock immunity or storage atomicity. Snapshot/risk policy and narrowed aggregate evaluations remain
their later phases; this command extraction does not rewrite historical snapshots.

### Project Coordination

Introduce transaction-scoped advisory lock helpers for project coordination. Derive a stable lock
key from a namespaced workspace/project identity with parameterized SQL. Hash collisions may cause
extra serialization, never change authorization or identify a record. Never use session-scoped locks.

Use two modes:

| Command | Project Coordination Mode |
| --- | --- |
| Cycle create/update/archive/reactivate, closeout, project metadata/lifecycle, milestone/label administration | Exclusive |
| Work create/PATCH/status/board/parent/bulk/import and relationship writes | Shared for every affected project |
| Touched comment/file/watch, report publication, and project saved-view writes that depend on project writability | Shared |
| Workspace saved-view writes and Inbox read-state changes | No project key; retain their own authorization/transaction policy |
| Independent consistent reads | No advisory lock |

This serializes competing schedule decisions and excludes closeout from concurrent membership/status
changes while allowing independent ordinary work edits within a project. Existing cycle availability
checks run **after** acquiring the exclusive lock and rereading lifecycle state. Preserve inclusive
date overlap (`a.start <= b.end && a.end >= b.start`), one-active-cycle behavior, and existing
completed/canceled/archived exceptions.
Retain existing partial unique indexes for an active cycle and nonarchived cycle names as database
backstops. Map their known violations to controlled conflicts, not generic internal errors.

Advisory locks are a cooperative application invariant, not protection from arbitrary direct SQL.
Document all participating write paths and cover them in integration tests. This choice avoids a
`btree_gist` extension/overlap-constraint migration and does not require automatically repairing
existing schedules. Provide a read-only diagnostic for preexisting overlaps/duplicate active cycles;
operators choose remediation, and future operations still validate affected state. Direct database
writes remain outside the supported application mutation interface.

PostgreSQL provides shared/exclusive advisory locks with transaction lifetime and recommends
consistent lock ordering to avoid deadlocks.
[PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).

### Lock Order And Authoritative State

Use one order for every affected command:

1. Acquire all project coordination keys in stable project-ID order, choosing modes up front.
2. Acquire operation coordination keys, where needed, in a fixed namespace/key order: hierarchy,
   dependency graph, then board positioning. Acquire a whole project's board-positioning key for
   order-changing operations; avoid dynamic per-column lock upgrades.
3. Acquire project rows that must be updated, such as work-key counters, before cycle/work rows.
4. Acquire affected cycle rows in ID order, then work-item rows in ID order.
5. Acquire existing comment/attachment/relationship rows in ID order, then write dependent rows and
   append activity/notifications/snapshots.

No shared-to-exclusive coordination upgrade is allowed. Preliminary reads may locate immutable IDs
and discover affected projects but cannot decide permission, transitions, or previous-value evidence.
Revalidate after locks. If the affected lock set changed, return a controlled conflict or restart the
entire database-only attempt; do not acquire an earlier-order lock halfway through.

Hierarchy changes, hierarchy-affecting type edits, and child creation share a project hierarchy key
before sorted record locks, so concurrent parent/child operations preserve two-level constraints.
Work creation allocates its project
number before parent/work row locks, correcting the potential counter-versus-parent inversion.
Order-changing commands lock the board key before reading neighbors or compacting positions. A
description-only update does not need that board key.

Cross-project dependency commands acquire both project keys in order and a workspace graph key before
validating graph reachability. This retains cross-project support and serializes competing edge
insertions; do not mistakenly impose a same-project restriction. Edge removal follows the same order.
Closeout and work-status changes derive dependency evidence from one captured narrow evaluation query;
they do not repeatedly observe changing external blocker state during snapshot assembly.

For status/PATCH/board commands, select the authoritative work row `FOR UPDATE`, validate permission,
archived state, lifecycle and references, then compare/update. Activity records use that locked previous
state, not an earlier DTO. Competing legal transitions can execute in sequence; stale/illegal commands
return controlled conflicts without partial side effects. Preserve no-op behavior and timestamps.

Closeout acquires exclusive project coordination before source/destination cycle locks and source
work rows. No participating writer can introduce a new source-cycle assignment during enumeration.
Keep existing replay semantics and destination equality checks. Generic cycle edits reread the locked
cycle after waiting, so completed state cannot be overwritten with stale active/planned data.

Bulk commands retain explicit IDs and partial-success semantics, using one command transaction per
accepted item where that is the current contract. Import retains its existing atomicity contract.
Plan the complete import's required coordination locks before its row loop; do not acquire hierarchy
or board keys after an earlier imported row has already locked work records. Neither bulk nor import
uses a nested transaction disguised by a service facade. Keep object-store I/O and client confirmation
outside database lock waits; retain attachment work-row-before-attachment-row ordering.

Synchronized real-PostgreSQL tests cover create/create overlap, update/create, reactivation, touching
date boundaries, status/board races, cycle edit/closeout, assignment/closeout, hierarchy/counter
ordering, and rollback of activity/notifications. Apply bounded test timeouts to expose deadlocks;
mocked repositories alone cannot establish concurrency safety.

## HTTP Parsing And Import Limits

The domain continues to accept at most 1,048,576 UTF-8 bytes of raw CSV, subject to the existing row
and field limits. JSON escaping can represent one raw ASCII byte with six transport bytes, so allow
`6 * 1_048_576 + 4_096` bytes on the two CSV import POST routes. This covers maximal string escaping
plus a bounded normal envelope; it does not permit unlimited transport whitespace or extra fields.

Register route-specific parsers for preview/apply before the ordinary JSON parser. Keep the ordinary
100 KiB budget explicit. The raw attachment boundary remains distinct and retains its existing size,
content type, streaming/integrity, and compensation limits. No global JSON increase is needed.

Middleware order is request logging -> CORS/transport boundaries -> route-specific parsing -> ordinary
JSON parsing -> endpoints/static handling -> safe error middleware. Disable compressed JSON request
bodies unless deliberately supported with bounded inflation; report unsupported encodings safely.
Express supports parser-specific limits and error forwarding.
[Express JSON parser](https://expressjs.com/en/api.html#express.json).

Convert malformed JSON to the standard JSON error envelope with status 400/`VALIDATION_ERROR`, and
parser-size rejection to 413/`PAYLOAD_TOO_LARGE`. Never echo parser error bodies, source, stacks, or
CSV fragments. Ensure adapter and middleware errors share the same safe response construction.

Install request timing/listeners before parsing, including rejected and aborted requests. Log method,
matched route template or a fixed unmatched/parser category, status, and duration. Do not log raw
query strings, arbitrary unmatched paths, actor headers, credentials, authored content, CSV, or file
bytes. Keep logs useful for boundary failures without adding a new telemetry system.

HTTP tests send valid CSV beyond 100 KiB, near-limit CSV with quotes/backslashes/newlines/Unicode
escapes, invalid JSON, oversized envelopes, and raw CSV over the domain limit. A transport-accepted
request can still correctly fail CSV row/field policy. Verify unrelated JSON and attachment limits
have not widened and failures perform no mutation.

Phase 8 implementation: `body-parsing.ts` registers an exact-route import parsing router before
ordinary JSON parsing and shares its route constants with work endpoint registration. Both JSON
parsers disable inflation. `error-boundary.ts` maps parser failures through `toApiErrorResponse`;
unsupported encodings/charsets use 415 with the existing validation code rather than a new domain
error contract. Logging starts before every transport boundary, uses monotonic timing, and records
one finish/close outcome with a safe route template or fixed category. A disconnected response uses
logging-only status 499; it cannot receive a structured response. Unexpected middleware/endpoint
exceptions are not logged verbatim. Binary upload policy and CSV service policy are unchanged.
Parser error categories/statuses follow the [Express parser documentation](https://expressjs.com/en/resources/middleware/body-parser/#errors).

## Read Performance And Consistency

### Batch Hydration

Extract a `WorkItemHydrator` and focused query service from `WorkItemService`. Given the selected work
rows and transaction-bound repositories, collect distinct member, milestone, cycle, project, and work
IDs. Load each reference category in one bounded batch, alongside existing label, dependency, parent,
and child-summary batch queries. Project into maps and preserve the original requested ordering.

Apply workspace/project ownership and existing nullable/lifecycle behavior to every reference. Do not
filter an archived assigned milestone/cycle out of a record merely because it would not be offered
as a new assignment. Do not turn a missing mandatory reporter into a silently fabricated DTO. Avoid
description/comment/attachment bytes in list projections.

Count, selected window, all enrichment, and final projection use one read-only repeatable-read
transaction. Never open a consistent read only around the first query and hydrate later through the
root database. Batching helpers accept their current context and are reusable inside existing reads.

Set a complete-path budget of at most 20 SQL statements, including transaction control, for the
representative 100-row project and workspace page. Measure 10/25/100 rows with all references populated;
counts must not increase by four statements per additional row. A batch of 100 repeated IDs and one
of 100 distinct IDs must both satisfy the same statement-count behavior.

CSV export reuses canonical predicates and batch hydration, excludes page-window restrictions, and
keeps the 10,000-row cap plus overflow rejection. Preserve the existing 19 summary columns and ordering;
do not add description source/format columns as part of hydration work.
Use bounded ID chunks if needed for export-sized batches; the page budget does not promise one
unbounded `IN` statement or a constant query count for arbitrarily large exports.

Phase 5 implementation: `WorkItemQueryService` owns the list/page/board read boundary with actor and
persistence only; the existing work service forwards callers. `WorkItemHydrator` receives scoped
repositories, deduplicates the member union and milestone/cycle IDs, and maps these plus related-row
batches into DTOs. Workspace projects reuse the existing single joined selection. Hydration chunks
contain at most 500 selected rows; large exports share one snapshot across chunks. `WorkItemSummary`
and page/board/export/parent projections omit description source/format without changing summary
contracts or authored search. Historical/null/missing reference behavior and tenant ownership are
covered. Complete 100-row service/HTTP paths use 12/13 statements for project and 11/12 for workspace,
including transaction control and actor lookup, with the same counts at 10/25 rows and repeated/
distinct reference modes. [Measured evidence](hydration-evidence.md) records baseline, bytes, timings,
and the limits of this phase; dashboard evaluation narrowing remains Phase 10.

### Aggregate Reads

Phase 10 implementation and complete endpoint measurements are recorded in
[aggregate-evidence.md](aggregate-evidence.md), including current scan/enrichment bounds and diagnostic
timing limits. Planning's former full risk arrays are now five-row previews; existing exact health
counts drive display and continuation rather than array lengths.

Introduce a narrow evaluation projection containing IDs, project/parent/milestone/cycle references,
status, priority, assignment/reporting, due date, estimate, timestamps, and dependency membership facts.
Do not select authored source merely because the existing `WorkItem` row type includes it.

Use the existing pure health/risk derivation with this projection. Exact evaluation may still read
all relevant narrow rows; this release does not promise constant-time workspace analytics. The
improvement is eliminating repeated complete DTO hydration and repeated per-project reference reads.

| Endpoint | Read Strategy |
| --- | --- |
| My Work | Evaluate relevance/counts once or use equivalent SQL predicates; select each eight-row preview before full DTO enrichment; hydrate the union once |
| Planning/milestone/cycle review | Reuse one scoped evaluation context for health, risk counts, and five-row previews; do not reload the same cycle review through another service |
| Portfolio | Read complete project rows and narrow workspace evaluation once; batch milestones, active cycles, and latest-report references across project IDs |
| Historical closeout | Read the complete stored snapshot; local display pagination cannot truncate stored evidence |
| Board | Preserve complete columns and ordering; use batched enrichment, not list pagination |

Latest-report selection can use a window query/`DISTINCT ON` with stable tie-breaking per project;
load/validate only the selected evidence needed for current rows. Reuse parent/member maps for selected
preview IDs rather than every workspace record. Consistent-read transactions encompass the complete
aggregate response, including enrichment.

Record endpoint SQL counts, selected/evaluated row counts, response bytes, and local timing on named
representative fixtures. Keep query-count tests deterministic; record timing as diagnostic evidence
with fixture size, machine, and cold/warm conditions, not a brittle millisecond gate. Include 15 active
projects and enough work to make preview slicing meaningful. Do not claim scale from hydrator-only
microbenchmarks or silently cap exact counts to pass a budget.

## Safe Verification And Toolchain

### Owned Runner

Add a Node runner such as `scripts/verify.mjs`, exposed through these root commands:

| Command | Behavior |
| --- | --- |
| `npm run verify` | Full automated gates using resources provisioned and owned by this invocation |
| `npm run verify -- --mode=api` | Focused API, migration, concurrency, and query-budget verification |
| `npm run verify -- --mode=e2e` | Application browser suite with owned API/web/database/storage |
| `npm run verify -- --mode=preview` | Compiled application checks with freshly seeded matching storage |
| `npm run verify -- --mode=editor` | Standalone editor checks; no database provisioning |
| `npm run verify -- --mode=site` | Static-site assets, links, fragments, release assertions, and rendered checks |

Ordinary `npm test` remains available, but database-using API tests require the same validated owned
context as browser tests. Unit-only workspace commands can remain database-free. Existing root
application E2E commands delegate to the safe runner; internal Playwright invocations require its
validated run context. UI mode uses the same ownership path rather than becoming an isolation bypass.

Default local provisioning starts a uniquely labeled PostgreSQL 16 Docker container, with a random
host port, run-specific credentials/database, no shared volume, and an absolute temporary attachment
root. It does not depend on the developer's `worktrail` role having CREATEDB and does not modify the
running local database. If Docker is unavailable, fail with actionable setup guidance; never fall
back to `.env` or the ordinary application URL.

CI uses `--database=service` against its disposable PostgreSQL service. Require an explicit admin URL
for provisioning; create a uniquely named run database, mark ownership, and point every child at it.
Do not reset the service's ordinary configured `worktrail` database. Local service mode is opt-in and
likewise creates its own database rather than granting permission to reset an existing one.

The runner owns a restrictive temporary manifest containing run ID/nonce, expected database identity,
container label or service-mode database ownership, child PIDs, ports, and canonical storage roots.
Use a database comment/metadata marker outside resettable application schemas. Before reset/reseed,
verify the live `current_database()`, ownership marker/nonce, manifest identity, and owned storage
directory marker. A localhost hostname, test-looking database name, `CI=true`, or skip-reset flag alone
is not proof. This protects against accidental targeting, not a malicious local user with DB admin
and filesystem control.
Keep storage ownership markers outside the objects subtree cleared by reset. Apply the shared
validation before integration fixture cleanup/seeding as well as E2E global setup/teardown, so direct
package-test invocation cannot silently mutate ordinary configured data.

Prepared-database mode is an internal runner state after provisioning/migrations, not a free-form
environment bypass. Legacy skip flags can skip redundant work only after ownership validation; they
cannot authorize destructive setup or teardown. Explicit operator `db:reset` remains a documented
destructive command, never an upgrade instruction or default verification dependency on working data.

Generate an absolute temporary Angular proxy config from the selected API host/port, replacing the
fixed-port test assumption. Propagate database, API/web/preview/editor ports and one absolute attachment
root before migration/seed and into all relevant runtime children. Server reuse is disabled.

Allocate/check loopback ports, start children, and verify readiness belongs to the child run rather
than accepting an unrelated healthy server. OS-assigned free-port discovery has a handoff race; if a
child exits on bind conflict, stop that run's children and retry bounded allocation. Never kill the
occupant. Explicit requested ports fail clearly if occupied.

The runner records each acquired resource immediately and cleans up in `finally` and on SIGINT/SIGTERM:
stop/wait owned process groups, force only owned descendants after timeout, remove the owned container
or database, and remove only marker-matching temporary storage/config. Cleanup is idempotent and must
not mask the original failure. Preserve sanitized reports outside deleted roots. SIGKILL/crash cleanup
is not guaranteed; provide an explicit marker-validated cleanup command for abandoned runs, not a
global process/container sweep. Service-mode database removal validates the marker before terminating
only sessions attached to that owned database.

Prove two simultaneous nondefault-port runs are isolated, and interrupt one while the other continues.
Prove editor-only mode leaves PostgreSQL/Docker/storage untouched. Remove global teardown behavior
that restores the developer's configured demo database after browser tests.

### Verification Coverage And CI

Add deliberate lint/typecheck coverage for API tests/support, E2E/config files, and runner support,
using scoped test tsconfigs and appropriate Node/browser environments. Do not use broad ignores or
weaken production strictness to make test files pass. JavaScript scripts can use checked JSDoc where
useful without forcing all application code into another toolchain.

Retain the API Vitest source alias for `@worktrail/contracts`, so cold-checkout tests work before
contract builds. Production compilation still resolves built contract exports. Keep standalone native
editor tests and compiled-preview checks independent of development-server transformations.

CI installs dependencies/browser runtime, then calls the owned runner in service mode. Preserve visible
gate output and failure artifacts. Run browser acceptance with retries disabled for release evidence;
record any diagnostic retries separately. Do not count a repeatedly failing test's eventual pass as a
clean gate. Pipeline refactoring must keep production auditing, migrations, native editor, application
E2E, compiled preview, and static-site checks rather than replacing them with one opaque smoke test.

### Dependency Disposition

A fresh audit during design still reports 34 development-inclusive findings: 8 moderate, 21 high,
and 5 critical. This is not the production audit result. Affected direct paths include Angular build/
CLI, Vitest, Karma integrations, concurrently, and drizzle-kit. npm's suggested fixes include major
changes and even older package targets; they are not an approved upgrade plan.

The implementation policy is fixed; exact compatible versions are recorded from the resolved package
graph and maintainer advisories when the tooling change is made:

1. Refresh advisory IDs and `npm explain` paths. Apply compatible direct patches/minors and remove
   genuinely unused development packages first, in a tooling-only change.
2. Keep Angular runtime/compiler/build/CLI/CDK and TypeScript/Node within their supported compatibility
   ranges. Do not upgrade Angular by force just to reduce an audit total.
3. Do not downgrade Drizzle/Karma to npm's suggested targets or force vulnerable transitives beyond
   their owners' declared ranges. No blanket `npm audit fix --force`, override collection, or test-runner
   migration is authorized by this design.
4. If a supported fix requires a larger migration, record an advisory-specific temporary exception
   and follow-up rather than pretending the full dependency tree is clean.

Each exception names advisory/package, exact dependency path, affected command and trust boundary,
exploit preconditions, mitigation, repository-maintainer owner, and expiry no later than v0.3.1 or
30 days after v0.3.0 release, whichever comes first. A production-reachable finding cannot use a
development-only exception. Do not claim that all build-time vulnerabilities are harmless because
they are omitted from the runtime package set.

Add a check that rejects new unaccounted advisory IDs/paths and expired exceptions while keeping the
production audit strictly clean. Supported compatible updates must pass schema generation/migrations,
contract source tests, editor/native inputs, lazy graph/budgets, both server modes, and runner isolation.
Record versions and residual risk in release verification notes, not as a recurring phase reminder.

Phase 3 implemented this policy with Node 24/npm 11, compatible Angular 20/Vitest/concurrently
updates, separate production/full auditing, installed peer validation, and owned scratch schema
generation. Production is clean; five development advisories have exact, owned, expiring records.
The lower-count but peer-invalid pruned graph was rejected. See the
[dependency disposition](dependency-remediation.md) and [verification notes](verification-notes.md)
for the final graph, bounds, diagnostics, and passing acceptance evidence.

## Fixtures, Documentation, And Public Site

### Fixtures And Developer Guide

Split release-relevant seed/test builders into named project/work/cycle/hierarchy/report/attachment/
authored-content scenarios, with centralized stable IDs and cleanup ownership. Importing a fixture
module must not connect, reset, seed, or execute a script. Keep production seed entry points explicit;
do not introduce a general fixture framework or rewrite unrelated large tests.

Include scenarios for 12 unfinished closeout records, 15 active projects, 100 fully referenced list
rows, overlapping risk memberships, null/zero estimates, canceled children, long names, and current
records changed after snapshot production. Freeze clocks in policy tests and use an explicit current
clock for fresh demo scenarios without changing health rules to flatter a seed.

Publish a current README-linked developer guide outside archived version folders. Cover actual module
owners, context generations, transaction/lock order, current versus frozen query policy, focused API
client placement, authored-content invariants, safe test commands, and archive navigation. Pattern
notes describe observed reusable behavior without naming an assumed future extraction destination.

### Independent Local Setup Paths

Document development and compiled preview as independent sequences, each with clone/cd, prerequisites,
install, configuration, PostgreSQL setup, migration, seed, start command, and URL. Establish one absolute
`WORKTRAIL_ATTACHMENT_STORAGE_PATH` before seeding and reuse it for that path's runtime. Do not switch
storage roots on the final preview command after metadata has already been seeded elsewhere.

Distinguish a fresh demo setup from upgrading preserved data. Development defaults can remain useful,
but preview instructions must not inherit hidden shell state. Database metadata and attachment bytes
are backed up/restored together. Reset/reseed is a demo action, not an upgrade or data-repair strategy.

Verify each documented path independently in owned fresh resources, including a deep link and an
exact-byte download of a seeded attachment. Compiled preview testing must not accidentally pass by
falling back to development storage. Keep any unavoidable shared prerequisites explicit.

### Public Site Composition

Keep `site/` static and the existing GitHub Pages artifact/deploy workflow. No frontend framework,
runtime API, hosting provider, or deployment infrastructure is added.

Use this page order:

1. Worktrail H1, concise category/value copy, source and local-run actions, compact current release.
2. Four workflow sections: Find the next action; Shape and deliver work; Plan and review delivery;
   Explain decisions and share status.
3. At most two fresh product proof points with legible responsive treatments and full-size originals.
4. Five concise architecture boundaries with direct developer/operator resources.
5. Three prominent operating limits and links to the detailed documentation.
6. Independent local setup paths and a compact release/resource footer.

Remove duplicate audience and Baseline/Operations feature inventories. Retain one audience block and
state local identity, the local single-instance operating model, and bounded attachments without
malware scanning clearly. Do not imply enterprise authentication, managed cloud hosting, one-click
deployment, or cloud-scale verification that the application does not yet provide.

Capture screenshots after the application changes, using populated current UI, no developer controls
or empty editor dominating the frame. Desktop/mobile renditions derive from actual screenshots, not
fabricated interfaces. Preserve readable product evidence rather than hiding it behind overlays; offer
full originals. Keep the established brand assets.

Add skip navigation, explicit focus states, anchor `scroll-margin`, reduced-motion handling, mobile
navigation wrapping, and short-landscape checks. Inspect actual clipping instead of using global
`overflow-x: hidden` as an acceptance fix. Confirm the deployed Pages base path before setting absolute
canonical, `og:url`, and share-image URLs; do not invent a new domain. Local checks validate metadata
consistency but cannot establish a successful remote deploy.

Add lightweight static checks for local assets, fragment IDs, repository paths, and current release
references. Run them in PR verification and before Pages artifact upload. Final release docs must
exist before the footer links to them; remote tag/release availability is a post-publication check.
Keep external availability checks separate from deterministic local validation.

## Compatibility And Upgrade Policy

No destructive migration is anticipated for the core changes: estimate/due date already exist,
snapshot payloads are JSONB, and advisory locks require no persisted schema or PostgreSQL extension.
If profiling justifies an index or a discovered constraint requires DDL, use an additive reviewed
Drizzle migration with fresh-install and preserved-data evidence. Do not add an estimate-state index
speculatively without a representative plan.

Preserve public endpoint paths, established URL query meanings, saved-view definitions/permissions,
archived reads/writes, complete boards, visible-ID bulk semantics, two-level hierarchy, explicit
mentions, no-op activity, deletion tombstones, source formats, snapshots, attachment limits, and
workspace isolation. New response fields and v2 snapshots are additive but require updating every
in-repo consumer and OpenAPI description together.

At finalization, align root/workspace manifests, internal contract dependency versions, lockfile,
OpenAPI, README, site, CSV capability documentation, release notes, verification notes, and pattern
notes to `0.3.0`. Do not bump versions merely to draft this design. Tagging, merging, publishing, and
deploying remain separately authorized actions.

## Verification And Acceptance

The implementation plan should assign the following evidence to concrete phases and repeat the
complete automated gates on the final versioned tree.

| Area | Required Evidence |
| --- | --- |
| Context | Real reused parent/leaf routes and delayed primary/options/saved-view/mutation responses cannot update the wrong context |
| Drafts | Stay/Discard across route exit, same-component ID changes, history, Quick Find, actor changes, independent edits, pending submission, and cancelled navigation |
| Return/targets | Filtered page 3 -> parent -> child -> parent -> origin; result/dependency/create paths; fragments, deleted comments, malformed/external/oversized return targets |
| Query | Full live field round trips through API/SQL/form/applied chips/saved/pinned/copy/return/export; null versus zero estimates |
| Historical evidence | Golden v1 reads, v2 production, replay/publication compatibility, all 12 unfinished rows inspectable after current-record changes |
| Concurrency | Synchronized PostgreSQL race tests with state/activity/notification assertions and bounded deadlock detection |
| HTTP | Dedicated import budget, standard JSON failures, early sanitized logging, no widened binary/ordinary JSON limits |
| Performance | Complete-path 10/25/100 counts, <=20 statements at 100 rows, export cap/parity, aggregate queries/rows/bytes/timing |
| Ownership | Shared stores/display helpers have both production consumers; superseded duplicates removed; focused clients and transaction contexts used |
| Runner | Cold tests before contract build, proven destructive guards, parallel nondefault ports, signal/partial-start cleanup, database-free editor mode |
| Toolchain | Clean production audit, accounted unexpired development findings, compatible build/migration/editor/browser behavior |
| Site/setup | Independent fresh dev/preview walkthroughs, exact attachment bytes, local asset/link/release checks, accurate workflows/screenshots/limits |

Run lint/typecheck, contract/API/Angular tests, build, migration/preservation tests, application E2E,
standalone editor, compiled preview, concurrency/performance evidence, dependency checks, and site
checks. Keep initial bundle budgets at 550 kB warning/1 MB error and component style budgets at
8 kB warning/12 kB error, with no warnings. Inspect the initial/lazy dependency graph after extraction.

Rendered acceptance includes 320/390/768/1024/1440px and wider viewports, short landscape, constrained
containers, long words/names, font-sensitive controls, table semantics, focus order, and active/selected
announcements. Assert control/container bounds in addition to document overflow. Preserve native
editor selection/undo/composition/paste behavior and literal fallback/security fixtures.

Perform actual browser zoom and a screen-reader walkthrough, or record the precise remaining manual
gap. Synthetic IME and width-based reflow do not prove real OS composition, assistive technology, or
browser-chrome zoom. Automated local readiness, user UAT, remote CI, and deployed Pages/share checks
remain separate evidence; none may be inferred from another.

## Delivery Dependencies And Risks

Establish context/draft/navigation and query/snapshot boundaries before rebuilding detail and review
presentation. Establish transaction/lock ownership before command concurrency fixes. Extract batch
hydration before aggregate optimization. Harden the shared saved-view store before replacing the two
live implementations. Create owned verification early enough that migrations, performance fixtures,
and browser acceptance never depend on resetting working data. Capture site proof points last.

The principal risks are missed command participation in advisory locking, duplicated draft decisions,
accidental v1 schema expansion, and an extraction pulling heavy feature code into the initial bundle.
Mitigate them with a command participation inventory, real router tests, golden versioned fixtures,
complete-path SQL evidence, and production graph inspection. Toolchain compatibility investigation
may yield bounded residual development risk; it must not silently turn this consolidation release
into an unplanned framework migration.

These choices close the PRD's architectural questions. Phase 0 records the concrete command/consumer
inventory and tooling candidates in the implementation plan. Subsequent phases implement and verify
those choices without reopening product scope.
