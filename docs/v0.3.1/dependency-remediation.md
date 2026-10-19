# Worktrail v0.3.1 Dependency Disposition

## Status

Updated through Phase 11 closeout, October 18, 2026. Angular/Vitest cutover, Drizzle adoption, data/API acceptance, independent graph/audit gates and fresh development/compiled-preview setup are complete. The final independently installed `0.3.1` tree passes full local release verification with valid physical peers and zero production/full audit findings. All five carried exceptions are retired without extending original dates or review boundaries. Conditional Phase 9 is closed as Deferred. Remote CI, merge, tag and Pages publication are separate user-controlled steps.

See [structured evidence](phase-0-evidence.json), [verification notes](verification-notes.md), and the [technical design](technical-design.md).
Current [maintenance limits](known-limits.md) and [setup evidence](phase-10-evidence.json) separate
prerelease/operational risk from the retired advisory exceptions. Phase 10 reuses Phase 8's graph/audit
evidence for prose changes; [Phase 11](phase-11-evidence.json) independently installs the versioned lock
and reruns the strict gate and full local profile. No prior install/audit result is relabeled `0.3.1`.

## Owner Graphs

| Installation | Peer Graph | Production Findings | Full Findings |
| --- | --- | --- | --- |
| Working v0.3.0 baseline | Valid | 0 | 13, associated with five advisory IDs |
| Working Phase 1, Angular 21 with staged runners and unchanged Drizzle | Valid; clean `npm ci` | 0 | 10: 6 high Karma records, 4 moderate Drizzle records |
| Working Phase 5, sole Vitest/Chromium runner and unchanged Drizzle | Valid; clean `npm ci` | 0 | 4 moderate Drizzle records, one advisory ID |
| Working Phase 6, exact Drizzle RC pair and converted metadata | Valid; clean `npm ci` | 0 | 0 |
| Independent Phase 8 adopted snapshot/lock | Valid physical peers; clean private `npm ci` | 0 | 0 |
| Independent final `0.3.1` installation/full profile | Valid physical peers; clean private `npm ci` | 0 | 0 |
| Private staged Angular 21/Drizzle RC candidate, Karma retained | Valid after explicit peer bindings | 0 | 6 high, from the retained Karma/braces owner graph |
| Private cutover candidate, Karma/Jasmine removed | Valid; clean `npm ci` | 0 | 0 |

Counts include inherited parent findings. The original private cutover proof established feasibility;
Phases 1-8 implemented and revalidated the combined tree. Phase 11 separately accepts the actual
`0.3.1` identity with full local verification; earlier candidate results retain their original scope.

### Phase 1 Disposition

The installed web Vitest 3/Tinypool 1 paths are gone; all resolved Vitest owners use `4.1.12`.
Retire `GHSA-82fw-gwwq-j7x9`, `GHSA-5gmw-xhrv-c9v3`, and `GHSA-85c8-ppgw-ccpr` only.
The active Karma graph still owns `GHSA-vfj7-8cjw-p6xm`. Its shared `@angular/build` parent is now
`21.2.27` at `node_modules/@angular/build`, still development-only; the remaining five Karma
records and four Drizzle records retain their reviewed physical paths/versions/severities.
Keep `GHSA-67mh-4wv8-2f99` until Phase 6; API/Drizzle declarations and SQL history are unchanged.
Neither expiry nor the `0.3.1` review boundary is extended. The [working policy](../security/development-audit-exceptions.json)
and [Phase 1 evidence](phase-1-evidence.json) distinguish this intermediate accounted graph from a clean release graph.

### Phase 5 Disposition

Remove Karma/Jasmine only after all 71 intended specs have migrated. The reviewed lock update removes
101 packages without adding packages or changing retained versions. The actual clean installation
and production/full audits establish that the Karma/braces graph and all carried Vitest 3/Tinypool 1
graphs are gone. Retire `GHSA-vfj7-8cjw-p6xm`; all four Angular-related advisory IDs are now resolved.
The full graph still has four moderate records associated solely with `GHSA-67mh-4wv8-2f99`.
Its exact paths, mitigations, expiry and review boundary are unchanged, as are Drizzle declarations,
API behavior and historical SQL. This is Angular-boundary acceptance, not a clean final release graph.

### Phase 6 Disposition

The exact Kit/ORM `1.0.0-rc.4` pair removes `@esbuild-kit/esm-loader`, its core utilities and
the legacy esbuild `0.18.20` graph. Clean `npm ci`, installed-peer validation and both structured
audits pass with zero findings. Retire `GHSA-67mh-4wv8-2f99`; the working exception list is empty.
The owner update adds its supported Jiti/Temporal/config-loader dependencies; there are no forced
peers, overrides, or unrelated framework upgrades. [Phase 6 evidence](phase-6-evidence.json)
records the lock delta and complete SQL/history mapping. This is not the independent Phase 8 gate.

