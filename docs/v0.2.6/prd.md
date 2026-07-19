# Worktrail v0.2.6 PRD

## Status

Implemented

## Summary

Worktrail v0.2.6 should add Scalable Work Discovery.

Worktrail's project and workspace work lists have become dependable operating surfaces. Users can
combine search, workflow, ownership, planning, dependency, risk, and hierarchy filters; preserve that
state in URLs and saved views; select visible work for project batch triage; and export the applied
result set. The product contract is strong, but the read boundary is not: each list request still loads
and enriches every matching work item.

That behavior is acceptable for the deterministic demo workspace, but it does not provide a credible
path toward larger teams or long-lived projects. As work accumulates, response payloads, rendering
cost, enrichment work, and synchronous exports all grow without a bound. The absence of paging also
leaves users without an exact result count or a clear position inside a large result set.

The product theme is **Scalable Work Discovery**. v0.2.6 should introduce server-backed pagination for
project Work and workspace Work Items while preserving the query behavior users already trust. Page
navigation should be explicit, accessible, URL-backed, and distinct from the durable filter definition
stored in a saved view. Project bulk triage should remain honest about selecting only the visible page,
and CSV export should continue to represent the full applied filter under a documented synchronous
safety limit.

This release should not become a generic data-grid framework, infinite-scroll experiment, background
job system, or rewrite of every bounded work collection. It should establish one production-shaped
paged read contract for the two surfaces that can grow without bound, then use implementation evidence
to decide whether that contract deserves broader reuse.

## Context

Worktrail currently supports:

- project and workspace work lists backed by one canonical `WorkItemQuery` filter contract;
- applied-versus-draft filter state with active chips that describe only the current result set;
- stable URL serialization for search, filters, hierarchy, and sorting;
- personal and shared saved views with pinned shortcuts;
- copy links and return URLs that preserve work-list context;
- project-scoped batch triage over explicitly selected visible rows;
- filtered project and workspace CSV export;
- shallow parent identity, child summaries, labels, planning context, and dependency enrichment;
- deterministic ordering for each supported sort mode;
- a project board with persisted cross-column and within-column order;
- bounded My Work, Planning, Cycle Review, Milestone Review, Portfolio, parent-candidate, and child-work
  reads;
- PostgreSQL persistence and transport-neutral endpoint handlers;
- local development, production preview, CI, health endpoints, and OpenAPI documentation.

Project and workspace list endpoints currently return arrays containing all matching rows. The Angular
pages treat the array length as the result count and render the full collection. CSV export calls the
same unbounded domain read before serializing the file. This creates a shared scaling limit across the
database, API payload, browser memory, rendering, and export path.

The v0.2.5 release called this limitation out explicitly after adding set-based hierarchy enrichment.
The correct next move is not to remove useful context from rows. It is to bound the interactive list
contract while keeping filters, sorting, exports, and focused operational views semantically clear.

## Problem

Project Work and workspace Work Items do not scale with the amount of retained work.

Current friction and risk:

- every matching row is read, mapped, enriched, transferred, and rendered even when the user can only
  inspect a small portion of the list;
- filtered results do not show an authoritative total, visible range, or current position;
- large result sets can cause slow responses, oversized Lambda/API Gateway payloads, and expensive
  Angular change detection and DOM work;
- broad workspace searches become progressively less usable as projects retain more history;
- hierarchy, label, member, milestone, cycle, project, and dependency enrichment remains set-based but
  still scales with the complete matching set;
- current CSV export has no explicit result boundary and could consume excessive memory or execution
  time in a future constrained runtime;
- adding client-only pagination would reduce rendered rows but would not reduce database, service, or
  network work;
- page state has different semantics from saved filter state, but the product has not yet formalized
  that distinction;
- bulk selection could become misleading if paging were added without clearly limiting selection to
  the current visible page;
- mutable work can move between pages as status, priority, dates, or update timestamps change, so stale
  page URLs and post-mutation recovery need deliberate behavior;
- the project board shares work-item read behavior but cannot be silently truncated because complete
  status columns and neighboring board positions are part of its interaction model.

