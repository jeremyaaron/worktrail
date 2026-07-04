# Worktrail v0.0.6 Implementation Plan

## Purpose

This plan turns the v0.0.6 PRD and technical design into sequential implementation phases. v0.0.6 should make Worktrail operationally credible by adding production-like local preview, validated runtime configuration, health/readiness endpoints, API reference documentation, and operator-facing runbooks.

The release remains local-first. It should preserve the Angular static-hosting path, transport-neutral API handlers, Postgres migration discipline, deterministic seed data, lazy-loaded routes, and clean verification from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.0.6:

- Add a single-process production preview through Express.
- Keep development runtime unchanged.
- Keep Angular API calls relative to `/api`.
- Serve built Angular assets only in production preview or when explicitly configured.
- Add runtime configuration validation in the API workspace.
- Keep development defaults for `DATABASE_URL`, `API_PORT`, and CORS.
- Require explicit `DATABASE_URL` in production mode.
- Add `/api/health/live` and `/api/health/ready`.
- Keep `/api/health` as a compatibility liveness alias.
- Use `pg.Pool` directly for readiness.
- Add a checked-in OpenAPI YAML document under `docs/api/openapi.yaml`.
- Keep OpenAPI hand-authored in v0.0.6.
- Add an operator runbook under `docs/v0.0.6/operations-runbook.md`.
- Keep local actor selection enabled in production preview, but document it as development scaffolding.
- Defer Docker production preview, AWS infrastructure, Lambda/API Gateway adapters, production auth, OpenAPI generation, migration drift detection, metrics, tracing, and hosted deployment assets.

## Phase Sizing

Each phase should leave the repository in a coherent working state. Prefer narrowly scoped operational slices with focused tests. Keep static serving, config validation, health checks, and documentation separate enough that failures are easy to localize.

Because v0.0.6 changes runtime startup and Express behavior, run API tests after backend phases and full E2E after preview/static serving work. Do not leave preview server processes running after verification.

## Phase 0: Baseline Planning

Goal: confirm v0.0.6 planning inputs and resolve implementation choices before code changes.

Scope:

- Confirm `docs/v0.0.6/prd.md` exists.
- Confirm `docs/v0.0.6/technical-design.md` exists.
- Confirm `docs/v0.0.6/implementation-plan.md` exists.
- Confirm design decisions listed above.
- Check repository status before implementation starts.
- Confirm the active branch and any staged changes.

Out of scope:

- Dependency changes.
- Runtime implementation.
- API documentation implementation.

Acceptance criteria:

- The three v0.0.6 planning documents exist.
- No unresolved open decision blocks Phase 1.
- The worktree/index state is understood before implementation starts.

Suggested commands:

```sh
find docs/v0.0.6 -maxdepth 1 -type f | sort
git status --short --branch
```

Status:

- Completed on 2026-07-04.
- Confirmed `docs/v0.0.6/prd.md`, `docs/v0.0.6/technical-design.md`, and `docs/v0.0.6/implementation-plan.md` exist.
- Confirmed implementation decisions:
  - single-process production preview through Express;
  - development runtime remains unchanged;
  - Angular API calls remain relative to `/api`;
  - built Angular assets are served only in production preview or when explicitly configured;
  - runtime configuration validation is added in the API workspace;
  - development defaults remain for `DATABASE_URL`, `API_PORT`, and CORS;
  - production mode requires explicit `DATABASE_URL`;
  - `/api/health/live` and `/api/health/ready` are added;
  - `/api/health` remains a compatibility liveness alias;
  - readiness uses `pg.Pool` directly;
  - OpenAPI is checked in at `docs/api/openapi.yaml`;
  - OpenAPI remains hand-authored in v0.0.6;
  - operator runbook is added at `docs/v0.0.6/operations-runbook.md`;
  - local actor selection remains enabled in production preview but documented as development scaffolding;
  - Docker production preview, AWS infrastructure, Lambda/API Gateway adapters, production auth, OpenAPI generation, migration drift detection, metrics, tracing, and hosted deployment assets stay out of scope.
- Confirmed current branch is `v0.0.6`.
- Confirmed current change state: `docs/v0.0.6/` is untracked and contains the three planning documents; no code changes are present yet.
- No unresolved open decision blocks Phase 1.

## Phase 1: Runtime Configuration Foundation

Goal: centralize and validate API runtime configuration without changing runtime behavior yet.

Scope:

- Add `apps/api/src/config/runtime-config.ts`.
- Define:
  - `RuntimeMode`;
  - `RuntimeConfig`;
  - `RuntimeConfigError`;
  - `loadRuntimeConfig`;
  - default static assets path helper if useful.
- Parse and validate:
  - `NODE_ENV`;
  - `API_PORT`;
  - `DATABASE_URL`;
  - `CORS_ORIGIN`;
  - `WORKTRAIL_SERVE_STATIC`;
  - `WORKTRAIL_STATIC_ASSETS_PATH`.
