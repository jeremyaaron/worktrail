# Worktrail v0.1.2 Technical Design

## Overview

Worktrail v0.1.2 hardens filtered work views by treating work item query state as a product contract. The release should ensure that route query parameters, filter form state, active filter chips, saved views, dashboard links, delivery-health links, CSV exports, and return URLs all use the same canonical `WorkItemQuery` behavior.

This release is intentionally app-local. It should not create a `jawstack` package or generic query framework. The useful architectural move is to consolidate the Worktrail implementation, add round-trip tests, and document the pattern after it has proven useful inside the product.

The release preserves the existing architecture:

- Angular standalone components and lazy routes;
- shared contracts in `@worktrail/contracts`;
- transport-neutral API endpoint handlers;
- local Express adapter;
- service/repository layering;
- Drizzle-managed Postgres persistence;
- deterministic seed data;
- CI with a disposable Postgres service;
- static Angular hosting path for the eventual cloud version.

## Design Decisions

- Keep `WorkItemQuery` as the canonical shared contract.
- Keep runtime query helpers app-local in the web and API apps.
- Do not add a new package, dependency, database table, or migration.
- Do not add team-shared saved views in v0.1.2.
- Add copy-link actions to both workspace and project work item list pages for consistency.
- Copy links from applied query state only, not pending form edits.
- Keep saved views personal and store normalized server-side `WorkItemQuery` JSON.
- Keep saved-view summaries compact; count meaningful query fields rather than expanding into full labels.
- Use richer active filter chip labels only where list pages already have display context for projects, members, labels, and milestones.
- Keep default sort (`updated_desc`) and default archived-project mode (`exclude`) omitted from router query params.
- Keep route/query compatibility with existing URLs.
- Prefer pure helper functions and round-trip tests over component-specific assertions.
- Use Angular's existing patterns and browser clipboard APIs through a tiny app-local service.
- Update the static site only if final implementation includes visible share/copy improvements worth advertising.

## Current State

### Shared Contract

`packages/contracts/src/work-items.ts` defines `WorkItemQuery` with fields for:

- project;
- status and work state;
- assignee and assignee state;
- reporter;
- type;
- priority;
- label;
- milestone;
- due date state;
- blocked state;
- dependency state;
- archived-project mode;
- search;
- sort.

That contract already appears in saved views, My Work, health reasons, planning review links, API validation, repository predicate construction, and CSV export.

### API Query Parsing

`apps/api/src/validation/work-item-query.ts` owns API-side parsing and normalization:

- `parseWorkspaceWorkItemQuery`;
- `parseProjectWorkItemQuery`;
- `parseWorkItemQuery`;
- `normalizeWorkItemQuery`.

Saved views already call `normalizeWorkItemQuery` on create/update through `SavedWorkViewService`. v0.1.2 should preserve that path and add coverage where needed rather than introduce a parallel parser.

### Frontend Query Serialization

`apps/web/src/app/features/work-items/query/work-item-query-serialization.ts` already contains useful query helpers, but some components still duplicate conversion logic or generic router-param conversion.

Examples to consolidate:

- workspace list private `toQuery`;
- workspace list private `queryParamsFromFormValue`;
- workspace list private `queryParamsFromQuery`;
- project list private `toQueryParams`;
- project list return URL construction;
- delivery-health generic `workItemQueryToRouterQueryParams`;
- dashboard/planning link helpers.

## Query State Model

v0.1.2 should use the following state vocabulary consistently:

- **Pending form state:** current control values in filter forms, including edits not yet applied.
- **Applied query:** canonical `WorkItemQuery` that backs loaded results, active chips, saved-view creation/update, export, return URLs, and copy links.
- **Router query params:** URL-safe representation of applied query with defaults omitted.
- **HTTP query params:** API request representation of applied query with empty/default values omitted by `HttpParams`.
- **Saved-view query:** normalized `WorkItemQuery` stored by the API.

Only applied query state should drive visible result claims:

- active chips;
- result empty-state text;
- saved-view creation/update;
- CSV export;
- copied filtered links;
- return URLs.

Pending form state should only affect UI controls until filters are applied.

## Frontend Helper Design

