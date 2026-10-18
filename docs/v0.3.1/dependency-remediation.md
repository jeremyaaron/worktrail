# Worktrail v0.3.1 Dependency Disposition

## Status

Phase 0 feasibility decision, October 18, 2026. This records private candidate installations, not completed remediation of the working checkout. The working release remains `0.3.0`, with its original lockfile and exception policy unchanged.

See [structured evidence](phase-0-evidence.json), [verification notes](verification-notes.md), and the [technical design](technical-design.md).

## Owner Graphs

| Installation | Peer Graph | Production Findings | Full Findings |
| --- | --- | --- | --- |
| Working v0.3.0 baseline | Valid | 0 | 13, associated with five advisory IDs |
| Private staged Angular 21/Drizzle RC candidate, Karma retained | Valid after explicit peer bindings | 0 | 6 high, from the retained Karma/braces owner graph |
| Private cutover candidate, Karma/Jasmine removed | Valid; clean `npm ci` | 0 | 0 |

Counts include inherited parent findings. The private cutover proof establishes a viable combined path, not a release verdict for unconverted application tests. Phases 1-8 must implement and revalidate it; Phase 11 checks the actual `0.3.1` tree.

## Selected Versions

| Owner | Selection |
| --- | --- |
| Runtime | Node 24 LTS/npm 11; host proof Node `24.16.0`, Linux proof Node `24.17.0` |
| Angular runtime/compiler/compiler-cli | `21.2.25` |
| CLI/build | `21.2.27` |
| CDK/angular-eslint | `21.2.14` / `21.4.0` |
| TypeScript | `5.9.3`, explicitly constrained at root as well as workspaces |
| Vitest/browser provider | `4.1.12` together |
| Playwright | `1.61.1` |
| Root optional watcher peer | Chokidar `5.0.0`; Sass/Karma retain their own compatible watcher dependencies while needed |
| Drizzle Kit/ORM | Exact `1.0.0-rc.4` pair |

Retain the current compatible Zone.js/RxJS lines and explicit production Zone-based change detection. No TypeScript 6/7, Angular 22, or DOM-emulation migration is required. No forced resolution, dependency override, npm audit-fix downgrade, or exception renewal was used.

### Peer And Runtime Identity

Three rejected candidate states affected the decision:

1. An unconstrained root TypeScript peer selected version 7, outside the intended compiler/linter relationships. Explicitly bind root TypeScript `5.9.3`.
2. Devkit's optional Chokidar 5 peer saw hoisted Chokidar 4 from Sass. Ordinary update/dedupe did not repair that relationship; an explicit compatible root Chokidar 5 peer binding did.
3. The icon package's broad Angular peers saw root Angular 22 while the web workspace used Angular 21. `npm ls` accepted those independent relationships, but real component rendering failed injection. Bind root Angular core/common/compiler to `21.2.25` and verify app/icon resolution is one matching physical runtime.

Peer validation remains mandatory but is insufficient by itself to prove Angular runtime identity. Keep the positive rendering proof and add the runtime-resolution invariant during implementation rather than assuming a green graph guarantees a working component.

## Drizzle Prerelease Decision

The refreshed stable Kit tag remains `0.31.11` and still declares the vulnerable legacy loader. The owner-published `1.0.0-rc.4` pair removes that path and provides a migration-ledger upgrade. The [owner upgrade guide](https://orm.drizzle.team/docs/upgrade-v1) supplies the folder-conversion path; the installed RC's migrator supplies transactional ledger augmentation.

Adopt the exact pair as an engineering choice within the approved scope, contingent on the remaining API/runtime and release checks. This deliberately accepts prerelease maintenance risk, not a dependency-security exception. Recheck upstream availability before adoption; a newly available stable remedy may replace the pair only after its affected compatibility proofs pass.

### Required Compatibility Changes

- Use the explicit `{ client: pool }` constructor. The old positional Pool call is not supported and can select default connection configuration; preserve the guarded, explicitly provisioned target.
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