- Preserve current development defaults.
- Require `DATABASE_URL` in production mode.
- Reject invalid ports and invalid boolean values.
- Add config unit tests.
- Update `apps/api/src/main.ts` to use the config for `API_PORT` and `DATABASE_URL`.
- Update `createPool` call sites to use explicit config where practical while preserving development/test helper defaults.
- Update `.env.example` with the new variables and comments.

Out of scope:

- Static asset serving.
- Health/readiness endpoint changes.
- OpenAPI documentation.
- Production preview scripts.

Acceptance criteria:

- API startup still works in development with `.env.example`.
- Production mode fails clearly when `DATABASE_URL` is missing.
- Runtime config tests cover valid defaults, production requirements, invalid port, and static boolean parsing.
- Existing tests still pass.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- runtime-config
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-04.
- Added `apps/api/src/config/runtime-config.ts` with:
  - `RuntimeMode`;
  - `RuntimeConfig`;
  - `RuntimeConfigError`;
  - `loadRuntimeConfig`;
  - `defaultStaticAssetsPath`;
  - `formatRuntimeConfigError`.
- Runtime config now parses and validates:
  - `NODE_ENV`;
  - `API_PORT`;
  - `DATABASE_URL`;
  - `CORS_ORIGIN`;
  - `WORKTRAIL_SERVE_STATIC`;
  - `WORKTRAIL_STATIC_ASSETS_PATH`.
- Preserved development defaults for local API port, database URL, CORS origin, and static serving disabled.
- Production mode now requires an explicit `DATABASE_URL`.
- Production mode defaults static serving to enabled for the later preview phase.
- Invalid ports, invalid modes, invalid database URL protocols, and invalid boolean strings are rejected with safe messages.
- Updated `apps/api/src/main.ts` to load runtime config, pass the configured database URL into `createPool`, use the configured API port, and exit with formatted config errors.
- Updated `.env.example` with runtime variables, static preview variables, database reset safety, and E2E controls.
- Added focused runtime config tests.
- Verified `npm test --workspace @worktrail/api -- runtime-config`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.

## Phase 2: Liveness And Readiness

Goal: add operational health endpoints with database readiness.

Scope:

- Extend shared contracts with health/readiness DTOs.
- Replace or extend `apps/api/src/endpoints/health.ts` with:
  - liveness handler;
  - readiness handler factory.
- Add `HealthCheckService` or equivalent using `pg.Pool`.
- Add Express routes:
  - `GET /api/health`;
  - `GET /api/health/live`;
  - `GET /api/health/ready`.
- Preserve `/api/health` response compatibility as much as practical while adding `checkedAt`.
- Return 503 for readiness failure with safe structured error body.
- Update Playwright config to use `/api/health/ready` if stable.
- Add API tests for liveness, readiness success, and readiness failure.

Out of scope:

- Migration drift detection.
- Metrics.
- OpenAPI documentation.
- Static serving.

Acceptance criteria:

- `/api/health` and `/api/health/live` return liveness JSON.
- `/api/health/ready` checks database connectivity.
- Readiness failures do not leak database URLs or raw driver details.
- API tests cover success and failure paths.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- health
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

## Phase 3: Static Asset Serving In Express

Goal: allow Express to serve the built Angular app while keeping API routes unchanged.

Scope:

- Add static asset options to `createExpressApp`.
- Add adapter-only static file serving after API route registration.
- Serve `index.html` for non-API GET routes when a static asset is not found.
- Ensure `/api/*` routes are never swallowed by SPA fallback.
- Make the static assets directory configurable.
- Add Express tests for:
  - static file response;
  - SPA deep-link fallback;
  - `/api/health` still returns API JSON;
  - missing static directory behavior if configured.

Out of scope:

- Root package preview command.
- Runtime config wiring for static serving.
- OpenAPI documentation.

Acceptance criteria:

- `createExpressApp({ staticAssets })` can serve a small test fixture as SPA assets.
- API route behavior remains unchanged.
- Static serving is adapter behavior only; endpoint handlers stay transport-neutral.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- server
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

## Phase 4: Production Preview Wiring

Goal: provide a documented command path for running built Worktrail artifacts locally.

Scope:

- Add API package scripts:
  - `start`;
  - `start:prod`.
- Add root scripts:
  - `preview`;
  - `start:prod`.
- Wire `main.ts` to enable static serving through runtime config.
- Set production preview defaults:
  - `NODE_ENV=production`;
  - static serving enabled;
  - static assets path derived from repo layout unless overridden.
- Ensure startup logs identify:
  - runtime mode;
  - port;
  - static serving enabled/disabled;
  - liveness/readiness URLs.