Consolidate frontend work item query behavior into the existing query folder rather than adding a new top-level abstraction.

Recommended files:

- `apps/web/src/app/features/work-items/query/work-item-filter-state.ts`;
- `apps/web/src/app/features/work-items/query/work-item-query-serialization.ts`;
- `apps/web/src/app/features/work-items/query/work-item-query-serialization.spec.ts`.

### Filter State Types

Keep the existing form-value types:

```ts
export interface ProjectWorkItemFilterFormValue {
  search: string;
  status: string;
  assigneeId: string;
  reporterId: string;
  type: string;
  labelId: string;
  milestoneId: string;
  priority: string;
  dueDateState: string;
  dependency: string;
  sort: string;
}

export interface WorkspaceWorkItemFilterFormValue extends ProjectWorkItemFilterFormValue {
  projectId: string;
  workState: string;
  blocked: string;
  archivedProjects: string;
}
```

These are intentionally string-based because Angular form controls and URL params are string-oriented. Conversion to typed `WorkItemQuery` should happen in helper functions.

### Canonical Helper Surface

The frontend helper module should expose these functions:

```ts
export type RouterQueryParams = Record<string, string | null>;
export type RouterLinkQueryParams = Record<string, string>;

export function projectQueryFromFormValue(
  formValue: ProjectWorkItemFilterFormValue
): WorkItemQuery;

export function workspaceQueryFromFormValue(
  formValue: WorkspaceWorkItemFilterFormValue
): WorkItemQuery;

export function projectFormValueFromQueryParams(
  params: QueryParamReader
): ProjectWorkItemFilterFormValue;

export function workspaceFormValueFromQueryParams(
  params: QueryParamReader
): WorkspaceWorkItemFilterFormValue;

export function projectFormValueFromQuery(
  query: WorkItemQuery
): ProjectWorkItemFilterFormValue;

export function workspaceFormValueFromQuery(
  query: WorkItemQuery
): WorkspaceWorkItemFilterFormValue;

export function projectRouterQueryParamsFromQuery(query: WorkItemQuery): RouterQueryParams;

export function workspaceRouterQueryParamsFromQuery(query: WorkItemQuery): RouterQueryParams;

export function routerLinkQueryParamsFromWorkItemQuery(
  query: WorkItemQuery | null,
  scope: 'project' | 'workspace'
): RouterLinkQueryParams | null;

export function returnUrlFromWorkItemQuery(
  path: string,
  query: WorkItemQuery,
  scope: 'project' | 'workspace'
): string;

export function meaningfulWorkItemQueryFieldCount(
  query: WorkItemQuery,
  scope: 'project' | 'workspace'
): number;
```

Names can change during implementation if a clearer local convention emerges, but the design intent should hold: component classes should not hand-roll the same query conversion logic.

### Defaults And Omission Rules

Defaults remain:

- `sort: 'updated_desc'`;
- `archivedProjects: 'exclude'` for workspace lists.

Router params should omit:

- empty strings;
- `undefined`;
- `null`;
- default sort;
- default archived-project mode.

Router params should preserve:

- `blocked: false` when a user explicitly selects "not blocked";
- `assigneeState: 'unassigned'`;
- non-default archived-project modes;
- non-default sort;
- `workState` only when `status` is absent.

Project-scoped router params should strip workspace-only fields:

- `projectId`;
- `workState` if not supported by the project list;
- `blocked` if not supported by the project list;
- `archivedProjects`;
- `assigneeState` unless project list support is intentionally added.

Implementation should align this with the current project list feature set rather than expanding project filters incidentally.

### Query Round-Trip Fixtures

Tests should include representative fixtures:

- empty project query;
- full project query;
- empty workspace query;
- full workspace query;
- workspace unassigned query;
- workspace status-plus-work-state conflict where status wins;
- workspace default omission;
- saved-view hydration from a normalized query;
- delivery-health link conversion.

Round-trip shape:

```ts
const query = workspaceQueryFromFormValue(formValue);
const routeParams = workspaceRouterQueryParamsFromQuery(query);
const rehydratedForm = workspaceFormValueFromQueryParams(new URLSearchParams(clean(routeParams)));
expect(workspaceQueryFromFormValue(rehydratedForm)).toEqual(query);
```

