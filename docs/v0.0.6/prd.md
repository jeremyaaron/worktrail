# Worktrail v0.0.6 PRD

## Summary

Worktrail v0.0.6 should make the application easier to run, inspect, package, and eventually deploy. v0.0.5 made Worktrail useful as a daily operating surface by adding My Work, cross-project discovery, saved views, quick work capture, and project navigation summaries. The next release should improve confidence that the app can grow from a local reference implementation into a credible deployable solution.

The v0.0.6 theme is:

> Make Worktrail operationally credible.

This sprint should add a production-like local runtime path, stricter runtime configuration, API contract documentation, health/readiness signals, and release/operator documentation. It should not attempt full AWS infrastructure yet. The goal is to close the gap between "runs locally with dev servers" and "can be packaged, inspected, and reasoned about like a real service."

## Context

Worktrail is both a product and a reference application. Each sprint should improve the product while exposing reusable implementation patterns that may later inform `jawstack` and one-click deployable reference solutions.

The current product has:

- Angular SPA frontend with lazy-loaded route components;
- TypeScript API with local Express adapter and transport-neutral endpoint handler structure;
- Postgres persistence through Drizzle migrations;
- deterministic seed data;
- My Work dashboard;
- cross-project work discovery;
- personal saved views;
- route-based quick work capture;
- project navigation summaries;
- workspace settings and member lifecycle administration;
- server-derived local actor roles backed by active workspace members;
- project settings, labels, milestones, planning dashboard, board, comments, and activity;
- archived-project write protection;
- Playwright smoke coverage across daily workflow, governance, planning, and responsiveness;
- static GitHub Pages product site.

The app is now useful enough that operational questions matter:

- How do I run a production-like build locally?
- How do I know the API is configured correctly?
- How do I know the database is reachable and migrated?
- How do downstream clients understand the API surface?
- How does a future cloud deployment map onto today's runtime boundaries?
- Which commands are safe in development but dangerous in production?

v0.0.6 should answer those questions without overreaching into production auth or hosted infrastructure.

## Problem

Worktrail is currently strongest as a development workflow. It can be started with local dev servers, tested through Playwright, and built into artifacts, but it does not yet provide a polished operational story.

Current gaps:

- There is no single production-like local runtime path for the built API and built Angular assets.
- Runtime configuration is still mostly implicit and not documented as a validated contract.
- Health checks are basic and do not distinguish process liveness from database readiness.
- API consumers have TypeScript contracts, but there is no human-readable or tool-readable HTTP API reference.
- Release verification is documented, but there is no operator-focused runbook for safe local production preview, migration, reset, seed, and troubleshooting.
- The future AWS path is conceptually preserved but not mapped into concrete runtime artifacts.
- Production safety rails around reset/seed/dev-only actor behavior are not obvious enough for a reference solution.

These gaps reduce adoptability. A reference app becomes more useful when a new evaluator can clone it, run it in a production-like mode, inspect the API, understand environment requirements, and see how the architecture would map to a cloud deployment.

## Goals

- Add a production-like local runtime path that serves built frontend and API artifacts without Angular dev server or `tsx watch`.
- Validate required runtime environment at process startup with clear error messages.
- Add API liveness and readiness endpoints that distinguish process health from database availability.
- Publish a minimal OpenAPI document for the implemented HTTP API.
- Add docs for environment variables, production preview, migrations, seed/reset safety, and troubleshooting.
- Preserve the Angular static deployment path and transport-neutral backend handler shape.
- Keep the local actor selector clearly marked as development scaffolding.
- Keep all v0.0.5 product workflows intact.
- Add tests for config validation, readiness behavior, and API documentation availability.
- Capture extraction notes for runtime configuration, health/readiness, production preview, and contract documentation.

## Non-Goals

- Full AWS deployment.
- CDK, Terraform, CloudFormation, Pulumi, or SST infrastructure.
- Lambda/API Gateway adapter implementation.
- Production authentication.
- OAuth, SSO, MFA, invitations, passwords, sessions, or identity-provider integration.
- TLS termination.
- Managed database provisioning.
- Observability backends, tracing, metrics stores, or log aggregation.
- Kubernetes.
- Multi-tenant production hardening.
- Blue/green deploys, rolling deploys, or release orchestration.
- Background workers or job queues.
- Email, notifications, webhooks, or integrations.
- Replacing Postgres.
- Replacing Express as the local runtime adapter.

## Target Users

Primary:

- Developers evaluating Worktrail as a serious reference app.
- Teams wanting to run Worktrail locally in a production-like mode.
- Future maintainers who need safer setup, verification, and troubleshooting paths.
- The project owner evaluating patterns for later `jawstack` extraction.

Secondary:

- Engineers comparing local dev, production preview, and future cloud deployment boundaries.
- Teams interested in one-click deployable reference solutions but not ready for full hosted infrastructure.
- API consumers who need a readable HTTP contract beyond TypeScript DTOs.

