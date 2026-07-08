# Worktrail v0.1.9 Implementation Plan

## Purpose

This plan turns the v0.1.9 PRD and technical design into sequential implementation phases. v0.1.9 should add Status Report Sharing: a narrow, practical export and sharing workflow for immutable published project status reports.

The release should preserve the local-first development experience, Angular static-hosting compatibility, transport-neutral API handler structure, Express local adapter, Postgres persistence, deterministic seed data, checked-in OpenAPI docs, CI verification, and clean setup from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.9:

- Add one API route:
  - `GET /api/projects/:projectId/status-reports/:reportId/export.md`.
- Do not add database tables or migrations.
- Do not add shared DTO contracts for the Markdown export response.
- Render Markdown server-side from `ProjectStatusReportDetailDto`.
- Use stored report snapshot data only; do not recompute project health, milestone state, risks, or recent work for export.
- Use relative app links in exported Markdown.
- Return `text/markdown; charset=utf-8`.
- Return `Content-Disposition: attachment` with a deterministic `.md` filename.
- Add visible report detail actions:
  - `Copy Markdown`;
  - `Download Markdown`;
  - `Print`.
- Anyone who can read a report can copy, download, and print it.
- Preserve contributor export behavior and archived-project report export behavior.
- Add print-friendly report detail styling without adding PDF generation.
- Do not add report edits, report delete/archive, email/Slack/webhook delivery, subscriptions, recipients, approvals, comments, custom templates, workspace rollups, public unauthenticated links, short links, export history, analytics, or generic document rendering infrastructure.
- Keep pattern notes destination-neutral.

## Phase Sizing

Each phase should leave the repository in a coherent working state. This release touches API-local rendering helpers, status report service/export handler routing, API tests, OpenAPI, Angular API clients, report detail actions, print CSS, focused Angular tests, Playwright smoke coverage, README, public site, release notes, and pattern notes.

Implementation phases:

1. baseline planning;
2. Markdown renderer and query link helper;
3. export service, endpoint handler, Express route, and API tests;
4. OpenAPI;
5. Angular API client and report detail sharing controls;
6. print styling and responsive polish;
7. Playwright smoke coverage;
8. documentation, site, release notes, pattern notes, and final verification.

Run focused API tests after backend phases, focused web tests after frontend phases, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.1.9 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.1.9/prd.md` exists.
- Confirm `docs/v0.1.9/technical-design.md` exists.
- Confirm `docs/v0.1.9/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm sprint docs use destination-neutral pattern extraction language.
- Confirm no runtime files have been changed for v0.1.9 yet.
- Confirm whether a `v0.1.9` branch should be checked out before runtime work begins.

Out of scope:

- Runtime implementation.
- API changes.
- UI changes.
- Documentation beyond planning status.

Acceptance criteria:

- v0.1.9 planning inputs exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.
- Sprint docs use destination-neutral pattern extraction language.

Suggested commands:

```sh
find docs/v0.1.9 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-08.
- Confirmed v0.1.9 planning inputs exist:
  - `docs/v0.1.9/prd.md`;
  - `docs/v0.1.9/technical-design.md`;
  - `docs/v0.1.9/implementation-plan.md`.
- Confirmed active branch is `v0.1.9`; no branch checkout is needed before runtime work begins.
- Confirmed the worktree currently contains only untracked v0.1.9 planning docs and no runtime changes for v0.1.9.
- Confirmed implementation decisions:
  - add `GET /api/projects/:projectId/status-reports/:reportId/export.md`;
  - do not add database tables, migrations, or new shared DTO contracts;
  - render Markdown server-side from stored published report detail DTOs;
  - use relative app links in exported Markdown;
  - return `text/markdown; charset=utf-8` with `Content-Disposition: attachment`;
  - add report detail `Copy Markdown`, `Download Markdown`, and `Print` actions;
  - preserve contributor and archived-project report export behavior;
  - defer PDF generation, delivery integrations, subscriptions, approvals, comments, templates, public links, export history, analytics, report edits, and generic document rendering infrastructure.
- Confirmed sprint docs use destination-neutral pattern extraction language.
- Verified:
  - `find docs/v0.1.9 -maxdepth 1 -type f | sort`;
  - `git status --short --branch`;
  - `git diff --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Markdown Renderer And Query Link Helper

Goal: add deterministic server-side Markdown rendering from stored status report DTOs without exposing an endpoint yet.

Scope:

- Add `apps/api/src/services/work-item-query-link.ts` with:
  - `projectWorkItemPathFromQuery(projectId, query)`;
  - project-scope query serialization for report risk links;
  - omission of project-only defaults such as `sort=updated_desc`;
  - URL encoding through `URLSearchParams`.
