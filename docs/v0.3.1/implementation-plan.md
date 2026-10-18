# Worktrail v0.3.1 Implementation Plan

## Status

Implementation baseline: October 18, 2026. Phases 0-3 are complete; required implementation phases 4-8 and 10-11 have not started. Conditional Phase 9 is deferred by the Phase 0 scope decision.

This plan implements the [PRD](prd.md) and [technical design](technical-design.md). The [dependency disposition](dependency-remediation.md), [verification notes](verification-notes.md), and [Phase 0 evidence](phase-0-evidence.json) record the selected versions, proofs, and inventories. [Phase 1 evidence](phase-1-evidence.json) records the implemented Angular foundation; [Phase 2 evidence](phase-2-evidence.json) maps the shared/core conversion and retained coverage. [Phase 3 evidence](phase-3-evidence.json) records discovery/workspace conversion, focused acceptance, and controlled negative probes. SQL history and release identity remain unchanged.

The separately requested PR-only CI change is already in the working tree. Preserve it and its focused regression test; it is not unfinished feature scope to reimplement. Package/release identity remains `0.3.0` until closeout.

## Purpose

Retire the five bounded development advisory exceptions without losing behavior, meaningful regression coverage, or compatibility with existing data. The work has two owner boundaries: Angular build/test tooling and Drizzle schema/runtime tooling. CI efficiency is conditional; it must not displace remediation.

Angular conversion is split into infrastructure, three spec groups, and final cutover. Drizzle adoption and broader data/transaction preservation have separate phases. This keeps each implementation request reviewable without assuming that a large test suite or migration-format change is a single package update.

## Execution Rules

- Execute the requested phase in sequence. Update its status and record concrete evidence; do not mark future phases complete because a proof exercised part of their scope.
- Phase 0 includes bounded proofs in private installations and owned resources because feasibility determines whether this sprint can meet its release requirement. It is not a production migration or permission for broad application edits.
- Preserve existing user changes, including the PR-only workflow edits and planning documents. Do not stage, commit, push, merge, tag, publish, or change repository settings unless separately requested.
- Keep Node 24/npm 11 and the selected Angular 21/TypeScript 5.9 baseline unless compatibility evidence requires an explicit design revision. Never use forced peers or a moving prerelease tag to obtain a passing installation.
- Keep production change detection Zone-based, routes lazy, API/contracts boundaries unchanged, and bundle/style thresholds unchanged. No new feature or domain-schema change is planned.
- Do not replace historical SQL, truncate a migration ledger, reset working data, or treat successful compilation as data-preservation evidence.
- Run checks for the changed boundary and affected consumers. A phase boundary is not a reason to repeat all suites. Broad verification belongs at completed toolchain boundaries and release closeout.
- Record command, source/lock identity, selected scope, outcome, resource ownership/cleanup, and any omitted checks. Omitted checks are not passed checks. Diagnostic reruns remain distinct from clean acceptance evidence.
- Keep independent CI failure reporting, zero browser retries, and observable readiness. No fixed sleeps, assertion weakening, or deadline ratcheting to hide nondeterminism.
- Retire advisory records only after remediation; preserve their original dates/version boundary. New or changed vulnerable paths require explicit disposition, not automatic allowlist generation.
- If a required compatibility gate fails, stop dependent implementation and report the actual choice needed. Do not silently renew risk acceptance or relabel an incomplete release.

## Phase Overview

| Phase | Deliverable | Status |
| --- | --- | --- |
| 0 | Baseline, private feasibility proofs, and decision closure | Complete |
| 1 | Angular 21 foundation and staged Chromium test execution | Complete |
| 2 | Shared utilities, core clients, and navigation spec conversion | Complete |
| 3 | Work discovery, saved views, and workspace spec conversion | Complete |
| 4 | Work detail, Planning, and historical workflow spec conversion | Not started |
| 5 | Single-runner cutover, owned lifecycle, and Angular acceptance | Not started |
| 6 | Proven Drizzle adoption and historical metadata conversion | Not started |
| 7 | Upgrade preservation, transactions, and API compatibility | Not started |
| 8 | Combined clean dependency graph and audit-gate acceptance | Not started |
| 9 | Measured E2E shard balancing, if capacity permits | Deferred in Phase 0 |
| 10 | Developer guidance, setup acceptance, and release documentation | Not started |
| 11 | Version identity, final verification, and closeout | Not started |

Phases execute sequentially. Phase 0 must establish a viable path for both owner graphs before Phase 1. Phase 9 may be explicitly deferred with a reason and no loss of primary release scope. A required failed gate cannot be treated as a conditional deferral.

## Resource And Evidence Rules

Use the existing owned verification modules, manifests, database comments/nonces, marked attachment roots, selected ports, and registered process identities. Default to disposable PostgreSQL 16 in Docker. Service mode requires explicit provisioning access and a separate owned database, never the ordinary `worktrail` database.

