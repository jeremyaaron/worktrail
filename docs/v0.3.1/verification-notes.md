# Worktrail v0.3.1 Verification Notes

## Phase 0 Scope

Completed October 18, 2026. Verification was limited to private compatibility proofs, read-only baseline inventories, and documentation checks. No full Angular/API/E2E suite was run. No working dependency, migration, application source, release identity, or exception deadline changed.

Baseline commit: `df9710d8c9f736f5c7f8ec6632ab58b3e68cdbbf`, branch `v0.3.1`. Preserve the pre-existing CI workflow, README/developer guidance, and CI-test edits. [Structured evidence](phase-0-evidence.json) records source/lock hashes, every spec's conversion group, historical migration identities/hashes, audit reports, and proof results.

## Results

| Boundary | Selection And Outcome |
| --- | --- |
| Baseline installation | `npm ls --all --json` passes; production audit 0, full audit 13/five advisory IDs |
| Candidate installs | Independent private installs; exact root/workspace peer bindings; no forced or overridden relationships |
| Representative Angular specs | Three converted existing files: display helpers (2 tests), attachments HTTP client (4), real-router draft guards (11); all pass |
| Prototype browser harness | Real Quick Find component/debounce/focus proof and a harness assertion-control check; total prototype selection 19 passing checks across four files |
| Linux representative execution | Fresh `npm ci` and the same 19 checks pass in Playwright `v1.61.1-noble`, Node `24.17.0`, ARM64 |
| Development build | `npm run build --workspace @worktrail/web -- --configuration development` passes |
| Production build | `npm run build --workspace @worktrail/web` passes; initial total 410.31 kB; unchanged 550 kB/1 MB initial and 8 kB/12 kB component-style budgets |
| Failure exit | A separate intentionally incorrect-content spec returns exit 1; it is not part of the passing prototype selection |
| Interruption | Abort watch execution after its observed two-test completion, not after a sleep; host and Linux report closed endpoints and zero recorded children |
| Staged discovery | All 70 baseline specs assigned exactly once: 3 migrated, 67 legacy; separate TypeScript scopes |
| Independent failure collection | Deliberately failed Vitest selection followed by passing two-test Karma selection; aggregate remains unsuccessful |
| Drizzle folder conversion | `drizzle-kit up` preserves all 20 SQL hashes/order; original populated ledger identity retained |
| Metadata normalization | 23 terminal-snapshot fields only; PostgreSQL catalog equivalence checked; no redundant DDL adopted |
| Stable generation | Two `npm run db:generate` executions leave the complete recursive migration inventory unchanged |
| Database preservation | Prior release migrations/seed, RC migration, and repeat migration preserve all public-table contents; 39 seeded work items |
| Attachments | Three inventoried storage files, including storage metadata, retain identical byte hashes; this is not a claim of three attachment objects |
| Fresh schema | Columns, indexes, and constraints match the populated-upgrade schema; all 20 historical migrations applied, repeat is a no-op |
| Runtime proof | Query-builder select/count, row locking plus rolled-back write, and read-only repeatable-read transaction pass |
| API typing | `npm run typecheck --workspace @worktrail/api` passes after minimal private driver/path adaptations |
| Prior-version rollback observation | Original migrator accepts the RC-augmented ledger without replay or changed data |
| Cutover dependency graph | Separate clean install without Karma/Jasmine; valid peers; production/full audits both 0 |

The two prototype harness checks are feasibility controls, not new permanent regression coverage. Full converted-suite acceptance, native-editor acceptance, broad API/concurrency behavior, compiled preview, and final versioned-tree verification remain assigned to their implementation phases.

## Proof Procedure

Create the candidate through the existing owned workspace/resource modules with dependency mirroring disabled. Include the actual working source/configuration, not just committed HEAD. Use independent candidate manifests/lockfiles and clean installations. Bind root TypeScript/Chokidar/Angular peers as recorded in the [disposition](dependency-remediation.md).

For Angular, use the owner `refactor-jasmine-vitest` schematic only on the three selected existing files, with explicit imports/browser mode, and inspect the result. The prototype target uses `@angular/build:unit-test`, matching Vitest/provider versions, Chromium, a separate spec TypeScript scope, and explicit Zone-based TestBed providers. Configure loopback host, assigned strict port, serial files, and zero retries. Use the actual Quick Find 220 ms debounce with controlled timer advancement, not real delays.

For the legacy partition, exclude converted/prototype files from both builder discovery and its Jasmine TypeScript scope. Keep the new runner's selected files and explicit imports separate. Compare the partition union with the baseline inventory and deliberately fail one child while allowing the other to finish. This is not fallback execution of the same failing test.

For Drizzle, provision owned Docker PostgreSQL and a second marked service-mode database inside that disposable server. Populate the first with original migrations/seed and record all public-table values, original ledger columns, and storage hashes. Apply the RC only through an explicit provided client. Verify the owner adds ledger names/unknown historical application times without altering original columns or replaying SQL. Compare the fresh schema, repeat migrations, exercise transactions, and check old-migrator compatibility without reset/reseed.

Review normalized snapshot entities by structured identity. Only the recorded `where`/`value` fields may differ; other entity fields and snapshot ancestry remain equal. Independently apply the discarded redundant DDL to the disposable fresh schema and compare PostgreSQL's column/index/constraint catalog. Generation then runs twice with complete before/after file hashes. No hand-edited ledger or domain-schema change is used.

The separate cutover graph proof removes runner declarations only in another private installation and runs clean `npm ci`, installed-graph validation, and production/full audits. It proves advisory retirement is feasible; it does not claim that the working graph or the complete unconverted suite is already migrated.

## Diagnostic Findings