- Add `apps/api/src/services/status-report-markdown-renderer.ts` with:
  - `renderStatusReportMarkdown(report, options?)`;
  - `statusReportMarkdownFileName(report)`;
  - Markdown escaping helpers;
  - deterministic empty-state rendering;
  - project, milestone, risk, and work item relative links;
  - stored snapshot sections for metadata, narrative, counts, health reasons, milestones, risks, and recent work.
- Keep the renderer pure:
  - no repository calls;
  - no database access;
  - no mutation;
  - no Angular imports.
- Add focused tests for:
  - report metadata and narrative sections;
  - published snapshot notice;
  - count table;
  - milestone links;
  - risk links with serialized project Work query params;
  - work item links;
  - empty optional sections;
  - Markdown escaping for pipes, brackets, parentheses, and line breaks;
  - deterministic filename slugging and fallback.

Out of scope:

- API endpoint.
- Express route.
- OpenAPI.
- Angular UI.
- Print CSS.

Acceptance criteria:

- Renderer output is deterministic for a fixed report DTO.
- Renderer uses stored snapshot data.
- Query links match project Work route semantics.
- API tests/typecheck/lint pass.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/status-report-markdown-renderer.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 2: Export Service, Endpoint, Route, And API Tests

Goal: expose Markdown export through the existing transport-neutral API and local Express adapter.

Scope:

- Extend `ProjectStatusReportService` with:
  - `exportProjectStatusReportMarkdown(projectId, reportId)`;
  - existing report read permission behavior;
  - existing archived-project read behavior;
  - renderer integration;
  - filename generation.
- Update `apps/api/src/endpoints/status-reports.ts`:
  - add `exportProjectStatusReportMarkdownHandler`;
  - use existing `reportParamSchema`;
  - return `text/markdown; charset=utf-8`;
  - return `Content-Disposition: attachment; filename="..."`;
  - return raw string body.
- Update `apps/api/src/adapters/express/routes/project-routes.ts`:
  - register `GET /api/projects/:projectId/status-reports/:reportId/export.md`;
  - keep route near existing status report routes.
- Confirm no `handler-adapter` change is required because string bodies and custom headers already work.
- Extend API tests for:
  - owner/maintainer export;
  - contributor export;
  - archived-project report export if existing fixture seam supports it;
  - cross-project report mismatch returns not found;
  - missing report returns not found;
  - response content type;
  - response content disposition;
  - response body contains expected Markdown sections.
- Update server/route inventory tests if present.

Out of scope:

- OpenAPI.
- Angular client.
- UI controls.
- Playwright.

Acceptance criteria:

- The Markdown endpoint returns the stored report as Markdown.
- Export permissions match report detail read permissions.
- Export does not create activity.
- Existing status report JSON routes continue to pass.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/status-reports.test.ts tests/status-report-markdown-renderer.test.ts tests/server.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Not started.

## Phase 3: OpenAPI

Goal: document the Markdown export route and non-JSON response behavior.

Scope:

- Update `docs/api/openapi.yaml` with:
  - `GET /api/projects/{projectId}/status-reports/{reportId}/export.md`;
  - `Status Reports` tag;
  - local actor header parameters if used per operation;
  - path parameters;
  - `200` response with:
    - `text/markdown`;
    - string schema;
    - `Content-Disposition` header;
  - existing error responses.
- Confirm existing status report JSON routes remain documented.
- Add or update OpenAPI search verification notes in the implementation plan during completion.

Out of scope:

- Runtime endpoint changes.
- UI changes.

Acceptance criteria:

- OpenAPI contains the Markdown export route.
- OpenAPI documents `text/markdown` response content.
- OpenAPI still documents status report list/draft/publish/detail routes.

Suggested commands:

```sh
rg -n "export.md|text/markdown|ProjectStatusReport|Status Reports" docs/api/openapi.yaml
npm test --workspace @worktrail/api -- tests/status-reports.test.ts tests/server.test.ts
git diff --check
```

Status:

- Not started.

## Phase 4: Angular API Client And Report Detail Sharing Controls

Goal: let report readers copy, download, and print from the published report detail page.

Scope:

- Update `apps/web/src/app/core/api/projects-api.ts`:
  - add `exportProjectStatusReportMarkdown(projectId, reportId): Observable<HttpResponse<Blob>>`.
- Update `apps/web/src/app/core/worktrail-api.service.ts`:
  - expose the export method.
- Update `apps/web/src/app/core/worktrail-api.service.spec.ts`:
  - verify endpoint path and blob response behavior.
