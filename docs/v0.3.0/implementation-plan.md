# Worktrail v0.3.0 Implementation Plan

## Status

Approved for sequential execution. Phases 0-15 are complete as of October 17, 2026;
Phases 16-21 are not started. Release verification remains pending. Merge, tag, publication,
and Pages deployment remain separate user-controlled actions.

## Purpose

This plan turns the [PRD](prd.md) and [technical design](technical-design.md) into sequential phases
for **Connected Work: A Coherent Operating Baseline**. The [UX audit](ux-audit.md),
[technical debt audit](tech-debt-audit.md), and [site audit](site-audit.md) provide the baseline findings.

The release makes the existing find/read/act/return journey coherent. It combines draft and navigation
safety, complete single-record actions, clearer planning/history, consistent discovery, measured read
improvements, safe verification, and a shorter public product story. Estimate state is the only new
work-discovery predicate. This is not a cloud deployment, authentication, analytics, or framework sprint.

## Execution Rules

- Execute one requested phase at a time, in order. Each phase leaves the repository compiling and its
  focused checks passing. If a phase needs splitting, update the plan explicitly before expanding it.
- Fix behavior with focused regression tests; do not hide a correctness change inside unrelated file
  moves. Add a failing reproduction and make it pass within its owning phase.
- Introduce required response fields with their real producers, consumers, fixtures, and validation.
  Do not populate compatibility DTOs with temporary invented values.
- Shared state/helpers must have production adoption evidence. Unit tests for an unused abstraction
  are not completion. Remove superseded behavior after its consumers migrate.
- Preserve user changes and working data. Use owned disposable resources, not the ordinary configured
  database, attachment root, or an unrelated server.
- Run focused checks during development; repeat the full automated suite on the final versioned tree.
  Phase completion uses the changed surface and affected consumers, not an automatic full run.
  Backend-only phases use API lint/typechecks and affected API tests; shared backend infrastructure
  warrants the full API suite. Frontend-only phases use affected frontend checks and browser flows;
  shared contracts include affected consumers. Docs-only edits need link/format checks. Dependency,
  toolchain, and cross-cutting changes justify broader gates. Full verification remains required at
  release closeout and the CI merge gate. Record omitted checks as not applicable, not passed, and
  reuse unchanged-code evidence instead of repeating suites after documentation-only updates.
  Machine-readable contracts, fixtures, and build inputs are not documentation-only changes.
  Record failures and diagnostic retries separately from clean acceptance runs.
- Update each phase's status and append concrete completion evidence when that phase is executed.
  Create `verification-notes.md` during implementation, with commands, fixture sizes, counts, versions,
  resource ownership/cleanup, and manual limits. Do not present audit measurements as new results.
- Keep `0.2.9` package/release identity until Phase 21. Update capability documentation when behavior
  changes, but do not publish speculative release links or claim unreleased work is deployed.
- No phase implicitly authorizes a commit, push, merge, tag, npm release, or deployment.

## Release Invariants

The technical design governs implementation details. In particular:

- Angular routes stay lazy; the initial graph must not acquire heavy detail/Markdown/Planning code
  through root coordination services. Existing bundle/style thresholds remain unchanged and warning-free.
- Express remains a transport adapter over transport-neutral handlers. Authorization and domain rules
  stay in services; SQL/locks stay in repositories; shared contracts contain no framework dependencies.
- Effective context includes workspace, actor, project, record, and page kind. Earlier-context success,
  error, and finalization callbacks cannot update current content, options, messages, or drafts.
- Draft protection uses baseline equality, Stay/Discard, and native unload warning, not persistent
  storage or autosave. Discard cannot cancel an already-submitted server mutation.
- Navigation carries one safe origin and at most one immediate record, not nested return stacks.
  URL context does not confer authorization.
- `estimateState` distinguishes null from every integer estimate, including zero. Page position is
  separate from a saved query. Applied chips must not represent unapplied form values.
- V1 report/closeout types and parsers remain frozen. V2 producers carry precise current risk queries
  and count units, with version-aware readers and no historical rewrite.
- Planned/active schedules use inclusive date overlap. Project coordination, operation locks, and
  ordered row locks precede authoritative mutation decisions and previous-state activity.
- Commands retain atomic database state/activity/notifications/snapshots. Attachment storage keeps its
  existing compensation boundary; it is not made atomic by a database transaction wrapper.
- Complete boards, full historical arrays, explicit visible-ID bulk selection, cross-project
  dependencies, two-level hierarchy, and independent parent/child fields remain supported.
- Preserve source/format pairs, normalization/grandfathering, literal fallback, explicit mentions,
  no-op timestamps, tombstones, archived read-only rules, and personal/shared view permissions.
- Keep import's 1 MiB raw CSV policy, existing summary export columns, and the 10,000-row export guard.
  New filters affect which rows export, not the CSV schema. Authored-source preservation continues
  through detail/comments/import; it does not add source columns to summary export.
- Production dependency auditing stays strict. Development exceptions must be advisory/path specific,
  owned, mitigated, and time bounded, not a permanent blanket waiver.

## Phase Overview

This is deliberately more phases than a feature-only sprint. Verification safety precedes data-heavy
work, correctness precedes presentation, and the large detail/Planning/history surfaces have separate
integration boundaries.

| Phase | Deliverable | Status |
| --- | --- | --- |
| 0 | Baseline, inventories, and decision closure | Complete |
| 1 | Disposable verification resources and destructive-operation guards | Complete |
| 2 | Owned browser/full verification, CI, and test-code gates | Complete |
| 3 | Compatible toolchain remediation and bounded advisory gate | Complete |
| 4 | Typed persistence executors and explicit transaction capabilities | Complete |
| 5 | Batched work hydration, query ownership, and page/export evidence | Complete |
| 6 | Project coordination and concurrent cycle lifecycle safety | Complete |
| 7 | Authoritative work/hierarchy/board/dependency commands | Complete |
| 8 | Import transport budgets and structured parser errors | Complete |
| 9 | Live-query/risk policy, estimate state, and versioned snapshots | Complete |
| 10 | Narrow aggregate reads and bounded preview enrichment | Complete |
| 11 | Reactive route/actor context and stale-operation ownership | Complete |
| 12 | Shared draft departure protection in production editors | Complete |
| 13 | Read-first detail and focused editing/collaboration owners | Complete |
| 14 | Bounded return navigation and relevant section targeting | Complete |
| 15 | Shared saved views, applied-query feedback, and work-list ergonomics | Complete |
| 16 | Execution-first Planning and disclosed management | Not started |
| 17 | Complete historical outcome and deliberate closeout destinations | Not started |
| 18 | Portfolio, project navigation, and Quick Find ergonomics | Not started |
| 19 | Public site, current developer guidance, and independent local setup | Not started |
| 20 | Cross-surface acceptance, accessibility, and UAT handoff | Not started |
| 21 | Release identity, documentation closeout, and final verification | Not started |

Each phase depends on completion of the preceding phases. Additional architectural dependencies are
called out below. Fixture extraction is incremental in the phase that needs the scenario; it is not
deferred to a large end-of-sprint seed rewrite.

## Verification Safety And Evidence

Phase 0 uses inspection only. Phase 1 establishes executable resource ownership before any integration
fixture, migration/preservation test, performance fixture, or browser suite is run for this sprint.
Existing commands are not assumed safe merely because they point at localhost or have a skip flag.

The runner owns temporary manifests, a database identity/nonce, canonical marked attachment roots,
selected ports/proxy configuration, and process/container IDs. Validate ownership before destructive
setup and before cleanup. Never print credentials or authored content in evidence.

Default local verification provisions PostgreSQL 16 through Docker without shared volumes. Service
mode requires explicit administrative provisioning access and creates its own run database. Neither
mode resets the ordinary `worktrail` database. Prepared mode is a validated runner state, not an
environment switch that grants permission to reset arbitrary data. If required resources are
unavailable, report the unmet prerequisite; do not substitute working data or declare the phase's
integration acceptance complete.

Cleanup is idempotent and limited to recorded, marker-matching resources. It runs on success, failure,
partial startup, SIGINT, and SIGTERM. SIGKILL/crash recovery requires an explicit validated cleanup
action. An occupied port is a reason to allocate another or fail, never to terminate its occupant.

Approved command names become available in Phases 1-2; Phase 0 does not add them:

```sh
npm run verify
npm run verify -- --mode=api
npm run verify -- --mode=e2e
npm run verify -- --mode=preview
npm run verify -- --mode=editor
npm run verify -- --mode=site
```

Use `--database=service` only with the explicit provisioning configuration documented by the runner.
Database-using direct package tests must validate the same ownership context. Editor-only and
static-site modes must not provision PostgreSQL. The site mode begins with existing asset/link checks
and gains the new release assertions/rendered checks in Phase 19.

Evidence belongs to complete paths: service/endpoint SQL including transaction control, real HTTP
parsing, synchronized PostgreSQL connections, real Angular route reuse, and actual browser rendering.
Record local latency as diagnostic data with fixture/machine conditions, not an ungrounded hosted SLA.

## Phase 0: Baseline And Decision Closure

Goal: establish the exact starting tree, affected owners, compatibility boundaries, and safe execution
inventory without changing runtime behavior.

Scope:

- Review all three planning documents against the latest direction and retain the audit findings as
  baseline inputs. Record branch/commit, staged/tracked/untracked changes, and current release versions.
- Inspect the migration journal/next slot, current unique indexes, JSONB snapshot columns, preserved
  v1 parsers, and actual summary export columns. Do not invent a migration when none is required.
- Inventory every participating cycle/project/work/parent/board/bulk/import/dependency/comment/file/
  watcher command, its transaction entry, and current lock order. Identify cross-project paths and
  project counter allocation; list the producers of lifecycle activity/notifications/snapshots.
- Inventory editable routes and form-reset paths, including inherited route IDs, report evidence
  refresh, actor selection, Quick Find navigation, and same-record fragments.
- Inventory live query fields across HTTP/SQL/forms/URL/chips/views/links/export, plus frozen v1
  query differences. List snapshot producers and all read/Markdown/print/replay consumers.
- Locate actual frontend state/client owners and duplicate saved-view/filter code. Record where the
  proposed extraction can reuse existing components rather than create parallel owners.
- Inspect the verification scripts, test fixture cleanup, proxy, storage reset, CI, supported local
  Node/Angular/TypeScript/Drizzle toolchain, and unchanged production budgets.
- Refresh dependency metadata/advisory paths read-only and choose the bounded compatible-update
  candidates to investigate in Phase 3. Record the maintainer ownership/expiry policy and exact
  verification command/manifest naming. No dependency installation is part of Phase 0.
- Record the current site/resource structure, local-run instructions, screenshot needs, and means of
  confirming the Pages base path before metadata changes.

Out of scope: application edits, dependency installation, version changes, database connections/
resets/migrations, runtime tests, provisioning, and server startup.

Acceptance:

- All required scope maps to an owner and later phase; no unresolved product decision blocks Phase 1.
- The command/context/query/snapshot inventories are concrete enough to catch omitted participation.
- Resource safety and tooling investigation have explicit boundaries without exposing credentials.
- Phase 0 completion evidence records actual baseline facts, not copied previous-sprint assumptions.

Verification: repository/configuration inspection and planning-document link/consistency checks only.

Status: Complete (October 17, 2026).

### Completion Evidence

#### Repository And Schema Baseline

- Repository: `/Users/jeremyaaron/Projects/worktrail`; branch `v0.3.0`, commit `4e508cc`, the v0.2.9
  merge shared by local `main` and `origin/main`. The older `pm-reference` environment path is not the
  repository path used for inspection.
- Index and tracked worktree are clean. The six existing v0.3.0 audit/planning files are untracked and
  preserved. Phase 0 changes only PRD/design/plan documentation; it does not stage or commit anything.
- Root/API/web/contracts manifests, lockfile root, internal API contract dependency, README/site, and
  OpenAPI identify `0.2.9`. Release identity remains unchanged until Phase 21.
- Migration journal ends at index 19, `0019_nosy_junta`; `0020` is the next free slot. Existing estimate/
  due-date columns and JSONB report/closeout columns support this design without a planned mandatory DDL
  change. No SQL constraint pins snapshot JSON to version 1. Any later index/DDL needs its own evidence.
- Cycle schema retains date-range/target/status checks and partial unique indexes for one nonarchived
  active cycle and nonarchived case-insensitive names. There is no range exclusion constraint. Use
  cooperative transaction-scoped coordination, not a new PostgreSQL extension or automatic data repair.
- Summary export has 19 columns ending in `parent_key` and `parent_title`, with no description source/
  format columns. Preserve its schema, 10,000-row cap, and full-filter semantics.
- Local tools: Node `20.19.1`, npm `10.8.2`; lockfile resolves Angular core/compiler `20.3.33`, CDK
  `20.2.14`, build/CLI `20.3.31`, TypeScript `5.9.3`, Drizzle ORM `0.45.2`/kit `0.31.10`, pg `8.22.0`,
  Playwright `1.61.1`, Markdown parser `15.0.2`, root Vitest `4.1.9`, and Angular's optional Vitest `3.2.6`.
