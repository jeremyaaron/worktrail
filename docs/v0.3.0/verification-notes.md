# Worktrail v0.3.0 Verification Notes

## Scope

Phases 1-2 establish disposable API/browser verification and destructive-operation guards. Evidence below
was collected on October 17, 2026 on macOS, using Node 20.19.1, npm 10.8.2, Docker 27.3.1,
PostgreSQL 16 containers, and the unchanged v0.2.9 dependency graph. Release acceptance remains
scheduled for later phases in the [implementation plan](implementation-plan.md).

Phase 3 uses the updated dependency graph and Node 24/npm 11; its evidence and diagnostics are
recorded separately below. Earlier phase results retain their original toolchain context.

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

## Phase 1 Lifecycle Checks

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

## Phase 1 Cleanup And Remaining Gates

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

At Phase 1 completion, Angular rendering, full/browser/preview/editor/site orchestration, Linux CI,
concurrent browser acceptance, dependency remediation, and release UAT remained pending. Phase 2
was assigned the CI migration and browser orchestration described below. Versions remained 0.2.9;
Phase 1 did not install, commit, push, merge, tag, or deploy anything.

## Phase 2 Implementation

The default command now selects full verification. API, E2E, compiled preview, standalone editor,
and site modes remain available independently. Root E2E/editor/preview/UI commands delegate to the
owner; Playwright configurations only consume a matching validated stage and never start/reuse their
own servers. Interactive UI closure records an indeterminate test outcome, not automated acceptance.

### Workspace And Port Isolation

Every invocation snapshots source, configuration, documentation, and test fixtures under its marked
temporary root. It excludes `.env*`, working attachment data, existing build outputs, and caches.
Installed dependencies are linked read-only; internal workspace package links resolve into the
snapshot, so compiled API preview uses that run's real compiled contract exports. Source/config
snapshots and generated proxy files are independent of the working checkout. Source edits require
a new invocation, including for UI mode.

Angular builds, native test output, editor compilation, and preview assets stay inside the owned
root. Angular's persistent cache and prebundling are disabled in the copied configuration, not in
the developer's workspace. There is no shared build step requiring a checkout lock.

API/web/preview/editor ports are selected before migration and seed and propagated with the absolute
attachment root. Native Karma gets a separately allocated loopback port and private browser profile.
The runner initializes the object-store marker before resetting a freshly created store, then seeds
matching objects into the same root used by its servers. Full mode resets only its database between
the API, application-browser, and compiled-preview stages.

Before bind handoff, requested ports are checked without terminating their occupants. Automatic
handoff collisions can allocate again at most three times after stopping that attempt's children;
browser tests themselves never retry. Readiness verifies the run-specific response token and the
recorded child identity, not just a healthy HTTP response. The temporary Angular proxy targets the
owned API, and internal browser contexts reject missing/mismatched ports or host rather than allowing
legacy HTTP helpers to fall back to a working server on port 3000.

### Processes And Evidence

Manifest writes are serialized within the owner. Commands record their PID/start-time fingerprints
before readiness; browser/command supervision also records detached descendant groups observed
under that child's process ancestry. Cleanup waits for these groups, applies bounded TERM/KILL only
to recorded identities, and preserves a primary test/startup failure if cleanup also fails. Startup
cannot continue to a new stage when an owned server's cleanup is incomplete.

Browser reports and artifacts have independent paths under
`test-results/verification/<runId>/{editor,e2e,preview}/`. JSON summaries contain gate names, durations,
outcomes, and cleanup state, not credentials or nonces. Traces and screenshots survive run-directory
cleanup. Legacy browser teardown no longer restores any configured demo database or attachment root;
per-test reseeding still validates live ownership and stays inside the owned target.

### Test Code And CI

`lint:verification` covers API tests/support/configuration, E2E, Playwright configs, editor harness
TypeScript, and runner JavaScript/CommonJS. `typecheck:verification` checks browser/config TypeScript,
the editor benchmark's real Window contract, checked-JSDoc port support, and API source/tests. Production
strictness is unchanged. The newly covered legacy test code had an unused type import and a cleanup
throw that could mask the primary workflow failure; both were corrected.

Karma/Jasmine still execute the Angular suite. A small launcher uses Playwright's installed Chromium
and lifecycle handling, with a run-owned profile, zero launch retries, and no requirement for a
separate system Chrome installation. The existing standalone editor tests remain independent of
PostgreSQL and the application build.