- An unbounded root TypeScript peer selected version 7. Constrain the intended compiler version rather than force incompatible peers.
- Optional Devkit Chokidar 5 saw Sass's hoisted Chokidar 4. An explicit compatible root peer binding fixes the graph; ordinary update/dedupe alone did not.
- Independent peer-valid Angular 21/22 copies broke native component injection through the icon package. Explicit root Angular bindings plus actual rendering and runtime-resolution checks are necessary.
- The RC schema loader misresolved the inherited contracts path. An API-local relative path mapping fixed generation without changing runtime contracts.
- The RC no longer accepts the positional Pool constructor. The initial private prototype failed authentication through default connection configuration; no SQL ran against that default target. All successful proofs use an explicit owned client, and implementation must prevent that fallback.
- Owner snapshot conversion retained qualified expressions while current generation emitted unqualified equivalents. Unreviewed generation would add redundant index/constraint DDL; the narrowly proved metadata normalization avoids it.
- One diagnostic overlapped two Vitest invocations in the same private checkout and corrupted their temporary virtual-file mapping. That run was rejected, its owned processes stopped, and lifecycle proofs were rerun serially. Parallel runs must use independent snapshots/caches; no retries or deadlines were added.
- Linux lifecycle diagnostics without an init process left adopted Chromium/esbuild zombies under Node PID 1. `ps` confirmed the zombie state. The diagnostic container exited unsuccessfully and was removed; rerunning with Docker `--init` passed unchanged cleanup rules. This is container supervision, not a reason to extend timeouts or ignore cleanup failures.

## Limits And Cleanup

Linux evidence uses the available ARM64 Playwright image, not GitHub's remote AMD64 runner. It validates Linux filesystem/browser/process behavior but does not certify remote CI. Docker had about 8 GiB available; Linux diagnostics used a 6 GiB limit and two CPUs. Those are environment controls, not application performance promises.

All proof servers/browsers, disposable databases/containers, private dependency installations, and temporary browser binaries are removed after evidence retention. Cleanup validates owned identities/markers; it does not stop unrelated applications or reset working data. Root dependency/source/migration hashes are checked against the baseline before closeout.

At Phase 0, the working graph retained its original bounded exceptions. A private clean candidate is not permission to change the policy early or claim the release is ready. Phase 9 shard balancing is deferred; no extra utilization/performance runs are needed for that non-change.

## Phase 1: Implemented Angular Foundation

Completed October 18, 2026, on branch `v0.3.1`, starting from commit
`16ed76c799ec2de0de1885ccf66d84e52a08c3a4`. The worktree was clean at entry.
[Structured evidence](phase-1-evidence.json) records the lock/source identities, selections, summaries,
and deliberate failure outcomes. This is an Angular/tooling change, not Drizzle adoption or a release verdict.

| Command / Boundary | Outcome |
| --- | --- |
| Exact-version `npm ci` | Pass on Node `24.16.0` / npm `11.13.0`; no force flags or overrides |
| `npm run audit:dependencies` | Valid installed peers; production 0; full 10 exact records under two original, unexpired advisories |
| Spec ownership | 71 files assigned once: 67 Karma / four Vitest; editor type scopes and app/icon physical Angular identity match |
| `node --test scripts/verification/{web,audit,ci}.test.mjs` | 26 passing focused checks, including negative selection/ownership/audit/CI cases |
| Focused runner/config ESLint and `tsc -p tsconfig.verification.json --noEmit` | Pass |
| `npm run verify -- --mode=web` | Pass: frontend lint, development build/typecheck, complete legacy partition (870), representative Vitest partition (18), production build, owned cleanup |
| Production budgets | Initial 410.31 kB; unchanged 550 kB/1 MB initial and 8 kB/12 kB component-style thresholds; no warnings |
| `npm test --workspace @worktrail/web -- --runner=vitest` | Four files / 18 passing tests, including final runner/report configuration |
| Literal file + name selection | Display-helper selection runs its two tests; a nonexistent pattern returns exit 1 after zero executed tests, not a green skipped suite |
| Four intentional assertion failures | Each runner failed separately through ordinary and owned execution; the independent other partition still ran/passed; every case failed acceptance and cleaned resources |
| Owner migrations | Private core/CLI migration review over the specified 20-to-21 ranges; no application changes |

The representative set retains all 17 existing display/HTTP/router/draft tests. Its one new regression
renders the real Quick Find component and icons, advances its 220 ms debounce deterministically
(219 + 1), and verifies native input focus. Production and TestBed remain Zone-based; there are no
increased waits, retries, fixture sleeps, or weakened assertions.

The ordinary and owned entries share one serial implementation. Successful/nonzero commands remove
their registered processes, loopback endpoints, and private outputs; summaries remain in ignored
`test-results/verification`. Unit checks also verify that interruption or retained child ownership
prevents launching another partition. Host/Linux lifecycle feasibility remains the Phase 0 result;
final single-runner watch/interruption acceptance belongs to Phase 5.

The full web profile ran once at the framework boundary. Subsequent small wrapper/report refinements
used only relevant Node/type/lint and representative Vitest checks. The legacy specs, application
sources, framework graph and build configuration did not change after that full run. API, database,
E2E, native editor, preview, setup and site suites were deliberately omitted as unrelated to this phase.

Installation initially encountered npm's stale Angular 20 peer resolution; a scoped workspace update
reconciled the lockfile without `--force`/overrides, followed by clean installation. The first focused
Vitest build exposed a missing providers entry in the temporary compiler file list; it was fixed and
all acceptance runs above use the corrected list. Adding a structured reporter required an explicit
typed config return to preserve tuple typing; the final verification-config typecheck passes.

All private proof snapshots/processes are removed after retaining sanitized results. No working
database, API/contracts source, SQL file, public-site asset, CI trigger or release version changed.
Three resolved Vitest/Tinypool exceptions are removed; Karma and Drizzle remain due in Phases 5/6,
with no renewed deadline or claim of zero full-audit findings.

## Phase 2: Shared And Core Conversion

Completed October 18, 2026, on branch `v0.3.1`, starting from clean commit
`4a910b2cc5a7d9f80196b7e4c7c82f6657d72b5f`. Release identity remains `0.3.0`.
[Structured evidence and coverage map](phase-2-evidence.json) record all 24 assigned files,
their before/after hashes, unchanged registration/parameterization/assertion counts, partition
membership, the owned run summary, and the negative regression probe.