The gap is both user-facing and architectural. Users need fast, understandable navigation through
large filtered sets. The application needs a bounded query response, deterministic ordering, exact
count semantics, and explicit separation between durable query definition, transient navigation state,
and full-result export behavior.

## Goals

- Add server-backed pagination to project Work and workspace Work Items.
- Show the exact number of matching work items and the visible result range.
- Provide predictable previous, next, and direct page navigation.
- Support practical page-size choices with a strict server maximum.
- Keep page and page-size state in shareable URLs and browser history.
- Preserve the existing draft/apply filter contract and reset paging when the applied result definition
  changes.
- Keep saved views focused on durable filters and sort rather than a stale result position.
- Preserve current-page context through work-item detail return navigation.
- Make project batch selection explicitly page-scoped and safe across navigation and mutations.
- Keep CSV export aligned to the complete applied filter, independent of the visible page.
- Add a documented synchronous export limit with a controlled, actionable failure.
- Preserve exact existing filter, sort, permission, archived-project, and hierarchy semantics.
- Ensure all paged sort orders are deterministic and stable enough for normal navigation.
- Keep board, My Work, Planning, review, Portfolio, hierarchy candidate, and child-work behavior intact.
- Preserve transport-neutral endpoint handlers and straightforward local setup.

## Non-Goals

- Do not add infinite scrolling or virtual scrolling.
- Do not add cursor pagination, opaque continuation tokens, or snapshot-isolated browsing in this
  release.
- Do not build a generic table, query, pagination, or repository framework.
- Do not paginate the project board or silently hide board cards.
- Do not redesign board ordering, board columns, or drag/drop behavior.
- Do not paginate bounded My Work, Planning, Cycle Review, Milestone Review, Portfolio, child-work, or
  candidate-search collections.
- Do not add cross-page or query-wide durable bulk selection.
- Do not add a `Select all matching work` mutation path.
- Do not add cross-project bulk edit.
- Do not add full-text ranking, fuzzy-search UI, search suggestions, or a global command palette.
- Do not change existing search matching semantics in this release.
- Do not add background export jobs, export history, scheduled exports, or cloud object storage.
- Do not add arbitrary user-configurable page sizes above the supported options.
- Do not make saved views remember a particular page number.
- Do not add table column customization, density preferences, frozen columns, or user-defined sorting.
- Do not add production authentication, AWS infrastructure, queues, event streaming, or observability
  services.
- Do not broaden Work Breakdown beyond its current two-level model.

## Target Users

### Project Maintainer

Needs to work through a growing backlog, understand how many items match the current operating view,
and batch-triage visible work without accidentally changing unseen pages.

### Contributor

Needs search and filtered project work to remain responsive and needs to return from item detail to the
same part of the result set.

### Workspace Owner

Needs cross-project discovery to remain useful as active and archived projects accumulate work, without
requiring teams to delete history.

### Individual Power User

Needs saved views, pinned shortcuts, copy links, browser back/forward navigation, and page controls to
compose predictably rather than restoring stale or contradictory state.

### Reference-App Developer

Needs a concrete example of bounded list reads, count metadata, deterministic SQL ordering, transient
URL state, page-scoped selection, and full-result export policy without premature generic abstraction.

## Product Principles

- **Bound the interactive read:** a work-list page should fetch only the rows it can present.
- **Keep result meaning separate from result position:** filters and sort define the set; page and page
  size define the current window.
- **The server owns paging truth:** counts, bounds, and selected rows come from the same validated query
  semantics as the data.
- **URLs describe the current screen:** page navigation should survive reload, copy, back, forward, and
  return from detail.
- **Saved views describe reusable intent:** a saved view should reopen at the beginning of its current
  result set, not a page number captured from older data.
- **Selection must be honest:** bulk controls should never imply that unloaded rows are selected.
- **Exports describe the filter, not the viewport:** a CSV should not unexpectedly contain only the
  visible page.
- **Mutable lists are not snapshots:** navigation reflects current authoritative data and may shift as
  work changes.
