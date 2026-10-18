# Worktrail Developer Ownership And Invariants

This is the current implementation guide, not a release archive. As of v0.3.0 Phase 16, persistence
ownership, batched queries, lifecycle coordination, authoritative work/relationship commands,
bounded HTTP parsing, versioned risk/query policy, aggregate narrowing, committed frontend context,
shared draft departure protection, read-first detail composition, bounded inspection navigation,
shared saved-view/list state and execution-first Planning are implemented. Remaining presentation
consolidation follows the [implementation plan](v0.3.0/implementation-plan.md).

## Committed Frontend Context

`core/navigation/page-context.ts` owns a component's inherited route parameters, committed query/
fragment state, and workspace/member identity. Construct it in the component or page-scoped store injection context and
register a reset/load callback with `start()` during initialization. Use `param()`/`query()` inside
computed values instead of snapshot-only computed IDs. Mounted owners buffer parameter emissions
until `NavigationEnd`; initial activation can initialize immediately. Cancellation/error is not an
accepted context change. Fragment-only navigation does not reapply work-list queries.

`CurrentUserService.selectMember()` publishes a synchronous committed-actor event after changing
selection/storage. This prevents an A -> B -> A sequence from escaping generation ownership between
Angular effect turns. A signal effect also handles bootstrap member reconciliation. Effective identity
includes workspace/member and inherited route IDs; page kind/lifetime is the component-local owner.

On context change, `PageContext` invalidates old reads before calling the owner's explicit state reset
and new loads. Pipe reads/options through `guard()` and submitted commands through `guardMutation()`.
The latter rejects obsolete success/error callbacks without asserting that a submitted server write
was cancelled. Both dispose on component destruction. Keep the existing per-operation generations
where an editor can start a newer operation in the same context. Capture `context.capture()` before
async clipboard/file/error-body work and check it in success, error and finalization callbacks.

Creation project options and workspace project-filter options also dispose their own subscriptions
when the in-form project changes. Parent-query changes replace the parent request without discarding
the child title/description. Accepted actor/project changes clear authored defaults, options, results,
messages and selection before reloading. A report's evidence refresh preserves its existing narrative;
only its first successful load in a new context initializes narrative fields.

Touched pages use focused API clients directly; `WorktrailApiService` is compatibility-only for
untouched consumers. The context owner imports no feature/editor/Planning modules. Regression evidence
is in [reactive context evidence](v0.3.0/reactive-context-evidence.md). The following departure layer
was added in Phase 12; it is separate from committed route/request ownership.

## Work List And Saved View Ownership

Both project Work and workspace Work Items instantiate `SavedViewsStore` locally. The pages provide
the committed actor/context, applied query, scope/project, and active-project mutation capabilities;
the store also checks actual personal ownership, workspace/scope identity and shared-view roles.
Missing capability callbacks deny mutations. Reset it on committed actor/project change and destroy
it with the page. Cancel superseded loads and reject old-context success/error callbacks for every
mutation; unsubscribing does not guarantee cancellation of an already submitted server transaction.

Only explicit opening selects a view ID and its accepted canonical query signature. The store derives
Named/Modified/Custom against the applied query, ignoring page position and unapplied form values.
Rename and pin preserve that baseline; explicit Update query replaces it. Delete, an inaccessible
view or context reset clears it. Do not infer selection from another view with an equal definition.
The compact opener and pinned shortcuts call the same page navigation path, which accepts identity
only after committed navigation (or an already-current URL). Rename drafts survive unrelated writes
and failed saves; accepted creation alone clears the toolbar's new-view name.

`WorkListQueryStore` owns applied query/page state and a generation-bound successful-result summary.
Starting a read clears old feedback; only the latest matching query/page response can announce its
accepted range. The toolbar must not announce results merely because Open was clicked. Both pagers
use the page's same metadata/commands. Keyed chip descriptors, not English display-label parsing,
own removal for every applicable field, including work risk and estimate state.

Project bulk selection remains explicit visible IDs. Page/query/context changes announce clearing;
submitted bulk writes disable desktop/mobile selection. Table headers/cells and selected rows retain
semantics, and mobile cards expose select-all without depending on hidden desktop controls.
See [shared work-list evidence](v0.3.0/shared-work-list-evidence.md).

## Planning Ownership

