# Worktrail v0.2.8 PRD

## Status

Draft

## Summary

Worktrail v0.2.8 should add **Quick Find: Global Search and Navigation**.

Worktrail now has a substantial operating surface. A user can move between My Work, Inbox, workspace
Work Items, Projects, Portfolio, project work lists, boards, planning, cycles, milestones, reports, and
work-item detail. That breadth is useful, but it also raises the cost of reaching a known destination.
Today, finding `WT-83`, a milestone mentioned in a meeting, a published report, or the work item that
owns a named attachment requires knowing which page to visit first and then using that page's local
controls.

The product theme is **Quick Find**. v0.2.8 should provide one globally available, keyboard-friendly
surface for navigating Worktrail and finding readable records in the active workspace. It should
search projects, work items, milestones, cycles, published reports, and attachment filenames; present
small, clearly grouped result sets; and take the user directly to the selected destination. When no
query is present, the same surface should provide high-value global and current-project navigation
actions.

This release should improve access to the capabilities Worktrail already has rather than add another
planning model. It should establish credible bounded multi-entity search behavior without becoming a
general query language, command automation system, enterprise search platform, or content-indexing
pipeline.

## Release Thesis

Worktrail should reduce the distance between remembering a piece of project context and opening it.

The release succeeds when a user can:

1. open Quick Find from anywhere in the authenticated application;
2. type a known key, title, name, or attachment filename;
3. understand which kind of record each result represents and where it belongs;
4. use pointer or keyboard interaction to open the intended destination;
5. recover cleanly from no results, delayed results, authorization changes, or stale records.

Quick Find should feel like part of the application shell, not a separate search application.

## Context

The current product already provides several forms of scoped discovery:

- project and workspace work lists with URL-backed filters, saved views, sorting, and pagination;
- exact-key, title, and description substring search for work items;
- project navigation and project-specific operating tabs;
- portfolio review for active-project attention;
- milestone and cycle review pages;
- immutable published status report history;
- work-item relationships, parent/child links, report links, and planning links;
- work-item attachments with durable metadata and exact authorized downloads.

These paths work once the user is in the right context. They do not answer the shell-level question,
"I know roughly what I want; how do I get there now?"

v0.2.6 supplied bounded work-list search and PostgreSQL trigram support. v0.2.7 added attachment
metadata behind a focused storage boundary. v0.2.8 can build on that evidence without generalizing all
existing list queries or indexing attachment contents.

## Problem Statement

### Navigation depends on prior location knowledge

Users must understand Worktrail's information architecture before they can reach many records. A
milestone is reached through a project, a report through a project's Reports tab, and an attachment
through its owning work item. That is reasonable for browsing but inefficient for known-item lookup.

### Search is fragmented by surface

Work-item search is available only after entering a project Work page or workspace Work Items page.
Projects, milestones, cycles, reports, and attachment filenames do not share a discovery entry point.

### Keys and names are often learned outside the application

Project keys, work-item display keys, milestone names, cycle names, report titles, and filenames appear
in meetings, messages, exported documents, and status discussions. Users need to turn those references
into a destination without retracing the source's hierarchy manually.

### Product breadth is beginning to work against usability

Adding more top-level navigation items or permanent search panels would consume shell space and make
common workflows noisier. Worktrail needs compact access that scales with capability without placing
every destination on screen at once.

### Unbounded global search would create a new scaling problem

Combining every matching row and its enrichment into one response would undermine the bounded-read
discipline established in v0.2.6. A useful global search must be explicit about result limits,
additional matches, ranking, and supported fields.

## Why This Sprint

Quick Find has higher near-term product leverage than deepening one specialized feature because it:

- makes most existing capabilities easier to reach;
- improves first-time orientation and expert repeat usage at the same time;
- provides a natural destination for known work-item keys and external references;
- makes attachment metadata more useful without introducing file-content processing;
- exercises bounded heterogeneous search and authorization patterns that future features may reuse;
- leaves roadmap forecasting, workflow customization, hosted infrastructure, and advanced document
  processing available for dedicated releases with clearer evidence.

## Goals

### Product Goals

- Make Quick Find available from every authenticated application route.
- Support fast global and current-project navigation without a query.
- Search the active workspace across directly navigable project-management records.
- Make exact project and work-item key lookup especially fast and predictable.
- Allow users to find a work item's context by an attachment's display filename.
- Preserve clear project and record-type context in every result.
- Keep the interaction compact, responsive, accessible, and keyboard operable.
- Keep search bounded and honest when more matches exist.
- Preserve current scoped work-list search, filters, saved views, and URLs.

