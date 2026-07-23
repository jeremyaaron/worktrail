# Worktrail v0.2.8 Technical Design

## Status

Draft

## Summary

v0.2.8 adds Quick Find through a bounded workspace search endpoint and a lazy shell-level Angular
dialog.

The implementation will:

- expose a visible Quick Find trigger from the root application shell;
- open the surface with `Command/Ctrl+K` without introducing a global `/` shortcut;
- use Angular CDK Dialog for overlay, focus, dismissal, and scroll-blocking behavior;
- dynamically import the launcher and dialog so the substantial search UI remains outside the initial
  application chunk;
- show fixed global and current-project navigation before the user enters a query;
- send one normalized query to `POST /api/quick-find` after a bounded debounce;
- search work items, projects, milestones, cycles, published reports, and attachment filenames;
- return six concrete result groups with at most five items each and a per-group `hasMore` flag;
- rank exact keys, key prefixes, exact primary fields, primary prefixes, primary substrings, and
  narrative substrings deterministically;
- include readable archived and completed records while labeling their lifecycle context;
- direct attachment results to the owning work item's `#files` section;
- reuse the canonical workspace Work Items query for work-item overflow;
- keep search text out of request URLs and ordinary request logs;
- add targeted PostgreSQL trigram indexes and focused performance evidence;
- avoid exact counts, unbounded reads, per-row enrichment, persisted search state, and a generic command
  or search-provider framework.

The design deliberately does not add a dedicated global results page, fuzzy/semantic search, content
indexing, search analytics, recent-item persistence, result mutations, or hosted search infrastructure.

## Resolved Decisions

### Use A Modal Quick Find Surface

Quick Find will use a modal dialog rather than an expanded header region or dedicated route.

Rationale:

- it preserves the current page and working context beneath the search;
- it avoids adding another persistent full-width shell control to an already dense top bar;
- it supports a focused keyboard flow without changing browser history;
- fixed navigation and search results can share one compact surface;
- the dialog can close before routing and restore focus to the shell trigger.

The dialog is an application tool, not a marketing card. It uses one flat result surface with group
headings and rows. It does not contain nested cards or reproduce full list-page controls.

### Use Angular CDK Dialog, Not Material Components

Use `Dialog` from `@angular/cdk/dialog`. The CDK dependency already exists for board drag/drop, and the
dialog primitive provides:

- overlay/top-layer composition;
- focus trapping and restoration;
- Escape and backdrop dismissal;
- body scroll blocking;
- accessible dialog labeling;
- a typed close result and `closeOnNavigation` behavior.

No Angular Material package, theme, component, or visual language is introduced. Worktrail owns the
dialog markup and styling.

The root component will dynamically import a small `open-quick-find-dialog.ts` launcher. That lazy
module imports both CDK Dialog and `QuickFindDialogComponent`, keeping dialog/search implementation out
of the initial chunk until first use.

### Use A Visible Trigger And Command/Ctrl+K

The shell exposes a compact icon button labeled `Quick find`. Install the tree-shakable Angular Lucide
package and use its Search icon rather than a custom SVG. Use the same package for any X icon required
inside the dialog.

`Command+K` on macOS and `Ctrl+K` elsewhere open Quick Find. The root listener prevents the browser
default only for that exact modified key combination. It ignores repeated keydown events while the
dialog is opening or open.

Do not add `/` in v0.2.8. Slash has a higher collision risk with editable controls, browser quick-find
expectations, and future rich-text inputs. The visible trigger keeps the feature discoverable without
requiring shortcut copy in the UI.

### Use One Aggregate POST Endpoint

Use:

```text
POST /api/quick-find
Content-Type: application/json

{ "query": "attachment requirements" }
```

Although Quick Find is read-only, POST is intentional:

- the current request logger records `originalUrl`, so GET would place user-entered text in ordinary
  logs;
- query text should not enter browser history, intermediary URL logs, or copied links;
- the operation is ephemeral and explicitly not cacheable;
- one JSON request maps cleanly to the transport-neutral endpoint input.

The endpoint remains idempotent and has no mutation side effects. It returns
`Cache-Control: private, no-store`.

Also change ordinary request logging from `request.originalUrl` to `request.path`. This protects query
text on existing GET search/filter routes and keeps logs focused on method, route path, status, and
duration. No request or response body is logged.

### Search All Six Groups For Every Valid Query

Every normalized query executes the same six bounded group reads. Do not special-case exact-looking
keys by skipping other groups.

Rationale:

- project keys and work-item keys can coexist with matching names or filenames;
- stable response semantics are easier to test and explain;
- syntax heuristics would become an undocumented search language;
- each group is already bounded to six database rows including overflow evidence.

Exact-key predicates still rank first and should use existing indexed identity fields.

### Use One Coherent Failure Response

The six group reads execute sequentially in one repository operation. If any group fails, the endpoint
returns one safe `503 QUICK_FIND_UNAVAILABLE` response. It does not return partial groups.

Sequential reads are chosen over `Promise.all` because one keystroke should not consume six pool
connections. Search does not promise a repeatable-read snapshot across groups; records may change
between statements. That is acceptable for ephemeral navigation, and a destination request always
re-authorizes current state.

### Include Archived Records By Default

Quick Find includes readable archived projects and records owned by them. Milestones and cycles with
their own archived state are also included.

Ranking rules:

- relevance tier is primary;
- active lifecycle ranks ahead of archived lifecycle only inside the same relevance tier;
- stable display fields and UUID provide final tie-breakers.