`ProjectPlanningPageComponent` coordinates the committed project/actor, URL-backed Review/Cycles/
Milestones subview, API reads and independent cycle/milestone creation forms. Same-context project,
summary and collection reads cancel their predecessor; `PageContext` still guards context changes,
destruction and submitted mutation callbacks. Collection reads and writes do not overlap within
their owner, and duplicate submits are rejected. Cycle and milestone owners remain independent.

`PlanningReviewComponent` now owns actual review presentation rather than projecting page markup.
Health, current cycle execution and milestone targets have focused presentation/style components.
Active execution/readiness precedes populated project risks and separate milestone targets; recent
review groups are disclosed. No active cycle remains explicit even when upcoming/history exists.
Reports are compact contextual commands, not a promotion section. No backend health threshold changed.

`CycleManagerComponent` and `MilestoneManagerComponent` render existing records before disclosed
creation/editing. Record input DOM is keyed by ID, so another record's successful write does not reset
its draft. Page-local `PlanningMutationState` instances own pending IDs and per-record errors/messages;
creation has separate feedback. Pending writes disable affected controls. Committed actor/project
changes clear all local forms/feedback; these management drafts are neither persistent nor newly
registered with authored-content departure protection. Archived cycles expose Reactivate, not a
nonfunctional edit form. Completed cycle status remains immutable; contributor/project archive rules
remain authoritative in the API and are reflected in the UI.

`populatedRiskSections` uses exact server counts rather than preview lengths across Planning, cycle
and milestone reviews. Count labels use the shared unit policy; scope conditions are not work-item
totals. Cycle correction links use the server's exact query, including open/unestimated predicates;
over-target conditions link to clearly labeled cycle scope. Project risk links use canonical codecs,
shared risk-window constants and UTC scope copy. Date-only cycle/Planning labels format in UTC.
See [execution-first Planning evidence](v0.3.0/execution-planning-evidence.md).

## Draft Departure Ownership

`DraftDepartureCoordinator` stores registrations/callbacks, context keys and integer revisions, not
authored source. Each editor keeps its normalized baseline in a local `DraftTracker`. `meaningful()`
uses persisted-value equality, not `form.dirty`; source/format and explicit mention IDs remain paired,
set-valued IDs are sorted and line endings follow the existing authored-source policy. Preview, focus
and disclosure alone are not drafts. A reverted value is clean. `accept()` is called only for that
editor's initialization, accepted reset or successful save; evidence refresh is not a narrative reset.

Detail fields, new comment/recipients, inline comment edit, creation and report narrative are independent
participants. Register with the owning `DestroyRef`, expose pending writes separately, and notify the
coordinator on reactive-form changes. Signal-valued selections/pending flags are also observed for
conditional `beforeunload`. Never put authored values in a URL, localStorage, log or global draft cache.

Editable routes use both `protectEditorDeparture` and `protectReusedEditor`, route data `draftEditor`,
and `runGuardsAndResolvers: 'always'`. Proposed route identity includes relevant creation parent/cycle
seeds, but not fragments/return URLs. Decisions are shared by navigation ID and captured revision.
Discard authorizes navigation; captured resets run only at `NavigationEnd`, while cancelled/error
navigation expires approval without resetting a draft. New/different editor generations are not reset.
Still-mounted revisions are revalidated through form/signal/router progress; stale approval calls
Angular's `Navigation.abort()` before activation without replaying the URL. Editors become inert
during approved commit to prevent intervening UI edits. The lazy CDK dialog
defaults to Stay, Escape/backdrop means Stay, and focus/selection is restored on rejected attempts.

Interactive actor changes go through `App.selectMember()`/`departure.change()` before the low-level
user-service commit or storage write. Bootstrap reconciliation remains synchronous. Creation restores
the committed project select value before asking; Stay leaves all other controls/options intact.
Explicit discard/cancel/Create another UI commands use scoped participant tokens and do not prompt
again during the accepted reset. Programmatic reset helpers remain separate from interactive requests.

Pending writes reject affected route/actor/reset attempts with an operational status; Discard does not
cancel a server transaction. Form authoring is disabled during creation/publication. Success establishes
its own baseline before success navigation; failure retains the draft. Quick Find uses
`closeOnNavigation: false` and closes after successful navigation, preserving query/active option on Stay.
No navigation cancel/replay loop or queued actor/URL change is used. The browser warning is native and
cannot guarantee mobile shutdown/crash recovery. Evidence and limits are in
[draft departure evidence](v0.3.0/draft-departure-evidence.md).