### Architecture And Reference Goals

- Establish one explicit, versioned multi-entity search contract.
- Keep search authorization and tenant scope server-owned.
- Keep each result group bounded independently and the complete response bounded globally.
- Use deterministic ranking and tie-breakers.
- Avoid exposing database search syntax, storage metadata, or pre-rendered HTML.
- Keep the shell feature lazy enough that it does not materially regress initial load.
- Preserve endpoint-handler separation from the Express adapter.
- Record evidence before extracting a general search or command-palette framework.

## Non-Goals

v0.2.8 will not add:

- attachment-content search, OCR, extracted text, previews, or malware scanning;
- full comment, activity, notification, closeout snapshot, or report-body search;
- fuzzy natural-language answers, semantic/vector search, or AI-assisted retrieval;
- a general query language or advanced search expression parser;
- a dedicated global search-results page;
- unbounded result retrieval or global CSV export;
- saved global searches, search history, analytics, or personalized ranking;
- mutation commands such as changing status, assignment, dates, or project state from Quick Find;
- a generic extensible command framework or third-party command registration;
- recent-item persistence across browsers or users;
- recursive hierarchy presentation inside search results;
- production authentication, hosted deployment, S3, or observability infrastructure;
- changes to work-list pagination, board completeness, or saved-view contracts;
- new roadmap, calendar, forecasting, capacity, or workflow-customization features.

## Primary Users And Jobs

### Individual Contributor

- Open a work item from a key copied from a message.
- Find the item containing a named requirements or evidence file.
- Jump to My Work, Inbox, or workspace Work Items without traversing the shell.
- Open a current cycle or milestone mentioned during planning.

### Maintainer

- Move quickly between project planning, work, reports, and settings.
- Find similarly named work in the correct project.
- Locate historical reports or archived project records during review.
- Reach a project from its key or name while triaging across the workspace.

### Owner

- Find records across the active workspace without changing project context first.
- Navigate from portfolio-level review to a specific project artifact.
- Verify that inactive members cannot use global search to infer workspace data.
- Evaluate a bounded search pattern suitable for a future hosted deployment.

## Product Principles

### One Lightweight Entry Point

Quick Find should be reachable from the application shell and should not permanently consume a large
vertical region. Opening it should preserve the page beneath it and closing it should return focus to
the trigger or prior working control.

### Navigation First

The feature exists to open known or likely destinations. It should not reproduce full list pages,
filters, batch actions, editors, or record-management controls.

### Exact Identity Beats Broad Relevance

An exact project key or work-item display key should outrank every broad text match. Prefix and
primary-name matches should outrank description matches. Ranking should be understandable and stable.

### Grouped Results Preserve Meaning

A work item, project, cycle, report, and attachment are not interchangeable rows. Results should be
grouped by kind and include enough context to distinguish similarly named records.

### Bounded And Honest

Every group should have a small hard limit. When more records match, the response and UI should say so
without implying that the visible set is complete.

### The Server Owns Scope And Visibility

The browser may guide interaction, but the API must apply active-workspace scope, membership state,
record visibility, archived semantics, and result limits independently.

### Search Text Is Untrusted Input

Queries and result strings must be treated as data. The UI should never render server-supplied HTML,
and operational logging should not need raw user-entered search text.

### Learn Before Generalizing

Implement one focused Worktrail Quick Find flow. Do not build a universal search framework until more
domains demonstrate the same ranking, grouping, authorization, navigation, and overflow needs.

## Scope

### 1. Global Quick Find Trigger

The authenticated application shell should expose a compact Quick Find action.

Requirements:

- The action is available on every authenticated route at desktop and mobile widths.
- Activating it opens a modal or dialog-like overlay without navigating away from the current page.
- Focus moves directly to the query input.
- `Command/Ctrl+K` opens Quick Find when the browser and current control allow it.
- `/` may open Quick Find when focus is not inside an editable control and browser testing shows no
  conflict with existing interactions.
- Repeating the open shortcut while Quick Find is open must not duplicate the overlay.
- Escape closes the overlay unless another nested dismissible interaction owns Escape.
- Closing restores focus predictably.
- Actor changes, workspace changes, or logout-equivalent state changes close and clear Quick Find.