An exact archived `WT-3`-style identity therefore outranks an unrelated active description match.

### Search Report Title And Summary

Published report search includes title and the bounded `summary` narrative. It does not inspect
highlights, risks, next steps, JSON snapshots, or rendered Markdown.

Rationale:

- title plus summary covers the report's primary identity and concise purpose;
- broad report-body search would enlarge indexes and blur the boundary with content search;
- report rows are immutable, making title/summary indexes operationally simple.

### Keep Attachment Results Separate

Attachment filename matches appear only in the Attachments group. They do not cause the owning work
item to appear in Work Items unless the work item itself matches.

This avoids duplicate-looking rows and keeps match meaning explicit. Attachment results return safe
filename, size, creation time, project context, and owning work-item context. They never return media
bytes, checksum, storage key, local path, or uploader details.

### Use The Files Fragment

Attachment destinations use:

```text
/work-items/:workItemId#files
```

The attachment section gains `id="files"` and a programmatically focusable heading/container. Work-item
detail observes the route fragment and coordinates focus/scroll after the independently requested
attachment state settles. A load failure still targets the Files section and leaves its retry action
available.

If the selected attachment belongs to the already-open work item and the URL already contains
`#files`, the client performs the same focus/scroll action directly after closing the dialog rather
than relying on a same-URL navigation event.

### Reuse Workspace Work Items For Overflow

Work-item overflow navigates to:

```text
/work-items?search=<normalized query>&archivedProjects=include
```

Default page and page-size fields remain omitted. Including archived projects aligns the full list with
Quick Find's default lifecycle scope. The existing workspace query serializer is authoritative; Quick
Find does not concatenate query strings manually.

No project, milestone, cycle, report, or attachment overflow page is added. Those groups display a
concise `More matches exist` message.

### Keep Normal Group Order

Render non-empty groups in this fixed order:

1. Work items;
2. Projects;
3. Milestones;
4. Cycles;
5. Reports;
6. Attachments.

Do not add a cross-group top-hit area. Ranking across unlike entity types would require a product-level
weighting model that current evidence does not support.

## Current Implementation Context

### Root Shell

`App` owns the brand, primary navigation, actor selector, and top-level router outlet. It currently has
no overlay or shell-level feature launcher. Its initial dependencies are intentionally small.

The top bar uses a three-column desktop grid and responsive wrapping at tablet/mobile widths. Quick
Find should enter a compact tools region adjacent to the actor selector without increasing the primary
navigation's horizontal pressure.

### Angular Routing

All route components are lazy. Project routes inherit `projectId` through Angular router configuration.
The root can derive current-project context by walking the active route snapshot after `NavigationEnd`;
no new persistent project-context service is required.

### API Client

`ApiClient` owns the base URL and current actor headers. Domain-specific clients wrap it, while
`WorktrailApiService` retains compatibility aggregation for established call sites.

Quick Find should use a focused `QuickFindApi` directly from its feature component. Do not add six
domain calls to `WorktrailApiService`.

### Endpoint And Adapter Boundary

Express routes adapt transport-neutral `EndpointHandler` functions into `AppRequest` and
`AppResponse`. Local actor resolution verifies that the selected member exists in the stated workspace
and is active before the endpoint runs.

The new route uses the ordinary JSON parser and endpoint adapter. No Express request type enters the
service or repository.

### Search And Persistence

Workspace/project work-item lists already use case-insensitive key/title/description substring search.
Migration `0016_scalable_search.sql` installed `pg_trgm` and added GIN trigram indexes for work-item
display key, title, and description.

The other Quick Find tables have workspace/project ownership indexes but do not consistently have
trigram indexes for their searched display fields. Attachment metadata already has a direct workspace
index and a bounded filename.

### Request Logging

`requestLogger` currently records `request.originalUrl`, including query parameters. Quick Find's POST
body avoids adding its query to the URL, and the logger change to `request.path` closes the same privacy
gap for existing GET filters.

## Shared Contract Design

Add `packages/contracts/src/quick-find.ts` and export it from `index.ts`.

### Request

```ts
export interface QuickFindRequest {
  query: string;
}
```

The server returns the normalized query so the client can associate the response with the exact
request generation and build canonical overflow navigation.

### Match Vocabulary

```ts
export type QuickFindMatchMode = "exact" | "prefix" | "substring";

export type QuickFindMatchField =
  | "project_key"
  | "project_name"
  | "project_description"
  | "work_item_key"
  | "work_item_title"
  | "work_item_description"
  | "milestone_name"
  | "milestone_description"
  | "cycle_name"
  | "report_title"
  | "report_summary"
  | "attachment_file_name";

export interface QuickFindMatchDto {
  field: QuickFindMatchField;
  mode: QuickFindMatchMode;
  excerpt: string | null;
}
```

`excerpt` is non-null only for project/work-item/milestone descriptions and report summary matches. It
is plain text with a maximum of 180 Unicode code points including any ellipsis markers. The server does
not return rank numbers, SQL scores, or highlighted HTML.

### Shared Context

```ts
export interface QuickFindProjectContextDto {
  id: string;
  key: string;
  name: string;
  status: ProjectStatus;
}

export interface QuickFindWorkItemContextDto {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  type: WorkItemType;
}
```

These are search projections, not aliases for full `ProjectDto` or `WorkItemDetailDto`. They expose only
navigation and disambiguation context.

### Concrete Results