- Initial budgets remain 550 kB warning/1 MB error; component styles remain 8 kB warning/12 kB error.
  This phase inspected configuration, not build output or the current browser experience.

#### Closed Verification Choices

| Choice | Implementation Baseline |
| --- | --- |
| Entry point/support | `scripts/verify.mjs`, focused `scripts/verification/` helpers, shared ownership validation, built-in Node tests for resource logic |
| Local database | PostgreSQL 16 Docker container per invocation, random loopback port, run credentials/name, no shared volume; no ordinary DB fallback |
| Service mode | `--database=service` requires `WORKTRAIL_VERIFY_ADMIN_DATABASE_URL`; create a fresh run database rather than reset the supplied administrative database |
| Run directory | OS temporary `worktrail-verify-<unique suffix>`; `manifest.json` mode 0600; canonical marked parent; resettable `attachments/` child |
| Database identity | `worktrail_verify_<UUID hex>` plus a database comment containing a versioned Worktrail run ID/nonce marker; verify `current_database()` and comment before mutation |
| Internal execution | `WORKTRAIL_VERIFY_MANIFEST`, `WORKTRAIL_VERIFY_NONCE`, and runner-provided explicit child database/storage/ports; flags alone grant no permission |
| API tests | Guarded integration project and database-independent unit project; preserve source alias; classify every database-using test before mutation |
| Modes | Full, api, e2e, preview, editor, site; Phase 1 implements API/resource safety and rejects unfinished modes; Phase 2 completes remaining modes |
| Prepared execution | Internal validated runner state only; existing skip flags can avoid repeated work but cannot bypass proof |
| Interrupted runs | Record resources on acquisition; finally/SIGINT/SIGTERM cleanup; `--cleanup <manifest-path>` for marker-validated abandoned runs, never global sweeps |
| Concurrent runs | Unique ports/proxy/storage/results and owned preview artifacts; coordinate only unavoidable shared-checkout build steps, never reuse unrelated servers |
| Evidence | Sanitize connection/config output; retain caller-owned result artifacts outside temporary cleanup roots |

These are implementation choices, not resources provisioned in Phase 0. In the inspected shell,
`DATABASE_URL`, `API_PORT`, and attachment overrides are unset; root/API/web `.env` files are absent.
The API's fallback is the ordinary local `worktrail` database, which must never be assumed disposable.
Docker readiness and service administrative privileges remain Phase 1 runtime prerequisites, not
Phase 0-tested facts.

Current unsafe entry points are `e2e/global-setup.ts`, `global-teardown.ts`, `reset-demo-database.ts`,
database-backed `apps/api/tests/*.test.ts`, and executable database/seed/performance scripts. API tests
open pools and clean workspaces directly; browser setup resets and teardown can reseed the original
root. `db/reset.ts` proves locality only. The existing filesystem store marker proves store type, not
per-run ownership, and reset removes the entire storage root; the new parent run marker must survive it.

`playwright.config.ts` can select API/web ports but still uses the fixed API-3000 proxy. Editor tests
are already database-free; compiled preview uses built assets and explicit production configuration.
API tsconfig already includes tests, but API lint excludes them and E2E/config/support coverage needs
explicit lint/typecheck gates. CI currently resets its service's `worktrail` database before tests;
Phase 2 changes it to run-owned provisioning while retaining all existing gate types.

Initial guarded API test inventory (filenames under `apps/api/tests/`):

```text
attachment-concurrency.test.ts        attachment-endpoint.test.ts
attachment-seed.test.ts               attachment-service.test.ts
authored-content-migration.test.ts    comments-activity.test.ts
labels.test.ts                       milestones.test.ts
my-work.test.ts                      notifications-watchers.test.ts
planning.test.ts                     portfolio.test.ts
project-cycle-closeout.test.ts        project-cycle-service.test.ts
project-cycles.test.ts                projects-members.test.ts
quick-find-repository.test.ts         quick-find-sql.test.ts
repositories.test.ts                 saved-work-views.test.ts
status-reports.test.ts                work-item-csv-import.test.ts
work-item-relationships.test.ts       work-items.test.ts
workspace.test.ts
```

These 25 files directly reference database construction in the inspected tree. Phase 1 must also
follow helper/child-process imports before final classification; a filename allowlist alone cannot
prove that an unlisted test is database-free. Centralize guarded workspace cleanup under
`apps/api/tests/support/workspace-fixtures.ts` and named import-safe demo data under
`apps/api/src/db/seed-scenarios/`, extending those owners only as each phase needs fixtures. Existing
`db/seed.ts` and performance scripts execute at module scope, so never import them for identity constants.

#### Command And Transaction Inventory

Service filenames below are relative to `apps/api/src/services/`.

| Production Commands | Current Boundary Or Locking | Required Owner And Phase |
| --- | --- | --- |
| `project-service.ts`: create, metadata update, archive/reactivate | Create uses optional transaction wrapper; existing metadata/lifecycle writes and activity use root repositories | Explicit capability in 4; exclusive project coordination/atomic metadata and lifecycle in 6 |
| `project-cycle-service.ts`: create/update/archive/reactivate | Optional transaction; availability checks and current cycle reads without project serialization | Exclusive project coordination, reread and ordered cycle locks in 6 |
| `project-cycle-closeout-service.ts`: close/replay | Optional transaction; source cycle then destination cycle then ordered source work; snapshot/activity/movement in callback | Required capability in 4; project exclusion and ordered cycles in 6; shared work-row protocol in 7 |
| `work-item-service.ts`: create/PATCH | Optional transaction; PATCH locks current work; child creation locks parent before allocating project counter | Shared project gate in 6; hierarchy/board operation locks and counter-before-work ordering in 7 |
| Work status/board moves and bulk actions | Transaction callbacks, but status/board/bulk current reads are not uniformly authoritative locked reads; bulk commits per item | Shared gate in 6; focused commands, true previous values, board order and partial success in 7 |
| Parent assignment and hierarchy-affecting edits | Set-parent uses ordered requested/current work IDs; creation/type/parent paths need one hierarchy protocol | Shared project/hierarchy key, complete affected lock set and reread in 6-7 |
| `work-item-csv-import-service.ts`: apply | Optional outer transaction; calls work creation with supplied repositories; prevalidation precedes transaction | Bound context in 4; project gate in 6; all required operation locks before row loop and atomic revalidation in 7 |
| `work-item-relationship-service.ts`: add/remove | Optional transaction; supports cross-project edges; reachability validation has no serialized graph key | Both project keys in order in 6; workspace graph serialization/ordered records and atomic evidence in 7 |
| `comment-service.ts`: create/edit/delete | Optional transaction; edit/delete lock comment before contextual project/work checks; creation mentions/notifications use supplied repositories | Required capability in 4; shared project gate in 6; canonical work-before-comment order and preserved no-ops in 7 |
| `attachment-service.ts`: upload/remove | Required DB; project FOR SHARE -> work FOR UPDATE -> attachment when present; object write/compensation separate | Retain compensation and ordering, adapt capability/project gate in 4/6; regress adjacent locks in 7 |
| `work-item-watcher-service.ts`: watch/unwatch | Root repositories; no transaction capability in service/handler context; archived check precedes write | Explicit capability/route plumbing in 4; shared project coordination in 6; retain watch semantics |
| `milestone-service.ts`, `label-service.ts`: create/update/archive/reactivate | Optional transactions and project-writable checks; reference lifecycle not serialized with assignment | Required capability in 4; exclusive project administration gate in 6 to protect reference validation |
| `project-status-report-service.ts`: publish | Optional transaction, v1 snapshot validation/generation and report persistence; later reads/Markdown hydrate evidence | Required write/read context in 4; shared publication project gate in 6; version compatibility in 9 |
| `saved-work-view-service.ts`: create/update/delete/query/pin | Root writes; shared-view activity can follow separately; project scope has archived mutation restriction | Required atomic mutation context in 4; shared project gate for project scope in 6; production view behavior in 9/15 |

Workspace saved views and Inbox read-state changes do not acquire a project lock. No parent/label/
watch command may silently gain new role restrictions from this coordination change. New project
creation has no preexisting project key to coordinate; preserve unique workspace/key validation and
its own transaction. Lifecycle evidence includes project/label/milestone activity, work field/status/
hierarchy activity, creation/status/assignee/comment/dependency notifications, and closeout movement/
snapshot records. Keep each applicable effect inside its command's database transaction.

Canonical order is project coordination -> hierarchy/graph/board keys -> updated project counter ->
cycles by ID -> work by ID -> dependent rows by ID -> writes/evidence. Preliminary reads may locate
IDs, not decide a transition or previous value. Exclusive reference administration prevents archived
milestone/label validation racing ordinary shared work writes. Ordered work repositories already
exist; retain them rather than replacing them with unordered locks. No lock was acquired or race
reproduced during this inspection phase.

#### Frontend Context And Adoption Inventory

Paths below are relative to `apps/web/src/app/`.

| Current Owner | Baseline Finding | Implementation Phase |
| --- | --- | --- |
| `features/projects/project-shell/`, home, Planning, milestone review, report routes | Snapshot-only computed IDs cache; milestone subscription still reads cached values | Reactive inherited identity and request generations in 11 |
| `features/work-items/work-item-detail-page.component.ts` | Existing param/actor handling and stale-operation protection; detail/status/comment/reset functions remain interleaved | Preserve/standardize context in 11; independent draft registration in 12; focused owners/read-first UI in 13 |
| `work-item-create-page.component.ts` | Project/cycle/parent seeds read from snapshot; project/actor changes can reset the form | Guard effective seed/project/actor changes and numeric/null baselines in 11-12 |
| `project-status-report-draft-page.component.ts` | `loadDraft()` clears evidence and resets all narrative fields on success | Separate same-context evidence refresh from narrative baseline in 11-12 |
| `core/current-user.service.ts`, `app.ts` | Interactive selection commits signal/localStorage immediately; startup also reconciles selection | Guard interactive commit, preserve bootstrap-only reconciliation in 12 |
| `features/quick-find/` | Lazy CDK dialog closes on navigation; result navigation closes before awaiting router success; query is dialog-local | Guard dismissal in 12, returns/targets in 14, identity-scoped query session/refinement in 18 |
| Project/workspace Work pages and `state/work-list-query.store.ts` | Both use the query store, but options/view subscriptions and CRUD/message state remain duplicated | Generation/client migration in 11; shared saved-view adoption in 15 |
| `state/saved-views.store.ts`, `query/work-item-filter-labels.ts` | Tests exist but no production page imports; current labels helper is string-based, not stable-key removal policy | Harden/adapt existing files, prove both page consumers, remove duplicates in 15 |
| Existing detail summary/parent manager/children/files/activity components; Planning cycle/milestone/review components | Useful focused presentation already exists | Reuse/extend in 13/16/17; do not build parallel component families |

There are no departure guards registered in current routes. Draft participants are detail fields/
source-format, new comment plus explicit recipients, comment edit, initialized creation values, and
report title/date/narrative. Success updates its own baseline; context/disclosure/preview and generated
evidence are not alternate authorities. Require real route reuse and delayed auxiliary completion
tests, not snapshot replacement alone. Current `#files` targeting is the shared section-target starting
point; Inbox already carries `/inbox` return but no comment fragment. Parent/child, dependency, result,
and creation links need the bounded origin/immediate policy in Phase 14.

Touched state uses existing `core/api/{work-items,saved-views,planning,cycles,projects,notifications,
attachments,quick-find}-api.ts` clients as applicable. Retain the facade only for untouched consumers.
Current `WorkListQueryStore`, `ProjectBulkTriageStore`, authored viewer/editor, attachments, and CDK/
Lucide integration are existing production patterns, not candidates for framework replacement.

#### Live Query And Historical Compatibility Inventory

Current `WorkItemQuery` has 20 fields. The compatibility inventory is:

| Fields | Current Boundary And Required Preservation |
| --- | --- |
| `projectId`, `archivedProjects` | Workspace discovery only; project route/saved-view scope strips them intentionally |
| `status`, `workState` | API accepts either, not both; project frontend currently drops `workState`, so exact open-risk links require codec/form repair |
| `assigneeId`, `assigneeState`, `reporterId` | API supports assigned/unassigned; project codec omits assignee state, workspace maps unassigned sentinel but not all assigned-state cases |
| `type`, `priority`, `labelId`, `milestoneId`, `cycleId` | Preserve canonical applied values/reference lifecycle through count/page/export/view/link paths |
| `dueDateState`, `blocked`, `dependency`, `workRisk` | Preserve actual predicate meaning, including false booleans; backend project link drops `blocked`, workspace live chips omit risk |
| `hierarchy`, `parentKey` | Mutually exclusive at API; exact parent normalizes uppercase; backend current project link drops both; v1 snapshot query schemas omit both intentionally |
| `search`, `sort` | Existing trimmed/bounded current search and sort defaults stay in current policy, not retroactively imposed on historical schemas |
| New `estimateState` | Phase 9 adds null/non-null predicate end to end; zero is estimated; risk links also retain open/cycle scope |
| Separate `page`, `pageSize` | Preserve origin/result position and top/bottom navigation; never save as definition fields |

