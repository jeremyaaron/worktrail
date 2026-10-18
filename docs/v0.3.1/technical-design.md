# Worktrail v0.3.1 Technical Design

## Status

Implementation baseline confirmed in Phase 0 on October 18, 2026. Implements the approved direction in the [PRD](prd.md); [verification notes](verification-notes.md) and the [dependency disposition](dependency-remediation.md) record the feasibility results.

Private installations confirmed the selected graph and representative compatibility. Required implementation phases have not started: no working package identity, lockfile, migration artifact, or exception deadline changed in Phase 0. Full application/runtime acceptance remains required after migration.

The separately approved PR-only CI change is already present in the working tree and is part of this design's baseline. Pages retains its independent deployment workflow.

## Summary

Remediate two dependency-owner graphs while preserving the application's architecture:

1. Move Angular 20 to the compatible Angular 21 line and replace Karma/Jasmine with Vitest 4 through Angular's unit-test builder. Execute web component tests in Playwright-managed Chromium initially, avoiding an incidental move from native browser behavior to DOM emulation.
2. Evaluate Drizzle's owner-published 1.0 release-candidate toolchain as a coupled Kit/ORM migration. Its Kit dependency metadata removes the vulnerable legacy loader, but its migration format changes require a separate compatibility decision before adoption.

The second workstream is the feasibility risk. The current stable Kit release still carries the vulnerable dependency. This design does not assume a stable patch exists or authorize an improvised migration-ledger rewrite. If the release candidate cannot preserve existing installations through an acceptable owner-supported path, stop that workstream and obtain a scope/risk decision instead of renewing the exception or claiming completion.

Keep the current application contracts, Express adapters, service/repository boundaries, PostgreSQL deployment, local actor model, and attachment storage. No user-facing feature or domain-schema change is planned.

## Design Decisions

| Area | Proposed Decision |
| --- | --- |
| Runtime | Retain Node 24 LTS and npm 11 |
| Angular | Target Angular 21.2, not Angular 22; retain TypeScript 5.9 and RxJS 7.8 |
| Angular application scheduling | Retain the existing Zone-based application and explicit `provideZoneChangeDetection` |
| Web unit runner | Angular `@angular/build:unit-test`, Vitest 4, Playwright Chromium |
| DOM emulation | Do not introduce jsdom/happy-dom as the default in this sprint |
| Test conversion | Explicit Vitest imports, reviewed spy/assertion conversions, native async and controlled fake timers |
| Schema tooling | Adopt the proven exact Drizzle Kit/ORM `1.0.0-rc.4` pair, with reviewed metadata normalization and explicit prerelease disposition |
| Migration history | Preserve SQL contents, order, timestamps, and existing database ledger identity; allow only reviewed tooling metadata/layout conversion |
| Audit gate | Keep production/full audits and peer validation strict; retire exceptions without changing their original deadline |
| CI triggers | PR-only comprehensive checks; no post-merge application CI; independent Pages deployment unchanged |
| CI optimization | Shard balancing deferred in Phase 0; retain PR-only CI and existing isolation/reporting |
| Local verification | Select by changed boundary; broad closeout verification for the final cross-cutting toolchain |

## Baseline And Candidate Versions

### Current Evidence

The [v0.3.0 dependency disposition](../v0.3.0/dependency-remediation.md) explains the retained graphs and previous rejected peer-resolution shortcut. A read-only audit during this draft reproduced zero production findings and 13 full findings: five moderate, six high, two critical, associated with the same five advisory IDs in the [exception policy](../security/development-audit-exceptions.json).

This confirms the starting obligation, not the cleanliness of a candidate installation. Candidate lockfiles need their own full audit and graph validation.

### Selected Angular Versions