The trigger should use the application's established icon system and tooltip pattern. It should not
require permanent explanatory copy or a marketing-style shell treatment.

### 2. Empty-Query Navigation

Opening Quick Find with no query should provide a compact set of navigation destinations rather than a
blank dialog.

Global destinations:

- My Work;
- Inbox;
- Work Items;
- Projects;
- Portfolio;
- Create work item.

When the current route is inside a project, add a clearly separated current-project group:

- Project overview;
- Work;
- Board;
- Planning;
- Reports;
- Project settings when the current actor may access it under existing rules.

Requirements:

- Navigation entries are fixed product actions, not server search results.
- The current route may be indicated but remains selectable.
- Project actions use the current project identity already held by the shell or route context.
- Quick Find does not persist or infer recent destinations in this release.
- Mutation actions other than opening the existing create-work-item route are out of scope.

### 3. Query Input And Request Lifecycle

Requirements:

- Trim leading and trailing whitespace before search.
- Treat repeated internal whitespace consistently while preserving the user's visible input.
- Match case-insensitively.
- Do not issue a search request for fewer than two Unicode code points after normalization.
- Limit normalized queries to 120 Unicode code points.
- Debounce ordinary typing enough to avoid a request per keystroke while preserving responsive lookup.
- Exact-looking project/work-item keys may use a shorter debounce than broad text if the technical
  design can keep behavior deterministic.
- Cancel an obsolete request where supported and always ignore stale responses.
- Do not flash results from an older query after the input changes.
- Clearing the query immediately restores navigation mode.
- Reopening Quick Find starts with an empty query in this release.

### 4. Searchable Record Types

Quick Find should search only records with a useful direct destination.

#### Projects

Search fields:

- project key;
- project name;
- project description.

Result context:

- project key and name;
- active or archived state;
- a concise description excerpt only when it helps explain a non-name match.

Destination: project overview.

#### Work Items

Search fields:

- display key;
- title;
- description, preserving the established substring semantics.

Result context:

- display key and title;
- project key/name;
- status, type, and archived context where relevant;
- one short plain-text excerpt only when the match is from description.

Destination: work-item detail.

#### Milestones

Search fields:

- milestone name;
- milestone description.

Result context:

- name;
- project identity;
- status and target date.

Destination: milestone review.

#### Cycles

Search fields:

- cycle name.

Result context:

- name;
- project identity;
- status and date range.

Destination: cycle review.

#### Published Status Reports

Search fields:

- report title;
- concise published summary text if bounded query evidence supports it.

Result context:

- title;
- project identity;
- status date, health, and publication date.

Destination: published report detail.

Draft report form state is not persisted and is not searchable.

#### Attachments

Search fields:

- attachment display filename only.

Result context:

- filename;
- owning work-item key and title;
- project identity;
- size and upload date;
- archived context where relevant.

Destination: owning work-item detail with the Files section targeted after it loads.

Attachment bytes, extracted content, checksums, storage keys, local paths, and media inspection are not
searchable or returned.

### 5. Result Grouping And Limits

Requirements:

- Results are grouped under stable user-facing record-type headings.
- Empty groups are omitted.
- Each group returns at most five visible results.
- The complete response returns at most 30 results.
- Each group reports whether additional matches exist.
- The UI communicates additional matches without displaying a misleading exact total.
- Work-item overflow provides an action to open workspace Work Items with the current text applied to
  the existing canonical work-item search query.
- Other groups may state that more matches exist without adding a new full-results page.
- The API enforces limits even if the client sends altered values.
- Group order is stable: work items, projects, milestones, cycles, reports, attachments unless browser
  evidence demonstrates that exact identity matches need a compact cross-group treatment.

The technical design may return all groups in one response or use a coordinated endpoint contract, but
the user should experience one coherent search operation.

### 6. Deterministic Relevance

Within a group, results should rank by an explicit tier before deterministic tie-breakers.

Default relevance tiers:

1. exact case-insensitive key match;
2. key prefix match;
3. exact primary name/title/filename match;
4. primary name/title/filename prefix match;
5. primary name/title/filename substring match;
6. supported description or summary substring match.

Additional rules:

- Active records rank ahead of archived records within the same relevance tier.
- Existing work-item key and text semantics remain compatible.
- Ties use stable user-meaningful fields followed by a unique ID.
- The server returns plain strings and match reason/field metadata, not highlighted HTML.
- Client highlighting, if included, must escape text and remain a visual enhancement only.
- Ranking is deterministic for identical data and query input.
- No personalized or behavioral ranking is introduced.

