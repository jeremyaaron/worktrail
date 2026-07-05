# Worktrail v0.0.6 Jawstack Extraction Notes

## Purpose

These notes capture implementation patterns that emerged while building v0.0.6. They are observations, not framework commitments. The useful extraction point is where the same operational pressure appears across multiple concrete applications.

v0.0.6 shifted Worktrail from "local app with tests" toward "local app that can be inspected like a service." The sprint added runtime config validation, production preview, static asset serving, liveness/readiness endpoints, an OpenAPI reference, and an operations runbook.

## Runtime Configuration Boundary

The API now loads a typed runtime config object before creating infrastructure. Development keeps ergonomic defaults; production mode requires an explicit `DATABASE_URL` and validates ports, modes, booleans, and database URL protocol.

Potential extraction:

- config loader convention that returns a typed object instead of spreading `process.env`;
- mode-aware defaults with stricter production requirements;
- safe startup error formatting that avoids printing secrets;
- helper defaults for repo-relative artifact paths;
- focused config tests for valid defaults and invalid environment values.

Do not extract yet:

- generic schema-driven config framework;
- multi-environment deployment profiles;
- secret manager integration;
- config hot reload.

## Single-Process Production Preview

Worktrail now supports a production-like preview that builds contracts, API, and Angular artifacts, then starts compiled API code in production mode. Express serves API routes and the Angular browser build from the same origin.

Potential extraction:

- root `preview` command convention for reference apps;
- app startup logs that identify mode, port, static serving, and health URLs;
- production preview as a local packaging check before cloud templates exist;
- same-origin frontend API base path for dev proxy and preview parity.

Do not extract yet:

- Docker production preview;
- deployment manifest generation;
- process supervisors;
- multi-service local orchestration beyond Postgres.

## Adapter-Level Static Serving

Static asset serving lives in the Express adapter, not in endpoint handlers. API routes are registered first; static assets are served afterward; non-API `GET` routes fall back to `index.html`; `/api/*` is never swallowed by the SPA fallback.

Potential extraction:

- adapter-owned static serving module;
- static directory and index validation at app creation time;
- SPA fallback guard that excludes API prefixes;
- tests using temporary static fixtures for static files, deep links, API precedence, and missing directories.

Do not extract yet:

- generic static asset middleware package;
- CDN cache policy abstractions;
- framework-specific frontend build discovery;
- asset fingerprint manifest parsing.

## Health And Readiness Contracts

v0.0.6 split process liveness from database readiness. Liveness is cheap and dependency-free. Readiness performs a lightweight `select 1` against the Postgres pool and returns a safe structured failure without driver details.

Potential extraction:

- standard liveness and readiness DTO shape;
- readiness service interface that accepts a minimal pool/query dependency;
- compatibility alias for older health endpoints;
- Playwright and preview waits pointed at readiness instead of liveness;
- tests for ready, not ready, and secret-safe failure bodies.

Do not extract yet:

- migration drift checks;
- dependency trees with partial degraded status;
- metrics, tracing, or service-level objectives;
- health check plugin registry.

## Checked-In API Reference

The OpenAPI file is hand-authored and intentionally representative. It documents implemented routes, local actor headers, readiness behavior, common error shape, and representative schemas without duplicating every TypeScript DTO in exhaustive detail.

Potential extraction:

- checked-in API reference as a release artifact;
- guard test that verifies required paths and caveats remain documented;
- local development header documentation section;
- common error response schema convention.

Do not extract yet:

- OpenAPI generation from route code;
- Swagger UI hosting;
- client generation;
- strict schema parity checks between contracts and OpenAPI.

## Operator Runbook

The runbook documents the concrete operating path: setup, migrations, seeding, production preview, health checks, deep-link checks, reset safety, troubleshooting, and future cloud mapping. It also makes local actor and production preview caveats explicit.

Potential extraction:

- release runbook template for reference apps;
- explicit "operating boundaries" section;
- destructive command safety section;
- copy-paste preview verification commands;
- future cloud mapping from local artifacts to likely managed services.

Do not extract yet:

- incident response templates;
- backup and restore procedures;
- runbook publishing automation;
- organization-specific on-call workflows.

## Cloud Deployment Implications

The sprint clarified boundaries before adding cloud infrastructure. Angular assets can map to S3/CloudFront, endpoint handlers can map to Lambda/API Gateway or a container runtime, runtime config can map to environment/secrets, readiness can map to load-balancer or synthetic checks, and migrations can become a release job.

Potential future work:

- Lambda/API Gateway adapter for the existing endpoint handler contract;
- S3/CloudFront static site template with SPA fallback;
- managed Postgres connection and pooling strategy;
- migration runner as an explicit deployment step;
- production auth adapter that resolves real identities to workspace members;
- observability package that layers metrics and tracing around endpoint adapters.