```ts
export interface QuickFindProjectResultDto {
  kind: "project";
  project: QuickFindProjectContextDto;
  match: QuickFindMatchDto;
}

export interface QuickFindWorkItemResultDto {
  kind: "work_item";
  project: QuickFindProjectContextDto;
  workItem: QuickFindWorkItemContextDto;
  match: QuickFindMatchDto;
}

export interface QuickFindMilestoneResultDto {
  kind: "milestone";
  project: QuickFindProjectContextDto;
  milestone: {
    id: string;
    name: string;
    status: MilestoneStatus;
    targetDate: string | null;
    isArchived: boolean;
  };
  match: QuickFindMatchDto;
}

export interface QuickFindCycleResultDto {
  kind: "cycle";
  project: QuickFindProjectContextDto;
  cycle: {
    id: string;
    name: string;
    status: ProjectCycleStatus;
    startDate: string;
    endDate: string;
    isArchived: boolean;
  };
  match: QuickFindMatchDto;
}

export interface QuickFindReportResultDto {
  kind: "report";
  project: QuickFindProjectContextDto;
  report: {
    id: string;
    title: string;
    statusDate: string;
    health: DeliveryHealthState;
    publishedAt: string;
  };
  match: QuickFindMatchDto;
}

export interface QuickFindAttachmentResultDto {
  kind: "attachment";
  project: QuickFindProjectContextDto;
  workItem: QuickFindWorkItemContextDto;
  attachment: {
    id: string;
    fileName: string;
    byteSize: number;
    createdAt: string;
  };
  match: QuickFindMatchDto;
}
```

Report health is read from the immutable snapshot's `health.health` value. The repository validates the
finite value while mapping; malformed historical snapshot data fails safely rather than emitting an
unknown contract value.

### Groups And Response

```ts
export interface QuickFindGroupDto<TItem> {
  items: TItem[];
  hasMore: boolean;
}

export interface QuickFindResponseDto {
  query: string;
  groups: {
    workItems: QuickFindGroupDto<QuickFindWorkItemResultDto>;
    projects: QuickFindGroupDto<QuickFindProjectResultDto>;
    milestones: QuickFindGroupDto<QuickFindMilestoneResultDto>;
    cycles: QuickFindGroupDto<QuickFindCycleResultDto>;
    reports: QuickFindGroupDto<QuickFindReportResultDto>;
    attachments: QuickFindGroupDto<QuickFindAttachmentResultDto>;
  };
}
```

All six groups are present even when empty. This keeps client state concrete and avoids an optional-key
matrix. OpenAPI defines concrete schemas for each group rather than relying on an unconstrained generic.

## Query Normalization And Validation

Add `apps/api/src/validation/quick-find-query.ts`.

Normalization:

1. require a JSON object with only `query`;
2. normalize Unicode to NFC;
3. trim leading/trailing whitespace;
4. collapse internal Unicode whitespace runs to one ASCII space;
5. count Unicode code points with `Array.from(value).length`;
6. require 2-120 code points;
7. preserve normalized casing in the response and lowercase only internal comparison terms.

Zod's ordinary string length counts UTF-16 code units, so the code-point check must be an explicit
refinement after normalization.

Client normalization is only a request-suppression convenience. Server normalization is authoritative.

### Literal Substring Semantics

Quick Find treats `%`, `_`, and `\` as literal characters, not caller-controlled SQL wildcard syntax.

Create a repository helper that escapes LIKE metacharacters and binds all values as parameters:

```ts
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
```

Predicates use `ILIKE ... ESCAPE '\'`. Never interpolate query text with `sql.raw`.

This is intentionally stricter than the current broad work-list implementation. The existing list
search contract is not changed in this release.

## Ranking Design

Each group creates one SQL `CASE` expression for relevance and another finite expression for match
field/mode.

Conceptual tiers:

| Rank | Match                                   |
| ---: | --------------------------------------- |
|    0 | Exact key                               |
|    1 | Key prefix                              |
|    2 | Exact primary name/title/filename       |
|    3 | Primary prefix                          |
|    4 | Primary substring                       |
|    5 | Supported description/summary substring |

Entities without keys begin at the relevant primary-field tier. Rank values remain repository-internal.

Order for each group:

1. relevance rank ascending;
2. active lifecycle before archived lifecycle;
3. case-insensitive primary display field ascending;
4. project key where the result belongs to a project;
5. entity UUID ascending.

For work items, `itemNumber` may precede UUID after project key because display-key ordering is already
meaningful. Every group still ends with UUID.

The selected match field is the first matching predicate in tier order. A work item whose key and title
both match reports the key match.

### Excerpt Projection

Descriptions and report summaries may be much larger than a search result. Do not select complete
narrative fields into Node solely to create snippets.

The SQL projection should:

- find the case-insensitive match position;
- return a window around that position;
- cap the final plain-text excerpt at 180 code points;
- collapse line breaks/whitespace for one compact row;
- add leading/trailing ellipses only when content was omitted.

Primary title/name/filename matches have `excerpt: null` because the full primary field is already
rendered.

## Repository Design

Add `apps/api/src/repositories/quick-find-repository.ts` and register it as `repositories.quickFind`.

Quick Find is a cross-domain read model, so one focused repository is preferable to adding ranking and
snippet methods to six write-oriented domain repositories.

```ts
export interface QuickFindRepositoryInput {
  workspaceId: string;
  query: string;
  groupLimit: number;
}

export function createQuickFindRepository(db: WorktrailDb) {
  return {
    searchWorkspace(input: QuickFindRepositoryInput): Promise<QuickFindRepositoryResult>;
  };
}
```

