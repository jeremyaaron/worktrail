# Worktrail v0.0.6 Operations Runbook

This runbook describes how to run, inspect, reset, and troubleshoot Worktrail in local
development and production preview modes.

Worktrail v0.0.6 is still a local reference application. The production preview path
uses built artifacts and production-mode runtime validation, but it is not a secure
internet-facing deployment.

## Operating Boundaries

- Local development runs the Angular dev server and API dev server as separate processes.
- Production preview runs compiled API code and serves the built Angular app from Express.
- Postgres is required in both modes.
- The API uses local actor headers and seeded-member fallback as development scaffolding.
- Local actor selection is not production authentication.
- Do not expose production preview to the public internet as an authenticated product.

## Runtime Modes

### Development

Development is the default when `NODE_ENV` is unset or set to `development`.

Behavior:

- `DATABASE_URL` defaults to `postgres://worktrail:worktrail@localhost:5432/worktrail`.
- `API_PORT` defaults to `3000`.
- `CORS_ORIGIN` defaults to `http://localhost:4200`.
- `WORKTRAIL_SERVE_STATIC` defaults to `false`.
- Angular is served by `ng serve` on port `4200`.
- Browser API calls use the Angular proxy to reach `http://localhost:3000/api`.

### Production Preview

Production preview uses `NODE_ENV=production`.

Behavior:

- `DATABASE_URL` is required.
- `API_PORT` defaults to `3000` unless overridden.
- `WORKTRAIL_SERVE_STATIC` defaults to `true`.
- `WORKTRAIL_STATIC_ASSETS_PATH` defaults to the built Angular browser output.
- Express serves `/api/*` routes and Angular static assets from the same origin.
- Non-API browser routes fall back to `index.html` for SPA deep links.

## Environment Variables

| Variable | Development default | Production preview | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | `production` | Must be `development`, `test`, or `production`. |
| `API_PORT` | `3000` | `3000` | Must be an integer from 1 to 65535. |
| `DATABASE_URL` | `postgres://worktrail:worktrail@localhost:5432/worktrail` | Required | Must use `postgres://` or `postgresql://`. |
| `CORS_ORIGIN` | `http://localhost:4200` | Optional | Set to `false` when CORS should be disabled. |
| `WORKTRAIL_SERVE_STATIC` | `false` | `true` | Enables Express static serving for built Angular assets. |
| `WORKTRAIL_STATIC_ASSETS_PATH` | Derived | Derived | Override when packaging or testing a different static path. |
| `WORKTRAIL_ALLOW_DATABASE_RESET` | Unset | Unset | Allows `db:reset` against non-local hosts. Dangerous. |
| `WORKTRAIL_E2E_SKIP_DB_RESET` | Unset | Unset | Test-only escape hatch. |
| `WORKTRAIL_E2E_SKIP_DB_RESTORE` | Unset | Unset | Test-only escape hatch. |

Use `.env.example` as the local environment template.

## Local Setup

Install dependencies:

```sh
npm install
```

Install the Playwright browser used by the smoke test:

```sh
npx playwright install chromium
```

Start local Postgres with Docker:

```sh
npm run db:start
```

If a local Postgres instance is already running on port `5432`, either use that instance
with the documented `worktrail` database/user or stop it before starting Docker Compose.

Apply migrations and seed deterministic demo data:

```sh
npm run db:migrate
npm run db:seed
```

Start the development API and Angular dev server:

```sh
npm run dev
```

Useful local URLs:

- Web: <http://localhost:4200>
- API: <http://localhost:3000>
- Liveness: <http://localhost:3000/api/health/live>
- Readiness: <http://localhost:3000/api/health/ready>

## Migration And Seed Flow

Generate migrations after schema changes:

```sh
npm run db:generate
```

Apply committed migrations:

```sh
npm run db:migrate
```

Seed deterministic demo data:

```sh
npm run db:seed
```

The seed command is idempotent for the deterministic records it owns. It is suitable for
returning the local demo workspace to a known baseline after ordinary local testing.

## Database Reset Safety

`npm run db:reset` drops objects from the configured database's local `public` schema and
drops the Drizzle migration schema. It is destructive.