Owner folder conversion, exactly 23 reviewed terminal-expression normalizations, two stable
generation runs, fresh/repeat migration and minimally populated prior-version ledger adoption pass.
The original ledger's IDs/hashes/millisecond timestamps remain intact. New folder names encode UTC
seconds; the owner's upgrade matches by truncated timestamp, resolving ambiguity/fallback by hash,
then adds names and unknown (`null`) historical application times. No history is reconstructed by
Worktrail, no statements are marked applied by hand, and no redundant domain migration is adopted.
Selected runtime/transaction tests pass; broader populated/attachment preservation and the full API
suite remain in Phase 7. The working/user database is untouched.

### Phase 8 Disposition

The independently installed adopted lock passes the real full-workspace peer graph and strict
production/full collectors/evaluator, with zero findings in either audit and zero active exceptions.
All five original advisory IDs and their vulnerable package/path/version combinations are retired.
Original policy dates (`2026-10-17`, `2026-10-18`, `2026-11-16`) and the `0.3.1` review boundary are
unchanged. No audit-fix downgrade, override, forced relationship, exception renewal or dependency
update was needed. [Phase 8 evidence](phase-8-evidence.json) retains the actual before/after counts,
structured reports, resolved owner versions and installed-graph identity.

Final-toolchain tests use actual owner peer requirements and installed package resolution rather
than an intermediate TypeScript patch pin or Vitest-major assertion. They preserve Angular identity,
coherent browser-provider versions, the explicitly reviewed Drizzle pair and absence of the retired
loader. Frozen regressions check all physical lock paths against the five carried advisory ranges;
they do not assume a particular hoist or forbid a future patched transitive dependency. The live
full audit remains authoritative for new/changed advisories.

The actual audit CLI rejects controlled unsafe/error reports with nonzero exits, and the actual
CI shell preserves its child's exit 42. Existing local/full/CI gate wiring and independent failure
reporting stay intact. Forty focused checks pass in the fresh installation; final assertion-only
refinements pass their affected checks without repeating unchanged application/resource suites.
Application/runtime and SQL preservation evidence from Phases 5-7 is reused, not re-created or
reclassified as release acceptance. The v0.3.0 audit record remains historical.

## Selected Versions

Phase 7 independently installs the original v0.3.0 release and the adopted candidate, proves
populated data/history/attachment preservation and matching fresh schema, and passes the full API
and contracts suites plus compiled-runtime reads/writes/downloads. See [Phase 7 evidence](phase-7-evidence.json).
It does not change dependency declarations/lockfile, rerun Angular or claim Phase 8's combined audit gate.

| Owner | Selection |
| --- | --- |
| Runtime | Node 24 LTS/npm 11; host proof Node `24.16.0`, Linux proof Node `24.17.0` |
| Angular runtime/compiler/compiler-cli | `21.2.25` |
| CLI/build | `21.2.27` |
| CDK/angular-eslint | `21.2.14` / `21.4.0` |
| TypeScript | `5.9.3`, explicitly constrained at root as well as workspaces |
| Vitest/browser provider | `4.1.12` together |
| Playwright | `1.61.1` |
| Root optional watcher peer | Chokidar `5.0.0`; Sass retains its compatible watcher dependency |
| Drizzle Kit/ORM | Exact `1.0.0-rc.4` pair |

Retain the current compatible Zone.js/RxJS lines and explicit production Zone-based change detection. No TypeScript 6/7, Angular 22, or DOM-emulation migration is required. No forced resolution, dependency override, npm audit-fix downgrade, or exception renewal was used.

### Peer And Runtime Identity

Three rejected candidate states affected the decision:

1. An unconstrained root TypeScript peer selected version 7, outside the intended compiler/linter relationships. Explicitly bind root TypeScript `5.9.3`.
2. Devkit's optional Chokidar 5 peer saw hoisted Chokidar 4 from Sass. Ordinary update/dedupe did not repair that relationship; an explicit compatible root Chokidar 5 peer binding did.
3. The icon package's broad Angular peers saw root Angular 22 while the web workspace used Angular 21. `npm ls` accepted those independent relationships, but real component rendering failed injection. Bind root Angular core/common/compiler to `21.2.25` and verify app/icon resolution is one matching physical runtime.

Peer validation remains mandatory but is insufficient by itself to prove Angular runtime identity. Keep the positive rendering proof and add the runtime-resolution invariant during implementation rather than assuming a green graph guarantees a working component.

## Drizzle Prerelease Decision

