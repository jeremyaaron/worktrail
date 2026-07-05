# Worktrail v0.0.1 Technical Design

## Overview

Worktrail v0.0.1 is a local-first project management reference app with a cloud-ready architecture. The app should run locally from a clean checkout, persist real data, and provide the core project/work item/comment/activity workflows defined in the PRD.

The design uses Angular for the frontend and a TypeScript Node.js backend. The frontend should be buildable as static assets suitable for a future S3 and CloudFront deployment. The backend should keep application use cases independent from HTTP framework details so the same handlers can be exposed through a local server during MVP development and adapted to AWS Lambda behind API Gateway later.

Recommended v0.0.1 stack:

- Frontend: Angular, TypeScript, Angular Router, Angular reactive forms, Angular HttpClient.
- Backend: Node.js, TypeScript, transport-neutral endpoint handlers, local Express adapter.
- Database: PostgreSQL.
- Database access: Drizzle ORM with SQL migrations.
- Tests: Vitest for backend/domain tests, Angular test tooling for frontend unit tests, Playwright for a focused end-to-end smoke path if setup stays light.
- Local infrastructure: local Postgres or Docker Compose Postgres.

## Design Goals

- Keep the frontend deployable as static assets.
- Keep backend use cases independent from Express, Lambda, and API Gateway.
- Use Postgres locally to avoid a later SQLite-to-Postgres migration.
- Model activity as structured product data, not only rendered timeline text.
- Centralize workflow and permission decisions in application services.
- Keep the MVP setup straightforward for local development.
- Use explicit resource boundaries that can later inform `jawstack` extraction.
- Avoid overbuilding enterprise infrastructure before the core workflows exist.

## Non-Goals

- Deploying to AWS in v0.0.1.
- Implementing production authentication.
- Implementing multi-tenant production isolation.
- Building a generic framework or `jawstack` dependency.
- Supporting multiple database engines in the MVP.
- Implementing real-time collaboration or push updates.
- Adding background workers unless activity/outbox implementation requires a small local placeholder.

## Repository Structure

Use a workspace-style repository so frontend, backend, and shared code can evolve independently while staying easy to run.

Recommended structure:

```text
pm-reference/
  apps/
    web/
      src/
        app/
        environments/
      angular.json
      project.json or package metadata
    api/
      src/
        adapters/
          express/
          lambda/        # optional placeholder until cloud deployment work starts
        db/
        domain/
        endpoints/
        repositories/
        services/
        validation/
        main.ts
  packages/
    contracts/
      src/
        api/
        domain/
  docs/
    v0.0.1/
      prd.md
      technical-design.md
```

`packages/contracts` should contain shared TypeScript types and validation schemas only when they are genuinely shared by Angular and the API. It should not become a dumping ground for server internals.

Use npm workspaces unless implementation uncovers a concrete need for pnpm. The repository is a reference app, so fewer tool prerequisites are preferable.

## Frontend Design

### Angular App

The Angular app should be a conventional single-page app that talks to the API over HTTP.

Recommended Angular architecture:

```text
apps/web/src/app/
  core/
    api/
    auth/
    layout/
  features/
    projects/
      project-list/
      project-home/
    work-items/
      work-item-list/
      work-item-board/
      work-item-detail/
      work-item-create/
      work-item-form/
    members/
  shared/
    components/
    models/
    pipes/
```

Use standalone components unless the selected Angular version or tooling makes NgModules materially simpler. Use lazy-loaded routes at feature boundaries where natural:

```text
/projects
/projects/:projectId
/projects/:projectId/items
/projects/:projectId/board
/projects/:projectId/items/new
/projects/:projectId/items/:workItemId
```

### State Management

Do not introduce a global state management library for v0.0.1 unless Angular implementation pressure proves it is needed.

Recommended pattern:

- feature services own API calls and small local view state;
- route resolvers or component initialization load server data;
- components use signals or observables consistently based on the Angular version selected during implementation;
- form state stays local to form components;
- list filters are represented in URL query parameters where useful.

The most important MVP state is server-owned. The frontend should refetch after mutations unless an optimistic update is small and obvious.

### UI Approach

The UI should be dense, calm, and work-focused.

Recommended component patterns:

- app shell with project navigation and current-user selector;
- project list as a table or dense list;
- project home with status counts and recent updates;
- work item list as a filterable table;
- board as status columns with compact cards;
- detail page with main content and timeline/comment side or lower panel depending on viewport;
- modals or routed pages for create/edit only where they keep navigation clear.