| Selection / Boundary | Outcome |
| --- | --- |
| Remaining Phase 2 conversion | 21 files converted; three Phase 1 files unchanged |
| Retained app/core coverage | 80 cases: shell/routes, API/error clients, authorized context, real reused routes, draft departure |
| Retained authored-content coverage | 175 cases: edit commands, parser, links, validation, native editor/viewer |
| Retained other shared coverage | 59 cases: clipboard/download/errors, cycle/delivery/display policies, section targets and bounded navigation |
| `npm test --workspace @worktrail/web -- --runner=vitest` | Pass: all 314 Phase 2 cases plus the unchanged toolchain case; 25 files, owned cleanup confirmed |
| `node --test scripts/verification/web.test.mjs` | Seven passing discovery/type-scope/runtime-identity/selection/failure/ownership checks |
| `npm exec -- tsc -p apps/web/tsconfig.vitest.json --noEmit` | Pass; explicit Vitest imports with no shared ambient test globals |
| `npm exec -- tsc -p apps/web/tsconfig.spec.json --noEmit` | Pass; the complementary legacy Jasmine scope remains valid |
| Affected core/shared/app ESLint | Pass with zero warnings; frontend source lint also passed during conversion |
| Controlled clipboard mutation probe | Expected failure in the selected stale-finalization case; one failing assertion detects the incorrect pending-state update |
| Partition reconciliation | All 71 specs assigned once: 25 Vitest / 46 Karma; all later-phase spec hashes unchanged |

Registration totals are also checked directly from unchanged literal test parameterization; no
disabled/focused tests or count-reducing substitutions are used. The existing display/attachments/
draft-departure specs converted in Phase 1 were included in the passing selection, not reconverted.
HTTP mock responses still use `flush`; none of these files imports Zone clock-test helpers.

Vitest spies deliberately retain call-through where Jasmine requested it and explicit stubs where
Jasmine suppressed native behavior. Native textarea setter, Markdown parser, fetch, focus, and
download spies are restored after each test. Angular's existing TestBed teardown remains enabled;
the principal editor/viewer fixtures and reused-route harness also have explicit teardown. Actor
storage and the appended download anchor are cleared on failure as well as success.

The late clipboard test now waits for actual copy entry, navigates to the next report, releases the
old copy, and drains its promise chain with `vi.advanceTimersByTimeAsync(0)`. This does not wait for
elapsed real time or impose a larger deadline. A private negative probe removed the production
finalization guard only in its owned snapshot; the test failed at the expected `false` versus `true`
pending-state assertion. That probe is diagnostic evidence, not a failed acceptance run, and its
resources were removed. Production source in the working checkout is unchanged.

An initial deferred-promise helper used `Promise.withResolvers`, which the existing ES2022 type
library does not expose. Both the typecheck and Angular test compilation rejected it. It was replaced
with ordinary deferred promises before the passing acceptance run; compiler targets and deadlines
were not changed.

Verification was intentionally limited to the converted group and cheap affected configuration
checks. The 46 remaining Karma specs were not executed, nor were app builds, audits/installation,
API/database tests, application E2E, the separate native-editor harness, preview/setup or site suites.
Those inputs and dependencies are unchanged. Phase 5 retains final single-runner/editor/lifecycle
acceptance; Phases 3-4 retain their unconverted groups. No data, SQL history, advisory deadline, CI
trigger, production scheduling provider, release version or remote workflow was changed.

## Phase 3: Discovery And Workspace Conversion

Completed October 18, 2026, on branch `v0.3.1`, starting from clean commit
`741146031efdc66deaec0b2e1d6dc87e972fafc5`. Release identity remains `0.3.0`.
[Structured evidence](phase-3-evidence.json) contains the per-file coverage map, before/current/executed
hashes, exact focused selection, browser results, unchanged clock advances, and negative probes.

| Converted Group | Files | Retained Cases |
| --- | --- | --- |
| Query serialization/parity/filter labels and query/saved-view/bulk stores | 7 | 113 |
| Filter chips/panel, pinned/saved views, pagination and result controls | 6 | 44 |
| Project/workspace work pages and board | 3 | 108 |
| Quick Find search/dialog/navigation/session | 4 | 26 |
| Inbox, My Work, Portfolio, projects/shell/navigation and workspace settings | 9 | 54 |
| Total Phase 3 group | 29 | 345 |

| Check / Selection | Outcome |
| --- | --- |
| Shared owned web runner, explicit 33-file selection | 391 passing Chromium cases: all 345 converted cases plus 46 affected consumer cases; no skips/retries; cleanup passes |
| Affected consumers | App shell (11), PageContext real reused routes/actor ownership (23), draft departure (11), toolchain/debounce/icon/focus (1); their sources are unchanged |
| `tsc -p apps/web/tsconfig.vitest.json --noEmit` | Pass; no Jasmine ambient types or Zone clock-test imports in converted specs |
| `tsc -p apps/web/tsconfig.spec.json --noEmit` | Pass for the complementary remaining Jasmine scope |
| ESLint, 29 changed specs and native formatter follow-up | Pass with zero warnings |
| `node --test scripts/verification/web.test.mjs` | Seven passing discovery/type-scope/runtime-identity/selection/failure/ownership checks |
| Coverage/partition reconciliation | Definitions, registration loops, assertion counts, HTTP mock responses and clock advances unchanged; 54 Vitest / 17 Karma files, complete/disjoint |
| Pending/applied state mutation | Selected regression fails when pending form state incorrectly supplies `activeQuery` |
| Quick Find clock mutation | Selected regression fails when search has not run at its 220 ms logical debounce boundary |

The passing selection uses `runWebTests`, the same owned implementation called by ordinary `npm test`
and `verify`. Reproduce it with `npm test --workspace @worktrail/web -- --runner=vitest` and one
`--include=<path>` argument for each path recorded in the evidence. A private driver retains the
structured report before normal cleanup; its results do not rely on parsing console text.

Clock conversion preserves exact behavioral checkpoints, not machine-speed assumptions. Quick Find
uses 219 + 1 ms to prove the debounce boundary; zero-time advancement drains focus/navigation/promise
work. Work-list copy feedback retains its real product expiry, and pending search still does not
apply after the former debounce interval. These are controlled clocks, not real sleeps, polling
extensions or startup SLAs. My Work freezes only `Date`; Inbox's two `TestBed.tick()` calls are retained
as Angular effect synchronization. HTTP mock `flush` calls and their response payloads are unchanged.

Explicit teardown restores mocks/descriptors, destroys clock-owning fixtures before returning to real
timers, clears actor selection, and removes the Quick Find trigger/Files nodes even after an assertion
fails. The actual native formatter is still used: an explicit constructor delegate preserves Intl's
internal slots and records its UTC-versus-timestamp options. No generic browser shim is introduced.