- **Do not truncate operational surfaces silently:** board and focused review contracts remain explicit
  until they receive their own scaling design.
- **Optimize evidence, not abstraction:** share low-level query logic where necessary, but wait for a
  second proven paged domain before extracting a universal pagination layer.

## Scope

### 1. Paged Work-List Contract

Introduce a paged response for the project and workspace work-list reads.

Requirements:

- Return the current page of work item DTOs plus:
  - normalized page number;
  - normalized page size;
  - exact total matching item count;
  - total page count;
  - previous-page availability;
  - next-page availability.
- Validate page and page-size input at the endpoint boundary.
- Support page sizes of 10, 25, 50, and 100 items.
- Use page 1 and 25 items as the default when values are absent.
- Reject malformed, fractional, negative, zero, or unsupported paging values with the established
  validation response.
- Treat an empty result as page 1 of 0 total pages while keeping navigation disabled.
- Normalize a stale page beyond the current last page to the last valid page when results remain.
- Keep project and workspace permission and archived-project filtering authoritative before count or
  row data is returned.
- Preserve the existing shallow project, member, label, milestone, cycle, hierarchy, and dependency
  context on each row.
- Do not permit an API caller to request an unbounded interactive page.

Acceptance criteria:

- A 63-item result with page size 25 returns 25, 25, and 13 items over three pages.
- Every page reports the same exact total while the underlying result set is unchanged.
- A broad workspace query no longer returns every matching row in one interactive response.
- A stale page URL recovers to a valid page instead of leaving a confusing empty screen.
- Unauthorized and cross-workspace rows do not contribute to totals.

### 2. Deterministic Sort And Count Semantics

Make every supported ordering safe for page windows.

Requirements:

- Preserve current sort meanings:
  - recently updated;
  - oldest updated;
  - highest priority;
  - lowest priority;
  - due date;
  - newest created;
  - board order where still used by the board contract.
- Add a unique deterministic final tie-breaker to every paged order.
- Keep project identity as an appropriate workspace tie-breaker where current behavior requires it.
- Apply the same filter conditions to item and count reads.
- Keep dependency, work-risk, hierarchy, label, cycle, milestone, assignee, reporter, project, archive,
  state, type, priority, due-date, and search filters composable.
- Do not count enrichment joins as duplicate work items.
- Define current-data semantics honestly: separate page requests do not represent an immutable snapshot.
- Add indexes only where they preserve behavior and materially support common filtered or searched page
  reads.

Acceptance criteria:

- Equal primary sort values do not cause nondeterministic ordering inside an unchanged result set.
- Count and row queries use one canonical condition builder rather than separately reimplemented rules.
- Labels, dependencies, and parent filters do not inflate totals.
- Existing query contract tests continue to prove filter composition.

### 3. Project Work Pagination Experience

Add compact paging controls to project Work without displacing the work itself.

Requirements:

- Show a result summary such as `26-50 of 63 work items` near the result list.
- Show previous and next controls, the current page, total pages, and a page-size selector.
- Permit direct page navigation without requiring repeated next clicks.
- Disable unavailable navigation controls without removing their stable layout space.
- Keep controls available below the result list and, where useful at large widths, near the result
  summary without duplicating confusing tab order.
- Changing page should load immediately and should not alter draft filter controls.
- Changing page size should return to page 1.
- Applying search, filters, sorting, a saved view, or an active-chip removal should return to page 1.
- Loading, empty, error, retry, and stale-page recovery states should retain clear context.
- Existing list row density, hierarchy context, dependency signals, and detail links must remain intact.
- The first-page empty state should continue to distinguish no work from no matching work.

Acceptance criteria:

- A user can move between pages without a full application reload.
- The URL, visible range, page indicator, and rendered rows agree after navigation.
- Applying a filter from page 3 lands on page 1 of the new result set.
- Removing a filter chip from a later page cannot leave the list on a now-invalid empty page.
- The controls remain usable at mobile and desktop widths.

### 4. Workspace Work Items Pagination Experience