CI installs dependencies and Chromium, then calls `npm run verify -- --database=service` with an
explicit provisioning URL for its disposable PostgreSQL service. It retains production audit,
lint/typecheck, migrations, package/native-editor/application/compiled-preview tests, production
build, site checks, visible gate output, and failure artifact upload. YAML was parsed and the runner,
provisioning variable, artifact step, and removal of the legacy reset sequence were checked locally.
Remote GitHub Actions success is separate evidence; no push or workflow dispatch was performed.

## Phase 2 Diagnostic Runs

Initial setup checks exposed a missing object-store marker on a new root, a missing source API
tsconfig path during cold bootstrap, and documentation fixtures omitted from the source snapshot.
These were fixed before acceptance. Native Karma's original browser launch stalled; the initial
adapter also exposed an incorrect process-decorator choice. The working adapter retains Karma's
base/capture-timeout/retry decorators without its separate executable-process launcher.

After planned ports began propagating into test children, the synthetic port-collision unit fixture
inherited its parent run's editor-port request and correctly treated it as explicit. The fixture now
supplies an isolated request environment; real requested ports still fail without automatic retries.

Heavy concurrent diagnostic runs also reproduced intermittent `socket hang up` failures in the
existing work-item HTTP tests (one full API gate had 599/601 passing). Another lifecycle run failed
its nested API gate while its resource isolation and browser interruption checks passed. A superseded
full run had an attachment archived-read assertion exceed its five-second wait while its reloaded
page was still initializing, then was intentionally stopped. These are not clean acceptance runs,
and the underlying transient HTTP cause has not been established. No test retries, increased
assertion timeouts, or application behavior changes were used to turn them into acceptance evidence.
The focused service/API and editor-interruption diagnostic rerun passed 2 selected cases with 8
skipped; it is not counted as a ten-case acceptance run.

## Phase 2 Acceptance Results

| Check | Result |
| --- | --- |
| Final `npm run verify` using Docker | All 24 gates passed; 25 resource, 601 API, 54 contracts, and 652 Angular tests; 5 editor, 34 application, and 1 compiled-preview browser tests |
| Local full service-mode baseline | All 24 gates passed against an explicitly provisioned Docker-hosted administrator, including all 40 browser tests; child database and administrator container removed |
| `npm run test:verification` | 25 passed, including planned-port propagation, explicit-occupant preservation, default handoff retry, no browser-test retry, secondary cleanup failure preservation, and detached TERM-ignoring child cleanup |
| Final `npm run test:verification:integration` | 10 passed, 0 failed/skipped; 87.7 seconds locally |
| `npm run lint:verification` | Passed |
| `npm run typecheck:verification` | Passed, including API source/tests |
| Direct `npx playwright test --list` without ownership | Expected exit 1 before startup or data access |
| CI workflow YAML and local documentation links | Parsed/checked successfully |
| `git diff --check` | Passed |

The final Docker full run followed the port-preflight and fixture-environment refinements. The full
service baseline preceded that last preflight refinement; service provisioning/cleanup helpers were
unchanged, and the final lifecycle suite reran the current API/service path. Browser JSON reports for
accepted full runs record zero unexpected, flaky, or skipped tests, with retries disabled. The
compiled preview exercised hashed assets, deep links, read/editor behavior, API 404 separation, and
five widths from 320 to 1440 pixels. Production initial output was 386.62 kB (104.33 kB estimated
transfer), with unchanged 550 kB/1 MB initial and 8 kB/12 kB component-style budgets and no budget
warnings. Production auditing reported zero findings; it was not a development-inclusive audit.

The ten-case lifecycle suite preserves the eight Phase 1 scenarios and adds two actual browser
checks. Two concurrent runs use distinct API/web ports, proxies, snapshots, databases, attachment
roots, and report directories. Both render Work Items; after one is interrupted and removed, the
other reloads, retains its SQL/file sentinels, verifies live ownership, and passes one selected E2E
test. It also rejects missing/wrong API port and host contexts before HTTP helpers can run. The
editor CLI runs with deliberately unusable Docker/admin/database targets and an external storage
sentinel, then receives SIGTERM after its first real browser test. It exits 143, leaves the sentinel
untouched, removes its private root, and verifies that captured Chromium descendants have exited.

These counts are separate checks, not an aggregate coverage total: the lifecycle suite includes
another complete API run and a selected E2E case already represented in the full suite. Final
summaries record `passed: true` and `cleaned: true`; browser artifacts remain outside deleted roots.
Final inspection found no containers with the verification ownership label and no verification
runner/API/editor/Angular child processes. The user's ordinary PostgreSQL database, attachment root,
and unrelated servers were not used as disposable resources.

## Phase 2 Limits