Typing initially rejected remaining Jasmine `toHaveSize` calls and a missing explicit `vi` import.
The first behavioral selection then passed 390/391 cases but exposed Vitest's default native Intl
constructor-spy mismatch (`format` was not callable). Explicit native-constructor delegation fixes
that cause; the final 33-file selection passes all 391 with unchanged deadlines and assertions.
After acceptance, only two surplus EOF blank lines are removed from the launcher spec; both executed
and current hashes are retained. No functional source changes follow the passing run.

The two negative probes mutate only disposable production-source copies and each fail one selected
case for the intended behavior. Other cases are filtered out in those probes, not disabled in the
suite. All positive and negative snapshots, endpoints and recorded child processes are removed.
Sanitized evidence remains in this sprint directory; no working data is accessed.

Only the changed group and four affected consumers were executed. The other previously converted
Vitest files, 17 remaining Karma specs, app builds, install/audit refresh, API/database tests, application
E2E, native-editor harness, preview/setup/site suites, and Linux lifecycle reruns were deliberately
omitted. Their sources, dependency graph and execution infrastructure are unchanged. Earlier-phase
evidence is not relabeled as a fresh run. Phase 4 owns the remaining conversion; Phase 5 owns final
single-runner/editor/lifecycle acceptance. Production scheduling, budgets, dependency/security policy,
SQL history, release version and CI triggers remain unchanged.

## Phase 4: Detail And Planning Conversion

Completed October 18, 2026, on branch `v0.3.1`, starting from clean commit
`99f54b804e5451e9ac6b9bb46ec6734ab8984826`. Release identity remains `0.3.0`.
[Structured evidence](phase-4-evidence.json) records per-file retained cases, before/current/executed
hashes, test registration loops, assertion/HTTP/clock parity, exact focused selections and cleanup.

| Converted Group | Files | Retained Cases |
| --- | --- | --- |
| Work-item detail and unavailable state | 2 | 113 |
| Attachments and parent/child components | 3 | 26 |
| Planning page, cycle manager/options/summary and mutation state | 5 | 32 |
| Cycle/milestone review and cycle closeout/result | 4 | 32 |
| Status-report list, draft and historical detail | 3 | 25 |
| Total Phase 4 group | 17 | 228 |

| Check / Selection | Outcome |
| --- | --- |
| Shared owned runner, 24 explicitly selected files | 278 passing Chromium cases: all 228 converted cases plus 50 affected cases; zero skips/retries; resources removed |
| Affected consumers | PageContext (23), draft departure (11), attachments API (4), cycles API (4), clipboard (3), downloads (3), section targeting (2); their sources are unchanged |
| Closeout fixture follow-up | Only its eight-case file rerun after the navigation-double fix; all pass without the route diagnostic |
| Vitest spec typecheck | Pass; explicit imports, no Jasmine ambient types or Zone test clocks |
| Legacy spec typecheck | Pass with zero source inputs; no legacy tests executed |
| ESLint on the 17 changed specs | Pass, zero warnings |
| `node --test scripts/verification/web.test.mjs` | Eight passing selection/discovery/type-scope/runtime-identity/failure/ownership checks |
| Full inventory reconciliation | All 70 original specs plus one toolchain spec assigned exactly once: 71 Vitest, zero Karma; all 228 Phase 4 cases retained |
| Parent-search negative probe | A private 301 ms debounce fails the selected test at its original 300 ms HTTP-request boundary |

Use `npm test --workspace @worktrail/web -- --runner=vitest` with one literal `--include=<path>` for
each selected file recorded in the evidence to reproduce the positive selection. Evidence drivers
use the same owned `runWebTests` entry point as ordinary web tests and `verify`, retaining structured
results before cleanup. The full 71-file/888-case suite was reconciled but not rerun in this phase.

The converted tests retain repeated route/draft ownership, submitted writes, attachment permissions
and transfer errors, dependency/hierarchy navigation, cycle outcomes, stored historical snapshots
and publication guards. Matcher translations retain deep/asymmetric containment rather than relying
on reference identity. Typed clipboard and event doubles replace Jasmine objects. Bare native
focus/scroll/emitter spies are explicitly stubbed because Vitest otherwise calls through.

The parent manager's three Zone-clock cases now use controlled Vitest timers with native async
completion. The existing advances remain 300, 299 + 1, 300, 300 and 300 ms: they test actual product
debouncing, not machine-speed assumptions. Fixture destruction precedes real-clock restoration.
Failure-safe teardown restores native spies/descriptors and actor selection, and removes only the
download anchors owned by the tests, including the anchor whose production removal is deliberately
stubbed. No global browser shim, real sleep, retry or deadline increase is introduced.

The initial typecheck caught seven missing explicit `vi` imports before browser acceptance. The
old stale-editor-scope probe's broad include became valid once every file migrated; it now removes
a required spec and proves that omission is rejected. An additional cheap regression proves a
complete migration selects only Vitest and rejects explicit legacy selections. The empty legacy
TypeScript scope uses `files: []`, retaining its exact exclusions without a no-input diagnostic,
dummy legacy spec or change to runner/configuration validation.

The 278-case selection passed but logged `NG04002` from one successful closeout write targeting an
empty fixture router. That case now explicitly resolves navigation and asserts the exact cycle
review destination and fragment. Only its changed eight-case file was rerun, passing cleanly; one
assertion is added to the existing case, no case is added or removed. The two executed source
revisions are separately recorded rather than claiming the entire selection reran after that edit.

The negative probe changes only an owned copy's parent debounce to 301 ms. The selected case fails
at the expected missing HTTP request at 300 ms, confirming the converted timing test can detect the
regression. Other cases are filtered out for that diagnostic, not disabled in the committed suite.
All owned snapshots, recorded browser/process groups and endpoints are removed after both positive
runs and the expected negative result. No working data or ordinary development server is used.

Previously converted specs outside the seven selected consumers, application builds, dependency
installation/audits, API/database tests, site/setup suites, native-editor harness, application E2E,
compiled preview and Linux lifecycle reruns were deliberately omitted. Their inputs are unchanged;
Phase 5 owns full single-runner integration and removal of the legacy target/dependencies. No
production code, Zone provider, budget, SQL history, advisory deadline, release identity or CI trigger
changes are part of this phase.

## Phase 5: Single Runner And Angular Acceptance

Completed October 18, 2026, starting from clean commit
`dcece57f1a803fe6b10aecf335e571a1fd3d53ec` on `v0.3.1`. Release identity remains `0.3.0`.
[Structured evidence](phase-5-evidence.json) retains input/lock hashes, all 71 file/count mappings,
audit reports, run identities, selected integration results, lifecycle proofs and diagnostic limits.