Drag-and-drop should not be included in the first implementation unless it is nearly free. A status menu on board cards satisfies the MVP and avoids accessibility and touch complexity.

### Static Hosting Path

The Angular production build should emit static files that can later be served from S3 behind CloudFront.

Implications:

- use client-side routing with a future CloudFront fallback to `index.html`;
- keep API base URL configurable by environment;
- avoid server-side rendering in v0.0.1;
- avoid relying on same-process frontend/backend behavior;
- handle API errors explicitly in the UI.

Local development can proxy `/api` to the backend server, but production configuration should support an absolute API base URL.

## Backend Design

### Runtime

Use TypeScript on Node.js. The local API server should use Express for approachability, but Express must be an adapter around transport-neutral endpoint handlers.

Recommended backend layers:

```text
HTTP transport adapter
  -> endpoint handler
    -> request validation
    -> application service/use case
      -> authorization/workflow rules
      -> repositories
      -> activity writer
    -> response mapping
```

Only the transport adapter should know about Express request and response objects. Lambda/API Gateway support can later add a second adapter that maps API Gateway events into the same endpoint handler shape.

### Handler Contract

Define a small internal handler contract:

```ts
export interface AppRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | undefined>;
  body: unknown;
  actor: ActorContext;
}

export interface AppResponse<T = unknown> {
  status: number;
  body?: T;
  headers?: Record<string, string>;
}

export type EndpointHandler = (request: AppRequest) => Promise<AppResponse>;
```

The Express adapter should:

- parse JSON;
- select a local actor;
- map Express params/query/body into `AppRequest`;
- call the endpoint handler;
- serialize the `AppResponse`.

A future Lambda adapter should:

- map API Gateway route params/query/body into `AppRequest`;
- construct actor context from JWT claims or authorizer context;
- serialize `AppResponse` to API Gateway format.

### Application Services

Use application services for command/query behavior. These services should be testable without HTTP.

Recommended services:

- `ProjectService`
- `WorkItemService`
- `CommentService`
- `ActivityService`
- `MemberService`

Services should receive dependencies explicitly:

```ts
export interface ServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock: Clock;
  idGenerator: IdGenerator;
}
```

Write operations should run in a database transaction when they update a primary resource and create activity records.

### Validation

Use schema validation at endpoint boundaries. Zod is a good MVP choice because it is lightweight, TypeScript-friendly, and can be shared with the frontend where useful.

Validation responsibilities:

- parse request params and bodies;
- reject invalid enum values;
- enforce required fields;
- normalize optional empty strings to `null` where appropriate;
- return structured validation errors.

Do not rely on frontend validation for correctness.

### Error Model

Use typed application errors and map them to HTTP responses in one place.

Recommended error categories:

- `ValidationError` -> `400`;
- `UnauthorizedError` -> `401`;
- `ForbiddenError` -> `403`;
- `NotFoundError` -> `404`;
- `ConflictError` -> `409`;
- `WorkflowTransitionError` -> `409`;
- unexpected errors -> `500`.

Response shape:

```ts
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

## Persistence Decision

Use PostgreSQL for v0.0.1.

SQLite is sufficient for the narrow MVP, but expected future features make Postgres the better reference-app default:

- JSONB activity metadata and queryable event details;
- full-text search for work item titles/descriptions and future global search;
- partial and expression indexes for active/open work filters;
- stronger concurrent write behavior for multi-user workflows;
- row-level locking for future workflow, assignment, and ordering operations;
- richer constraints and migration parity with managed cloud Postgres;
- easier path to future audit/event outbox patterns;
- less migration churn when moving from local to hosted infrastructure.

The local setup cost is acceptable because Postgres can run from an existing local install or Docker Compose.

### Database Access

Use Drizzle ORM for schema definitions, typed queries, and migrations.

Reasons:

- TypeScript-first;
- close to SQL for a reference app where relational design matters;
- migrations can be committed and reviewed;
- does not hide Postgres-specific capabilities when they become useful;
- lighter runtime model than larger ORM stacks.

Raw SQL is acceptable for queries where it is clearer than ORM composition, especially aggregate project summaries and filtered work item search.

## Data Model

Use UUID primary keys for MVP simplicity and future distributed compatibility. Use `timestamptz` for timestamps.

### Tables

```text
workspaces
  id uuid primary key
  name text not null
  created_at timestamptz not null
  updated_at timestamptz not null