Apply the same bounded interaction to cross-project discovery.

Requirements:

- Use the same page sizes, result summary language, navigation behavior, and error states as project
  Work.
- Preserve project identity on every workspace result row.
- Keep active versus archived project modes reflected in the total.
- Preserve project, hierarchy, dependency, saved-view, and search composition.
- Keep project-specific drill-down links and return URLs scoped to the current workspace page.
- Ensure page controls do not crowd the compact saved-view opener or filter toolbar.
- Avoid introducing page-local copies of canonical paging logic when a focused shared UI primitive is
  justified by both list surfaces.

Acceptance criteria:

- Workspace results remain responsive as test data grows beyond one page.
- Project and workspace pages use consistent paging language and behavior.
- Archived-only and include-archived totals match their visible result sets.
- Opening a work item and returning restores the same workspace page when still valid.

### 5. URL, Browser History, And Saved View Semantics

Extend the established query lifecycle without confusing durable and transient state.

Requirements:

- Represent non-default page and page size through validated URL query parameters.
- Omit default page and page size values from canonical URLs where practical.
- Keep paging out of active filter chips and filter-count summaries.
- Page navigation should create browser history entries suitable for Back and Forward.
- Automatic stale-page normalization should replace, not add, a history entry.
- Copy-link behavior should include the current non-default page window.
- Work-item return URLs should include current paging state.
- Saved personal and shared views should continue storing filter and sort intent only.
- Creating or updating a saved view must strip page and page-size state.
- Opening or pinning a saved view should start on page 1 with the default page size.
- Existing saved views and old URLs without paging parameters must continue to open normally.
- Project and workspace URL scopes must continue stripping unsupported query fields.

Acceptance criteria:

- Reloading a page-3 URL restores page 3 when it remains valid.
- Browser Back returns to the previous page window and visible rows.
- A copied list URL reproduces the current filters, sort, page, and page size.
- Saving a view while on page 4 does not make page 4 part of the saved definition.
- Active chips continue to represent applied filters only.

### 6. Page-Scoped Batch Triage

Keep project bulk editing explicit and safe under pagination.

Requirements:

- Rename or clarify selection language as `Select visible work` where needed.
- Select-all behavior must select only eligible rows loaded on the current page.
- Show the number of selected visible rows without implying a query-wide selection.
- Clear selection when page, page size, applied filters, sort, saved view, actor, or project changes.
- Do not retain hidden selections from prior pages.
- Preserve current permission, archived-project, terminal-state, and transition eligibility behavior.
- After a successful or partial bulk mutation, reload count and current rows.
- If mutation makes the current page invalid, recover to the last valid page.
- Keep bulk request payloads explicit work item ID lists.
- Do not add `Select all N matching items` or server-side durable selection sets.

Acceptance criteria:

- Selecting all on page 2 never sends IDs from page 1 or page 3.
- Moving to another page clears the previous selection before actions can run.
- A bulk status or field change updates totals and page bounds correctly.
- Contributors and archived projects retain their current restricted behavior.

### 7. Full-Result CSV Export With A Safety Boundary

Keep exports useful while making synchronous resource use explicit.

Requirements:

- Export all rows matching the applied filters and sort, not only the visible page.
- Exclude page and page-size parameters from export meaning.
- Keep project and workspace CSV columns, including cycle and parent context, unchanged unless metadata
  is required for correctness.
- Add a documented maximum of 10,000 matching rows for one synchronous export.
- Count matches before constructing a file when necessary to enforce the limit without partial output.
- Return a controlled `EXPORT_LIMIT_EXCEEDED` problem when the result is too large.
- Tell the user to narrow the applied filters before retrying.
- Do not silently truncate a file.
- Keep permissions and archived-project filters identical to interactive reads.
- Do not add export jobs, notifications, storage, or history in this release.

Acceptance criteria:

- Exporting from page 2 includes matching rows from every page.
- Changing page size does not change CSV contents.
- A result above the synchronous limit produces no partial download and explains the remedy.
- A filtered result below the limit preserves current deterministic order and columns.

