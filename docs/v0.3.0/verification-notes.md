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

## Phase 5 Batched Query Ownership

Evidence collected October 17, 2026 on the Phase 3 Node 24/npm 11 toolchain and owned PostgreSQL 16.
`WorkItemQueryService` now owns list/page/board orchestration, and scoped `WorkItemHydrator` batches
all selected references. Existing endpoint/dashboard callers retain forwarding facade methods; CSV,
child lists, and bulk response summaries use the same hydrator. Page/board/export/parent selections
omit discarded authored source/format; detail and source-search behavior remain intact.

The [hydration evidence report](hydration-evidence.md) records complete before/after service and HTTP
statements, rows, response bytes, fixture modes, and diagnostic local timings. At 100 rows, project
service/HTTP costs fell from 409/410 to 12/13 statements; workspace costs from 408/409 to 11/12.
Counts include transaction control, authorization/count/window, all enrichment, and HTTP actor lookup.
After counts stay constant at 10/25/100 rows and for repeated/distinct references, below the unchanged
20-statement complete-path budget. Mixed-fixture JSON bytes are identical before/after; timings are
not acceptance thresholds. Final run artifacts retain all twenty measurements in `hydration-evidence.json`.

### Phase 5 Commands And Results

| Check | Result |
| --- | --- |
| Final `npm run verify -- --mode=api` | 657 API tests across 57 files and 41 resource tests passed; owned resources removed |
| API and verification typechecks | Passed `npm run typecheck:verification` |
| API and verification lint | Passed with zero warnings |
| Contracts typecheck/tests | Passed; 54 tests across 12 files |
| API build | Passed |
| Local documentation links and `git diff --check` | Passed |

Accepted run: `6b5ea786-1d24-4275-9ee9-458210e1adf6`; its sanitized summary records `passed: true`,
`cleaned: true`, and four successful gates. The 657 count includes 265 unit and 392 integration cases,
not additional suites to sum again. No test retry, skip, timeout increase, warning suppression,
dependency change, schema migration, or release-version bump was used.

The 27 new cases comprise thirteen hydrator unit cases, one additional workspace exact-cap CSV case,
one joined-project ownership predicate unit case, five complete-path budget cases, and seven real
consistency/projection/export cases. They cover repeated/distinct and differing reporter/assignee IDs,
database result reordering, historical/null/missing/foreign references, empty results, chunk bounds,
project/workspace full-filter CSV parity, 19 columns, actual source-free selected rows, and a real
501-row ordered export spanning two hydration chunks in one read transaction. Separate connections
commit member/milestone/cycle/label/parent/dependency changes while enclosing project/workspace reads
retain their snapshots; subsequent reads see the commit. Existing paging/filter/sort/search/hierarchy/
dependency and count/window concurrent-commit tests also remain passing.

### Phase 5 Diagnostic Runs

- `071df0d4-694f-4c87-8f97-b789c811bb7e` was intentionally interrupted during resource checks after
  TypeScript exposed missing required fixture timestamps. Exit 130 and owned cleanup were retained;
  no domain measurements from that superseded fixture are claimed.
- Baseline `316a9eec-666d-48b1-b48c-0f9e2dddd7a7` passed all 630 prior tests and failed only the three
  newly added budget cases as intended. It measured the old per-row fan-out, then cleaned resources.
- During migration, a standalone unit run and owned run `08346689-f2d0-426e-921e-7515ec4e326c` exposed
  one multiline CSV spy still targeting the removed enrichment owner. The owned run passed 632/633
  cases and cleaned resources. The test now spies on the actual hydrator; production behavior was not
  changed to accommodate a stale spy.
- Subsequent owned runs `c88b4bda-be9c-4f5d-8ace-5551de5960d6` and
  `edb55f32-2c10-46b3-949b-963ea82195bb` passed 653 and 657 cases as coverage was expanded. Final
  acceptance followed after strengthening the distinct workspace fixture and cardinality assertions.

### Phase 5 Limits And Cleanup

The ordinary configured database/store were never verification resources. Final inspection found no
verification-labeled containers or owned application/test servers. Generated measurements remain in
ignored run artifacts, with accepted values preserved in the committed report. No commit/push/tag/
deployment or public-site feature claim is part of this backend refactor.

The full Angular/browser/preview workflow, remote Linux CI, and release UAT were not rerun here. This
is focused local API/contracts acceptance. Internal dashboard evaluation can still read broad domain
rows and hydrate more than its preview; that is Phase 10 work. Capped CSV output remains materialized
in memory, and total export queries can grow by 500-row chunk. Exact count/index cost is not constant
in dataset size. Project/cycle/hierarchy/graph lifecycle coordination and command extraction remain
Phases 6-7; batching and snapshot coherence do not establish those race guarantees.

## Phase 6 Project And Cycle Coordination

Evidence collected October 17, 2026 on macOS with Node 24.16.0, npm 11.13.0, and owned PostgreSQL 16.
All project-dependent application write entries now acquire shared/exclusive transaction-scoped
project gates before authoritative lifecycle validation. Both relationship endpoint projects are
acquired together in stable ID order. Cycle edits lock/reread current state, and closeout locks its
source/destination cycle rows in ID order before enumerating work. Known unique-index backstops
produce controlled conflicts with the normal validation messages.