### 7. Archived And Historical Records

Quick Find is a read/navigation surface, so historical records remain useful.

Requirements:

- Include readable archived projects and records owned by them.
- Mark archived context clearly in results.
- Rank active records ahead of archived records only within the same relevance tier; an exact archived
  key should still outrank an unrelated active substring match.
- Opening an archived result preserves the destination's existing read-only behavior.
- Removed attachments and deleted comments are not searchable.
- Completed/canceled milestones and completed cycles remain searchable and visibly labeled.
- Published reports remain searchable according to their immutable record state.

### 8. Selection And Navigation

Requirements:

- Pointer selection opens the result.
- Arrow keys move through all visible selectable rows in rendered order.
- Enter opens the active row.
- Tab order remains valid and does not trap users in noninteractive labels.
- The active result remains visible as keyboard selection moves through a scrollable result region.
- Opening a destination closes Quick Find before route navigation completes.
- Browser Back returns to the prior route under normal Angular navigation behavior; Quick Find itself
  does not add a history entry.
- Selecting a result for the current route still closes the overlay and refreshes route parameters or
  targeted section behavior correctly.
- Attachment navigation waits for the independently loaded Files section before scrolling/focusing its
  heading; failure to load Files must leave primary work-item detail usable with a section-level retry.
- A record removed between search and selection should produce the destination's normal not-found or
  empty-state behavior rather than a broken overlay.

### 9. Loading, Empty, And Error States

Requirements:

- Navigation mode appears immediately when Quick Find opens.
- A quiet searching state appears only after a request is actually pending.
- Existing results may remain visible during a refresh if clearly marked as updating and never
  selectable under the wrong query.
- A no-results state identifies the current query and offers a clear route back to navigation mode.
- A server error keeps the query intact and provides a retry action.
- Authorization/inactive-member failures use existing safe session or access messaging.
- One failed search request must not damage the current route.
- No state should expose raw SQL, internal repository names, paths, object keys, checksums, stack traces,
  or credentials.

### 10. Responsive And Visual Behavior

Requirements:

- The overlay is compact on desktop and uses the available mobile viewport without content overlap.
- It must not place cards inside cards or reproduce full page sections inside the dialog.
- Result rows use stable dimensions and may grow vertically for long names without shifting controls
  incoherently.
- Record kind, primary identity, project context, and state remain scannable at common laptop widths,
  narrow mobile widths, and 200 percent zoom.
- Long keys, titles, project names, report titles, and filenames wrap or truncate with the full value
  available accessibly.
- Search results do not rely on color alone for record kind or archived state.
- Loading indicators must not resize the query control or move the result region unexpectedly.
- Empty and error states remain concise so the user can return to typing immediately.

### 11. Accessibility

Requirements:

- Use an appropriate accessible dialog and combobox/listbox or dialog-with-list interaction model.
- The control has a stable accessible name.
- Focus is contained while the modal is open and restored when it closes.
- Keyboard navigation behavior is deterministic and tested.
- The active option is conveyed programmatically.
- Result group headings and result kinds are available to assistive technology.
- Loading, result availability, no-results, and errors use restrained live-region announcements.
- Visible focus indicators meet the existing application standard.
- Highlighting is not required to understand why a result matched.
- The surface remains usable at 200 percent browser zoom and with reduced motion.

## Search Contract Requirements

The API contract should represent one normalized query and concrete bounded result groups.

The response must provide enough information for the client to render and navigate without follow-up
enrichment per row:

- normalized query;
- grouped result items;
- stable record IDs and identities;
- display context appropriate to each record type;
- match field/reason suitable for plain-text presentation;
- archived or lifecycle state;
- per-group `hasMore` state;
- no internal storage, search-rank, or authorization implementation fields.

Contract rules:

- Query validation is strict and returns the common structured error shape.
- Unsupported fields, caller-provided scope IDs, sort expressions, or arbitrary limits are rejected or
  ignored by an explicitly documented contract.
- The current actor and active workspace are derived through existing trusted request context.
- Result group limits are server constants in this release.
- Response ordering is part of the documented product contract.
- Plain-text excerpts have a server-enforced maximum length.
- The endpoint remains adaptable to a Lambda/API Gateway transport even though Express is the current
  runtime adapter.