members
  id uuid primary key
  workspace_id uuid not null references workspaces(id)
  name text not null
  email text not null
  role text not null
  is_active boolean not null default true
  created_at timestamptz not null
  updated_at timestamptz not null

projects
  id uuid primary key
  workspace_id uuid not null references workspaces(id)
  name text not null
  description text not null default ''
  status text not null
  created_at timestamptz not null
  updated_at timestamptz not null

work_items
  id uuid primary key
  workspace_id uuid not null references workspaces(id)
  project_id uuid not null references projects(id)
  title text not null
  description text not null default ''
  type text not null
  status text not null
  priority text not null
  assignee_id uuid references members(id)
  reporter_id uuid not null references members(id)
  due_date date
  estimate_points integer
  created_at timestamptz not null
  updated_at timestamptz not null

labels
  id uuid primary key
  workspace_id uuid not null references workspaces(id)
  project_id uuid references projects(id)
  name text not null
  color text
  created_at timestamptz not null
  updated_at timestamptz not null

work_item_labels
  work_item_id uuid not null references work_items(id) on delete cascade
  label_id uuid not null references labels(id)
  primary key (work_item_id, label_id)

comments
  id uuid primary key
  workspace_id uuid not null references workspaces(id)
  project_id uuid not null references projects(id)
  work_item_id uuid not null references work_items(id) on delete cascade
  author_id uuid not null references members(id)
  body text not null
  created_at timestamptz not null
  updated_at timestamptz not null

activity_events
  id uuid primary key
  workspace_id uuid not null references workspaces(id)
  project_id uuid not null references projects(id)
  work_item_id uuid references work_items(id) on delete cascade
  actor_id uuid not null references members(id)
  event_type text not null
  summary text not null
  previous_value jsonb
  new_value jsonb
  metadata jsonb not null default '{}'::jsonb
  created_at timestamptz not null
```

### Enum Values

Represent enum-like fields as text with application-level constants and database `check` constraints.

Initial values:

```text
member.role: owner, maintainer, contributor
project.status: active, archived
work_item.type: task, bug, story, chore
work_item.status: backlog, ready, in_progress, blocked, done, canceled
work_item.priority: low, medium, high, urgent
activity_event.event_type:
  work_item.created
  work_item.title_changed
  work_item.description_changed
  work_item.status_changed
  work_item.assignee_changed
  work_item.priority_changed
  work_item.label_added
  work_item.label_removed
  comment.added
```

Use check constraints instead of Postgres enum types for v0.0.1 because application enums are likely to evolve during early product development.

### Indexes

Initial indexes:

```text
members(workspace_id)
members(workspace_id, email) unique
projects(workspace_id, status)
work_items(project_id, status)
work_items(project_id, assignee_id)
work_items(project_id, type)
work_items(project_id, priority)
work_items(project_id, updated_at desc)
work_items(project_id, title)
labels(workspace_id, name)
work_item_labels(label_id)
comments(work_item_id, created_at)
activity_events(work_item_id, created_at desc)
activity_events(project_id, created_at desc)
```

Full-text search can wait until v0.0.1 filtering proves the shape. The initial title search can use a simple case-insensitive `ILIKE` query. Add a `tsvector` generated column or expression index later when search becomes a product focus.

### Human-Friendly Work Item Keys

Defer human-friendly keys such as `APP-123` in v0.0.1. Use UUIDs internally and show compact titles/statuses in the UI.

Reason:

- project-key allocation introduces sequence and uniqueness rules;
- changing keys after project rename is a product decision;
- it is not required for the MVP workflows.

The schema can add `project_key` and `number` later if the product needs stable user-facing identifiers.

### Labels

Make labels project-scoped by default while retaining `workspace_id` on the table.

Reason:

- project-scoped labels match the MVP project context;
- workspace id keeps future cross-project label queries easy;
- `project_id null` can later represent workspace-global labels if needed.

## Workflow And Authorization

### Actor Context

Every write operation should receive:

```ts
export interface ActorContext {
  memberId: string;
  workspaceId: string;
  role: "owner" | "maintainer" | "contributor";
}
```

For local development, the Express adapter can select the actor from:

- a development header such as `x-worktrail-member-id`;
- a query/debug current-user selector in the UI;
- fallback seed owner when no actor is provided.

The fallback must be clearly marked as local-only.

### Workflow Rules

Centralize transition rules in a domain module:

```ts
export function canTransitionWorkItem(input: {
  from: WorkItemStatus;
  to: WorkItemStatus;
  actorRole: MemberRole;
}): boolean;
```

Rules:

- no-op transitions are allowed;
- open statuses can move to `blocked`;
- `blocked` can move to `ready` or `in_progress`;
- normal forward movement follows `backlog -> ready -> in_progress -> done`;
- `canceled` can be reached from any non-terminal status;
- `done` and `canceled` are terminal for contributors;
- owners and maintainers can reopen terminal items to `ready` or `in_progress`.

These rules should be tested directly at the domain level and indirectly through service tests.

### Permission Rules

MVP permissions:

- owner: all MVP operations;
- maintainer: project and work item operations, including reopen and archive;
- contributor: create work items, comment, assign self, update non-terminal assigned work items.

The first implementation can enforce only the role-sensitive paths required by the PRD if full contributor restrictions slow the MVP. Reopen and archive rules should be enforced because they exercise the authorization boundary.

## API Design

Use REST-style routes for v0.0.1. They are easy for Angular to consume and map cleanly to API Gateway routes later.

All routes are under `/api`.

### Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
GET    /api/projects/:projectId/summary
```