`validation/work-item-query.ts` and `repositories/work-item-query-builder.ts` own server interpretation;
`query/work-item-query-serialization.ts`, filter state/options, API clients, and the query store own
frontend conversion. `services/work-item-query-link.ts` supports only 14 current string keys, omitting
assignee state, blocked, and hierarchy/parent as well as the future estimate field. Phase 9 repairs
the whole applicable live pipeline, not just adding an optional contract property. Preserve current
validation conflicts for status/state, assignee/unassigned, blocked/status, and hierarchy/parent.

Freeze v1 before evolving current query/health types. Report v1 accepts nonempty string IDs and strips
unknown object keys in its existing Zod shapes; closeout v1 uses UUID IDs and strict objects plus count/
destination/item refinements. Both omit hierarchy/parent and the future estimate field. Do not tighten
one to match the other, import current defaults/limits, or infer units into stored v1 messages.

Snapshot producer/consumer inventory:

- Producers: report draft/publication in `project-status-report-service.ts`, closeout in
  `project-cycle-closeout-service.ts`, deterministic seed/test fixtures. Both production writers emit v1.
- API readers: both validation modules, closeout mapper/replay/cycle review/Planning, report DTO/detail/
  summary/Markdown renderer, and Portfolio's latest-report parser.
- Angular readers: report draft/detail/print, cycle review, closeout page/result, Planning outcome, and
  their contract/component fixtures. No consumer may assume every returned snapshot is new v2.
- Compatibility requirement: `cycle-review-model.ts` currently puts broad open-cycle queries into
  `unestimated_work` health reasons captured by both producers. Exact `estimateState` plus explicit
  `countUnit` therefore requires v2; old v1 draft publication/replay/read behavior remains supported.

Use `countUnit` values `work_items`, `milestones`, and `scope_conditions`, narrowed where appropriate.
Scope-aware descriptions and UTC date primitives live with current policy; v1 definitions stay frozen.
Batch hydration is extracted before commands/aggregate enrichment; narrow aggregate evaluation can
still scan all relevant rows for exact facts and must not silently cap counts or historical arrays.

#### Dependency And Public Site Disposition

Read-only npm audit on October 17, 2026 reports zero production findings and 34 full-tree findings
(8 moderate, 21 high, 5 critical). These are refreshed dependency metadata results, not a claim that
application tests or security exploitation checks ran. Direct affected paths include Angular build/
CLI, Vitest, concurrently, Karma integrations, and drizzle-kit. Current and candidate manifests plus
`npm explain vitest --json` confirm two distinct Vitest graphs.

| Phase 3 Candidate | Metadata Evidence And Limit |
| --- | --- |
| CLI/build `20.3.31` -> `20.3.40` | Existing ranges allow it; candidate CLI uses MCP SDK `1.31.0`, build uses Piscina `5.3.2`; build still requires Angular 20, TypeScript >=5.8 <6, and optional Vitest ^3.1.1 |
| API/contracts Vitest `4.1.9` -> `4.1.11` | Existing ^4.0.14 allows it; Node 20.19.1 meets candidate engines; maintainer advisory identifies 4.1.11 fix, but this does not replace Angular's nested 3.x dependency |
| concurrently `9.2.3` -> `9.2.5` | Existing ^9.2.1 allows it; candidate declares shell-quote `1.12.0`; no concurrently major change required |
| Other compatible transitive fixes | Resolve only within actual owner ranges, then audit the new lock graph; candidates alone do not establish whole-tree remediation |
| Karma/Drizzle/nested optional paths | Investigate upstream-supported same-line options and genuinely unused peers; no forced downgrade, broad override, or framework/test-runner migration |

