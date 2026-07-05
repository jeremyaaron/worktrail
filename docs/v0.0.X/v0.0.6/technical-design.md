# Worktrail v0.0.6 Technical Design

## Overview

Worktrail v0.0.6 makes the application operationally credible without turning the sprint into a hosted infrastructure project. The release adds:

- a production-like local preview that runs compiled API code and serves built Angular assets;
- validated runtime configuration;
- liveness and readiness endpoints;
- a checked-in OpenAPI reference for implemented HTTP routes;
- operator documentation for local preview, migrations, health checks, reset safety, and cloud mapping;
- release documentation and product-site updates.

The design preserves the current architecture:

- Angular standalone route components built as a static SPA;
- lazy-loaded feature routes;
- shared TypeScript contracts in `packages/contracts`;
- transport-neutral endpoint handlers;
- local Express adapter;
- service/repository backend layering;
- Drizzle-managed Postgres schema and migrations;
- deterministic local seed data and Playwright smoke coverage.

v0.0.6 should not add production authentication, AWS infrastructure, Lambda/API Gateway adapters, Docker production preview, telemetry stacks, custom workflows, or hosted deployment assets.

## Design Decisions

- Use a single Express process for production preview. The process serves `/api/*` routes and the Angular static build from the same origin.
- Keep Angular `environment.apiBaseUrl = '/api'`. This already works for dev proxy and same-origin preview, and it maps cleanly to future CloudFront behavior.
- Keep the future cloud model separate in docs: Angular static assets eventually belong in S3/CloudFront, while API handlers can later be adapted to Lambda/API Gateway.
- Add runtime configuration validation in the API workspace instead of scattering `process.env` reads through startup code.
- Keep local development defaults for `DATABASE_URL`, `API_PORT`, and CORS in development mode.
- Require explicit production-like configuration when `NODE_ENV=production`.
- Keep local actor selection enabled in production preview, but document it as development scaffolding and not production authentication.
- Add `GET /api/health/live` and `GET /api/health/ready`; keep `GET /api/health` as a compatibility alias for liveness.
- Make readiness check database connectivity only. Migration drift detection is deferred.
- Add a checked-in OpenAPI YAML document under `docs/api/openapi.yaml`.
- Keep OpenAPI hand-authored for v0.0.6. Generation can be considered later when the route and schema surface stabilizes.
- Do not add Docker production preview in v0.0.6. Docker Compose remains local Postgres support only.

## Runtime Architecture

### Development Runtime

Development remains unchanged:

```text
npm run dev
  concurrently
    npm run dev:api  -> tsx watch src/main.ts
    npm run dev:web  -> ng serve --proxy-config proxy.conf.json
```

Angular dev server proxies `/api` to the API process. API CORS allows the Angular dev origin.

### Production Preview Runtime

Add a root command:

```text
npm run preview
```

Recommended implementation:

```text
npm run build
node apps/api/dist/main.js
```

The compiled API process:

- creates the Postgres pool;
- creates repositories;
- creates the Express app;
- mounts API routes under `/api`;
- serves static assets from `apps/web/dist/worktrail-web/browser` when enabled;
- returns `index.html` for non-API GET routes to support SPA deep links.

Suggested package scripts:

```json
{
  "preview": "npm run build && npm run start:prod",
  "start:prod": "NODE_ENV=production npm run start:prod --workspace @worktrail/api"
}
```

API workspace scripts:

```json
{
  "start": "node dist/main.js",
  "start:prod": "node dist/main.js"
}
```

The exact naming can be adjusted in implementation, but root `npm run preview` should be the documented happy path.

### Static Asset Serving

Add static serving to the Express adapter or a small preview-specific wrapper.

Preferred approach:

- Extend `createExpressApp` with `staticAssets?: StaticAssetOptions`.
- Keep API registration unchanged.
- Mount static assets after API routes.
- For GET requests that are not `/api/*` and do not map to an existing file, return `index.html`.

Sketch:

```ts
export interface StaticAssetOptions {
  directory: string;
  indexFile?: string;
}

export interface CreateExpressAppOptions {
  repositories?: Repositories;
  db?: WorktrailDb;
  testRoutes?: Record<string, EndpointHandler>;
  corsOrigin?: string;
  staticAssets?: StaticAssetOptions;
}
```

Rationale:

- Keeps production preview in the existing adapter.
- Avoids adding a separate static server dependency.
- Preserves API handler portability because static serving is adapter behavior, not endpoint handler behavior.

