# Worktrail v0.0.4 Jawstack Extraction Notes

## Purpose

These notes capture implementation patterns that emerged while building v0.0.4. They are observations, not framework commitments. The useful extraction point is where the same pressure appears across multiple concrete applications.

## Workspace Member Lifecycle

v0.0.4 moved members from seeded fixtures into an administrable workspace resource. Members can be created, edited, deactivated, reactivated, and promoted while the system preserves at least one active owner.

Potential extraction:

- workspace-scoped member repository conventions;
- reversible activation lifecycle fields;
- active-owner safety checks inside transactions;
- case-insensitive unique email validation by workspace;
- inline confirmation pattern for reversible member lifecycle commands.

Do not extract yet:

- invitations;
- identity-provider linking;
- multi-workspace membership;
- custom roles or project-specific membership.

## Server-Derived Actor Context

The local actor selector remains development scaffolding, but the API now derives role and active state from the selected member record. This improved the permission model without introducing production auth.

Potential extraction:

- actor resolution middleware that maps request identity to a workspace actor context;
- active-actor rejection with consistent error copy;
- local-development actor bootstrap behavior;
- service-level actor context passed through command handlers.

Do not extract yet:

- authentication adapters;
- session management;
- OAuth/OIDC claims mapping;
- a generalized authorization framework.

## Capability-Aware UI

Workspace capabilities provide a small server-derived summary of what the selected actor can do. The frontend uses that summary for project creation, workspace settings, member administration, and permission explanation.

Potential extraction:

- compact capabilities DTO conventions;
- role summary text returned with capabilities;
- disabled-control helper copy for unavailable actions;
- frontend permission affordance tests by role.

Do not extract yet:

- field-level permission matrices;
- server-driven form schemas;
- custom role configuration;
- generic policy DSLs.

## Historical Identity Display

Inactive members remain readable in work items, comments, activity, and filters, while active-member controls exclude them from new assignments and actor selection. Work item detail preserves an existing inactive assignee without reopening inactive members for new assignment.

Potential extraction:

- active choice list plus historical selected value pattern;
- inactive marker display helper;
- active-member actor selector fallback;
- route-backed filter label resolution using full historical member lists.

Do not extract yet:

- anonymization workflows;
- privacy retention policies;
- identity merge/split tooling.

## Workspace Activity

v0.0.4 added a dedicated workspace activity table instead of generalizing project activity. This kept project/work-item activity focused while making administrative changes auditable.

Potential extraction:

- workspace activity event table conventions;
- activity DTO mapping with actor resolution;
- command-side activity recording helper;
- separate product activity streams by resource scope.

Do not extract yet:

- event sourcing;
- audit export;
- notification fanout;
- real-time activity subscriptions.

## Permission Copy Alignment

The sprint tightened UI helper text and local guard errors to match backend messages for owner-only, owner/maintainer-only, archived-project, inactive-member, and terminal-work-item rules.

Potential extraction:

- canonical permission message constants shared across layers;
- tests that assert frontend copy against backend policy language;
- local preflight guard helpers for predictable denials.

Do not extract yet:

- globalized message catalogs;
- policy-to-copy code generation;
- broad permission explanation UIs.

## Route-Level Code Splitting

Lazy-loaded Angular route components removed route-heavy feature pages and CDK drag/drop from the initial production bundle. This kept the existing budget meaningful instead of hiding avoidable weight by raising thresholds.

Potential extraction:

- standalone route generation defaulting to `loadComponent`;
- build-budget review checklist;
- bundle-output capture in release verification.

Do not extract yet:

- automatic route preloading strategy;
- microfrontend boundaries;
- framework-level bundle analysis tooling.

## E2E Governance Smoke

The Playwright suite now covers workspace governance and preserves the existing planning/adoption path. The e2e setup resets, migrates, and seeds the local database before browser execution, then release finalization restores deterministic seed data after mutation.

Potential extraction:

- deterministic e2e database lifecycle;
- smoke paths organized around release capabilities;
- responsive overflow checks for operational app surfaces;
- actor-switching helpers for local role-path tests.

Do not extract yet:

- full browser fixture framework;
- screenshot baselines;
- synthetic data factories beyond deterministic seed data.

## Cloud Deployment Implications

The v0.0.4 governance work preserved the static Angular frontend path and transport-neutral API service boundaries. Server-derived actor context is intentionally local today, but it creates a clear seam for later production authentication: real auth can map an external identity to a workspace member, then reuse member lifecycle, capabilities, and permission-aware UI concepts.

Potential future work:

- auth adapter that maps identity-provider claims to workspace members;
- Lambda/API Gateway adapter for existing endpoint handlers;
- managed migration runner;
- RDS Proxy or pooled connection strategy for serverless runtimes;
- S3/CloudFront deployment template for the lazy-loaded Angular build.