Site verification currently parses local HTML and checks assets, duplicate IDs, image alt attributes,
and local fragments. It does not verify external link availability or the rendered/release assertions
assigned to Phase 19. UI mode's ownership path is implemented, but interactive UI operation is not
claimed as manual UAT. Linux remote CI, dependency remediation (Phase 3), and final v0.3.0 product
acceptance (Phases 20-21) remain separate gates. Versions and the dependency lockfile are unchanged.

## Phase 3 Toolchain And Audit Gate

The [dependency disposition](dependency-remediation.md), [structured before/after evidence](dependency-audit-evidence.json),
and [exception policy](../security/development-audit-exceptions.json) record the exact graph and
review. Baseline audit commit: `696c67fa7c20f08f7b07a7ec7dd660d1c7ad3340`. It was audited again in
an owned scratch checkout with the original manifests/lockfile: 34 full findings (8 moderate,
21 high, 5 critical), zero production findings.

Final compatible versions are Angular CLI/build `20.3.40`, Vitest `4.1.12` for API/contracts,
web Vitest peer `3.2.7` (Karma remains active), and concurrently `9.2.5`. Transitive security
updates stay within their updated owners' ranges. Angular runtime/compiler `20.3.33`, CDK
`20.2.14`, TypeScript `5.9.3`, Drizzle ORM `0.45.2`/Kit `0.31.10`, pg `8.22.0`, and Playwright
`1.61.1` remain unchanged. Package/release identity remains `0.2.9`.

Local acceptance uses installed Node `24.16.0`, npm `11.13.0`, Docker `27.3.1`, PostgreSQL 16,
and Chromium `149.0.7827.55`. `.nvmrc`, root engines, README, and CI now select Node 24/npm 11;
the former Node 20 runtime is no longer the declared supported baseline. No global nvm default
or global npm installation was changed during this work.

The full audit now reports **13** package findings: 5 moderate, 6 high, and 2 critical. They trace
to five advisory IDs and 19 exact advisory/package/path/version/severity fingerprints, including
npm's affected-parent rows. Production remains at **zero**. Remaining critical rows belong to the
unexecuted web Vitest 3/Tinypool graph, not the active API/contracts Vitest 4 runner. This is a
bounded disposition, not a clean full-tree audit or a claim that development risk is harmless.

All five exceptions have owner `jeremyaaron`, concrete commands, dependency chains, preconditions,
mitigations, follow-up, and expiry at 00:00 UTC November 16, 2026 or v0.3.1, whichever is first.
Phase 21 must supply the actual release date; expiry cannot exceed 30 days after that date.
`npm run audit:dependencies` validates installed peer compatibility, checks separate production/
full reports, and rejects unknown/changed findings, stale/duplicate records, expired policy, and
transport/JSON/status/count failures. Production findings cannot use exceptions.

The full runner checks schema generation after owned database provisioning, inside its private
source snapshot. All 19 tables and the complete SQL/journal/snapshot inventory match without
generated churn. Root migration files are not rewritten. Audit graph checks inspect the actual
read-only dependency installation owner only after matching its lockfile bytes to the snapshot;
they do not mistake the intentionally symlinked mirror for a new npm installation.

## Phase 3 Diagnostic Runs

- npm 10.8.2 and a temporary npm 10.9.9 resolver invocation failed initial compatible peer
  resolution with an Arborist `edgesOut` TypeError. npm 11.13.0 resolved without forced peers.
- Early Node 20 full run `345cb835-f9fa-407b-8c34-2da521662601` passed audit/lint/typechecks,
  generation/migrations, and 38 resource tests, then failed two API HTTP cases with `socket hang up`
  (599/601 passed). It cleaned its resources. The transient cause remains unproven, as in Phase 2;
  no test retries, timeout increases, or application behavior changes were used to hide it.
- npm 11's pruned optional-peer candidate had ten full findings and passed all 25 application gates
  in run `0436bf64-40f1-4b92-81b6-4a02da1bf8b0`, but `npm ls --all` exposed Angular's invalid
  optional Vitest peer. It is rejected compatibility evidence, not the final accepted graph. The
  explicit web Vitest 3 peer binding restores valid ranges and the honest 13-finding disposition.
- During gate integration, run `d7dc9704-5307-4316-b025-a488f916a4ad` failed graph validation because
  npm interpreted the private dependency mirror's symlinks as extraneous/missing packages; cleanup
  succeeded before database provisioning. The gate now checks the matching real installation owner.
  A snapshot test's raw trailing-slash path comparison was also corrected; all 41 resource tests
  subsequently passed. Superseded run `842bafa8-a577-4e18-9761-c1de135133d4` was intentionally
  interrupted during typechecking and cleaned before the final run.