`searchWorkspace` executes group methods sequentially in stable order. Each method selects at most
`groupLimit + 1` rows. The repository never accepts a caller-provided workspace from HTTP input; the
service supplies `actor.workspaceId`.

### Project Query

Source: `projects`.

Workspace predicate:

```text
projects.workspace_id = actor.workspaceId
```

Search: key, name, description. Projection: id, key, name, status, match metadata, bounded excerpt.

### Work Item Query

Source: `work_items` joined to `projects` by project id.

Workspace predicates apply to both work item and project ownership. Search: display key, title,
description. Projection includes work-item identity/status/type and project identity/status in one
statement. It does not call existing list enrichment because labels, assignee, hierarchy, dependencies,
and planning data are not needed for Quick Find.

### Milestone Query

Source: `milestones` joined to `projects`.

Search: milestone name and description. Lifecycle is archived when either `milestones.archived_at` is
non-null or the project is archived. Projection includes status and target date.

### Cycle Query

Source: `project_cycles` joined to `projects`.

Search: cycle name only. Lifecycle is archived when either cycle archival or project archival applies.
Projection includes status and date range.

### Report Query

Source: `project_status_reports` joined to `projects`.

Search: title and summary. Projection extracts
`snapshot -> 'health' ->> 'health'` as a finite health value without selecting the full JSON snapshot.
Projection includes status date and publication time.

### Attachment Query

Source: `work_item_attachments` joined to `work_items` and `projects`.

Workspace predicates apply to all three tables. Search: display filename only. Projection includes safe
attachment metadata, owning work-item identity/status/type, and project identity/status.

Do not join uploader/member data and do not select checksum or storage key, even into internal row
objects for this query.

### Overflow Mapping

After each query:

```ts
const hasMore = rows.length > groupLimit;
const items = rows.slice(0, groupLimit);
```

No `count(*)` query is issued.

## PostgreSQL And Migration Design

Update Drizzle schema and generate the next migration as `0018_*`.

The migration keeps the existing `pg_trgm` extension and adds:

```text
projects_name_trgm_idx
projects_description_trgm_idx
milestones_workspace_id_idx
milestones_name_trgm_idx
milestones_description_trgm_idx
project_cycles_name_trgm_idx
project_status_reports_title_trgm_idx
project_status_reports_summary_trgm_idx
work_item_attachments_file_name_trgm_idx
```

All text indexes use GIN with `gin_trgm_ops`. The milestone workspace B-tree index supports tenant
restriction and two-character broad queries where trigrams cannot help. Other searched tables already
have direct workspace indexes or workspace-leading indexes.

Do not add indexes for:

- cycle goal;
- report highlights, risks, next steps, or JSON snapshot;
- attachment media type, checksum, or storage key;
- comments, activity, or notifications.

### Two-Character Queries

Trigram indexes generally provide limited help for two-character broad substrings. The API still accepts
two code points because project keys and concise record names are valid product inputs.

Mitigations:

- exact/prefix key predicates remain indexed where possible;
- every query has a six-row limit;
- workspace ownership predicates use existing B-tree indexes;
- performance evidence records broad two-character behavior explicitly;
- a future release may raise broad-text minimum length independently from exact-key lookup if measured
  hosted workloads justify it.

### Performance Evidence

Add `apps/api/src/db/quick-find-performance-evidence.ts` and a root/workspace script.

The tool should:

- require deterministic seed state;
- begin a transaction;
- insert representative temporary projects, milestones, cycles, reports, attachments, and work items;
- include unique exact, prefix, primary substring, and narrative substring needles;
- run `ANALYZE` on affected tables;
- capture `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for each group;
- assert a finite `Limit` node;
- demonstrate trigram index support for selective substring paths;
- report actual planning/execution time and indexes;
- roll back all fixtures;
- restore table statistics after rollback.

As in existing v0.2.6 evidence, temporarily disabling sequential/plain index scans is acceptable only
for a second proof query that demonstrates index eligibility. Normal planner choices and timings must
also be recorded honestly.

The aggregate API target is under 300 ms after warm-up on the representative local fixture. This is an
evidence target, not a public latency SLA.

## Service Design

Add `apps/api/src/services/quick-find-service.ts`.

```ts
export interface QuickFindServiceContext {
  actor: ActorContext;
  repositories: Pick<Repositories, "quickFind">;
}