- Update `ProjectStatusReportDetailPageComponent`:
  - inject `ClipboardService`;
  - use `downloadBlob` and `fileNameFromContentDisposition`;
  - add sharing state signals;
  - add `Copy Markdown`, `Download Markdown`, and `Print` actions;
  - add success/error feedback;
  - keep sharing controls visible for contributors;
  - hide controls from loading/error-only states if that is the simplest clean UX.
- Add or extend component tests for:
  - actions render after report load;
  - copy calls Markdown endpoint and clipboard service;
  - copy success feedback;
  - copy failure feedback;
  - download calls Markdown endpoint and download helper path;
  - filename from `Content-Disposition`;
  - print invokes `window.print`;
  - contributor read path includes sharing controls.

Out of scope:

- Print CSS polish beyond the action hook.
- Playwright.
- API endpoint implementation.

Acceptance criteria:

- Report readers can copy exported Markdown.
- Report readers can download the server-rendered Markdown file.
- Report readers can trigger browser print.
- Component tests cover success and failure states.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/status-reports/project-status-report-detail-page.component.spec.ts --include src/app/core/worktrail-api.service.spec.ts
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 5: Print Styling And Responsive Polish

Goal: make published report detail pages print-focused and keep sharing controls usable across widths.

Scope:

- Add report detail component print CSS for:
  - hiding report action controls;
  - rendering report sections as a print-friendly single-column document;
  - avoiding card/page break issues where practical;
  - preserving link visibility.
- Add global print CSS in `apps/web/src/app/app.scss` only if component-scoped CSS cannot hide:
  - `.topbar`;
  - `.project-shell__header`;
  - `.project-shell__nav`.
- Keep global print CSS conservative.
- Review report detail responsive layout after sharing controls are added.
- Add component or Playwright assertions where practical for:
  - no horizontal overflow at mobile width;
  - sharing actions wrap cleanly;
  - print-hidden class exists on action controls.

Out of scope:

- PDF generation.
- Visual snapshot infrastructure.
- New design system primitives.

Acceptance criteria:

- Browser print output focuses on report content rather than app chrome.
- Report content is not clipped or overlapped at common desktop/mobile widths.
- Sharing controls remain usable on mobile and are hidden for print.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/status-reports/project-status-report-detail-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 6: Playwright Smoke Coverage

Goal: prove report export and sharing behavior in a browser from deterministic seed data.

Scope:

- Extend `e2e/worktrail-smoke.spec.ts`.
- Reuse seeded report:
  - `10000000-0000-4000-8000-000000000651`.
- Cover:
  - opening seeded report;
  - `Copy Markdown` success feedback;
  - `Download Markdown`;
  - downloaded Markdown includes:
    - report title;
    - published snapshot note;
    - `## Snapshot Counts`;
    - milestone link;
    - risk link;
  - contributor path:
    - report can be opened;
    - copy/download controls are visible;
    - create report remains unavailable from list;
  - mobile width does not horizontally overflow after sharing controls are added.
- Keep clipboard assertion UI-based rather than reading OS clipboard.

Out of scope:

- Automated print-preview inspection.
- New seed data unless the existing seeded report no longer covers useful export content.

Acceptance criteria:

- Playwright proves report sharing from seeded data.
- Full smoke suite remains deterministic and restores seed data after mutation-heavy tests.

Suggested commands:

```sh
npx playwright test e2e/worktrail-smoke.spec.ts -g "status reports"
npm run test:e2e
git diff --check
```

Status:

- Not started.

## Phase 7: Documentation, Site, Release Notes, Pattern Notes, And Final Verification

Goal: complete the release surface and verify the repository end to end.

Scope:

- Update README:
  - v0.1.9 baseline;
  - status report Markdown copy/download behavior;
  - report print behavior;
  - export permissions and archived-project read/export behavior;
  - limitations around no PDF, delivery, approvals, templates, subscriptions, public links, or export history.
- Update public static site if status report sharing should be mentioned in product copy.
- Add `docs/v0.1.9/release-notes.md`.
- Add `docs/v0.1.9/pattern-extraction-notes.md` covering:
  - immutable-record text exports;
  - server-side rendering for non-JSON responses;
  - relative links in portable artifacts;
  - copy/download/print before delivery infrastructure;
  - criteria for deferring templates, subscriptions, and PDF generation.
- Confirm documentation uses destination-neutral pattern extraction language.
- Confirm OpenAPI is current.
- Run final verification.
- Record final verification results in the implementation plan.

Out of scope:

- New product scope.
- Release tagging unless explicitly requested.

Acceptance criteria:

- README and public site match implemented capabilities.
- Release notes summarize user-facing and technical changes.
- Pattern notes are destination-neutral.
- OpenAPI matches the route surface.
- Full verification passes or any failures are documented with concrete cause.

Suggested commands:

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run test:e2e
git diff --check
git status --short --branch
```

Status:

- Not started.