## Phase 3 Acceptance Results

| Check | Result |
| --- | --- |
| Clean `npm ci` on Node 24/npm 11 | Passed on the final peer-complete lockfile; 804 installed packages, no engine or peer-resolution failure |
| `npm ls --all` and `npm run audit:dependencies` | Valid installed graph; zero production findings; all 13 full findings accounted by five unexpired advisory records |
| Final owned `npm run verify` | All 25 gates passed; 41 resource, 601 API across 51 files, 54 contracts across 12 files, and 652 Angular tests |
| Browser reports from that full run | 5 editor, 34 application E2E, 1 compiled-preview test; zero unexpected, skipped, or flaky results; retries remain disabled |
| Scratch `db:generate` inventory | 19 tables, no changes to SQL, journal, or snapshots; no working migration churn |
| `npm run test:verification:integration` | 10 passed, zero failed/skipped; 106.4 seconds; includes complete service-mode API verification |
| Final audit-threshold refinement | Informational findings included explicitly; fresh live audit and all 15 focused audit/graph/policy tests passed |
| CI YAML, current documentation links, structured audit evidence | Parsed/checked; recorded final audit matches all 19 fresh fingerprints |
| `git diff --check` | Passed |

Accepted full run: `4e3aad8e-20ab-4bbe-b727-80b305afdd13`. Its sanitized summary records
`passed: true`, `cleaned: true`, and all 25 gates passed. Browser reports remain at
`test-results/verification/<runId>/{editor,e2e,preview}/report.json`. The subsequent threshold-only
refinement changes audit exit semantics for informational findings; focused checks reran after it.
It does not change the accepted dependency graph, application code, build, or browser behavior.

Final lockfile SHA-256: `1ec83ae173d3ff00de10d2021cf3c9129adbf271a3cd4c15bedeae521ec3b5ff`.
Production initial output remains **386.62 kB**, **104.33 kB** estimated transfer; heavy detail,
Planning, and Markdown code remains lazy. Initial 550 kB warning/1 MB error and component-style
8 kB warning/12 kB error limits are unchanged, and production compilation emits no budget warning.
Compiled preview retains deep links, hashed assets, editor/read behavior, API 404 separation, and
responsive checks from 320 to 1440 pixels. No assertion timeout or test retry was increased.

Lifecycle verification reproves fresh service databases, refusal/preservation sentinels, repeated
migrations/seeds/resets, partial Docker cleanup, abandoned cleanup, failure status, SIGINT/SIGTERM,
two concurrent API/web/database/storage/result contexts, and real editor-browser descendant cleanup.
Its nested API/E2E counts overlap the full suite and must not be added as new domain coverage.
The ordinary configured PostgreSQL database and attachment store were not test resources.

Final inspection found no containers bearing the verification ownership label and no owned
verification runner, API, Angular, or editor server processes. The final focused verification
lint and all 40 checked local documentation links passed.

## Phase 3 Limits

This is local macOS acceptance, not a remote Linux CI result or manual v0.3.0 UAT. CI retains its
owned service-mode full workflow and now selects Node 24; merge/push remain user-controlled.
The full dependency tree is not clean: use the bounded exception policy and review its exact
exposure assumptions before changing test builders or exposing development/schema tooling.
No global runtime default was changed, no working data was reset, and no release identity was bumped.
Phase 4 and later feature/refactor work and final release acceptance remain pending.

## Phase 4 Implementation And Acceptance

Evidence collected October 17, 2026 on macOS with Node 24.16.0/npm 11.13.0 and disposable PostgreSQL
16. The dependency graph, schema/migrations, contract shape, and release identity remain unchanged.

Required persistence capabilities now own writes and consistent reads through composition, endpoints,
and affected services. Bound service bodies keep context-based private helpers on the transaction's
repositories. Inner import/export/report/cycle work shares that scope without a nested transaction or
savepoint. Root writes specify read committed/read write; independent reads specify repeatable
read/read only. Nested reads inherit the enclosing write's isolation. Writes/locks in read-only scopes
and escaped capability/lock calls are rejected. Repositories are not revocable proxies: callers must
await all work and keep them inside the callback.

Project metadata/archive/reactivate, saved-view create/update/delete, and watcher mutations now have
real write scopes alongside existing work/cycle/comment/label/milestone/report owners. Bulk writes
still commit per item. Applicable database state/activity/mentions/watchers/notifications roll back
together; attachment storage transfer and compensation retain their existing separate boundary.
The current ownership/lock inventory lives in [the developer guide](../development.md).