## Positioning

Worktrail should remain a focused project tracker, not an infrastructure demo. v0.0.6 should make the operational layer boring, explicit, and inspectable.

Suggested v0.0.6 positioning:

> A focused project tracker that can be developed locally, run from built artifacts, inspected through documented APIs, and prepared for cloud packaging.

## Product Principles

- Local development remains fast.
- Production preview should use built artifacts.
- Runtime configuration should fail early and clearly.
- Dangerous database commands must stay visibly development-oriented.
- Health endpoints should support humans and automation.
- API documentation should describe the real implemented HTTP surface, not an aspirational future surface.
- Operational documentation should be procedural and copy-paste friendly.
- Cloud readiness should be expressed through boundaries and artifacts before infrastructure templates.
- Do not weaken the product to serve platform work; existing workflows must remain intact.

## Scope

### 1. Production-Like Local Runtime

Add a way to run Worktrail from built artifacts without relying on Angular dev server or TypeScript watch mode.

Required behavior:

- Add a root command such as `npm run start:prod` or `npm run preview`.
- Build contracts, API, and web artifacts before production preview when needed.
- Serve the built Angular app as static assets.
- Run the compiled API from `dist`.
- Proxy or route API requests consistently in production preview.
- Keep development commands unchanged.
- Document ports and environment variables.

Implementation options:

- Single Node process where Express serves API routes and static Angular assets.
- Two-process preview where the compiled API serves API routes and a static file server serves Angular assets.
- Docker Compose production preview if the technical design finds it worthwhile for this sprint.

Acceptance criteria:

- A fresh clone can run the production preview using documented commands after install, migrate, and seed.
- `/my-work`, `/work-items`, `/projects`, and direct deep links load correctly from the built SPA.
- API requests work from the built frontend.
- Refreshing a lazy-loaded frontend route does not 404.
- Development commands still behave as before.

### 2. Runtime Configuration Validation

Make runtime configuration explicit and validated.

Required behavior:

- Define the supported environment variables for API runtime, web preview/runtime, database, CORS, local actor behavior, and safety rails.
- Validate required variables at API startup.
- Provide clear error messages for missing, malformed, or unsafe configuration.
- Preserve safe local defaults only for development mode.
- Document every environment variable with default, required status, and intended environment.
- Keep `.env.example` current.

Likely variables:

- `NODE_ENV`
- `API_PORT`
- `DATABASE_URL`
- `WORKTRAIL_WEB_ORIGIN` or `CORS_ORIGIN`
- `WORKTRAIL_DEFAULT_MEMBER_ID` if still useful
- `WORKTRAIL_ALLOW_DATABASE_RESET`
- `WORKTRAIL_E2E_SKIP_DB_RESET`
- `WORKTRAIL_E2E_SKIP_DB_RESTORE`

Acceptance criteria:

- API startup fails with actionable copy when required production configuration is missing.
- Local development still works with `.env.example`.
- Tests cover representative valid and invalid configuration.
- Documentation clearly distinguishes development defaults from production preview requirements.

### 3. Health And Readiness

Improve operational health endpoints.

Required behavior:

- Keep a cheap liveness endpoint for process health.
- Add a readiness endpoint that checks database connectivity.
- Include structured JSON responses.
- Return non-2xx status for readiness failures.
- Document endpoint behavior.
- Keep checks lightweight.

Suggested endpoints:

- `GET /api/health/live`
- `GET /api/health/ready`
- Preserve `GET /api/health` as a compatibility alias if useful.

Acceptance criteria:

- Liveness succeeds when the API process is running.
- Readiness succeeds when the API can query Postgres.
- Readiness fails clearly if the database is unavailable.
- Playwright and local startup checks can use readiness where appropriate.

### 4. HTTP API Reference

Add a minimal, accurate API reference for implemented endpoints.

Required behavior:

- Add an OpenAPI document checked into the repo or generated from a maintained source.
- Cover current implemented endpoints at a useful level:
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
  - saved work views;
  - health/readiness.
- Include local actor header behavior.
- Include common error response shape.
- Add a command or documentation path for validating or viewing the spec if practical.

Acceptance criteria:

- The OpenAPI document is present and linked from README.
- The documented endpoint paths match the Express adapter.
- The documented request and response schemas are close enough to support client evaluation.
- Local actor behavior is documented as development-only.

### 5. Operator Documentation

Add operational documentation for local production preview and future cloud mapping.

Required behavior:

- Add a runbook under `docs/v0.0.6/` or `docs/operations.md`.
- Cover:
  - environment setup;
  - migration and seed commands;
  - production preview command;
  - health/readiness checks;
  - test commands;
  - safe database reset behavior;
  - troubleshooting common startup failures;
  - mapping local runtime pieces to future S3/CloudFront, API Gateway/Lambda, and managed Postgres.
- Update README with a concise link to the runbook.

Acceptance criteria:

- A new evaluator can follow the docs to run a production-like preview.
- Dangerous commands are clearly labeled.
- Future cloud mapping is concrete but not presented as implemented infrastructure.

### 6. Product And Site Updates

Keep release-facing materials current.

Required behavior:

- Update README for v0.0.6 capabilities and limitations.
- Update the static product site to mention production preview, API documentation, readiness, and cloud-shaped runtime boundaries.
- Add `docs/v0.0.6/jawstack-extraction-notes.md` after implementation.
- Keep package versions at `0.0.6` if release finalization is in scope.

Acceptance criteria:

- Docs and site reflect v0.0.6 accurately.
- Extraction notes capture reusable operational patterns and deferred abstractions.
- Verification results are recorded in the implementation plan.

## Data And API Requirements

Expected additions:

- readiness endpoint that performs a lightweight database query;
- runtime config module for API startup validation;
- optional API metadata endpoint only if useful for OpenAPI or runtime inspection;
- OpenAPI document in `docs/api/` or another stable location.

No database schema changes are expected for v0.0.6 unless the technical design identifies a small operational need.

## UX Requirements

The core application UX should not change materially in this sprint, except where production preview or configuration work requires visible copy.

Requirements:

- Existing v0.0.5 routes must remain usable.
- Local actor selector remains available in development and production preview unless explicitly disabled by configuration.
- Any disabled or unavailable operational feature should use clear, plain copy.
- Public site updates should remain static and readable.
- No new marketing-heavy app screens.

## Permissions And Policy

- Existing app permissions remain unchanged.
- Production preview does not create production authentication.
- The local actor selector remains development scaffolding, not a security boundary.
- Runtime config docs must not imply that local actor headers are safe for internet-exposed production use.
- Database reset remains guarded against non-local database hosts unless explicitly overridden.

## Testing Requirements

Backend tests should cover:

- runtime config validation;
- liveness response;
- readiness success;
- readiness failure path where practical;
- OpenAPI path availability or spec validation if implemented as a served endpoint.

Frontend tests should cover:

- no intentional UI regression required beyond existing route and component coverage;
- any production-preview-specific frontend config behavior if introduced.

E2E smoke should cover:

- existing v0.0.5 daily workflow;
- existing governance workflow;
- existing planning/adoption workflow;
- existing responsive overflow checks.

Additional verification should cover:

- production preview starts from built artifacts;
- built SPA deep links refresh correctly;
- readiness endpoint works against seeded local Postgres;
- full build remains within Angular budgets.

## Observability And Operations

v0.0.6 should add operational basics without introducing a full observability stack.

Required:

- structured health/readiness responses;
- startup configuration validation;
- documented runtime commands;
- documented safety rails.

Optional if low-cost:

- structured request logging improvements;
- startup log that identifies runtime mode, API port, and static asset serving mode without leaking secrets.

Out of scope:

- metrics endpoint;
- tracing;
- distributed logging;
- uptime checks;
- alerting.

## Success Metrics

Because this is still a local reference app, success is measured through functional readiness:

- A fresh local setup can run a production-like preview from built artifacts.
- API readiness accurately reports database availability.
- Misconfigured production preview fails early with actionable copy.
- API reference documentation matches the implemented routes.
- Existing daily workflow, governance, planning, board, comment, saved view, and archived-project browser paths still pass.
- Production build remains within configured Angular budgets without raising thresholds.
- No production dependency vulnerabilities are reported by `npm audit --omit=dev --audit-level=low`.

## Risks

- Production preview can sprawl into full deployment infrastructure if scope is not held.
- OpenAPI documentation can become stale if generated or maintained carelessly.
- Config validation can break local developer ergonomics if development defaults are too strict.
- Serving static Angular assets through Express may blur the eventual S3/CloudFront boundary if documented poorly.
- Docker production preview can consume time without materially improving the cloud path if introduced too early.
- Health/readiness endpoints can leak configuration details if responses are too verbose.

## Open Questions

1. Should production preview be a single Node/Express process that serves both API and Angular static assets, or a two-process preview that better mirrors separate frontend/backend deployment?
2. Should Docker Compose production preview be included in v0.0.6, or deferred until the runtime contract is stable?
3. Should the OpenAPI document be hand-authored from contracts for now, or should we introduce a generation/validation tool?
4. Should readiness check migrations explicitly, or only verify database connectivity?
5. Should local actor selection be available in production preview by default, or gated behind an explicit development flag?

## Recommended Decisions

- Use a single Node/Express production preview for v0.0.6 to minimize moving parts, while documenting that the cloud target remains separate Angular static hosting plus API runtime.
- Defer Docker Compose production preview unless it falls out naturally from the technical design.
- Start with a checked-in OpenAPI document and add lightweight validation later if maintenance becomes painful.
- Make readiness verify database connectivity only; migration drift detection can be a later operations feature.
- Keep local actor selection enabled in production preview but document it prominently as development scaffolding, not production authentication.