## Authorization And Tenant Isolation

Requirements:

- Quick Find requires an active workspace member under existing local actor semantics.
- Every query is constrained to the actor's active workspace before text matching or ranking.
- An inactive member receives the same safe denial behavior as other protected workspace reads.
- Results never reveal cross-workspace keys, names, counts, existence, snippets, filenames, or IDs.
- Archived records follow existing read permissions.
- Search grants no mutation capability and does not weaken destination authorization.
- Attachment results inherit work-item/project readability and never bypass the attachment list or
  download authorization path.
- Project settings navigation is shown only under its existing access rules.
- Direct destination requests remain authoritative even after an authorized search result was returned.

Production authentication remains out of scope, but the feature must not add a shortcut around current
authorization policy.

## Performance And Scale Requirements

Search should remain bounded from database predicate through rendered rows.

Requirements:

- No search group reads more than its visible limit plus one overflow-probe row.
- Do not load complete work-item, project, milestone, cycle, report, or attachment collections into
  application memory before limiting.
- Avoid per-result repository enrichment queries.
- Existing work-item trigram indexes and predicates should be reused where semantics agree.
- New indexes must be justified by representative query-plan evidence, not added speculatively.
- Exact key lookup should use indexed identity fields.
- Every group ends with a deterministic unique tie-breaker.
- A representative seeded/local request should target a sub-300 ms server response after warm-up;
  exact-key lookup should generally be faster.
- The complete JSON response should remain comfortably below 64 KiB for maximum bounded results.
- Client debounce and stale-response handling should keep rapid typing from producing visual churn.
- Failure of one database query must fail the coherent response safely; partial group success is not
  required in this release.

The technical design should evaluate whether group queries run sequentially, concurrently through a
bounded pool strategy, or as combined SQL. It must prioritize predictable database pressure and clear
failure behavior over synthetic local latency.

## Data And Migration Requirements

The release may require indexes but should avoid new durable search records unless evidence demands
them.

Requirements:

- Existing projects, work items, milestones, cycles, reports, attachments, activity, and snapshots
  remain valid.
- No backfill of derived search documents is planned.
- Search should read authoritative domain tables and current lifecycle state.
- Any new index migration is forward-only, deterministic, and safe on current local seed data.
- Attachment filename search uses public display filename metadata, never object keys or filesystem
  paths.
- Removed attachment metadata remains absent and therefore unsearchable.
- Existing `pg_trgm` extension installation remains the baseline for substring index options.
- Seed data should exercise exact keys, prefix collisions, similar names across projects, archived
  records, completed planning records, published reports, and attachment filenames.

## Observability And Privacy Requirements

Worktrail does not yet have production telemetry, but Quick Find should preserve an observable and
privacy-conscious boundary.

Requirements:

- Request logs may include route, status, duration, and a generated request identifier under existing
  behavior.
- Raw query text should not be added to ordinary application logs.
- Logs must not include result titles, descriptions, filenames, report summaries, storage metadata, or
  response bodies.
- Safe error logs may identify the failed search operation and result group without including user
  content.
- No search analytics, query history, popularity score, or click tracking is persisted in this release.
- API errors remain typed and safe for the client.

## Compatibility Requirements

- Existing project and workspace work-list search behavior remains unchanged.
- Existing `search` query parameters, canonical URLs, saved views, pagination, and exports remain valid.
- Opening work-item overflow from Quick Find uses the existing canonical workspace Work Items search
  state rather than inventing a second query format.
- Existing route URLs remain valid.
- Quick Find query state is ephemeral and does not alter the current page URL.
- Existing project-shell and actor-selector behavior remains intact.
- Existing work-item, milestone, cycle, report, and attachment destination permissions remain
  authoritative.
- No immutable report or cycle-closeout snapshot version changes are required.

## Documentation Requirements

Update:

- README capability summary and Quick Find behavior;
- current limitations, including bounded groups and unsupported content sources;
- OpenAPI route, query validation, group schemas, examples, and error responses;
- public site capability copy without claiming semantic or file-content search;
- release notes with searchable fields, ranking, limits, shortcuts, and deferred scope;
- destination-neutral pattern notes for bounded heterogeneous search, deterministic relevance,
  server-owned navigation capabilities, stale-response handling, and shell-level overlays;
- implementation evidence and query-plan notes where indexes are introduced.

## Testing Requirements

### Contract Tests