### Work Items

```text
GET    /api/projects/:projectId/work-items
POST   /api/projects/:projectId/work-items
GET    /api/work-items/:workItemId
PATCH  /api/work-items/:workItemId
POST   /api/work-items/:workItemId/transitions
```

List query parameters:

```text
status
assigneeId
type
labelId
priority
search
sort
```

Use `POST /transitions` for explicit status transitions so workflow-specific behavior is not hidden inside generic patch semantics. Simple field edits can still use `PATCH`.

### Comments

```text
GET    /api/work-items/:workItemId/comments
POST   /api/work-items/:workItemId/comments
```

The detail endpoint may include comments to reduce round trips. Separate routes are still useful for focused reloads and future pagination.

### Activity

```text
GET    /api/work-items/:workItemId/activity
GET    /api/projects/:projectId/activity
```

Project activity is optional for the MVP UI, but adding the endpoint is cheap if the repository query already exists.

### Members And Labels

```text
GET    /api/members
GET    /api/projects/:projectId/labels
POST   /api/projects/:projectId/labels
```

Label creation can be implicit during work item update if the UI supports free-form labels. Prefer explicit label creation for v0.0.1 if it keeps validation simpler.

## Request And Response Contracts

Keep API response shapes stable and explicit. Avoid returning raw database rows.

Example work item summary:

```ts
export interface WorkItemListItemDto {
  id: string;
  projectId: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assignee: MemberSummaryDto | null;
  reporter: MemberSummaryDto;
  labels: LabelDto[];
  updatedAt: string;
}
```

Example detail response:

```ts
export interface WorkItemDetailDto extends WorkItemListItemDto {
  description: string;
  createdAt: string;
  comments: CommentDto[];
  activity: ActivityEventDto[];
}
```

Use ISO 8601 strings for timestamps at the API boundary.

## Activity Recording

Activity writing should happen inside the same transaction as the change it describes.

Recommended flow for work item update:

1. Load current work item.
2. Authorize actor.
3. Validate workflow transition if status changes.
4. Apply update.
5. Compare tracked fields.
6. Insert one activity event per meaningful changed field.
7. Return updated detail or summary.

Do not record activity for timestamp-only changes or unchanged submitted values.

For comments:

1. Insert comment.
2. Insert `comment.added` activity event with `metadata.commentId`.
3. Return comment and optionally refreshed activity.

## Local Development

Required scripts should be finalized in the implementation plan, but the intended experience is:

```sh
npm install
npm run db:start
npm run db:migrate
npm run db:seed
npm run dev
npm test
```

`npm run dev` should start both Angular and the API locally, either through a small orchestrator such as `concurrently` or through separate documented commands.

Recommended local ports:

```text
Angular dev server: http://localhost:4200
API server: http://localhost:3000
Postgres: localhost:5432
```

Use environment variables for API and database configuration:

```text
DATABASE_URL=postgres://worktrail:worktrail@localhost:5432/worktrail
API_PORT=3000
WEB_API_BASE_URL=http://localhost:3000/api
```