Safe local reset:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
```

The reset command refuses to run against non-local database hosts unless this override is
set:

```sh
WORKTRAIL_ALLOW_DATABASE_RESET=true npm run db:reset
```

Only use that override for an intentionally disposable database. Never use it against a
shared, staging, or production database.

## Production Preview

Start from a migrated and seeded database.

Build all artifacts and start the production preview:

```sh
DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run preview
```

Equivalent explicit sequence:

```sh
npm run build
DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run start:prod
```

Use a different port if `3000` is already taken:

```sh
API_PORT=3106 DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run start:prod
```

Expected startup log includes:

- base API URL;
- runtime mode;
- static asset serving mode and path;
- liveness URL;
- readiness URL.

Stop preview with `Ctrl+C`. Confirm no preview process remains:

```sh
lsof -iTCP:3000 -sTCP:LISTEN -n -P
```

Use the port you selected if it was not `3000`.

## Health And Readiness Checks

Liveness verifies the API process is responding:

```sh
curl http://localhost:3000/api/health/live
```

Readiness verifies the API process can reach Postgres:

```sh
curl http://localhost:3000/api/health/ready
```

Compatibility liveness remains available:

```sh
curl http://localhost:3000/api/health
```

Expected readiness success:

```json
{"status":"ready","service":"worktrail-api","checks":{"database":"ok"},"checkedAt":"2026-07-05T00:00:00.000Z"}
```

Expected readiness failure is HTTP `503` with a safe structured error. It should not print
database URLs, credentials, or raw driver messages.

## Deep-Link Checks

Production preview should serve Angular routes directly and on refresh:

```sh
curl -I http://localhost:3000/my-work
curl -I http://localhost:3000/work-items/new
curl -I http://localhost:3000/projects/10000000-0000-4000-8000-000000000201/board
```

Each route should return `200` with `Content-Type: text/html`.

API paths should not be swallowed by the SPA fallback:

```sh
curl -i http://localhost:3000/api/unknown
```

Expected result is an API `404`, not Angular `index.html`.

## Local Actor Behavior

Development and production preview both support local actor selection through headers:

```text
x-worktrail-member-id
x-worktrail-workspace-id
x-worktrail-role
```

The API derives the effective role and active state from the member record for protected
routes. If actor headers are omitted, the API falls back to the seeded owner actor.

This is useful for local role-path testing. It is not authentication, authorization,
session management, or a deployable security model.

## Verification Commands

Routine local verification:

```sh
npm run typecheck
npm test
npm run build
```

Browser smoke test:

```sh
npm run test:e2e
```

The Playwright smoke test resets, migrates, and seeds the configured local database before
the run, then restores deterministic seed data after mutation-heavy checks.

Skip reset or restore only when deliberately inspecting an already prepared database:

```sh
WORKTRAIL_E2E_SKIP_DB_RESET=true npm run test:e2e
WORKTRAIL_E2E_SKIP_DB_RESTORE=true npm run test:e2e
```

## Troubleshooting

### Production Preview Fails With Missing `DATABASE_URL`

Production mode requires an explicit database URL:

```sh
DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run start:prod
```

### Readiness Returns `503`

Check that Postgres is running:

```sh
npm run db:logs
```

Or, for a local host installation, verify the database accepts connections with your
preferred Postgres client.

Then apply migrations:

```sh
npm run db:migrate
```

### Port `3000` Is Already In Use

Find the process:

```sh
lsof -iTCP:3000 -sTCP:LISTEN -n -P
```

Run preview on another port:

```sh
API_PORT=3106 DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run start:prod
```

### Static Assets Are Missing

Build the Angular app before starting preview:

```sh
npm run build
DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run start:prod
```

If using a custom static path, verify it contains `index.html`:

```sh
WORKTRAIL_STATIC_ASSETS_PATH=/absolute/path/to/browser DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail npm run start:prod
```

### Docker Postgres Cannot Start

If another Postgres instance already owns port `5432`, either stop that instance or use
the existing instance with a `worktrail` database and user.

Docker logs:

```sh
npm run db:logs
```

Stop Docker Postgres:

```sh
npm run db:stop
```

Remove Docker resources for this project:

```sh
npm run db:down
```

## Future Cloud Mapping

The v0.0.6 preview is deliberately not the final cloud topology. It establishes runtime
boundaries that can map cleanly to cloud infrastructure later:

- Angular build output -> S3 static website origin or private S3 behind CloudFront.
- SPA fallback -> CloudFront custom error response or function-based rewrite to `index.html`.
- Express API routes -> Lambda/API Gateway adapter or containerized Node service.
- Runtime config -> environment variables sourced from deployment configuration and secrets.
- `DATABASE_URL` -> managed Postgres connection string stored in a secrets manager.
- Readiness -> container/load-balancer check or synthetic canary for service deployments.
- Liveness -> process health check for service deployments.
- Migrations -> explicit deployment step or managed release job, not app startup side effects.
- Local actor headers -> replaced by real authentication, sessions/tokens, and server-side identity.

Deferred cloud work includes infrastructure templates, production authentication, managed
connection pooling, observability, backup/restore runbooks, and migration drift detection.
