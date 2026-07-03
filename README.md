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

## Local Setup

Install dependencies:

```sh
npm install
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
npm run build
```

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