Do not commit local secrets. MVP local credentials for Docker Compose are acceptable because they are development-only.

## Seed Data

Seed data should create:

- one workspace;
- at least three members covering owner, maintainer, and contributor;
- two active projects and one archived project;
- work items across every status;
- at least one item with multiple labels;
- at least one item with comments;
- activity events for created, status changed, assignee changed, priority changed, label changed, and comment added.

Seed data should be deterministic enough for screenshots and tests.

## Testing Strategy

### Backend

Use Vitest for domain and service tests.

Required backend coverage:

- workflow transition matrix;
- project creation;
- work item creation;
- work item status transition;
- invalid transition rejection;
- terminal reopen by maintainer or owner;
- assignment update;
- comment creation;
- activity recording;
- list filtering by status and assignee.

Repository tests should run against a test Postgres database. The implementation plan should decide whether to use Docker Compose, a dedicated local database, or testcontainers. Keep the first version simple and documented.

### Frontend

Frontend tests should cover:

- project list rendering;
- work item list filters;
- create work item form validation;
- board status update interaction;
- detail page comment submission.

Use Angular component tests where they are faster than full browser tests.

### End-to-End

Add Playwright only if setup remains small. A useful MVP e2e smoke path:

1. open projects;
2. open a project;
3. create a work item;
4. move it to in progress;
5. add a comment;
6. verify activity appears.

This single path gives more confidence than many shallow UI tests.

## Build And Deployment Path

### MVP Local Build

Local build should produce:

- Angular static assets;
- compiled API JavaScript;
- database migration files.

Recommended scripts:

```sh
npm run build
npm run build:web
npm run build:api
```

### Future AWS Shape

The architecture should make this future deployment plausible:

```text
Angular static assets
  -> S3
  -> CloudFront

API Gateway
  -> Lambda adapter
  -> endpoint handlers
  -> services
  -> repositories
  -> RDS Postgres or Aurora Postgres
```

Future production additions:

- Cognito or another identity provider;
- JWT authorizer or Lambda authorizer;
- secrets manager for database credentials;
- migration runner in CI/CD;
- structured logging and tracing;
- alarms and dashboards;
- private networking for database access.

None of those are required for v0.0.1.

## Observability

MVP observability can stay simple:

- request logging in local API server;
- consistent error logging for unexpected failures;
- service-level errors include stable codes;
- activity events handle product history, not infrastructure logs.

Do not introduce OpenTelemetry in v0.0.1 unless it is nearly free from the selected stack.

## Security Notes

v0.0.1 is local-only and uses placeholder auth, but it should still avoid bad habits:

- validate all request bodies;
- parameterize SQL through Drizzle or query bindings;
- avoid leaking stack traces in API responses;
- keep CORS limited to the local Angular origin during development;
- avoid committing real secrets;
- mark local actor fallback as non-production behavior.

## JawStack Extraction Notes

During implementation, capture evidence for possible future abstractions:

- resource definitions and enum metadata;
- CRUD endpoint handler shapes;
- list filter/sort/query parameter conventions;
- workflow transition rule definitions;
- actor-aware command handling;
- activity event recording patterns;
- generated list/detail/form opportunities;
- transport adapter boundary;
- repository and transaction patterns.

Do not extract these into `jawstack` during v0.0.1. The goal is to build the app and observe the repeated pressure points.

## Decisions

- Product name: Worktrail.
- Frontend: Angular SPA.
- Frontend deployment target: future S3/CloudFront static hosting.
- Package management: npm workspaces.
- Backend language: TypeScript.
- Local backend adapter: Express.
- Future cloud backend adapter: Lambda/API Gateway.
- Database: PostgreSQL.
- Database access: Drizzle ORM and migrations.
- Auth: local actor placeholder with explicit actor context.
- Work item keys: UUIDs only in v0.0.1; human-friendly keys deferred.
- Labels: project-scoped for v0.0.1, with workspace id retained.
- Optional due date and estimate: include in schema if low-cost; UI can expose them only if it does not distract from core workflows.
- Playwright: include one focused end-to-end smoke path after the core app works.
- Lambda adapter: do not implement in v0.0.1; preserve the handler contract so it can be added later.
- Project activity: add backend support if it falls naturally out of activity queries, but do not make project activity UI a release blocker.