## Read-First Detail Ownership

The detail route provides four local stores, not root singletons. `work-item-detail.store.ts` owns the
single committed `PageContext`, persisted record, field/description/label baseline, project options,
status command and Files target generation. The page coordinates reset/load once per accepted context.
`work-item-discussion.store.ts` owns new and inline source/format editors, explicit recipients,
comment generations, validation, pending writes and scoped draft registrations.
`work-item-relationships.store.ts` owns dependency search/selection/commands;
`work-item-watch-history.store.ts` owns watch commands and attachment-activity refresh. These owners
patch only their corresponding persisted record fields. The superseded page orchestration is removed.

Focused editor/discussion/dependency/watch/history components consume those production owners.
The existing attachment component remains mounted across field editing/cancellation; its upload,
retry, removal, capacity and byte ownership do not move into the record store. Field saves cannot
replace later comments, status or hierarchy. Detail cancellation protects only the field draft and
restores Edit focus after approval, with context/destruction checks on the asynchronous result.

Detail opens with identity, a named project, readable source projection, planning facts and independent
status/watch commands. Edit reveals the existing authored control and field form; Set/Change parent,
dependency administration, watchers and history are disclosures. Children expand from compact totals:
Closed means Done plus Canceled; Parent estimate and Child total remain independent. Discussion,
Files, Dependencies and History have stable IDs and local scroll/focus links. Incoming fragments and
bounded return context use the shared navigation policy below.

Estimate uses the numeric control's number/null contract (including zero); integers must fit the
PostgreSQL nonnegative integer field. Due dates are calendar-validated date-only values, with an empty
control mapped to null. Incomplete native numeric/date inputs remain invalid rather than silently
clearing persisted facts. Existing PATCH authorization/no-op/source-preservation rules are unchanged.
See [read-first detail evidence](v0.3.0/read-first-detail-evidence.md).

## Bounded Inspection Navigation

`shared/navigation/work-navigation.ts` parses known local route shapes using Angular UrlTree and the
existing work-query/page codecs. `returnUrl` is a durable origin; optional `returnTo` is one immediate
bare record plus a recognized fragment. Record links replace the immediate record. Returning to it
consumes that parameter and retains the origin. Legacy record-valued `returnUrl` is accepted as an
immediate target with project Work as fallback. This is deliberately not a traversal stack.

Use `recordOriginParams()` for list/review/report destinations, `recordNavigationTarget()` for record
inspection, `createNavigationTarget()` for child creation, and `returnNavigationTarget()` for returns.
Quick Find uses `navigationContextFromPage()` to inherit safe current-page context. Do not copy the
current decorated URL into a return parameter. Create success and parent-preview links retain context.
Applied query/sort/page/page-size values survive; unapplied form state is not captured.

The policy rejects external/protocol-relative URLs, control characters, backslashes, malformed
encodings, auxiliary/matrix routes, unknown query fields, duplicate values, recursive metadata, and
self returns. A decoded target is limited to 4 KiB and constructed navigation to 12 KiB. No repeated
decoding is performed. Invalid context uses project/workspace Work. Resource clients and API services
remain authoritative for access; URL parsing grants no permission. Labels use validated destination
types or an already-authorized current parent key, never arbitrary query text.

`WorkItemSectionTarget` observes committed record/actor/fragment identity after render, validates the
accepted record, and targets Discussion/Dependencies/History or a live `comment-<id>`. Missing/deleted
comments target Discussion without retrieving deleted source. Normal data refresh does not refocus;
same-section activation explicitly requests a repeat. Stay cannot activate the proposed destination.
Files retains its existing settled-load generation owner; Quick Find only requests direct repeat focus
for the current record, never a previous record during a changed-record load.

`NavigationSectionTargetDirective` waits for accepted review/report/planning data and a rendered,
page-scoped recognized heading. Both owners use `focusSectionTarget()` to open enclosing disclosures,
apply an 88px sticky offset, focus a programmatic target, and scroll without motion. Browser history,
reloads and same-route fragments are supported. See
[bounded navigation evidence](v0.3.0/bounded-navigation-evidence.md).

## Composition And Persistence

