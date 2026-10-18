# Worktrail v0.3.0 Technical Debt Audit

Date: October 17, 2026  
Baseline reviewed: v0.2.9, commit `4e508cc`

## Assessment

Worktrail has a credible architecture and substantial regression coverage. Transport-neutral handlers, domain services, repositories, shared contracts, lazy Angular routes, versioned snapshots, bounded search, and an explicit attachment-store port are useful foundations to keep.

The main debt is uneven adoption of those foundations. Some newer paths have strong context cancellation, row locking, bounded projections, and runtime validation; adjacent older paths still depend on cached route snapshots, unguarded subscriptions, read-then-write validation, per-row hydration, and duplicated page orchestration. Several extracted frontend helpers are tested but never used by production components.

The v0.3.0 technical objective should be to make these guarantees consistent in the paths users already exercise, then give future development a clear place to add behavior. File size is a useful pressure signal, but correcting ownership and behavior matters more than reducing line counts.

Three targeted checks found concrete gaps despite a green verification suite:

- Concurrent planned-cycle creation can persist overlapping date ranges.
- A supported 100-row project work page can execute 409 SQL statements.
- A valid CSV accepted by the import service is rejected at the HTTP boundary with an HTML 413 response.

These should be handled alongside the route/context defects before broad structural cleanup. The recommendations below complement the [UX audit](ux-audit.md); they focus on the implementation boundaries needed to support that consolidation.

## Audit Basis And Verification

Reviewed material included the previous technical audit, the v0.2.0 design and implementation decisions, subsequent sprint documentation, API services/repositories/validation/storage, Angular feature state and API clients, contracts, migrations, test setup, build configuration, CI, and release verification notes.

Fresh checks used a disposable PostgreSQL 16 container named `worktrail-v030-tech-audit`, database `worktrail_audit`, bound to `127.0.0.1:58287`. Attachment roots were isolated beneath `/tmp/worktrail-tech-audit.5fpJHy`. Existing working databases and attachment stores were not reset or reseeded. The disposable database and audit-owned storage were removed after verification; test-owned servers stopped.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed across workspaces |
| `npm test` | 1,307 passed: 601 API, 652 Angular, 54 contracts |
| `npm run build` | Passed with no budget warnings |
| Application Playwright suite, retries disabled | 34 passed |
| Standalone editor Playwright suite, retries disabled | 5 passed |
| Compiled production-preview suite | 1 passed |
| `npm audit --omit=dev --json` | Zero reported vulnerabilities |
| `npm audit --json` | 34 findings: 8 moderate, 21 high, 5 critical; nonzero exit |

The production initial bundle was 386.62 kB raw / 104.33 kB estimated transfer, within the existing budgets. The harmless editor-run color-environment warning did not fail its checks. Remote CI was not triggered.

Additional executable checks examined the cached Angular `computed()` pattern, synchronized real cycle-creation transactions, SQL counts through the real paged service, and CSV service/HTTP boundary parity. Their methods and limits are recorded under the relevant findings. No timing result is presented as a hosted performance guarantee, and this is not a penetration test.

Only this audit document was added during this task. The existing v0.3.0 UX audit was preserved. Generated build/browser outputs remained ignored; application, dependency, configuration, migration, and test source were not changed.

## Progress Since v0.2.0

| Earlier Concern | Current Position |
| --- | --- |
| Shared work-list query state | `WorkListQueryStore` is actually used by both pages, including page state and return links |
| Shared saved-view orchestration | `SavedViewsStore` exists and has focused tests, but has no production consumers |
| Explicit bulk state | `ProjectBulkTriageStore` is used; batch selection remains concrete and page-scoped |
| Shared risk assembly | `work-risk-sections.ts` is used across review/report paths; some scope semantics and Planning assembly still differ |
| Snapshot validation | Full report and closeout parsers now exist; malformed stored data has controlled failure paths |
| Package version drift | Root/workspace packages and OpenAPI identify v0.2.9; the previous metadata mismatch is resolved |
| My Work test failure | The suite is green and My Work tests freeze time; the old failed test is not a current defect |
| Storage boundary | A focused object-store interface, bounded file policy, integrity checks, compensation, and concurrency tests now exist |
| Discovery scaling | Paged list reads and Quick Find are bounded, with SQL plan evidence; enrichment and aggregate workflows still need attention |
| Release verification | CI includes application/editor browser tests, compiled preview, production dependency auditing, and failure artifacts |

The next consolidation should finish adopting existing helpers and extend proven guarantees. Replacing the stack or introducing a general workflow framework would add migration cost without addressing these gaps directly.

## Priority And Scope

`P1` means a current correctness issue, a measured scaling problem, or a baseline/tooling risk that deserves explicit release treatment. `P2` means a maintainability improvement that should be coupled to the v0.3.0 work touching that area. Effort is relative and assumes behavior-preserving extraction before UI changes.

