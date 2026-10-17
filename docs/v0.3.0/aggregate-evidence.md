# Aggregate Read Evidence

Phase 10 acceptance, October 17, 2026. This measures complete HTTP paths, not just a hydrator
microbenchmark. SQL counts include transaction control and development actor resolution.

## Fixture And Method

`tests/support/aggregate-fixture.ts` is import-safe. The representative workspace has 15 active projects,
60 work records per project (900 total), three members including an inactive historical assignee,
15 milestones, 45 cycles (active/planned/completed), 15 labels, 900 label assignments and 885 dependency
edges. Work includes open and terminal states, null/zero/positive estimates, due/stale overlaps, parent/child
references, and roughly 3.3 KB of authored description source per record. Reports alternate frozen v1/v2.
The small comparison has one project and 60 records with the same reference/field distribution.

Baseline `16a11656-3ffc-4387-897d-817e3a03494b` copied the six pre-phase aggregate/risk service files from
commit `20144b490f76d34371429c686d8e18594593cb31` using `git archive` into an owned private checkout.
The fixture and HTTP measurement were identical; working files/data were not reverted or reset.
Final run `dd4ba41f-4dc0-408d-848f-b02ba67a6851` measures the implemented paths and retains
`aggregate-evidence.json` in its ignored verification result directory. Both runs provisioned their own
Docker PostgreSQL 16, storage and transaction-bound repositories, then removed owned resources.

Machine: Apple M1, arm64 Darwin 25.5.0, Node 24.16.0/npm 11.13.0. Cold means the first endpoint request
in that fixture/process; warm is its immediate repeat, not a controlled PostgreSQL/OS disk-cache flush.
Final timing was collected alongside other selected integration cases. Timing is diagnostic, not an
SLA, throughput claim, isolated benchmark, or millisecond acceptance threshold.

## Complete HTTP Results

| Endpoint | Baseline SQL | Accepted SQL | Baseline Bytes | Accepted Bytes | Narrow Rows | Enriched Preview IDs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| My Work | 51 | 13 | 111,622 | 111,622 | 900 | 32 |
| Portfolio | 53 | 9 | 75,242 | 75,242 | 900 | 0 |
| Planning | 38 | 11 | 113,023 | 50,130 | 60 | 22 |
| Milestone review | 10 | 9 | 44,203 | 44,203 | 60 | 27 |
| Cycle review | 11 | 9 | 46,164 | 46,164 | 60 | 15 |

Every accepted SQL count was identical for one and 15 projects and for first/repeat requests. Portfolio
has exactly one milestone, one active-cycle and one latest-report query across all project IDs, rather
than three metadata queries per project. Complete project rows remain returned; attention collections
remain five-row previews. Latest reports use publishedAt, createdAt, then descending ID for stable ties.
Only the selected snapshot is parsed, with record binding checked; report narrative columns are omitted.

Narrow rows are actual evaluation-projection result lengths, not complete DTOs. Enriched preview IDs are
the selected union passed to parent/reference enrichment once; My Work also hydrates the same selected
summary union through the existing full list-item hydrator. Portfolio's zero means no work-preview DTO
hydration, not zero project/milestone/report metadata. Baseline code did not expose the new projection
methods, so its zero-valued evaluation counters in the raw baseline artifact are **not** a claim that
the baseline read zero records.

| Endpoint | Baseline First / Repeat ms | Accepted First / Repeat ms |
| --- | ---: | ---: |
| My Work | 209.06 / 137.94 | 120.70 / 150.52 |
| Portfolio | 113.79 / 88.95 | 119.47 / 96.48 |
| Planning | 56.09 / 70.43 | 65.94 / 35.44 |
| Milestone review | 19.96 / 15.39 | 42.77 / 52.07 |
| Cycle review | 15.43 / 14.62 | 36.06 / 83.39 |

These timings do not establish universal latency improvement. Deterministic gains are reduced SQL
fan-out, no authored work-source selection, bounded enrichment and a smaller Planning response.

## Selection And Consistency

- My Work evaluates relevance/counts on narrow facts, captures one UTC clock, selects each eight-row
  preview and hydrates the distinct union once (at most 48 IDs). Existing relevance, ordering, stale
  assigned policy and query links are preserved; complete-query oracle tests verify preview/count parity.
- Planning uses one project evaluation and one cycle metadata list. Active/upcoming/completed summaries
  reuse the same facts, clock and dependency context instead of calling full cycle-review services again.
  Seven risk previews select at most five rows each; exact health counts drive metrics, risk-signal totals
  and continuation counts. Existing project board ordering for blocked/unassigned previews is retained.
- Milestone/cycle review selects five-row risk previews and eight-row movement before member/milestone/
  parent reference reads. Counts, breakdowns and target estimates evaluate the complete applicable scope.
  The current cycle implementation still reads the project's 60 narrow rows before selecting its 20-row
  cycle scope; this evidence does not conceal that remaining work.
- Repositories compute cross-project dependency membership with the same predicate used by live queries.
  Explicit identifiers preserve SQL correlation in both single-table SELECT and joined WHERE contexts.
  Terminal neighbors, inactive assignees and ownership checks retain their supported meanings.
- Five repeatable-read tests commit external member/milestone/parent/status changes after snapshot
  establishment. Every aggregate retains the original complete result; a subsequent read sees changes.
  Throwing root-repository proxies detect scope escapes. Reads/enrichment are sequential within the scope.
- A 60-row board remains complete. A real 20-item closeout preserves every stored item and replays the
  original evidence rather than applying preview limits. Report history likewise remains versioned,
  immutable and separate from bounded current-work previews.

## Limits And Gates

Exact evaluation is not constant-time: workspace/project scans, two dependency membership subqueries
per evaluation row, in-memory filtering/sorting and complete Portfolio rows still grow with data.
This is not distributed analytics, indexing/EXPLAIN certification, cursor pagination or a concurrency
throughput benchmark. No results are silently truncated to pass SQL budgets. The endpoint budget is
20 statements on this populated fixture, with stricter one-per-category Portfolio assertions and
explicit selected-ID bounds; empty/reference-free cases can use fewer statements.

Acceptance: 239 API cases across 20 affected files and 42 resource checks; 12 focused Planning Angular
cases (including exact 12-count/five-row/seven-more rendering); production web build warning-free at
388.66 kB initial. The unchanged full Angular suite, browser/editor/site suites and dependency audits
were not rerun. Full CI/release acceptance remains a later gate. See [verification notes](verification-notes.md#phase-10-narrow-aggregate-reads-and-preview-selection).