`apps/api/src/main.ts` constructs the root repositories and `createPersistence(db)`. Express route
composition and transport-neutral endpoint options pass both explicitly. Domain services require
`Persistence`; there is no optional database fallback. Health-only and test-route-only Express
composition can omit both dependencies. Future transport adapters should use the same composition
contract, not import Express into services or repositories.

`repositories/persistence.ts` owns root transaction creation. Its callbacks receive
`{ repositories, locks, persistence }` bound to one real transaction:

| Entry | Root Configuration | Nested Behavior |
| --- | --- | --- |
| `write(callback)` | Read committed, read write | Joins the current write scope; no transaction/savepoint |
| `readConsistent(callback)` | Repeatable read, read only | Joins the current scope; no transaction/savepoint |

A read inside a write inherits read-committed isolation; it does **not** acquire an independent
repeatable-read snapshot. A write or advisory-lock request inside a read-only scope is rejected.
PostgreSQL also rejects direct repository writes inside that scope. Independent consistent reads
keep count, row window, and DTO enrichment on the same snapshot.

Service entry methods instantiate a scope-bound service and call a private `*InScope` body. This
ensures existing helpers using `this.context.repositories` see scoped repositories. Nested services
must receive the enclosing `scope.persistence` and repositories, never the root capability.
`createWorkItemWithScope` requires the caller's complete `PersistenceScope` and participates in its
write capability, project gate, and preplanned hierarchy/board keys; CSV import cannot bypass
coordination with repositories alone.
Repository-accepting DTO enrichment, relationship summaries, and notification recording participate
in their caller's scope; they do not own commits.
Import apply owns one write including validation and all rows. CSV export owns one consistent read;
report publication and its nested cycle snapshot share one write.

Bulk work-item updates deliberately commit per item and retain partial success. Each item executes
on a newly bound service, not on the outer root instance. Each item acquires shared project coordination
and rereads project writability; preliminary bulk validation is not authoritative. Per-item actions
compare locked current work and labels, with board/cycle locks planned before work locks. Application
errors escape the callback and roll back that item before being mapped to the existing failure result.
Do not catch a post-write domain error inside the transaction and return a failed item that commits.
Compose the public bulk entry with the root capability, not inside another write scope: bound writes
join their parent and cannot provide independent per-item rollback/commits. Its private item body is
the scope-bound entry; import and single-record commands remain safely composable inside writes.

`RepositoryExecutor` in `db/client.ts` exposes the query methods common to the real Drizzle database
and transaction types. All repository factories use this type without pretending a transaction is a
root database. Repositories cannot open transactions through that executor. Do not reintroduce a raw
database into service contexts or duplicate transaction helpers in the repository factory.

## Scope Lifetime And Query Sequencing

Await every operation before returning from its callback. Do not retain or return repositories,
capabilities, locks, or scope-bound services for later work. Bound capability and lock entry points
reject reuse after callback exit, but repository closures are not revocable proxies. Callback
discipline remains required. Return materialized results instead.

A PostgreSQL transaction uses one connection. Issue its queries sequentially, including nested service
reads and side-effect writes; do not use `Promise.all` or eagerly create arrays of database promises.
Use ordinary `await` expressions and `repositories/map-sequential.ts` for asynchronous collection
hydration. This avoids the driver's concurrent-client-query deprecation and ensures a failure settles
before transaction rollback. Separate root requests can still execute concurrently on pool connections.

## Database Effects And Object Storage

Project, label, milestone, member, workspace, saved-view, watcher, work-item, hierarchy, dependency,
comment, notification read-state, cycle, closeout, and report mutations now use required write
capabilities. Applicable state, activity, mentions, automatic watchers, and notifications commit or
roll back together. Failure injection must instrument **scoped**, not root, repositories.

Attachments retain their explicit database write callbacks and existing project/work/attachment row
locks, after shared project coordination. Upload bytes are written outside the database transaction.
Upload compensates a failed database
write by removing the stored object; failed compensation records safe operational evidence without
replacing the original failure. Object-store I/O is not a distributed transaction. Do not wrap the
entire upload/download operation in a database scope. Removal retains its existing object-store delete
inside the database callback; this phase does not redesign that failure window or claim storage atomicity.

Health, Quick Find, and activity-feed reads retain their existing focused read owners. Attachment
list/download preflight reads also retain their existing behavior. Required capability injection does
not imply these paths now have a cross-statement snapshot. Batched work-list ownership and measured
query budgets are described below; dashboard narrowing remains Phase 10 work.