export class QuickFindService {
  search(input: QuickFindRequest): Promise<QuickFindResponseDto>;
}
```

Algorithm:

1. Receive already parsed/normalized input from the endpoint.
2. Call `quickFind.searchWorkspace` with `actor.workspaceId`, normalized query, and fixed group limit 5.
3. Convert at most six rows per group into public DTOs.
4. Validate/report finite report health.
5. Calculate each group's `hasMore` and slice to five.
6. Return all six groups and the normalized query.

The service does not perform follow-up repository reads. The repository projection is sufficient.

### Failure Privacy

Add `QuickFindUnavailableError`:

```ts
{
  code: 'QUICK_FIND_UNAVAILABLE',
  status: 503,
  message: 'Quick Find is temporarily unavailable.'
}
```

Repository failures are wrapped without attaching the query or raw database error to the public error.
Safe operational logging may emit a constant operation label and error class name, but not SQL
parameters, query text, result strings, or response bodies.

## Endpoint And Express Design

Add `apps/api/src/endpoints/quick-find.ts`:

```ts
export function quickFindHandler(
  repositories: Repositories,
): EndpointHandler<QuickFindResponseDto>;
```

The handler:

1. parses the strict JSON body;
2. normalizes and validates the query;
3. constructs `QuickFindService` with resolved actor context;
4. returns status 200, the response DTO, and private/no-store caching;
5. maps validation through the existing common error shape.

Add `apps/api/src/adapters/express/routes/quick-find-routes.ts` and register it after workspace routes:

```text
POST /api/quick-find
```

Only repositories are required, so the route participates in existing repository-backed server tests
without needing attachment storage or a direct DB option.

### Error Responses

| Status | Code                     | Meaning                                           |
| -----: | ------------------------ | ------------------------------------------------- |
|    200 | n/a                      | Complete bounded grouped response                 |
|    400 | `VALIDATION_ERROR`       | Missing, malformed, short, or oversized query     |
|    403 | `FORBIDDEN`              | Local actor missing, cross-workspace, or inactive |
|    503 | `QUICK_FIND_UNAVAILABLE` | Search persistence failed safely                  |

No-results is a normal 200 response with six empty groups.

## OpenAPI Design

Document:

- `POST /api/quick-find`;
- strict JSON request with 2-120 code-point semantics;
- no-store response header;
- match mode and field enums;
- project/work-item context schemas;
- six concrete result schemas;
- six concrete group schemas with `maxItems: 5`;
- response example including exact work item, milestone, report, and attachment matches;
- `hasMore` semantics and absence of exact totals;
- 400, 403, and 503 responses;
- local actor headers inherited through existing security documentation;
- explicit statement that attachment contents/internal storage and cross-workspace records are never
  searched or returned.

The OpenAPI version remains at the current release baseline until finalization.

## Angular API Design

Add `apps/web/src/app/core/api/quick-find-api.ts`:

```ts
@Injectable({ providedIn: "root" })
export class QuickFindApi {
  private readonly api = inject(ApiClient);

  search(input: QuickFindRequest): Observable<QuickFindResponseDto> {
    return this.api.post<QuickFindResponseDto, QuickFindRequest>(
      "/quick-find",
      input,
    );
  }
}
```

Tests verify actor headers, POST body, and response typing. Do not add query parameters or cache state.

## Lazy Dialog Launcher

Add `apps/web/src/app/features/quick-find/open-quick-find-dialog.ts`.

The root `App` calls it through dynamic import:

```ts
const { openQuickFindDialog } = await import(
  "./features/quick-find/open-quick-find-dialog"
);

this.quickFindRef = openQuickFindDialog(this.injector, {
  currentProjectId: this.currentProjectId(),
});
```

The lazy launcher enters the root injection context, resolves CDK `Dialog`, dynamically imports the
standalone dialog component, and opens it with:

- `ariaLabel: 'Quick find'` or `ariaLabelledBy`;
- `closeOnNavigation: true`;
- `restoreFocus: true`;
- backdrop and Escape close enabled;
- a constrained panel class;
- current project id as immutable dialog data.

The root holds the dialog reference to prevent duplicate opens and to close before actor selection
changes. Loading failure resets the opening guard and leaves the shell usable.

## Root Shell Integration

Refactor the top bar's final column into a small `.topbar-tools` wrapper containing:

- the Quick Find icon button;
- the existing actor-selector section.

Desktop retains brand, primary navigation, and tools columns. Tablet/mobile media rules allow the tools
wrapper to wrap without overlaying navigation or expanding icon dimensions.

`App` derives `currentProjectId` by traversing `router.routerState.snapshot.root` after each
`NavigationEnd`. No project name fetch is needed; the empty-mode group is labeled `Current project` and
uses stable destination labels.

The global keyboard listener:

- accepts lowercased `k` with exactly meta or control modifier;
- rejects Alt-modified combinations;
- prevents default only when opening/raising Quick Find;
- ignores auto-repeat;
- does not register slash;
- removes itself with component destruction through Angular host binding/lifecycle.

## Quick Find Dialog Component

Add a standalone `QuickFindDialogComponent` with separate `.html` and `.scss` files so template, state,
and styling remain reviewable.

Dependencies:

- Reactive Forms;
- Router;
- CDK Dialog reference/data;
- QuickFindApi;
- shared loading/error display primitives where they fit compact dialog composition;
- Lucide Search/X icons;
- existing display/date/token formatting helpers where appropriate.

### State Model

```ts
type QuickFindMode = "navigation" | "search";

interface QuickFindState {
  query: string;
  normalizedQuery: string | null;
  response: QuickFindResponseDto | null;
  isLoading: boolean;
  error: string | null;
  activeOptionId: string | null;
}
```

Signals hold render state. One reactive-form control owns visible query input.

### Request Pipeline

Use `valueChanges` with:

1. visible value coercion to string;
2. client normalization for request suppression;
3. immediate navigation mode below two code points;
4. `debounceTime(220)`;
5. `distinctUntilChanged()` on normalized query;
6. `switchMap()` to cancel prior HTTP requests;
7. a request generation check before applying success or error;
8. `takeUntilDestroyed()`.

`switchMap` aborts obsolete `HttpClient` requests where supported. The generation check protects state
even if an adapter cannot cancel transport work.

On a new valid query:

- preserve prior response only while it belongs to the same normalized query;
- otherwise clear selectable results before showing loading;
- reset active option to the first result after success;
- keep query text on error for retry;
- clear all response/error state immediately when returning to navigation mode.

The initial actor member id is captured in dialog data or at construction. An Angular effect closes the
dialog if selected actor id changes unexpectedly outside the root selector method.

### Navigation Entries

Define typed client-only entries:

```ts
interface QuickFindNavigationEntry {
  id: string;
  label: string;
  detail?: string;
  commands: readonly unknown[];
  queryParams?: Record<string, string>;
}
```

Global entries follow PRD order. Current-project entries are added only when `currentProjectId` is
non-null. Settings remains visible because the existing project shell exposes that route to all active
members while enforcing mutation permissions inside the page.

No navigation entry is fetched, persisted, or ranked.

### Result View Model

Flatten concrete groups into a client-only sequence for keyboard movement while preserving grouped
rendering:

```ts
type QuickFindSelectableOption =
  | { type: "navigation"; entry: QuickFindNavigationEntry }
  | { type: "result"; result: QuickFindResultDto }
  | { type: "work_item_overflow"; query: string };