Candidate installations use private checkouts with their own `node_modules` and candidate lockfile. Normal verification's read-only dependency mirror must not be reused with a different lockfile. Include the relevant uncommitted source/configuration in the candidate snapshot; a clean Git revision alone does not represent this working tree.

Reuse existing resource owners for proofs. If a proof needs two databases, provision two marked resources and validate each before mutation and cleanup. Do not grant authority through a guessed local URL or an environment flag alone. An occupied port is not permission to terminate its owner.

Retain sanitized evidence outside disposable resources. Create `docs/v0.3.1/verification-notes.md` and a dependency disposition/evidence record during execution, not as fictional completed results in this draft. Preserve v0.3.0 documentation as historical evidence.

If Docker or explicit provisioning access is unavailable, finish the inspection work and report the prerequisite. Do not substitute the working database or mark the proof complete. Cleanup must cover success, failure, partial startup, and interruption; abandoned resources require validated cleanup.

## Staged Angular Conversion

Phases 1-4 must not leave the normal test command silently ignoring converted or unconverted specs. Use a short-lived, explicit partition between the legacy Karma target and the new Angular/Vitest target, then remove the partition in Phase 5.

Phase 0 confirms the smallest workable implementation of this partition. The default is a small manifest of migrated spec paths, used to produce complementary builder selections and separate test TypeScript scopes. The legacy target owns remaining specs; the new target owns migrated specs. Keep filenames and production imports stable rather than renaming every spec for discovery.

Validate discovery against the actual repository: every intended spec belongs to exactly one runner, no listed file is missing, and no new file is unclassified. Keep Jasmine and Vitest types isolated, not both ambient in a common spec configuration. The ordinary web test command and the owned web profile must execute every nonempty partition and return failure if either fails. Collect independent runner failures before returning an unsuccessful result; do not run the partitions concurrently merely to reduce elapsed time.

This is migration scaffolding, not a fallback that retries a failing Vitest test through Karma. Do not duplicate application state, create a general test-selection framework, or leave the vulnerable runner in the final graph. If the partition cannot preserve these properties, revise the staging plan before conversion rather than accepting an incomplete green suite.

Focused phase checks execute only the converted group and affected shared consumers. They do not require rerunning the unchanged legacy partition after every spec edit. Full discovery validation remains cheap and applies whenever ownership changes.

## Phase 0: Baseline And Feasibility

Goal: close the technical choices with representative evidence before broad migrations.

Scope:

- Record branch/commit, tracked/untracked changes, current release identities, lockfile identity, and the existing PR-only CI/Pages configuration.
- Refresh read-only upstream metadata, production/full audits, dependency owners, and exact affected paths. Distinguish fresh measurements from the recorded v0.3.0 baseline.
- Confirm exact candidate versions from the design or select compatible patches with a documented reason. Recheck for an owner-supported stable Drizzle fix before evaluating the pinned RC pair.
- Inventory web specs into the Phase 2-4 groups, including shared test dependencies, fake timers, router/HTTP behavior, browser globals, fixture cleanup, and any existing disabled/focused tests. Establish a coverage baseline rather than a count quota.
- Inventory the migration sequence, SQL hashes, journal identities/timestamps/breakpoints, partial-history tests, runtime persistence capabilities, and schema-generation consumers.
- In a private Angular candidate, prove a valid installation, development/production compilation, representative component/HTTP/router/draft/debounce/DOM specs, matching Zone-based TestBed scheduling, and owned Chromium startup/failure/interruption on the host and Linux execution model.
- Prove the temporary runner partition on representative files, including disjoint discovery, type isolation, and combined failure reporting. Do not convert the entire suite.
- In a private Drizzle candidate, prove stable generation, historical SQL identity, fresh migration, recognition of a populated prior-version ledger without replay, idempotent reapplication, and representative query/transaction behavior.
- Audit each candidate and explain any remaining findings from the unchanged owner graph. Establish that the combined proposed graph has a credible clean path; do not call a partial graph clean.
- Record deliberate prerelease adoption or rejection, supported upgrade/rollback posture, and any product-owner decision required. Estimate remaining conversion effort and reserve or defer Phase 9.

Out of scope: broad application/spec conversion, committed dependency or migration changes, working-data access, exception renewal, release identity, and full regression suites unrelated to the proofs.

Acceptance:

- Exact candidate versions, runner setup, staging approach, and schema-tooling path are recorded with their evidence.
- Both owner graphs have passed their representative feasibility gates; no unsupported ledger rewrite or invalid peer graph is assumed away.
- The adopted RC risk, if any, is explicit. A failed safety requirement is escalated before Phase 1 rather than hidden in later work.
- The conversion inventory maps every existing spec to a later group and names the preservation regressions needed for Drizzle.
- Proof resources are cleaned up or explicitly retained under validated ownership for a documented diagnostic reason.

Verification: scoped private install/graph/audit checks, representative Angular/build/lifecycle proofs, disposable generation/migration/query proofs, and document consistency. No automatic full Angular/API/E2E run.