### Implemented Boundary

The standard Angular `test` target now uses only Vitest/Chromium. The temporary `test-vitest` target,
partition executor/manifest, extra compiler scope, Karma launcher and Karma/Jasmine dependencies/types
are removed. All 71 specs and 888 cases are byte-for-byte unchanged from Phase 4. Broad source includes
pick up new specs automatically; discovery must match the no-ambient-globals editor/compiler scope.

Root `npm run test:web`, workspace `npm test --workspace @worktrail/web` and owned verification share
one implementation. Literal file selection and regex name filters remain; invalid/empty selection,
omitted files and skipped/incomplete non-filtered acceptance fail from the actual JSON report. Root
selection arguments are not forwarded through a second npm parser. Explicit `--watch [--headed]`
uses live source, disables the shared Angular local disk cache and owns its endpoint, private compiler
config and descendants. Interactive summaries are `passed: null`, never release acceptance.

Reports persist under `test-results/verification/<run-id>/web/`. Real screenshot capture runs within
the private checkout's Vite filesystem boundary, then images are copied to retained results before
cleanup. The original assertion failure remains the command failure. No filesystem allowlist widening,
disabled safety check or browser retry is used. Source context and assigned ports are validated before
the test server starts; SIGINT/SIGTERM and abandoned-run cleanup retain the existing ownership model.

### Verification

| Check / Selection | Outcome |
| --- | --- |
| Normal clean `npm ci` and installed peer graph | Pass; 101 packages removed, no packages added or retained versions upgraded |
| Production audit / full audit gate | Zero production; four moderate records, solely the unchanged Drizzle advisory; exact policy gate passes |
| Complete host web profile | Lint, development compilation, 71 files/888 Chromium cases, production build pass; no skipped tests/retries |
| Ordinary full unit execution | 71 files/888 cases pass through the shared implementation; the alias diagnostic and its later focused forwarding proof are separately recorded |
| Fresh Linux installation and full unit execution | Node 24.17.0/npm 11.13.0, Playwright 1.61.1 Noble ARM64; all 888 cases pass |
| Final output/context follow-ups | Latest toolchain case and all four lifecycle checks pass on host/Linux, including real screenshot preservation |
| Native editor | All five typing undo/redo, link, composition, containment and parser-policy cases pass |
| Compiled preview | Both deep-link/seeded-file and compiled asset/formatted-content cases pass; built contracts/API/web used |
| Selected application journeys | Eight of nine pass initially; unchanged Quick Find case passes a separate ordinary follow-up; initial failed aggregate is not relabeled |
| Cheap runner/audit/CI/ownership checks | 31 pass; PR-only comprehensive workflow, independent aggregate failure reporting and Pages trigger preserved |
| Spec / verification typing and changed-tooling ESLint | Pass, zero lint warnings |
| Read-only site/link check | Pass: 43 references, 17 repository links, 13 IDs, existing 0.3.0 identity |
| Production bundle and budgets | 410.31 kB initial; original 550 kB/1 MB and 8 kB/12 kB thresholds retained |

The complete host profiles and Linux 888-case run precede the final screenshot-export/context
refinement. That refinement does not change application/spec behavior, dependency versions, production
build inputs or test compilation. Its real failure screenshot, ownership, focused toolchain and
watch/interruption paths are verified on both hosts; typing/lint and cheap runner checks cover the
final implementation. Do not duplicate unchanged full suites and builds after this output-only change.

`npm run test:verification:web-lifecycle` is an explicit opt-in check, not a new comprehensive CI job.
Its four cases prove actual failure propagation/artifact retention, a live source edit followed by
SIGINT (130), SIGTERM (143), and SIGKILL followed by explicit idempotent abandoned cleanup. Recorded
Chromium descendants exit, endpoints close and a separate loopback service remains usable. Watch
report observation uses filesystem events and process identities, not elapsed startup sleeps.
Its assertion-control fixture intentionally fails inside Chromium; the enclosing lifecycle check
passes only if that failure and its screenshot are preserved and resources are removed.

### Quick Find Observation

The original nine-journey run remains **failed**: eight cases pass, while the launcher/keyboard/focus
case misses the accessible Quick Find dialog at its existing five-second assertion deadline. The
screenshot shows the dialog, and the trace records successful lazy-module requests and a dialog DOM
at the end. This does not establish a specific CDK, application or Playwright bug.

Investigated the trace/network, installed CDK/Playwright behavior and a passing minimal native
popover/modal control. One private instrumented case and eight separate fresh-page diagnostic
repetitions pass. A final **unmodified ordinary E2E** invocation of that exact case also passes.
No application/test selector, assertion, sleep, retry or timeout was changed for this observation.
Concurrent local builds and Linux work were present originally, but resource contention remains a
hypothesis, not a proven root cause or fix. Preserve the original run
`9b151fee-e837-44ee-a29c-b5ffe39f6c1b` and its trace/screenshot under ignored verification results;
the evidence records the successful follow-up separately. Treat recurrence as requiring new live
accessibility diagnostics, not an automatic deadline increase or dismissal as harmless flakiness.

### Diagnostics And Scope

Early orchestration mistakenly launched cheap checks while `npm ci` or exception retirement was
still running; missing-module/stale-policy failures are not acceptance evidence. After prerequisites
complete, all 31 checks pass. Invalid-port mutation tests now restore the deliberately invalid
manifest before cleanup; the single retained diagnostic directory was explicitly restored/removed.
Angular's builder requires a workspace-relative private tsconfig argument; the initial absolute
path was rejected before test execution. The root npm alias also initially consumed `--include`,
so the command now enters the Node wrapper directly and has a focused forwarding regression.
The context declaration was updated before passing verification typing. A misspelled filter executes
no cases and is correctly rejected even when Vitest itself returns success.

A stronger real-DOM failure control exposed screenshot access errors for an outside-workspace path.
It now captures in the private checkout and exports the image before cleanup; host/Linux controls
retain the original assertion and image without the secondary access error. Vite filesystem
restrictions remain at their defaults. These diagnostic failures are distinct from final acceptance.