```

Stable DOM ids derive from kind plus entity id, never array index alone.

### Keyboard Model

Keep focus in the query input and use an ARIA active-descendant pattern:

- ArrowDown/ArrowUp move through flattened selectable rows with wrap disabled at boundaries;
- Enter opens the active option;
- Home/End move to first/last option only while the list is active;
- Escape remains owned by CDK Dialog;
- Tab follows normal dialog focus order for input, retry/clear, result actions where exposed, and close;
- pointer hover may update active option without stealing input focus;
- pointer click opens the selected option.

Use CDK `ActiveDescendantKeyManager` if its `Highlightable` contract keeps row components simple;
otherwise a small feature-local index manager is preferable to a generic keyboard framework. In either
case, the input's `aria-activedescendant`, listbox/group semantics, and visible active state must agree.

### Rendering

Navigation mode:

- query input;
- Global destinations group;
- optional Current project group.

Search mode:

- query input and clear icon;
- restrained loading status;
- non-empty groups in fixed order;
- plain-text primary identity;
- compact project/lifecycle metadata;
- description/summary excerpt only when returned;
- per-group overflow message;
- canonical work-item overflow option;
- no-results or error/retry state.

Use existing token/date display helpers where semantics match. Do not show raw enum values with
underscores.

No result row contains mutation actions, preview controls, download buttons, or nested menus.

### Safe Text Emphasis

Initial implementation should use typography and returned match reason without injecting markup. If
visual testing shows emphasis is needed, split strings into escaped Angular text bindings around the
literal query; never use `innerHTML` or server-provided markup.

## Destination Mapping

Keep one exhaustive client function:

| Result kind | Destination                                    |
| ----------- | ---------------------------------------------- |
| Project     | `/projects/:projectId`                         |
| Work item   | `/work-items/:workItemId`                      |
| Milestone   | `/projects/:projectId/milestones/:milestoneId` |
| Cycle       | `/projects/:projectId/cycles/:cycleId`         |
| Report      | `/projects/:projectId/status/:reportId`        |
| Attachment  | `/work-items/:workItemId#files`                |

Use a `never` exhaustiveness assertion so new result kinds cannot compile without navigation behavior.

The dialog closes before calling `Router.navigate`. CDK's `closeOnNavigation` remains a fallback, not the
primary sequencing mechanism.

## Files Fragment Integration

Update the attachment section:

- add stable `id="files"`;
- make the section heading or container focusable with `tabindex="-1"`;
- accept a `focusWhenSettled` input or expose a settled output;
- focus and `scrollIntoView({ block: 'start' })` after success or error settles;
- respect reduced motion by using no forced smooth scrolling;
- prevent repeated focus on ordinary attachment refreshes.

Work-item detail derives fragment state from `ActivatedRoute.fragment`, resets targeting when work item
id changes, and passes a one-shot target generation to the attachment component. This extends the
existing route-id reset behavior rather than adding another global navigation store.

## Accessibility Design

CDK Dialog supplies focus containment/restoration and modal semantics. The feature still owns correct
search/list behavior.

Requirements:

- dialog heading provides the accessible name;
- query input uses a real label, visually hidden if needed;
- input exposes expanded/list ownership and active descendant correctly;
- groups have programmatic labels;
- result kind and project context are included in accessible row names;
- active row has a visible focus/selection indicator not based on color alone;
- loading and result-count summaries use one polite live region;
- errors use the established alert behavior without announcing on every keystroke;
- no-results text includes the normalized query without duplicative live announcements;
- Escape closes, focus returns to the trigger, and browser Back works after navigation;
- 200 percent zoom and narrow mobile widths retain input, close action, rows, and overflow messages;
- reduced motion receives immediate scrolling/focus behavior.

Do not display shortcut instructions as persistent in-app feature copy. The visible trigger and tooltip
are sufficient discovery mechanisms.

## Responsive And Styling Design

Desktop dialog:

- width constrained around 680-760 px and no wider than the viewport minus stable gutters;
- maximum height based on viewport with one internal result scroller;
- stable query-row and icon-button dimensions;
- group separators, not nested cards;
- card radius no greater than the existing 8 px standard.

Mobile dialog:

- uses nearly the full viewport width and available height;
- preserves top/bottom safe spacing;
- keeps the query and close action visible while results scroll;
- lets long primary text wrap without pushing lifecycle metadata/actions offscreen.

Keep `quick-find-dialog.component.scss` below the 8 kB component-style warning threshold. Production
build must remain below the 550 kB initial warning threshold; most feature code should appear as a named
lazy chunk.

## Security And Privacy