| Component | Selected Version | Reason |
| --- | --- | --- |
| Angular runtime/compiler/compiler-cli | `21.2.25` | Published Angular 21 runtime patch family; keep these packages at matching versions |
| CLI / build | `21.2.27` | Published Angular 21 tooling accepts Vitest `^4.0.8` and TypeScript `>=5.9 <6.0` |
| CDK | `21.2.14` | Published compatible CDK 21 line |
| angular-eslint | `21.4.0` | Compatible CLI 21/ESLint 9/typescript-eslint 8 owner relationships |
| TypeScript | `5.9.3` | Already installed; avoid an unrelated TypeScript 6 migration |
| Vitest / browser-playwright | `4.1.12` together | Same patched Vitest family as the existing API/contracts runner; provider requires the matching runner version |
| Playwright | Existing locked `1.61.1` family | Reuse the installed browser family and existing native-editor/E2E tooling |
| Zone.js / RxJS | Existing compatible `0.15` / `7.8` lines | Preserve application scheduling and reactive behavior |

Angular's [compatibility table](https://angular.dev/reference/versions) permits the retained Node/TypeScript/RxJS baseline for Angular 21. Angular 22 requires TypeScript 6, adding a migration that is not needed merely to satisfy the inspected Angular 21 Vitest peer. The owner metadata for [Angular build 21.2.27](https://registry.npmjs.org/@angular%2fbuild/21.2.27) and [browser provider 4.1.12](https://registry.npmjs.org/@vitest%2fbrowser-playwright/4.1.12) establishes those peer relationships, not a guarantee that their entire transitive graph is advisory-free.

Use the selected versions for initial implementation and the lockfile as installation authority. Do not execute moving `latest` or prerelease tags in CI. A later compatible patch change requires the relevant checks again; a new major requires an updated disposition.

Phase 0 confirmed these versions with explicit root development-peer bindings for TypeScript `5.9.3`, Chokidar `5.0.0`, and Angular core/common/compiler `21.2.25`. The first prevents an unbounded TypeScript peer selecting version 7; Chokidar satisfies Devkit's optional peer rather than an incompatible hoisted Sass watcher. The Angular bindings prevent the icon package from resolving Angular 22 alongside the app's Angular 21. These are declared compatible peers, not overrides. Require both a valid installed graph and a single matching runtime resolution for application and icon consumers.

### Drizzle Candidate And Risk