| Finding | Priority | Relative Effort |
| --- | --- | --- |
| 1. Make route and actor context reactive and authoritative | P1 | Medium |
| 2. Enforce lifecycle invariants under concurrent writes | P1 | Medium |
| 3. Align transport limits and structured errors with import policy | P1 | Small-Medium |
| 4. Batch work-item hydration | P1 | Medium |
| 5. Adopt or retire unused extraction scaffolds | P1 | Medium |
| 6. Give large Angular routes focused state owners | P2 | Medium, staged |
| 7. Split work-item orchestration along existing command/query boundaries | P2 | Medium, staged |
| 8. Bound aggregate reads before enriching them | P2 | Medium |
| 9. Consolidate query and risk semantics without rewriting historical schemas | P2 | Medium |
| 10. Make transaction capabilities explicit in application context | P2 | Small-Medium |
| 11. Resolve the development-toolchain backlog deliberately | P1 | Medium-Large; compatibility investigation required |
| 12. Make isolated verification the default executable workflow | P1 / P2 | Medium |
| 13. Split fixtures and seed scenarios by ownership | P2 | Small-Medium |
| 14. Publish a current developer/agent guide and API placement rule | P2 | Small |

## Findings And Recommendations

### 1. Make Route And Actor Context Reactive And Authoritative

Several project screens read `route.snapshot` inside `computed()` without any signal dependency. Examples include project shell, project home, Planning, and milestone review. The computed value is cached after its first read. Angular can reuse these components when route parameters change, so changing the URL does not necessarily change the IDs driving loads, links, or commands.

Milestone review subscribes to `paramMap`, but its callback calls `loadReview()` using the already-cached computed IDs. That subscription does not make the computed values reactive. Quick Find makes project-to-project and milestone-to-milestone navigation a more common path through this older implementation.

A minimal executable check using the installed Angular `computed()` implementation and the same snapshot-access pattern returned `project-a` after the route snapshot was replaced with `project-b`. This confirms the caching behavior; it was not a full router reproduction. Existing shell tests use a fixed snapshot and do not exercise parameter reuse.

Asynchronous context ownership is also uneven. Work-item detail and Quick Find invalidate stale operations; workspace saved-view and project-filter-option requests use bare subscriptions. An earlier actor's saved-view response can arrive after the actor changes, or project A's cycle/options response can replace project B's options. The server's authorization can remain correct while the client presents stale context.

Recommendations:

- Derive route identity from `paramMap` through signals or an observable pipeline, including inherited project parameters.
- Load context through `switchMap` or equivalent cancellation, and tie lifetime to destruction. Use operation-generation checks where writes or independent refreshes can complete out of order.
- Define one current context key for each feature: workspace, actor, project, and record where applicable. Capture it at operation start and reject stale completion effects.
- Apply that rule to auxiliary data and mutations as well as primary list/detail loads. `takeUntilDestroyed` alone does not prevent a response from an earlier actor or project while the component remains mounted.
- Retain the newer detail/editor guarantees when extracting state. Draft protection from the UX audit should be layered onto context correctness, not replace it.

Acceptance: real router tests navigate project A -> B and milestone A -> B without destroying the component. Delayed responses for the earlier route/actor cannot update current content, option lists, saved views, messages, or draft state.