Status: Complete (October 18, 2026).

### Completion Evidence

- Baseline: branch `v0.3.1`, commit `df9710d8c9f736f5c7f8ec6632ab58b3e68cdbbf`; preserve the four pre-existing tracked CI/documentation edits and untracked sprint documents. Root/API/web/contracts identity remains `0.3.0`.
- Baseline installation is peer-valid, with zero production findings and the same 13 full findings/five advisory IDs. The working lockfile and application sources remain unchanged.
- Confirm Angular runtime/compiler `21.2.25`, CLI/build `21.2.27`, CDK `21.2.14`, angular-eslint `21.4.0`, TypeScript `5.9.3`, Vitest/provider `4.1.12`, and Playwright `1.61.1`. Bind root tooling/framework peers explicitly and require one Angular runtime identity; see the disposition for rejected graphs.
- Inventory all 70 web specs: 24 in Phase 2, 29 in Phase 3, 17 in Phase 4. Five files use Zone clock helpers; none contain focused/disabled tests. The evidence lists every path and its baseline hash.
- Prove a 3-migrated/67-legacy partition with separate type scopes and complete/disjoint discovery. An intentionally failed Vitest invocation did not prevent the independent two-test Karma selection from executing; aggregate acceptance remained false.
- Pass 19 focused prototype checks on macOS and Linux, including 17 converted existing tests and two prototype harness checks. These are not a full-suite acceptance result. Development/production compilation passes, with 410.31 kB production initial assets and unchanged budgets.
- Confirm explicit Zone-based TestBed scheduling, controlled Quick Find debounce, actual routing/draft guards, HTTP tests, native focus, failure exits, and watch interruption cleanup. Linux diagnostics require `--init`; no waits or retries were raised.
- Select the exact Drizzle Kit/ORM `1.0.0-rc.4` pair after confirming stable Kit still retains the vulnerable loader. Accept the documented prerelease maintenance risk only for the proven migration path; broader runtime acceptance remains Phase 7.
- Preserve all 20 historical SQL hashes and the original ledger IDs/hashes/timestamps. Prove owner-supported ledger augmentation, populated-state/attachment-byte preservation, fresh schema equivalence, idempotent migration, select/count, row locking, write rollback, and repeatable-read behavior.
- Resolve generation drift through 23 reviewed terminal-snapshot expression fields only. PostgreSQL catalog comparison proves equivalence; two subsequent generation runs leave the entire inventory unchanged. No domain DDL is adopted.
- A separate fresh cutover installation without Karma/Jasmine passes peer validation and both audits with zero findings. This is feasibility evidence, not remediation of the unchanged working graph.
- Defer Phase 9. Framework/test conversion and prerelease schema/runtime adoption already consume the maintenance scope; the approved PR-only CI improvement remains intact without adding another optimization workstream.
- Private installations, owned databases/containers, temporary browser binaries, and proof processes are removed after retaining sanitized evidence. No working database reset, version bump, commit, remote CI run, or publication occurred.

## Phase 1: Angular Foundation And Staged Execution

Goal: introduce the proven Angular 21 toolchain and a safe path for incremental spec conversion.

Scope:

- Apply reviewed owner migrations and selected Angular/CDK/compiler/build/angular-eslint versions, preserving Node/npm/TypeScript, application scheduling, lazy loading, and current budgets.
- Carry forward Phase 0's root peer constraints and single-Angular-runtime check; a graph can be peer-valid while resolving incompatible Angular instances for the app and icon package.
- Introduce the new unit-test target, matching Vitest/browser provider dependencies, small provider/setup files, and focused file/name selection using the selected builder's actual options.
- Implement the minimal temporary partition from Phase 0. Keep legacy and migrated spec types/configuration isolated, and ensure ordinary/owned test entry points cover both nonempty partitions.
- Convert the small representative proof set as necessary to exercise real committed consumers. Map these files to their eventual Phase 2-4 groups so they are not converted twice.
- Adapt `scripts/verify.mjs` and supporting tests to recognize the staged web execution without granting new database authority or weakening process/port ownership.
- Remove only genuinely resolved Vitest 3/Tinypool exception records. Retain the still-used Karma advisory accurately, including reviewed shared parent records; do not broaden exceptions to absorb a new finding.
- Replace obsolete exact baseline pins in audit tests with valid intermediate invariants and preserve negative graph tests.

Acceptance:

- Clean installation and peer validation pass on the selected versions without force flags.
- The application builds in development/production with the same scheduling and unchanged budget thresholds.
- Test discovery is exhaustive/disjoint and a deliberate failure in either partition produces a failed ordinary/owned invocation without hiding the other independent result.
- The legacy suite remains executable under the new framework, and the committed representative Vitest specs pass in Chromium.

Verification: graph and audit disposition, relevant configuration/runner Node tests, web lint/type/build checks, representative Vitest tests, and one complete legacy run because its framework changed. No API/database suite for an Angular-only change.

Status: Complete (October 18, 2026).

### Completion Evidence