### 8. Board And Bounded Surface Isolation

Prevent list pagination from changing unrelated operational behavior.

Requirements:

- The project board must continue receiving every work item required for its six status columns and
  board-order mutation rules.
- The board must not request page size 100 as a disguised unbounded contract.
- Keep board drag/drop, status menus, counts, empty columns, and hierarchy context unchanged.
- Keep My Work, Planning, Cycle Review, Milestone Review, Portfolio, project overview, status reports,
  parent candidate search, parent child-work reads, and notifications on their existing bounded or
  purpose-specific contracts.
- Separate paged list reads from complete board reads clearly at the service or endpoint boundary.
- Document the board's remaining large-project scalability risk honestly.

Acceptance criteria:

- No board card disappears because it falls outside a list page.
- Board moves retain complete neighbor validation and persisted ordering.
- Focused review totals and report snapshots do not change because list pagination was introduced.
- A future board scalability design can replace its complete read without undoing the list contract.

### 9. API, Contracts, Persistence, And Documentation Surface

Make pagination explicit and production-shaped.

Requirements:

- Add shared paging request and response types without making a universal framework from one domain.
- Keep the durable `WorkItemQuery` contract separate from page-window input where that improves saved
  view and export correctness.
- Update project and workspace list endpoint contracts and OpenAPI examples.
- Preserve endpoint handlers as transport-neutral functions.
- Keep authorization in services and query construction in repositories.
- Use bounded SQL `limit` and `offset` behavior for interactive page reads.
- Use exact count queries built from the same canonical filter conditions.
- Ensure all sort modes end with a unique deterministic key.
- Consider PostgreSQL trigram indexes for current case-insensitive substring search if query plans show
  a material benefit without changing search semantics.
- Avoid enriching rows that are not part of the requested page.
- Preserve set-based enrichment for rows that are returned.
- Add contract, validation, repository, service, endpoint, Angular, and browser tests proportional to
  the shared read-contract change.
- Keep reset, migrate, seed, and existing snapshot compatibility deterministic.

Acceptance criteria:

- API consumers receive typed page metadata and cannot request unbounded interactive lists.
- Only returned page rows are passed through list enrichment.
- Count and item results honor identical authorization and filters.
- Existing saved-view JSON remains valid without migration.
- OpenAPI matches runtime paging, validation, normalization, and export-limit behavior.

### 10. Seed Data, Verification, And Release Communication

Make the workflow demonstrable and protect established capability.

Requirements:

- Ensure deterministic seed data can demonstrate multiple pages using the 10-item page size without
  flooding the default product experience with synthetic filler.
- Add a focused browser walkthrough covering:
  - project paging;
  - workspace paging;
  - page-size change;
  - filter reset to page 1;
  - copy/reload/return URL behavior;
  - saved-view first-page behavior;
  - page-scoped bulk selection;
  - all-matching CSV export.
- Add repository/service fixtures large enough to verify final partial pages, exact counts, supported
  sort modes, stale-page recovery, and export limits.
- Verify desktop, narrow desktop, mobile, keyboard, long-title, loading, empty, and error states.
- Update README capabilities, limitations, walkthrough, OpenAPI, package metadata, release notes,
  public site copy, and destination-neutral pattern notes during finalization.
- Record the remaining board, synchronous export, count-query, and offset-pagination limits honestly.

Acceptance criteria:

- A reviewer can exercise pagination from a fresh seed without manually creating dozens of items.
- Existing work breakdown, cycle, report, dependency, saved-view, and board browser workflows remain
  green.
- Public documentation claims bounded work lists without claiming infinite-scale search or board
  rendering.
- Lint, typecheck, API tests, web tests, contract tests, E2E tests, production build, migration/seed,
  and production dependency audit pass.

## User Stories

### Maintainer Works Through A Large Backlog

1. A maintainer opens project Work with more than 25 matching items.
2. The list shows the first 25 items and the exact total.
3. They move to page 2 and the URL records that position.
4. They open one item, make a change, and return to the same result page when it remains valid.
5. The list reloads current data rather than restoring a stale client-side copy.

