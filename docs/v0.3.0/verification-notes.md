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