Registry metadata and [Angular's compatibility table](https://angular.dev/reference/versions) support
the local Node/TypeScript compatibility investigation. The
[Vitest maintainer advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)
provides the fixed-version boundary. No candidate was installed, and no residual advisory exception
was approved in Phase 0. Phase 3 must inspect the actual resulting dependency paths and command exposure.
Exception owner is repository maintainer `jeremyaaron`; use an initial absolute expiry cap of
November 16, 2026 or v0.3.1, whichever comes first, and never extend beyond the PRD's release-relative
30-day limit. Production-reachable findings cannot use a development-only exception.

GitHub CLI read access successfully returned the Pages configuration: workflow hosting at
`https://jeremyaaron.github.io/worktrail/`. No deployment was triggered or deployed page inspected.
Phase 19 can use that verified base path after rechecking configuration, and must independently test
actual deployed metadata/link availability after user-controlled publication.

Current site is `site/index.html`, `styles.css`, the existing brand mark, and board/detail PNGs. Preserve
brand and static Pages hosting; replace the feature/Baseline/Operations inventory with four workflows
and fresh readable proof points after UX work. Site setup currently switches to a different absolute
attachment root only after seed; README already describes a better aligned preview root. Reconcile
the paths and independently prove dev/compiled deep links plus exact seeded bytes in Phase 19.
Current developer guide destination is `docs/development.md`; keep operations/upgrade references and
archived `v0.0.X`/`v0.1.X` paths accurate, and release/pattern notes destination-neutral.

#### Verification And Handoff

Phase 0 used git/file/configuration inspection, Node/npm version and manifest reads, read-only npm
audit/registry/explanation calls, maintainer/compatibility documentation, and a GitHub Pages GET.
Planning links/status/phase sequence/whitespace were checked after editing. No runtime test, build,
schema generation, database connection/reset/migration/seed, Docker provisioning, dependency install,
or application server ran. No owned runtime resources were created, so no cleanup was required.

PRD scope, technical baseline, plan, exact runner naming/ownership, transaction participation, query/
snapshot compatibility, and tooling investigation choices are closed. Phase 1 is ready to implement
disposable verification safety; Phases 1-21 remain unstarted.

## Phase 1: Disposable Verification Resources And Guards

Goal: make API/data verification safe before using it to change persistence and concurrency behavior.

Primary boundaries: `scripts/`, root scripts, API test/support setup, reset/seed entry points used by
tests, and existing storage safety helpers.

Scope:

- Add the Node verification runner/resource owner with unique run IDs, restrictive manifests, and
  explicit full/focused mode selection. Implement the API mode first; unfinished modes fail clearly.
- Provision a uniquely labeled PostgreSQL 16 Docker container with random loopback port, isolated
  credentials/database, and no shared volume. Implement opt-in service provisioning into a unique
  owned database with an explicit admin connection.
- Store/validate the live database name plus nonce/ownership marker outside the resettable application
  schema. Track temporary storage/config roots with markers outside resettable object subtrees.
- Require that validated context before database-using test fixtures clean, seed, reset, or mutate.
  Retain explicit operator reset commands without making them the ordinary verification path.
- Implement prepared-state handling without accepting locality, naming conventions, `CI=true`, or
  skip flags as sufficient ownership proof. Fail without Docker rather than using `.env` implicitly.
- Record acquired resources immediately; add idempotent finally/signal/partial-start cleanup and
  explicit marker-validated abandoned-run cleanup. Keep sanitized evidence outside removed roots.
- Centralize the integration fixture ownership check and cleanup entry point. Move only support code
  necessary for this adoption; importing IDs/builders must not connect or seed.

Acceptance:

- API mode migrates/tests against owned data and leaves normal local databases/storage unchanged.
- Direct destructive test setup refuses a missing/mismatched marker before its first mutation.
- Failed provisioning and interrupted API runs remove only their own acquired resources.
- Service-mode cleanup verifies identity before dropping its database or terminating its sessions.

Verification: runner unit tests for argument/ownership/cleanup failures; real Docker/service-mode
provisioning, migration, fixture rejection, API tests, and partial-start/SIGINT checks. Use throwaway
sentinel resources for rejection tests, never destructive probes against the user's database.

Status: Complete (October 17, 2026).

### Completion Evidence

- Added `scripts/verify.mjs` and focused resource/ownership/process helpers. API mode provisions
  disposable PostgreSQL 16 through Docker by default; explicit service mode creates a new database
  using `WORKTRAIL_VERIFY_ADMIN_DATABASE_URL`. Unfinished modes fail clearly without provisioning.
- Private manifests and marked temporary parents record the run UUID, nonce, database, storage,
  container labels, owner, and child process identities. Live database comments survive schema reset;
  attachment ownership stays outside the resettable objects. Validation rejects target overrides,
  symlinks, mismatched identities/markers, and test/skip flags without proof.
- API tests retain source-alias resolution and now separate 26 database-independent unit files from
  guarded integration files. Unclassified new tests default to integration. A shared checked cleanup
  owner replaces duplicated workspace cleanup in 23 integration files.
- Test-context migration/seed/reset/storage/performance entry points and legacy browser setup,
  teardown, and per-test reset validate ownership before mutation or skip-flag returns. Explicit
  ordinary operator commands retain their existing behavior and storage safety checks.
- Cleanup covers normal completion, command failure, partial Docker startup, SIGINT/SIGTERM, and
  explicit abandoned runs. It refuses active owners and mismatched database/container/process
  identities. Child output redaction, stderr draining, and bounded deadlines have regression tests.
- Final standalone `npm run verify -- --mode=api` passed 16 resource tests and all 601 API tests in
  51 files, with successful resource cleanup. `npm run test:verification:integration` passed all
  8 real lifecycle checks, including a complete service-mode API run. Service provisioning used a
  disposable Docker-hosted administrator, not the user's local PostgreSQL instance.
- API lint, typecheck, and build passed. A concurrent diagnostic run encountered one `socket hang up`
  in an existing HTTP boundary test (600/601 passed); it exited nonzero and cleaned successfully.
  The subsequent standalone run passed without retries or test changes. Both outcomes are retained
  in [verification notes](verification-notes.md), not combined into a clean concurrent-run claim.
- README documents supported commands and prerequisites. No dependency, lockfile, release-version,
  frontend behavior, or CI workflow changes were made. Browser/full orchestration and CI migration
  remain Phase 2; the legacy direct integration-test CI sequence now requires that migration.

## Phase 2: Owned Browser Workflows And CI Gates

Goal: expose the complete safe verification entry point and remove ad hoc browser environment assembly.

Primary boundaries: root scripts, `playwright*.config.ts`, `e2e/`, `eslint.config.js`, test tsconfigs,
`scripts/verify.mjs` and support, and `.github/workflows/ci.yml`.

Scope:

- Complete full/e2e/preview/editor/site modes and route application E2E/UI commands through the owner
  without recursive invocation. Validate internal Playwright setup/teardown context.
- Generate an absolute proxy config from the selected API endpoint; propagate chosen API/web/preview/
  editor ports and one absolute storage root before seeding and into runtime children.
- Disable unrelated server reuse, verify child readiness ownership, handle bind handoff races with
  bounded retries, and fail explicitly requested occupied ports without killing their occupants.
- Remove browser teardown restoration of the ordinary configured demo database/storage. Any per-test
  reseed remains inside validated owned resources.
- Give each test invocation distinct traces/results/temp config; make cleanup wait for owned process
  descendants and preserve the original failure when cleanup also fails.
- Isolate build/cache outputs where supported. If a shared-checkout build step cannot be isolated,
  coordinate only that step and retain run-owned preview artifacts before releasing it; parallel
  verification must not serve files another run is rebuilding or delete another run's evidence.
- Add scoped lint/typecheck coverage for API tests/support, E2E/config files, and runner support without
  weakening production strictness or hiding entire directories.
- Switch CI to explicit service provisioning and the owned full runner. Preserve gate-by-gate output,
  production audit, native editor, application E2E, compiled preview, and failure artifacts.
- Retain cold-checkout contracts-source test resolution. Run release browser acceptance without
  retries; keep any diagnostic retries separate.

Acceptance:

- Full/focused documented commands work without manually wiring database/ports/storage/proxy values.
- Two concurrent runs on nondefault ports cannot share data, traces, servers, or cleanup targets;
  interrupting one leaves the other usable.
- Editor/site modes do not access/provision PostgreSQL or reset attachment data.
- Cold API tests need no prebuilt contracts; compiled preview still uses production exports/assets.

Verification: full baseline owned run, parallel/signal/port-collision scenarios, editor-only independence,
lint/test-code typechecks, and CI configuration review. Remote CI success is separate evidence from the
local runner passing.

Status: Complete (October 17, 2026).

### Completion Evidence

- `npm run verify` now defaults to full verification; API/E2E/preview/editor/site modes and root
  application/browser UI commands use the same owner without recursive invocation. UI completion
  is explicitly interactive, not a passing automated test result.
- Runs snapshot source, config, documentation fixtures, and package links into private workspaces.
  Builds, caches, editor compilation, native browser profiles, and compiled previews do not share
  writable checkout outputs. Ports are selected before migration/seed and propagated with one
  absolute storage root. The generated proxy targets the owned API; copied Angular configuration
  disables persistent caching/prebundling without modifying developer configuration.
- Playwright consumes validated context and starts no servers itself. Readiness checks the child
  fingerprint and run-specific HTTP identity. Missing/mismatched API ports or host cannot fall back
  to port 3000. Explicit occupied ports fail without killing occupants; automatic handoff conflicts
  have bounded startup retries, never test retries.
- Browser teardown restoration was removed. Fixture resets still validate live database ownership;
  fresh stores are initialized before reset and seed. Normal, failed, partial, signal, and explicit
  abandoned cleanup retain the Phase 1 guards. Detached browser groups observed under an owned child
  are recorded and stopped; secondary cleanup failures preserve the original test/startup failure.
- Added scoped lint/typecheck gates for API tests/support/config, browser/config TypeScript, runner
  support, and the real editor benchmark Window contract. Fixed the newly covered unused import and
  masking cleanup throw without weakening production strictness. Karma/Jasmine retain their suite
  and use Playwright's installed Chromium through a small launcher with private profile/port.
- Final full Docker verification passed 25 resource tests, 601 API tests (51 files), 54 contracts
  tests (12 files), 652 Angular tests, 5 editor browser tests, 34 application E2E tests, and 1 compiled
  preview test. Audit/lint/typechecks/build/site gates passed; production audit found zero findings,
  initial production output was 386.62 kB, and unchanged production budgets emitted no warnings.
- All 10 real lifecycle checks passed on the final code with no skipped cases. Two simultaneous
  nondefault-port app runs rendered successfully; interrupting one removed only its resources while
  the other reloaded, retained its SQL/file sentinels, and passed its focused browser regression.
  Editor interruption proved database/Docker independence and exit of real Chromium descendants.
- CI now installs dependencies/browser runtime and invokes owned full service-mode verification,
  preserving visible gates and failure artifacts. A local full service-mode baseline also passed
  against an owned Docker administrator; remote CI was not dispatched. README and
  [verification notes](verification-notes.md) record commands, counts, diagnostics, and limits.
- Earlier setup failures, a fixture request-environment leak, and concurrent transient HTTP/render
  failures remain separate diagnostic evidence. They were not accepted via retries or timeout
  increases. All accepted runs cleaned their owned resources; no working database/storage or
  unrelated server was reset or stopped. Versions, dependencies, and lockfile remain unchanged.

## Phase 3: Compatible Toolchain Remediation

Goal: address dependency risk early without coupling feature work to a framework migration.

Primary boundaries: package manifests/lockfile, audit tooling/exception records, and runner/CI gates.

Scope:

- Refresh production/full audits and dependency explanations. Associate findings with advisory ID,
  exact path, affected command, exposure, and a compatible maintainer-supported remedy.
- Apply verified compatible direct patches/minors and remove genuinely unused tooling in a distinct
  change. Keep Angular/compiler/build/CLI/CDK, TypeScript, and Node compatibility coherent.
- Reject forced fixes, unrelated major migrations, broad overrides, and npm-suggested downgrades as
  shortcuts. Document a larger migration as follow-up rather than silently expanding this sprint.
- Record remaining development exceptions individually with mitigation, repository-maintainer owner,
  exploit preconditions, exact path/command, and expiry no later than v0.3.1 or 30 days after v0.3.0,
  whichever comes first. Use concrete dates before finalization; do not give an unreleased sprint an
  indefinite exemption.
- Add an audit gate that detects new/unaccounted findings and expired exceptions, distinguishes audit
  transport failure from a clean result, and keeps production auditing strict.
- Verify schema generation in an owned scratch context without leaving generated migration churn,
  migration/preservation behavior, native editor, lazy graph/budgets, both server modes, and runner
  isolation after updates.

Acceptance:

- Production audit is clean; every remaining full-audit finding is remediated or specifically bounded.
- Tooling changes are compatible and reproducible from the lockfile, not just a lower vulnerability count.
- Unknown advisory/path and expired-exception fixtures fail the gate; the report never conflates full
  and production-only auditing.

Verification: clean install on the changed lockfile, audit gate tests, owned full verification, schema/
migration checks, and recorded dependency/version/exception evidence.

Status: Complete (October 17, 2026).

Completion evidence:

- Angular CLI/build `20.3.40`, API/contracts Vitest `4.1.12`, concurrently `9.2.5`, and compatible
  transitive security updates are lockfile-reproducible. Angular runtime/compiler `20.3.33`, CDK
  `20.2.14`, TypeScript `5.9.3`, and Drizzle ORM/Kit remain in their existing lines. No forced fixes,
  broad overrides, framework migration, or suggested downgrade was used.
- Node 24 LTS/npm 11 replace the EOL Node 20 local/CI baseline; `.nvmrc`, engines, workflow, and
  README agree. Acceptance used installed Node `24.16.0` and npm `11.13.0`. A lower-count npm-pruned
  optional peer graph was rejected because it exposed incompatible Vitest 4 to Angular's ^3 peer.
  The explicit web Vitest `~3.2.7` binding preserves valid peers and the active Karma builder.
- Production audit is zero. Full auditing fell from 34 to 13 findings (5 moderate, 6 high, 2 critical),
  tracing to five advisory IDs and 19 exact fingerprints. Each remaining development advisory has
  commands, paths, preconditions, mitigation, follow-up, owner `jeremyaaron`, and expiry at
  00:00 UTC November 16, 2026 or v0.3.1, whichever is first. Phase 21 must set the actual release date.
- `npm run audit:dependencies` and the full runner enforce installed peer validity, separate strict
  production/full reports, exact advisory/path/version/severity matching, expiry/release limits,
  stale/duplicate record removal, and fail-closed transport/JSON/status handling. Private snapshots
  check their matching real read-only installation owner, not an artificial npm mirror graph.
- Clean `npm ci`, full owned run `4e3aad8e-20ab-4bbe-b727-80b305afdd13` (25 gates), and the ten-case
  lifecycle suite passed. Full counts: 41 resource, 601 API, 54 contracts, 652 Angular, and 40 browser
  tests. The final informational audit-threshold refinement passed a fresh audit and 15 focused tests.
- Owned scratch generation matched all 19 tables and SQL/journal/snapshot bytes with no working
  migration churn. Migration/preservation, native editor, dev/compiled server modes, lazy chunks,
  unchanged budgets, concurrent isolation, signals, and cleanup passed. Initial production output
  remains 386.62 kB (104.33 kB estimated transfer), with no budget warnings.
- [Dependency disposition](dependency-remediation.md), [audit evidence](dependency-audit-evidence.json),
  [exception policy](../security/development-audit-exceptions.json), and
  [verification notes](verification-notes.md) retain diagnostics separately from acceptance.
  Package/release identity remains `0.2.9`; remote Linux CI and release acceptance remain later gates.

## Phase 4: Explicit Persistence Capabilities

Goal: make transaction and consistent-read ownership explicit before command/read extraction.

Primary boundaries: `apps/api/src/db/client.ts`, `repositories/index.ts`, repository executor types,
affected service contexts/endpoints, Express composition, and tests/fakes.

Scope:

- Type the repository factory against the real root-or-transaction query executor; remove the
  `unknown as WorktrailDb` transaction cast without loosening repository types to `any`.
- Introduce small required write and read-consistent capabilities at composition. Callbacks receive
  bound repositories and lock access; inner helpers participate without opening nested transactions.
- Migrate the touched work/query/export, cycle/closeout, report, aggregate, and related command paths
  from optional `db` fallback to explicit capability injection. Update tests/fakes in the same phase.
- Include currently unwrapped project metadata/lifecycle, watcher, and saved-view mutations and the
  milestone/label owners; a wrapper change alone cannot make these root-repository writes atomic.
- Preserve read-only repeatable-read count/window/enrichment and write read-committed behavior.
  Make deliberate fake execution explicit; real atomicity/concurrency tests use real transactions.
- Establish typed lock-helper ownership and the inventory/order contract for subsequent phases, without
  claiming lifecycle safety before those commands are migrated.
- Preserve database side-effect rollback and attachment compensation. Do not wrap object-store I/O
  in a claim of distributed atomicity.
- Start the current developer ownership/invariant guide and keep it accurate as later owners move.

Acceptance:

- Production touched services cannot be constructed in a silent nontransactional mode.
- Inner import/export/report helpers reuse their enclosing context and do not begin another transaction.
- Rollback tests cover state/activity/notification persistence and consistent-read tests retain their
  previous guarantees. Health-only/test Express composition can remain explicit without a database.

Verification: API/contracts typecheck and package tests, real rollback/read-consistency checks, and
composition/fake-construction tests through owned API mode.

Status: Complete (October 17, 2026).

Completion evidence:

- `RepositoryExecutor` is structurally supported by real root and transaction executors. Repository
  factories no longer cast a transaction to `WorktrailDb` or expose transaction creation.
- Required `Persistence` capabilities replace optional database fallbacks through service contexts,
  endpoint options, Express routes/startup, and seed report composition. Health-only composition and
  deliberately repository-only tests remain explicit. Superseded transaction helpers were removed;
  their existing repository tests now exercise the capability owner.
- Root writes explicitly use read committed/read write; independent consistent reads use repeatable
  read/read only. Scope-bound service bodies ensure private helpers use scoped repositories. Nested
  import/export/report/cycle helpers participate in the same scope without savepoints. Bulk updates
  retain per-item transactions/partial success. Single-connection query work is sequential, clearing
  the pg concurrent-client-query deprecation without suppressing warnings.
- Previously unwrapped project settings/lifecycle, saved-view, and watcher mutations now share a
  real transaction with their applicable evidence/response hydration. Required ownership also covers
  label/milestone administration and related workspace/member/notification commands. Attachment object
  storage and compensation remain outside the database transaction, with existing regressions intact.
- Typed, namespaced project/operation advisory helpers enforce ordering, no held-lock upgrades,
  mode/lifetime restrictions, and idempotent reentry. Real connection tests prove shared/exclusive
  behavior and release on commit/rollback. Application project-gate adoption and authoritative
  lifecycle/row-order repair remain Phases 6-7; these races are not claimed fixed here.
- Added [the current developer guide](../development.md), linked from README, with ownership,
  isolation inheritance, callback lifetime, lock inventory/order, fake/real testing, and remaining limits.
- Final owned API run `8c1da09d-cecb-4216-8979-817e21998358` passed 630 API tests across 54 files and
  41 resource tests, then removed owned resources. API/contracts typechecks, API/test lint, API build,
  54 contracts tests, and whitespace checks passed. New coverage includes rollback of project/view/
  watcher/state/activity/mention/notification writes, snapshot hydration across a concurrent commit,
  composition refusal, nested ownership, and advisory ordering/lifetime.
- A diagnostic run exposed local HTTP destination ambiguity: Supertest could request an unrelated
  IPv4 listener while its own server occupied IPv6 on the same port. An owned two-server reproduction
  demonstrated it on macOS. API tests now use an address-family-aware Supertest helper; two sentinel
  regressions prove destination isolation. No unrelated process was stopped, test retried, timeout
  raised, dependency changed, working database reset, or release version advanced. Diagnostic failures
  and scoped acceptance limits are recorded in [verification notes](verification-notes.md).

## Phase 5: Batched Hydration And Query Ownership

Goal: remove measured per-row reference fan-out before extracting commands or optimizing dashboards.

Primary boundaries: work-item service/query ownership, member/milestone/cycle/project repositories,
work-item repository, DTO mapping, CSV export, and performance evidence.

Scope:

- Extract the focused query/hydration owner first; retain a forwarding work-service facade where needed.
- Batch distinct reporter/assignee, milestone, cycle, project, label, dependency, parent, and child-summary
  references for selected rows. Preserve row order and workspace/reference lifecycle/null behavior.
- Keep page count/window/all enrichment inside one consistent-read callback. Prevent accidental root
  repository hydration after that callback or per-row mandatory-reference validation queries.
- Reuse hydration for full-filter CSV exports, with bounded ID chunks as needed, unchanged columns/
  ordering, and the 10,000-row limit/overflow behavior. Do not add authored source to list responses.
- Introduce import-safe named fixtures and SQL instrumentation for 10/25/100 fully populated rows,
  including repeated and distinct references, archived/inactive references, hierarchy, and dependencies.
- Capture complete service/endpoint SQL counts including transaction control, payload bytes, enriched
  rows, and diagnostic local timing. Assert <=20 statements for the representative 100-row project
  and workspace page, not merely a hydrator microbenchmark.

Acceptance:

- Page statements do not grow by four per extra row across 10/25/100 rows; both 100-row budgets pass.
- Count/window/enrichment coherence and DTO behavior match baseline, including mandatory/missing references.
- Export ignores pagination but applies every existing query predicate and keeps cap/CSV parity.
- Production consumers use the extracted owner; no duplicate row-by-row hydration remains on these paths.

Verification: project/workspace service and HTTP page tests, export boundary/parity tests, consistent-read
tests, deterministic query budgets, API/contracts checks, and recorded before/after endpoint evidence.

Status: Complete (October 17, 2026).

Completion evidence:

- Extracted `WorkItemQueryService` and `WorkItemHydrator`. Query composition receives actor/persistence
  only, keeping authorization, count/window, hydration, and projection in one consistent-read callback.
  Existing service callers forward to this owner; child/bulk summaries and exports use the same
  hydrator. Superseded list loops, enrichment entry points, and the unused workspace DTO wrapper
  were removed rather than retained as duplicate implementations.
- Reporter/assignee IDs are deduplicated into one member batch, with new milestone/cycle ID batches
  and existing label/dependency/parent/child-summary queries. Workspace project summaries reuse the
  joined selection. Map-based projection preserves input order, valid inactive/archived references,
  mandatory/missing and optional/null behavior. Foreign reference data is not exposed; workspace
  queries scope joined project summaries as well as work rows to the authorized workspace.
- `WorkItemSummary` and narrow page/board/export/parent selections omit unused authored source/format.
  Detail remains authored, and canonical search predicates are unchanged. CSV retains all 19 columns,
  full-filter ordering, pagination independence, and 10,000-row overflow rejection. Sequential
  500-row hydration chunks bound selected/reference IDs while retaining one enclosing snapshot.
- Import-safe 10/25/100-row fixtures and complete service/HTTP SQL instrumentation assert <=20
  statements, including transaction control and actor resolution. Populated project pages use 12
  service/13 HTTP statements, workspace pages 11/12, across all measured sizes and repeated/distinct
  references. Before batching, 100-row costs were 409/410 and 408/409 respectively. Payload bytes,
  rows, and diagnostic timing are retained in [hydration evidence](hydration-evidence.md) and owned
  run artifacts; no latency threshold or microbenchmark substitutes for the complete-path budget.
- Final owned API run `6b5ea786-1d24-4275-9ee9-458210e1adf6` passed 657 tests across 57 files plus
  41 resource tests, then cleaned its resources. Contracts typecheck and 54 tests, API/verification
  typechecks/lint, API build, and whitespace checks passed. New coverage includes snapshot changes
  across another real connection, a real 501-row export, project/workspace CSV parity and exact caps,
  historical/null/missing/foreign references, distinct ID mapping, and source-free projections.
- Updated the current developer guide and design/status documents. Versions, dependencies, budgets,
  schema/migrations, working data, and public-site capability claims remain unchanged. Command/lifecycle
  extraction and dashboard narrowing remain later phases. Diagnostic runs and local-only acceptance
  limits are recorded in [verification notes](verification-notes.md).

## Phase 6: Concurrent Project And Cycle Lifecycle

Goal: enforce schedule/lifecycle decisions under concurrent writers and establish complete project
coordination participation before refining individual work commands.

Primary boundaries: transaction lock helpers, project/cycle/closeout repositories and services, all
participating command entry points from Phase 0, conflict mapping, and lifecycle tests.

Scope:

- Implement namespaced transaction-scoped project advisory locks with stable key ordering, modes
  chosen before acquisition, and no shared-to-exclusive upgrades.
- Use exclusive coordination for project metadata/lifecycle and cycle create/update/archive/reactivate/
  closeout and milestone/label administration. Install shared coordination at every participating
  ordinary work/parent/board/bulk/import/relationship/comment/file/watch/report-publication/project-view
  transaction entry, including all affected cross-project IDs. Workspace views need no project key.
- Reread authoritative project/cycle state after coordination; lock source/destination cycle rows in
  order. Keep inclusive overlap, active/name uniqueness, and archived/completed/canceled exceptions.
- Preserve unique-index backstops and map known violations to controlled application conflicts.
- Align generic cycle edits with closeout/replay so stale updates cannot resurrect a completed cycle.
  Shared work participation must exclude assignment/status writes while closeout enumerates source scope.
- Add a read-only overlap diagnostic and operator remediation guidance. Do not silently reschedule,
  archive, or delete preexisting cycles and do not add an exclusion extension/constraint unnecessarily.
- Keep the command participation inventory in the current guide/tests, including work-key counter and
  attachment ordering concerns whose row-level repair belongs to Phase 7.

Acceptance:

- Synchronized conflicting planned creations cannot both persist; update/create/reactivation and
  inclusive boundary cases obey the same rule.
- Cycle edit versus closeout and assignment versus closeout retain valid lifecycle/scope/replay state.
- Every relevant writer participates; the guarantee is not asserted while unguarded writers remain.
- Unrelated projects can proceed independently; ordinary compatible edits share project coordination.

Verification: synchronized real-connection PostgreSQL tests with bounded timeouts; active/name conflict,
archive/reactivation, closeout replay/rollback, and writer-participation tests; owned API/full regressions.

Status: Complete.

Completion evidence:

- All inventoried project-dependent writes acquire predetermined shared/exclusive transaction-scoped
  project gates; cross-project relationship commands acquire both endpoint projects together in ID
  order. Workspace views and Inbox read-state remain independent. Bulk rereads writability per item;
  import retains atomic apply through a complete scoped creation capability.
- Cycle availability/current-state checks run after exclusion; generic edits lock/reread the cycle,
  and closeout locks source/destination cycles in ID order before enumeration. Existing inclusive
  overlap, active/name uniqueness, historical exceptions, replay, and error contracts remain intact.
  Known unique backstops map to controlled conflicts without exposing database detail.
- Added 83 real-PostgreSQL coordination/diagnostic cases and ten constraint-mapping unit cases. Tests
  observe actual advisory waits before releasing the first writer, validate queued archive/reference
  changes, exercise closeout races and real unique indexes, and prove independent/shared writers.
- Focused owned API verification passed 724 cases during implementation. Final full verification
  passed all 25 gates: 750 API, 54 contracts, 652 Angular, 41 resource, five editor, 34 application E2E,
  and one production-preview test, plus audit/lint/typecheck/schema/build/site checks. Owned resources
  were removed. One diagnostic bulk assertion failure and its contract-preserving correction are
  recorded in [verification notes](verification-notes.md).
- Added the [read-only cycle diagnostic](../cycle-diagnostics.md) and remediation guide, and updated
  the [current participation inventory](../development.md#lock-ownership-and-participation). No working
  data, schema, extensions, dependencies, versions, or budgets changed. Authoritative work/graph/
  hierarchy/board command ownership and row ordering remain Phase 7.

## Phase 7: Authoritative Work And Relationship Commands

Goal: decide mutations and their evidence against locked current state while preserving hierarchy and
complete-board behavior.

Primary boundaries: work command/hierarchy/bulk/board/activity owners, relationship service/repositories,
comment/attachment adjacent lock paths, import transaction helpers, and command tests.

Scope:

- Extract touched command owners behind the existing facade as locking behavior changes. Reuse Phase 5
  queries and Phase 4 transaction contexts instead of interleaving new reads/writes in the large service.
- Apply the documented order: project coordination; hierarchy/graph/board operation keys; updated project
  counter rows; ordered cycles; ordered work rows; ordered dependent rows; transactional side effects.
- Lock authoritative work state before PATCH/status/board permission and transition/change decisions.
  Use locked previous values for activity, preserve no-op timestamps, and revalidate changed lock sets.
- Coordinate hierarchy-affecting edits/child creation and preserve two-level/type constraints. Allocate
  work keys before parent/work row locks rather than upgrading a counter after locking a parent.
- Lock board positioning before neighbor reads/compaction, preserving complete columns and stable order.
  Do not add board serialization to description-only edits unnecessarily.
- Keep cross-project relationships; acquire affected project keys in order and the workspace graph key
  before reachability checks/edge writes. Preserve duplicate and blocking-cycle validation.
- Preserve per-item bulk partial success and explicit IDs. Plan import operation locks before its row
  loop, retain atomic apply, and avoid nested transactions through helper calls.
- Keep comment/file lock participation and work-row-before-dependent-row order compatible. Preserve
  attachment object-store I/O/compensation outside database locking claims.

Acceptance:

- Competing transitions/board moves produce valid ordered state and real previous-state activity;
  rejected commands have no partial activity/notifications.
- Concurrent hierarchy/counter, dependency graph, import, bulk, and closeout interactions terminate
  without lock-order deadlocks or weakened domain rules.
- Existing author-content, comment, attachment, archive, no-op, and visible-ID bulk suites remain green.

Verification: synchronized status/board, hierarchy/counter, and opposing dependency-edge tests; complete
board ordering/compaction; bulk/import transaction/rollback; attachment/comment regression; full API checks.

Status: Complete on October 17, 2026.

Completion evidence:

- Replaced the large work service with a forwarding facade over focused single-command, bulk,
  detail-read, activity, board-position, lock-planning, and write-policy owners. Public service and
  transport contracts remain supported.
- Ordered project/operation/counter/cycle/work/dependent locks protect current-state decisions,
  previous-state evidence, two-level hierarchy, complete-column compaction, and cross-project graph
  validation. Equivalent UUID spellings share coordination keys; changed cycle lock sets conflict.
- Import preplans operation keys before its atomic row loop. Failed bulk item writes roll back before
  partial-error conversion. Comments and explicit watchers follow work-before-dependent-row ordering;
  attachment storage retains its existing compensation boundary.
- Added 33 synchronized real PostgreSQL integration cases and one UUID lock-identity unit regression.
  Final owned full run `e9edfd3a-99ce-4bc3-bf04-6b0635cdb447` passed all 25 gates: 784 API, 54 contract,
  652 Angular, and 41 resource tests; five editor, 34 application E2E, and one compiled-preview test.
  Browser reports contain no unexpected, skipped, or flaky results. Deadlines/retries were not relaxed.
- Audit/lint/typechecks/schema/build/site checks and owned cleanup passed. No working database/storage,
  package version, schema, dependency, or build budget changed. Diagnostic runs and remaining limits
  are recorded in [verification notes](verification-notes.md#phase-7-authoritative-work-commands).

## Phase 8: Import Transport And Structured Errors

Goal: make supported CSV reach domain validation while keeping every transport boundary bounded.

Primary boundaries: Express server/route registration, parser/error/logging adapters, import policy,
attachment boundary, HTTP tests, and OpenAPI request/error documentation.

Scope:

- Register dedicated JSON parsers for CSV preview/apply before the ordinary parser, with a budget of
  `6 * 1_048_576 + 4_096` bytes. Keep raw CSV at 1 MiB and current row/field policies unchanged.
- Keep ordinary JSON explicitly at 100 KiB and attachment raw-binary limits separate. Reject compressed
  JSON safely unless bounded inflation is deliberately supported; do not widen other routes.
- Add a common safe middleware error boundary for malformed JSON, oversized parser input, and encoding
  failures. Reuse the standard JSON envelope without echoing source, parser bodies, or stacks.
- Install safe request timing before parsing, including rejected/aborted requests. Log matched route
  templates/fixed failure categories, status, method, and duration, not raw query/unmatched paths or data.
- Test large valid/escaping-heavy CSV through actual registered HTTP routes, not importer-only calls.

Acceptance:

- Valid input above 100 KiB and near the raw byte limit reaches domain validation within the dedicated
  envelope; CSV policy violations still fail deliberately.
- Invalid JSON/oversized input return safe JSON errors with no mutation or content-bearing logs.
- Unrelated JSON and binary limits, attachment lifecycle, and endpoint neutrality remain intact.

Verification: full-boundary HTTP preview/apply, byte/escaping/encoding/error-log assertions, import
regressions, attachment boundary tests, and API/OpenAPI consistency checks.

Status: Complete on October 17, 2026.

Completion evidence:

- Added exact-route import JSON parsing before the explicit 100 KiB ordinary parser. Preview/apply
  allow 6,295,552 transport bytes while raw CSV stays at 1 MiB with existing row/source limits.
  Compressed JSON is rejected without inflation; binary attachment limits remain independent.
- Added safe middleware envelopes for malformed/oversized/unsupported-encoding input, and early
  monotonic request logging with route templates or fixed categories. Rejections/aborts are logged
  once without raw paths, parameters, queries, body/CSV/file metadata, or raw exceptions.
- Registered-route HTTP regressions prove large valid apply, exactly 1 MiB raw CSV with every JSON
  code unit escaped, exact/over envelope limits, UTF-8 byte policy, atomic validation failure, and
  ordinary/wrong-method/prefix isolation. Existing exact/over 4 MiB upload tests remain green.
- Adopted change-impact verification rather than a full run per phase. API mode now owns backend
  source/test lint and typechecks; `--api-tests` safely selects existing test basenames. Successful
  API test console logs are suppressed while failure logs/results remain available.
- Focused owned run `c4da5774-466a-4b7c-9914-6d7b008ecc59` passed 90 selected API tests. Final owned
  API run `5e772023-f128-4506-8274-0692303f7118` passed all seven gates, 812 API tests across 62 files,
  and 42 resource checks. Backend lint/typechecks, runner lint, OpenAPI assertions, and cleanup passed.
  Angular/contracts/browser/build/site gates were not applicable and were not rerun.
- Updated the README, current developer guide, technical design, and OpenAPI without changing
  transport-neutral endpoint contracts, CSV domain policy, schema, dependencies, release identity,
  or working data.
  See [verification notes](verification-notes.md#phase-8-import-transport-and-safe-errors) for exact
  commands, scope, diagnostic authoring checks, and remaining limits.

## Phase 9: Query And Risk Policy With Versioned Snapshots

Goal: make current query meaning complete and risk drill-downs precise without evolving historical v1
evidence accidentally.

Primary boundaries: contracts/query policy, HTTP validation, SQL predicates, saved-view normalization,
frontend query/forms/display/client code, risk/date helpers, snapshot parsers/producers/presenters,
OpenAPI, and parity fixtures.

Scope:

- First freeze explicit v1 report/closeout query/health types matching current parsers and preserve
  golden read/export/replay fixtures, including existing optional/unknown-field behavior.
- Publish the exhaustive live field policy and parity matrix. Correct current backend links and frontend
  handling of hierarchy/parent/risk/assignee-state/false boolean fields, without changing old query meaning.
- Add `estimateState: 'estimated' | 'unestimated'` through project/workspace validation, SQL count/page/
  export, API client, form, URL/reload/history, applied chips, saved/pinned views, and copy/return codecs.
  Any is omission; zero is estimated. Do not add estimate bulk mutation or save pagination in views.
- Make shared risk definitions scope-aware and count units explicit; keep unique work distinct from
  category signals and Over target scope conditions. Preserve five/eight-row preview meanings.
- Share pure UTC clock/date primitives across runtimes, preserve seven-day and strict-cutoff policies,
  and add DST/midnight/cutoff equality tests without changing health precedence for demo appearance.
- Add frozen v2 snapshot schemas/types and discriminated readers before enabling new precise queries
  in producers. Activate v2 new drafts/closeouts with exact unestimated open/scope links and count units.
- Update every live/read/Markdown/print consumer with version-aware presentation, accept valid older
  v1 report drafts, and return stored versions on closeout replay. Never rewrite stored evidence.
- Introduce zero/null, overlapping-risk, and preserved v1/v2 named fixtures. Check that JSONB requires
  no migration; any necessary DDL must be additive and preservation-tested.

Acceptance:

- Every supported live field passes the round-trip matrix, including saved/pinned/copy/export paths.
- Unestimated risk and drill-down match under unchanged data/clock; zero is excluded and open/scope
  predicates remain applied. Draft filters still do not change applied chips until Apply.
- New v2 snapshots contain precise supported query shapes; golden v1 records parse/render/share/replay
  unchanged. Invalid/unsupported versions and mismatched record bindings fail safely.
- Risk labels/units do not call membership sums unique tickets or fabricate v1 facts.

Verification: contracts/API/Angular parity tests; SQL and HTTP query/export tests; source and formatted
snapshot golden tests; v1 publication/replay and v2 production; UTC/DST/risk fixtures; owned full checks.

Status: Complete as of October 17, 2026.

Completion evidence:

- Published the exhaustive shared live policy and [field/round-trip matrix](query-policy.md). Project
  and workspace forms, applied chips, API/client links, saved/pinned views, copy/return URLs and CSV
  retain supported fields and false. Explicit Apply separates pending edits from active results.
- Added estimated/null-only filtering with count/page/export parity and zero-point coverage. Exact
  unestimated links retain open/cycle predicates; risk signals, distinct category counts and scope
  conditions use correct units. UTC/DST/midnight/cutoff and session-timezone fixtures passed.
- Froze original v1 types/parsers and Markdown serialization; new v2 drafts/closeouts carry supported
  precise queries/units. Actual v1 publication/read/download/print/replay, migration preservation,
  version rejection and binding checks passed without rewriting JSONB or adding DDL.
- Acceptance includes 88 contract cases, 151 affected API cases/42 resource cases, 707 Angular cases,
  affected browser flows, and a warning-free 388.66 kB initial production bundle. Final print CSS used
  build-only verification, not another unchanged Angular suite. Mobile/desktop/print screenshots and
  control/page overflow assertions were checked; owned resources are removed.
- Updated README, development guidance, OpenAPI, and [verification evidence](verification-notes.md#phase-9-query-and-risk-policy-with-versioned-snapshots).
  Diagnostics and omitted unrelated suites are recorded separately; no clean full-API/full-app result
  is inferred from a diagnostic run. Phase 10 is not started; release identity remains 0.2.9.

## Phase 10: Narrow Aggregate Reads And Preview Selection

Goal: remove repeated full DTO hydration and per-project reference fan-out while preserving exact facts.

Primary boundaries: My Work, Planning/milestone/cycle review, Portfolio, health/risk evaluation,
aggregate repositories, and endpoint performance evidence.

Scope:

- Introduce a narrow evaluation projection with only relevant IDs, lifecycle/assignment/scheduling/
  estimate/timestamp/dependency facts. Do not load descriptions/comments/attachment bytes for analytics.
- Reuse one evaluation context and captured clock per response; use the Phase 9 policies rather than
  introducing another risk implementation.
- Evaluate exact My Work counts/relevance, select each eight-row preview, then batch-hydrate the union.
- Reuse scoped Planning/review evaluation and select five-row risk previews before enrichment; remove
  duplicate cycle review reads and root-repository escapes from consistent transactions.
- Batch Portfolio milestone/active-cycle/latest-report reads across all returned projects, with stable
  latest-report tie-breaking and only needed snapshot parsing/reference projection.
- Keep complete comparison rows/counts, boards, and historical snapshot arrays. Narrow reads may still
  evaluate all relevant rows; do not claim constant-time analytics or truncate facts to meet a budget.
- Add 15-project/high-work-volume fixtures and endpoint instrumentation for query counts, narrow versus
  enriched rows, response bytes, and cold/warm diagnostic timing. Reuse import-safe fixture owners.

Acceptance:

- Eight-row previews do not fully hydrate every matching workspace record; exact totals remain unchanged.
- Portfolio metadata query count is batched rather than proportional to project count.
- Complete-path evidence identifies remaining scaling costs, transaction consistency, and preview bounds.

Verification: aggregate content/count/query parity, consistent reads, preview-hydration instrumentation,
15-project endpoint evidence, complete board/history regressions, and API/Angular checks.

Status: Complete as of October 17, 2026.

Completion evidence:

- Added narrow evaluation with canonical dependency membership, one clock/context and preview-before-
  enrichment. My Work hydrates its eight-row preview union once; Planning reuses loaded cycle facts.
- Portfolio metadata uses one query per category; latest evidence has stable publishedAt/createdAt/ID
  ties and omits narrative columns. Complete project rows, boards and stored arrays remain complete.
- Planning uses exact health counts separately from five-row risk previews for metrics, continuation
  and risk-signal totals. Scoped risks and eight-row movement retain their established count meanings.
- [Endpoint evidence](aggregate-evidence.md) covers one/15-project fixtures, 900 authored work records,
  statements/rows/bytes/timings and remaining costs. SQL counts fell from 51/53/38 to 13/9/11 for My Work/
  Portfolio/Planning, with 32/0/22 work-preview IDs enriched in those endpoints.
- Acceptance passed 239 affected API cases/42 resource cases, 12 focused Planning Angular cases and a
  warning-free production build. External-commit consistency, root-scope escape detection, cross-project/
  terminal dependencies, complete board/closeout/replay and old snapshot consumers passed.
- README, current developer guidance, OpenAPI and [verification notes](verification-notes.md#phase-10-narrow-aggregate-reads-and-preview-selection)
  record preview/count boundaries. Unchanged Angular/browser/site suites were not rerun or claimed
  passed. Owned resources are removed; migrations/dependencies/version/commits/releases are unchanged.

## Phase 11: Reactive Route And Actor Context

Goal: make effective identity authoritative before adding departure decisions or rebuilding route views.

Primary boundaries: project shell/home/Planning/review/report pages, work pages, route-context helpers,
current-user integration, auxiliary options/views, and focused API clients.

Scope:

- Derive effective inherited route identity from observable router state and committed actor, replacing
  cached snapshot-only computed IDs. Preserve lazy route boundaries.
- Establish page context/generation ownership for primary/auxiliary requests and mutation callbacks,
  including error/finalization. Cancel obsolete loads and reject obsolete completion effects.
- Buffer mounted-editor route changes until navigation commits; cancellation/error cannot reset forms
  merely because an early route event or proposed target was observed.
- Clear old authorized content/options/messages/selection on accepted identity change, before next loads.
  Same-context report evidence refresh must not reinitialize narrative values.
- Move touched state to existing focused API clients. Do not grow the compatibility facade or put heavy
  feature imports in root context services.
- Cover project A -> B, milestone/cycle/report A -> B, same detail component IDs, and actor switches with
  real router reuse and delayed load/options/view/mutation results.

Acceptance:

- URL, identity, displayed context, links, and commands agree after component reuse.
- Old-context success/error/finalization cannot alter current data, controls, spinners, or drafts.
- Accepted changes clear old authorized state; rejected/incomplete navigation cannot reset an editor.
- This phase establishes context correctness; full user departure protection is delivered in Phase 12.

Verification: real router integration tests, delayed primary/auxiliary/mutation tests, actor/read-only
regressions, Angular typecheck/build, and initial/lazy graph inspection.

Status: Complete (October 17, 2026).

Completion evidence:

- Component-local `PageContext` buffers inherited params/query/fragment until `NavigationEnd`, owns
  workspace/member/route generations, cancels obsolete reads and rejects obsolete submitted-write
  success/error effects. Synchronous committed-actor events cover A -> B -> A without effect turns.
- All 16 touched page owners use focused API clients and clear authorized content/options/messages/
  selection before reloading. Creation project/filter options also cancel on in-form project changes.
  Parent-only child-creation changes preserve entered fields; report evidence refresh preserves narrative.
- Real lazy router reuse covers shell/home, milestone/cycle/report, draft/closeout and detail routes.
  Delayed reads/options/views/mutations and clipboard finalization cannot update a later context.
  Fragment-only navigation preserves work-list query/selection; pagination reset races are covered.
- Broad frontend acceptance passed 729 Angular cases, lint, development typechecking and production
  build. After query deduplication, 286 affected cases and production graph/build passed; the final
  pagination-only refinement passed 113 targeted cases. Counts overlap, not additive. Five selected
  real browser workflows passed using disposable PostgreSQL/storage/servers. Unchanged-code evidence
  was reused rather than rerunning the full suite after the final narrow refinement.
- Production initial size is 390.62 kB (107.60 kB estimated transfer), warning-free under unchanged
  budgets. Static initial graph has no heavy detail/Planning/report/creation/Markdown/editor inputs;
  all 20 page entry points remain lazy. [Context evidence](reactive-context-evidence.md) and
  [verification notes](verification-notes.md) record commands, diagnostics and limits.
- Owned resources were removed; working data, dependencies, package identity and release actions
  are unchanged. Departure decisions, native unload warning and pending-write blocking remain Phase 12.

## Phase 12: Draft Departure Protection

Goal: protect meaningful existing editors through one production decision path before composition changes.

Primary boundaries: core navigation coordinator/guards, app actor selector, authored/create/detail/comment/
report form owners, Quick Find navigation, and lazy CDK confirmation.

Scope:

- Implement participant registration/disposal with context, draft revision, value-equality baseline,
  pending-write state, and captured discard callbacks. Do not copy source into a global draft store.
- Register detail fields/description, new comments/recipients, comment edits, creation defaults, and
  report narrative independently. Preview/selection alone is not a draft; reverted values are clean.
- Add CanDeactivate and reused-editable-route activation protection with explicit rerun policy.
  Deduplicate by navigation ID/revision and clear only the captured participant after committed departure.
- Guard interactive actor commit/localStorage and in-form creation context resets; retain bootstrap
  reconciliation before editors exist. Stay preserves actor, source/format, mentions, and selection.
- Use one lazy Stay/Discard dialog with predictable default/escape/focus behavior. No NavigationStart
  cancel/replay loop, queued departures, double discard prompt, or draft loss after later navigation failure.
- Block affected in-app departures while submission is unresolved. Successful saves update only their
  baseline before success navigation; failed saves retain drafts. Add conditional native beforeunload.
- Make Quick Find wait for accepted navigation before dismissal and retain its interaction on Stay.

Acceptance:

- Independent description/comment drafts survive Stay across links, same-component IDs, history,
  Quick Find, actor changes, and route failure. Discard cannot leak them to another identity.
- Creation/report narratives follow the same rules; evidence refresh never overwrites authored text.
- Pending mutations cannot be misrepresented as cancelled by Discard; clean/preview/reverted drafts do
  not prompt, and explicit discard has one outcome.
- All listed editors use the coordinator in production, not just a demonstration host.

Verification: coordinator unit tests, real guard/history/actor integration, cancelled-navigation and
pending-submit tests, native dialog/unload browser checks where supported, and editor selection regressions.

Status: Complete (October 17, 2026).

Completion evidence:

- Independent local baseline trackers and coordinator registrations cover detail fields/description/
  labels, new comments/recipients, inline comment edits, creation and report narrative. Equality uses
  existing persistence normalization, not dirty flags; success updates only the owning baseline.
- Production activation/deactivation guards share navigation-ID/revision decisions across reused
  routes. Discard resets only captured old participants after commit; cancellation/error preserves
  drafts. Post-approval revision changes during later guards abort through Angular's public navigation
  API without URL replay. Actor/storage commits and in-form/explicit resets use the same decision path.
- Lazy plain CDK Stay/Discard defaults to Stay and preserves focus/selection on rejection. Quick Find
  awaits successful navigation and retains query/active option on Stay. Pending writes reject departure;
  native unload protection is conditional. No draft persistence/autosave or server cancellation claim.
- Final owned frontend acceptance passed 263 affected cases, source lint, development template/type
  checking, production build and initial import inspection. All three new browser flows passed together;
  four additional unchanged description/comment/Quick Find workflows passed earlier in this phase.
  Final initial size is 397.79 kB / 109.94 kB estimated transfer, warning-free under unchanged budgets;
  no CDK/dialog/heavy editor feature entered the initial graph and 20 page entries remain lazy.
- [Draft evidence](draft-departure-evidence.md) and [verification notes](verification-notes.md) record
  commands, diagnostics, overlapping counts, native-close limits and screenshot inspection. Owned
  resources were removed; ordinary working data, dependencies/package version and release actions
  remain unchanged. Backend/full/editor/site suites were not repeated for unchanged surfaces.

## Phase 13: Read-First Work-Item Detail

Goal: complete single-record correction and collaboration without default administrative forms.

Primary boundaries: detail route/store and read/edit/discussion/relationships/watch/history components,
existing attachment owner, authored-content controls, and detail API client.

Scope:

- Extract focused detail/edit/discussion/relationship/watch-history ownership while retaining one
  context coordinator and existing attachment ownership. Persisted facts and independent drafts stay separate.
- Lead with identity/named project, readable description, planning facts, blocker/parent context, status
  transition, and compact watch. Disclose details editing through Edit and parent search through Set/Change.
- Add estimate/due-date edit/clear via existing PATCH. Handle number/null values correctly, zero points,
  nonnegative integers, calendar validation, permission/archived states, and failed/no-op submissions.
- Show compact expandable children and exact child-list continuation; call Done + Canceled Closed and
  label parent estimate versus child total without changing independent scheduling/status/estimates.
- Compose reachable Discussion/Files/Dependencies/History regions, disclosing administration and watcher/
  history lists. Keep source/format authoring, mentions, upload progress/retry/removal/capacity messages.
- Keep stable target IDs for Phase 14 and focused component styles within unchanged budgets. Reuse
  existing Lucide/CDK primitives; do not add a new editor/state/design framework.

Acceptance:

- Contributors can set/change/clear estimate and due date, and read/reply without traversing open parent
  search or a duplicate editor. Status remains an independent command near the read summary.
- Saving one panel cannot reset another draft or file operation; Phase 12 decisions still work.
- Parent/child labels, archive/permission states, source no-ops, mentions, and file lifecycle remain correct.
- Production state resides in the extracted owners; duplicate orchestration is removed, not left beside them.

Verification: detail component/store/API tests; zero/null/calendar/no-op/permission cases; independent-draft
and attachment/editor regressions; populated desktop/mobile screenshots and style/lazy build checks.

Status: Complete (October 17, 2026).

Completion evidence:

- Replaced monolithic detail orchestration with page-scoped record/edit, discussion, relationship
  and watch/history owners, sharing one committed context and existing independent draft decisions.
  Focused production components consume those owners; the old page implementation is removed.
- Default detail is read-first, with named project/planning facts, independent status/watch and
  explicit Edit/Cancel. Parent management, children, dependency administration, watchers and history
  are disclosed; section links scroll/focus stable targets without losing the record/query.
- Estimate/date set/clear use existing PATCH, including zero/null, integer/calendar/native-input
  validation, failed/no-op saves and archived/contributor states. Field saves preserve newer comments,
  status and hierarchy; scoped cancellation preserves independent discussion and mounted files.
- Child Closed totals include Done and Canceled, distinguish parent estimate from child totals, and
  preserve exact list continuation. Upload progress/retry/removal/capacity and source/format behavior
  remain with their established owners.
- Affected frontend acceptance passed 164 tests/lint/production compilation and unchanged
  style/lazy budgets. All 15 distinct selected application browser flows passed across overlapping
  runs, plus the compiled preview check. Initial size remains 397.79 kB with 20 lazy page entries.
- A final watcher-copy correction/new regression passed 106/106 affected detail tests and lint;
  unchanged build/browser evidence was reused for that text-only edit.
- [Detail evidence](read-first-detail-evidence.md) and [verification notes](verification-notes.md)
  record commands, diagnostics, screenshot inspection, omitted suites and owned cleanup. Package
  versions/dependencies/working data/release actions are unchanged; Phase 14 is not started.

## Phase 14: Bounded Returns And Section Targeting

Goal: preserve origin and relevant landing context throughout the principal inspection journey.

Primary boundaries: shared navigation parser/builders, detail/create/parent/dependency links, review/
closeout/result/report destinations, Inbox, Quick Find targets, and existing Files targeting.

Scope:

- Implement `returnUrl` origin plus optional `returnTo` immediate record using UrlTree/known query codecs.
  Replace, consume, and carry bounded context without recursively nesting current return parameters.
- Accept established safe legacy links and recognized Planning subviews/fragments. Preserve applied
  work filters/sort/page/page size, descriptive return labels, and safe project/workspace fallbacks.
- Reject external/protocol-relative/malformed/recursive/auxiliary/self-return targets and enforce the
  design's 4 KiB decoded-target and 12 KiB constructed-URL bounds without repeated decoding.
- Adopt helpers across parent/child/dependency, closeout/result, report, create success, and Quick Find
  navigation. Authorization stays in resource loading, not in the return parser.
- Extend Files targeting to Discussion/Dependencies/History and identifiable comments, including
  same-route fragment changes, disclosure opening, post-load scroll/focus, and reduced motion.
- Link notifications to the identifiable comment or Discussion; missing/deleted targets fall back without
  cached deleted source. Make stale target operations identity/generation safe.

Acceptance:

- Filtered page 3 -> parent -> child -> parent -> original Work preserves query/page after reload too.
- Result/dependency/create/Quick Find inspection returns usefully without growing a URL stack.
- Mention/comment and attachment links land at the right loaded section; Stay preserves the source
  editor and does not activate an unrelated target.
- Unsafe/missing/self targets fail locally and cannot confer resource access.

Verification: pure URL policy tests, real router/fragment/history journeys, cross-project/unauthorized
destinations, deleted-comment/Files regressions, and browser scroll/focus assertions.

Status: Complete (October 17, 2026).

Completion notes:

- Added the adopted UrlTree/query-codec policy for one durable origin and optional immediate record,
  with replacement/consumption, legacy compatibility, descriptive labels, strict local allowlists,
  duplicate/self/recursive rejection and 4 KiB target / 12 KiB navigation bounds. Removed both old
  detail/create parsers; no authorization rule moved into URL handling.
- Migrated parent/child/all dependency groups, create preview/success and list/project capture,
  reviews/closeout/results/reports, Inbox and Quick Find. Applied filters/sort/page/page size survive
  reload and the parent -> child -> parent -> origin journey, including cross-project inspection.
- Added committed post-render section/comment targeting, disclosure opening, sticky offset,
  programmatic focus, history/reload/same-section repeat and reduced motion. Missing/deleted comments
  fall back without source; Files retains its settled owner and rejects stale cross-record focus.
- Affected frontend acceptance passed 354 tests/lint/production compilation and the initial lazy graph.
  A final overlapping 153-case regression selection passed after the last focus/link changes. All nine
  selected browser journeys completed successfully across documented focused runs, plus compiled
  preview deep-link/Planning-subview checks. Initial size is 397.81 kB with 20 lazy page entries;
  budgets/dependencies remain unchanged.
- [Navigation evidence](bounded-navigation-evidence.md) and [verification notes](verification-notes.md)
  record adoption, diagnostics, reuse, screenshot inspection, omitted suites and owned cleanup.
  Versions remain 0.2.9; ordinary data/storage and release actions are untouched. Phase 15 is not started.

## Phase 15: Shared Saved Views And Work Lists

Goal: make both production lists share saved-view behavior and accurately represent applied results.

Primary boundaries: `SavedViewsStore`, `WorkListQueryStore`, stable-key filter display, project/workspace
list pages and toolbars, pin/opener controls, pagination, and visible-ID bulk state.

Scope:

- Harden the existing saved-view store with generation/cancellation, mutation completion guards, explicit
  pending/error state, destruction cleanup, and actual ownership/visibility permission checks.
- Migrate both live list pages; remove duplicate loads/mutations/messages and orphan filter alternatives.
  Pinned opening and opener opening use the same production path.
- Track explicitly opened view identity plus accepted canonical definition; derive Named/Modified/Custom
  from applied query/sort. Pagination alone and unapplied form edits do not modify that identity.
- Keep definition Update explicit, especially for shared views. Successful rename/query/pin/delete and
  lost permissions/actor/project changes have coherent selection/error behavior.
- Adopt stable-key chips for every applicable field, including estimate/risk/hierarchy/exact parent;
  remove English-label parsing. Announce updated results only after the matching latest load succeeds.
- Add range/total/page-size/previous-next controls near results and retain bottom pagination under one
  state owner. Explain visible-ID selection clearing on page/query/context changes without broadening bulk scope.
- Repair touched header/row/cell semantics, active/selected state, keyboard access, and mobile controls.

Acceptance:

- Both pages prove actual shared-store use for permissions, pins, CRUD/query updates, failures, and
  delayed actor/project loads. No unused scaffold is counted as completion.
- Named/Modified/Custom, applied chips, query/URL/export, and loaded-result feedback agree.
- A 100-row page is navigable at the top and bottom; bulk remains visible-page and reachable on phones.

Verification: shared store plus both production-page integration tests, delayed mutation/load failures,
every-field chip/view round trips, pagination/bulk/semantics browser checks, and build budgets.

Status: Complete (October 17, 2026).

Completion notes:

- Both production Work lists use the hardened page-local saved-view owner for collection, permissions,
  CRUD/query/pin operations, errors and explicit opened identity; duplicate subscriptions/helpers are gone.
  Cancelled loads, generation/context guards, pending serialization and destruction are covered.
- Named/Modified/Custom compares accepted canonical definitions with applied filters/sort. Pending edits
  and paging do not modify identity; query Update remains explicit. Rename/pin/delete and actor/project/
  role/archive rules are coherent, and failed/unrelated writes retain appropriate name drafts.
- Stable keyed chips cover every applicable query field. Latest successful corresponding loads own
  results confirmation, rather than the Open click. Top range/page-size/direction controls and bottom
  numbered pagination share metadata; a discovered pager mount/size display bug has regression coverage.
- Visible-ID bulk clearing has a status notice. Desktop/mobile selection is disabled during bulk
  writes; non-visible IDs are rejected. Table headers/cells/selection and pinned active state are exposed.
- 250 affected Angular cases, frontend/test-code lint, verification TypeScript, production build and
  initial graph checks passed. Five distinct browser journeys passed across documented focused runs,
  including both-scope 105-row fixtures, latest feedback/errors, explicit Update, pins/rename/delete,
  owner/contributor rules, top/bottom 100-row navigation, bulk clearing and mobile selection.
- [Shared work-list evidence](shared-work-list-evidence.md) and [verification notes](verification-notes.md)
  record adoption, diagnostics, screenshots, cleanup and intentionally omitted unrelated suites.
  Initial size is 397.75 kB with 20 lazy page entries and no budget warnings. Versions remain 0.2.9;
  ordinary data/storage, dependency thresholds and release actions are unchanged. Phase 16 is not started.

## Phase 16: Execution-First Planning

Goal: prioritize active execution and actionable risk before planning administration.

Primary boundaries: Planning route/coordinator, planning review, cycle/milestone management components/
stores, risk summaries/continuations, and report links.

Scope:

- Lead with compact health, active cycle/dates/scope, populated risks, and closeout readiness. Replace
  the large report promotion with a contextual Draft report/Reports command.
- Separate milestone targets from cycle execution and provide a useful no-active-cycle state.
- Make existing records primary; disclose create/per-record edit controls with focused pending/error
  state and existing contributor read/maintainer write permissions.
- Adopt the shared scope-aware risk/count/date/query policy and one quiet empty-risk state or category
  disclosure, rather than stacked empty panels.
- Extract only remaining management orchestration needed for this change; preserve committed context,
  stale-response checks, return subviews, and independent local forms.
- Keep style ownership in focused components and retain exact risk continuation rather than a broad
  cycle list masquerading as the selected risk group.

Acceptance:

- Active execution/risk/correction/closeout are visible before creation forms and report explanation.
- Contributors are not led through dominant disabled administration; existing records/actions stay usable.
- Risk groups/copy/counts/links match live data and UTC policy without changing health thresholds.

Verification: Planning/cycle/milestone owner integration, role/archive/empty/loading/error cases,
unestimated review -> list -> edit -> same-review refreshed evidence, mobile/desktop rendering and budgets.

Status: Not started.

## Phase 17: Historical Outcome And Deliberate Closeout

Goal: make complete frozen outcomes primary and unfinished-scope decisions explicit.

Primary boundaries: cycle review, closeout page/result, historical group presentation, v1/v2 read adapters,
print/Markdown sharing, and historical fixtures.

Scope:

- Render Outcome at close first for completed cycles: frozen identity/time, counts, destination, and
  completed/canceled/unfinished arrays. Put live assignments/risks in a separate Current context disclosure.
- Add local 10-row group pagination plus Show all/totals over complete stored arrays; do not fetch a
  current list to fill history or cap snapshot parsing/export evidence.
- Preserve historical values when current records change/disappear. Current links are labeled current,
  use bounded returns, and cannot be presented as the exact frozen carryover set.
- Initialize destination to an unselected sentinel for unfinished work; require deliberate eligible-cycle
  or Unplanned choice, including when no eligible cycle exists. Show destination/affected count before submit.
- With no unfinished work, omit the choice and preserve none/null request semantics. Retain API locked
  eligibility, conflicts/replay, permissions, and pending/failure behavior.
- Add a named 12-unfinished scenario with later work reassignment/title/status/estimate changes and
  frozen v1/v2 outcomes. Keep demo evidence separate from deterministic test fixtures.

Acceptance:

- Every stored row, including rows beyond eight/ten, is inspectable with its original values afterward.
- Completed cycle, Done at close, Canceled, carried scope, and current assignments are distinguishable.
- Destination is never silently chosen, and no artificial choice is required for zero unfinished work.
- Sharing/print includes complete evidence and both versions remain supported without rewriting history.

Verification: 12-record browser walkthrough, v1/v2 presentation/export tests, changed/unavailable current
record cases, destination/no-destination/conflict/replay tests, and return/focus/accessibility checks.

Status: Not started.

## Phase 18: Portfolio And Navigation Ergonomics

Goal: make cross-project comparison and successive inspection usable in the real content container.

Primary boundaries: Portfolio page/rows, app/project shell/navigation metadata, Projects directory,
Workspace Settings utility access, detail project context, and Quick Find session/dialog/refinement.

Scope:

- Replace overflowing Portfolio track assumptions with actual-container-aware rows/stacked layouts,
  wrapping/minimum sizing, and reachable secondary disclosures. Do not conceal clipping with overflow hiding.
- Prioritize project, health/top reason, current planning, report freshness, and one next action. Filter
  name/health/freshness client-side across the complete returned rows, with visible/total counts.
- Label bounded attention previews and keep exact totals honest; no saved Portfolio query or new dashboard.
- Give milestone/cycle/closeout routes Planning ownership without URL changes, use active semantics,
  compact project/mobile identity, and move Workspace Settings to predictable utility placement.
- Preserve contributor-readable settings and make Projects directory-first/searchable with creation disclosed.
- Publish authorized detail project context to Quick Find project destinations; clear it on context loss.
- Retain Quick Find query/refinement only in identity-scoped memory, refresh authorized results on reopen,
  clear on actor/workspace/reload, and reset stale selection. Do not cache results as permission authority.
- Offer useful bounded non-work refinement, keep real Work Items continuation, distinguish filename
  search, escape snippets, and preserve Phase 12/14 guarded navigation and return behavior.

Acceptance:

- Fifteen-project comparison and its controls fit constrained desktop containers and 390px without
  hidden columns/actions; refinement uses all rows rather than a truncated preview.
- Shell ownership/utility access/project identity are correct on reused and mobile routes.
- Two Quick Find inspections need no retyping; reopening refreshes results and identity change erases
  the prior session. No unsupported View all/file-content search promise appears.

Verification: populated Portfolio filter/containment tests, constrained-container screenshots/control
bounds, role/navigation metadata tests, successive Quick Find/actor/stale-result browser journeys, budgets.

Status: Not started.

## Phase 19: Public Site And Working Local Setup

Goal: present one accurate product baseline and independently reproducible local trial paths.

Primary boundaries: `site/`, README, current developer/operations guidance, release-relevant seed support,
lightweight site checks, Pages workflow, and verification site/preview modes.

Scope:

- Finish the current README-linked developer guide with actual production owners, transaction/lock/
  query/snapshot/draft/client invariants, safe commands, and accurate archive navigation. Consolidate
  only release-relevant fixture/seed ownership left from prior phases; keep IDs import-safe.
- Restructure the static site around four workflows with one outcome and two/three supporting points
  each. Keep Worktrail H1, source/local-run actions, one audience block, and compact release identity.
- Remove duplicate feature/Baseline/Operations inventories. Retain five concise architecture boundaries
  with direct resources and three visible operating limits: local identity, local single-instance
  operation, and bounded capabilities including no malware scanning.
- Capture at most two complementary populated product proof points after UX consolidation, with legible
  mobile treatments, stable dimensions, descriptive alternatives, and full originals. Use actual UI.
- Publish independent development and compiled-preview instructions with clone/cd/prerequisites/install/
  DB/migration/seed/start/URL. Establish the same explicit absolute attachment root before seed and
  runtime for each path; no hidden shell-state or default-root fallback.
- Verify each setup path from fresh owned resources through a deep link and exact seeded-file bytes.
  Keep upgrade/coordinated metadata-byte backup guidance distinct from destructive demo reset/reseed.
- Add site skip/anchor/focus/reduced-motion/mobile-short-landscape handling and actual containment checks.
  Confirm the real Pages base path before canonical/share URLs; local checks do not claim remote deploy.
- Add asset/fragment/repository-link/release-identity checks to verify/site mode and before Pages upload.
  Preserve static hosting/workflow. Keep existing published release links until Phase 21 artifacts exist.

Acceptance:

- Public workflows/captions/limits describe shipped capabilities without a fake managed-cloud promise.
- Both fresh documented setup paths work independently, with byte-correct seeded attachments and deep links.
- Guide paths name real adopted owners, not unconsumed scaffolds; site links/assets/fragments resolve locally.
- Site and app share brand/current capability meaning, with keyboard/reflow/short-screen behavior verified.

Verification: site static/rendered checks, independent development/compiled setup transcripts with owned
cleanup, exact-byte downloads, local repository links, source/metadata/Pages workflow review. Do not deploy.

Status: Not started.

## Phase 20: Cross-Surface Acceptance And UAT Handoff

Goal: verify the consolidated workflows together, close integration defects, and make manual evidence clear.

Primary boundaries: owned verification modes, E2E/editor/preview/site suites, named fixtures, focused
integration regressions, and sprint verification/UAT notes.

Scope:

- Run the integrated journey matrix below using populated contributor/maintainer/owner contexts,
  archived/read-only cases, and the named nontrivial fixtures. Fix discovered integration defects in
  their existing owners and add regression coverage; do not introduce another feature area.
- Verify full live-query round trips, draft safety, bounded returns, estimate correction, complete history,
  saved-view identity, Portfolio containment, and successive Quick Find navigation together.
- Repeat synchronized PostgreSQL, parser HTTP, migration/preservation, query-budget, aggregate endpoint,
  dependency, and runner parallel/signal evidence after the UI/client integrations.
- Check 320/390/768/1024/1440px and wider screens, short landscape, constrained containers, long names,
  enlarged font metrics, control bounds, focus order, table semantics, and active/selected announcements.
- Perform actual browser zoom and a screen-reader walkthrough where available; record precise remaining
  manual gaps. Preserve native editor selection/undo/paste/composition/security evidence without claiming
  synthetic IME establishes real OS behavior.
- Inspect initial/lazy graphs and unchanged warning-free build budgets after all extraction.
- Prepare a concise user walkthrough and record only actual UAT observations/approval. Automated passes
  are not user approval; identify any required unresolved manual signoff before Phase 21 closure.

Acceptance:

- Required automated/integration journeys pass without retries concealing reproducible failures.
- Every audit-derived commitment has evidence or an explicitly unresolved acceptance item; required
  failures are not reclassified as cosmetic or silently deferred.
- Manual results/gaps and UAT status are accurate, and all phase-owned resources are cleaned up.

Verification: owned full run plus focused race/performance/runner scenarios, app/editor/preview/site
browser checks, actual manual observations, and trace/screenshot/evidence review.

Status: Not started.

## Phase 21: Release Finalization

Goal: align the final `0.3.0` tree and prove local release readiness without publishing it.

Primary boundaries: root/workspace manifests, internal contract dependency/lockfile versions, OpenAPI,
README/site, release/verification/pattern notes, developer/operator docs, and phase statuses.

Scope:

- Resolve Phase 20 defects and disposition any manual gaps honestly before declaring the release ready.
  Do not manufacture UAT, accessibility, remote CI, or deployed evidence.
- Align every release identity to `0.3.0`, including internal contracts/lockfile/API/OpenAPI references.
  Preserve archived release history rather than bulk-replacing old version strings.
- Finish release notes, verification notes, destination-neutral pattern notes, and a concise known-limit/
  development-advisory record. Recheck exception expiry against the actual intended release date/version.
- Update site/footer release-document links only after those artifacts exist, and recheck actual base-path
  metadata, assets, local repository links, CSV/query/snapshot docs, upgrade guidance, and screenshot accuracy.
- Run the complete automated release gates on the final versioned tree, including clean contracts-source
  testing before builds, lint/typechecks, tests, migrations/preservation, production build, browser/editor/
  compiled preview/site, audits, concurrency/query evidence, and runner safety scenarios.
- Confirm build budgets remain warning-free and lazy ownership remains intact. Record exact results,
  local environment, remaining limits, and cleanup; update phase completion evidence incrementally.
- Leave a handoff for user-controlled merge/tag/Pages publication, with remote CI/tag/link/share checks
  explicitly pending until those actions actually occur.

Acceptance:

- Final version/doc/capability identity is coherent and all required local automated gates pass.
- V1 data/snapshots, working-data upgrade, attachment bytes, personal/shared views, and existing public
  routes retain their compatibility guarantees.
- Required manual acceptance is resolved or its precise limit prevents an overstated readiness claim;
  remaining permitted development risk has owned, unexpired exceptions.
- Only run-owned resources were removed; no unauthorized repository/release/deployment action occurred.

Verification: final owned full verification, supplemental concurrency/query/parallel-run evidence,
documentation/local-link/version checks, git diff/whitespace/status review, and explicit cleanup inventory.

Status: Not started.

## Acceptance Journey Matrix

| Journey Or Risk | Owning Phases | Release Evidence |
| --- | --- | --- |
| Fresh verification cannot touch ordinary data | 1-2 | Marker rejection, Docker/service provisioning, parallel ports, interruption cleanup, editor independence |
| Toolchain risk has bounded disposition | 3, 21 | Strict production audit; per-path development remediation/expiry gate; compatible build/migration/editor behavior |
| Atomic commands and consistent reads are explicit | 4, 6-7 | Real rollback/transaction/context tests; no optional production fallback or nested transactions |
| 100-row project/workspace discovery is bounded | 5, 9-10 | 10/25/100 complete-path counts; <=20 statements at 100; full-filter capped export and aggregate row/byte/timing evidence |
| Concurrent lifecycle/status/board/hierarchy stays valid | 6-7 | Synchronized real connections, boundary schedules, closeout races, true previous-state activity, deadlock timeouts |
| CSV policy works through HTTP | 8 | >100 KiB and near-1 MiB/escaping cases, safe malformed/oversized responses/logs, unchanged binary limits |
| Unestimated signal leads to exact correction | 9, 13-14, 16 | Scoped open/null list, zero excluded, edit/clear estimate/date, return to refreshed same review |
| Current query evolution preserves evidence | 9, 17 | All-field round trips; frozen v1 golden fixtures; v2 producer/read/share/replay; no historical rewrite |
| Reused routes and delayed actor/options responses are safe | 11-12 | Real parent/leaf router reuse plus stale success/error/finalization and cancelled-navigation cases |
| Authored work survives Stay | 12-14 | Independent description/comment/create/report drafts across links/history/Quick Find/actor; pending writes and selection retained |
| Linked work retains origin and relevant target | 14 | Filtered page 3 -> parent -> child -> parent -> origin; dependency/result/create links; comment/Files targeting and hostile URLs |
| Named views match applied results | 9, 15 | Named/Modified/Custom, pinned/opener parity, explicit shared Update, keyed chips, top/bottom pagination, visible-ID bulk |
| Planning and historical outcome are distinguishable | 16-17 | Current execution first, deliberate unfinished destination, all 12 frozen rows after later edits, complete print/share |
| Portfolio and Quick Find support repeated inspection | 18 | Complete 15-project refinement, actual-container/control bounds, useful actions, refreshed retained query, identity reset |
| Visitor can understand and run Worktrail | 19 | Four workflows/two proof points, real resource links/limits, independent dev/preview deep link and exact attachment download |
| Consolidated product works across input/view conditions | 20-21 | Responsive/font-sensitive/native-editor checks, actual zoom/screen-reader evidence or precise gaps, final-tree full gates |

## Completion Standard

The sprint is complete only when the required product journeys, compatibility, measured performance,
resource safety, and documentation all agree. Phase count, extracted file count, and a green subset of
tests are not substitutes for that standard.

Keep final local readiness separate from remote CI and post-publication validation. The implementation
handoff should say what passed, which manual limits remain, what data was preserved, which resources
were cleaned up, and which user-controlled publication checks are still pending.