### Owner Searches Across Projects

1. An owner opens workspace Work Items and applies a search with active-project filtering.
2. Worktrail returns the first bounded page and the exact number of matches.
3. The owner changes the page size to 50 and returns to page 1.
4. They copy the link and another permitted actor sees the same current window over that actor's
   authorized result set.

### Power User Opens A Saved View

1. A user navigates to page 3 of a broad query.
2. They open a pinned `My open bugs` saved view.
3. Worktrail applies the saved filters and sort at page 1 rather than carrying page 3 into unrelated
   results.
4. The saved-view query remains free of transient paging fields.

### Maintainer Batch-Triages Visible Work

1. A maintainer enters batch mode on page 2.
2. They choose `Select visible work` and select eight eligible rows.
3. Worktrail sends exactly those eight immutable IDs.
4. After the mutation, selection clears and the page count and rows refresh.
5. If the result now has fewer pages, Worktrail returns them to the last valid page.

### User Exports A Filtered Result

1. A user applies filters that match 137 work items and navigates to page 4.
2. They export CSV.
3. The file contains all 137 filtered rows in the applied sort order, not just page 4.
4. A result above 10,000 rows instead shows a controlled prompt to narrow filters.

## UX Requirements

- Keep the result list as the dominant surface; paging controls should be compact and work-focused.
- Use familiar previous/next icons with descriptive accessible names where icon controls are used.
- Show current range and total in plain language.
- Use a native or established select control for page size.
- Do not use infinite scroll; users need stable position, browser history, and a reachable page footer.
- Keep page navigation visually separate from search and filter editing.
- Do not represent page or page size as active filter pills.
- Keep control dimensions stable as page counts grow from one to multiple digits.
- Disable unavailable controls without layout shift.
- Preserve scroll position deliberately: page changes should move focus and viewport to the result
  heading or first result, not leave the user below an empty previous page.
- Do not announce every row after navigation; use one concise loading/result status.
- Explain page-scoped selection near select-all behavior, not only after the user acts.
- Keep export-limit errors actionable and avoid presenting a failed partial file.
- On narrow screens, allow range and controls to wrap in a predictable order without overlapping row
  actions or saved-view controls.

## Accessibility Requirements

- Paging controls must be keyboard reachable in logical order.
- Icon-only previous and next buttons must have descriptive accessible names and tooltips where useful.
- The current page must be exposed programmatically, not by color alone.
- Disabled navigation state must be conveyed semantically.
- Page-size controls require visible labels.
- Loading and completed navigation should produce a restrained live-region update with the new range
  and total.
- Focus should move predictably after direct page navigation and stale-page normalization.
- Browser Back and Forward should not strand focus in removed row content.
- Page numbers and result counts must remain readable at 200 percent zoom.
- Mobile controls must meet target-size expectations without forcing horizontal page scrolling.
- Empty and export-limit states must remain understandable to screen-reader users.

## Permissions And Lifecycle Rules

- Pagination does not change who can read a project or work item.
- Workspace totals include only rows readable through the current actor's workspace context.
- Existing owner, maintainer, contributor, inactive-member, and archived-project rules remain
  authoritative.
- Page-scoped batch triage remains limited to actors and projects already allowed to use bulk actions.
- Export remains available only where the existing list/export capability permits it.
- Archived-project modes affect both total count and items consistently.
- Actor changes reload page 1 because the authorized result set may differ.
- Crafted page values cannot bypass project, workspace, or archive scope.
- Board isolation cannot expose rows that the corresponding project read would forbid.

## Data Integrity And Consistency Expectations

- Pagination introduces no authoritative persisted page state.
- Saved-view records remain durable filter and sort definitions only.
- Item and count queries use identical filter semantics.
- Every paged sort has a unique deterministic final tie-breaker.
- Page reads reflect current committed data; they do not promise a multi-request historical snapshot.
- A work item updated between page requests may move according to the active sort, and documentation
  should not imply otherwise.