- Install exact Angular runtime/compiler `21.2.25`, CLI/build `21.2.27`, CDK `21.2.14`, angular-eslint `21.4.0`, TypeScript `5.9.3`, Vitest/browser provider `4.1.12`, and Playwright `1.61.1`. Clean `npm ci` and installed-peer validation pass without forced peers or overrides. Root peer bindings and an app/icon runtime-identity check preserve the proven graph.
- Review core/CLI owner migrations for the specified Angular 20-to-21 ranges in a private snapshot; neither changes application files. Keep production Zone scheduling, lazy routes, and all budget thresholds unchanged.
- Add the `test-vitest` target and explicit Zone-based TestBed providers. A short-lived manifest partitions 71 files into 67 Karma and four Vitest files; separate editor/compiler scopes are checked against actual discovery before execution.
- Convert display helpers, attachments HTTP client, and real-router draft coordination: all 17 existing tests remain. These three files belong to Phase 2 and must not be converted again. Add one real Quick Find component/debounce/icon/focus regression, rather than retaining the prototype assertion-control test.
- Share owned execution between ordinary web tests and `verify` without nesting snapshots. Use serial partitions, assigned loopback ports, isolated outputs, independent failures, literal file selection, and Vitest name filtering. Reject missing/empty/cross-runner selections, including a name pattern that skips every test. Keep the staged wrapper non-watch; live watch/debug integration remains Phase 5 work.
- Pass 26 focused Node checks for discovery, type isolation, invalid selections, independent runner failure, interruption/cleanup stopping, audit policy, peer validation, snapshot lock ownership, and unchanged PR-only CI behavior. Verification-config typing and focused runner lint pass.
- Pass `npm run verify -- --mode=web`: frontend lint, development build/typecheck, 870 tests across all 67 legacy files, 18 tests across four Vitest files, and production build. Production initial assets are 410.31 kB, with no budget warnings. After small wrapper/report refinements, rerun only affected Node/type/lint and focused Vitest checks, not the unchanged legacy suite/builds.
- Deliberately fail each partition through both ordinary and owned entry points using two tiny selected files in disposable snapshots. All four cases fail acceptance, retain the independent other result, and remove owned resources. A nonexistent test-name pattern also fails rather than becoming a green skipped run.
- Retire the three Vitest/Tinypool advisory exceptions. Production audit remains zero; full audit has ten exact records under the two retained Karma and Drizzle advisories. Review the hoisted development-only `node_modules/@angular/build` parent at `21.2.27`; original policy dates/version boundary remain unchanged.
- Update current README/developer guidance and retain sanitized evidence. No backend/database/E2E/editor/site suite, working-data access, production application edit, release bump, commit, or remote workflow run is included in this phase.

## Phase 2: Shared And Core Spec Conversion

Goal: migrate the foundations that other component tests depend on.

Scope:

- Convert shared display/query-independent utilities, clipboard/download/navigation helpers, delivery-health/cycle display policies, and authored-content parser/validation/link/viewer/editor unit specs.
- Convert core API clients, HTTP/error behavior, authorized context, page context, draft departure coordination, application shell, and route configuration specs.
- Preserve actual route/actor transitions, stale-response ownership, explicit mutation behavior, draft Stay/Discard, and unload warning assertions.
- Replace Jasmine spy objects/matchers with typed Vitest doubles/imports; retain property/observable behavior and teardown. Keep HTTP response `flush` distinct from Zone clock helpers.
- Update the partition and coverage map. Restore timers, mocks, descriptors, and fixtures on all outcomes.

Acceptance:

- All assigned core/shared specs execute under Vitest with equivalent or stronger failure conditions.
- Native DOM-dependent assertions remain in Chromium; no generic emulation shim or Jasmine compatibility layer is added.
- No spec disappears from discovery and no production refactor is hidden in test conversion.

Verification: converted files, affected shared consumers, applicable lint/spec typing, and partition checks. Run focused native-editor checks only if editor implementation/harness behavior changes; otherwise reserve that unchanged harness for Phase 5. Do not rerun unrelated API, site, or full legacy suites.

Status: Complete (October 18, 2026).

### Completion Evidence

