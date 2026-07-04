# Worktrail

Worktrail is a project management reference app. The v0.0.2 release is a local-first Angular + TypeScript API + Postgres application that can later move toward an S3/CloudFront frontend and API Gateway/Lambda backend.

## Repository Layout

```text
apps/
  api/      TypeScript Node API with a local Express adapter
  web/      Angular SPA
packages/
  contracts/ Shared DTO and API contract types
docs/
  v0.0.1/  MVP PRD, technical design, implementation plan, and extraction notes
  v0.0.2/  Adoption sprint PRD, technical design, implementation plan, and extraction notes
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
- project labels, comments, deleted-comment tombstones, and activity events.

Use the `Acting as` selector in the top bar to switch the local placeholder actor. This is intentionally local-only behavior and is not production authentication.

Suggested v0.0.2 walkthrough:

1. Open Projects.
2. Open the Worktrail App project.
3. Review the project key, status counts, recently updated work, and activity.
4. Open Settings, create a project label, and review label activity.
5. Create a work item, assign the new label, and note the generated display key such as `WT-6`.
6. Open the board and drag the card through valid workflow columns. Status menus remain available as a fallback.
7. Open the work item detail page, update fields, add and edit a comment, delete a comment, and review activity.
8. Open the archived project to confirm read-only project/work item behavior.

## v0.0.2 Capabilities

- Project keys and immutable work item display keys.
- Project settings for metadata, archive/reactivate, and label administration.
- Work item list filters, create flow with labels, detail editing, status transitions, and board movement.
- Angular CDK drag/drop board interaction backed by server-side workflow validation.
- Comment add/edit/delete with role-aware UI affordances and deleted-comment tombstones.
- Project, label, work item, and comment lifecycle activity.
- Archived projects remain readable and block work item, label, comment, and transition writes.

## v0.0.2 Limitations

- Authentication is represented by local request headers and the top-bar actor selector.
- Permissions are useful for exercising local policy paths, but they are not production authentication.
- Custom workflows, persisted board ordering, file attachments, notifications, imports, and production auth are intentionally out of scope.
- The local Express adapter is the only runtime adapter in v0.0.2, though endpoint handlers are structured so a Lambda/API Gateway adapter can be added later.
- AWS deployment assets are not included yet; the Angular static build and transport-neutral handlers preserve that path.

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
