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

The working graph still has its original bounded exceptions until implementation retires them. A private clean candidate is not permission to change the policy early or claim the release is ready. Phase 9 shard balancing is deferred; no extra utilization/performance runs are needed for that non-change.