The [current command inventory](../development.md#lock-ownership-and-participation) records all owners
and the remaining Phase 7 obligations. Import remains one atomic apply and uses the complete scoped
creation capability, not a repository-only helper. Bulk retains per-item commits and existing error
codes, with project writability reread inside each item transaction. Workspace saved views and Inbox
read-state do not acquire a project key. No new role restrictions, assignment lifecycle rules,
extensions, constraints, migrations, dependencies, package versions, or budget thresholds were added.

### Phase 6 Verification

| Check | Result |
| --- | --- |
| Focused owned `npm run verify -- --mode=api` | 724 API tests across 59 files and 41 resource tests passed before the final coverage additions; cleaned owned resources |
| Final full `npm run verify` | All 25 gates passed; owned resources removed |
| API/contracts/Angular | 750 API tests across 59 files, 54 contract tests across 12 files, and 652 Angular tests passed |
| Resource/browser regressions | 41 resource, five editor, 34 application E2E, and one compiled production-preview test passed |
| Audit/lint/typechecks/schema/build/site | Passed; zero production audit findings, unchanged bounded development exceptions, no schema drift or budget warnings, and site assets/links valid |
| Read-only cycle diagnostic | Real CLI output and repository results match on an owned legacy-overlap fixture; schedules unchanged |
| Local documentation links | 58 local targets across seven files passed after final status updates |
| Whitespace review | `git diff --check` passed |

The final API coverage contains 275 unit and 475 integration tests, including ten new constraint
mapping unit cases and 83 real project-coordination cases. The focused run's tests are included in
the complete suite, not additional tests to sum again. Existing closeout rollback/replay, archived
and historical references, role, attachment compensation, no-op, and hydration budgets also pass.

Accepted full run: `76e71868-5274-45dd-9dc8-1ac69bb0c373`. Its sanitized summary under
`test-results/verification/<runId>/summary.json` records `passed: true`, `cleaned: true`, no interruption,
and 25 successful gates. Production initial output remains 386.62 kB with unchanged budgets. Browser
acceptance uses zero retries; no test skip or warning suppression was introduced.

The concurrency suite executes real service commands through separate PostgreSQL connections. Its
queue barrier observes an advisory-lock wait with the expected blocking backend in `pg_stat_activity`
and `pg_blocking_pids` before allowing the first writer to commit. Barrier waits are bounded, and the
explicit first transaction has local lock/statement timeouts; no timing sleep substitutes for reaching
the lock. Independent/shared-writer checks require the second command to finish while the first
connection still holds its gate.

Coverage enumerates every participating entry and checks post-wait archived-project behavior for
all shared entries, preserving saved-view `FORBIDDEN` and bulk per-item `VALIDATION_ERROR` contracts.
It covers both cross-project relationship keys, workspace view/Inbox independence, planned overlap,
inclusive touching dates, active/name conflicts, update/create and reactivation/create races, real
PostgreSQL unique-index violations, reference archive versus assignment, assignments before/after
closeout, queued status changes, and cycle edits on both sides of closeout. Completed state cannot
be resurrected by a queued edit;
stored carry-forward counts and replay remain unchanged by subsequent live work mutations.

The [operator diagnostic](../cycle-diagnostics.md) is read-only and excludes historical/archived
cycles. Its real CLI test compares exact conflict pairs/flags and verifies unchanged rows. Duplicate
active detection is available for legacy schemas without the current unique backstop; tests do not
drop that index or manufacture an unsupported schema to create duplicates.

### Phase 6 Diagnostics And Limits

Initial owned run `4d1c9b75-b049-4566-b009-f93ad5ed8225` passed the prior 657 API cases after gate
adoption. Expanded focused run `3a95feb5-02e6-4d15-b362-7a45838b00fa` passed 724 cases. Both cleaned
their resources. During authoring, typechecks caught test union/repository-name mistakes and nullable
lookup signatures; those were corrected before the expanded runs.

Full diagnostic run `9c54300f-9c52-4b34-acd2-cdfa664c059a` passed 746/747 API cases and failed only
the new bulk archive assertion: its expected `CONFLICT` did not match the existing per-item mapping
to `VALIDATION_ERROR`. The assertion now checks that existing code and the archived-project message;
production bulk error semantics were not changed. The run stopped at API verification and cleaned
its resources. Final mapping unit coverage also includes project, label, and milestone constraints.
No retries, skips, timeout increases, or warning suppression were used to resolve that failure.

These are cooperative project lifecycle guarantees, not protection from arbitrary SQL or direct
repository mutations. Shared ordinary writers are intentionally compatible. Authoritative work-row
previous values, hierarchy/counter and adjacent comment/file row order, graph reachability, board
serialization, and command extraction remain Phase 7. Creation's parent-before-counter inversion
is not repaired here. Attachment removal retains its existing object deletion inside a database
callback; upload transfer/compensation remains outside it, and neither is distributed storage atomicity.
Historical completed/canceled cycle assignments remain permitted after closeout commits; immutable
closeout evidence is distinct from later live membership.

All test mutations and CLI inspection used owned disposable resources, never the ordinary configured
database/store. Final inspection found no verification-labeled containers or owned application/test
servers; the accepted full run and diagnostic/focused run directories were removed. Ignored sanitized
results and browser evidence remain under their run IDs. No unrelated process was stopped.
Remote Linux CI, release UAT, and final release acceptance remain separate later gates. No commit,
push, tag, publication, deployment, or public-site feature claim is part of this phase.

## Phase 7 Authoritative Work Commands

Evidence collected October 17, 2026 with Node 24.16.0, npm 11.13.0, and owned PostgreSQL 16. The
work service is now a forwarding facade over focused single-command, bulk, detail-read, activity,
board-position, lock-planning, and write-policy owners. Existing service methods, endpoint/contracts,
source-format rules, query hydration, explicit-ID bulk semantics, and historical reference policies
remain supported. The [current guide](../development.md#work-command-owners) records their ownership.

Hierarchy/board operation keys precede project counters, ordered cycle sets, and ordered existing
work rows. Creation allocates its counter before locking a parent; import preplans keys before its
row loop and retains atomic apply. PATCH/status/board/bulk decisions use locked current work and
produce activity/notifications from real previous values. Bulk application failures now escape and
roll back the item transaction before conversion to its existing partial-failure response.

Relationship mutations acquire the workspace graph key after both project gates and before sorted
endpoint rows, reachability checks, and edge writes. Removal locks its edge after work. Comments and
explicit watches lock work before dependent records, compatible with attachment and automatic watcher
paths. Compaction prelocks the complete target column and mover in ID order, assigns positions in
board order, and updates rows in ID order without changing other items' timestamps. No-op status and
already-positioned board requests retain timestamps; description-only edits take no operation key.

UUID case normalization now precedes lock sorting/deduplication, mode checks, and key derivation.
This closes a real gate-alias gap for valid uppercase/lowercase project UUIDs. The work planner uses
the canonical discovered row ID, preserving previously supported uppercase PATCH/status/board IDs.
If a cycle source lock set changed while waiting, the command returns a controlled conflict rather
than acquiring an earlier-order lock late or applying a stale decision.

### Phase 7 Verification

| Check | Result |
| --- | --- |
| Focused owned API baseline | 750 existing API cases and 41 resource cases passed after initial extraction/locking |
| Expanded owned API | 779 API cases across 60 files and 41 resource cases passed before final watcher/UUID coverage |
| Final full `npm run verify` | All 25 gates passed; 784 API, 54 contract, 652 Angular, and 41 resource tests |
| Final browser reports | Five editor, 34 application E2E, and one compiled-preview test; zero unexpected, skipped, or flaky results |
| Audit/schema/build/site | Passed with existing dependency policy, schema, and build budgets unchanged |
| API/verification lint and typechecks | Passed during implementation; repeated by the full owner |
| Whitespace/local documentation links | Passed after final completion updates |

Final acceptance run `e9edfd3a-99ce-4bc3-bf04-6b0635cdb447` used the supported Node runtime and a
fresh disposable Docker PostgreSQL database after the user paused competing work. Its summary records
`passed: true`, `cleaned: true`, no interruption, and all 25 successful gates. All 20 changed API/E2E
source files matched the private verification snapshot. API verification took 19.79 seconds; the
unchanged deadlines, worker settings, and disabled test retries were retained. Browser reports remain
under `test-results/verification/<runId>/{editor,e2e,preview}/report.json`. The private run directory
was removed, and post-run inspection found no remaining owned test/app/build servers or verification
containers. Working application data and attachments were not verification targets.

The final added coverage is 33 integration cases in `work-command-concurrency.test.ts` and one lock
identity unit case in `persistence.test.ts`. The expanded suite contains 784 API cases:
276 unit and 508 integration, not counts to sum with earlier focused runs. Test barriers observe a
real blocked backend through `pg_stat_activity` and `pg_blocking_pids` before committing the first
command, with bounded waits and local first-transaction lock/statement timeouts. No scheduling sleep,
test retry, skip, timeout increase, or warning suppression substitutes for synchronization.

Coverage includes queued status/board/bulk transitions and field comparisons, illegal transitions,
no-op timestamps, stale neighbors, description/board independence, opposing hierarchy assignments,
child creation versus parent/type edits, counter-before-parent and import key planning, import/child
execution, changed cycle lock sets, rollback after a bulk evidence error, duplicate/opposing/disjoint
dependency edges, permission after reassignment, duplicate edge removal, adjacent comment/file paths,
automatic/explicit watchers, closeout replay after bulk changes, and equivalent UUID spellings.

The compaction ordering race holds an earlier-ID row, starts a real move, observes its wait, and then
requires the first transaction to acquire the higher-ID mover before committing. A mover-first lock
would expose an inversion rather than being hidden by a generous deadline. A separate real 103-row
target column verifies complete compaction, unique positions, final order, and unchanged timestamps
outside the moving work item. The disjoint-endpoint dependency test closes a longer cross-project
cycle, proving graph coordination rather than incidental shared-endpoint row serialization.

### Phase 7 Diagnostic Runs

- `0733d9ec-2a56-42b0-a12a-a5acbd19be77` passed the existing 750 API cases after the initial locking
  and extraction changes, then removed owned resources.
- `86620c44-936d-49d1-bcaa-28631eaf4f08` passed all 26 then-new concurrency cases and 774/776 total
  API cases. Two existing HTTP cases (`saved-work-views` project mutation and the normalized UTF-16
  work description boundary) failed with `socket hang up`, not an application-error response. Cleanup
  passed. Inspection confirmed the local helper targets the listener's actual address family and
  Superagent disables connection pooling by default; no specific root cause was established. No
  retry, transport change, concurrency reduction, or timeout adjustment was introduced. Subsequent
  independent runs retain those tests unchanged; a clean run does not establish that resets are fixed.
- `35b933a6-eded-481b-8b65-e74ab3005a1a` passed 779 API cases and 41 resource cases after coverage
  expanded to full compaction, type-agnostic hierarchy, and attachment removal; cleanup passed.
- Full run `3ca0db41-803d-4d51-ac42-82847fb0cc17` passed 780 API cases, contracts 54, Angular 652,
  editor five, audit/lint/typecheck/schema/build gates, and the first six application E2E cases. It was
  deliberately interrupted with SIGINT after review exposed the UUID key-alias gap. Owner PID/start
  identity were verified before signaling. Exit 130 and owned cleanup were retained; this superseded
  snapshot is not final full acceptance. Unit and real-connection regressions now cover the fix.
- `9c1bf0ba-7218-452b-81e0-e5d9dbd90451` passed 783 API cases, contracts 54, Angular 652, editor
  five, and all 33 other application E2E cases. The authored-content security test failed its initial
  five-second content assertion while the lazy detail route was still loading. Its trace showed
  successful module requests and a successful detail response whose body finished only after the
  assertion deadline; the captured page was the shell with an empty main region, not rendered unsafe
  content. The test now waits for that exact GET response and its complete body before the unchanged
  rendering/security assertions. No timeout, retry, security policy, or production code was relaxed.
  Cleanup passed. A final relationship regression also retains the normal self-link validation error
  for differently cased endpoint aliases by deduplicating discovered canonical IDs before row locking.
- `1f31c828-45a2-47d1-9dc6-6b65dc57880d` passed audit/lint/typecheck/schema/resource gates and
  782/784 API cases. The existing exact-page/complete-board repository test and the new queued board
  previous-status case exceeded their unchanged five-second test deadlines; neither reported a
  domain assertion or PostgreSQL deadlock error. The same development build took 69 seconds versus
  roughly 17-19 seconds in preceding runs. Host inspection found substantial unrelated interactive
  CPU usage, no remaining owned verification/browser/build processes, and no remaining Docker
  containers. This is consistent with resource contention, not proof of a specific causal chain.
  Cleanup passed. This prompted the resource-relief request before the final acceptance run above;
  deadlines, worker counts, and retry settings were not relaxed, and no unrelated process was stopped
  by the agent.

Authoring typechecks caught missing constructor/import/delegation members during the owner split and
test union/notification-enum mistakes; those were corrected before owned acceptance. Nullable/current
state behavior and original validation bodies were retained rather than relaxing test expectations.

### Phase 7 Limits

This is a cooperative application protocol, not protection from arbitrary direct SQL, unreviewed
outer transactions, or every infrastructure failure. Large imports/complete-column compaction retain
transaction-length locks. Graph mutations intentionally serialize across the workspace. There is no
automatic retry, storage redesign, new parent-type restriction, dependency change, schema migration,
version bump, or budget increase. Attachment upload transfer/compensation stays outside DB locking;
removal retains its existing object delete inside the DB callback and is not distributed atomicity.

Snapshot/risk versioning and narrowed aggregate evaluation, HTTP import budgets, frontend context/
draft safety, public-site consolidation, release UAT, and remote Linux CI remain their later gates.
Phase 7 full-run acceptance is complete; the earlier HTTP socket resets remain unexplained rather
than claimed fixed by a passing rerun. Failed, interrupted, and final runs cleaned their owned
resources. No unrelated application was stopped by the agent. Working application data/storage were
never verification targets; no commit/push/tag/publication/deployment is authorized by this phase.

## Phase 8 Import Transport And Safe Errors

Completed October 17, 2026 using Node 24.16.0, npm 11.13.0, and owned disposable Docker PostgreSQL 16.
No frontend, shared contract, dependency/lockfile, migration/schema, version, or build budget changed.

### Implementation

- `body-parsing.ts` registers exact import POST routes before ordinary JSON parsing, sharing paths with
  endpoint registration. Import transport permits 6,295,552 bytes; ordinary JSON remains 102,400 bytes.
  Both JSON parsers disable inflation. Raw CSV remains 1,048,576 UTF-8 bytes with existing 250-row and
  field/source rules. Wrong methods and route-prefix neighbors do not inherit the larger budget.
- `error-boundary.ts` uses the existing safe error-envelope constructor: malformed JSON is 400 with
  `VALIDATION_ERROR`; oversized transport is 413 with `PAYLOAD_TOO_LARGE` and the selected limit;
  unsupported encodings/charsets are 415 with `VALIDATION_ERROR`. No raw parser message/body/stack is
  exposed. Unknown middleware and endpoint exceptions log only fixed diagnostics.
- Request timing precedes CORS, attachment metadata checks, and parsing. Monotonic finish/close
  listeners log one safe method/template-or-category/status/duration line. Incomplete closed
  responses use logging-only 499 and `[aborted]`, not a fictitious delivered response. Attachment
  metadata/size failures receive fixed categories without changing binary/storage policy.

### Verification Scope

Following the user-approved impact-based policy, shared HTTP middleware warranted the full API suite,
not a full application run. API mode now includes source/test lint and API source/test typechecking.
Explicit `--api-tests` basenames support narrower owned runs; empty/unsafe selections are rejected,
and selected files must exist before provisioning. The selection is retained in the run summary.
The final API command uses Vitest's `--silent=passed-only`: successful test console chatter is omitted,
but failing test logs and test results remain available. There is no retry/deadline/worker relaxation.

| Check | Result |
| --- | --- |
| Focused unit authoring checks | 36 then 43 cases passed as boundary/OpenAPI coverage expanded |
| Focused owned HTTP/import/attachment run | Seven gates passed; 90 selected API cases and 42 resource checks |
| Final owned API run | Seven gates passed; 812 API cases across 62 files and 42 resource checks |
| API source/test lint and typechecks | Passed in both owned runs |
| Runner source/argument lint | Passed separately; argument selection regression passed in resource suite |
| OpenAPI YAML structure | Parsed with the installed js-yaml dependency; both operations reference ErrorResponse for 400/413/415 |
| Local documentation links and whitespace | Passed after completion updates |
| Cleanup | Both summaries record cleaned true; private roots removed; no owned servers/containers remain |
| Angular/contracts/browser/build/site gates | Not applicable: no affected code/consumer change; not rerun or claimed passed |

Commands:

```sh
npm run verify -- --mode=api --api-tests=http-body-boundary,request-logging,server,openapi,work-item-csv-http,work-item-csv-import,attachment-endpoint
npm run verify -- --mode=api
npm exec -- eslint scripts/verify.mjs scripts/verification/arguments.mjs scripts/verification/arguments.test.mjs --max-warnings=0
```

All commands used the supported Node runtime via an explicit local PATH; no shell-default runtime
change was made. Focused run `c4da5774-466a-4b7c-9914-6d7b008ecc59` preceded final fixture/output
refinements. Final run `5e772023-f128-4506-8274-0692303f7118` records `apiTests: null`, `passed: true`,
`cleaned: true`, no interruption, and all seven passing gates. The final API suite took 22.61 seconds
in Vitest (22.99 seconds for its owner gate). Counts are not added to the earlier focused run.

The 28 added API regressions comprise 13 JSON-boundary unit cases, one additional request-logging
case, one OpenAPI budget/status case, 12 real PostgreSQL CSV HTTP cases, and one early attachment
metadata/logging case. Existing unexpected-endpoint-error logging assertions were strengthened.
The API selection argument regression increases resource tests from 41 to 42.

Fixtures exercise valid 150,000-byte CSV through preview and fully escaped apply, preserving exact
authored source and sequential work keys; valid 1,048,576-byte CSV (150 rows) with every JSON UTF-16
unit escaped; the exact 6,295,552-byte envelope and one byte over; multibyte raw CSV over its byte
limit; and an exactly 1 MiB raw CSV whose oversized field reaches domain validation then fails apply
atomically. Assertions check no work, activity, notifications, watchers, or counter increment after
rejections. Parser rejections precede actor lookup. Ordinary JSON exact/over and real chunked bodies,
unsupported encoding/charset input, fixed unmatched/error categories, real partial-body disconnect,
and existing exact/over 4 MiB upload boundaries all passed.

An authoring typecheck caught a missing required project status in the new fixture; it was corrected
before owned acceptance. Both owned runs passed without diagnostic reruns or changed deadlines.
Working PostgreSQL and attachment storage were never verification targets.

### Limits And Next Gates

This bounds the Express parsing boundary; it does not implement Lambda/API Gateway deployment,
distributed rate limiting, streaming CSV import, or a new binary compression/storage policy. Bodies
remain materialized within finite limits. Disconnected clients cannot receive a JSON error, and
malformed HTTP framing rejected before Express is not covered by middleware logging. Existing domain
response/CSV policies remain unchanged. Remote Linux CI and release-wide browser/UAT acceptance are
later gates. Phase 9 onward is not started; no commit, push, tag, or deployment was performed.

## Phase 9: Query And Risk Policy With Versioned Snapshots

Implementation covers the [field/round-trip policy](query-policy.md), complete shared live serializers,
key-based applied chips, explicit Apply, estimate SQL/count/page/CSV parity, scope-aware descriptions,
distinct within-category risk counts, explicit units and shared UTC boundaries. New report and closeout
producers write v2; independently frozen v1 parsers/types/Markdown preserve old accepted behavior.
Discriminated readers reject unsupported versions safely and validate stored record bindings.
New JSONB evidence does not require DDL; no migrations, dependency versions or release identity changed.

### Verification Scope

The changed contracts affect API and frontend consumers, so broad contract/Angular coverage and
production web budgets are applicable here. Backend diagnostics included the full API suite; final
corrections use affected API files, not another full application run. Browser selection covers query,
saved/pinned views, risk links, report sharing, hierarchy, closeout, portfolio and CSV. Standalone editor,
authored-content security, unrelated inbox/governance, compiled preview, external dependency audit and
public-site suites are not phase acceptance gates and were not rerun or claimed passed. Resource tests
include their existing small site-fixture check, not the full public-site browser suite.

All commands used Node 24.16.0/npm 11.13.0 via explicit PATH. Databases/storage/ports/profiles belonged
to private verification runs with Docker PostgreSQL 16; the working database/storage were never used.
The new `--mode=web` owns frontend lint, development typecheck/build, Karma and production build without
PostgreSQL/application servers. Final print-only CSS rechecks use an owned build-only invocation of the
existing manifest/workspace/process/cleanup helpers, avoiding another unchanged 707-case Angular run.

| Acceptance Evidence | Result |
| --- | --- |
| Contracts | 88 cases in 13 files passed, including 34 new field/UTC/unit cases |
| Final affected API | 151 cases in 14 files and 42 resource cases passed; API source/test lint/typechecks passed |
| Angular | 707 cases passed, including 55 new field-matrix/pending-query cases |
| Web profile | Four gates passed; no database provisioning |
| Production build | 388.66 kB initial / 104.82 kB estimated transfer; budgets warning-free |
| Browser affected workflows | Ten original workflows passed in diagnostic selection; four corrected flows then passed together |
| V1/v2 evidence browser | Publication/read/download/current-work links, v2 desktop and v1 mobile print-media/overflow checks passed |
| Verification source/E2E types and lint | Passed separately, including the new fixture import |
| OpenAPI | YAML parses; all 803 local references resolve; four list/export operations expose estimate/risk parameters |
| Documentation | 51 local targets resolve before closeout-note additions; whitespace clean |

The 14 final API files are `cycle-review-model`, `work-risk-sections`, `estimate-query-snapshots`,
`project-cycle-closeout`, `status-reports`, `planning`, `saved-work-views`, `versioned-snapshots`, `openapi`,
`query-parity`, `work-item-query`, `work-item-query-builder`, `delivery-health-service`, and
`status-report-markdown-renderer`. Final run `1b352094-e915-482a-96cf-9650a346d089` passed all seven gates
and cleaned resources. The eight real estimate/preservation cases cover zero/null, terminal work,
ANDed label/parent/cycle predicates, opposite-side UTC sessions, shared/personal pins, overlapping
risks, v2 production/replay after edits, valid v1 publication and unchanged v1 JSONB across migrations.

Web run `56577a7f-aaa8-4755-bd09-2e344305a3aa` passed all four gates and cleaned resources. Earlier clean
web run `34bb7893-d355-43b9-8efb-3dced2e2b0ba` had the same 707 cases and initial size. Build-only run
`dc19c2e3-1c44-4c6f-a8cb-7f3de2752bb7` rechecked final print CSS without Angular/PostgreSQL, passed and
removed its private root; its generated summary records `mode: web-build-only` (not a new CLI mode).

Browser run `b121b518-c18e-4b1b-908d-6e7837fad2aa` passed all four selected flows: estimate pending/Apply,
saved pin/copy/return/reload/mobile, pagination/navigation, seeded report sharing, and CSV import/export
(the estimate sequence is one test). Desktop 1280px and mobile 390px screenshots were inspected and
overflow/control-fit assertions passed. Fixture projects are archived in afterEach so workspace totals
do not depend on previous tests. Evidence run `cb249c27-dbe9-4f30-8826-661a2edc4a19` passed the combined
v2 and actual v1 client workflow, not just newly seeded v2 evidence. Print screenshot review then found
a historical no-wrap link problem; print URLs now wrap and explicit print overflow checks were added.

### Diagnostic Runs And Corrections

Diagnostics are not clean acceptance and counts are not summed across reruns:

- `7c8da17c-67f9-42ca-9a42-cec2f569f768`: 76/81 API cases; expected new version still 1 and unsupported
  version still 2. Updated assertions to new 2 / unsupported 3. New real estimate cases already passed.
- `38a6bb41-bf3b-407e-84c2-764bc2fa69fd`: 70/71; old unestimated-link expectation omitted estimateState.
- `b8326a7c-dd64-4735-8ee9-0226b8eb4020` and `e6ebbd1e-1b9e-416c-9bd3-e4ece76dc84b`: 689/707 then
  705/707 Angular; corrected old dropped-field, automatic-apply, default-null and broader-link expectations.
- `2be5650f-5658-4fc9-b4c7-1e301a1a5761`: full API 860/862; one stale-risk expectation and one saved-view
  HTTP socket reset. No response established its cause; no transport retry or timeout relaxation added.
- `0c7f9313-36f2-455e-b4ed-3e7cc818edf7`: typecheck caught missing titles in a new unit fixture.
- `56aba0b8-c161-415c-96da-8a3e7ea94499`: full API 863/864; new unit helper ignored its estimate override.
  Corrected helper, then 2/2 passed in `3a6318bc-055e-41da-93ec-1986046f412b`. The final 151-case affected
  run also passes those regressions. Neither failed full run is represented as a clean 864-case run.
- `84cf07bf-964c-4fff-8d15-244c5c3e8f05`: browser collection caught a runtime import of unbuilt contracts;
  the test now imports the pure source helper and retains type-only package imports.
- `4e6a6a9a-16c2-4e92-abf6-47a9248f68ca`: 10/15 browser; exact label ambiguity, duplicate report heading,
  new reason-link mobile overflow and one missed CSV Apply interaction. Fixed selectors/expectations,
  wrapping and explicit Apply; no force clicks or assertion weakening.
- `ca947a86-3860-4ba0-b23a-d4071b946bec`: 1/3; return URL was read before router commit and new fixture
  projects contaminated workspace totals. Wait for the actual detail URL/heading and archive fixtures.
- `fb43043d-d421-44af-8bc7-a7eb0a1a4cba`: legacy test expected plural for a one-item golden fixture;
  fixed singular assertion. Typecheck also required widening the golden value to its declared v1 DTO.
- `e6d6ba5d-f789-4d06-b0ec-93c21b84b533`: one query URL assertion expired during a concurrent production
  build before the new print checks; the failure screenshot showed the correct filtered work list.
  Repeated serially with unchanged deadlines/retries/workers, rather than claiming a proven root cause.

Every completed diagnostic summary records `cleaned: true`. Direct authoring units caught stale link
expectations and type/fixture mistakes before acceptance. Successful v1 Markdown is compared byte for
byte against a committed fixture captured from the pre-phase renderer/serializer; v1 unknown stripping,
optional parent/cycle and strict closeout behavior remain explicitly tested.

### Limits

Print checks emulate Chromium print media and inspect screenshots; they are not physical printer or
paginated PDF certification. Links always open current data, not a reconstructed historical work set.
No clock freezing, automatic retries, deadline/budget increases, version bump, commit or deployment was
introduced. Aggregate hydration and reactive route/actor ownership remain Phases 10 and 11. Remote
Linux CI and release-wide manual/full acceptance remain later gates.

### Final Closure

Serial browser run `7e0f17db-3f94-4690-910b-183de9aef93b` passed the final combined v2/v1 workflow with
the added print-overflow assertions. Final mobile v1 print and desktop v2 print screenshots were
inspected: appended URLs wrap within the page, with historical values and legacy wording retained.
The browser run cleaned its resources. Final typechecking passed after the renderer's item parameter
was changed to the frozen snapshot type (type-only, no runtime change).

All 20 completed run summaries record `cleaned: true`; final Docker/process inspection found no
verification-labeled containers or owned verification processes. Build-only output remains in its
ignored result summary; private source/build/storage roots were removed. Working data were untouched.
Local documentation links and whitespace were rechecked after status/evidence updates. Phase 9 is
complete; Phase 10 and release-wide verification are not started. No commit/push/tag/deployment occurred.

## Phase 10: Narrow Aggregate Reads And Preview Selection

Completed October 17, 2026. [Aggregate evidence](aggregate-evidence.md) records the fixture, baseline/
current HTTP SQL counts, bytes, narrow/enriched rows, first/repeat timing and remaining scaling costs.
No migration, dependency/version change, snapshot rewrite or deployment was introduced.

### Implementation And Acceptance

Evaluation facts omit authored work source/format; pure health/cycle/risk policies no longer require
full domain rows. My Work captures one clock, computes exact relevance/counts, selects six eight-row
previews and hydrates their distinct union once. Planning reuses work/time/dependency context for cycle
summaries rather than full reviews. Risk/movement selection precedes member/milestone/parent reads.
Planning's five-row arrays no longer determine category totals; exact health counts drive metrics,
risk signals and continuation. Portfolio batches metadata, omits report narratives, parses only selected
latest evidence and uses publishedAt/createdAt/ID ties. Ownership/historical reference policies remain.

| Check | Result |
| --- | --- |
| Final owned API | 239 cases in 20 affected files; all seven gates passed |
| Resource checks | 42 passed; runner internals unchanged |
| API source/test lint and typechecking | Passed in final owned run |
| Focused Angular | 12 Planning cases passed, including exact 12-count/five-row/seven-more rendering |
| Frontend lint | Changed Planning component/spec passed |
| Production web build | Warning-free; 388.66 kB initial / 104.83 kB estimated transfer; budgets unchanged |
| Complete HTTP statements | My Work 51 to 13; Portfolio 53 to 9; Planning 38 to 11; milestone 10 to 9; cycle 11 to 9 |
| One versus 15 projects | Same SQL counts; Portfolio one query per metadata category |
| Working PostgreSQL/storage | Never verification targets |
| Omitted suites | Unchanged full Angular, browser/editor/site, dependency audits and release-wide full verification |

Final API run `dd4ba41f-4dc0-408d-848f-b02ba67a6851` used:

```sh
npm run verify -- --mode=api --api-tests=aggregate-performance,aggregate-reads,my-work,portfolio,planning,milestones,project-cycles,project-cycle-service,project-cycle-closeout,status-reports,delivery-health-service,work-risk-sections,cycle-review-model,work-item-query-builder,work-item-relationships,work-items,work-item-csv-export,work-item-hydration-consistency,estimate-query-snapshots,openapi
```

The shared dependency SQL changed, so coverage includes its list/CSV/hydration/relationship/snapshot
consumers, not only aggregate tests. The test gate took 20.02 seconds, not a timing acceptance threshold.
Ten new aggregate-read regressions include complete-query My Work oracles, exact counts/scope, five
external-commit repeatable-read cases with throwing root repositories, cross-project/terminal flags,
latest report tie/older-malformed/binding cases, a complete 60-row board and complete 20-item closeout/
replay. Two performance cases assert SQL/row/ownership bounds on one/15-project complete HTTP paths.

Focused Angular/build run `aee22776-f69f-4c24-92b6-19a7f8994537` used the existing owned manifest/private
workspace/port/process/cleanup/Karma helpers and CLI
`--include=src/app/features/projects/project-planning-page.component.spec.ts`. It avoids 695 unchanged
Angular cases, requires no PostgreSQL/application server and is not a new runner CLI mode. Production
build separately verifies current templates, lazy graph and existing size/style budgets.

### Diagnostics

Baseline `16a11656-3ffc-4387-897d-817e3a03494b` passed the original complete HTTP measurement in an owned
checkout with archived pre-phase service sources. Working files were never reverted. Its timing/bytes
are in aggregate-evidence.md; it is measurement, not current-code acceptance.

- `e8cdb6ce-c185-4e24-8802-186dbdcca079` and `a4967b81-7960-4bbd-82dd-3dfaa1636ecd` stopped at typecheck:
  fixture options/type/required-summary mistakes were corrected before collecting the baseline.
- `3abf41c6-cdeb-4f61-8845-ec83d9c09c71` rejected a nonexistent milestone-review test basename before
  provisioning; that coverage lives in planning.test.ts.
- `b359ef28-2465-48ad-91d9-d78c1b9e1870` passed 17/27 API cases. Single-table SELECT stripped SQL column
  qualification inside dependency expressions, exposing ambiguous `id` correlation. Explicit identifiers
  now preserve the same predicate in SELECT and WHERE, with a real membership regression for both scopes.
- `a2281693-7c0a-4a84-ae60-606d721fc5dc` passed 52 API/42 resource cases. Later coverage is included in,
  not added to, the final 239-case count.
- `571594df-dbdc-439a-b75b-d0d0302c9e02` passed 11/12 Angular cases. The old fixture populated risk arrays
  but left exact health counts zero; it now supplies coherent counts and expects Risk signals.

Direct authoring typechecks caught an obsolete helper type and incorrect board method name. No test
retry, timeout increase, worker reduction, forced click or assertion weakening was used. Commands used
supported Node 24.16.0/npm 11.13.0 via explicit PATH. Exact scans, membership SQL per row, in-memory
sorting and complete comparison rows still scale with data. Local timings vary with concurrent test
work and do not prove general latency improvement. Remote CI/browser/UAT/full acceptance remain later
gates; no remote result is claimed.

### Closure

All nine run summaries record `cleaned: true`; private roots, processes, Chromium/Karma and labeled
verification containers were removed. Documentation links/YAML references/whitespace were checked after
status updates. Phase 10 is complete; Phase 11 is not started. No commit/push/tag/version bump/deployment
was performed, and working data were untouched.

## Phase 11: Reactive Route And Actor Context

Completed October 17, 2026 with supported Node 24.16.0/npm 11.13.0 via explicit PATH. Package identity
remains 0.2.9. [Context evidence](reactive-context-evidence.md) describes ownership, production adoption,
router reuse, preserved behavior and the Phase 12 departure-protection boundary.

### Acceptance And Impact Selection

| Check | Result |
| --- | --- |
| Broad Angular/context acceptance | 729/729 passed in owned run `93a07427-618c-4147-abac-e64f410274fb` |
| Frontend lint and development template/typecheck | Passed in that run |
| Final shared query deduplication | 286/286 affected Angular cases plus lint/production build/graph passed in `34ea745f-ef42-42f0-b351-961f89c6a93c` |
| Last pagination-reset race refinement | 113/113 context/project-list/workspace-list cases passed in `76824250-b8c2-488f-bcf9-fef796c8ec58` |
| Production build | Warning-free; initial 390.62 kB / estimated transfer 107.60 kB; budgets unchanged |
| Initial static import graph | 151 inputs; no heavy detail/Planning/report/creation/Markdown/CodeMirror/Lezer inputs; 20 lazy page entry points |
| Selected Playwright | 5/5 passed, one worker, zero retries; run `024bb504-9548-49cf-a2e8-ab5739fc04a1` |
| Whitespace/local documentation links | Passed after final documentation updates |
| Omitted as not applicable | API/domain/contract/resource suites, dependency audit, editor/site-only and release-wide full verification |

Counts overlap and must not be added. Shared route/current-user ownership affects many frontend
consumers, so a broad Angular run was justified here. The final query-only change then reran affected
page owners, not the unchanged application-wide suite. The last two-list pagination refinement used
the context and both work-list specs only. The earlier production graph/build remains valid evidence
for unchanged initial imports/budgets; the last refinement changes lazy list logic, and its Angular
compilation/tests passed. No claim is made that the entire final tree received release-wide verification.

The owned frontend acceptance commands used existing manifest/private-checkout/port/process/Karma/
cleanup helpers, with no database or application server:

```sh
npm run lint --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run ng --workspace @worktrail/web -- test --watch=false --karma-config <owned-checkout>/scripts/verification/karma.config.cjs
npm run build --workspace @worktrail/web -- --stats-json
```

The esbuild stats check traversed non-dynamic imports from `src/main.ts`, rejected heavy feature/editor
inputs in that graph, and counted lazy page entry points. Sanitized build/graph/gate summaries are in
the corresponding ignored `test-results/verification/<runId>/summary.json` files.

The 286-case run added these CLI selections:

```text
--include=src/app/core/navigation/page-context.spec.ts
--include=src/app/features/projects/**/*.spec.ts
--include=src/app/features/work-items/*spec.ts
```

The final 113-case selection used the context spec plus `work-items-page.component.spec.ts` and
`workspace-work-item-list-page.component.spec.ts`. Focused helper runs clean their private roots and
print counts/run IDs; unlike the standard runner, they do not create a machine-readable gate summary.

Browser command:

```sh
npm run verify -- --mode=e2e '--grep=authors descriptions across creation paths|downloads seeded files exactly|opens and saves v0.1.4 project saved views|reviews v0.2.1 cycle planning|publishes and reads v0.1.8 project status reports'
```

It provisioned PostgreSQL 16, migrated/seeded owned data/storage, started owned API/Angular servers,
and passed creation/description/detail reuse, attachment reuse, owner/contributor saved views, cycle
Planning and report publication/read flows. Browser execution took 46.9 seconds, not a latency promise.

### Diagnostics

- `4089ed61-8ac0-4d45-898c-66c2845e21e0` stopped at lint for an obsolete RxJS import, then cleaned up.
- `54cb95d2-23e6-47f6-b48a-b0931e2fb32c` passed lint/typecheck but 23 of 708 Angular cases failed:
  minimal route doubles lacked snapshots and some old tests attempted to flush now-cancelled reads.
  Initial observable state supports those doubles; obsolete reads now assert cancellation, while late
  submitted-write success/error tests continue delivering responses and checking guarded effects.
- `c92b7141-1e11-41ad-9e98-a6d5cd8e1bef` stopped at test compilation for three union-type Jasmine
  identity assertions. They were corrected without relaxing behavior assertions.
- `8e18ce77-2428-47a3-911d-a55609c730bf` passed 274/278 cases and exposed pagination reset and
  parent-only child-form preservation regressions. Both established behaviors were restored.
- `e26e0fb1-a635-4244-b4c3-279315706405` passed all 278 affected cases; `f8bb4e40-47d6-4bc2-b20b-7017214d8308`
  then passed 24 focused context/report cases. Their coverage is included in later acceptance.
- First browser attempt `daa86b43-15b1-43af-b68e-66a9508d184e` stopped at provisioning with
  `Disposable PostgreSQL has no owned loopback port`, before any browser test. Its summary records
  `cleaned: true`. A separate owned provisioning diagnostic succeeded and removed its resources;
  the subsequent five-flow browser run passed without runner/deadline/retry changes. The exact cause
  of the first missing Docker port is not established.

### Closure And Limits

Owned private checkouts/builds, Karma/Chromium profiles/processes, API/Angular servers, PostgreSQL
containers and attachment roots were removed. Working PostgreSQL on 5432 and ordinary attachment
storage were not verification targets. No timeout/retry/worker/budget increase, dependency/version
change, commit/push/tag/publication or deployment was performed.

Real-router owner tests override presentation to isolate identity/lifetime behavior; existing page
tests and the five browser flows cover actual templates. Remote CI, complete browser/UAT and release
acceptance are not claimed. Navigation cancellation/error preserves drafts, but prompting before an
accepted departure and blocking pending writes remain Phase 12. Phase 11 is complete.

## Phase 12: Draft Departure Protection

Completed October 17, 2026 with Node 24.16.0/npm 11.13.0 selected by explicit PATH. The
[draft departure evidence](draft-departure-evidence.md) records registrations, normalization, router
and local decisions, pending writes, lazy UI, native-warning limits and production adoption.

### Final Acceptance

| Check | Result |
| --- | --- |
| Affected Angular | 263/263 passed in owned run `f08feec3-a7b7-4cbf-9ac4-19782a74b7b5` |
| Frontend source lint and development template/type checking | Passed in that run |
| Production build | Warning-free; initial 397.79 kB / estimated transfer 109.94 kB; budgets unchanged |
| Static initial import graph | 155 inputs; zero CDK/dialog/heavy detail/Planning/report/creation/Markdown/editor inputs; 20 lazy page entries |
| New departure browser flows | 3/3 passed together in `8422b87c-b166-4d3f-8a18-cfd42b4c308b`; 24.5 seconds, not a latency acceptance threshold |
| Additional browser regressions | Four description/comment/Quick Find workflows passed in the earlier seven-flow run; unchanged evidence reused |
| Verification TypeScript | `tsc --noEmit -p tsconfig.verification.json` passed |
| Changed browser test lint | Passed for draft-departure, authored-description and authored-comments specs |
| Visual inspection | 1280px/320px Stay/Discard screenshots inspected; text/actions fit, no horizontal overflow |
| Documentation links / whitespace | Checked after completion updates |
| Not applicable / omitted | Unchanged API/domain/contract/resource/editor-only/site suites; full Angular/application browser and release-wide verification; remote CI/UAT |

The final owned frontend run used existing manifest/private-checkout/port/process/Karma/cleanup helpers,
with no database or application server. It ran source lint, development build/typecheck, affected
Angular cases, and a production `--stats-json` build. Selection was:

```text
--include=src/app/core/navigation/*.spec.ts
--include=src/app/features/work-items/*spec.ts
--include=src/app/features/projects/status-reports/project-status-report-draft-page.component.spec.ts
--include=src/app/features/quick-find/*spec.ts
--include=src/app/app*.spec.ts
```

This covers route/context consumers, actor shell, all three authoring owners and Quick Find rather
than repeating unrelated Angular features. The initial graph check traversed non-dynamic imports
from `src/main.ts` and explicitly rejected CDK and `open-draft-departure-dialog` alongside heavy
feature/editor inputs. Gate/graph summaries are retained in ignored
`test-results/verification/<runId>/summary.json`.

Final browser command:

```sh
npm run verify -- --mode=e2e '--grep=draft departure'
```

It provisioned/migrated/seeded owned PostgreSQL 16/storage and started owned API/Angular servers. The
three flows verify independent detail/comment/recipient drafts; default Stay/Escape; reused dependency
routes; actor selector/storage/focus; native close-warning dismissal; nested Quick Find query/focus/
navigation; repeated project-selection Stay; accepted project reset; pending create rejection and
failed-create retention; report Stay/failure and prompt-free successful publication. Native close is
invoked with Playwright's explicit `runBeforeUnload: true`; it verifies the browser warning and retained
page/source on dismissal, not crash/mobile recovery or reliable automated CDP reload cancellation.

The earlier browser command also selected description creation/reuse, both authored-comment workflows
and the Quick Find launcher/keyboard flow. Their assertions were updated where intentional discard now
needs the production confirmation. Those four workflows passed and were not rerun for later unrelated
native-close harness/status-selector refinements. Their coverage overlaps, rather than adding counts
to the final three-flow run.

### Diagnostics And Refinements

- `9ec68e63-48c0-48a6-a3a9-1ab1307d9349` passed the initial 246 affected cases before the new
  coordinator regressions were added.
- `f30ed110-767f-466c-b170-3a2a3f37f905` exposed a standalone-router history-listener omission. Its
  synthetic global beforeunload dispatch also triggered Karma's independent reload detector and a
  disconnect. The test now invokes only the captured application listener; real browser behavior is
  covered separately. No browser/test deadline was increased.
- `fcc8e2a3-6418-4b26-93e7-848f47d248da` passed 9/10 coordinator cases, timing out on history because
  the standalone harness had not installed the router location listener. Calling the installed public
  setup method and awaiting real cancellation fixed it. `6b7665c3-372b-4964-88c9-3ab7cc2de9af` passed 10/10.
- First browser run `80da78cb-b436-42ac-ab07-b68c7f2488ba` passed five/seven cases. It caught actor
  select focus restoration for programmatic select events and an ambiguous status locator that also
  matched the source-length output. Actor rejection now explicitly refocuses the selector; the busy
  status has a stable accessible name. Both behavior and selection assertions remain.
- `c2505320-4750-486a-ac7a-f22694de0266` passed creation/report flows but the combined native-reload
  test reached its existing 90-second deadline after dismissing a beforeunload warning. The test now
  uses explicit supported close/unload semantics with a five-second event bound, rather than extending
  reload/test deadlines or claiming unsupported recovery. `986dea79-e635-47ab-89cb-230b364cdb6a` passed
  that combined native-close/actor/Quick Find/reuse flow before the final three-flow run.
- `29e6e151-fe1e-4b77-aeda-6a711d2c64e4` passed 260 affected cases/lint/typecheck/build. The follow-up
  build `e5007455-10d5-4997-bf7a-ef00f760e1ff` explicitly checked zero CDK/dialog inputs in the initial
  graph. Both are superseded by final frontend acceptance, not additional coverage counts.
- `9a51e449-1187-432a-befd-81757922f3ec` passed 62 creation/list cases for guarded Create another;
  `478823d4-6126-4a95-bbf6-b9adeb6b36b3` passed 63 after a native numeric-control null regression was
  added. Clearing Estimate safely yields null; unsafe integer text is not treated as a blank baseline.
  Both refinements are included in final acceptance.
- Final review added post-approval revalidation and a real asynchronous-later-guard regression using
  Angular 20.3.33's installed public `Navigation.abort()` API. The final 263-case run includes it,
  without a navigation cancel/replay loop or an increase to deadlines/retries/workers/budgets.

### Closure

All owned private checkouts/builds, Karma/Chromium profiles/processes, API/Angular servers, PostgreSQL
containers and attachment roots were removed. Persisted run summaries record cleanup; focused helper
runs print counts/run IDs and clean their roots without creating separate gate summaries. Working
PostgreSQL on 5432 and ordinary attachment storage were not verification targets.

No dependency/version change, authored-data migration, draft storage, commit/push/tag/publication or
deployment was performed. Native warnings cannot guarantee mobile shutdown/crash protection, and a
discarded UI subscription does not cancel a submitted server transaction. Phase 12 is complete;
Phase 13 and release-wide verification remain separate work.

## Phase 13: Read-First Detail

Completed October 17, 2026. This is a frontend composition/correction phase: backend/domain/contracts,
database schema, storage implementation, dependencies and package versions are unchanged. Verification
targets affected production owners and browser journeys rather than repeating all Angular/API suites.

### Acceptance

| Check | Result |
| --- | --- |
| Affected Angular acceptance | 164/164 passed in `df8747e6-dd9d-4e50-bb7b-1126db22c147` |
| Final copy-only refinement | 106/106 affected detail cases passed in `756a02a1-2e8c-4bf4-85cf-55cde639dbb6`, including its new regression; counts overlap |
| Frontend source lint / production template and type compilation | Passed in that run |
| Development template/type builds | Passed in earlier focused runs; not repeated after the final guarded close callback/test additions because test and production builds compile those owners |
| Production budgets | Warning-free; unchanged thresholds; initial 397.79 kB / estimated transfer 109.95 kB |
| Initial graph | 155 inputs; no CDK/dialog/heavy detail/Planning/report/creation/Markdown/editor inputs; 20 lazy page entries |
| Targeted application browser coverage | All 15 distinct selected flows passed across overlapping runs listed below; not a single full-suite result |
| Compiled production preview | 1/1 passed in `7052e140-a3db-4dbd-9879-3bbeb586286c` |
| Changed browser test lint and verification TypeScript | Passed |
| Visual inspection | Populated read-first 1440/390/320px; expanded children 1440/320px; narrow description editing/preview and compiled preview inspected; no page overflow beyond the existing one-pixel assertion |
| Documentation links / whitespace / cleanup | 83 local links across six changed Markdown documents checked; whitespace and owned cleanup checked |
| Omitted | Unchanged API/domain/contract/resource/editor-only/site suites, full application suites, remote CI and user UAT; release-wide gates remain Phase 21 |

The final no-database frontend harness used existing manifest/private-checkout/process/Karma/port/
cleanup helpers. It ran source lint, selected Angular tests, production `--stats-json` build and the
same static non-dynamic import traversal used in Phase 12. The final selection was:

```text
--include=src/app/core/navigation/*.spec.ts
--include=src/app/features/work-items/work-item-detail-page.component.spec.ts
--include=src/app/features/work-items/components/work-item-parent-components.spec.ts
--include=src/app/features/work-items/components/work-item-child-work.component.spec.ts
--include=src/app/features/work-items/components/work-item-attachments.component.spec.ts
```

These exercise the extracted production owners through the real composed page, including zero/null,
invalid/fractional/overflow estimates, leap/calendar dates, incomplete native controls, failure/no-op
payloads, source baselines, archived/contributor rules, independent comment/mention drafts, preserved
attachment instance, concurrent field/comment/status responses, scoped cancellation and stale close
focus after route reuse/destruction. API interaction assertions use the existing HTTP contract.

### Browser Runs And Diagnostics

Owned application browser checks used `npm run verify -- --mode=e2e '--grep=...'`, one worker and zero
retries. The initial selection was:

```text
read-first|authors descriptions|authors, previews|retains comment source|
draft departure protects independent|downloads seeded files|handles upload retry|
opens exact work items|work breakdown workflow|dependency workflow|
inbox mention workflow|keeps seeded legacy
```

Later targeted reruns selected only failed/refined flows plus `pages project and workspace work` and
`planning and adoption workflow` for additional affected consumers. Passing coverage is reused where
the later edits do not affect it. Counts overlap and are not summed as new coverage:

- `fde136ae-7d4a-4ab0-beaa-393460d76324`: 5/13 passed. It found a real 10px narrow watch-layout
  overflow and old assertions that expected now-disclosed history/children. Downloads/reuse, draft
  departure/actor/native unload, Quick Find Files targets, hierarchy continuation and dependencies passed.
- `09e16e02-71bc-4ce1-9eb7-7269f369f953`: 6/8 passed after correcting responsive wrapping and explicit
  disclosure setup. Both comment flows, archived legacy content, descriptions, mentions and hierarchy
  management passed. Remaining failures identified history closing on actor replacement and native
  fragment links resolving against the app's base URL. Links now use the router with preserved query
  and explicit local scroll/focus; actor-replacement tests reopen history before inspecting it.
- `b63edf8a-40b4-47d8-ac64-933b2b25a951`: 3/4 passed: attachment retry/removal/archive, the new real-API
  planning/no-op/draft-preservation journey and pagination continuation. The adoption flow still used
  the removed Metadata panel; it now reads milestone/label facts from the read summary and discloses history.
- `acc8b516-4779-4435-901a-74854d5b4992`: 3/3 passed together: both new read-first/planning/hierarchy
  journeys and the corrected adoption flow. Its read-first/child screenshots include final spacing and
  the guarded Cancel focus callback. No authored draft is discarded without the production decision.
- `npm run verify -- --mode=preview`: `7052e140-a3db-4dbd-9879-3bbeb586286c` passed compiled deep-link
  reload, read/source/preview behavior, explicit draft discard, archived disabled authoring, static
  assets and API 404 behavior. It also built API/contracts for the existing preview composition;
  this is not an API unit-suite result.

Initial frontend diagnostics `5f761419-e3d0-4bf5-ba72-a1a7c7aa402f` and
`81544b18-5c44-4167-8dc1-b86d583105f4` stopped at unused-import/declaration lint errors during extraction.
`74e5a71a-e3de-4473-93fc-90f096b0e079` ran 143 cases with seven old-layout/contract assertion failures;
`e1651024-7411-47a5-854d-23fb23b5bdc0` ran 161 with one remaining back-link locator failure after the
named project link was added. Those assertions now target the actual read-first controls and unchanged
navigation behavior. `14e1371c-c529-4166-917c-f79c9739f533` and
`2c8411f7-b7f3-4d89-a7d7-0a1dd91d6e1c` passed 162 cases/builds before the final two stale-close regressions;
the 164-case acceptance supersedes them.

Final screenshot inspection caught a stray `state.` prefix in two watcher loading/empty literals.
The copy-only correction and new regression passed the 106-case detail file plus lint in
`756a02a1-2e8c-4bf4-85cf-55cde639dbb6`. A structured Angular-template parse checked all six composed
templates for remaining implementation-name text and found none. This final copy edit changes no
bindings, imports, styles or routing, so unrelated tests/build/browser checks were not repeated. These
106 overlap the 164-case run; together they cover 165 distinct affected Angular cases, not 270.

`e556e14c-58fd-4b77-92c2-2385c9f73bc0` failed Docker loopback-port discovery before app/browser startup.
An isolated owned provisioning diagnostic `ff62cb75-3b0d-43e4-b3da-9ad47b0d65cd` immediately obtained an
owned loopback port and passed; subsequent application/preview provisioning passed unchanged. A separate
read-only browser probe overlapped an owned test reset and timed out; it closed its browser in `finally`
and is excluded from acceptance. No Docker/test readiness deadline, retry, worker or budget was increased.

### Closure

Owned private checkouts, builds, Karma/browser processes/profiles, API/Angular/preview servers,
PostgreSQL containers and attachment roots were removed. Ignored run summaries and screenshots remain
under `test-results/verification`. Working PostgreSQL on 5432, ordinary storage and unrelated processes
were not verification targets. No dependency/version change, migration, commit/push/tag/publication or
deployment was performed. Phase 13 is complete; bounded returns/incoming section targeting remain
Phase 14, and release-wide verification remains Phase 21.

## Phase 14: Bounded Returns And Section Targeting

Executed October 17, 2026 with Node 24.16.0/npm 11.13.0, explicit PATH, existing Chromium and
owned disposable PostgreSQL 16/storage/checkouts. No working database on 5432 or ordinary attachment
root was used. The implementation/adoption map is in
[bounded navigation evidence](bounded-navigation-evidence.md).

### Impact And Frontend Acceptance

This phase changes frontend navigation policy, links and section focus. No backend, schema, shared
DTO, editor engine, public site, dependency or toolchain source changed. Full API/contracts/editor/
site suites and release-wide verification were omitted rather than reported passed. Existing API
builds/migrations/seeding in browser provisioning are prerequisites, not backend regression suites.

The owned frontend command used `createManifest('none')`, `prepareWorkspace`, `runCommand`, the
owned random-port Karma config and `cleanupRun`, following the established phase acceptance pattern:

```sh
npm run lint --workspace @worktrail/web
npm run ng --workspace @worktrail/web -- test --watch=false --karma-config <owned-checkout>/scripts/verification/karma.config.cjs --include=<affected-specs>
npm run build --workspace @worktrail/web -- --stats-json
```

`cf237a91-9c65-4206-a78e-d948b9ac819e` passed 354 affected Angular cases, frontend lint, production
compilation and static initial-graph checks. Selection covered core navigation, shared navigation,
Quick Find, Inbox, work-list/board/create integration, detail, parent/child/Files, My Work,
project shell, Planning/cycle/milestone review, closeout and report detail. Production initial size
was 397.81 kB (109.93 kB estimated transfer), 155 initial inputs and 20 lazy page entries. No CDK,
draft dialog, detail/Planning/editor/Markdown input entered the initial graph; no budget warning.

After final stale-Files focus hardening and additional query/dependency regressions,
`deaa10e9-b8a7-4906-bf82-b2e48e3f9821` passed 153 cases/lint across Quick Find search, detail,
PageContext and result-list specs. These overlap the earlier run and are not added as distinct cases.
This includes same-URL Files after dialog close, no stale Files node on changed-record navigation,
all dependency groups, duplicate committed query values and comment/section targeting. Final frontend
lint, touched browser-test ESLint, `tsc -p tsconfig.verification.json --noEmit` and `git diff --check`
also passed. Subsequent production-source edits only removed whitespace; unchanged acceptance is reused.

### Browser Journeys And Preview

Application runs used `npm run verify -- --mode=e2e --grep=<selected-title-pattern>` with one worker,
zero retries and unchanged deadlines. All nine distinct selected journeys completed successfully
across the following runs; this is not a claim that the diagnostic multi-test runs passed wholesale.

- `00901cec-bcc1-4af9-b7ea-2644c0e971ac`: Quick Find exact/repeated Files and the complete Work Breakdown
  journey passed. The other six cases failed against the intermediate tree, as detailed below.
- `b19dcd66-ee93-4fc4-825f-8136beb4b7e5`: completed passing attachment downloads/route reuse, authored
  creation/description reuse, notification/comment fallback/history, independent draft/Quick Find
  Stay/Discard and repeated Files cases. It was later interrupted and is not a clean overall run;
  these five case completions were observed in runner output, not a completed JSON browser report.
- `1f1b6b30-b020-4b05-82fd-a07ba8095421`: clean single-journey pass for filtered workspace page 3,
  parent -> child -> reload -> parent -> original query/page, cross-project dependency -> parent
  Dependencies focus, child creation/success -> parent with retained origin/fragment.
- `a68bbd4c-ef38-4a47-8852-81104a92c4bd`: clean cycle-closeout/snapshot inspection -> cycle-result
  heading return/focus pass, with explicit History disclosure for current activity.
- `5f78e6fb-5835-48d7-8d40-25e8570e2238`: clean project/workspace paging, return context, query reset,
  copy/export, visible-page bulk scope, responsive results and complete board-move pass.

The notification journey proves loaded comment focus after commit/reload, Stay retaining its source
editor, deleted/missing comment fallback without authored viewer/source, back/forward History focus,
disclosure opening, reduced motion, 1280px/320px viewport containment and a rejected detail load clearing
record targets. The 403 is intentionally intercepted frontend-denial coverage, not a new API authorization
test. Screenshot inspection of both widths found no horizontal overflow or overlapping target text.

`npm run verify -- --mode=preview` passed in `7c6da57f-688f-4024-800a-eb72ac2f993d`: production
contracts/API/web build, one compiled-assets/deep-link journey, History focus/reload, return to
Planning `view=cycles#cycles-heading` with heading focus, archived read-only detail, board and API 404.
No page error, Vite client or budget warning. Its unchanged build/target evidence is reused after the
final narrowly tested Quick Find closed-dialog subscription change; no route/template/style changed
in that follow-up. Preview screenshots also covered 1440/1024/640/390/320px.

### Diagnostic Failures And Focused Reruns

- Early development compilation found nullable fragments incompatible with RouterLink's input type;
  bindings now supply `undefined`. Initial lint found a control-character regex and directive input
  naming; explicit character checks and conventional input names resolved them.
- `ebb756d7-6994-4d44-8a8d-998364577d3c` failed that intermediate lint snapshot.
  `9cce72df-4da3-4cef-a5db-6aed14730b40` ran 338 cases with 12 old URL/selector expectations failing.
  `67b46cce-d44f-4646-bc18-6b8f7f0bfcdb` ran 344 with four remaining assertion issues: import links
  intentionally remain bare, child Add uses `returnTo`, and Quick Find's project fallback is explicit.
  `5e5341e8-026a-49d5-8865-c0e34317faf9` then passed 344/lint/build/graph before the added regressions.
- Browser run `00901cec...` found two dependency variants still emitting bare links; all three groups
  now adopt the builder and have direct regression coverage. Other failures were intermediate link
  selectors, the denial test expecting API text instead of the existing safe load-error copy, and a
  pre-read-first Metadata locator. Those were corrected without weakening destination assertions.
- `aef40f1a-c995-40d2-ab43-45d0e485293a` ran 153 cases with one new dependency test lacking linked
  fixtures. It now supplies relationships in all groups; the final 153-case run passed.
- `b19dcd66...` encountered a new create test trying to use the child command inside a collapsed
  Children disclosure, a summary locator matching both labelled wrapper and region, and paging's old
  exact `Back` label. Tests now open the actual disclosure, use the named region and expect the
  descriptive return label. The owned diagnostic run received SIGINT after those stale waits were
  identified; its summary records interruption and successful cleanup. Only affected journeys were rerun.
- `0f7dfce1-0bb3-403f-b99b-f225c42f2b9b` failed a five-second workspace-heading visibility assertion
  during overlapping verification activity. Structured trace inspection showed the correct 26-row
  API total and rendered heading. An isolated unchanged rerun (`5f78e6fb...`) passed all paging checks.
  No data assertion, readiness deadline, retry, worker or budget was increased to make it pass.

### Closure

Owned roots, private builds/checkouts, Karma/browser profiles/processes, API/Angular/preview servers,
PostgreSQL containers and attachment storage were removed, including interrupted/failed runs. Ignored
summaries/screenshots remain under `test-results/verification`. No dependency/version change, schema
change, commit/push/tag/publication or deployment was performed. Phase 14 is complete; Phase 15 and
release-wide verification remain separate work. Documentation-only closure reuses the checks above.
Final read-only cleanup inspection confirmed all 14 owned run summaries marked cleaned, their roots
absent, and no matching owned Docker container or process remaining. Structured Markdown parsing
validated 90 local links/anchors across the six current documents; `git diff --check` passed.

## Phase 15: Shared Saved Views And Work Lists

Completed October 17, 2026. [Shared work-list evidence](shared-work-list-evidence.md) identifies actual
production adoption and behavior. This is not a release or deployment claim.

### Impact And Commands

Changed production code is confined to frontend project/workspace work lists, their page-local
saved-view/query/bulk state and shared toolbar/pins/pager/result components. API, contracts, schema,
editor/Planning workflows and the public site are unchanged. Backend regression and unrelated frontend
suites were intentionally omitted, not counted as passed. Migration/seeding/API compilation in browser
provisioning are prerequisites, not new backend regression evidence. Full release verification is deferred.

Commands used Node 24.16.0/npm 11.13.0 explicitly. Owned acceptance followed the existing
`createManifest('none')`/`prepareWorkspace`/`runCommand`/random-port Karma/`cleanupRun` pattern:

```sh
npm run lint --workspace @worktrail/web
npm run ng --workspace @worktrail/web -- test --watch=false --karma-config <owned-checkout>/scripts/verification/karma.config.cjs --include=<affected-specs>
npm run build --workspace @worktrail/web -- --stats-json
npm run verify -- --mode=e2e --grep='<selected-title-pattern>'
npx eslint e2e/shared-saved-view-state.spec.ts e2e/worktrail-smoke.spec.ts --max-warnings=0
npx tsc -p tsconfig.verification.json --noEmit
git diff --check
```

### Focused Acceptance

`b55d2e62-ffce-42e3-a71d-327298a7495d` passed 250 affected Angular cases, frontend lint, production
build and static initial-graph checks. Selection covers work-item state/query specs, saved-view toolbar/
pins, result-list/pagination/chips and both real production list pages. Cases cover ownership/default
denial/shared roles/archived projects, explicit Named/Modified/Custom identity, create/rename/query/pin/
delete after context reset/destruction, superseded loads, failed writes/drafts, applied-vs-pending state,
all-field canonical view/pin/chip round trips, latest response feedback, table/mobile semantics and
pending bulk selection. Page-size mount/remount/accepted-size synchronization has a direct regression.
The preceding 244-case run (`3d44fb36-d931-4df3-967e-f80bc74c7e9a`) passed but is not added to the
250-case count. Later Angular spec changes are whitespace only; production source is unchanged.

Initial production size is 397.75 kB (109.92 kB estimated transfer), 155 initial inputs, 20 lazy page
entries and no budget warnings. No CDK/dialog/detail/Planning/Markdown/editor input entered the initial
static graph. No dependencies, thresholds, retries, workers or deadlines were raised.

Five distinct selected browser journeys completed successfully across the following runs. Diagnostic
multi-test runs are not represented as clean overall passes:

- `b2070129-6860-4425-b0b2-35b0f7a798b8`: workspace saved-view state and all three existing journeys
  (project/workspace paging/return/copy/export/board, workspace shared owner/contributor views, and
  project personal/shared owner/contributor views) passed. The new project case stopped on an incorrect
  test table name, described below.
- `0beb926e-4b19-4fc0-b036-2437c4126ab1`: clean single-journey pass for the corrected project case.

New scope-specific fixtures each create 105 ready, unestimated work items in the owned database. They
exercise delayed opening with no premature result confirmation, pending filters preserving Named,
applied changes becoming Modified without a saved-definition write, explicit Update returning Named,
pin/rename/same-URL reopen, top/bottom 100-row synchronization, paging without definition changes,
load failure clearing confirmation, Retry into zero results and deletion returning Custom. Project
coverage also selects exactly 100 visible IDs, verifies clearing on page change and selects the five
remaining items from mobile controls. Existing owner/contributor flows prove real API permissions.

Screenshot inspection covers both scopes at 1280px and 320px, with no overlapping controls or page
overflow. The existing workspace table retains internal horizontal scrolling at narrower desktop widths;
phone results use cards. This is not a full screen-reader/device audit. Browser tests use one worker,
zero retries and unchanged deadlines. Test-code ESLint and verification TypeScript passed.

### Diagnostics

- `e2e29aba-2112-4467-97c8-3563bf27f0bc`: 226 cases with six obsolete pager/empty/Open-message and
  request-body expectations failing. Bottom selectors now distinguish top navigation; empty results
  retain the compact top control; no premature Open confirmation remains. Workspace create omits an
  absent project ID rather than supplying an undefined property.
- `5511e723-7b19-44e1-89c1-49281e619d8f`: new query-store test did not typecheck because the scoped
  pending-value union omitted workspace fields; the fixture was corrected.
- `a4e67688-e587-4f41-b074-b7a60254dcf5`: 240 cases with one remaining old empty-pager selector;
  it now asserts the intended bottom absence and top zero range.
- `26588a2d-651e-4df5-bbe0-33380acaa3b3`: interrupted after an exact wrapped-label selector stalled
  the new opener flow. Explicit accessible select labels resolve the ambiguity. Its summary records
  SIGINT and successful cleanup; it is not an acceptance pass.
- `f2e697c1-96eb-4148-b1d8-0d856a852ecf`: both new browser cases found a real pager select-mount bug:
  bottom size displayed 10 while accepted size was 100. Option-level selected bindings now reflect
  metadata across mounting/remounting; Angular and subsequent workspace/project browser checks pass.
  The three existing journeys passed in this diagnostic run too, without being counted twice.
- `b2070129...`: the new project test requested a table named `Project work items`, but the existing
  accessible name is `Work items`. Only that locator changed; the focused rerun passed seven header
  cells, visible-ID selection, clearing, mobile controls and the remaining mutation/failure checks.

### Closure

All runs used private checkouts/builds/browser profiles and owned random-port servers. Browser runs
used labeled disposable PostgreSQL containers and owned attachment storage. Ordinary PostgreSQL on
5432, the configured working database/storage and unrelated processes were not used or stopped.
Owned resources were removed on success, failure and interruption; ignored reports/screenshots remain
under `test-results/verification`. Documentation-only closure reuses the focused checks above.
Package versions remain 0.2.9. No commit, push, merge, tag, publication or deployment was performed.
Phase 15 is complete; Phase 16 and release-wide verification remain pending.
Final read-only inspection confirmed all nine Phase 15 run summaries marked cleaned, their owned roots
absent and no matching process/container remaining. Structured Markdown parsing validated 94 local
links/anchors across the six changed documents; final test-code ESLint and `git diff --check` passed.