At the Phase 6 recheck, stable Kit remains `0.31.11` and still declares the vulnerable legacy loader; ORM's stable tag is `0.45.4`. Both RC tags resolve to the owner-published `1.0.0-rc.4` pair already proven in Phase 0. That exact pair removes the path and provides a migration-ledger upgrade. The [owner upgrade guide](https://orm.drizzle.team/docs/upgrade-v1) supplies the folder-conversion path; the installed RC's migrator supplies transactional ledger augmentation.

Phase 6 adopts the exact pair as an engineering choice within the approved scope, contingent on the remaining API/preservation and release checks. This deliberately accepts prerelease maintenance risk, not a dependency-security exception. A subsequent stable remedy may replace the pair only after its affected compatibility proofs pass.

### Required Compatibility Changes

- Use the explicit `{ client: pool }` constructor. The old positional Pool call is not supported and can select default connection configuration; preserve the guarded, explicitly provisioned target. Remove the obsolete relational `schema` option: Worktrail uses query builders, not relational queries. A regression asserts the returned database retains the provided pool.
- Override the contracts source path relative to `apps/api/tsconfig.json`. The RC schema loader otherwise resolves an inherited relative path from the wrong directory. Keep `tsconfig.build.json`'s compiled contracts mapping separate.
- Run the owner's folder conversion on a private checkout. All 20 original SQL hashes and execution order must remain identical.
- Normalize 23 terminal-snapshot expression fields only: 11 index predicates and 12 checks lose owning-table qualification. Preserve the snapshot ID and ancestry. The structured evidence contains every old/new field value.
- Reject other snapshot differences. Applying the redundant generated DDL to a disposable fresh schema produced an identical PostgreSQL column/index/constraint catalog, proving these particular expression changes are metadata-only. The redundant migration is not adopted.
- Preserve the owner's ledger augmentation: it adds `name` and `applied_at`, retaining the original IDs, hashes, and timestamps. Do not reconstruct the ledger or mark statements applied by hand.

After normalization, two generation runs left the complete SQL/snapshot inventory unchanged. Fresh and populated upgrade databases reached matching application schemas. The prior release migrator accepted the augmented ledger without replay; this is a rollback observation for the unchanged domain history, not a guarantee for future RC migrations.

## Advisory Retirement Plan

| Carried Advisory | Proven Candidate Remedy | Implementation Boundary |
| --- | --- | --- |
| `GHSA-82fw-gwwq-j7x9` | Patched Vitest 4 owner graph replaces web Vitest 3 | Phase 1, validated again at 5/8 |
| `GHSA-5gmw-xhrv-c9v3` | Remove the old Vitest/Tinypool path | Phase 1, validated again at 5/8 |
| `GHSA-85c8-ppgw-ccpr` | Remove the old Vitest/Tinypool path | Phase 1, validated again at 5/8 |
| `GHSA-vfj7-8cjw-p6xm` | Retire Karma only after all intended specs migrate | Phase 5 |
| `GHSA-67mh-4wv8-2f99` | Exact Drizzle RC pair removes the legacy loader | Phase 6, preservation acceptance at 7 |

Shared parent records must be reassessed when each owner changes. Do not add changed vulnerable paths automatically or retain stale exemptions. Original expiry and release boundaries stay intact; the final exception list must be empty and both audits zero.

## Deferred Work

Defer E2E shard balancing for this sprint. The framework/test migration and schema/runtime migration already create substantial compatibility work. Preserve PR-only comprehensive CI and independent Pages deployment; do not trade correctness checks for lower utilization or quietly add a duplicate main-push run.

Phase 9 closeout reaffirms that decision rather than reopening optimization after remediation.
No new comparative CI timing/cost evidence was collected and no speedup is claimed. Shards,
fixture isolation, assertions, workers, retries and failure reporting are unchanged. A future
efficiency effort needs its own measured baseline and correctness proof; it did not displace the
completed v0.3.1 setup and release acceptance. See the [closed disposition](implementation-plan.md#phase-9-conditional-ci-efficiency).

## Final Release Disposition

The version-only lock delta preserves every external package resolution/integrity. A new independent
installation passes strict peer/production/full audits at `0.3.1`, with the original empty policy
unchanged. All 88 verification-helper, 881 API, 88 contracts and 888 Angular tests pass, along with
5 editor, 60 application, 2 compiled-preview and 2 rendered-site checks. Schema generation is stable;
production initial assets remain 410.31 kB with unchanged budgets and no warnings. All owned release
resources are removed. [Final evidence](phase-11-evidence.json) and the
[verification record](verification-notes.md#phase-11-final-release-verification) retain exact scope,
reused preservation/lifecycle proofs, timing and residual limits. No security exception is renewed,
and clean auditing is not a guarantee against undisclosed vulnerabilities.