- Ensure config failures exit with status code `1`.
- Manually verify preview:
  - `/api/health/live`;
  - `/api/health/ready`;
  - `/my-work`;
  - `/work-items/new`;
  - browser refresh on a deep link.
- Add an automated preview smoke script only if it remains small and reliable.

Out of scope:

- Docker production preview.
- Cloud deployment assets.
- OpenAPI documentation.

Acceptance criteria:

- `npm run preview` builds and starts a production-like preview.
- Built Angular routes load through Express.
- Built frontend calls same-origin `/api`.
- Deep links refresh successfully.
- No preview process remains running after verification.

Suggested commands:

```sh
npm run build
DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run start:prod
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
git diff --check
```

## Phase 5: OpenAPI Reference

Goal: add a useful checked-in HTTP API reference for implemented routes.

Scope:

- Add `docs/api/openapi.yaml`.
- Document:
  - health/readiness;
  - workspace;
  - capabilities;
  - members;
  - projects;
  - project navigation summary;
  - labels;
  - milestones;
  - work items;
  - comments;
  - activity;
  - My Work;
  - saved work views.
- Document local actor header behavior as development-only.
- Document common error response shape.
- Document representative request/response schemas rather than every nested DTO in exhaustive detail.
- Add a lightweight test that checks the OpenAPI file exists and includes required path keys.
- Link the OpenAPI file from README later in Phase 7.

Out of scope:

- Swagger UI.
- OpenAPI generation.
- New API endpoints solely for documentation.
- Full schema exhaustiveness.

Acceptance criteria:

- `docs/api/openapi.yaml` exists.
- Major implemented routes are represented.
- Local actor header behavior and common error shape are documented.
- A test guards against accidental removal of key paths.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- openapi
npm run typecheck
git diff --check
```

## Phase 6: Operations Runbook

Goal: document how to run and inspect Worktrail like an operator.

Scope:

- Add `docs/v0.0.6/operations-runbook.md`.
- Cover:
  - runtime modes;
  - environment variables;
  - local setup;
  - migration and seed flow;
  - production preview flow;
  - health/readiness checks;
  - deep-link checks;
  - database reset safety;
  - troubleshooting;
  - future cloud mapping.
- Keep commands copy-paste friendly.
- Explicitly warn that local actor selection is not production authentication.
- Explicitly warn that production preview should not be exposed as a public authenticated product.

Out of scope:

- Updating public site.
- Updating README.
- Release version bump.

Acceptance criteria:

- A new evaluator can follow the runbook to run development and production preview.
- Dangerous commands are clearly labeled.
- Future cloud mapping is concrete but clearly deferred.

Suggested commands:

```sh
sed -n '1,260p' docs/v0.0.6/operations-runbook.md
git diff --check
```

## Phase 7: Documentation, Product Site, Extraction Notes, And Version Finalization

Goal: prepare v0.0.6 release-facing materials.

Scope:

- Update `README.md`:
  - v0.0.6 capabilities;
  - production preview;
  - health/readiness;
  - OpenAPI reference;
  - operations runbook link;
  - limitations.
- Update static product site for:
  - production preview;
  - readiness;
  - API documentation;
  - cloud-shaped runtime boundaries.
- Add `docs/v0.0.6/jawstack-extraction-notes.md`.
- Update root, app, and package versions to `0.0.6` if release/tagging is in scope.
- Update package lockfile if versions change.
- Record final verification in this implementation plan.

Out of scope:

- Creating a release tag unless explicitly requested.
- Publishing packages.
- Adding hosted deployment assets.

Acceptance criteria:

- Documentation and public site reflect v0.0.6 capabilities.
- Extraction notes capture reusable operational patterns and deferred abstractions.
- Versions are consistent if bumped.
- Full verification passes or residual issues are documented.

Suggested commands:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
git status --short --branch
```

## Phase 8: Final Preview And Release Verification

Goal: complete the operational verification that distinguishes v0.0.6 from a standard code release.

Scope:

- Reset, migrate, and seed local database.
- Run the production preview from built artifacts.
- Verify:
  - `/api/health/live`;
  - `/api/health/ready`;
  - `/my-work`;
  - `/work-items`;
  - `/work-items/new`;
  - a direct work item detail deep link;
  - browser refresh on a lazy route.
- Stop the preview process.
- Run final automated verification.
- Record all verification results in Phase 8 notes.

Out of scope:

- Manual exploratory QA beyond the operational preview path.
- Release tag creation unless explicitly requested.

Acceptance criteria:

- Production preview is verified from built artifacts.
- Local database is restored to deterministic seed data.
- Full automated verification passes.
- No server process remains running.
- Worktree changes are ready for review.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run build
DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run start:prod
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
npm run typecheck
npm test
npm run test:e2e
npm audit --omit=dev --audit-level=low
git diff --check
git status --short --branch
```