The test should intentionally clean `null` router params because Angular uses `null` to remove query params, while `URLSearchParams` only represents present string values.

## Component Integration

### Workspace Work Item List

`WorkspaceWorkItemListPageComponent` should stop owning low-level query conversions.

It should continue to own:

- loading projects, labels, milestones, and members for display labels;
- form lifecycle;
- applied filter state signal;
- saved-view mutation actions;
- export action;
- list rendering.

It should delegate:

- form-to-query conversion;
- query-to-form conversion;
- query-to-router params;
- return URL construction;
- meaningful filter count.

Saved-view create/update should use `appliedQuery()`. Opening a saved view should navigate with `workspaceRouterQueryParamsFromQuery(savedView.query)`.

### Project Work Item List

`WorkItemListPageComponent` should use the project-scoped helpers.

It should keep project-specific display label behavior but delegate query serialization and return URL construction.

Copy-link support should be added here if the workspace implementation can be reused through a shared service and small template addition. The default decision is to include it for parity.

### Dashboard And Planning Links

The following surfaces should use the shared route-param helper:

- project home delivery-health reason links;
- project planning delivery-health reason links;
- project planning review item links where `query` is present.

Project-scoped links should pass `scope: 'project'`. Workspace-scoped links should pass `scope: 'workspace'`.

This should replace or narrow generic helpers like `workItemQueryToRouterQueryParams` where they duplicate work item query behavior.

### Result List Return URLs

Detail links from list or board contexts should continue to include a `returnUrl` when appropriate.

For list pages, the return URL should be built from the applied query, not current pending form controls. This preserves back-navigation context even when a user has staged filter edits.

## Copy Link Design

Add a small app-local clipboard service:

```ts
export class ClipboardService {
  copyText(value: string): Promise<void>;
}
```

Implementation:

- use `navigator.clipboard.writeText` when available;
- fall back to a temporary textarea and `document.execCommand('copy')` for local or less capable contexts;
- return a rejected promise when neither path works.

No third-party dependency is needed.

### UI Behavior

Add a "Copy link" button near existing list actions:

- workspace list header/action area;
- project list header/action area.

Use the current applied route:

- path: current page route;
- query params: canonical router params from applied query;
- base: `window.location.origin`.

Success state:

- show short inline text such as `Link copied`;
- reset after a short timeout;
- do not block interaction.

Failure state:

- show concise inline text such as `Link could not be copied`;
- do not throw into the console from expected clipboard-denial cases.

Tests can use a fake clipboard service rather than depend on browser clipboard behavior.

## Export Design

CSV export already calls API endpoints with query params. v0.1.2 should ensure it uses applied query only:

- project export uses `projectQueryFromFormValue(appliedFilterValues())` or equivalent;
- workspace export uses `workspaceQueryFromFormValue(appliedFilterValues())`;
- HTTP params are created through the existing `workItemQueryToHttpParams` helper or a renamed canonical equivalent.

Add a compact UI hint near export actions if it fits the current layout:

```text
Exports current filters
```

This text should not become explanatory clutter. If the header actions are already dense, prefer button title/ARIA text plus tests over adding visible text.

## Saved View Design

No schema change is needed.

The API already normalizes saved-view queries on create/update through `normalizeWorkItemQuery`. v0.1.2 should add or strengthen tests to prove:

- empty strings are removed;
- default sort is applied server-side;
- invalid query combinations are rejected;
- unknown fields do not survive normalization;
- saved views remain actor-scoped.

Frontend behavior:

- save current applied query;
- open saved view through canonical router params;
- update saved view query from current applied query;
- display compact query summary via `meaningfulWorkItemQueryFieldCount`.

Meaningful filter count should ignore default-only fields:

- `sort: 'updated_desc'`;
- `archivedProjects: 'exclude'`;
- empty/nullish fields.

It should count non-default sort and non-default archived-project mode.

## Backend Design

No new endpoint is required.

The backend work is a normalization review and focused test pass around existing code.

### API Validation

Keep `apps/api/src/validation/work-item-query.ts` as the only server-side parser/normalizer.

Potential implementation adjustments:

- ensure `normalizeWorkItemQuery` drops unknown fields through the Zod object behavior;
- ensure `parseProjectWorkItemQuery` continues to strip workspace-only fields after parsing;
- add tests for saved-view create/update using invalid or contradictory combinations;
- add tests for saved-view create/update proving normalized query JSON is returned.

Do not move API parsing into `packages/contracts` in v0.1.2. Runtime Zod schemas in contracts would force dependency and ownership decisions that are not yet proven across reference apps.

### OpenAPI

Review `docs/api/openapi.yaml` for work item query params. Update only if existing docs are stale or missing parameters used in v0.1.2 flows.

Saved-view endpoints do not need a new shape.

## Contracts

No contract change is required by default.

`WorkItemQuery` remains the shared type. If implementation exposes a small type alias like `WorkItemQueryScope = 'project' | 'workspace'`, keep it frontend-local unless it becomes part of an API request/response.

Avoid adding runtime query helpers to `@worktrail/contracts` in this release.

## Testing Strategy

### Web Unit Tests

Primary coverage should be in:

- `apps/web/src/app/features/work-items/query/work-item-query-serialization.spec.ts`;
- workspace list component tests;
- project list component tests;
- delivery-health display tests;
- copy-link service tests.

Cover:

- route query round trips;
- default omission;
- saved-view hydration;
- applied-query export behavior;
- copy link uses applied state;
- dashboard/planning links serialize through canonical helpers.

### API Tests

Primary coverage should be in:

- `apps/api/tests/work-item-query.test.ts`;
- `apps/api/tests/saved-work-views.test.ts`;
- existing work item list/export tests where gaps exist.

Cover:

- normalization of saved-view query JSON;
- rejection of contradictory query combinations;
- project/workspace parse differences;
- export query behavior if not already covered.

### E2E Smoke

Add or adjust one Playwright smoke if low-cost:

- apply workspace filters;
- copy or inspect filtered URL;
- reload the filtered URL;
- verify active chips and visible rows remain consistent.

Do not make E2E in CI required unless the existing project policy changes.

## Migration And Seed Impact

No migration is expected.

Seed data changes are not required. If final UX examples benefit from an additional saved view that highlights non-default query state, add it only if it improves manual QA and remains deterministic.

## Documentation

Update:

- `README.md`:
  - filtered URLs;
  - saved views;
  - export-current-filters behavior;
  - copy filtered view links.
- `site/index.html`:
  - mention reliable shareable views if final implementation includes copy links on user-visible pages.
- `docs/v0.1.2/release-notes.md`.
- `docs/v0.1.2/jawstack-extraction-notes.md`.

The extraction notes should say:

- Worktrail now has an app-local query contract pattern;
- useful generic candidates include parse/normalize, URL serialization, active-label summaries, saved-view validation, dashboard links, and export reuse;
- no package extraction was performed;
- the next reference app should confirm or challenge the same pattern.

## Rollout And Compatibility

Existing URLs should continue to work.

Compatibility rules:

- unknown query params may be ignored by the app;
- known query params should hydrate controls as before;
- default `sort=updated_desc` URLs should still work even though new canonical links omit that param;
- `archivedProjects=exclude` URLs should still work even though new canonical links omit that param;
- saved views created before v0.1.2 should still open.

Because there is no migration, rollback is code-only.

## Resolved Open Questions

- **Copy link scope:** implement for both workspace and project work item lists.
- **Saved-view summaries:** keep compact meaningful-filter counts for v0.1.2; defer richer labels.
- **Helper location:** keep runtime helpers frontend/API-local; do not move them to `packages/contracts`.
- **Team-shared saved views:** defer.
- **Static site:** update if copy links ship; otherwise keep the site update modest and release-note focused.

## Risks And Mitigations

- **Regression in existing URLs:** preserve old query param names and add round-trip tests.
- **Over-abstracting:** limit helper surface to Worktrail work item query behavior.
- **Clipboard instability in tests:** hide browser API details behind a small injectable service.
- **Backend/frontend drift:** keep API normalizer tests and frontend serializer tests explicit about defaults.
- **Component churn:** consolidate one list page at a time and run focused component tests after each refactor.
