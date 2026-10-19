# Worktrail v0.3.1 PRD

## Status

- Approved: October 18, 2026. Phase 0 decisions are recorded in the implementation plan and technical design.
- Release theme: dependency remediation and sustainable development tooling.
- The product owner has approved these requirements for technical design and implementation planning.
- v0.3.0 is the application baseline. This sprint does not introduce a new product feature area.
- Local implementation/release acceptance completed October 18, 2026; conditional CI optimization
  is deferred. See [final evidence](phase-11-evidence.json). Remote CI and publication remain separate.

## Summary

v0.3.1 will retire the bounded development-dependency advisory exceptions carried from v0.3.0 while preserving Worktrail's existing capabilities, local setup, and data compatibility.

Those exceptions are temporary acceptances of specific development risks, not vulnerability fixes. Their deadline is the v0.3.1 release boundary or November 16, 2026 at 00:00 UTC, whichever comes first, subject also to the policy's maximum interval from the v0.3.0 release. The existing audit gate rejects a v0.3.1 release with exceptions remaining. This sprint will address the dependencies responsible for that obligation rather than quietly extending it.

The intended result is a clean, compatible dependency graph and development commands that remain dependable on local machines and in CI. Supported framework or test-runner migrations are in scope when necessary to achieve that result. They are not goals in themselves.

CI efficiency is conditional scope. If remediation leaves capacity, improve the longest verification paths without weakening assertions, masking nondeterminism, or creating more shared-state concurrency. It is acceptable for dependency remediation and its regression checks to consume the entire sprint.

## Context And Baseline

The following v0.3.0 records establish the starting obligations:

- [Dependency remediation](../v0.3.0/dependency-remediation.md): compatible updates, retained tooling, dependency owners, and exposure analysis.
- [Development exception policy](../security/development-audit-exceptions.json): the exact advisory, package, path, version, severity, mitigation, owner, and deadline records enforced by verification.
- [Known limits](../v0.3.0/known-limits.md): the remaining development risks and product limitations.
- [Verification notes](../v0.3.0/verification-notes.md): release evidence and subsequent investigations into CI behavior.
- [Development guidance](../development.md): supported setup and verification workflows.

The recorded v0.3.0 lockfile has zero production findings and 13 full-audit findings associated with five distinct advisories. npm includes affected parent packages in its counts; these are not 13 independent vulnerabilities. The exception policy contains 19 exact affected records across the five advisory entries. These are historical baseline figures, not a guarantee that upstream advisories or available fixes have remained unchanged.

| Workstream | Advisory | Recorded Dependency Path |
| --- | --- | --- |
| Angular build/test tooling | `GHSA-vfj7-8cjw-p6xm` | Karma / Chokidar / braces; untrusted nested glob patterns can exhaust the stack |
| Angular build/test tooling | `GHSA-82fw-gwwq-j7x9` | Web Vitest 3 / mocker; reachable redirect-mock registration can expose files |
| Angular build/test tooling | `GHSA-5gmw-xhrv-c9v3` | Web Vitest 3 / Tinypool; polluted inherited constructor options can enable code execution |
| Angular build/test tooling | `GHSA-85c8-ppgw-ccpr` | Web Vitest 3 / Tinypool; polluted inherited run options can select an unsafe filename |
| Schema generation tooling | `GHSA-67mh-4wv8-2f99` | Drizzle Kit / legacy loader / esbuild; vulnerable serve behavior permits cross-origin access |

The active Angular test runner is Karma/Jasmine. Web Vitest 3 is retained to satisfy the Angular build package's optional peer relationship, not to execute web tests. Earlier removal of that subtree produced an invalid peer graph despite reducing the audit count. Drizzle Kit is also an active dependency: schema generation uses it, even though production migrations use Drizzle ORM.

Neither deleting an apparently unused declaration nor obtaining a lower audit count is sufficient evidence of remediation.

## Goals

1. Retire all five carried advisory exceptions and meet the existing v0.3.1 audit boundary.
2. Produce a reproducible installation with valid dependency relationships and zero reported production or full-workspace audit findings at release verification.
3. Keep Angular build/test tooling and database schema generation on maintainable, compatible dependency combinations.
4. Preserve existing user workflows, application contracts, stored data, and a straightforward local development experience.
5. Preserve tests that detect real regressions while improving the reliability and usefulness of verification.
6. Make the release's dependency decisions, evidence, and remaining product limitations easy to understand.

## Non-Goals