Default static asset path:

```text
apps/web/dist/worktrail-web/browser
```

The path should be configurable for tests and future packaging.

## Runtime Configuration

Add `apps/api/src/config/runtime-config.ts`.

Responsibilities:

- Parse environment variables.
- Apply development defaults.
- Reject malformed values.
- Reject missing production requirements.
- Return a typed immutable config object.
- Provide error messages that are safe to print at startup.

Proposed shape:

```ts
export type RuntimeMode = 'development' | 'test' | 'production';

export interface RuntimeConfig {
  nodeEnv: RuntimeMode;
  apiPort: number;
  databaseUrl: string;
  corsOrigin: string | false;
  serveStaticAssets: boolean;
  staticAssetsPath: string;
  localActorMode: 'enabled';
}

export class RuntimeConfigError extends Error {
  readonly issues: string[];
}

export function loadRuntimeConfig(env?: NodeJS.ProcessEnv): RuntimeConfig;
```

Environment variables:

| Variable | Development default | Production preview | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | `production` | Supports `development`, `test`, `production`. |
| `API_PORT` | `3000` | Required or defaulted to `3000` | Must be an integer from 1 to 65535. |
| `DATABASE_URL` | `postgres://worktrail:worktrail@localhost:5432/worktrail` | Required | Required in production mode to avoid accidental hidden defaults. |
| `CORS_ORIGIN` | `http://localhost:4200` | Optional | Set to `false` or omit for same-origin preview if implementation supports no CORS. |
| `WORKTRAIL_SERVE_STATIC` | `false` in dev, `true` in production | Optional | Enables serving Angular static assets from Express. |
| `WORKTRAIL_STATIC_ASSETS_PATH` | derived path | Optional | Useful for tests and packaging. |
| `WORKTRAIL_ALLOW_DATABASE_RESET` | unset | unset | Used by reset command, documented here for safety. |
| `WORKTRAIL_E2E_SKIP_DB_RESET` | unset | unset | Test-only. |
| `WORKTRAIL_E2E_SKIP_DB_RESTORE` | unset | unset | Test-only. |

Notes:

- `DATABASE_URL` can still default in development and test to preserve current ergonomics.
- Production mode must not silently default `DATABASE_URL`.
- CORS should remain enabled for dev server usage. In production preview, same-origin calls do not need CORS, but preserving an explicit `CORS_ORIGIN` is acceptable.
- `WORKTRAIL_DEFAULT_MEMBER_ID` is not needed in v0.0.6 unless implementation discovers an existing user-facing use.

## API Startup

Update `apps/api/src/main.ts`:

1. Load dotenv.
2. Load runtime config.
3. Create pool from `config.databaseUrl`.
4. Create repositories.
5. Create Express app with `corsOrigin` and optional static assets.
6. Listen on `config.apiPort`.
7. Print a concise startup log:
   - mode;
   - port;
   - whether static assets are served;
   - health/readiness URLs.

Startup failure behavior:

- Runtime config errors print each issue and exit with status code `1`.
- Do not print secrets such as `DATABASE_URL`.
- Unexpected startup failures also exit with status code `1`.

## Health And Readiness

### Contracts

Add response shapes to `packages/contracts/src/index.ts`:

```ts
export interface LivenessDto {
  status: 'ok';
  service: 'worktrail-api';
  checkedAt: string;
}

export interface ReadinessDto {
  status: 'ready';
  service: 'worktrail-api';
  checks: {
    database: 'ok';
  };
  checkedAt: string;
}

export interface ReadinessFailureDto {
  error: {
    code: 'READINESS_FAILED';
    message: string;
    checks: {
      database: 'failed';
    };
  };
}
```

Exact naming can be adjusted, but responses should be structured and predictable.

### Endpoints

```text
GET /api/health
GET /api/health/live
GET /api/health/ready
```

Behavior:

- `/api/health` and `/api/health/live` return liveness.
- `/api/health/ready` performs a lightweight database query.
- Readiness uses `select 1` through the existing pool or Drizzle DB.
- Readiness returns 200 on success.
- Readiness returns 503 on database failure.
- Failure body must not include connection strings or raw database errors.

Implementation options:

- Keep liveness as a transport-neutral endpoint handler.
- Implement readiness as an endpoint handler factory that receives a `HealthCheckService`.
- `HealthCheckService` can depend on `pg.Pool` or `WorktrailDb`.

Recommended service:

```ts
export class HealthCheckService {
  constructor(private readonly pool: pg.Pool) {}

  async checkReadiness(): Promise<ReadinessDto> {
    await this.pool.query('select 1');
    return { ... };
  }
}
```

Rationale:

- Keeps readiness near infrastructure because it checks actual connectivity.
- Avoids adding repository concepts for an operational query.
- Allows tests to stub success/failure.

## OpenAPI Reference

Add:

```text
docs/api/openapi.yaml
```

Scope:

- Document implemented HTTP paths, methods, request bodies, core query params, and representative response schemas.
- Reference local actor headers:
  - `x-worktrail-member-id`
  - any existing local actor header behavior used by the adapter.
- Document common error response:

```yaml
ErrorResponse:
  type: object
  required: [error]
  properties:
    error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
```

Initial path coverage:

- `GET /api/health`
- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/workspace`
- `PATCH /api/workspace`
- `GET /api/workspace/capabilities`
- `GET /api/workspace/activity`
- `GET /api/members`
- `POST /api/members`
- `PATCH /api/members/{memberId}`
- `POST /api/members/{memberId}/deactivate`
- `POST /api/members/{memberId}/reactivate`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/navigation-summary`
- `GET /api/projects/{projectId}`
- `PATCH /api/projects/{projectId}`
- `POST /api/projects/{projectId}/archive`
- `POST /api/projects/{projectId}/reactivate`
- `GET /api/projects/{projectId}/summary`
- `GET /api/projects/{projectId}/planning-summary`
- `GET /api/projects/{projectId}/activity`
- `GET /api/projects/{projectId}/labels`
- `POST /api/projects/{projectId}/labels`
- `GET /api/projects/{projectId}/milestones`
- `POST /api/projects/{projectId}/milestones`
- `GET /api/projects/{projectId}/work-items`
- `POST /api/projects/{projectId}/work-items`
- `GET /api/work-items`
- `GET /api/work-items/{workItemId}`
- `PATCH /api/work-items/{workItemId}`
- `POST /api/work-items/{workItemId}/transition`
- `POST /api/work-items/{workItemId}/move`
- `GET /api/work-items/{workItemId}/comments`
- `POST /api/work-items/{workItemId}/comments`
- `GET /api/work-items/{workItemId}/activity`
- `PATCH /api/comments/{commentId}`
- `DELETE /api/comments/{commentId}`
- `PATCH /api/labels/{labelId}`
- `POST /api/labels/{labelId}/archive`
- `POST /api/labels/{labelId}/reactivate`
- `PATCH /api/milestones/{milestoneId}`
- `POST /api/milestones/{milestoneId}/archive`
- `POST /api/milestones/{milestoneId}/reactivate`
- `GET /api/my-work`
- `GET /api/saved-work-views`
- `POST /api/saved-work-views`
- `PATCH /api/saved-work-views/{savedViewId}`
- `DELETE /api/saved-work-views/{savedViewId}`

Validation:

- Do not add a new dependency just to validate OpenAPI unless implementation risk is low.
- A simple test can read the YAML and assert major paths are present.
- If a lightweight existing dependency is already available, a validation command can be added later.

Serving the OpenAPI document:

- Do not serve Swagger UI in v0.0.6.
- Optionally serve the raw YAML at `/api/docs/openapi.yaml` only if implementation is trivial.
- Linking from README and runbook is sufficient for this release.

## Operator Documentation

Add:

```text
docs/v0.0.6/operations-runbook.md
```

Sections:

- Runtime modes:
  - development;
  - production preview;
  - Playwright e2e.
- Environment variables table.
- Local setup.
- Migration and seed flow.
- Production preview flow.
- Health and readiness checks.
- Deep-link verification.
- Database reset safety.
- Troubleshooting:
  - missing `DATABASE_URL`;
  - database refused connection;
  - migrations not applied;
  - Angular deep link 404;
  - CORS mismatch in development;
  - stale dev server still running.
- Future cloud mapping:
  - Angular build -> S3/CloudFront;
  - `/api/*` -> API Gateway/Lambda adapter;
  - Postgres -> managed Postgres;
  - config validation -> deployment environment variables;
  - readiness -> load balancer or synthetic checks.

Update `README.md` with concise links to:

- OpenAPI document;
- operations runbook;
- production preview command;
- readiness endpoint.

## Package Scripts

Root `package.json` additions:

```json
{
  "preview": "npm run build && npm run start:prod",
  "start:prod": "npm run start:prod --workspace @worktrail/api"
}
```