- Concrete result unions/groups compile and preserve required context.
- Group limits and overflow flags are represented.
- No internal attachment or database search metadata enters public DTOs.
- Match-field values are finite and exhaustive.

### Service And Repository Tests

- Active-workspace isolation for every group.
- Inactive-member denial.
- Exact key, key prefix, exact name/title, prefix, substring, and description tiers.
- Active/archived ordering within relevance tiers.
- Stable tie-breakers for identical names and dates.
- Group limit plus one and correct `hasMore` behavior.
- Removed attachments excluded and duplicate filenames represented independently.
- Attachment results carry only safe parent/work-item context.
- Completed/canceled planning records and archived project records remain discoverable.
- Cross-workspace fixtures never affect results or overflow flags.
- Query normalization and length validation.
- Representative query plans and bounded reads.

### Endpoint Tests

- Missing actor, inactive actor, malformed query, short query, long query, no results, and success.
- Response ordering and schema.
- Safe error shape.
- Raw query text absent from added logs.
- No arbitrary caller-controlled workspace, limit, rank, or sort escape hatch.

### Angular Tests

- Shell trigger availability and lazy loading.
- Shortcut handling outside editable controls and suppression inside them.
- Open, focus, close, and focus restoration.
- Empty-query global/current-project navigation.
- Debounce, cancellation or stale-response rejection, and clear behavior.
- Group rendering, omitted empty groups, overflow messaging, and work-item overflow link.
- Pointer and keyboard selection.
- Actor/project route changes clear stale state.
- Safe plain-text rendering and accessible labels.
- Attachment result navigation targets Files after independent section loading.
- Loading, no-results, retry, denied, and stale-destination behavior.

### Browser Tests

- Open Quick Find from My Work and a project route.
- Navigate entirely by keyboard to a fixed destination.
- Find and open an exact work-item key.
- Distinguish similarly named results across projects.
- Find an attachment filename and arrive at the owning work item's Files section.
- Open an archived or completed historical result.
- Use work-item overflow to reach canonical workspace search.
- Change actor and prove prior results do not remain visible.
- Verify mobile viewport, common laptop viewport, 200 percent zoom, and no overlap.
- Verify browser Back returns to the prior route after opening a result.

### Regression Tests

- Existing work-list search, filters, saved views, pagination, and export.
- Project shell and top-level navigation.
- Work-item detail route reuse.
- Attachment list/download/removal.
- Milestone/cycle review and cycle closeout.
- Published report navigation.
- Initial bundle and component style budgets.

## Acceptance Criteria

v0.2.8 is complete when:

- Quick Find is available from every authenticated route and works at desktop/mobile widths;
- fixed global navigation appears before a query and current-project navigation appears in project
  context;
- active members can search readable projects, work items, milestones, cycles, reports, and attachment
  filenames in the active workspace;
- exact project/work-item keys and primary names rank predictably above broad matches;
- results are grouped, bounded to five per group and 30 total, and expose honest overflow state;
- work-item overflow opens the existing canonical workspace search;
- attachments navigate to their owning work item's Files section without exposing internal storage
  fields;
- archived and completed records remain discoverable with clear state labels;
- keyboard, focus, screen-reader, zoom, loading, no-results, and retry behavior pass;
- stale responses and actor/context changes cannot display data under the wrong query or identity;
- repository reads are bounded and avoid N+1 enrichment;
- tenant isolation and inactive-member denial pass for every group;
- current scoped search, saved views, pagination, exports, boards, planning, reports, and attachments
  remain correct;
- OpenAPI, README, release docs, public site, and metadata are accurate;
- lint, typecheck, tests, build, browser coverage, dependency audit, and diff hygiene pass;
- no unresolved decision or failed required check remains.

## Success Signals

This local reference release does not add product analytics. Success will be evaluated through
behavioral evidence:

- known-key lookup needs one shell action and one selection;
- a user can reach primary product destinations without traversing intermediate pages;
- similarly named records remain distinguishable from result context;
- attachment filename lookup reaches the correct work item;
- all result sets remain bounded as representative data grows;
- keyboard-only and mobile use remain first-class;
- existing page-specific search remains stable.

## Risks And Mitigations

### Cross-entity scope could become a slow fan-out

Mitigation: use a small supported type set, limit-plus-one reads, bounded projection fields, query-plan
evidence, and no per-result enrichment.

### Broad substring matches could feel noisy

