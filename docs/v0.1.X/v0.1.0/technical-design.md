# Worktrail v0.1.0 Technical Design

## Overview

Worktrail v0.1.0 consolidates the product and codebase after the v0.0.x feature run. The release does not introduce a new product pillar. It reorganizes the existing capability into clearer product places and extracts the code seams that are beginning to slow future work.

The release changes focus from feature accumulation to product coherence:

- a persistent project shell and project subnavigation;
- top-level cross-project `Work Items`;
- review-first planning with milestone management separated from daily review;
- a compact saved-view and filter experience;
- My Work as a prioritized daily queue;
- mobile card layouts for work item results;
- clearer work item detail context;
- shared query, risk-policy, component, route, client, and contract boundaries;
- CI/lint guardrails;
- a refreshed public site organized around the v0.1.0 baseline.

The design preserves the core architecture:

- Angular standalone components and lazy routes;
- Angular CDK where useful, without adopting Angular Material components;
- shared contracts in `@worktrail/contracts`;
- transport-neutral endpoint handlers;
- local Express adapter;
- backend service/repository layering;
- Drizzle-managed Postgres persistence;
- deterministic seed data and local-first setup;
- static frontend hosting path and GitHub Pages product site.

## Design Decisions

- Use an Angular parent route component for the project shell.
- Keep project child pages lazy-loaded under `projects/:projectId`.
- Use shell route data for active project section and project-scoped actions.
- Keep `/work-items` as the cross-project discovery route and promote it in primary navigation.
- Rename the primary nav `Workspace` link to `Workspace Settings`.
- Keep global creation at `/work-items/new`; keep project-scoped creation at `/projects/:projectId/work-items/new`.
- Use in-page planning tabs with `Review` as the default and `Milestones` as the management tab.
- Persist the planning tab in a query parameter so links can open milestone management directly.
- Use a saved-view toolbar with a picker, save/update actions, and an inline `Manage views` panel.
- Do not introduce drawers/modals unless an existing page already needs one during implementation.
- Keep desktop work item result tables; render mobile result cards with CSS media queries.
- Keep current API routes stable.
- Split Express route registration by domain without changing endpoint handlers.
- Split frontend API calls into domain clients over one shared request utility.
- Split contracts into domain files while preserving current `@worktrail/contracts` exports.
- Keep query normalization in the API and share frontend query metadata/serialization in the web app.
- Extract shared risk policy into the API domain layer first; mirror only display labels in the web app.
- Add CI for install, typecheck, unit tests, and build on pull requests and pushes to `main`.
- Keep Playwright E2E out of required CI for v0.1.0 unless runtime and database setup remain stable after implementation.
- Add ESLint with a low-churn initial rule set.
- Do not add schema migrations unless implementation discovers a data field is required. The expected v0.1.0 work is presentation and code organization.

## Frontend Architecture

### Route Model

Current routes are flat. v0.1.0 should introduce a parent project route:

```ts
{
  path: 'projects/:projectId',
  loadComponent: () =>
    import('./features/projects/project-shell/project-shell.component').then(
      (module) => module.ProjectShellComponent
    ),
  children: [
    {
      path: '',
      loadComponent: () =>
        import('./features/projects/project-home-page.component').then(
          (module) => module.ProjectHomePageComponent
        ),
      data: { projectSection: 'overview' },
      title: 'Project | Worktrail'
    },
    {
      path: 'work-items',
      loadComponent: () =>
        import('./features/work-items/work-item-list-page.component').then(
          (module) => module.WorkItemListPageComponent
        ),
      data: { projectSection: 'work' },
      title: 'Work | Worktrail'
    },
    {
      path: 'board',
      loadComponent: () =>
        import('./features/work-items/work-item-board-page.component').then(
          (module) => module.WorkItemBoardPageComponent
        ),
      data: { projectSection: 'board' },
      title: 'Board | Worktrail'
    },
    {
      path: 'planning',
      loadComponent: () =>
        import('./features/projects/project-planning-page.component').then(
          (module) => module.ProjectPlanningPageComponent
        ),
      data: { projectSection: 'planning' },
      title: 'Planning | Worktrail'
    },
    {
      path: 'settings',
      loadComponent: () =>
        import('./features/projects/project-settings-page.component').then(
          (module) => module.ProjectSettingsPageComponent
        ),
      data: { projectSection: 'settings' },
      title: 'Project Settings | Worktrail'
    },
    {
      path: 'work-items/new',
      loadComponent: () =>
        import('./features/work-items/work-item-create-page.component').then(
          (module) => module.WorkItemCreatePageComponent
        ),
      data: { projectSection: 'work' },
      title: 'Create Work Item | Worktrail'
    },
    {
      path: 'work-items/import',
      loadComponent: () =>
        import('./features/work-items/work-item-import-page.component').then(
          (module) => module.WorkItemImportPageComponent
        ),
      data: { projectSection: 'work' },
      title: 'Import Work Items | Worktrail'
    }
  ]
}
```

