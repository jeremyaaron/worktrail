# Worktrail v0.3.0 Phase 5 Hydration Evidence

Collected October 17, 2026 on macOS with Node 24.16.0, npm 11.13.0, Drizzle 0.45.2/pg 8.22.0, and
owned disposable PostgreSQL 16. These are complete service/HTTP page measurements, not isolated
hydrator timings. Local elapsed times are diagnostics, not a benchmark distribution or an SLA.

## Method

`tests/support/hydration-fixture.ts` is import-safe: it opens no connection and executes no seed on
import. Each named size builds that many rows in each of two projects, one active and one archived.
Every selected row has reporter, assignee, milestone, cycle, and two label references. Historical
inactive/archived references, direct parent/child summaries, and blocking dependencies are present.
Cycles are historical completed fixtures, not evidence of concurrent scheduling correctness.

Project pages select 10/25/100 rows from their project. Workspace pages include archived projects,
select the same window sizes from twice as many eligible rows, and include both projects. Mixed
fixtures alternate repeated and distinct reference IDs. Additional 100-row repeated/distinct fixtures
prove the same SQL behavior; distinct workspace windows contain 100 distinct member, milestone, and
cycle IDs. Reporter and assignee can share an ID; a separate unit case covers differing IDs and
reversed database result order.

The optional Drizzle logger on `createDb` counts every statement issued through the measured database,
including `BEGIN`/`COMMIT`, project authorization, count, selected window, all reference/related reads,
and HTTP actor resolution. Fixture insertion and cleanup are outside each measured interval. HTTP
measurements use the real Express endpoint and the owned local-listener helper, not a mocked handler.
JSON byte counts include page metadata and all hydrated rows. Service and HTTP payload equality,
reference identity, labels/history, hierarchy, and dependency evidence are asserted.

The permanent budget is **at most 20 SQL statements** for a fully populated 100-row project or
workspace page. The tests also apply it to 10 and 25 rows. No timing threshold or test retry is used.

## Mixed References: Before And After

Baseline run: `316a9eec-666d-48b1-b48c-0f9e2dddd7a7`, before replacing the per-row reference reads.
Its three new budget tests failed as intended; all 630 existing API tests passed, and cleanup succeeded.
Final accepted run: `6b5ea786-1d24-4275-9ee9-458210e1adf6`, all 657 API tests passed and resources cleaned.

| Rows | Scope | Entry | SQL Before | SQL After | JSON Bytes (Both) | Before ms | After ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | Project | Service | 49 | 12 | 22,989 | 164.23 | 35.41 |
| 10 | Project | HTTP | 50 | 13 | 22,989 | 83.15 | 44.58 |
| 10 | Workspace | Service | 48 | 11 | 24,260 | 66.08 | 25.63 |
| 10 | Workspace | HTTP | 49 | 12 | 24,260 | 78.68 | 49.92 |
| 25 | Project | Service | 109 | 12 | 57,463 | 211.18 | 32.01 |
| 25 | Project | HTTP | 110 | 13 | 57,463 | 359.27 | 48.06 |
| 25 | Workspace | Service | 108 | 11 | 60,501 | 378.68 | 80.41 |
| 25 | Workspace | HTTP | 109 | 12 | 60,501 | 276.60 | 42.47 |
| 100 | Project | Service | 409 | 12 | 229,857 | 205.77 | 39.27 |
| 100 | Project | HTTP | 410 | 13 | 229,857 | 204.59 | 35.84 |
| 100 | Workspace | Service | 408 | 11 | 241,634 | 188.41 | 28.04 |
| 100 | Workspace | HTTP | 409 | 12 | 241,634 | 206.40 | 33.50 |

Before: project service cost was `9 + 4N`, workspace service `8 + 4N`, with one additional HTTP actor
query. After: member union, milestone, cycle, label, dependency, parent, and child-summary batches cost
seven statements per selected chunk. Project authorization/count/window plus transaction control cost
five, workspace count/window plus transaction control four. HTTP adds one actor-resolution statement.
Joined project summaries need no extra lookup. These populated page counts are constant across the
measured sizes. Null-reference or empty pages may issue fewer statements.

## Repeated And Distinct 100-Row Windows

| Mode | Scope | Entry | SQL | JSON Bytes | Local ms |
| --- | --- | --- | --- | --- | --- |
| Repeated | Project | Service | 12 | 230,933 | 32.49 |
| Repeated | Project | HTTP | 13 | 230,933 | 33.36 |
| Repeated | Workspace | Service | 11 | 242,722 | 29.26 |
| Repeated | Workspace | HTTP | 12 | 242,722 | 70.16 |
| Distinct | Project | Service | 12 | 228,363 | 48.18 |
| Distinct | Project | HTTP | 13 | 228,363 | 30.26 |
| Distinct | Workspace | Service | 11 | 240,370 | 38.39 |
| Distinct | Workspace | HTTP | 12 | 240,370 | 38.40 |

Fresh owned API runs write `hydration-evidence.json` alongside their sanitized summary under
`test-results/verification/<runId>/`. It retains only modes, scope/entry, counts, bytes, and diagnostic
timings, not SQL parameters, identities, source content, or credentials. This document preserves the
accepted measurements even when ignored run artifacts are cleared.

## Consistency And Boundaries

Count, window, all hydration, and DTO projection remain inside one read-only repeatable-read callback.
Real tests commit member/milestone/cycle/label/parent/dependency changes on another connection, verify
the enclosing project and workspace reads retain the old snapshot, and verify a subsequent read sees
the commit. Existing count/window/reporter concurrent-commit coverage also remains passing.

Interactive page, board, export, and parent-reference projections exclude work description source/
format. Detail still retrieves source, and authored search still filters on it. Wire summaries remain
unchanged: reducing discarded database bytes does not claim a reduction in the measured JSON payload.
Historical inactive/archived assignments remain readable; missing mandatory reference errors and null
optional-reference behavior remain covered. Foreign references are not exposed; workspace project
joins also enforce the authorized workspace.

CSV keeps the existing 19 summary columns, canonical filters/order, ignored pagination, and 10,000-row
limit. Project and workspace exact-cap/overflow tests pass. A real 501-row ordered export crosses the
500-row hydration boundary, preserves parent context, and stays inside one transaction with at most
18 statements. Each chunk bounds member IDs at 1,000 and other selected-reference IDs at 500; total
query count can grow by chunk. Exports still materialize capped results in memory.

This phase does not narrow dashboard evaluation reads, guarantee constant-time counts, optimize
arbitrarily large datasets, or prove lifecycle race safety. Those remain their later implementation
phases. It is local API/contracts evidence, not remote Linux CI or full browser/release acceptance.
