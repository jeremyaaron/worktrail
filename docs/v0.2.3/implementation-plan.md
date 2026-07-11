# Worktrail v0.2.3 Implementation Plan

## Purpose

This plan turns the v0.2.3 PRD and technical design into sequential implementation phases.

v0.2.3 should add a workspace-level Portfolio review surface. Portfolio should summarize active project health, communication freshness, active planning context, and drill-down paths into existing Worktrail action surfaces.

The release should preserve:

- existing project, work item, cycle, milestone, and report persistence;
- existing project-level Planning, Review, Work, Board, and Reports behavior;
- existing project permissions and archived-project read behavior;
- canonical `WorkItemQuery` drill-down semantics;
- local-first setup and transport-neutral endpoint handlers;
- full local verification.

## Design Decisions

Use these decisions while implementing v0.2.3:

- Add top-level frontend route `/portfolio`.
- Add backend endpoint `GET /api/portfolio`.
- Keep Portfolio read-only in v0.2.3.
- Do not add a database migration.
- Exclude archived projects from the primary Portfolio review.
- Use a 14-day report freshness threshold.
- Treat report freshness as a communication signal, not delivery health.
- Use fixed urgency-first ordering; do not add sortable grid behavior yet.
- Add a focused `PortfolioService` rather than expanding `ProjectService`.
- Reuse `DeliveryHealthService` for project delivery health.
- Derive Portfolio from current state; do not add stored snapshots or materialized read-model tables.
- Prefer batch repository helpers if simple per-project fan-out becomes noisy.
- Keep attention sections bounded to five items each.
- Keep frontend route lazy-loaded.
- Use a dense operating layout, not a hero or marketing surface.
- Update OpenAPI, README, release notes, and pattern notes during finalization.

## Phase Sizing

Each phase should leave the repository in a coherent working state.

Implementation phases:

1. baseline planning;
2. shared contracts and API client shape;
3. backend portfolio read model;
4. endpoint, Express route, and OpenAPI;
5. Angular route, navigation, and API integration;
6. Portfolio page UI;
7. seed data and browser smoke;
8. documentation, package metadata, and final verification.

Run focused contract/API tests after backend phases, focused Angular tests after frontend phases, browser smoke after the UI is routed, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.2.3 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.2.3/prd.md` exists.
- Confirm `docs/v0.2.3/technical-design.md` exists.
- Confirm `docs/v0.2.3/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm v0.2.3 does not require database migrations.
- Confirm no runtime files have been changed for v0.2.3 yet.

Out of scope:

- Runtime implementation.
- Contract edits.
- API or frontend tests.
- Documentation finalization.

Acceptance criteria:

- v0.2.3 planning inputs exist.
- Design decisions are recorded in this plan.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.
- The release remains scoped to workspace Portfolio review unless later implementation evidence requires otherwise.

Suggested commands:

```sh
find docs/v0.2.3 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-10.
- Confirmed v0.2.3 planning inputs exist:
  - `docs/v0.2.3/prd.md`;
  - `docs/v0.2.3/technical-design.md`;
  - `docs/v0.2.3/implementation-plan.md`.
- Confirmed active branch is `v0.2.3`.
- Confirmed current change state:
  - `docs/v0.2.3/` is untracked and contains only v0.2.3 planning documents;
  - no runtime files have been changed for v0.2.3 yet.
- Confirmed implementation decisions:
  - add top-level frontend route `/portfolio`;
  - add backend endpoint `GET /api/portfolio`;
  - keep Portfolio read-only in v0.2.3;
  - do not add a database migration;
  - exclude archived projects from the primary Portfolio review;
  - use a 14-day report freshness threshold;
  - use fixed urgency-first ordering without sortable grid behavior;
  - add a focused `PortfolioService` and reuse `DeliveryHealthService`.
- Confirmed the PRD open questions are resolved by the technical design and this plan.
- Verified:
  - `find docs/v0.2.3 -maxdepth 1 -type f | sort`;
  - `git status --short --branch`;
  - `git diff --check`;
  - `rg -n "Do not add a database migration|GET /api/portfolio|/portfolio|No database|database migration|Phase 0|Phase 1|Open Questions|Resolved Decisions" docs/v0.2.3/*.md`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Shared Contracts And API Client Shape

Goal: define the portfolio DTO contract and frontend API entry point without backend behavior yet.

Scope:

- Add portfolio DTOs to `@worktrail/contracts`.
- Prefer `packages/contracts/src/portfolio.ts` if `projects.ts` would become too broad.
- Export portfolio DTOs from the contracts index.
- Include:
  - `PortfolioDto`;
  - `PortfolioSummaryDto`;
  - `PortfolioProjectRowDto`;
  - `PortfolioAttentionItemDto`;
  - `PortfolioLinkDto`;
  - `PortfolioReportSummaryDto`;
  - report freshness and attention type unions.
- Add `queryScope?: 'workspace' | 'project'` to portfolio links if the frontend needs explicit query conversion.
- Add `getPortfolio()` to the Angular API client and facade.
- Add API client test coverage for `GET /api/portfolio`.
- Keep backend endpoint unimplemented until Phase 3.

Out of scope:

- Backend service behavior.
- Angular page route.
- OpenAPI.

Acceptance criteria:

- Contracts compile.
- Frontend API client can request `/api/portfolio`.
- No runtime page consumes the new client yet.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/contracts
npm test --workspace @worktrail/web -- --include 'src/app/core/worktrail-api.service.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-10.
- Added `packages/contracts/src/portfolio.ts` with:
  - `PortfolioDto`;
  - `PortfolioSummaryDto`;
  - `PortfolioProjectRowDto`;
  - `PortfolioProjectLinksDto`;
  - `PortfolioAttentionItemDto`;
  - `PortfolioAttentionSectionsDto`;
  - `PortfolioLinkDto`;
  - `PortfolioReportSummaryDto`;
  - report freshness, attention type, and link query-scope unions.
- Exported portfolio DTOs from `@worktrail/contracts`.
- Added `ProjectsApi.getPortfolio()` for `GET /api/portfolio`.
- Added `WorktrailApiService.getPortfolio()` facade method.
- Added focused API facade test coverage confirming:
  - request path is `/api/portfolio`;
  - method is `GET`;
  - selected actor headers are applied.
- Kept backend endpoint behavior, Angular route, and page UI deferred to later phases.
- Verified:
  - `npm run typecheck --workspace @worktrail/contracts`;
  - `npm test --workspace @worktrail/web -- --include 'src/app/core/worktrail-api.service.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`.

## Phase 2: Backend Portfolio Read Model

Goal: implement the derived Portfolio service and focused API/service tests.

Scope:

- Add `apps/api/src/services/portfolio-service.ts`.
- Add batch repository helpers only if needed:
  - latest reports by project ids;
  - active cycles by project ids;
  - milestones by project ids.
- Load active projects for `request.actor.workspaceId`.
- Exclude archived projects from rows and summary.
- Load project work, dependency-blocked work, blocking-open-work, milestones, active cycles, and latest reports.
- Use `DeliveryHealthService` for project health.
- Derive:
  - project rows;
  - summary counts;
  - report freshness;
  - active milestone summary;
  - active cycle summary;
  - urgency sorting;
  - bounded attention sections;
  - drill-down links.
- Use a service clock for time-based freshness tests.
- Add API/service tests for:
  - summary counts;
  - active-project filtering;
  - delivery health reuse;
  - report freshness `fresh`, `stale`, and `missing`;
  - attention ordering/bounds;
  - drill-down link payloads;
  - contributor read access;
  - empty workspace behavior.

Out of scope:

- Express route registration.
- OpenAPI.
- Angular UI.

Acceptance criteria:

- `PortfolioService.getPortfolio()` returns a complete `PortfolioDto`.
- Time-based tests do not rely on hard-coded dates that will become invalid.
- Portfolio health semantics match `DeliveryHealthService`.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/portfolio.test.ts
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-11.
- Added `apps/api/src/services/portfolio-service.ts`.
- Implemented derived Portfolio read model from existing data:
  - active workspace projects only;
  - project work items;
  - dependency-blocked work;
  - work blocking downstream open work;
  - milestones;
  - active cycles;
  - latest published status reports.
- Reused `DeliveryHealthService` for project delivery health and milestone progress.
- Derived Portfolio summary counts, urgency-sorted rows, report freshness, planning summaries, action links, and bounded attention sections.
- Kept the service read-only and avoided database migrations.
- Used a service clock for report freshness and stale-cycle checks.
- Added `apps/api/tests/portfolio.test.ts` coverage for:
  - active project rows and archived-project exclusion;
  - summary counts;
  - stale, fresh, and missing report freshness;
  - latest report author/health summary hydration;
  - active milestone and active cycle summaries;
  - dependency-pressure drill-down links;
  - bounded attention sections;
  - contributor read access;
  - empty workspace behavior.
- No batch repository helpers were needed for this phase; simple read fan-out remains acceptable for the initial derived model.
- Verified:
  - `npm test --workspace @worktrail/api -- tests/portfolio.test.ts`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`.

## Phase 3: Endpoint, Express Route, And OpenAPI

Goal: expose the portfolio read model through the transport-neutral endpoint and document it.

Scope:

- Add `apps/api/src/endpoints/portfolio.ts`.
- Register `GET /api/portfolio` in the Express adapter.
- Add or update endpoint tests if Phase 2 focused on service tests.
- Update `docs/api/openapi.yaml` with:
  - path;
  - response schema;
  - representative nested DTO schemas.
- Confirm endpoint uses actor workspace context and accepts no workspace id from route/query input.

Out of scope:

- Frontend page.
- Seed data changes.

Acceptance criteria:

- `GET /api/portfolio` returns `200` for active workspace members.
- OpenAPI includes the new route and response shape.
- No existing project route behavior changes.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/portfolio.test.ts
npm run typecheck --workspace @worktrail/api
git diff --check
```

## Phase 4: Angular Route, Navigation, And API Integration

Goal: add the lazy Portfolio route and wire it into top-level navigation.

Scope:

- Add `apps/web/src/app/features/portfolio/portfolio-page.component.ts`.
- Add lazy route at `/portfolio`.
- Add route spec coverage.
- Add primary navigation entry `Portfolio`.
- Add nav spec coverage if existing tests assert navigation labels.
- Implement route component data loading using `getPortfolio()`.
- Add loading, error, and empty states.
- Add initial component tests for:
  - API request;
  - loading state;
  - error state;
  - empty state.

Out of scope:

- Full portfolio layout.
- Drill-down links.
- E2E smoke.

Acceptance criteria:

- `/portfolio` is routable.
- Navigation exposes Portfolio.
- The component can load and render a basic portfolio response.
- Empty and error states are usable.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/app.routes.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/portfolio/portfolio-page.component.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

## Phase 5: Portfolio Page UI

Goal: build the complete Portfolio operating surface.

Scope:

- Render page header with generated/freshness context.
- Render compact summary counts.
- Render bounded attention sections:
  - Needs attention;
  - Communication freshness;
  - Current execution;
  - Dependency pressure.
- Render project comparison rows.
- Show delivery health and health reasons.
- Show report freshness separately from delivery health.
- Show active milestone and active cycle context.
- Render row links:
  - Overview;
  - Work;
  - Planning;
  - Reports;
  - latest report;
  - milestone review;
  - cycle review;
  - risk-specific Work links.
- Convert portfolio query links through existing `WorkItemQuery` router helpers.
- Add responsive CSS for compact desktop table/list and stacked mobile records.
- Extract child components if the route component approaches style budget risk.
- Add component tests for:
  - summary counts;
  - attention sections;
  - project row sorting/rendering;
  - report freshness labels;
  - query link params;
  - mobile-safe/accessible labels where feasible.

Out of scope:

- Custom sorting/filtering.
- Charts.
- Portfolio export.

Acceptance criteria:

- Users can scan portfolio state without opening each project.
- Every action link routes to an existing Worktrail surface.
- Report freshness is visibly separate from delivery health.
- Text fits in common desktop/mobile containers.
- Production build has no new budget warning.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/portfolio/portfolio-page.component.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

## Phase 6: Seed Data And Browser Smoke

Goal: make Portfolio meaningful in a fresh local seed and cover the workflow through Playwright.

Scope:

- Inspect current seed Portfolio output before changing seed data.
- Add minimal seed updates only if existing data does not demonstrate:
  - one blocked/at-risk active project;
  - one healthier active project;
  - missing or stale report freshness;
  - recent report freshness;
  - active cycle/milestone context;
  - dependency pressure.
- Avoid brittle absolute-date assumptions where possible.
- Add Playwright smoke coverage:
  - open `/portfolio`;
  - verify seeded summary/project names;
  - verify at least one attention item;
  - follow one risk link to Work and confirm active chip/row;
  - return or navigate back to Portfolio;
  - follow latest report or Reports link.
- Keep E2E scope focused.

Out of scope:

- Exhaustive link testing.
- Screenshot regression.

Acceptance criteria:

- Fresh seeded database demonstrates Portfolio value immediately.
- E2E verifies the primary read-and-drill workflow.
- Existing E2E scenarios still pass.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npx playwright test -g "portfolio"
npm run test:e2e
git diff --check
```

## Phase 7: Documentation, Metadata, And Final Verification

Goal: finish v0.2.3 with accurate docs, release notes, pattern notes, and full verification.

Scope:

- Update README:
  - current baseline;
  - repository layout;
  - Portfolio capability section or current baseline bullets;
  - demo walkthrough;
  - limitations/deferred items if needed.
- Add `docs/v0.2.3/release-notes.md`.
- Add `docs/v0.2.3/pattern-notes.md`.
- Update package versions to `0.2.3` if the project continues mirroring product tags in package metadata.
- Update static site if Portfolio materially changes the product story.
- Run final verification:
  - package-lock refresh;
  - db reset/migrate/seed;
  - lint;
  - typecheck;
  - unit/API/web tests;
  - E2E tests;
  - production build;
  - production dependency audit;
  - diff hygiene.
- Record known limitations and deferred follow-ups.

Out of scope:

- v0.2.4 planning.
- New product features.

Acceptance criteria:

- README and release docs reflect the Portfolio release.
- Pattern notes capture destination-neutral lessons.
- Full verification is green or any residual issue is documented with a clear rationale.

Suggested commands:

```sh
npm install --package-lock-only
npm run db:reset
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
git status --short --branch
```

## Rollback Notes

If a Portfolio issue appears before release:

- If only the frontend route is problematic, remove the nav entry and route while leaving backend endpoint/docs unmerged.
- If the service aggregation is wrong, keep contracts but remove endpoint exposure until tests prove the read model.
- If report freshness creates confusion, keep the row field but remove freshness attention copy before release.
- If seed changes destabilize older smoke tests, revert seed changes and use existing seed state for Portfolio smoke.
- Do not ship a Portfolio page whose risk links route to incorrect project/work query context.
- Do not ship a Portfolio page that duplicates or contradicts project delivery-health semantics.

## Final Release Gate

v0.2.3 is ready when:

- `/portfolio` is available from primary navigation;
- `GET /api/portfolio` returns a derived active-project portfolio model;
- project delivery health is reused, not redefined;
- report freshness is visible and separate from delivery health;
- attention sections are bounded and actionable;
- project rows link into existing Work, Planning, Review, and Reports surfaces;
- seeded data demonstrates Portfolio value;
- OpenAPI, README, release notes, and pattern notes are current;
- full local verification passes.