Mitigation: prioritize exact keys and primary fields, separate record types, provide project context,
and defer fuzzy or semantic behavior until relevance evidence exists.

### A command-palette appearance could imply unsupported commands

Mitigation: describe the feature as Quick Find, keep empty-mode actions navigational, and exclude
arbitrary mutations or command registration.

### Archived results could crowd active work

Mitigation: rank lifecycle state only within relevance tiers, mark archived context clearly, and retain
strict per-group limits.

### Search snippets could expose or render unsafe content

Mitigation: authorize before projection, return bounded plain text, escape client rendering, and never
return HTML or file contents.

### Keyboard shortcuts could conflict with form editing or browser behavior

Mitigation: suppress shortcuts in editable controls, keep a visible shell trigger, and validate across
supported browsers.

### Attachment targeting could race the lazy Files section

Mitigation: make section targeting explicit, wait for section load before focus/scroll, and preserve
primary detail plus retry on failure.

### Exact counts would add avoidable cost

Mitigation: return only `hasMore` from a limit-plus-one probe; do not calculate total matches.

## Deferred Opportunities

- Dedicated global results with paging and per-type filters.
- Search history, recent records, favorites, and personalized ranking.
- Saved global searches and shareable global-search URLs.
- Fuzzy matching, typo tolerance, token ranking, synonyms, and relevance analytics.
- Full-text ranking and language-aware stemming.
- Semantic/vector search and natural-language answers.
- Comment, activity, notification, closeout snapshot, and full report-body search.
- Attachment-content indexing, OCR, previews, and extracted-text search.
- Member, label, watcher, and activity-actor search when they have useful destinations.
- Search result actions and mutation commands.
- Extensible command registration or third-party integrations.
- Query analytics, click analytics, administrative search diagnostics, and relevance tuning.
- Cross-workspace search after real multi-workspace switching exists.
- Hosted search infrastructure or external search engines.
- Production authentication, managed deployment, metrics, tracing, and alerting.

## Open Questions

1. Should the surface be presented as a modal command-palette pattern or as an expanded shell search
   region?
2. Should both `Command/Ctrl+K` and `/` open it, or should v0.2.8 use only the cross-platform command
   shortcut plus the visible trigger?
3. Should Quick Find include archived records by default or require an explicit archived toggle?
4. Should report matching include bounded summary text or title only?
5. Should all result groups execute for every query, or can exact key syntax skip groups that cannot
   match keys?
6. Should results use one aggregate endpoint or separate group endpoints coordinated by the client?
7. Should attachment selection target the Files heading through a URL fragment or transient navigation
   state?
8. Should a work-item result matching only an attachment filename appear in Work Items, Attachments,
   or both?
9. Should exact matches receive a small cross-group top result before normal group order?
10. Should the existing project list gain local search as part of global overflow handling, or remain
    outside this release?

## Proposed Defaults For Technical Design

- Use a lazy-loaded modal dialog opened from a visible shell action and `Command/Ctrl+K`.
- Add `/` only if it is conflict-free outside editable controls and does not complicate accessibility.
- Keep empty mode navigational and mutation-free except for routing to the existing create form.
- Use one aggregate API endpoint with concrete bounded groups and one coherent failure response.
- Normalize to 2-120 Unicode code points and debounce broad requests around 180-250 ms.
- Return at most five records per group with a limit-plus-one `hasMore` probe and at most 30 results
  overall.
- Include archived records by default, label them, and rank active records first only within the same
  relevance tier.
- Search report title and bounded summary text if query plans remain straightforward; do not search all
  narrative report sections.
- Keep attachment matches in a dedicated Attachments group and do not duplicate them as work-item
  results unless the work item itself matches.
- Use a `files` URL fragment for attachment destinations if Angular route reuse and lazy-section tests
  prove it stable; otherwise use a narrowly scoped navigation-state service with no persistence.
- Keep normal group order rather than introducing a special top-hit area in the first release.
- Reuse the existing workspace Work Items page for work-item overflow; do not add project or other
  entity overflow pages in v0.2.8.
- Use server-returned match-field metadata and client-side escaped emphasis only if visual testing shows
  it improves scanning.
- Keep query text out of added logs and do not persist search or click history.
- Add PostgreSQL indexes only where representative `EXPLAIN` evidence shows they support the bounded
  predicates.
- Do not introduce a generic search provider registry, command bus, or reusable modal framework solely
  for this feature.