- New work-management features, a redesigned application, or a public-site redesign.
- Cloud deployment, production identity, enterprise operations, or a one-click deployment solution.
- Upgrading every dependency to its latest major version regardless of need.
- Replacing Angular, PostgreSQL, or the application's architecture.
- Forced dependency resolutions, incompatible overrides, npm-suggested downgrades without a supported migration rationale, or suppressing audit findings.
- Reclassifying vulnerable dependencies to make a narrower audit appear clean.
- Resetting users' databases, regenerating historical SQL migrations, or changing the domain schema solely to accommodate tooling.
- Removing meaningful tests to reduce duration, blanket timeout increases, fixed sleeps, retries to obtain a passing run, or weaker build budgets.
- Automatically renewing the carried exceptions or changing their dates to make the release pass.

## Users And Primary Journeys

### Developers And Reference-App Adopters

A developer can clone the repository, install the documented runtime and dependencies, prepare PostgreSQL, migrate and seed an isolated local database, and run Worktrail without dependency-resolution workarounds. Build, test, and schema-generation commands have documented purposes and consistent behavior.

### Existing Worktrail Users

An existing installation can move to v0.3.1 without losing work items, saved views, planning data, comments, activity, or attachments. Navigation, filtering, editing, planning, and collaboration continue to behave as they did in v0.3.0.

### Maintainers

A maintainer can understand why each tooling change was necessary, reproduce its verification, and distinguish an application regression from an infrastructure or test-harness failure. CI reports failures from independent checks without requiring a sequence of fixes merely to discover the next independent error.

## Product Principles

- Remediate the dependency owner, not just the reported symptom. A clean audit and a valid installation are both required.
- Prefer the smallest supported change that meets the release requirements. A broader migration needs evidence that a narrower path is insufficient.
- Treat stored data and migration history as compatibility commitments.
- Retain behavioral evidence, not a test-count quota. Test conversions must preserve the failures they are intended to catch.
- Wait for observable readiness rather than guessing machine speed. A readiness check must not hide incorrect final content.
- Match verification to the change's impact. Toolchain-wide changes justify broad checks; documentation-only edits do not.

## Required Scope

### 1. Dependency Inventory And Feasibility Decision

Before committing to a migration strategy, refresh the production and full dependency inventories, installed graph validity, upstream fixes, and supported package combinations.

The resulting decision must identify the dependency owners responsible for each carried advisory, commands that consume them, compatible remediation candidates, and the effect on Angular, CDK, TypeScript, Node, npm, test execution, and schema generation. Count changes alone must not substitute for reviewing the affected physical dependency paths.

Use representative proofs before converting an entire test suite or database toolchain. For Angular, cover component rendering, asynchronous behavior, routing, HTTP testing, and browser-dependent behavior. For schema generation, establish compatibility with the existing migration metadata and unchanged application schema.

Prefer compatible owner releases when available. Allow a supported Angular/build/test migration or a narrowly scoped schema-tool replacement when needed. Do not assume that a patch found for one dependency eliminates the other advisory paths.

If no acceptable remediation path exists, present the incompatibility, alternatives, and residual risk to the product owner before broad implementation. Revising the release scope or accepting further risk requires an explicit decision; the sprint must not silently redefine a clean release.

### 2. Angular Build And Test Tooling

Resolve the Karma/braces and web Vitest/Tinypool advisory paths without leaving invalid peers or retaining an unnecessary vulnerable consumer.

The exact Angular and test-runner versions belong in the technical design after the feasibility check. A runner migration is permitted but not prescribed by this PRD. Angular's [Karma-to-Vitest migration guidance](https://angular.dev/guide/testing/migrating-to-vitest) describes configuration, test conversion, and browser execution; it also identifies experimental migration behavior that must be evaluated for the selected version rather than treated as an automatic conversion guarantee.

Requirements:

- Keep Angular runtime, compiler, CLI/build tooling, CDK, TypeScript, and test dependencies compatible as a complete graph.
- Preserve component, service, route, permission, query-state, draft, and error-handling coverage when converting tests.
- Review timer, spy, change-detection, and asynchronous-test semantics rather than mechanically translating assertions until they pass.
- Keep real-browser evidence for behavior that depends on native browser capabilities, including editor selection, composition, undo, focus, and security boundaries. DOM emulation is not equivalent evidence for those behaviors.
- Remove obsolete runner integrations only after their responsibilities have a verified replacement.
- Keep focused local tests available, with useful failure output and predictable CI execution.
- Preserve lazy loading, production build behavior, and existing bundle/style budgets. Investigate regressions rather than raising limits to absorb them.

Node 24 LTS/npm 11 remain the default runtime baseline unless the selected supported combination requires an explicitly documented change. This sprint must not exchange known advisories for unsupported runtime or peer relationships.