API package additions:

```json
{
  "start": "node dist/main.js",
  "start:prod": "node dist/main.js"
}
```

Optional verification helper:

```json
{
  "verify:preview": "npm run build && npm run start:prod"
}
```

The implementation plan should decide whether preview verification is manual or automated with a short-lived process and HTTP checks.

## Testing Strategy

### Backend Unit Tests

Add tests for runtime config:

- development defaults are applied;
- production mode requires `DATABASE_URL`;
- invalid `API_PORT` is rejected;
- static serving defaults by mode are correct;
- secrets are not included in formatted error output.

Add tests for health/readiness:

- `/api/health` returns liveness;
- `/api/health/live` returns liveness;
- `/api/health/ready` returns 200 when database check succeeds;
- `/api/health/ready` returns 503 when database check fails.

Add tests for OpenAPI:

- `docs/api/openapi.yaml` exists;
- required v0.0.6 health paths exist;
- representative core paths exist.

### E2E Tests

Keep existing Playwright coverage:

- v0.0.5 daily workflow;
- v0.0.4 governance workflow;
- v0.0.3 planning/adoption workflow;
- responsive overflow checks.

Add production preview smoke if practical:

- build artifacts;
- start `npm run start:prod` on an alternate port;
- request `/api/health/ready`;
- request `/my-work`;
- request a deep link such as `/work-items/new`;
- confirm both return successful responses.

If automated preview smoke is too brittle for this sprint, document manual verification in the implementation plan and run it during finalization.

### Verification Commands

Expected final verification:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run preview
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
npm audit --omit=dev --audit-level=low
git diff --check
```

The implementation plan should convert long-running preview verification into deterministic steps so finalization does not leave a server process running.

## Migration And Data

No schema migration is expected.

No seed data change is expected unless documentation or preview smoke needs a specific record. Existing v0.0.5 seed data already supports:

- My Work;
- workspace discovery;
- saved views;
- quick create;
- governance;
- planning;
- board movement;
- comments;
- archived-project read-only paths.

## Security And Safety

- Do not introduce production authentication in v0.0.6.
- Local actor headers remain development scaffolding.
- Documentation must explicitly warn against exposing production preview to the public internet as an authenticated product.
- Readiness failure responses must not leak database URLs, hostnames beyond generic check names, credentials, or raw driver errors.
- Config validation should print variable names and human-readable issues, not secret values.
- `db:reset` safety guard remains in place and should be documented prominently.

## Cloud Mapping

v0.0.6 should make cloud deployment easier to reason about, not implement it.

Mapping:

- Angular `dist` -> S3 bucket.
- CloudFront -> static cache and SPA fallback.
- `/api/*` behavior -> API Gateway.
- endpoint handlers -> future Lambda adapter.
- runtime config validation -> Lambda environment variable validation.
- Postgres connection -> managed Postgres plus connection strategy.
- readiness endpoint -> synthetic canary or container/load-balancer check if later running as a service.

Deferred:

- API Gateway event adapter;
- Lambda deployment package;
- CDK/Terraform/SAM templates;
- RDS Proxy or equivalent;
- CloudFront functions for SPA fallback.

## Release Documentation

Finalization should update:

- `README.md`;
- `site/index.html`;
- `docs/v0.0.6/implementation-plan.md`;
- `docs/v0.0.6/jawstack-extraction-notes.md`;
- package versions to `0.0.6` if release/tagging is in scope.

## Open Questions

1. Should static serving be implemented inside `createExpressApp` or in a separate preview app wrapper?
2. Should `CORS_ORIGIN` be disabled in production preview by default, or kept as same-origin-safe no-op behavior?
3. Should OpenAPI be served by the API, or only checked into docs?
4. Should production preview smoke be automated in Playwright, in a shell script, or documented as manual final verification?
5. Should readiness use `pg.Pool` directly or Drizzle's DB instance?

## Recommended Decisions

- Implement static serving inside the Express adapter behind explicit `staticAssets` options.
- Keep `CORS_ORIGIN` development default, but allow production preview to run same-origin without relying on CORS.
- Keep OpenAPI checked into docs only for v0.0.6; serving raw YAML can be deferred.
- Add a small Node-based preview smoke script only if implementation time allows; otherwise document and execute manual preview checks in finalization.
- Use `pg.Pool` directly for readiness because connectivity is an infrastructure concern and does not need repository abstractions.
