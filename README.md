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

Phase 1 adds the local Postgres container only. Migrations, schema, reset, and seed commands are part of Phase 2.

The default development database URL is documented in [.env.example](.env.example).