## Work Queries And Batched Hydration

`services/work-item-query-service.ts` owns project/workspace list, page, and board reads. It receives
only actor identity and persistence, not root repositories. Authorization, count/window resolution,
reference reads, and DTO projection occur inside one `readConsistent` callback. `WorkItemService`
retains forwarding methods for existing endpoint/dashboard callers. It is now a compatibility facade;
do not copy query or command orchestration back into it.

## Work Command Owners

Owners below are under `apps/api/src/services/`; each uses the enclosing scoped repositories and
capability, not a second root transaction:

| Owner | Responsibility |
| --- | --- |
| `work-item-service.ts` | Existing public API forwarding and type reexports |
| `work-item-command-service.ts` | Create, PATCH, status, board, and parent commands, including hierarchy validation |
| `work-item-bulk-command-service.ts` | Explicit-ID per-item commits, current-state action decisions, rollback before partial-failure mapping |
| `work-item-command-locks.ts` | Project/operation planning, ordered cycle/work sets, post-wait identity/reference revalidation |
| `work-item-write-policy.ts` | Project and reference validation, historical assignment exceptions, set equality |
| `work-item-board-positions.ts` | Current-column neighbor validation, insertion positions, and compaction decisions under the board key |
| `work-item-activity.ts` | Field/source-format/label/milestone/cycle differences from locked previous values |
| `work-item-read-service.ts` | Detail, children, parent candidates, and scoped command response projection |

Relationship commands retain their focused service and mapper. They acquire both project keys, then
the workspace dependency key and sorted endpoint rows; removal locks the existing edge afterward.
Reachability, duplicate checks, and contributor permission use current protected state. No same-project
restriction is added. Comments acquire work before comment rows, and explicit watch/unwatch acquires
work before watcher writes, matching notification-driven watcher creation. Attachment project/work/file
ordering and storage compensation remain unchanged.

## Hydration Invariants

`services/work-item-hydrator.ts` receives the enclosing repositories and selected summary rows.
It deduplicates the reporter/assignee union and milestone/cycle IDs, then loads members, milestones,
cycles, labels, dependency counts, parents, and child summaries sequentially into maps. No selected
row triggers another mandatory-reference lookup. Workspace project summaries already arrive in one
joined window/export query and are reused without per-project reads. Input order is retained.

Existing historical assignments remain readable: inactive members and archived milestone/cycle/label
references are not filtered away simply because new assignment would be disallowed. Missing mandatory
reporter or referenced milestone/cycle records still fail; absent optional assignees remain null.
References must match the row's workspace/project ownership. Foreign mandatory references fail and
foreign optional member/parent/label data is not exposed. Workspace row and joined project predicates
both use the authorized workspace.

`WorkItemSummary` excludes description source/format. Interactive project/workspace page, board,
export, and parent-reference projections do not retrieve those unused bytes. Detail and command reads
retain their necessary full types; aggregate evaluation uses its separate narrow projection below.
Search predicates can still search authored source without selecting it.

The same hydrator serves CSV exports, child lists, and bulk response summaries. Export selection
applies the canonical predicates/order, not page windows; the 19-column summary shape and 10,000-row
cap/overflow rejection remain unchanged. Hydration chunks contain at most 500 selected rows, keeping
member batches at at most 1,000 distinct IDs and other reference/related-row batches at at most 500.
All chunks share the caller's snapshot. This bounds each statement, not the total export query count
or output memory; synchronous exports still materialize their capped results.

`tests/support/hydration-fixture.ts` is import-safe and builds named 10/25/100-row-per-project datasets
only when called against owned test resources. Complete service and HTTP page tests count SQL through
the Drizzle logger, including transaction control and HTTP actor resolution. The 100-row budget is
20 statements: current populated project pages use 12 service/13 HTTP; workspace pages use 11/12.
Repeated, mixed, and distinct reference datasets use the same counts. Empty/null-reference pages can
use fewer statements. No timing threshold substitutes for these deterministic assertions.

Owned API runs retain `hydration-evidence.json` next to their sanitized summary under
`test-results/verification/<runId>/`. It contains only fixture mode, scope/transport, statement count,
rows, payload bytes, and diagnostic elapsed time, not SQL parameters or application data. See
[the Phase 5 evidence](v0.3.0/hydration-evidence.md) for the measured baseline and accepted results.

## Aggregate Reads