The actual graph retires the Karma/braces advisory alongside the three Angular-related records
retired in Phase 1. Only the unchanged Drizzle exception remains, with its original expiry/review
boundary and exact four paths. API/Drizzle declarations, SQL history, application source/providers,
budgets, CI triggers/shards, public-site assets and release identity are unchanged. No full
API/contracts/schema/upgrade suite, unselected application journeys, rendered-site suite or fresh
setup proof was run for this boundary. Phases 6-7 own the Drizzle/data work.

Every final verification summary reports cleanup. All host/Linux source snapshots, owned database
and diagnostic containers, registered browser/process groups and endpoints were removed; retained
reports remain under ignored `test-results/verification`. No normal database, user storage, unrelated
development server or remote GitHub state was changed. Nothing was committed, tagged or pushed.

## Phase 6: Drizzle Adoption And Metadata

Completed October 18, 2026, from clean commit `b5bf78152baf3b38a0b0c141d750cd9a69e81074`
on `v0.3.1`. [Structured evidence](phase-6-evidence.json) records the before/after lock identities,
every original SQL hash and converted folder/snapshot ancestry, the exact expression review,
selected tests, ledger mapping and owned cleanup. Release identity remains `0.3.0`.

| Command / Boundary | Outcome |
| --- | --- |
| Upstream selection recheck | Stable Kit `0.31.11` still declares the legacy loader; stable ORM `0.45.4` does not fix that owner path. Retain exact Kit/ORM `1.0.0-rc.4`, matching both RC tags and the Phase 0 proof |
| Independent baseline installation | Clean `npm ci` of the pre-Phase-6 snapshot, with its own lock and dependencies; old ORM `0.45.2` executes the prior migrations |
| Working installation | Clean `npm ci` on Node `24.16.0` / npm `11.13.0`; no forced peers, overrides or audit-fix downgrade |
| `npm run audit:dependencies` | Installed workspace peer graph valid; production 0, full 0; empty exception list with original policy dates/review boundary retained |
| Owner folder conversion | Private `npm exec --workspace @worktrail/api -- drizzle-kit up`; all 20 historical SQL byte hashes, execution order, breakpoints and snapshot IDs/ancestry preserved |
| Metadata review | Exactly the 23 Phase 0 terminal-expression normalizations; no other manual snapshot change and no new domain SQL |
| Two `npm run db:generate` executions | Both report no schema changes; complete recursive 40-file SQL/snapshot inventory unchanged |
| API lint/typecheck and contracts/API builds | Pass; explicit provided client and API-local contracts path mapping; no repository/persistence interface rewrite |
| Schema/audit helpers | 23 passing checks via `node --test scripts/verification/schema.test.mjs scripts/verification/audit.test.mjs` |
| Fresh migration/reapplication | All 20 migrations; second application leaves the entire ledger unchanged |
| Minimal populated prior-version upgrade | Four legacy records across workspace/member/project/work item, including literal source and millisecond timestamps, remain unchanged; original 20 ledger IDs/hashes/timestamps preserved |
| Upgrade schema/reapplication | Public columns/indexes/constraints unchanged and equal to fresh schema; repeat migration changes neither ledger nor data |
| Focused API selection | Five files / 40 passing cases: `authored-content-migration`, `persistence`, `persistence-integration`, `repository-read-transaction`, `estimate-query-snapshots` |
| Changed-test/tooling ESLint and verification TypeScript | Pass with zero warnings/errors |

The old migrator builds the upgrade database from the independent prior-version installation, not
from a fabricated ledger. A separate owned service-mode database is provisioned inside the disposable
PostgreSQL 16 server, with its own database comment/manifest. Only then are four explicit fixture rows
inserted and all public-table contents/catalog/ledger captured. After capture there is no seed/reset.
The new ordinary `db:migrate` entry supplies the owned target guard and provided pool throughout.

The owner augments the existing ledger transactionally with `name` and `applied_at`; historical
application times are unknown (`null`). Original `created_at` millisecond values are not rewritten.
Converted folder names encode UTC seconds, with a recorded old-to-new mapping. The owner's matching
uses truncated timestamps and hash disambiguation/fallback. This is intentional metadata conversion,
not historical SQL replay or permission to replace domain history. Phase 0's old-migrator rollback
observation is not rerun or expanded into a future rollback guarantee here.

The authored-content test now locates its migration by name and still executes real pre-column
rows followed by the format migration; fresh coverage is not substituted for the upgrade range.
The focused runtime set includes real HTTP queries/CSV, saved views, immutable v1/v2 snapshots,
activity/notification rollback, row/coordinating locks, consistent reads and scope invalidation. A new
unit regression asserts that `createDb` retains the exact provided pool without fallback construction.
The unsupported relational `schema` option is removed; Worktrail uses query builders, not RQB.

Inventory tests use converted per-migration fixtures and independently reject changed/deleted SQL,
changed/deleted snapshots, new migrations, unknown nested metadata, generator failures and symlink
entries before/after generation. The production helper still recursively hashes every regular file;
it does not exclude the new metadata layout. Guarded generation/migration entry points are retained.

An initial constructor typecheck caught the obsolete `schema` option before the passing acceptance
run. The first database proof then stopped at a temporary fixture insert missing mandatory timestamps;
its failed summary and cleanup are retained separately at `test-results/phase-6/proof-attempt-1.json`.
The corrected database proof passes at `proof.json`, with `api-tests.json` and `ledger-mapping.json`.
Only the private fixture changed between attempts: reuse the already passed lint/types/builds and
two generation checks, rather than repeating them. No retry, sleep, deadline increase or weakened
assertion was introduced. The failed attempt is not relabeled as successful aggregate acceptance.

All owned conversion/prior-version source installations, temporary proof scripts, database
manifests and PostgreSQL resources were removed after evidence retention. The working database/storage and any
unrelated resources are untouched. The final machine policy is empty because the actual owner graph
is fixed, not because audit scope or policy dates changed. README/current-disposition pointers are
corrected without rewriting historical v0.3.0 audit counts.

Broader populated/attachment preservation, full API/concurrency/performance acceptance, independent
combined installation and release checks remain in Phases 7/8/11. No Angular, application browser,
editor, preview or rendered-site suite was run for this backend-only boundary; earlier evidence is
unchanged. No version bump, git commit, tag, push or remote workflow change was made.

## Phase 7: Data And Transaction Preservation

Completed October 18, 2026, from clean commit `ef4657b` on `v0.3.1`. Release identity remains
`0.3.0`; the Phase 6 dependency declarations, lockfile, application code and SQL are unchanged.
[Structured evidence](phase-7-evidence.json) records the source/lock identities, preserved row/file
inventories, ledger mapping, test coverage/results, runtime operations and cleanup controls.