| Check | Result |
| --- | --- |
| Final `npm run verify -- --mode=api` | Passed 630 API tests across 54 files, plus 41 resource tests; migrated and cleaned its owned database/storage |
| Database-independent API project | 250 tests across 28 files passed; included in the complete 630 count, not additional coverage |
| API and verification TypeScript checks | Passed `npm run typecheck:verification`, including the API project |
| Contracts typecheck/tests | Passed; 54 tests across 12 files |
| API and verification lint | Passed with zero warnings |
| API build | Passed |
| Local documentation links and `git diff --check` | Passed |

Final API run: `8c1da09d-cecb-4216-8979-817e21998358`. Its sanitized summary records `passed: true`,
`cleaned: true`, and four successful gates. No integration case was retried. The final API output
contained no pg concurrent-client-query deprecation; migrated single-connection reads/side effects
now await sequentially, with collection hydration using the small `mapSequential` helper.

### New Coverage

The 29 added tests comprise ten persistence/ordering/sequencing unit cases, seventeen real database
cases, and two local HTTP-destination unit cases. Real PostgreSQL coverage verifies:

- Project metadata/archive/reactivate rollback when activity persistence fails.
- Shared saved-view creation/rename/deletion rollback when audit persistence fails.
- Label/milestone creation rollback with activity, and watch/unwatch rollback after hydration failure.
- Comment and assignment rollback after notification rows have actually been written, including
  primary state, activity, mentions, and automatic watcher registration.
- Count/window/reporter hydration from the same repeatable-read snapshot while another connection
  commits a new item and changes the reporter; a subsequent independent read sees the new values.
- PostgreSQL-enforced read-only mutation refusal, advisory shared/exclusive cooperation on separate
  connections, and lock release on both commit and rollback.
- One enclosing transaction each for import apply, CSV export, and report publication with a nested
  current-cycle snapshot. Existing queued-edit, hierarchy, closeout, and attachment compensation/
  concurrency regressions also pass on real capabilities rather than an optional-db fallback.

Unit cases cover required composition (including compile-time refusal), explicit fakes, root
configuration, nested identity, scope lifetime, read-only restrictions, sorted/namespaced lock modes,
duplicate requests, batch validation before acquisition, no upgrades, and sequential failure handling.

### Diagnostic Runs And HTTP Destination Repair

The first owned migration run, `7c9c709c-a304-4495-8b42-f42f8adef12d`, passed 605/623 API tests and
failed 18: comment creation had been incorrectly classified as read-only, and a Planning test spy
observed root rather than scoped repositories. Both were corrected. That run also exposed the pg
concurrent-client-query deprecation after expanding transaction ownership; sequential query execution
removed its cause rather than silencing it. Cleanup succeeded.

Intermediate standalone runs `8a3bba5e-501c-40a9-abcb-1bd81c4f91f3` and
`dcf617f0-b91b-4410-8b83-da2b856c5864` passed 625 and 627 API tests respectively while coverage was
being added. Run `ee77cf83-63c4-4b6e-af74-3d95a56ab225` then passed 626/628 and failed with unexpected
HTTP 401/404 responses. It cleaned its resources and is not acceptance evidence.

An owned two-server reproduction showed a macOS wildcard IPv6 listener could share a numeric port
with a separately bound IPv4 listener. Supertest's generated IPv4 URL reached the other listener;
explicit IPv6 connection reached the intended server. Worktrail has no active handler producing that
401. API HTTP tests now use the actual listener family via Superagent's connection override, retaining
Supertest's assertions and cleanup. Sentinel tests prove an IPv6 request cannot reach the test-owned
IPv4 service on the same port, and verify ordinary IPv4 behavior. No unrelated listener was stopped,
port fixed, timeout raised, test skipped, or retry enabled. This establishes and repairs destination
ambiguity; it does not retroactively establish the cause of every earlier socket-hang-up diagnostic.

### Cleanup And Remaining Limits

Final inspection found no verification-labeled containers or owned API/Angular/editor verification
servers. Working application data/storage were not test resources. No package version, dependency,
budget, migration, public-site capability claim, commit, push, tag, or deployment changed.

The full browser/Angular/preview workflow and remote Linux CI were not rerun in Phase 4. This is
focused local API/contracts acceptance, not release UAT. Existing role/no-op/archived behavior remains
covered, but atomic ownership alone does not serialize project lifecycle, schedule overlap, closeout
membership, graph, hierarchy, or stale status decisions. Typed advisory helpers are implemented and
tested; application project-gate participation and authoritative row ordering/revalidation remain
Phases 6-7. Query/hydration extraction and deterministic SQL budgets remain Phase 5, dashboard read
narrowing Phase 10, and final release acceptance Phases 20-21.