- Convert the 21 remaining assigned files to explicit Vitest imports and typed doubles. Retain the three Phase 1 conversions unchanged. All 24 Phase 2 files now run in Chromium under the existing Zone-based TestBed providers.
- Preserve all 314 existing registered cases: 80 app/core, 175 authored-content, and 59 other shared/display/navigation cases. Compare test definitions, literal parameterization loops, and assertion-site counts against the phase-entry Git revision; none are added, removed, merged, focused, or disabled. The coverage map records each file and before/after hashes.
- Preserve real-router cancellation/reuse, actor A-to-B-to-A invalidation, authorized project identity, submitted writes, HTTP headers/bodies/cancellation, draft Stay/Discard/unload protection, clipboard/download behavior, and native editor/viewer selection/focus/IME/security/reflow assertions. Keep HTTP response `flush` unchanged; no Jasmine compatibility layer or DOM emulation is introduced.
- Restore prototype/property/browser spies explicitly, tear down editor/viewer fixtures, remove the temporary download anchor even after assertion failure, and clear actor storage. A controlled clipboard-start promise plus zero-time fake-clock draining replaces a guessed number of promise turns in the old-report completion regression; timers/mocks are restored in `finally` cleanup.
- Prove that regression detects a real failure: remove only the clipboard finalization identity guard in an owned disposable source snapshot. The selected case fails because the old report incorrectly clears the new copy's pending state; the working production source remains untouched.
- Update the manifest and separate TypeScript scopes to 25 Vitest / 46 Karma files, covering all 71 discovered specs exactly once. All 46 later-phase specs retain their Phase 0 hashes; no file is silently excluded.
- Pass `npm test --workspace @worktrail/web -- --runner=vitest`: the complete converted group plus the unchanged toolchain regression, 315 cases across 25 files. Pass seven focused runner/discovery tests, both Vitest/Jasmine spec typechecks, and affected core/shared/app lint. The passing run removes its owned snapshot/processes.
- Deliberately omit the full legacy suite, app builds, dependency/audit refresh, API/database/E2E/editor/preview/setup/site suites. Their application/toolchain inputs are unchanged; native-editor harness acceptance remains Phase 5. Dependency/security policy, budgets, production sources, release identity, and CI triggers are unchanged.

## Phase 3: Discovery And Workspace Spec Conversion

Goal: preserve the find/filter/select workflows under the new runner.

Scope:

- Convert work-query serialization/parity/filter descriptors, query/saved-view/bulk stores, filter/result/pagination controls, saved-view controls, project/workspace work lists, and board specs.
- Convert Quick Find navigation/session/dialog/search, My Work, Inbox, Portfolio, workspace settings, project list, and project-shell/navigation specs.
- Preserve applied versus draft filter feedback, query/URL round trips, view ownership/pinning, explicit bulk selection, board status/movement, actor/project scope, and archived/read-only behavior.
- Convert debounce/cancellation tests to native async and controlled clock advancement. Assert stale success/error rejection and actual expected content after rendered readiness.
- Update partition ownership and document any merged/replaced coverage.

Acceptance:

- Every assigned discovery/workspace spec runs under Vitest and retains its query, permission, navigation, and error assertions.
- Tests do not use real sleeps, broadened polling, or retries to reproduce the previous runner's timing.
- The partition remains complete and disjoint.

Verification: converted files plus affected shared consumers and lint/type checks. Run an affected application browser journey only where a production/configuration behavior changed or unit evidence cannot establish parity; do not automatically rerun every E2E shard for assertion-syntax changes.

Status: Complete (October 18, 2026).

### Completion Evidence

- Convert all 29 assigned discovery/workspace specs to explicit Vitest imports, typed gateway/clipboard/dialog doubles, equivalent matchers, and explicit mock restoration. Preserve all 345 existing cases, their registration loops, assertion sites, HTTP response arguments, and logical-clock advancement sequence; no cases are added, dropped, merged, focused, or disabled.
- Preserve applied versus pending filters and chips, query/URL/HTTP/copy/saved/pinned parity, per-view permissions and identity, visible-only bulk selection, archived/read-only access, complete boards and optimistic movement/rollback, actor/project changes, notification state, Portfolio/My Work data, and native Quick Find keyboard/focus/navigation behavior.
- Replace Zone `fakeAsync`/clock helpers in Quick Find and both work-list specs with native async tests and controlled Vitest clock advancement. Preserve the actual 220 ms debounce boundary, 400 ms pending-search proof, zero-time focus/promise checkpoints, and 2,500 ms copy-feedback expiry. My Work freezes `Date` only. Retain `TestBed.tick()` in Inbox: it flushes Angular effects, not elapsed fake time.
- Destroy fixtures before restoring clocks, restore property/prototype/native spies, and remove test-owned section/trigger DOM nodes on failures as well as success. Delegate the native Intl constructor spy explicitly so real formatting retains its internal slots; do not stub formatting or weaken the UTC assertions.
- Update the manifest and isolated editor/compiler scopes to 54 Vitest / 17 Karma files, covering all 71 discovered specs once. Earlier converted specs and all 17 Phase 4 specs remain unchanged.
- Pass the focused 33-file Chromium selection through the shared owned runner: 345 Phase 3 cases plus 46 affected shell, page-context, draft-departure and toolchain cases, 391 passed with no skipped tests or retries. The evidence lists reproducible literal file selections and input hashes. Only two surplus EOF blank lines change after acceptance; no functional edit requires a rerun.
- Pass both Vitest/Jasmine spec typechecks, affected-spec ESLint with zero warnings, seven runner/discovery/type-scope/ownership checks, and whitespace validation.
- In separate owned snapshots, deliberately expose pending query values as applied state and change Quick Find's debounce to 221 ms. Each selected regression fails at the intended behavioral assertion, and both snapshots/process sets are removed. These are expected negative proofs, not acceptance failures or working production edits.
- Keep verification proportional: do not rerun every previous Vitest spec, the remaining Karma suite, API/database/E2E/editor/site/setup/preview checks, app builds, or dependency audits/installation for test-only changes. Native component coverage establishes parity here; final single-runner/lifecycle acceptance remains Phase 5. No production source, dependency, Zone provider, budget, SQL, advisory deadline, release identity or CI trigger changes.