### Reproducible Upgrade Proof

`npm run verify:upgrade` archives the actual `v0.3.0` release commit
`42166d991017b96f46bad22998832c29c0c84750`, rather than imitating an old ledger or using current
code with an old package installed. Its private checkout installs the original lock independently
with ORM `0.45.2`; the current private snapshot independently installs the Phase 6 lock with ORM
`1.0.0-rc.4`. Physical module resolution must remain inside each checkout. There are no dependency
mirrors, forced peers or mutations of the working checkout/install/data.

The archived baseline deliberately retains its old development dependencies and their deprecation
warnings only inside the disposable prior-version installation. No old frontend tests, Studio or
esbuild serve API runs, and those packages are not reintroduced into the current dependency graph.

Both databases are separately owned/marked inside a labeled disposable PostgreSQL 16 server.
The old release migrates/seeds the upgrade target before a repeatable-read, read-only capture on
one checked-out connection. After capture, neither seed nor reset runs. The fresh target is never
seeded and is also the API suite's database; suite fixtures cannot alter the preserved baseline.

| Boundary | Outcome |
| --- | --- |
| Original release/current clean installs | Pass on Node `24.16.0` / npm `11.13.0`; independent locks and physical ORM installations |
| History | All 20 SQL byte hashes/order match the released files |
| Populated rows | All 154 rows across all 19 public tables unchanged, including saved queries/pins, relationships, inactive/archived state, authored source/formats, notifications and references |
| Immutable history | Both stored reports and both stored closeouts unchanged; closeouts include versions 1 and 2 |
| Attachments | Both referenced objects match their stored length/checksum; all three inventoried files (two objects and the store marker) unchanged |
| Schema | Fresh, prior and upgraded columns/defaults/generated expressions, indexes, constraints and extension catalogs match; `pg_trgm` `1.6` retained |
| Ledger | Original 20 IDs/hashes/millisecond timestamps preserved; only expected owner-mapped names and unknown historical application times added |
| Reapplication | Fresh and upgrade repeat migration preserve complete row/schema/storage/ledger snapshots |
| API/contracts source/test lint, typechecks, builds | Pass; compiled artifacts are built in the private current checkout |
| Full API suite | 68 files / 881 passing cases; zero skipped/failed cases |
| Contracts suite | 13 files / 88 passing cases; zero skipped/failed cases |
| Upgrade/schema/ownership/resource helpers | 32 passing cases in the integrated run |
| Compiled runtime | 15 actual HTTP requests pass against the upgraded populated database, with production mode and static serving disabled |
| Post-runtime preservation | Stored reports/closeouts, file inventory and migration ledger remain unchanged after intentional runtime writes |

The full API run retains existing project/cycle and current-row coordination, stale queued-command
rereads, advisory modes/lifetime, lock ordering, hierarchy/dependency races, attachment compensation,
rollback, read-only repeatable-read hydration, escaped scope invalidation, snapshot parsers and
query-count/performance bounds. Assertions, limits, deadlines and retry policy are unchanged. The
actual API test duration was about 33 seconds here; that is evidence for this run, not a runtime SLA.

Compiled acceptance imports and starts the built API, not a TypeScript test-only composition. It
checks database readiness, original source/format reads, saved views, byte-exact downloads, stored
report/closeout retrieval, work creation/PATCH/reread, authored comments and CSV export. Only after
the baseline comparisons do these intentional writes begin. The process is stopped and its pool
closed before cleanup. No Angular build/browser or bundled SPA is needed for backend acceptance.

### Focused Follow-Ups

After the successful integrated run, add report/source-inventory validation so an empty, skipped,
missing, duplicated or inconsistent report cannot masquerade as full acceptance. Both retained
real reports pass exact file/case reconciliation. The eight updated helper checks pass, including
the new negative cases; no unchanged full API/contracts rerun is needed. Also ensure a failed pool
connection still closes the capture pool, and give a missing local baseline tag an actionable error.
These are verifier refinements, not changed application or SQL behavior. The original integrated
summary does not claim to have executed a gate added afterward; separate report-validation evidence
records that follow-up.

`npm run test:verification:upgrade-lifecycle` passes three deliberate negative controls: the candidate
installer exits 42 after database provisioning (CLI returns 1), SIGINT returns 130 and SIGTERM returns
143. Signals are sent at the observed installation gate, not after a sleep. The failure control checks
all three private roots and absence of its labeled PostgreSQL container; signal controls stop before
database provisioning. Each unsuccessful run records an unsuccessful durable summary and removes
its private resources; those failures are expected controls, not failed product
acceptance or retries. Changed verifier ESLint also passes.

The main result is retained under
`test-results/verification/f228c86f-1868-4ff7-9e83-3c97f916ac95/`, including `summary.json`,
`before.json`, `after.json`, full API/contracts reports, `compiled-runtime.json` and the later
`report-validation.json`. Negative control summaries are referenced in the structured evidence.
All three main-run owned roots/installations, fresh/upgrade databases, attachment stores, compiled
server and labeled PostgreSQL container are removed. Lifecycle controls also clean their owned
resources; unrelated resources/working storage remain untouched.