Keep these non-project routes at the root:

- `/my-work`;
- `/work-items`;
- `/work-items/new`;
- `/work-items/:workItemId`;
- `/projects`;
- `/workspace/settings`.

The detail route remains global because a work item can be reached from My Work, workspace discovery, project lists, board cards, health links, comments, and activity.

### Project Shell

Add `ProjectShellComponent` under `apps/web/src/app/features/projects/project-shell/`.

Responsibilities:

- read `projectId` from the parent route;
- load project summary through the project API client;
- render persistent project identity;
- render project status and delivery health;
- render archived/read-only notice;
- render project subnavigation;
- render a stable action area;
- render `<router-outlet />` for child routes;
- expose reload behavior after child pages mutate project metadata if needed.

The project shell should not own child-page data or child-page forms. Child routes continue loading their own page data.

Recommended shell view model:

```ts
type ProjectSection = 'overview' | 'work' | 'board' | 'planning' | 'settings';

interface ProjectShellAction {
  label: string;
  routerLink: unknown[];
  variant: 'primary' | 'secondary';
}
```

Project actions can be derived from the active section:

- Overview: `Create`;
- Work: `Create`, `Import`, `Export`;
- Board: `Create`;
- Planning: `Create`, `Manage milestones`;
- Settings: no primary action unless a save state is active inside the page.

If an action requires child-page state, such as export with current filters, the child page should own that action and place it in its local toolbar. The shell action area should remain predictable and low-state.

### Primary App Shell

Update the global app shell navigation:

- `My Work` -> `/my-work`;
- `Work Items` -> `/work-items`;
- `Projects` -> `/projects`;
- `Workspace Settings` -> `/workspace/settings`;
- `Create` -> `/work-items/new`.

Keep the actor selector in the topbar. On mobile, keep the nav horizontally scrollable and make the actor selector compact rather than dominant.

### Feature-Local Component Structure

Add feature-local component folders instead of continuing to grow route components:

```text
apps/web/src/app/features/projects/components/
  milestone-manager/
  planning-review/
  project-subnav/

apps/web/src/app/features/work-items/components/
  active-filter-chips/
  saved-views-toolbar/
  work-item-filter-panel/
  work-item-result-list/
  relationship-panel/
  comment-thread/
  activity-timeline/

apps/web/src/app/features/my-work/components/
  daily-queue/
  my-work-summary/
```

Promote a component to `shared` only when it is truly cross-feature and not work-item-specific. Work item result lists, filter chips, and saved-view controls should stay in the work-items feature because their behavior depends on work item query semantics.

### Work Item Filters And Results

Create a shared work item filter model in the web app:

```text
apps/web/src/app/features/work-items/query/
  work-item-filter-options.ts
  work-item-filter-state.ts
  work-item-filter-labels.ts
  work-item-query-serialization.ts
```

This module should replace duplicated filter option arrays, active-label logic, and query param conversion in project and workspace list pages.

Core filters:

- search;
- project, only on workspace list;
- status;
- assignee;
- due date;
- dependency;
- sort.

Advanced filters:

- reporter;
- type;
- priority;
- label;
- milestone;
- archived mode where applicable.

Use one `WorkItemFilterPanelComponent` with inputs for mode:

```ts
type WorkItemFilterMode = 'project' | 'workspace';
```

Project mode omits project selection and scopes milestone/label options to the active project. Workspace mode includes project selection and cross-project-safe option labels.

Use one `WorkItemResultListComponent` for desktop table and mobile card rendering. It should accept already-loaded DTOs and not perform API calls.