- Actor identity remains derived from trusted local actor headers at the adapter.
- Repository predicates use `actor.workspaceId` on every base table and joined project/work-item table.
- Inactive/cross-workspace actors fail before the endpoint executes.
- Search results grant no mutation or download authority.
- Destination and attachment download endpoints re-authorize current state.
- SQL values are parameterized and LIKE metacharacters are escaped.
- The server returns plain strings, never result HTML.
- Query text is sent in a no-store POST body and omitted from ordinary request logging.
- Safe Quick Find failures omit query text and raw database details.
- Attachment query projection never selects object keys, checksums, paths, bytes, or uploader data.
- No query history, result history, click event, or analytics row is persisted.
- Response header prevents browser/intermediary caching under the current local deployment model.

Production authentication remains deferred. Quick Find must not be described as making the local actor
model safe for public internet deployment.

## Testing Strategy

### Contract Tests

Add `packages/contracts/src/quick-find.contract.test.ts` covering:

- all six result discriminants;
- project/work-item context requirements;
- finite match mode/field values;
- group item types and `hasMore`;
- attachment result exclusion of storage internals;
- exhaustive result union narrowing.

### Normalization Tests

Cover:

- leading/trailing and repeated Unicode whitespace;
- NFC normalization;
- 1, 2, 120, and 121 code points;
- surrogate-pair/emoji code-point behavior;
- literal `%`, `_`, and backslash handling;
- mixed case and exact keys;
- strict object shape.

### Repository Integration Tests

Use real PostgreSQL fixtures for:

- exact key and key prefix ranking;
- exact/prefix/substring primary fields;
- description and report-summary matches/excerpts;
- active-before-archived within one tier;
- exact archived identity ahead of broad active match;
- stable tie ordering;
- five visible plus one overflow row for every group;
- duplicate attachment filenames as independent rows;
- removed attachment absence;
- project/milestone/cycle archival combinations;
- completed/canceled milestone and cycle visibility;
- report health extraction;
- cross-workspace rows excluded from items and `hasMore`;
- result projections omitting sensitive attachment fields;
- no full narrative projection where excerpt is required.

### Service Tests

Mock only `quickFind.searchWorkspace` and verify:

- actor workspace, fixed limit 5, and normalized query forwarding;
- six concrete groups always returned;
- overflow slicing;
- date/health mapping;
- repository failure becomes safe `QUICK_FIND_UNAVAILABLE` without query details.

### Endpoint Tests

Cover:

- valid POST and no-store response;
- empty, missing, non-string, short, oversized, and extra-field input;
- no results as 200;
- inactive and cross-workspace actor denial;
- safe 503 response;
- route registration;
- request logger excludes query strings and never logs POST bodies.

### OpenAPI Tests

Extend the path/schema smoke test with Quick Find route, request, groups, result types, match fields,
limits, no-store response, and safe error code. Retain negative assertions for storage key and checksum.

### Angular API Tests

Verify `QuickFindApi` sends:

- POST `/api/quick-find`;
- exact JSON body;
- selected actor headers;
- no query parameter.

### Root Shell Tests

Cover:

- trigger renders with accessible name;
- dynamic launcher called once;
- Command/Ctrl+K handling and auto-repeat suppression;
- no slash interception;
- current project id derivation after navigation;
- actor selection closes active dialog before changing headers;
- lazy-launch failure recovers;
- existing nav/actor/inbox behavior remains green.

### Dialog Component Tests

Cover:

- global and current-project navigation mode;
- no current-project group outside project routes;
- debounce and no request below two code points;
- switch/cancel behavior and stale success/error rejection;
- six-group order and omitted empty groups;
- lifecycle context and excerpts;
- active descendant movement and Enter selection;
- pointer selection;
- clear, retry, no-results, and overflow behavior;
- canonical work-item overflow query with archived inclusion;
- every result destination;
- same-route attachment targeting;
- actor-change closure;
- safe text rendering without `innerHTML`.

### Work Item Detail Tests

Cover:

- `#files` on initial detail navigation;
- fragment targeting after route-id reuse;
- attachment success and error both settle focus target;
- same-item retargeting;
- ordinary detail navigation without fragment does not steal focus;
- attachment refresh does not repeatedly scroll.

### Browser Tests

Add one focused Quick Find browser specification:

- open from My Work with the trigger;
- open with Command/Ctrl+K;
- navigate to a fixed destination using only keyboard;
- exact `WT-3` lookup and work-item navigation;
- distinguish `Cloud Readiness` project and milestone groups;
- find `attachment-requirements.md` and arrive at focused Files section;
- open an archived project or completed planning record;
- prove work-item overflow opens canonical workspace search with archived inclusion;
- switch actor and prove old results close/disappear;
- verify browser Back returns to the prior route;
- capture desktop, mobile, and 200 percent zoom screenshots;
- check dialog/result geometry for overlap and horizontal overflow.

### Performance Tests

- run Quick Find performance evidence after fresh migrate/seed;
- verify every group has a Limit node;
- verify selective substring paths are supported by expected trigram indexes;
- record two-character broad behavior without forcing a misleading index plan;
- verify aggregate warm local target;
- verify response items never exceed 30 and excerpts never exceed 180 code points.

### Full Verification

Run:

- fresh database reset, migrate, and seed;
- repeated seed;
- Quick Find performance evidence;
- lint and typecheck for all workspaces;
- all API, Angular, and contract tests;
- production build and budget checks;
- Playwright regression suite;
- dependency audit;
- OpenAPI and diff hygiene;
- no remaining browser/API test servers or generated artifacts.