- Mutation responses must not rely on the client retaining old page totals.
- Stale high page numbers normalize without inventing rows or silently changing filters.
- Empty results have a stable page representation and no negative or contradictory ranges.
- Export either returns the complete filtered file under the limit or returns a controlled error; it
  never silently truncates.
- Existing work item, hierarchy, dependency, cycle, milestone, report, and closeout data remains
  unchanged by the paging release.

## Technical Expectations

- Keep endpoint handlers adapter-neutral and domain authorization in services.
- Introduce focused page types that can be reused by project and workspace work lists, but do not
  generalize them across unrelated domains without evidence.
- Keep durable `WorkItemQuery` normalization separate from transient page-window normalization.
- Prefer readable one-based page URLs for this release.
- Use offset pagination with a strict maximum page size and deterministic order.
- Use one canonical condition builder for count and row queries.
- Clamp stale pages only after an authorized count establishes the valid range.
- Enrich labels, members, milestones, cycles, hierarchy, and dependencies only for returned IDs.
- Keep CSV export on a dedicated all-matching path with preflight limit enforcement.
- Keep complete board reads explicit and unavailable to arbitrary public page-size input.
- Measure representative PostgreSQL query plans before adding indexes, especially for substring search,
  archived-project workspace reads, and common sort/filter combinations.
- If `pg_trgm` is adopted, commit extension and index setup through normal migrations and verify local
  PostgreSQL and expected managed PostgreSQL compatibility.
- Preserve OpenAPI error and response examples, local reset/seed behavior, and production build budgets.

## Success Criteria

The release is successful when:

- project Work and workspace Work Items fetch at most the validated requested page size;
- users can see exact totals and navigate large results predictably;
- filters, sort, URL reload, copy links, browser history, and return URLs preserve correct page behavior;
- saved views reopen on page 1 and never persist stale page positions;
- page or page-size changes never alter unapplied draft filters;
- bulk selection and mutations operate only on explicitly visible IDs;
- CSV export includes all matching rows under the documented limit regardless of current page;
- every sort is deterministic and count semantics match item semantics;
- board and focused operating surfaces retain their current complete or bounded behavior;
- existing saved views and URLs remain compatible;
- seeded and generated test data demonstrate first, middle, final, empty, and stale pages;
- desktop and mobile browser checks pass without overlap, clipping, or inaccessible controls;
- lint, typecheck, API tests, web tests, contract tests, E2E tests, production build, fresh database setup,
  and production dependency audit pass.

## Risks And Mitigations

### Offset Pagination Shifts Under Active Mutation

Risk: an item can move between pages when its sort field changes, causing a user to see a duplicate or
skip an item across separate requests.

Mitigation: use deterministic tie-breakers, reload authoritative current data after mutations, state
current-data semantics clearly, and defer cursors or snapshot tokens until measured usage requires
them.

### Count Queries Become Expensive

Risk: exact totals repeat complex label, dependency, hierarchy, risk, and search predicates.

Mitigation: share canonical predicates, avoid duplicate-producing joins, inspect query plans, add
targeted indexes with evidence, and keep page size bounded. Defer approximate counts until real scale
shows exact totals are too expensive.

### Saved View And Page State Become Entangled

Risk: page fields leak into saved queries, chips, export requests, or view update comparisons.

Mitigation: model durable result definition and transient navigation separately, strip paging at the
saved-view boundary, and add serialization tests for every lifecycle transition.

### Bulk Selection Misleads Users

Risk: users interpret select-all as selecting every filtered row across pages.

Mitigation: use explicit visible-page language, clear selection on all navigation and query changes,
and continue sending only concrete IDs.

### Board Cards Are Accidentally Truncated

Risk: changing a shared list endpoint to a page envelope silently limits board columns or breaks rank
neighbor calculations.

Mitigation: isolate complete board reads explicitly, retain board regression coverage, and reject a
client-controlled unbounded page escape hatch.

### Export Reintroduces Unbounded Work

Risk: interactive paging is bounded but CSV export still exhausts memory or request duration.