### Saved Views

Replace the large default saved-view management surface with `SavedViewsToolbarComponent`.

Responsibilities:

- list saved views;
- choose a saved view;
- show dirty state when current filters differ from the selected saved view;
- create a new saved view from current filters;
- update the selected saved view;
- open an inline manage panel;
- rename or delete from the manage panel.

The toolbar should not own the work item API query. It emits selected query state to the page container.

### Planning Page

Keep `ProjectPlanningPageComponent` as the route container, but split major content:

- `PlanningReviewComponent`;
- `MilestoneProgressListComponent` if useful;
- `MilestoneManagerComponent`.

Use an in-page segmented control:

- `Review`;
- `Milestones`.

The active tab is stored in `?view=review` or `?view=milestones`; missing or unknown values default to review.

Review tab:

- delivery health;
- top reasons;
- needs attention;
- upcoming;
- recently changed;
- milestone progress;
- collapsed risk detail sections.

Milestones tab:

- create milestone;
- edit milestone;
- archive/reactivate milestone;
- read-only compact milestone summaries when the actor cannot manage milestones or the project is archived.

The planning endpoint can remain unchanged for v0.1.0 unless the UI needs additional counts or grouping. Prefer deriving new view models in the frontend from the existing `ProjectPlanningSummaryDto`.

### My Work

Keep the current My Work endpoint unless implementation discovers the current response cannot support deduped queue semantics.

Frontend behavior:

- build a `Needs attention` queue from the highest-risk assigned work already returned by the endpoint;
- dedupe by work item id;
- expose summary cards as queue filters;
- collapse empty low-signal sections;
- keep reported-by-me as secondary content.

If the existing API response lacks enough data to produce stable queue ordering, add a small contract extension to the My Work DTO rather than creating a separate endpoint.

### Work Item Detail

Keep the existing detail endpoint and route. Split the page into focused components:

- header summary;
- details form or edit section;
- relationship panel;
- comment thread;
- activity timeline.

Return context should be passed with query parameters where possible:

```text
/work-items/:workItemId?returnTo=/work-items&returnLabel=Work%20Items
```

Do not trust arbitrary external URLs. Return links must be internal paths beginning with `/` and must not include a protocol or host. If return context is missing or invalid, fall back to the project work list when project id is known and workspace work items otherwise.

## Backend Architecture

### Contract Package Split

Split `packages/contracts/src/index.ts` into domain files while preserving the current public import surface:

```text
packages/contracts/src/
  activity.ts
  csv.ts
  health.ts
  index.ts
  members.ts
  planning.ts
  projects.ts
  saved-work-views.ts
  workspace.ts
  work-items.ts
```

`index.ts` becomes a barrel export:

```ts
export * from './activity.js';
export * from './csv.js';
export * from './health.js';
export * from './members.js';
export * from './planning.js';
export * from './projects.js';
export * from './saved-work-views.js';
export * from './workspace.js';
export * from './work-items.js';
```

Use `.js` extensions in TypeScript source imports/exports where required by the repo's ESM configuration.

Contract splitting should be mechanical first. Avoid changing DTO shapes unless required by the product work.

### Work Item Query Consolidation

Make `WorkItemQuery` the canonical query model for both project and workspace list behavior.

API modules:

```text
apps/api/src/validation/work-item-query.ts
apps/api/src/repositories/work-item-query-builder.ts
```

`work-item-query.ts` should own:

- parse query string values;
- normalize empty strings to absent values;
- validate enum-like values;
- normalize arrays or repeated query params where supported;
- apply default sort/status behavior;
- expose one project-aware parse function and one workspace parse function that return the same canonical shape.

`work-item-query-builder.ts` should own Drizzle-specific SQL fragments:

- status conditions;
- project conditions;
- assignee/reporter conditions;
- type/priority conditions;
- label and milestone conditions;
- due date conditions;
- dependency conditions;
- search conditions;
- archived-mode conditions;
- ordering.

The repository should call query-builder helpers rather than duplicating predicate construction across project and workspace methods.

Frontend query serialization should be updated to use matching defaults and labels, but it does not need to import backend validation code.

### Risk Policy Module

Add a domain policy module:

```text
apps/api/src/domain/work-risk-policy.ts
```

Responsibilities:

- terminal status set;
- open status set;
- active-unassigned status set;
- due-soon window days;
- stale in-progress threshold days;
- `isTerminalStatus`;
- `isOpenStatus`;
- `isActiveUnassignedStatus`;
- date helpers for due soon, overdue, and stale in progress.

Consumers:

- `DeliveryHealthService`;
- `PlanningService`;
- `MyWorkService`;
- work item query builder where date windows or status sets are needed.

SQL-specific expressions should remain in repository/query-builder code, but should consume constants from the policy module where practical.

### Express Route Registration

Keep transport-neutral endpoint handlers unchanged. Split Express registration into route modules under:

```text
apps/api/src/adapters/express/routes/
  health-routes.ts
  member-routes.ts
  planning-routes.ts
  project-routes.ts
  saved-work-view-routes.ts
  work-item-routes.ts
  workspace-routes.ts
```

Each module exports a registrar:

```ts
export function registerWorkItemRoutes(app: Express, context: ExpressRouteContext): void;
```

Shared context:

```ts
interface ExpressRouteContext {
  repositories: Repositories;
  db?: WorktrailDb;
}
```

`createExpressApp` remains responsible for:

- Express instance creation;
- CORS;
- JSON parsing;
- request logging;
- test routes;
- static asset serving;
- health/liveness route registration;
- invoking route registrars when repositories are present.

This split should not change route paths, handler signatures, or API responses.

### Frontend API Client Split

Keep one low-level request utility that handles:

- base URL;
- headers;
- actor id;
- JSON parsing;
- error normalization;
- CSV/download response handling where needed.

Split domain API clients under:

```text
apps/web/src/app/core/api/
  api-client.ts
  planning-api.ts
  projects-api.ts
  saved-views-api.ts
  work-items-api.ts
  workspace-api.ts
```

Existing route components can inject either the domain client directly or a compatibility facade during migration. A temporary `WorktrailApiService` facade is acceptable if it reduces implementation risk, but new code should use domain clients.

### DTO Assembly And Board Positioning

v0.1.0 does not require a full `WorkItemService` rewrite. If implementation needs to touch these areas, prefer small extractions:

- `BoardPositionService` for board move ordering;
- `WorkItemDtoAssembler` for list/detail DTO hydration.

These are optional for v0.1.0 unless they are necessary to complete query consolidation or component polish safely.

## Styling And Responsive Design

Use the existing visual language:

- restrained colors;
- 6-8px radii;
- dense operational layouts;
- panels for real grouped surfaces, not nested decorative cards;
- strong color reserved for status, priority, health, and risk.

Add shared CSS utilities only for patterns already repeated across pages:

- page header;
- panel;
- toolbar;
- filter grid;
- active chips;
- result table/card;
- notice;
- status/priority/dependency pills.

Avoid a design-system rewrite. The goal is consistency through extraction, not a new component library.

Mobile rules:

- top-level content remains within viewport width;
- project subnav may scroll horizontally with clear active state;
- filters collapse behind a compact control;
- active chips remain visible;
- work item results become cards;
- saved-view management does not appear before results unless explicitly opened.

## Public Site Design

Keep the static site in `site/`. Do not introduce a site generator.

Update content hierarchy:

1. Hero:
   - H1: `Worktrail`;
   - concise positioning;
   - real app screenshot;
   - `View source`, `Run locally`.
2. Product workflow:
   - daily execution;
   - work discovery;
   - project planning;
   - dependency visibility;
   - workspace governance.
3. v0.1.0 baseline:
   - compact current capability checklist.
4. Developer/reference value:
   - Angular frontend;
   - API boundary;
   - domain services;
   - Postgres persistence;
   - operations and preview.
5. Current scope:
   - not hosted SaaS;
   - not forecasting suite;
   - not integration platform.
6. Run locally.

Refresh the primary screenshot after UX consolidation if the current screenshot no longer reflects the core experience.

## Testing Strategy

### Unit And Component Tests

Add or update tests for:

- project shell nav and active section rendering;
- work item filter metadata, serialization, and active chips;
- saved-view toolbar selection and dirty state;
- planning tab behavior and review-first rendering;
- My Work deduped needs-attention queue;
- mobile result card rendering where practical through component tests;
- return context validation on work item detail;
- risk-policy pure helpers;
- work item query parsing and repository query behavior.