### 3. Schema Generation Tooling

Remove the vulnerable legacy-loader/esbuild dependency path while retaining a supported, practical schema-generation workflow.

Prefer an owner-supported Drizzle Kit update if it meets the requirement. A limited replacement or a necessary ORM/tooling migration is allowed when a smaller compatible fix is unavailable, but must be justified before implementation. The [Drizzle upgrade guide](https://orm.drizzle.team/docs/upgrade-v1) and [snapshot upgrade command](https://orm.drizzle.team/docs/drizzle-kit-up) are investigation inputs, not permission to adopt a prerelease or rewrite existing migration history.

Requirements:

- Preserve runtime query behavior, database contracts, and the existing custom migration workflow unless a required compatibility change is explicitly designed.
- Preserve historical SQL migrations and their application order. Any necessary metadata conversion must be reviewed, versioned, and distinguished from application DDL changes.
- An unchanged application schema must produce no new domain migration. After any intentional metadata conversion, repeated generation must be stable and leave committed artifacts unchanged.
- Verify both a fresh database and an upgrade from the prior release using owned disposable resources.
- Preserve existing records, relationships, and attachment content during upgrade verification.
- Never use the developer's working database or storage as a disposable test fixture.

### 4. Audit Policy And Release Gate

v0.3.1 must meet the current gate's clean-release requirement: zero production findings, zero full-workspace findings, no remaining development exceptions, and a valid installed graph.

Retire exception entries only when their advisory paths have been removed or fixed. Keep the audit mechanism strict about unknown findings, changed paths or severities, stale exceptions, malformed reports, failed audit transport, and version/date boundaries. A failed audit request is not a clean audit.

Preserve the v0.3.0 disposition as historical evidence. Do not reset policy dates, relabel the same exceptions, hide optional peers, or narrow audit scope to claim completion. Any proposed future exception would require a separate, explicit product-owner risk decision and a revised release requirement; it is not an assumed fallback in this sprint.

The release notes must distinguish zero findings in the audited dependency inventory from a guarantee that the application or its dependencies have no vulnerabilities.

### 5. Reliable Verification And Local Development

Keep the documented install, development, build, schema-generation, test, and owned-verification workflows usable after tooling changes. Update runner-specific commands and diagnostics where necessary without forcing developers to learn an unrelated workflow.

Verification must retain these properties:

- Independent required CI checks report their outcomes, and the aggregate Verify gate rejects failed, skipped, or cancelled required work.
- Database and storage resources are explicitly owned by the verification run; cleanup cannot target a user's working resources.
- Tests sharing mutable seeded state remain serial unless isolation is demonstrated.
- UI checks distinguish rendered readiness, loading failure, and incorrect final results. Keep the rendered-readiness fixes introduced during v0.3.0.
- A test that asserts content must still fail when that content is wrong, even when readiness succeeds. Use focused counterexamples when changing shared readiness helpers or test infrastructure.
- Timeouts remain bounded failure diagnostics, not tuning knobs used to conceal timing assumptions. Fixed sleeps and retries are not remediation for nondeterminism.
- Failures retain enough artifacts and context to investigate the actual boundary that failed.

Run the affected suites during implementation and a broad release verification after cross-cutting toolchain changes. Do not repeat unrelated full suites for every phase or documentation update. The implementation plan must identify the checks warranted by each change's impact.

### 6. Documentation And Release Communication

Update setup instructions, runtime requirements, test commands, schema-generation guidance, dependency disposition, and known limits to match the implemented result. Explain any changed contributor workflow and any upgrade action existing installations need.

Document the chosen compatibility relationships and rejected alternatives sufficiently to support the next dependency update. Record reusable lessons without tying them to a separate framework project.

Update public-site release or technical information where this release makes it inaccurate. Do not invent new user-facing capabilities or imply that development-tool remediation makes Worktrail an enterprise-hosted product. Version changes and final release evidence belong to sprint closeout, not the planning draft.

## Conditional Scope: CI Efficiency

After the remediation path is proven and sized, use remaining capacity to reduce avoidable CI work and improve feedback. This work must not delay the primary obligation or become a reason to extend its exceptions.

The current file-based E2E split places 39 of 60 journeys in one shard. Treat that as a candidate imbalance, not proof that those tests can safely run concurrently. Any redistribution must preserve fixture ownership, hook behavior, ordering dependencies, and complete coverage.

Eligible improvements include better shard distribution, removal of demonstrably redundant setup, or safe reuse of build artifacts. Each change needs a measured baseline and evidence that it preserves the relevant source, compiled-app, browser, and ownership boundaries.

Measure the critical path, per-job duration, and total runner cost, separating setup from test execution where useful. Compare equivalent environments and disclose cold-cache effects. Do not promise an arbitrary runtime target or improve wall-clock time by hiding increased runner cost.

Do not remove assertions, add retries, switch to first-failure reporting, or increase concurrency against shared mutable data merely to make CI shorter. If this work cannot fit safely, defer it and finish the remediation release.

## Compatibility And Safety

- Existing APIs, query contracts, URLs, saved views, actor-scoped state, and persisted records remain compatible unless a specific unavoidable change receives separate approval.
- Existing work-management journeys remain the acceptance baseline; no feature is removed as an incidental consequence of a tooling migration.
- Database and storage preservation are required, not optional smoke checks.
- Production and compiled-preview behavior must remain consistent with development behavior.
- No new exposure of development servers, schema tooling, or test-runner services is introduced as part of remediation.
- Product limitations around identity, hosting, and enterprise operations remain accurately documented.

## Acceptance And Release Criteria

| Area | Required Evidence |
| --- | --- |
| Dependency installation | A clean install succeeds on the documented runtime without forced resolution; the installed graph has no invalid or missing required peers |
| Advisory retirement | All five carried advisory paths are fixed or removed; production and full-workspace audits report zero findings; the development exception list is empty |
| Audit enforcement | Regression checks retain rejection of unknown/stale exceptions, invalid graphs, expired boundaries, and failed or malformed audit responses |
| Angular tooling | Migrated or retained tests preserve their behavioral coverage; routing, asynchronous rendering, HTTP, and native-browser risks have appropriate evidence |
| Application parity | Relevant API/contracts tests, Angular tests, E2E journeys, native-editor checks, and production builds pass after the final toolchain changes |
| Database compatibility | Fresh migration/seed and prior-release upgrade checks pass; generation is stable; historical SQL and existing data/attachment content are preserved |
| Developer experience | Documented development and focused-test commands work; owned full verification and compiled preview retain safe startup and cleanup |
| CI | Every required job and the aggregate Verify gate pass; failures remain diagnosable without retries or sleep-based fixes |
| Conditional efficiency work | If included, comparable measurements show the result, and fixture isolation, coverage, and failure collection remain intact |
| Release communication | Documentation and applicable site information match the implementation; release notes explain remediation and any contributor upgrade actions |

No fixed test-count target applies. A changed count requires an explanation of converted, merged, or replaced coverage, not automatic acceptance of fewer checks. A clean audit is a dated release result, not a permanent security claim.

If the strict dependency requirement cannot be met through an acceptable supported path, the release is not complete under this PRD. Obtain an explicit scope/risk decision before changing that requirement.

## Risks And Scope Controls

### Upstream Fix Availability

A compatible patch may not exist for every carried path. The feasibility decision must happen before large-scale conversion so the sprint can prioritize a necessary migration or surface a genuine blocker early. Conditional CI work yields first.

### Test Migration Changes What Tests Prove

Different runners and browser environments can change timer behavior, rendering, mocks, and native APIs. Preserve the intended failure conditions and browser evidence rather than accepting a green conversion based solely on syntax changes.

### Schema Tooling Changes Migration Metadata

A tooling upgrade may require metadata conversion or a broader ORM change. Prove compatibility in disposable resources and keep generated metadata changes separate from historical SQL and domain-schema changes.

### New Advisory Findings

The advisory inventory may change during the sprint. Refresh it at the design decision and release verification boundaries. New findings require explicit disposition; a historical baseline does not exempt them.

### CI Optimization Adds Complexity

Parallelism and caching can introduce state leaks or stale artifacts. Prefer a small, measurable improvement with clear ownership over a wider verification redesign. Defer work whose correctness cannot be established within the sprint.

## Decisions For Technical Design

The approved direction leaves implementation choices to engineering judgment. The technical design and Phase 0 should resolve:

- The exact compatible Angular, CDK, TypeScript, build, and test-runner versions needed to retire the four Angular-related advisory paths.
- Whether the web runner must change, and which checks require a real browser rather than DOM emulation.
- The smallest supported change that removes Drizzle Kit's vulnerable legacy-loader path, including whether runtime ORM or metadata changes are necessary.
- How compatibility proofs, test conversion, and fresh/upgrade database checks will be staged before broad changes.
- Whether CI efficiency work fits after remediation is sized, and which measured improvement offers the best return without weakening reliability.

These choices do not require another product preference round unless the available paths change user-visible behavior, data compatibility, the release's risk acceptance, or the agreed scope.