The current [operations guide](../operations.md#v031-toolchain-boundary) documents the supported
boundary and coordinated backup/restore posture. It does not promise a general downgrade, automatic
down-migration, restoration of post-backup writes or enterprise-hosting readiness. The original
Phase 0 old-migrator observation remains bounded to unchanged domain history.

Phase 8 still owns combined clean-install peer/audit-gate acceptance; Phase 10 owns fresh setup and
remaining documentation; Phase 11 owns release identity/closeout. The strict dependency audit gate
and the unchanged Angular/site suites are not rerun for this data/runtime proof. A cheap static
site/link check and whitespace validation pass for documentation completion. No app/SQL/dependency
change, timeout ratchet, sleep, retry, CI workflow change, version bump, commit, tag or push was made.

## Phase 8: Combined Graph And Audit Gate

Completed October 18, 2026, from clean commit `3550abd032709f9db33ec63e0f54e7ec3d89614a`
on `v0.3.1`. Release identity remains `0.3.0`. [Structured evidence](phase-8-evidence.json)
records the independent installation, actual audit reports, installed owner versions, original
policy metadata and focused gate controls. Dependency declarations and lockfile are unchanged.

| Boundary / Command | Outcome |
| --- | --- |
| Private snapshot with dependency mirroring disabled | Actual current source/config/lock installed into its own checkout and `node_modules` |
| `npm ci --no-audit --no-fund` | Pass on Node `24.16.0` / npm `11.13.0`; no forced peers/overrides or lock rewrite |
| Installed dependency owner | Resolves to the private checkout, not the working installation |
| Full workspace `npm ls --all --json` with dev/optional/peer inclusion | Pass with valid installed peers |
| Strict production audit collector | 0 findings; no exceptions permitted |
| Strict full audit collector | 0 findings across all severities; development, optional and peer dependencies included |
| Strict evaluator / original policy comparison | Pass with zero exceptions; original creation/release/expiry dates and review boundary exactly unchanged |
| Focused audit/CI/ownership/resource checks | 40 passing checks in the independent installation |
| Final audit/CI assertion refinements | 23 affected checks pass locally; a later structured-call refinement passes the five CI checks, with no install/audit/resource/application repeat |
| Changed-test ESLint | Pass in the private installation and after final refinements |

The private proof runs the same installed-owner validator, peer-graph validator, structured
production/full collectors and policy evaluator used by `npm run audit:dependencies`, in a tracked
child process. It saves their actual JSON reports; it does not interpret a failed/empty audit as clean
or use a different advisory scope to lower the count. The ordinary CLI is additionally exercised
with controlled responses in the focused tests below, avoiding duplicate network audits solely to
test its wrapper. The full v0.3.0 baseline remains 13 findings/five advisory IDs; the adopted graph
has zero. This is a point-in-time registry result, not a claim about undisclosed vulnerabilities.

### Final Invariants And Failure Controls

Replace the staged exact TypeScript patch and Vitest-major checks with actual owner peer ranges,
root/web compiler-version agreement, coherent Vitest/browser/provider versions and required physical
Angular runtime identity for the root/app/icon consumers. Drizzle must retain an exact reviewed
Kit/ORM pair without the legacy loader. Frozen regressions scan every lock path against the five
carried advisory ranges rather than depending on one transitive hoist or banning patched packages
by name. The live full audit remains authoritative for new or changed vulnerabilities.

Preserve invalid-peer/pruning, new finding/path/version/severity, stale/duplicate, production,
date/version-boundary, malformed/incomplete/transport and snapshot/installation-lock mismatch
negative checks. The empty original policy accepts a clean next-release tree even after the old
exception deadline; it does not accept new findings or require a renewed deadline. Transport cases
explicitly include DNS, connection reset and timeout errors; collector inclusion and zero retry
arguments remain asserted.

Six actual audit-CLI invocations use controlled npm responses: clean graph/audits pass; production
findings, unknown findings with an empty policy, malformed JSON, transport-error JSON and a bad peer
graph each retain exit 1. These synthetic responses are isolated test controls, not the retained live
registry results. AST inspection verifies the strict gate remains in both full and checks profiles.
The actual CI shell, invoked with a controlled failing npm child, forwards the literal checks/service
arguments and retains exit 42. The existing Verify aggregate still rejects failed/skipped/canceled
jobs. PR-only comprehensive CI, independent Pages deployment, shards and zero browser retries are
unchanged; no extra main-push run or verification wrapper is introduced.

After private acceptance, assertion-only refinements require no repeat installation or audit:
allow separate compatible physical TypeScript copies while requiring matching versions, and assert
the remaining collector inclusion/transport cases. The final 23 affected tests and ESLint pass.
The final CI check inspects conditions, awaited calls and literal arguments structurally, not by
statement-text matching; its five affected cases pass. Unchanged resource controls are reused from
the 40-check run. Expected cleanup-failure diagnostics
inside resource negative tests do not indicate an unsuccessful private-run cleanup.

Actual artifacts are retained under
`test-results/verification/1f75b500-9bff-4260-9019-f3018b41818f/`: `graph.json`, `production.json`,
`full.json`, `audit-result.json` and `summary.json`. The summary reports successful cleanup. All
owned private installations, nested test fixtures and recorded process groups are removed; no
database, attachment store or application server was provisioned. The working installation/data,
policy dates, lockfile, app/SQL source, CI workflow and public-site assets are untouched.

Reuse the completed Phase 5 Angular and Phases 6-7 generation/data/API/runtime evidence. No Angular,
API/contracts, schema-generation, database-upgrade, browser, rendered-site, build or timing suite was
rerun for this gate-only phase. A cheap static site/link check and whitespace validation cover the
documentation completion. Conditional Phase 9 remains deferred; fresh setup/documentation and the
actual versioned release boundary remain in Phases 10-11. Nothing was committed, tagged or pushed.

## Phase 9: Conditional CI Efficiency

Closed as **Deferred**, October 18, 2026, from clean commit
`1e7590f99428f258b4aa5637e2b56a2f13a408da` on `v0.3.1`. This is the explicit acceptance path
allowed by the plan, reaffirming the Phase 0 scope decision. No CI optimization was implemented
and no measured speedup is claimed. Release identity remains `0.3.0`.

The completed remediation and preservation work does not automatically reopen the optional
shard-balancing effort. Finish the remaining setup/documentation and versioned release acceptance
without adding another executable change boundary. The historical 39-of-60 journey distribution
is only an investigation input; this phase collects no comparable post-migration per-job,
setup, critical-path or total-runner-cost measurements.

Read-only configuration inspection confirms the existing PR trigger, three application shards,
disabled matrix fail-fast, one worker and zero retries remain in place. Reuse Phase 8's passing
CI/gate controls rather than executing them again for unchanged configuration. No workflow,
application/test source, dependency/lockfile, assertion, fixture ownership, timeout, caching or
build-artifact behavior changed. Only this note, the implementation plan and dependency disposition
are edited. No installation, audit, Angular/API/contracts/browser suite, timing run, database or
server was started; no resources require cleanup.

Documentation consistency, local links and `git diff --check` pass. A separately scoped future
efficiency effort must measure a current baseline, preserve serial fixture ownership, prove exact
discovery coverage, exercise moved groups in isolated resources and compare runner cost as well
as wall-clock time. Phase 9 has no remaining work for v0.3.1; Phases 10-11 remain pending. Nothing
was committed, tagged, pushed or changed remotely.