Mitigation: preflight exact count, cap synchronous exports at 10,000 rows, fail without partial output,
and defer larger exports to a future background-job design.

### Pagination Controls Overwhelm Small Results

Risk: controls consume space when all work fits on one page.

Mitigation: keep the exact result summary, hide or disable unnecessary navigation predictably, and use
a compact control group rather than another management panel.

### Search Still Requires Broad Database Work

Risk: bounding response rows does not make `%term%` matching cheap on large tables.

Mitigation: inspect PostgreSQL plans and add trigram indexes if justified while preserving current
case-insensitive substring semantics. Defer search ranking and language-aware full-text behavior.

## Deferred Opportunities

- Cursor or keyset pagination for very deep and highly mutable result sets.
- Snapshot-consistent multi-page browsing.
- Approximate or asynchronously cached result counts.
- Infinite scroll and virtualized list rendering.
- Query-wide durable selection and `Select all matching` bulk commands.
- Background bulk jobs and progress reporting.
- Board filtering, virtualization, pagination, or status-column windowing.
- Background CSV export, export history, scheduled exports, and object-storage delivery.
- User-specific default page-size preferences.
- Custom table columns, density, and column ordering.
- Full-text ranking, fuzzy search, autocomplete, and global quick find.
- Search analytics and relevance tuning.
- Generic pagination abstractions across all product domains.
- Production authentication, hosted infrastructure, observability, and AWS deployment assets.

## Open Questions

1. Should interactive pagination use page/offset semantics or cursor tokens?
2. Should the API replace current array responses or add focused paged list endpoints while preserving
   the complete board read?
3. Should default page and page-size values be omitted from canonical URLs?
4. Should page size be stored in saved views, retained as a browser preference, or remain transient?
5. Should copy links include current page state while saved views exclude it?
6. Should a stale high page normalize to the final page or return an empty page with recovery metadata?
7. Should exact counts and page rows execute in one transaction or use a single SQL statement?
8. Which current sort orders need an added UUID tie-breaker?
9. Do existing PostgreSQL query plans justify `pg_trgm` indexes in this release?
10. Should the synchronous CSV export limit be fixed at 10,000 or configurable with a documented
    deployment default?

## Proposed Defaults For Technical Design

- Use one-based page/offset pagination. It fits human-readable URL state, direct navigation, exact page
  counts, and the current finite sort set. Defer cursor pagination until measured deep-page behavior
  justifies its added contract complexity.
- Use page sizes 10, 25, 50, and 100, with 25 as the default and 100 as the hard interactive maximum.
- Add focused paged response contracts for project and workspace lists. Keep board data on an explicit
  complete project-board read rather than allowing an arbitrary unbounded page size.
- Omit page 1 and page size 25 from canonical URLs. Include non-default values in copy links, browser
  history, and detail return URLs.
- Keep page and page size outside `WorkItemQuery` if that cleanly protects saved views and exports.
  Introduce a focused page-window contract at endpoint and UI state boundaries.
- Store neither page nor page size in saved views. Opening any saved or pinned view starts at page 1
  with the default page size.
- Reset to page 1 whenever applied filters or sort change. Page navigation leaves draft controls
  untouched.
- Normalize stale high pages to the final valid page and replace the URL. Represent an empty set as
  page 1 with zero total pages.
- Use exact counts. Execute count and rows through one service operation with canonical conditions;
  technical design should choose a transaction or single-statement strategy based on simplicity and
  consistency evidence.
- Add a final ascending work item UUID tie-breaker after existing sort keys.
- Keep selection page-scoped, clear it on every page/query boundary, and continue sending explicit IDs.
- Export all matching rows independent of paging, with a fixed 10,000-row synchronous limit and a
  controlled `EXPORT_LIMIT_EXCEEDED` response. Defer configurability until deployment needs differ.
- Inspect `EXPLAIN` plans with representative data. Add `pg_trgm` and targeted GIN indexes for title,
  description, and display-key substring search only if the evidence supports the migration.
- Do not alter existing search semantics, board behavior, focused review DTOs, or immutable snapshot
  versions.