Split test files when extracted components make that natural. Avoid growing already-large route component specs further.

### API Tests

Add focused tests for:

- project and workspace work item query normalization;
- query behavior parity between list and export where applicable;
- route registration smoke coverage after Express route modules are split;
- risk policy consumers where existing service tests currently assert behavior.

### E2E Tests

Keep E2E as workflow smoke coverage:

- primary navigation reaches My Work, Work Items, Projects, and Workspace Settings;
- project shell subnav reaches Overview, Work, Board, Planning, and Settings;
- Planning opens on Review and can switch to Milestones;
- workspace Work Items can apply a filter and open a result;
- work item detail return context works from a filtered list.

Do not turn Playwright into exhaustive UI coverage for v0.1.0.

## CI And Lint

Add `.github/workflows/ci.yml`.

Required jobs:

- checkout;
- setup Node 20;
- `npm ci`;
- `npm run typecheck`;
- `npm test`;
- `npm run build`.

Run on:

- pull requests;
- pushes to `main`.

Add ESLint scripts:

- root `npm run lint`;
- workspace lint scripts for API, web, and contracts.

Initial lint should focus on defect prevention. If an Angular ESLint setup creates too much churn, start with TypeScript ESLint for API/contracts and use Angular-supported linting for web once dependencies/config are stable. Lint should be added as a script and can be included in CI only after the first rule set is clean.

## Documentation Updates

Update:

- `README.md` for v0.1.0 baseline capabilities and local verification;
- `docs/api/openapi.yaml` only if endpoint behavior changes;
- operations documentation if CI or preview commands change;
- extraction notes for project shell, query consolidation, risk policy, route registration, and API client split;
- public site copy and screenshot.

## Migration And Compatibility

No database migration is expected.

Route compatibility:

- preserve existing URL paths;
- keep `/projects/:projectId` as overview;
- keep `/projects/:projectId/work-items`;
- keep `/projects/:projectId/board`;
- keep `/projects/:projectId/planning`;
- keep `/projects/:projectId/settings`;
- keep `/work-items`;
- keep `/work-items/:workItemId`.

Query compatibility:

- existing saved view queries should continue to load;
- unknown query values should be ignored or normalized consistently with current behavior;
- active filter chips should reflect applied filters only.

API compatibility:

- avoid response shape changes unless required for My Work or planning polish;
- if DTOs are extended, keep added fields backward-compatible.

## Implementation Order

Recommended sequence:

1. Baseline and planning decisions.
2. Contract split and query/risk policy test scaffolding.
3. API query consolidation and route registration split.
4. Frontend API client split and shared work item query UI modules.
5. Project shell and primary navigation updates.
6. Work discovery saved-view/filter/result extraction.
7. Planning review/milestone management split.
8. My Work queue polish.
9. Work item detail context and panel extraction.
10. Responsive card rows and mobile polish.
11. CI/lint guardrails.
12. Public site and documentation refresh.
13. Final verification and release notes.

This order builds the shared seams before the largest UI changes, while keeping each phase independently verifiable.

## Risks And Mitigations

- **Route shell regression:** keep existing paths and add route tests before deeper page changes.
- **Query drift:** add query normalization tests before refactoring repository predicates.
- **Saved-view compatibility:** test existing saved-view query examples against the new serializer/parser.
- **Planning overload moves rather than disappears:** keep Review default and make Milestones clearly reachable.
- **Component extraction churn:** extract components around existing behavior first, then polish layout.
- **Lint noise:** start with low-churn rules and do not block implementation on broad style changes.
- **CI runtime:** keep E2E out of required CI initially; revisit after the standard CI job is stable.
- **Public site screenshot timing:** update copy first and refresh screenshot after UI consolidation.

## Deferred Work

- hosted authentication and tenancy;
- notification workflows;
- dashboard charts;
- bulk editing;
- custom workflow/status configuration;
- integration marketplace;
- cloud infrastructure deployment templates;
- full generated API/client pipeline;
- full design-system package;
- NgRx or another global state framework.

## Open Questions

No open question blocks implementation. The implementation plan should confirm exact phase sizing and may defer optional extractions, such as `BoardPositionService` or `WorkItemDtoAssembler`, if the core v0.1.0 polish work is already large enough.
