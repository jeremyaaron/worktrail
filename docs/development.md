# Worktrail Developer Ownership And Invariants

This is the current implementation guide, not a release archive. As of v0.3.0 Phase 7, persistence
ownership, batched queries, lifecycle coordination, and authoritative work/relationship commands are
implemented. Transport budgets, risk/snapshot policy, aggregate narrowing, and frontend consolidation
remain later phases in the [implementation plan](v0.3.0/implementation-plan.md).

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
export, and parent-reference projections do not retrieve those unused bytes. Detail and existing
internal full-domain evaluation reads retain their necessary types; this is not the Phase 10 dashboard
projection/narrowing work. Search predicates can still search authored source without selecting it.

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