## Seed Design

Existing deterministic data already provides most required evidence:

- exact project keys such as `WT`, `CLOUD`, `OPS`, and archived `LEGACY`;
- work-item display keys and title/description variety;
- a `Cloud Readiness` project and same-named milestone across different groups;
- active, planned, completed, canceled, and archived planning records;
- published status reports in multiple projects;
- two attachment filenames on `WT-3`;
- active and archived project contexts.

Add or adjust seed rows only where a deterministic ranking/overflow/browser case cannot use existing
records. Do not inflate normal seed data to performance scale; the rollback-only evidence tool owns
large fixtures.

## Documentation And Public Site

Finalization should update:

- README capability list, shortcuts, searchable fields, limits, and unsupported content;
- OpenAPI endpoint and schemas;
- public site with bounded global navigation/search copy;
- current limitations for no fuzzy, semantic, comment/activity, or file-content search;
- release notes;
- destination-neutral pattern notes for heterogeneous bounded reads, deterministic rank tiers,
  limit-plus-one groups, privacy-preserving transport/logging, lazy shell tools, and stale-response
  handling.

Public copy may say Worktrail can quickly find records and attachment filenames across the workspace. It
must not claim full-text enterprise search, semantic search, attachment-content indexing, production
authentication, or hosted search infrastructure.

## Delivery Sequence Guidance

The implementation plan should preserve these dependencies:

1. shared Quick Find contracts and validation vocabulary;
2. schema indexes, migration, repository projections, ranking, and performance evidence;
3. service, safe error, endpoint, route, request logging, and OpenAPI;
4. Angular API client and destination mapping;
5. lazy CDK launcher and root-shell trigger/shortcut/project context;
6. dialog request state, grouped rendering, keyboard behavior, and responsive styling;
7. Files fragment targeting and canonical work-item overflow;
8. seed/browser/regression evidence;
9. docs, metadata, full verification, and release finalization.

Do not begin broad dialog styling before result contracts and destination mapping are stable. Do not add
indexes without repository predicates and evidence queries that exercise them.

## Risks And Mitigations

### Six Queries Per Keystroke Overload The Pool

Risk: concurrent group queries multiply pool usage and create unstable latency.

Mitigation: debounce client requests, cancel stale HTTP work, execute groups sequentially on one request,
limit every query to six rows, and measure aggregate behavior.

### Sequential Queries Miss The Response Target

Risk: six round trips exceed the local 300 ms evidence target.

Mitigation: use narrow projections and indexes first; if measured evidence fails, combine selected groups
or use one SQL union in a later implementation phase without changing the public contract. Do not switch
to six concurrent pool connections as the default optimization.

### Ranking Feels Inconsistent Across Types

Risk: users cannot predict why one result precedes another.

Mitigation: rank only within clearly labeled groups, use explicit tiers, avoid cross-group top hits, and
return match reason metadata.

### Archived Results Crowd Active Work

Risk: historical records consume all five slots.

Mitigation: active lifecycle wins same-tier ties, exact archived identities remain reachable, and
`hasMore` communicates truncation. Revisit a lifecycle toggle only with user evidence.

### Two-Character Search Scans Large Tables

Risk: trigram indexes cannot efficiently support broad short substrings.

Mitigation: retain strict row limits and workspace indexes, capture evidence, and reserve a future split
between exact-key and broad-text minimum lengths.

### Search Text Leaks Through Logs

Risk: user-entered project context appears in URL or database error logs.

Mitigation: POST body, request-path logging, no body logging, parameterized SQL, and a safe 503 wrapper
without raw query/cause details.

### Lazy Dialog Opens Twice

Risk: repeated shortcut/button input during dynamic import creates duplicate overlays.

Mitigation: root `opening` guard plus held dialog reference, reset on import/open failure and close.

### Stale Results Apply After Actor Change

Risk: an old response appears under a newly selected local actor.

Mitigation: close before actor mutation, capture initial member id, cancel on destroy, and generation-check
responses before state application.

### Attachment Result Does Not Reach Files

Risk: route reuse or asynchronous attachment loading prevents anchor behavior.

Mitigation: explicit fragment observation, one-shot settled targeting, same-route direct focus fallback,
and browser coverage for initial/reused routes.

### New Indexes Add Write And Storage Cost

Risk: broad GIN indexes increase migration time and write amplification.

Mitigation: index only fields in the approved contract, verify plan eligibility, record migration impact,
and avoid indexing deferred content sources.

### Dialog Increases Initial Bundle Or Style Budget

Risk: CDK/search code enters the initial chunk or compact UI accumulates oversized styles.

Mitigation: dynamic launcher/component import, tree-shaken icons, focused component boundaries, production
chunk inspection, and no budget threshold increase.

## Deferred

- Slash shortcut.
- Dedicated paged global search results.
- Per-type/lifecycle filters and exact totals.
- Recent items, search history, favorites, and personalized ranking.
- Saved/shareable global searches.
- Fuzzy, typo-tolerant, token, stemming, synonym, semantic, vector, or AI search.
- Comment, activity, notification, closeout snapshot, and complete report-body search.
- Attachment bytes, OCR, extracted text, and preview search.
- Member/label search without direct destination pages.
- Result mutation commands, command registration, and command bus abstraction.
- Search analytics, click analytics, and relevance administration.
- Cross-workspace search.
- External/hosted search engines.
- Production authentication, managed deployment, metrics, tracing, and alerts.

## Open Questions

No product or technical decision blocks implementation planning.
