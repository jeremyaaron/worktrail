# Worktrail

Worktrail is a project management reference app. The v0.0.3 release is a local-first Angular + TypeScript API + Postgres application that adds lightweight planning, durable board ordering, richer discovery, and a path toward an S3/CloudFront frontend with API Gateway/Lambda backend handlers.

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
  v0.0.3/  Planning sprint PRD, technical design, implementation plan, and extraction notes
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
npm audit --omit=dev --audit-level=low
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
- project milestones with due dates and lifecycle state;
- work items across every status with persisted board positions;
- project labels, comments, deleted-comment tombstones, and activity events.

Use the `Acting as` selector in the top bar to switch the local placeholder actor. This is intentionally local-only behavior and is not production authentication.

Suggested v0.0.3 walkthrough:

1. Open Projects.
2. Open the Worktrail App project.
3. Review the project key, status counts, recently updated work, and activity.
4. Open Planning and review milestone progress, overdue/due-soon work, blocked work, unassigned work, and stale work.
5. Create a milestone, then create a work item assigned to that milestone.
6. Use the work item list search and filters. Dropdown filters apply immediately, while search applies after a short debounce.
7. Open the board, drag cards within a column to set planning order, reload, and confirm the order persists.
8. Move a card through valid workflow columns with drag/drop or the status menu.
9. Open the work item detail page, update fields, change milestone assignment, add and edit a comment, delete a comment, and review activity.
10. Open the archived project to confirm read-only project, milestone, work item, label, comment, and transition behavior.

## v0.0.3 Capabilities

- Project keys and immutable work item display keys.
- Project settings for metadata, archive/reactivate, and label administration.
- Project-scoped milestones with due dates, archive/reactivate behavior, assignment on create/edit, and activity coverage.
- Planning dashboard with milestone progress, due-soon/overdue work, blocked work, unassigned work, stale work, and links back into filtered lists.
- Work item list search and filters for status, type, priority, assignee, label, and milestone.
- Persisted board ordering for same-status reorder and cross-status movement.
- Angular CDK drag/drop board interaction backed by server-side workflow validation.
- Comment add/edit/delete with role-aware UI affordances and deleted-comment tombstones.
- Project, milestone, label, work item, board movement, and comment lifecycle activity.
- Archived projects remain readable and block project, milestone, work item, label, comment, and transition writes.

## v0.0.3 Limitations

- Authentication is represented by local request headers and the top-bar actor selector.
- Permissions are useful for exercising local policy paths, but they are not production authentication.
- Custom workflows, file attachments, notifications, imports, and production auth are intentionally out of scope.
- The local Express adapter is the only runtime adapter in v0.0.3, though endpoint handlers are structured so a Lambda/API Gateway adapter can be added later.
- AWS deployment assets are not included yet; the Angular static build and transport-neutral handlers preserve that path.

## Database Status

The current schema includes project keys, scoped work item display keys, labels, milestones, comments, activity, due dates, and durable board positions.

Useful database commands:

```sh
npm run db:generate  # generate a migration from the Drizzle schema
npm run db:migrate   # apply committed migrations
npm run db:seed      # upsert deterministic demo data
npm run db:reset     # drop and recreate the local public schema
```

`npm run db:reset` refuses to run against non-local database hosts unless `WORKTRAIL_ALLOW_DATABASE_RESET=true` is set.

The default development database URL is documented in [.env.example](.env.example).