`WorkItemEvaluationFacts` contains only analytics/preview facts, not description source/format, type or
board positions. Repository evaluation rows add dependency membership using the canonical SQL predicate.
My Work selects each eight-row preview before hydrating one distinct summary union. Planning and scoped
reviews use pure risk selection first, then load only selected member/milestone/parent references.
All evaluation/enrichment and complete count/breakdown derivation stay on the enclosing repeatable-read
scope with one captured clock. Planning cycle summaries reuse loaded facts rather than full reviews.

Planning risk arrays are five-row previews; exact totals come from deliveryHealth. Do not use array
lengths as category totals or risk signals. Portfolio batches milestone, active-cycle and latest-report
metadata across all project IDs; selected reports omit narratives and use stable publishedAt/createdAt/ID
ordering before snapshot validation. Full board/history/closeout arrays are not preview-limited.

`tests/support/aggregate-fixture.ts` and the aggregate tests own 1/15-project evidence, complete HTTP SQL
counts, evaluated/enriched rows, response bytes, diagnostic timings and external-commit consistency.
See [aggregate evidence and remaining costs](v0.3.0/aggregate-evidence.md). Focused Angular verification
can use the CLI's `--include=src/app/features/projects/project-planning-page.component.spec.ts` inside
the existing owned manifest/private-workspace/Karma launcher; it is not a new public runner flag.

## Lock Ownership And Participation

`repositories/locks.ts` provides transaction-scoped advisory coordination with parameterized,
namespaced identities. Validated workspace/project/resource UUIDs are lowercased before sorting,
deduplication, mode checks, and hashing. Project requests are sorted by project ID, then workspace ID.
PostgreSQL treats equivalent
uppercase/lowercase UUIDs as one record; they must not bypass coordination with different strings.
Decide shared or exclusive mode before acquisition; shared-to-exclusive upgrades are rejected. Reentry is
idempotent. Operation keys follow hierarchy, dependency, then board order, with stable keys within
each namespace. Acquire the complete affected project set before operation keys. No new earlier
project/operation key may be acquired after a later key.

The implemented canonical command order is:

1. Project advisory coordination, sorted IDs and predetermined modes.
2. Hierarchy, workspace dependency graph, and board operation keys, in that order.
3. Updated project rows, including work-key counters.
4. Cycle rows by ID.
5. Work-item rows by ID.
6. Dependent rows by ID, then state/activity/notification evidence.

The helper enforces advisory acquisition order and scope mode/lifetime, not row-lock ordering.
`services/project-write-coordination.ts` owns command participation helpers. Preliminary work,
comment, relationship, and reference reads discover immutable project IDs only; bodies reread state
after acquiring the gate. Cross-project relationships discover both endpoint projects before taking
either key. Command planners use the typed hierarchy/dependency/board operation keys, and ordered
repository queries acquire their complete existing work-row sets. Advisory helpers alone cannot
infer required rows or repair an unsupported direct repository call's ordering.

| Command Family | Implemented Project Participation | Command Protocol |
| --- | --- | --- |
| Existing project metadata/archive/reactivate | Exclusive | Preserve current-state activity |
| Cycle create/update/archive/reactivate/closeout | Exclusive; authoritative cycle reread/row lock, closeout source/destination sorted by ID | Retain immutable replay; narrow dependency evaluation |
| Label/milestone administration | Exclusive; excludes ordinary assignment validation | Retain historical reference exceptions |
| Work creation/PATCH/status/board/parent/bulk/import | Shared, every affected project | Hierarchy/board keys where required; counter before parent, ordered cycle/work sets, locked decisions; per-item bulk rollback |
| Dependency add/remove | Shared, both projects sorted | Workspace graph key before reachability checks; ordered endpoints before edge row |
| Comment add/edit/delete | Shared | Work-before-comment row order, no-op behavior |
| Attachment upload/remove | Shared | Retain compensation, project/work/file order |
| Watch/unwatch and report publication | Shared | Work before explicit watcher writes; report publication keeps its own enclosing write |
| Project saved-view changes, including pin/query/name | Shared | Retain permission and archived-project semantics |
| Workspace views and Inbox read-state | None | Preserve independent workspace/member scope |
| New project creation | No preexisting project key | Atomic creation/activity and unique-key backstop |

