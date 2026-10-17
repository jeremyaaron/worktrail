# Worktrail v0.3.0 Verification Notes

## Scope

Phase 1 establishes disposable API verification and destructive-operation guards. Evidence below
was collected on October 17, 2026 on macOS, using Node 20.19.1, npm 10.8.2, Docker 27.3.1,
PostgreSQL 16 containers, and the unchanged v0.2.9 dependency graph. Release acceptance and
browser/full-run orchestration are later phases in the [implementation plan](implementation-plan.md).

## Phase 1 Commands And Results

| Command | Result |
| --- | --- |
| `npm run verify -- --mode=api` | Final standalone run passed 16 resource tests and 601 API tests across 51 files; migrated its disposable database and removed owned resources |
| `npm run test:verification` | 16 tests passed; database-independent ownership, arguments, cleanup, process deadlines, stderr draining, and output redaction |
| `npm run test:verification:integration` | 8 real lifecycle tests passed, including the complete service-mode API run |
| `npm run test --workspace @worktrail/api -- --project=unit` | 238 tests across 26 files passed without PostgreSQL |
| Direct integration test without a manifest | Expected nonzero exit from integration setup before fixture mutation |
| `npm run lint --workspace @worktrail/api` | Passed |
| `npm run typecheck --workspace @worktrail/api` | Passed |
| `npm run build:api` | Passed |
| `git diff --check` | Passed |

The 238 API unit tests are included in the complete 601-test count, not an additional 238 tests.
The lifecycle suite runs the API runner itself; its eight cases should not be added to API coverage
as additional domain tests.

### Diagnostic Failure

One Docker API run started concurrently with the lifecycle suite failed with `socket hang up` in
`work-items.test.ts`, in the normalized UTF-16 create/update boundary case. It passed 600 of 601
tests, returned exit 1, and retained a sanitized summary with `cleaned: true`. A subsequent standalone
Docker run passed all 601 tests and 16 resource tests, without retries or changes to that test.
The service-mode acceptance run also passed. The cause of the intermittent socket error is not
established; this is not evidence of clean concurrent acceptance, which belongs to Phase 2.

## Resource Ownership

The default API command creates a uniquely labeled `postgres:16-alpine` container, maps PostgreSQL
to a random loopback port, and generates isolated credentials. There is no shared data volume or
fallback to the ordinary configured database. Container cleanup checks the exact name and both
run/nonce labels, then removes the container and its anonymous volume.

Service mode requires an explicit administrative URL and CREATE DATABASE privileges. It creates
`worktrail_verify_<UUID hex>`, stamps its database comment with the run identity/nonce, and verifies
that marker before disabling connections, terminating sessions scoped to that database, or dropping
it. Lifecycle checks used an administrator hosted in their own disposable Docker container; they
did not require changing the local `worktrail` role's privileges or use port 5432.

Each run records resources in an OS-temporary `worktrail-verify-*` directory with mode 0700 and
`manifest.json` with mode 0600. The parent marker is outside the resettable `attachments/` subtree.
Guards validate canonical paths, reject symlinks, compare the environment's exact database/storage
targets, and check `current_database()` plus its live ownership comment. Prepared state must be in
that validated manifest; locality, naming, `CI=true`, and skip flags grant no reset authority.

Database-backed Vitest files use guarded global setup before test modules execute. The 26 explicitly
classified unit files remain independent of PostgreSQL; new files default to guarded integration.
Workspace fixture cleanup rechecks live ownership before deletion. Test-context executable migration,
seed, database/storage reset, and both performance scripts use the same proof. Legacy browser setup,
teardown, and per-test reset check it before either mutation or an early skip return.

## Lifecycle Checks

The eight real lifecycle checks cover:

- Service provisioning, live target mismatch, unowned reset/migrate/seed/storage/performance and
  browser skip-flag refusals, marker mismatch cleanup refusal, and idempotent cleanup. An owned
  throwaway sentinel table retained its value, and no application tables were created by refused
  commands. No destructive rejection probe used working data.
- Migration, repeated seed, storage reset, database reset, remigration, and reseed while the database
  comment and parent ownership marker remain valid.
- Real Docker container creation interrupted before startup, followed by owned cleanup.
- Explicit CLI cleanup of an abandoned service run and a second already-cleaned invocation.
- An injected command failure retaining exit 1 while removing its service database and storage.
- SIGINT after migration retaining exit 130 and cleaning owned children, database, and storage.
- SIGTERM after migration retaining exit 143 with the same cleanup assertions.
- The complete service-mode API runner succeeding and cleaning its resources.

Resource unit tests also cover active-owner refusal, container label mismatch, invalid manifests and
storage symlinks, connection target overrides, and command failure/abort/deadline handling. Credential
redaction is tested across stream chunks; captured stderr is drained to prevent pipe deadlocks.

Process cleanup uses recorded PIDs, start-time fingerprints, and POSIX process groups. Shutdown
waits for the owned group and has bounded TERM/KILL escalation. Abandoned cleanup conservatively
refuses a group whose identity cannot be verified rather than guessing from a port or command name.
This is accidental-target protection on a trusted local machine, not isolation from a malicious
process running as the same OS user.

## Cleanup And Remaining Gates

Final Docker inspection found no containers carrying `worktrail.verify.run`. Successful runner and
lifecycle checks assert removal of their temporary roots and service databases. Sanitized results
remain under ignored `test-results/verification/<runId>/summary.json`; private connection credentials
and nonces are not copied into those summaries. No application server was started or unrelated
process stopped.

SIGKILL/crash cleanup is explicit: retain the printed private manifest path and use
`npm run verify -- --cleanup /absolute/run/manifest.json` after inspection. Missing resources are
idempotent; mismatched ownership retains resources for investigation. A service failure between
database creation and marker persistence can require operator inspection because cleanup refuses an
unmarked database. A stale cleanup lock or unverifiable process group also requires inspection.

This phase does not validate Angular rendering, full/browser/preview/editor/site orchestration,
Linux CI, concurrent browser acceptance, dependency remediation, or release UAT. Phase 2 must migrate
the existing direct CI test/setup sequence to the owned runner before it can pass the new guards.
Versions remain 0.2.9; no install, commit, push, merge, tag, or deployment is part of this phase.
