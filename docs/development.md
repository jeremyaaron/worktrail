# Worktrail Developer Ownership And Invariants

This is the current implementation guide, not a release archive. As of v0.3.0 Phase 4, persistence
ownership is implemented; command extraction, batching, and lifecycle coordination remain assigned
to later phases in the [implementation plan](v0.3.0/implementation-plan.md).

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
Repository-accepting helpers such as `createWorkItemWithRepositories`, DTO enrichment, relationship
summaries, and notification recording participate in their caller's scope; they do not own commits.
Import apply owns one write including validation and all rows. CSV export owns one consistent read;
report publication and its nested cycle snapshot share one write.

Bulk work-item updates deliberately commit per item and retain partial success. Each item executes
on a newly bound service, not on the outer root instance. Preliminary bulk validation is not proof
against lifecycle races; authoritative coordination/revalidation belongs to Phases 6-7.

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
locks. File bytes are written outside the database transaction. Upload compensates a failed database
write by removing the stored object; failed compensation records safe operational evidence without
replacing the original failure. Object-store I/O is not a distributed transaction. Do not wrap the
entire upload/download operation in a database scope or hold locks during object transfer.

Health, Quick Find, and activity-feed reads retain their existing focused read owners. Attachment
list/download preflight reads also retain their existing behavior. Required capability injection does
not imply these paths now have a cross-statement snapshot. Read/hydration extraction and measurable
query budgets are Phase 5 work; dashboard narrowing is Phase 10 work.

## Lock Ownership And Participation

`repositories/locks.ts` provides transaction-scoped advisory coordination with parameterized,
namespaced identities. Project requests are sorted by project ID, then workspace ID. Decide shared
or exclusive mode before acquisition; shared-to-exclusive upgrades are rejected. Reentry is
idempotent. Operation keys follow hierarchy, dependency, then board order, with stable keys within
each namespace. Acquire the complete affected project set before operation keys. No new earlier
project/operation key may be acquired after a later key.

The canonical command order for subsequent adoption is:

1. Project advisory coordination, sorted IDs and predetermined modes.
2. Hierarchy, workspace dependency graph, and board operation keys, in that order.
3. Updated project rows, including work-key counters.
4. Cycle rows by ID.
5. Work-item rows by ID.
6. Dependent rows by ID, then state/activity/notification evidence.

The helper enforces advisory acquisition order and scope mode/lifetime, not row-lock ordering or
command participation. It does not replace existing hierarchy/dependency/board repository locks yet.
Preliminary reads may discover IDs; they must not substitute for authoritative locked transition
validation or previous values.

| Command Family | Required Project Participation Planned For Phase 6 | Additional Phase 7 Responsibility |
| --- | --- | --- |
| Existing project metadata/archive/reactivate | Exclusive | Preserve current-state activity |
| Cycle create/update/archive/reactivate/closeout | Exclusive | Source/destination cycle and work order; immutable replay |
| Label/milestone administration | Exclusive | Serialize reference lifecycle with work assignment |
| Work creation/PATCH/status/board/parent/bulk/import | Shared, every affected project | Counter-before-work, hierarchy/board keys, locked revalidation, per-item bulk policy |
| Dependency add/remove | Shared, both projects sorted | Workspace graph key, ordered affected records |
| Comment add/edit/delete | Shared | Work-before-comment row order, no-op behavior |
| Attachment upload/remove | Shared | Retain compensation, project/work/file order |
| Watch/unwatch and report publication | Shared | Keep all database effects in the enclosing write |
| Project saved-view changes, including pin/query/name | Shared | Retain permission and archived-project semantics |
| Workspace views and Inbox read-state | None | Preserve independent workspace/member scope |
| New project creation | No preexisting project key | Atomic creation/activity and unique-key backstop |

**Phase 4 does not install these project advisory gates into commands.** Atomic transaction ownership
alone does not fix archive/assignment, overlap/closeout, stale status, graph, or hierarchy races.
Phases 6-7 must migrate every participant and prove the protocol with synchronized real connections
before claiming lifecycle safety. Member/workspace administration remains outside project coordination;
preserve its existing policies rather than inferring new role restrictions.

## Testing And Verification

Run database-backed checks through `npm run verify -- --mode=api`. It provisions owned disposable
PostgreSQL/storage; never point rollback or concurrency tests at the working application database.
See the [README verification guide](../README.md#verification) and
[current evidence](v0.3.0/verification-notes.md).

Repository-only unit tests explicitly choose `tests/support/fake-persistence.ts`. That fake executes
callbacks and refuses database locks; it does not simulate rollback, MVCC, or lifecycle safety. Real
tests use `createPersistence(db)` or `withTransactionScope(tx, mode, callback)` when coordinating an
explicit outer transaction. The outer-transaction caller owns its isolation/access configuration and
commit/rollback. Inject failures into the callback's repositories without replacing real persistence.

The `persistence.test.ts` unit suite covers composition, configuration, scope identity/lifetime,
read-only restrictions, and advisory order. `persistence-integration.test.ts` proves real rollback,
repeatable-read hydration across an external commit, database-enforced read-only behavior, lock
lifetime/modes, and nested import/export/report participation. Existing attachment compensation and
real queued-edit/closeout/concurrency tests remain required. New database-independent test filenames
must be classified explicitly in `apps/api/vitest.config.ts`; unclassified files default to guarded
integration execution.

API HTTP tests use `tests/support/local-http.ts` instead of importing Supertest directly. Its fluent
assertions remain Supertest's, but connections target the owned listener's actual address family.
An IPv6 wildcard socket and an unrelated IPv4 service can share a port on macOS; Supertest's default
IPv4 URL can otherwise reach the wrong process. The sentinel regression uses two test-owned servers
to prove isolation, without stopping or querying unrelated services. Do not replace it with retries
or a working server URL.