Project gates are installed in every listed command family. Lifecycle decisions and ordinary writes
exclude one another; two ordinary writers can still proceed together, and unrelated projects remain
independent. Creation takes hierarchy then board keys and allocates its counter before cycle/parent
rows. Import acquires those operation keys before validation/its row loop; creation reentry is idempotent.
Parent/type edits use the hierarchy key, retaining the existing type-agnostic two-level model. Work
cannot become both a parent and a child; no story-only or new type restriction is introduced.

Status/bulk-status/board writers take the project board key before work locks and neighbor reads.
Board moves prelock the complete target column plus moving row in ID order because compaction may
touch all of them. Compaction assigns positions in board order, updates rows in ID order, excludes the
moving row until its final update, and preserves other rows' timestamps. Boards remain complete beyond
interactive pagination. Description-only PATCH does not take the board or hierarchy key. Identical
status and already-positioned board commands retain timestamps and emit no status evidence.

Cycle assignment locks discovered source/requested destination IDs before work. If current cycle
membership changed while waiting, return a controlled conflict rather than acquiring an unplanned
earlier lock or overwriting with a stale decision. Hierarchy/relationship planners similarly revalidate
their discovered context. These cooperative protocols cover the supported application paths, not every
possible direct SQL mutation, arbitrary outer transaction, infrastructure failure, or storage operation.
Large imports and complete-column compaction can hold locks for their full transaction; there is no
automatic retry or claim of unlimited mutation throughput. Workspace graph mutations intentionally
serialize even when endpoint pairs are disjoint, preventing multi-edge cross-project cycles.

Cycle availability checks run after the exclusive gate. Inclusive overlap, one active nonarchived cycle,
case-insensitive nonarchived names, and historical exceptions remain unchanged. A queued generic edit
cannot reactivate a completed cycle. Closeout excludes assignment/status writers during enumeration;
completed/canceled assignments remain permitted by the existing work-reference policy after it commits.
Stored closeout evidence and replay are not recomputed from later live work changes. Known project-key,
cycle-active/name, label-name, and milestone-name unique violations map to controlled conflicts; unrelated
database failures are not relabeled.

These locks are cooperative, transaction-scoped application guarantees. Arbitrary SQL/repository calls
outside command owners bypass them. Member/workspace administration remains outside project coordination;
preserve its existing policies rather than inferring new role restrictions. See the
[read-only cycle diagnostic and remediation guide](cycle-diagnostics.md) for preexisting schedule issues.

## Testing And Verification

