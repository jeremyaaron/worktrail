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