Evidence: [project shell](../../apps/web/src/app/features/projects/project-shell/project-shell.component.ts#L332), [Planning ID](../../apps/web/src/app/features/projects/project-planning-page.component.ts#L1424), [milestone route subscription](../../apps/web/src/app/features/projects/project-milestone-review-page.component.ts#L787), [unguarded saved-view load](../../apps/web/src/app/features/work-items/workspace-work-item-list-page.component.ts#L1221), [option loads](../../apps/web/src/app/features/work-items/workspace-work-item-list-page.component.ts#L1606).

### 2. Enforce Lifecycle Invariants Under Concurrent Writes

Cycle creation checks for overlapping planned/active ranges, then inserts inside an ordinary transaction. The schema enforces one active cycle and unique nonarchived names, but has no range exclusion constraint. Distinct planned-cycle requests can both pass the overlap check before either commits.

This was reproduced against the actual service and PostgreSQL database. Eight transactions were synchronized at transaction entry, then allowed to run the unchanged `createProjectCycle()` implementation with distinct names and the same date range. **All eight requests succeeded and all eight overlapping planned cycles were stored.** An earlier unsynchronized run accepted one; that illustrates why ordinary parallel tests can miss the race. The synchronization changed scheduling, not validation or persistence behavior.

Locking discipline also varies across adjacent commands. Description updates and parent changes lock current work rows before deciding what changed. Status transitions and board moves read the current row without the same explicit lock before validating transitions and emitting activity. Generic cycle updates read lifecycle state without locking it as closeout does. These are additional source-identified race risks, not additional reproduced failures in this audit.

Recommendations:

- Serialize cycle schedule mutations for a project before evaluating availability, or add an appropriate database exclusion constraint with controlled conflict mapping. Apply the choice consistently to create, update, and reactivate.
- If adding a constraint, first detect and resolve any existing overlaps. Preserve the intended inclusive date-range and archived/canceled/completed exceptions.
- Lock or conditionally update the authoritative current work row before validating status/board transitions and calculating previous-state activity. Check generic cycle mutations against closeout under the same discipline.
- Document lock order across project, cycle, work-item, and attachment operations before extracting commands. Preserve existing sorted parent/work-item locks and closeout retry behavior.
- Map known uniqueness/exclusion/concurrency conflicts to deliberate application errors instead of leaking generic persistence failures.

Acceptance: synchronized overlapping planned creations cannot both succeed. Add real-connection tests for schedule updates/reactivation, closeout versus generic cycle edits, and competing work status/board changes. Keep the existing parent, comment, attachment, and duplicate-closeout concurrency tests green.

Evidence: [cycle creation](../../apps/api/src/services/project-cycle-service.ts#L169), [overlap check](../../apps/api/src/services/project-cycle-service.ts#L444), [cycle indexes](../../apps/api/src/db/schema.ts#L177), [status/board commands](../../apps/api/src/services/work-item-service.ts#L596), [closeout locking](../../apps/api/src/services/project-cycle-closeout-service.ts#L149).

### 3. Align Transport Limits And Structured Errors With Import Policy

The import service allows up to 1 MiB of CSV, 250 rows, and bounded cells. Express installs its default JSON parser before the import routes, with a smaller effective request limit. Parser errors also occur outside the endpoint adapter's structured error mapping.

A read-only check generated 24 valid rows with 4,500-character descriptions. The CSV was 108,669 bytes, and its JSON request body was 108,703 bytes. Calling `WorkItemCsvImportService.preview()` returned 24 valid rows and zero errors. Sending the same input through the actual registered Express preview route returned **413, `text/html; charset=utf-8`**, before the importer ran.

This is a contract mismatch across layers, rather than a reason to loosen every application request limit.

Recommendations:

- Give import preview/apply an explicit route-level transport budget that accounts for the JSON envelope and escaping, while retaining the service's 1 MiB CSV-byte limit and row/cell policies.
- Keep attachment raw-binary bounds separate; that boundary already has focused media/header/size handling.
- Add a common adapter error boundary for JSON parsing, malformed bodies, and payload-too-large errors. Return the established JSON error envelope and safe messages.
- Place request logging so rejected transport requests have useful status/timing evidence without logging bodies or source content.
- Test valid inputs above the parser's current limit, the exact raw-CSV bound, oversized encoded requests, and malformed JSON through the full HTTP boundary.

Acceptance: every valid CSV within the documented policy can reach validation. An oversized or malformed request has a deliberate JSON error response and cannot bypass the domain byte limit.

Evidence: [Express parser placement](../../apps/api/src/adapters/express/server.ts#L63), [import limits](../../apps/api/src/services/work-item-csv-import-service.ts#L49), [domain byte validation](../../apps/api/src/services/work-item-csv-import-service.ts#L245), [adapter error mapping](../../apps/api/src/adapters/express/handler-adapter.ts), [attachment boundary](../../apps/api/src/adapters/express/routes/attachment-routes.ts).

### 4. Batch Work-Item Hydration

Paged reads correctly bound the selected rows and use a read-only repeatable-read transaction for count/window/enrichment coherence. Labels, dependency counts, and hierarchy context already use set-based enrichment. Reporter, assignee, milestone, and cycle hydration still happen sequentially for every row through `toBundle()`.

The audit measured the real `listWorkItemPage()` path using Drizzle's SQL logger and 100 work items sharing the same reporter, assignee, milestone, and cycle. Counts include transaction-control statements:

| Page Size | Returned Rows | SQL Statements | Member Lookups | Milestone Lookups | Cycle Lookups |
| --- | --- | --- | --- | --- | --- |
| 10 | 10 | 49 | 20 | 10 | 10 |
| 25 | 25 | 109 | 50 | 25 | 25 |
| 100 | 100 | 409 | 200 | 100 | 100 |

Repeated identical references still caused repeated queries. The same hydrator serves workspace lists, exports, and other consumers. A 10,000-row export cap bounds record count but does not make tens of thousands of sequential lookup queries a reasonable synchronous path.

Recommendations:

- Collect distinct reference IDs for the selected batch and load each referenced domain once into lookup maps.
- Assemble list/workspace DTOs from preloaded maps, retaining current null handling, ownership validation, inactive/archived context, and stable row ordering.
- Give CSV export a focused projection where it does not need the complete interactive DTO. Keep full-filter export semantics and the limit-plus-one guard.
- Test query count as well as returned data. A new field should not silently add one query per result row.
- Keep enrichment within the existing consistent read transaction; moving queries to unrelated pool calls would sacrifice the guarantee pagination just gained.

Acceptance: page-size growth does not cause four additional reference queries per row. Project/workspace pages and exports retain DTO compatibility, exact totals, sorting, dependency counts, and hierarchy information.

Evidence: [paged read transaction](../../apps/api/src/services/work-item-service.ts#L141), [list assembly](../../apps/api/src/services/work-item-service.ts#L1404), [per-row hydration](../../apps/api/src/services/work-item-service.ts#L1546), [export reuse](../../apps/api/src/services/work-item-csv-export-service.ts#L69).

### 5. Adopt Or Retire Unused Extraction Scaffolds

`SavedViewsStore` has focused tests for load, creation, permissions, rename/delete, pinning, and grouping. A source-reference check found no production consumer. Project and workspace list pages still own their own saved-view state and copies of the mutation/load flows.

Likewise, the shared `work-item-filter-labels.ts` helpers are exercised by tests but unused by production pages, which continue to build labels locally. One resulting parity gap is visible in source: the shared workspace label helper includes the applied risk, while the workspace page's own label construction omits `workRisk` even though it is accepted and applied. Filter-chip removal also uses English display-label parsing as its behavioral identity.

The v0.2.0 implementation notes accurately called the saved-view extraction a scaffold. Nine subsequent sprints have left both implementations in place. The danger is that future developers improve the tested abstraction while the live product continues on a different path.

Recommendations:

- Decide explicitly which helpers are the intended implementation, then wire both pages through them or remove the unused alternatives and their misleading parallel tests.
- Harden store operation lifetime/context before adoption; the current saved-view scaffold also has bare subscriptions and needs the protections from finding 1.
- Preserve scope-specific permissions and archived-project behavior through explicit configuration rather than copying workflow methods.
- Represent active chips with stable field keys and presentation labels. Emit the key for removal instead of parsing translated/display text.
- Keep route-level integration tests that prove the production page uses the shared behavior for personal/shared views, pinning, query update, and failure cases.

Acceptance: a saved-view behavior change has one production owner, and a filter-label fix reaches both lists. An applied hidden risk is visible/removable where appropriate. No orphan implementation remains presented as completed consolidation.

Evidence: [saved-view scaffold](../../apps/web/src/app/features/work-items/state/saved-views.store.ts#L36), [scaffold completion notes](../v0.2.0/implementation-plan.md#L338), [duplicated workspace workflow](../../apps/web/src/app/features/work-items/workspace-work-item-list-page.component.ts#L1221), [shared label helpers](../../apps/web/src/app/features/work-items/query/work-item-filter-labels.ts#L49), [workspace label construction](../../apps/web/src/app/features/work-items/workspace-work-item-list-page.component.ts#L1650).

### 6. Give Large Angular Routes Focused State Owners

The largest routes still combine markup/styles, forms, API orchestration, permission derivation, route state, mutations, and response merging. Compared with measurements recorded in the previous audit, the growth is substantial:

| Source | Previous Audit | Current |
| --- | --- | --- |
| Work item detail | 1,939 lines | 2,740 lines |
| Project Work | 2,035 lines | 2,451 lines |
| Planning | 1,837 lines | 2,240 lines |
| Workspace Work Items | 1,576 lines | 1,893 lines |
| Work item service | 1,370 lines | 1,888 lines |
| Main seed | 1,569 lines | 2,300 lines |

The earlier column is the prior audit's measurement, not a fresh count of the v0.2.0 tag. These totals include inline templates/styles and do not by themselves establish a defect. The practical issue is that one new workflow still requires understanding several unrelated state machines in the same file.

Recommendations:

- Give detail loading/editing, discussion, relationships, and watcher/activity refresh explicit feature-local owners. Keep one record/context coordinator so child stores cannot overwrite each other's fresh data.
- Separate persisted read state from unsaved form state. Preserve the existing selective response merges, source-format baseline rules, operation generations, and same-record Files targeting.
- Move Planning's review loading and cycle/milestone management into focused controllers alongside the existing child components.
- Let list pages compose the existing query/bulk stores and the adopted saved-view controller, with one shared result-load lifecycle.
- Split templates/styles around these ownership boundaries. Moving 1,000 lines into a sibling file without changing responsibility will not solve the maintenance problem.

Acceptance: adding a comment behavior, planning field, or cycle-management command has an obvious focused owner. Route components compose those owners, and delayed responses cannot clobber unrelated drafts or discussion changes.

Evidence: [detail coordinator and generations](../../apps/web/src/app/features/work-items/work-item-detail-page.component.ts#L1326), [Planning composition/state](../../apps/web/src/app/features/projects/project-planning-page.component.ts), [existing bulk store](../../apps/web/src/app/features/work-items/state/project-bulk-triage.store.ts), [attachment component](../../apps/web/src/app/features/work-items/components/work-item-attachments.component.ts).

### 7. Split Work-Item Orchestration Along Existing Boundaries

`WorkItemService` now owns paged and complete reads, hierarchy changes, creation, scalar updates, board movement, batch updates, validation, hydration, activity, notifications, and transaction selection. CSV export reaches into it to reuse hydration; CSV import reaches into its repository-aware creation path. The endpoint module also contains schemas for several distinct capabilities.

A facade is reasonable for compatibility. The debt is the amount of unrelated implementation still behind it and the repeated rules across single-item, bulk, and closeout commands.

Recommended extraction order:

| Boundary | Responsibility | Important Constraint |
| --- | --- | --- |
| Batch hydrator / query service | List/detail projection and lookup maps | Preserve consistent read context and narrow projections |
| Hierarchy commands | Candidate validation, parent changes, child rules | Preserve sorted row locks and two-level invariants |
| Work commands | Create/update/status transitions | Decide against locked current state; retain no-op semantics |
| Bulk commands | Reference validation and per-item outcomes | Preserve partial success and explicit item IDs |
| Board positioning helper | Insertion, ordering, compaction | Preserve complete-board semantics and ordering tests |
| Activity helpers | Changed-field evidence and notification inputs | Stay in the command's transaction; use real previous state |

Start with the measured hydrator problem, then extract commands as the concurrency fixes require. Keep `WorkItemService` as a thin endpoint-facing facade while consumers migrate. The repository-aware create path is useful; it should remain explicit so import can participate in one transaction.

Acceptance: adding a work field does not require tracing board positioning and bulk execution to understand its update side effects. Extraction introduces no nested transactions or asynchronous after-commit activity/notification writes.

Evidence: [service responsibilities](../../apps/api/src/services/work-item-service.ts), [bulk execution](../../apps/api/src/services/work-item-service.ts#L214), [repository-aware creation](../../apps/api/src/services/work-item-service.ts#L268), [activity assembly](../../apps/api/src/services/work-item-service.ts#L1657), [endpoint schemas](../../apps/api/src/endpoints/work-items.ts).

### 8. Bound Aggregate Reads Before Enriching Them

The scalable work-discovery release fixed interactive work-list row selection. Other read models still retrieve and process complete collections before displaying small previews:

- My Work performs five complete workspace-list reads with full DTO enrichment, then slices most sections to eight items.
- Portfolio loads complete workspace work/dependency collections, then performs milestone, active-cycle, and latest-report reads per project.
- Planning loads full project collections and constructs full risk arrays; the UI displays a few rows from each. Its active/upcoming/completed cycle summaries additionally call cycle review logic.

These are source-identified growth risks, not hosted-load measurements. The raw SQL performance scripts do not measure the complete endpoint's hydration, serialization, or aggregate fan-out.

Recommendations:

- Separate exact aggregate counts from bounded preview selection and narrow projections. Select the intended preview before full enrichment.
- Batch project-level metadata for Portfolio, and measure query growth against both project count and work count.
- Reuse already-loaded evaluation context when constructing cycle summaries instead of reloading complete review data unnecessarily.
- Add complete endpoint evidence for My Work, Planning, Portfolio, and export alongside the existing raw plan checks. Measure queries, returned rows, payload size, and local latency.
- Preserve intentional complete reads for board ordering and immutable historical evidence. Do not introduce arbitrary caps that silently change counts or truncate snapshots.

Acceptance: a dashboard displaying eight rows does not fully hydrate thousands of matching records. Summary counts remain exact, previews declare their bounds, and the board/closeout history retain their documented completeness.

Evidence: [My Work reads and slicing](../../apps/api/src/services/my-work-service.ts#L75), [Portfolio fan-out](../../apps/api/src/services/portfolio-service.ts#L76), [Planning reads](../../apps/api/src/services/planning-service.ts#L43), [raw SQL evidence](../../apps/api/src/db/performance-evidence.ts#L48).

### 9. Consolidate Query And Risk Semantics Without Rewriting Historical Schemas

Query behavior is spread across TypeScript DTOs, API schemas, SQL builders, saved-view normalization, frontend form conversion, URL serializers, chips, backend link allowlists, and report/closeout snapshot parsers. That distribution is partly legitimate, but optional fields can be added to the type without forcing every runtime path to handle them.

For example, the current query includes hierarchy and exact-parent fields, while the backend project-link allowlist and snapshot query schemas have different field sets. Historical schemas may intentionally represent an earlier subset; current navigation helpers should not accidentally lag behind current query behavior. `satisfies z.ZodType<...>` is useful but does not establish behavioral parity for every optional field.

Risk assembly is improved, but the shared review definitions still contain milestone-specific descriptions reused for cycles, and Planning retains its own section assembly. My Work also repeats date/risk constants and predicates in its page: backend day arithmetic uses UTC while frontend `addDays()` uses local calendar arithmetic before converting to an ISO date. DST boundaries deserve explicit agreement.

Recommendations:

- Publish a typed current-query field policy and test each field through parse -> canonical form -> URL -> reload -> save/open -> export. Keep transient page state separate.
- Use stable query-field identities in chips and link helpers. Add parity tests that make supported-field omissions deliberate.
- Keep versioned stored-snapshot schemas explicit and independently tested. Do not replace v1 parsing with the latest live query normalizer or add current limits to historical arrays.
- Consolidate runtime enum tuples and policy constants where they truly represent the same public domain, following the successful authored-content format/normalization constants.
- Make risk definitions scope-neutral or scope-aware, and keep unique-work counts separate from risk-occurrence counts. Share evaluation rules while preserving page/snapshot projections.
- Extract My Work ranking/date evaluation into a focused pure unit with an explicit clock; retain the existing frozen-clock integration tests and add UTC/DST boundary cases.

Acceptance: a new optional filter has a reviewable compatibility checklist and cannot silently disappear from a current link or persisted query. Old snapshots still parse/render/export unchanged. Matching work has consistent risk meaning across live surfaces.

Evidence: [query contract](../../packages/contracts/src/work-items.ts#L33), [runtime query parsing](../../apps/api/src/validation/work-item-query.ts), [backend link policy](../../apps/api/src/services/work-item-query-link.ts), [report parser](../../apps/api/src/validation/project-status-report-snapshot.ts), [closeout parser](../../apps/api/src/validation/project-cycle-closeout-snapshot.ts), [risk definitions](../../apps/api/src/services/work-risk-sections.ts#L54), [frontend date evaluation](../../apps/web/src/app/features/my-work/my-work-page.component.ts#L857), [backend UTC policy](../../apps/api/src/domain/work-risk-policy.ts).

### 10. Make Transaction Capabilities Explicit In Application Context

Most services still accept optional `db` and silently fall back to ordinary repository execution. Newer attachments require a database, while closeout's transaction-dependent behavior still uses the optional wrapper. Production startup currently supplies the database correctly; the issue is that the types permit weaker semantics and tests/callers can select them accidentally.

Repository transaction helpers also cast a transaction executor through `unknown` to `WorktrailDb`. The query interface is usable, but the cast hides which operations are valid on a transaction and makes future nesting mistakes easier.

Recommendations:

- Give production application services explicit write-transaction and consistent-read capabilities. Use repository callbacks so Drizzle wiring stays at the infrastructure boundary.
- Make the repository factory accept the real database-or-transaction executor type rather than pretending every executor is the top-level database.
- Make test execution modes explicit: a pure fake repository runner is useful, but a concurrency test must use real transactions/connections.
- Preserve one transaction for command state, activity, notifications, and closeout evidence. Keep attachment object-store compensation outside the claim of database atomicity.
- Avoid a general unit-of-work framework or command bus. A small typed runner and clear service ownership are sufficient here.

Acceptance: constructing a production command service without its required transaction capability is a type/configuration error. Integration tests exercise the same atomicity mode as runtime code, and command helpers can participate in an existing transaction without starting another one.

Evidence: [transaction factory and casts](../../apps/api/src/repositories/index.ts#L48), [optional service wrappers](../../apps/api/src/services/work-item-service.ts#L805), [closeout wrapper](../../apps/api/src/services/project-cycle-closeout-service.ts#L350), [required attachment context](../../apps/api/src/services/attachment-service.ts#L29), [production composition](../../apps/api/src/main.ts#L58).

### 11. Resolve The Development-Toolchain Backlog Deliberately

The fresh full npm audit still reports 34 findings, including five critical and 21 high entries. Production-only audit reports zero. This matches the development-toolchain backlog recorded for v0.2.9; it should remain visible as unfinished work rather than becoming a permanent footnote.

The reported dependency paths include Angular build/CLI, Vitest and its worker/mocking dependencies, Karma-related tooling, and Drizzle development tooling. Some proposed npm fixes involve major changes or backwards version choices. The audit metadata alone does not establish application exploitability or a compatible upgrade path.

Recommendations:

- Assign a verified toolchain-update task with current advisory paths, compatible runtime/framework versions, affected commands, and an owner.
- Separate straightforward compatible updates from framework/test-runner migrations. Do not use forced audit fixes or broad overrides as a substitute for compatibility verification.
- Keep the production audit gate, and add a visible development audit baseline with explicit, dated exceptions while remediation proceeds. Avoid a gate that is permanently ignored because it always fails.
- Verify schema generation/migrations, editor typing/undo/composition, all test runners, lazy loading, and production preview after an upgrade; ordinary unit tests alone are insufficient.
- Reassess obsolete/transitive development tooling as part of that task, without making a wholesale test-runner replacement a prerequisite for unrelated correctness fixes.

Acceptance: the release has either remediated the findings or a bounded, owned exception/remediation record. A clean production audit is never reported as a clean whole-repository dependency audit.

Evidence: fresh `npm audit` results above; [dependency declarations](../../package.json), [Angular tooling](../../apps/web/package.json), [API tooling](../../apps/api/package.json), [current CI audit scope](../../.github/workflows/ci.yml#L42), [prior release limitations](../v0.2.9/verification-notes.md).

### 12. Make Isolated Verification The Default Executable Workflow

The README now explicitly warns that package/browser tests need disposable data, which is good. The default browser command nevertheless uses the configured/default database, drops and recreates its public schema, and restores seed records afterward. The reset guard checks locality; a local host is not proof that a database is disposable. Skip-reset flags do not prevent mutation-heavy tests or restore behavior.

Release verification currently relies on manually assembling temporary databases, several storage roots, ports, and environment variables. `API_PORT` is configurable in Playwright, but the checked-in Angular proxy still targets port 3000. This was correctly documented in v0.2.9; it remains an executable setup mismatch.

Recommendations:

- Add one owned verification runner that provisions or requires an explicitly identified disposable database, assigns compatible free ports, creates temporary marked attachment roots, and cleans up its resources in `finally`/signal handling.
- Require a clear test-database identity or marker before destructive setup. Keep an intentional override for deliberate inspection; do not infer safety solely from localhost.
- Generate the test proxy from the selected API port, or use the compiled single-origin preview for workflows where appropriate.
- Keep editor-only tests independent of PostgreSQL. Provide focused commands as well as the complete release command.
- Extend targeted coverage for the failures found here: route reuse, out-of-order actor/options responses, synchronized lifecycle writes, transport/domain size parity, and endpoint query budgets.
- Expand lint/typecheck coverage to API test/support and E2E code deliberately. Current API lint targets `src`, and E2E code has no dedicated typecheck gate.

Acceptance: a developer or agent can run the documented complete verification command without first constructing an ad hoc environment or risking ordinary local data. Two isolated runs can select nondefault ports consistently. Cleanup removes only resources owned by that run.

Evidence: [browser setup](../../e2e/global-setup.ts), [restore behavior](../../e2e/global-teardown.ts), [database reset guard](../../apps/api/src/db/reset.ts), [Playwright ports](../../playwright.config.ts), [fixed proxy](../../apps/web/proxy.conf.json), [README warning and caveat](../../README.md#L571), [lint coverage](../../eslint.config.js).

### 13. Split Fixtures And Seed Scenarios By Ownership

The main seed is 2,300 lines; attachment seeding has already been separated successfully. The API work-item test file is 4,560 lines, the project work-page spec is 3,235 lines, and detail's spec is 2,659 lines. Much of the surrounding test infrastructure repeats workspace creation, stable IDs, database cleanup order, and scenario setup.

The tests themselves are valuable: concurrent updates, legacy source preservation, no-op behavior, archived reads, immutable snapshots, exact downloads, and dependency/hierarchy behavior deserve preservation. Consolidating fixtures should make those cases easier to understand rather than replacing explicit intent with a configurable fixture framework.

Recommendations:

- Keep seed orchestration small and move stable IDs plus named scenarios into focused modules: base workspace, planning/risk, closeout, hierarchy, authored content, collaboration, and attachments.
- Keep seed modules import-safe. Importing fixture identity should not connect to a database or execute seeding.
- Centralize integration workspace cleanup and minimal fixture builders, with explicit dependency order and resource ownership.
- Split large specs along the command/query capabilities being extracted, preserving behavior assertions and real-database cases.
- Keep demo seeding separate from small test fixtures. Time-dependent demo health should have an explicit as-of intent; test clocks should remain deterministic, and historical report/closeout evidence should not be rewritten to make a fixture look current.

Acceptance: adding a foreign-key-backed feature updates one fixture/cleanup owner, and adding a seed scenario does not require editing unrelated domains. Repeated seed remains deterministic under its documented clock assumptions; migration preservation tests remain independent of reset/seed tests.

Evidence: [main seed](../../apps/api/src/db/seed.ts), [focused attachment seed](../../apps/api/src/db/attachment-seed.ts), [API work-item tests](../../apps/api/tests/work-items.test.ts), [project list tests](../../apps/web/src/app/features/work-items/work-items-page.component.spec.ts), [integration cleanup example](../../apps/api/tests/repositories.test.ts#L50).

### 14. Publish A Current Developer/Agent Guide And API Placement Rule

The sprint documents provide unusually detailed history and verification evidence. They are less efficient as the first source for deciding where a new change belongs. Some current rules still live in v0.2.0 design notes, including treating `WorktrailApiService` as a compatibility facade. The facade has continued growing and remains common in new feature code, while cycles and Quick Find also use domain clients directly.

Recommendations:

- Add a short current contribution/architecture guide, linked from the README, with authoritative ownership paths and a feature-change checklist. A small repository agent instruction file can point to that same guide rather than duplicating it.
- Make the rule explicit: new feature state uses focused domain clients; compatibility forwarding remains temporarily for existing consumers, with migration/removal tied to touched features.
- Record the public invariants that a future agent must preserve: local actor authorization, transaction/lock order, source-format no-ops, explicit mentions, immutable snapshots, complete board reads, paged-query semantics, and coordinated attachment persistence.
- Include safe verification commands and the supported isolated runner. Keep migration upgrades separate from destructive demo setup.
- Mark extraction scaffolds as unfinished until production consumers migrate, and update the current guide when ownership moves. Correct the README's archived-directory tree labels while doing that documentation pass; its actual checked Markdown links resolved during this audit.

Acceptance: a developer can answer where to put a query, command, client, feature state, snapshot parser, or regression test without reading several old sprint plans. The guide names implementations actually used by the app.

Evidence: [v0.2.0 API placement decision](../v0.2.0/technical-design.md#L73), [growing facade](../../apps/web/src/app/core/worktrail-api.service.ts), [current composition and clients](../../apps/web/src/app/core/api), [repository setup/verification](../../README.md).

## Boundaries To Preserve

- Keep the transport-neutral handler layer and thin Express route registration. The JSON parser fix belongs at the adapter boundary, not in each domain service.
- Keep the authored-content source/format pair authoritative, the finite rendering tree, complete literal fallback, and the shared preview/read viewer. Do not replace these with stored/generated HTML during cleanup.
- Keep report and closeout parsers versioned, with compatibility fixtures. Current query evolution must not silently rewrite historical evidence.
- Keep complete board reads and explicit visible-ID bulk mutation. Pagination does not justify partial board columns or query-wide bulk edits.
- Keep attachment validation, immutable bytes, integrity checks, marked roots, and compensation behavior. Filesystem/database crash windows are an explicit operational limitation, not something a generic transaction wrapper can eliminate.
- Keep local identity and local file storage limitations explicit. Hosted authentication, managed object storage, forecasting, custom workflow engines, event buses, and new infrastructure are separate feature decisions.

## Smaller Technical Follow-Ups

- Preserve diagnostic causes internally when safe errors cross boundaries. Quick Find currently replaces the original persistence/mapping error with a generic unavailable error, limiting diagnosis. Log operation/correlation metadata without query text, authored content, credentials, or file bytes.
- Consider a read-only attachment reconciliation report for missing/corrupt objects and unreferenced files. Its first version should report evidence; repair/deletion requires a separate explicit workflow and coordinated backup policy.
- Keep response/date validation deliberate. Regex-shaped date strings and permissive query subsets should not be mistaken for full calendar or compatibility validation.
- Prefer a small shared display/token vocabulary over duplicated status/priority/date label maps, while allowing contextual copy and frozen historical schemas to differ intentionally.
- Keep build budgets unchanged during extraction, and watch whether eagerly imported clients/viewers pull lazy authored-content code into the initial graph.

## Suggested Implementation Sequence

1. **Establish executable safety and regression cases.** Add isolated verification support; capture route reuse, delayed responses, synchronized cycle overlap, CSV HTTP parity, and hydration query counts before changing those paths.
2. **Repair correctness.** Make route/context state reactive, align parser/error boundaries, serialize lifecycle invariants, and audit adjacent status/board/closeout lock protocols. These fixes should remain reviewable independently of broad file moves.
3. **Adopt existing frontend state.** Wire or retire saved-view/filter scaffolds, use stable chip identities, and define the current API-client rule. Preserve query/page/export behavior while doing so.
4. **Extract measured backend work.** Batch hydration first, then separate queries, hierarchy, bulk, board positioning, and activity as command fixes require. Make transaction capabilities explicit without introducing nested transactions.
5. **Consolidate growing surfaces and fixtures.** Extract focused detail/Planning owners, bound dashboard/portfolio previews, split fixtures/seeds, and publish the current guide alongside the UX changes.
6. **Complete the toolchain task and release verification.** Keep dependency upgrades separately reviewable, rerun migrations/preservation tests and all application/editor/compiled-preview gates, and record any remaining bounded exceptions.

## Release Criteria

- Route identity, request context, and draft state agree after reused-route and actor changes.
- Real concurrent cycle mutations cannot violate schedule/lifecycle invariants, and command activity reflects locked previous state.
- Transport and domain limits agree, with structured errors for rejected JSON requests.
- Work-page reference hydration uses batch reads with a small fixed query count rather than per-row lookup growth.
- Shared frontend abstractions have real production consumers; duplicate/orphan paths are removed or explicitly retained with a reason.
- Large routes and the work service have clear state/command/query ownership, with transaction and snapshot promises preserved.
- Aggregate performance evidence covers complete endpoint behavior rather than only representative SQL.
- Full and production-only dependency audits are reported separately, and the development backlog has an owner and bounded disposition.
- The documented verification workflow isolates and cleans up its data/resources automatically.
- All existing regression, editor, and production-preview gates pass on the final v0.3.0 tree.

The repository is ready for focused consolidation. The strongest baseline will come from making existing guarantees consistent and existing abstractions operational, with the measured correctness and query problems fixed before the next feature slate expands them.