The inspected [stable Kit 0.31.11 metadata](https://registry.npmjs.org/drizzle-kit/0.31.11) still includes `@esbuild-kit/esm-loader`. Updating only to that version does not retire `GHSA-67mh-4wv8-2f99`.

The owner-published candidate pair is `drizzle-kit@1.0.0-rc.4` and `drizzle-orm@1.0.0-rc.4`. [Kit RC metadata](https://registry.npmjs.org/drizzle-kit/1.0.0-rc.4) uses jiti and a newer esbuild line rather than the legacy loader. The [owner's v1 upgrade guide](https://orm.drizzle.team/docs/upgrade-v1) recommends upgrading the pair and converting the migration folder; it describes a new snapshot format and removal of the file journal. This is a prerelease and a migration-format change, not a drop-in stable patch.

Treat the pair as one owner boundary rather than mixing RC generation with the old runtime or creating two permanent migration histories. Recheck for an owner-supported stable remedy before implementation; a replacement must pass the relevant proof. A passing audit alone does not justify adoption. Any later compatibility failure that requires unsupported ledger manipulation or changes the PRD's safety commitments goes back to the product owner.

Phase 0 accepted this exact pair after the populated-ledger, generation, fresh-schema, attachment, and transaction proofs passed. Stable Kit `0.31.11` still carries the affected loader. Adoption includes the following necessary compatibility changes, not a claim that the RC is a stable release:

- Construct the driver with `drizzle({ client: pool, ...options })`; the old positional Pool signature is no longer supported. Do not permit an accidental fallback to default connection configuration.
- Declare the contracts source path relative to the API's own `tsconfig.json` so the RC's schema loader resolves it correctly. Keep the compiled API's separate contracts declaration mapping.
- Normalize only the latest converted snapshot's 23 index-predicate/check-expression fields. The difference is owning-table qualification; PostgreSQL catalog comparison verifies equivalence before accepting metadata changes. Preserve snapshot ID/ancestry and every historical SQL byte.
- Allow the owner's transactional ledger upgrade to add `name` and `applied_at`; original IDs, hashes, and millisecond timestamps remain unchanged. The old release's migrator still accepts that augmented ledger in the proof. This rollback evidence covers the unchanged domain schema, not arbitrary future migrations.

## Architecture And Change Boundaries

The runtime request path remains adapter -> handler -> service -> repository -> PostgreSQL. Contracts stay independent of Angular and Drizzle. Transport behavior, query semantics, authorization, lifecycle locks, snapshots, and attachments retain their current owners.

| Existing Owner | Planned Responsibility |
| --- | --- |
| Root/workspace manifests and `package-lock.json` | Compatible package selection, explicit test-tool dependencies, reproducible physical graph |
| `apps/web/angular.json` | Unit-test builder, build-derived assets/styles/polyfills, Chromium execution |
| `apps/web/tsconfig.spec.json` and web specs | Vitest types/imports and reviewed behavioral conversion |
| Proposed `apps/web/vitest.config.ts` and test setup files | Small runner/provider settings, cleanup, matching Angular scheduling |
| `scripts/verify.mjs` | Retain profile ownership and `test:web` stage; invoke the new runner rather than Karma |
| `scripts/verification/karma.config.cjs` | Retire after replacement covers browser lifecycle, loopback binding, and owned isolation |
| `apps/api/drizzle.config.ts`, `apps/api/drizzle/` | Owner-supported generation and reviewed metadata conversion |
| `apps/api/src/db/client.ts`, `migrate.ts` | Only compatibility changes required by the selected ORM; retain guarded connection/migration entry points |
| `scripts/verification/schema.mjs` | Stable, complete migration inventory after intentional conversion |
| `scripts/verification/audit.mjs` and tests | Keep strict report/graph checks; replace obsolete baseline pins with target invariants |
| `.github/workflows/ci.yml`, composite verification action | PR-only required scopes, diagnostics, and safe browser setup |

Do not introduce a general test framework, migration engine, package-policy framework, or application abstraction. Extend existing small verification modules where their responsibilities fit.

## Feasibility Gates

### Inventory Gate

Capture the baseline commit/lock identity, resolved owners, exact affected paths, production/full findings, and runtime/peer ranges. Keep machine-readable evidence under this sprint's documentation when implementing the proof, without credentials, registry tokens, or working database URLs.

For each candidate, install in a private checkout with its own dependencies rather than the ordinary verification snapshot's read-only symlinked dependency mirror. Never point a modified candidate lockfile at the working checkout's old `node_modules`. Require clean `npm ci`, valid `npm ls --all`, and both structured audits.

The two owner graphs can be investigated independently, but the release requires the combined graph to pass. An intermediate proof with other carried advisories remaining is not a clean release and must label that distinction explicitly.

### Angular Proof

Before converting all specs, prove:

1. Application development/production compilation under Angular 21, preserving explicit Zone-based scheduling and lazy entry points.
2. A component with templates/styles, an HTTP client test, a real router/context test, and a permission/draft guard test under the new builder.
3. A debounce/cancellation test from Quick Find or the work lists, using controlled time rather than real sleeps.
4. A DOM-sensitive clipboard/focus/overlay test in Chromium, including cleanup of spies and fixtures.
5. Owned startup, loopback server binding, successful exit, deliberate failure, and interruption cleanup on the host and Linux CI execution model.

If these fail, repair the candidate/configuration or document why the runner path is not viable before bulk conversion. Do not retain a parallel vulnerable Karma fallback in the final graph.

### Drizzle Proof

Before repository-wide API conversion or committed migration-layout changes, prove:

1. Existing PostgreSQL schema declarations load and generate without invented domain changes.
2. The complete historical SQL sequence can be represented with byte-identical SQL bodies and the same execution identity/order.
3. A disposable database migrated with the v0.3.0 toolchain is recognized by the new migrator without reapplying historical statements or discarding its ledger.
4. A fresh database reaches the same application schema; applying migration again is a no-op.
5. Representative queries, `$count`, raw SQL, row locking, rollback, and repeatable-read transactions retain behavior.
6. The candidate installation removes the affected loader/esbuild path and introduces no new audit findings.

If the owner tool cannot satisfy upgrade identity, reject that candidate. Do not fill the gap by truncating the ledger, marking migrations applied without proof, or inventing a custom migrator to bypass the gate.

## Angular Migration

### Build And Application Configuration

Keep `@angular/build:application` and `@angular/build:dev-server`. Apply the owner's Angular 20-to-21 migrations in a private candidate checkout, inspect every application change, and copy only reviewed changes into the implementation branch. Keep updates separate from unrelated source formatting or component refactors.

Preserve `provideZoneChangeDetection({ eventCoalescing: true })` in application configuration. A dependency remediation sprint is not the place to convert production change detection to zoneless behavior. Keep the existing production budget thresholds: initial warning 550 kB/error 1 MB and component-style warning 8 kB/error 12 kB.

Review browser support and emitted output as part of the Angular upgrade. An output-path change must be reflected in compiled-preview serving, not concealed by testing only development mode.

### Unit-Test Builder

Use the Angular-owned builder for template compilation and TestBed initialization. Do not call standalone Vitest directly on Angular component sources.

Proposed test target:

```json
{
  "builder": "@angular/build:unit-test",
  "options": {
    "runner": "vitest",
    "buildTarget": "worktrail-web:build:development",
    "tsConfig": "tsconfig.spec.json",
    "browsers": ["chromium"],
    "headless": true,
    "runnerConfig": "vitest.config.ts",
    "providersFile": "src/testing/providers.ts"
  }
}
```

The [Angular 21 builder schema](https://raw.githubusercontent.com/angular/angular-cli/21.2.x/packages/angular/build/src/builders/unit-test/schema.json) provides these configuration boundaries. Build-derived assets, global styles, and application polyfills replace the old Karma target's duplicate options. The proposed providers file supplies the existing Zone-based scheduling to TestBed explicitly; prove its interaction with per-spec providers before using it globally.

Use `@vitest/browser-playwright` at the exact Vitest version. Keep Playwright resolution compatible with the root test package and declare the provider's needed peer explicitly rather than relying on accidental transitive availability. API/contracts keep their independent Vitest configurations and Node execution environments; they do not inherit Angular setup.

Retain a single Chromium web-test profile initially. This limits the migration to the runner and avoids simultaneously sorting all current tests into emulated and browser environments. The native-editor harness and application E2E/compiled-preview suites remain separate required evidence.

### Spec Conversion

Convert specs by coherent ownership groups, beginning with shared utilities and representative infrastructure before large page suites. Use explicit imports from Vitest and replace Jasmine ambient types in `tsconfig.spec.json`; do not leave both assertion systems in scope.

| Existing Pattern | Conversion Requirement |
| --- | --- |
| `jasmine.createSpy`, `createSpyObj`, `jasmine.SpyObj` | Typed `vi.fn` objects or focused test doubles; keep observable/property behavior explicit |
| `spyOn(...).and.returnValue/resolveTo/rejectWith/callFake` | `vi.spyOn`/mock implementations with equivalent reset and restoration |
| Jasmine asymmetric matchers | Matching Vitest assertions without broadening expected fields |
| `fakeAsync`, `tick`, `flushMicrotasks` | Native async for completion; scoped fake timers only for time-dependent application behavior |
| HTTP `TestRequest.flush` | Keep HTTP response control; this is not a Zone timer helper |
| DOM/focus/clipboard spies | Test in Chromium; respect browser property descriptors and restore all changes |
| Route/context tests | Preserve actual router transitions, actor ownership, stale results, and draft decisions |

The [Angular 21 migration guidance](https://raw.githubusercontent.com/angular/angular/21.2.x/adev/src/content/guide/testing/migrating-to-vitest.md) labels the conversion schematic experimental and says Zone-based test helpers are unsupported with its Vitest integration. Use a schematic only as a reviewed mechanical aid. Do not use a newer Angular version's Zone patch to circumvent the chosen version's testing contract.

For debounce tests, control only the relevant clock APIs, advance by the application's defined interval, deliver the selected Subject/HTTP response, and observe the resulting state/render. Native promise completion or Angular stability must not depend on an arbitrary elapsed delay. Restore real timers, mocks, global descriptors, and fixtures after every test, including failure paths.

Do not add a permanent Jasmine-compatibility shim or rewrite assertions into generic polling to obtain green results. Preserve a coverage map for conversions that merge or replace tests, including the specific regression each replacement detects. No focused/skipped tests or unresolved conversion TODOs may remain in the required suite.

## Owned Web-Test Execution

Keep `npm test --workspace @worktrail/web` as a non-watch, headless web-test entry point. Expose Angular's supported file/name selection for focused tests and document the exact selected-version syntax after the proof. Keep watch/debug modes explicit and separate from CI acceptance.

In `scripts/verify.mjs`, retain the `test:web` stage and existing process owner. Replace Karma-specific arguments/environment with the Angular unit-test invocation. A small provider configuration may read validated owned-run context for temporary outputs and assigned ports; it must not gain database or storage mutation authority.

Transfer the custom launcher's responsibilities rather than just deleting its file:

- Use the installed Playwright Chromium binary, headless operation, and isolated browser contexts.
- Bind any test-serving/RPC endpoint to loopback, allocate its port per run, and reject an occupied requested port rather than attaching to an unrelated service.
- Keep profiles, temporary output, and caches in the owned workspace/run, never a shared working directory.
- Avoid persistent user profiles; the runner owns browser lifecycle and closes contexts on success/failure.
- Keep Node/provider children within the registered process tree; verify interruption and abandoned-run cleanup without terminating unrelated processes.
- Preserve failure exit codes and sanitised summaries. Do not use retries to compensate for capture/startup failures.

Only remove Karma packages, Jasmine packages/types, the old launcher, and Karma-specific manifest fields after their consumers have migrated. Verify the resulting lockfile contains neither the vulnerable Karma/braces graph nor the old web Vitest/Tinypool graph. Updating declarations while leaving installed consumers is insufficient.

## Drizzle Migration And Preservation

### Adoption Boundary

Prefer a compatible stable fix if the refreshed inventory finds one. Otherwise use the coupled RC candidate only after the feasibility gate succeeds and the disposition explicitly accepts its prerelease status. Pin the adopted prerelease exactly; no moving `@rc` tag or broad range is permitted in committed manifests.

Keep node-postgres, the guarded database target, and current repository/persistence interfaces. Adapt only required Drizzle import/types, schema API, driver construction, or migrator calls. The current repositories primarily use SQL/query-builder methods rather than the relational-query API; do not introduce a relational-query rewrite simply because the v1 guide discusses one.

Preserve transaction options, explicit executor capabilities, advisory-lock participation, and read/write scope lifetime. Compilation alone is not evidence of locking or isolation compatibility.

### Historical Migration Conversion

Before conversion, record each historical SQL body's SHA-256, migration identifier, order, timestamp, breakpoint semantics, and the expected applied-ledger records from a disposable prior-version database. Use this baseline to review the owner tool's conversion result.

The owner tool may relocate SQL files and replace snapshot/journal metadata. Relocation must preserve SQL bytes and a documented mapping from the old identity to the new one. Do not regenerate historical SQL from the current schema or squash history into a new initial migration.

If the new migrator requires an application-database ledger change, establish whether the owner provides an upgrade path that preserves the meaning of existing records. Any such operation must be explicit, idempotent, transactionally safe where supported, and validated against the prior ledger. If that cannot be achieved within the PRD's compatibility requirements, stop and review the design rather than hand-editing the developer's database.

Tests such as `authored-content-migration.test.ts`, which read and apply selected historical migrations, must retain the same semantic ranges after any layout/API change. Do not silently replace partial-history checks with full fresh installs.

### Generation And Upgrade Verification

Keep `npm run db:generate` as the root entry point and retain version-controlled schema metadata. Configuration must not unexpectedly connect to a working database or start Studio/serve. Generation proofs run in a private checkout with explicitly supplied disposable context.

After the one-time reviewed conversion, `verifySchemaGeneration` continues to compare a complete recursive file/hash inventory before and after generation. Do not exclude new metadata files to make the comparison pass. Generate twice in the proof: both runs must be stable against the intentionally converted baseline. An unchanged domain schema must produce no new application DDL.

Upgrade evidence uses two owned databases and an owned attachment store:

1. Prepare the prior-version database with prior-version migrations and representative populated state; capture ledger/schema/data invariants and attachment hashes.
2. Apply only the candidate's documented upgrade steps, without reset or reseed.
3. Compare ledger identity, record/relationship values, preserved historical snapshots, attachment references, and attachment bytes. Exercise ordinary reads and writes.
4. Apply migration again and assert no further change.
5. Independently migrate and seed a fresh database; compare the expected application schema, including indexes, constraints, and PostgreSQL extensions.

Include transaction/concurrency regressions for current-state locking, cycle coordination, rollback, and repeatable-read hydration if the runtime ORM changes. Retain existing performance/query-count bounds; this sprint does not justify an N+1 regression.

No proof may reset the user's database, storage, or live application processes. Existing resource markers and live-target validation remain mandatory.

## Audit Policy And Evidence

Keep the existing collector/evaluator and installed-graph validation. Both audits include the appropriate workspaces/root; the full audit includes development, optional, and peer dependencies. Network failures, inconsistent report formats, and failed graph validation remain hard failures.

As an owner graph is remediated, remove only its resolved exception entries/affected records in the same implementation change. Retain valid unresolved records during staged work; changed vulnerable paths require review, not automatic regeneration of an allowlist. Shared parent findings must be reassessed against all remaining advisories.

At closeout, the exception list must be empty and both audits must report zero findings. Preserve the original policy dates and v0.3.1 boundary as historical constraints; an empty list does not need a renewed deadline. Keep the v0.3.0 disposition intact and publish v0.3.1's actual before/after evidence separately.

Replace the existing audit test that deliberately pins Karma/Vitest 3/Tinypool 1 with positive target invariants and continued negative graph tests. Do not weaken tests for malformed reports, unknown/stale records, production exceptions, boundary expiry, or snapshot/installation lock mismatch.

Set Worktrail package identity to `0.3.1` only during release closeout, after exception retirement. Run the gate against that identity before calling the release complete. A future advisory that appears during the sprint is evaluated normally; this design supplies no fallback exception.

## CI And Conditional Efficiency

### Trigger And Required Status Baseline

Comprehensive CI runs only on `pull_request`. Preserve the existing required `Verify` aggregate name and its rejection of failed/skipped/cancelled child jobs. Keep independent backend/tooling, frontend, three application shards, compiled preview, editor, and site jobs; matrix fail-fast remains disabled and browser retries remain zero.

Do not restore the `main` push trigger, add a merged-PR `closed` trigger, or add another workflow that repeats the same coverage after merge. The separate Pages workflow continues to validate and deploy the static site. Direct pushes are unchecked; PR-based changes and current-base required checks are the operating assumption. Repository branch-protection changes are separate administrative actions, not implied by editing YAML.

Builds inside PR verification remain correctness checks for compiler, lazy-loading, budgets, and compiled-preview behavior. They are not deployment builds and remain valuable even though the application is not deployed. No new automatic application build after merge is needed.

### Conditional Shard Balancing

Only begin after both remediation paths are viable and their remaining work is sized. Default to preserving the existing runner count and one worker per mutable application fixture.

Use the current 39-of-60 journey imbalance as an investigation input. Measure actual duration and inspect hooks/serial dependencies before splitting the large spec file. If the work fits, move self-contained scenario groups into coherent files with explicit fixture ownership; keep any serial group and its setup/teardown together. Do not distribute dependent tests independently or assume file isolation means application-state isolation.

Show that the union of shard discovery matches the full intended journey set exactly once. Verify each new group from a fresh seeded owned context and check cleanup. Keep all assertions and the existing rendered-readiness helpers.

Record comparable critical-path/per-job/total runner time before and after. Do not create a flaky timing assertion or arbitrary runtime SLA. Broader build-artifact reuse, default compiled-app E2E, increased workers, and cache redesign are deferred unless a measured need and correctness proof justify revisiting this design.

## Verification Strategy

| Change Boundary | Verification During Implementation |
| --- | --- |
| This design/plan and documentation-only edits | Markdown structure, links, factual consistency, and diff checks; no application suites |
| Candidate dependency graph | Private clean install, peer graph, full/production audits, exact owner metadata |
| Angular builder/provider setup | Representative proof specs, development/production compilation, native browser startup/failure/interruption |
| Spec conversion group | Converted specs plus directly affected shared consumers; retain coverage mapping |
| Completed Angular migration | Complete web profile, native editor, affected application journeys, compiled preview, budget checks |
| Schema metadata/generator | Generation stability and historical file/identity comparison in the private checkout |
| Runtime ORM/migrator | API/contracts builds/tests, fresh and prior-version upgrade proofs, transaction/concurrency and preservation checks |
| Audit/ownership/process/CI helpers | Focused Node tests and relevant lifecycle checks; no automatic full Angular rerun |
| Conditional E2E redistribution | Discovery completeness, affected isolated groups/shards, ordering/cleanup, comparable runtime evidence |
| Release closeout | Combined clean graph/audits, broad owned verification on the final toolchain, supplemental fresh/upgrade and lifecycle evidence |

Do not repeatedly run the full application suite after documentation-only completion notes. Broad checks are justified when the final combined Angular/ORM toolchain has changed, not merely because a phase ended. Reuse valid evidence from an unchanged executable tree and record its commit/lock identity.

Keep readiness separate from expected content: the list/cycle helpers wait for rendered settlement or an error state, then normal assertions check the expected result. When changing a shared readiness boundary, use a wrong-content counterexample to prove settlement cannot turn incorrect output into a pass. Do not increase waits, add retries, or insert sleeps to address local/CI differences.

## Delivery And Rollback

Implement in reviewable owner-based changes: feasibility evidence, Angular/tooling and spec groups, Drizzle conversion/compatibility, audit retirement, optional CI balancing, then documentation and closeout. The implementation plan will assign phases and checks; this design does not imply that all spec conversion belongs in one phase.

Keep package and metadata changes coherent at each completed owner boundary. An installation with mismatched lockfiles, unsupported peers, or obsolete runner consumers is not an acceptable intermediate release.

Angular rollback means reverting the reviewed tooling/spec group together, not restoring a vulnerable fallback in the final release. Drizzle rollback must be established before adoption: a temporary checkout can always be discarded, but a database ledger/layout conversion may not be reversible by reinstalling the old package. Document any supported reverse path or backup/restore requirement. If an acceptable upgrade/rollback posture cannot be demonstrated, do not perform that migration on a working installation.

Retain evidence outside disposable resources and preserve guarded cleanup even when a command fails. No automatic database reset, production data conversion, publication, tagging, or remote configuration change is part of technical-design approval.

## Documentation And Closeout

Update README/development guidance for the selected runtime, browser installation, focused tests, schema-generation/migration steps, and any contributor-visible upgrade changes. Record the exact adopted versions, peer relationships, audit results, historical SQL/ledger preservation, and deliberate prerelease decision if applicable.

Update current known limits to retire resolved advisories without suggesting all security risk has disappeared. Public-site changes are limited to release/technical information made inaccurate by this work. Do not redesign the site or invent new product capabilities.

The release is ready only when the PRD's clean-graph/audit, behavioral parity, migration preservation, CI, and documentation criteria have evidence. Conditional CI efficiency may be explicitly deferred without blocking the primary release. Failure to retire a carried advisory or preserve data compatibility cannot be deferred silently.

## Phase 0 Closed Decisions

- Confirmed the selected Angular 21/Vitest 4 versions, explicit root peer bindings, and a clean cutover installation with zero production/full audit findings.
- Confirmed Zone-based Chromium/TestBed scheduling, a complete staged runner partition, failure reporting, and host/Linux process/port cleanup. Container diagnostics use `--init`; Linux evidence is ARM64, not a claim of remote AMD64 CI acceptance.
- Accepted the exact Drizzle RC pair with explicit driver/path compatibility and reviewed metadata-only normalization. Original SQL/ledger identity and populated state are preserved through the owner's upgrade path.
- No departure from the PRD's safety or clean-release requirements is needed. Keep prerelease risk visible and require the broader Phase 7 runtime checks before release.
- Assigned all 70 baseline spec files to conversion phases and deferred conditional shard balancing. The [implementation plan](implementation-plan.md) records the groups and remaining acceptance.

No further product preference is required for ordinary compatible patch selection. Prerelease status must remain explicit, and any departure from the approved release requirements requires a separate decision rather than an exception-policy edit.
