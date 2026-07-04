# Worktrail

Worktrail is a project management reference app. The v0.0.1 MVP is being built as a local-first Angular + TypeScript API + Postgres application that can later move toward an S3/CloudFront frontend and API Gateway/Lambda backend.

## Repository Layout

```text
apps/
  api/      TypeScript Node API with a local Express adapter
  web/      Angular SPA
packages/
  contracts/ Shared DTO and API contract types
docs/
  v0.0.1/  PRD, technical design, and implementation plan
```

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- Docker, for the local Postgres container
- Playwright browser dependencies for end-to-end smoke tests

## Local Setup

Install dependencies:

```sh
npm install
```

Install the Playwright Chromium browser used by the e2e smoke test:

```sh
npx playwright install chromium
```

Start local Postgres:

```sh
npm run db:start
```

Apply migrations and seed demo data:

```sh
npm run db:migrate
npm run db:seed
```

Start the API and web app together:

```sh
npm run dev
```

Or run them separately:

```sh
npm run dev:api
npm run dev:web
```

Local services:

- Web: <http://localhost:4200>
- API: <http://localhost:3000>
- API health: <http://localhost:3000/api/health>
- Postgres: `localhost:5432`

## Verification

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`npm run test:e2e` starts the local API and Angular dev server through Playwright. By default it also runs:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
```

That keeps the smoke test deterministic, but it means the local `public` schema for the configured database is dropped and recreated. Set `WORKTRAIL_E2E_SKIP_DB_RESET=true` only when you intentionally want to run the smoke test against an already prepared local database.

## Public Site

The static GitHub Pages site lives in `site/`. The Pages workflow publishes that directory when changes land on `main`.

## Demo Walkthrough

After migrating and seeding the database, open <http://localhost:4200>.

Seeded data includes:

- one workspace;
- three members: owner, maintainer, and contributor;
- two active projects and one archived project;
- work items across every status;
- labels, comments, and activity events.

Use the `Acting as` selector in the top bar to switch the local placeholder actor. This is intentionally local-only behavior and is not production authentication.

Suggested MVP walkthrough:

1. Open Projects.
2. Open the Worktrail App project.
3. Review project status counts and recently updated work.
4. Open the work item list and filter by status or assignee.
5. Open the board and move an item with the status menu.
6. Open a work item detail page, update fields, add a comment, and review activity.

## v0.0.1 Limitations

- Authentication is represented by local request headers and the top-bar actor selector.
- Labels are project-scoped and can be assigned from existing seed labels; full label administration is not implemented.
- Board movement uses status menus instead of drag and drop.
- Comment editing/deletion, file attachments, notifications, and production auth are intentionally out of scope.
- The local Express adapter is the only runtime adapter in v0.0.1, though endpoint handlers are structured so a Lambda/API Gateway adapter can be added later.

## Database Status

Phase 2 adds the initial Postgres schema, Drizzle migration, and deterministic demo seed data.

Useful database commands:

```sh
npm run db:generate  # generate a migration from the Drizzle schema
npm run db:migrate   # apply committed migrations
npm run db:seed      # upsert deterministic demo data
npm run db:reset     # drop and recreate the local public schema
```

`npm run db:reset` refuses to run against non-local database hosts unless `WORKTRAIL_ALLOW_DATABASE_RESET=true` is set.

The default development database URL is documented in [.env.example](.env.example).