## Phase 4: Detail And Planning Spec Conversion

Goal: complete the remaining complex page and historical workflow tests without reducing coverage.

Scope:

- Convert work-item detail/unavailable, attachments, parent/child components, and remaining record-action specs.
- Convert Planning, cycle/milestone management and review, closeout, and status-report list/draft/detail specs.
- Preserve repeated-route navigation, draft ownership, submitted writes, clipboard/download behavior, attachments, dependency/hierarchy links, cycle outcomes, historical snapshot rendering, and report publication guards.
- Review browser property spies, focus/overlay behavior, request ordering, fake timers, and teardown explicitly rather than mechanically translating until green.
- Reconcile the complete Phase 0 inventory, including representative files converted earlier. Resolve conversion TODOs and investigate any disabled/focused tests rather than carrying them into required acceptance.

Acceptance:

- Every intended web spec belongs to the migrated partition; the legacy partition is empty.
- Coverage mapping explains changed test counts and preserves the regression conditions of replaced cases.
- No Jasmine/Zone-test-helper dependency remains in migrated specs; production Zone scheduling is unchanged.

Verification: this group's specs, affected shared consumers, lint/spec typing, discovery reconciliation, and targeted browser evidence for any actual behavior change. Full single-runner integration belongs to Phase 5.

## Phase 5: Single Runner And Angular Acceptance

Goal: finish the Angular owner boundary and remove migration scaffolding and vulnerable consumers.

Scope:

- Make the standard web test target solely Angular/Vitest/Chromium. Remove the legacy target, temporary partition/orchestrator, obsolete TypeScript scopes, Karma/Jasmine packages/types, and custom Karma launcher after the inventory proves no consumers remain.
- Retain `test:web`, focused local selection, watch/debug separation, and readable failure output through the single final entry point.
- Finalize runner-owned loopback endpoints, ports, isolated browser contexts/output, child-process tracking, and interruption/abandoned-run cleanup. Remove obsolete Karma environment/manifest fields without weakening validation.
- Verify the lockfile no longer contains the carried vulnerable Angular test graphs. Retire the remaining Angular-related exception entries in the same coherent change.
- Update target audit/CI tests for the adopted runner and preserve PR-only triggers, independent failure reporting, and Pages deployment.

Acceptance:

- Ordinary and owned web commands discover/run the complete intended suite under one runner.
- A failing spec and interrupted run fail/clean up correctly without attaching to or stopping unrelated processes.
- The full web profile, native editor, relevant application journeys, and compiled preview preserve the Angular behavior/build boundary.
- All four carried Angular-related advisories are retired from the actual graph. Remaining Drizzle risk, if present, is reported separately and remains within its original policy.

Verification: clean graph/audit checks, focused runner/ownership/CI tests, complete web profile, native-editor harness, relevant E2E journeys, compiled preview, and browser lifecycle checks on the host/Linux model. Reuse Phase 4 evidence only where the executable setup is unchanged; do not rerun the entire API suite for this Angular-only boundary.

## Phase 6: Drizzle Adoption And Metadata

Goal: apply the proven schema/runtime toolchain without rewriting application history.

Scope:

- Reconfirm the Phase 0 selection; prefer an acceptable stable fix if one became available. If changing the candidate, repeat its affected proof before applying it.
- Apply the exact selected Kit/ORM pair and minimal required config/schema/driver/type/migrator changes. Pin any prerelease explicitly and keep its adoption decision visible.
- Use the owner-supported metadata/layout conversion in an owned checkout. Preserve historical SQL bytes, order, identities/timestamps, breakpoint semantics, and the documented prior-ledger mapping.
- Apply the proven explicit `{ client: pool }` driver construction and API-local contract path mapping. Review the 23 terminal-snapshot expression normalizations against the evidence, preserving snapshot IDs/ancestry and all SQL bytes; reject other drift rather than adopting redundant generated DDL.
- Adapt partial-history migration tests to the equivalent semantic ranges, not just fresh-install behavior.
- Preserve guarded `db:generate`/`db:migrate` entry points and complete recursive inventory checking. Stable generation must not exclude new metadata or emit domain DDL for an unchanged schema.
- Update generation/migration helper tests for additions, deletions, modified SQL/metadata, generator failures, and unsupported inventory entries.
- Retire the resolved Drizzle exception records with the owner change. Do not leave stale entries or alter the original deadline.

Acceptance:

- The adopted graph is valid and no carried vulnerable loader path remains.
- Reviewed conversion preserves SQL/history invariants; no new application schema change is introduced.
- Generation is stable across two runs, fresh migration works, a prior-version ledger is recognized without replay, and reapplication is a no-op.
- Required repository/persistence interfaces still typecheck, and representative runtime queries/transactions pass.

Verification: clean install/graph/audits, API lint/type/build checks, schema helper/partial-history tests, two generation checks, fresh and minimal populated upgrade proofs, and representative query/transaction tests. No full Angular rerun for a backend-only change.

## Phase 7: Data And Transaction Preservation

Goal: establish broader upgrade and persistence compatibility on the implemented toolchain.

Scope:

- Turn the Phase 0 proof into reproducible owned fresh/prior-version verification using independent installations and databases; never seed or reset the upgrade target after baseline capture.
- Preserve and compare representative record values/relationships, saved views, authored source/formats, historical closeout/report snapshots, attachment references, and attachment byte hashes.
- Compare the fresh and upgraded application schema, including constraints, indexes, and required extensions, separately from intentional migration-metadata/ledger changes.
- Exercise current-state/row locking, project/cycle coordination, rollback, read-only repeatable-read hydration, executor/scope lifetime, and existing query-count/performance bounds.
- Verify the compiled API and ordinary read/write behavior, not only schema loading. Document the supported upgrade and rollback/backup posture.

Acceptance:

- Fresh and prior-version paths produce compatible application schemas and preserve the captured populated state.
- Historical migrations are not replayed; migration reapplication leaves ledger and data unchanged.
- Runtime transaction/isolation/concurrency and historical parser contracts remain intact.
- Cleanup touches only owned resources and preserves evidence outside their roots.

Verification: API/contracts lint/type/build/tests, fresh/upgrade and attachment-preservation checks, relevant schema/resource lifecycle tests, and the backend/tooling verification profile where applicable. This phase warrants the full API suite if the runtime ORM changed; it does not warrant unchanged Angular/site suites.

## Phase 8: Combined Graph And Audit Gate

Goal: establish the final dependency disposition without weakening security verification.

Scope:

- Perform a private clean install of the combined adopted tree and validate physical peers, both structured audits, and absence of the five carried advisory paths.
- Confirm the development exception list is empty while original policy dates/boundary remain intact. Keep the v0.3.0 record historical; write this sprint's actual before/after evidence separately.
- Preserve negative tests for invalid peers, unknown/stale/duplicate records, production findings, expiry/version boundaries, malformed reports, transport failures, and snapshot/installation lock mismatch.
- Replace intermediate/staging pins with positive final-toolchain invariants. Do not make tests depend on an exact transitive layout where the intended invariant is compatibility or advisory removal.
- Check that local/full/CI profiles still invoke the strict gate and no new wrapper masks nonzero exits.

Acceptance:

- Production and full-workspace audits report zero findings and the installed graph is valid.
- All five carried exceptions are retired for actual remediation, not omitted scope or renamed records.
- Gate tests accept the clean case and reject the unsafe/error cases. No dependency force/override or exception renewal was used.

Verification: private install/graph/audits and focused audit/CI/resource tests. Reuse unchanged Angular/database acceptance evidence; no complete application run solely because exception documentation changed.

## Phase 9: Conditional CI Efficiency

Goal: reduce measured imbalance only if remediation has left capacity for a reliable improvement.

Status: Deferred in Phase 0. No test redistribution or additional timing runs are required under the current scope. Revisit only through an explicit plan update after primary remediation is complete.

Scope if included:

- Record current per-job/setup/test/critical-path duration and total runner cost from comparable runs. Treat the historical 39-of-60 journey imbalance as an investigation input, not a current timing guarantee.
- Inspect serial groups and setup/teardown before splitting the large E2E file into independent scenario groups.
- Preserve three runners, one worker per mutable fixture, owned database/storage isolation, all assertions, zero retries, and independent failure collection.
- Prove the union of shard discovery matches the intended full journey set exactly once, and every moved group can execute from a fresh owned seeded context.
- Compare timings without an arbitrary runtime SLA or a flaky timing test. Record cold-cache/setup effects and total utilization, not just the fastest wall-clock result.

Acceptance:

- Either a measured, correctness-preserving improvement is implemented, or the phase is explicitly marked Deferred with its rationale.
- No shared-state parallelism, sleeps, retries, reduced assertions, or post-merge comprehensive CI is introduced.
- Broader build caching, compiled-app E2E conversion, and runner redesign remain deferred unless a separately reviewed design change is justified.

Verification if included: focused CI/discovery tests, moved groups and affected shards in isolated resources, cleanup checks, and comparable timing evidence. If deferred, document checks only; do not run browser suites to prove a non-change.

## Phase 10: Documentation And Setup Acceptance

Goal: make the adopted toolchain usable and communicate its limits accurately.

Scope:

- Update README/development guidance with actual runtime/install/browser prerequisites, standard/focused/watch test commands, and owned verification boundaries.
- Document generator/migration metadata changes, prior-version upgrade actions, rollback/backup requirements, exact version choices, and the prerelease disposition if applicable.
- Update current known limits and dependency disposition to reflect resolved risk, while preserving dated historical evidence and avoiding a claim that zero audit findings means no vulnerabilities exist.
- Update only inaccurate release/technical information on the public site; no product redesign or invented capability is part of this maintenance release.
- Record reusable maintenance/testing lessons without tying them to a separate framework project.
- Verify a fresh developer setup and the documented existing-installation path in owned resources. Reuse Phase 7 evidence where the same documented commands/tree were already exercised.

Acceptance:

- Documentation matches implemented commands and risks; no Karma instructions or expired-advisory claims remain in current guidance after retirement.
- A fresh install/development start and compiled-preview path work with the documented prerequisites; any required upgrade action is explicit.
- PR-only CI and separate Pages behavior are clearly described. Documentation does not imply branch protections or remote settings were changed locally.

Verification: Markdown/local-link/command consistency, relevant site asset/link/render checks only if site inputs changed, and targeted owned setup/start/stop checks where evidence is missing. No routine full Angular/API rerun after prose edits.

## Phase 11: Release Closeout

Goal: verify and document the final `0.3.1` tree against the approved release requirements.

Scope:

- Confirm all required phases have evidence and Phase 9 is either accepted or explicitly deferred. Resolve outstanding regression, preservation, or audit failures before changing release identity.
- Update root/workspace/internal dependency/lockfile release identities and current release-facing metadata consistently. Preserve historical documents and avoid speculative tag/release links.
- Verify the strict audit gate against the actual `0.3.1` identity with an empty exception list; do not move the boundary or renew dates.
- Run broad owned verification on the final versioned toolchain, supplemented by fresh-install/upgrade/lifecycle evidence for boundaries not covered by the normal full profile.
- Record final disposition, versions, commands/results, preservation evidence, budgets, cleanup, any manual validation limits, and the absence or completion of conditional CI work.
- Reuse results only when their executable inputs are unchanged. A version or lock change invalidates graph/install identity evidence; documentation-only completion notes do not require another application run.

Acceptance:

- Clean installation and peer validation pass, production/full audits are zero, and no carried exception remains.
- Relevant unit/integration/browser/native-editor/compiled-preview coverage and production budgets pass on the adopted toolchain.
- Fresh and populated upgrade paths preserve SQL execution identity, records, historical snapshots, and attachment bytes.
- Required CI configuration retains comprehensive PR checks, independent outcomes, and the `Verify` aggregate without a duplicate main-push run.
- Release documentation is accurate, evidence is retained, and owned processes/databases/storage are cleaned up.
- Local readiness does not claim remote CI passed or Pages deployed. Publication, merge, tag, and repository administration remain separate user-controlled actions.

Verification: final clean install/graph/audits, full owned verification, supplemental fresh/upgrade and relevant lifecycle checks, and release metadata/document checks. No automatic rerun of all suites after recording documentation-only results.

## Verification Budget

| Change Type | Default Scope |
| --- | --- |
| Planning or documentation only | Structure, links, references, and diff checks |
| Spec conversion group | Converted specs, affected shared helpers, lint/type checks, discovery completeness |
| Builder/framework change | Representative proof, full affected runner, development/production build and budgets |
| Runner/ownership/CI helper | Focused Node tests and relevant startup/failure/interruption checks |
| Schema/generator metadata | Stable generation, inventory/history comparison, fresh/minimal upgrade checks |
| Runtime ORM/persistence | Full API/contracts acceptance and data/transaction preservation, not unchanged frontend suites |
| Audit policy/disposition | Graph/audits and evaluator tests, not every application journey |
| E2E file redistribution | Discovery union, moved groups/affected shards, isolation and cleanup |
| Final combined release | Broad owned acceptance and missing supplemental compatibility evidence |

Choose checks from executable changes, affected consumers, and risk, not phase number. Record the justification when broadening beyond this table. Preserve meaningful tests and diagnose causal ordering/environment differences rather than making them pass through retries or larger waits.

## Release Traceability

| PRD Requirement | Owning Phases |
| --- | --- |
| Refresh inventory and select a viable supported path | 0, then revalidation at 6 and 8 |
| Retire Angular-related advisories and preserve browser coverage | 1-5 |
| Remediate schema tooling without losing history/data | 0, 6-7 |
| Empty exceptions, clean audits, valid peers, strict gate | 1, 5-6, 8, 11 |
| Reliable local/owned verification and PR-only CI | 0-5, 7-8, 11 |
| Conditional measured CI efficiency | 9 |
| Accurate contributor/product documentation | 10-11 |
| Final behavior, build, installation, and preservation acceptance | 5, 7, 10-11 |

This plan does not treat an upstream compatibility failure as permission to ship with renewed exceptions. If the clean dependency and preservation requirements cannot both be met, present the evidence and alternatives before revising scope or risk acceptance.