Run database-backed checks through `npm run verify -- --mode=api`. It provisions owned disposable
PostgreSQL/storage; never point rollback or concurrency tests at the working application database.
See the [README verification guide](../README.md#verification) and
[current evidence](v0.3.0/verification-notes.md).

Choose checks from changed code, affected consumers, and risk. API mode includes backend source/test
lint, backend typechecks, resource checks, and API tests without Angular/build/browser/site execution.
For narrow changes, `--api-tests=server,work-item-csv-http` selects existing API test basenames; path,
option, empty, and nonexistent selections fail rather than passing an empty suite. Shared HTTP or
persistence infrastructure warrants the full API suite. `--mode=web` runs frontend lint, development
typecheck/build, Karma/Jasmine and production build/budgets without PostgreSQL or application servers.
Frontend changes use that profile and affected browser flows; shared contracts include affected consumers.
Docs-only updates need links and
format checks. Broaden for dependency/toolchain/cross-cutting changes. Reserve full verification for
release closeout and CI merge acceptance, not every phase. State selected checks and omissions in
phase evidence; unchanged-code results need not be rerun after documentation-only completion edits.

The [query/risk policy](v0.3.0/query-policy.md) owns the live field matrix and frozen v1/v2 semantics.
Do not evolve stored snapshot types/parsers by inheriting expanded live shapes. Risk links must preserve
open/scope/estimate predicates and explicit false values end to end.

## HTTP Parsing And Safe Logging

`adapters/express/body-parsing.ts` owns transport budgets: ordinary JSON is 102,400 bytes; the two
registered import POST routes allow 6,295,552 bytes. An exact-route router parses imports before the
ordinary parser, without widening wrong-method or prefix-neighbor requests. Import route constants
are shared with endpoint registration. The domain still limits raw CSV to 1,048,576 UTF-8 bytes,
250 data rows, and existing field/source lengths. Escaping/transport whitespace consumes envelope
budget, not extra raw CSV allowance. Compressed JSON is rejected (`inflate: false`). Binary upload
parsing keeps its independent content-type/header, 4 MiB file, and storage-compensation boundaries.

`error-boundary.ts` converts parser failures to the existing safe JSON envelope: malformed JSON is
400/`VALIDATION_ERROR`, oversized transport is 413/`PAYLOAD_TOO_LARGE` with `limitBytes`, and unsupported
encodings/charsets are 415/`VALIDATION_ERROR`. No parser body/message/stack is returned or logged.
Unexpected middleware/endpoint errors produce only a fixed diagnostic, not the raw exception.

Request timing is installed before CORS, upload metadata checks, and all parsers. Finish/close listeners
emit one line containing only a known HTTP method, registered route template or fixed failure/unmatched
category, status, and monotonic duration. Closed incomplete responses use the fixed aborted category
and logging-only status 499; no response can be delivered to an already-disconnected client. Never add
raw URLs, route parameters, queries, actor headers, CSV/authored content, or file metadata to these logs.

`http-body-boundary.test.ts` covers ordinary exact/over-limit, chunked, malformed, encoding, and safe
failure behavior; `request-logging.test.ts` includes a real partial-body disconnect.
`work-item-csv-http.test.ts` uses registered endpoints and real owned PostgreSQL to cover large valid
apply, exactly 1 MiB raw CSV with fully escaped JSON, exact/over transport, UTF-8 byte policy, row/field
failures, no-write rejections, and ordinary/prefix/method isolation. Attachment HTTP tests retain exact
4 MiB and oversized-upload assertions and cover early metadata rejection logging.

## Persistence Test Discipline

Repository-only unit tests explicitly choose `tests/support/fake-persistence.ts`. That fake executes
callbacks and refuses database locks; it does not simulate rollback, MVCC, or lifecycle safety. Real
tests use `createPersistence(db)` or `withTransactionScope(tx, mode, callback)` when coordinating an
explicit outer transaction. The outer-transaction caller owns its isolation/access configuration and
commit/rollback. Outer write callers must retain read-committed isolation for fresh post-gate rereads;
a bound capability does not replace an enclosing repeatable-read snapshot. Inject failures into the
callback's repositories without replacing real persistence.

The `persistence.test.ts` unit suite covers composition, configuration, scope identity/lifetime,
read-only restrictions, and advisory order. `persistence-integration.test.ts` proves real rollback,
repeatable-read hydration across an external commit, database-enforced read-only behavior, lock
lifetime/modes, and nested import/export/report participation. Existing attachment compensation and
real queued-edit/closeout/concurrency tests remain required. New database-independent test filenames
must be classified explicitly in `apps/api/vitest.config.ts`; unclassified files default to guarded
integration execution.

`project-coordination.test.ts` enumerates every participating write entry, blocks it behind an
incompatible project gate, and checks post-wait project writability. Separate real connections wait
for PostgreSQL to report the expected advisory blocker before releasing the first writer. It also
covers inclusive schedule races, reactivation, both cross-project relationship keys, reference archive
versus assignment, closeout/edit/assignment/status ordering, independent/shared writers, workspace
view/Inbox independence, real unique-index backstops, and read-only diagnostic output. Test barriers
have bounded waits; a timing sleep is not evidence that the second transaction reached its gate.

`work-command-concurrency.test.ts` covers status/board/bulk previous values, no-op timestamps, changed
cycle lock sets, opposing hierarchy and dependency commands, import/counter ordering, bulk rollback,
and adjacent comment/file/watch paths. Its compaction race requires the first writer to acquire the
moving row after the second writer has blocked on an earlier-ID row; locking the mover first would
expose an inversion. A real 103-row column checks that compaction never uses a paginated subset.
Disjoint endpoint pairs closing a longer dependency cycle prove workspace graph coordination, not
merely incidental serialization from shared endpoint rows. Unsupported direct SQL remains outside
these cooperative guarantees.

API HTTP tests use `tests/support/local-http.ts` instead of importing Supertest directly. Its fluent
assertions remain Supertest's, but connections target the owned listener's actual address family.
An IPv6 wildcard socket and an unrelated IPv4 service can share a port on macOS; Supertest's default
IPv4 URL can otherwise reach the wrong process. The sentinel regression uses two test-owned servers
to prove isolation, without stopping or querying unrelated services. Do not replace it with retries
or a working server URL.
