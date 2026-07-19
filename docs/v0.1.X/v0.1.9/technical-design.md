# Worktrail v0.1.9 Technical Design

## Summary

v0.1.9 adds Status Report Sharing for published project status reports.

The release should introduce:

- deterministic Markdown rendering for `ProjectStatusReportDetailDto`;
- a server-side Markdown export endpoint for published reports;
- copy, download, and print actions on the report detail page;
- print-specific report detail styling;
- OpenAPI, API tests, Angular component tests, Playwright smoke coverage, release notes, and pattern notes.

No new database table or migration is required. The exported content must be derived from the stored published report and its immutable snapshot, not from recomputed current project state.

## Resolved Product Decisions

### Export Format

Use Markdown only in v0.1.9.

Rationale:

- Markdown is easy to inspect, paste, download, and test;
- it avoids introducing PDF generation, headless rendering, template engines, or binary document infrastructure;
- it fits the current reference-app goal of proving the workflow before abstracting delivery.

### Export Links

Use relative app links in Markdown.

Examples:

```text
/projects/:projectId
/projects/:projectId/milestones/:milestoneId
/projects/:projectId/work-items?status=blocked&sort=priority_desc
/work-items/:workItemId
```

Rationale:

- relative links work for local dev, production preview, GitHub Codespaces-style forwarding, and future single-origin deployments;
- no new base URL configuration is required;
- absolute external report URLs can be added later if public sharing or deployed domains become product scope.

### Download Behavior

The Markdown export endpoint should return:

```text
Content-Type: text/markdown; charset=utf-8
Content-Disposition: attachment; filename="worktrail-{projectKey}-{statusDate}-{safeTitle}.md"
```

Rationale:

- direct endpoint navigation downloads a file;
- Angular can still fetch the same endpoint as a blob for copy/download actions;
- the route is automation-friendly without adding a separate download-only endpoint.

### Print Action

Add a visible `Print` button on the published report detail page.

Rationale:

- print polish is otherwise undiscoverable;
- `window.print()` is enough for v0.1.9;
- print output remains browser-owned and does not require generating or storing a PDF.

### Risk Sections And Recent Work

Render all risk sections and exactly the stored `snapshot.recentWork` rows.

Rationale:

- exported Markdown should reflect the stored snapshot structure;
- empty risk sections make the report complete and deterministic;
- recent work is already capped by the snapshot producer.

## Current Architecture

Relevant existing pieces:

- `packages/contracts/src/projects.ts`
  - `ProjectStatusReportDetailDto`;
  - `ProjectStatusReportSnapshotDto`;
  - risk, count, milestone, and recent-work snapshot contracts.
- `apps/api/src/services/project-status-report-service.ts`
  - report list, draft, publish, and detail behavior;
  - existing report read permissions and archived-project read behavior.
- `apps/api/src/endpoints/status-reports.ts`
  - transport-neutral status report endpoint handlers.
- `apps/api/src/adapters/express/handler-adapter.ts`
  - already supports string or `Buffer` response bodies and custom response headers.
- `apps/api/src/adapters/express/routes/project-routes.ts`
  - project-scoped route registration.
- `apps/web/src/app/core/api/api-client.ts`
  - `getBlob` helper returns `HttpResponse<Blob>` for non-JSON downloads.
- `apps/web/src/app/shared/clipboard.service.ts`
  - clipboard API with textarea fallback.
- `apps/web/src/app/shared/download-file.ts`
  - blob download and `Content-Disposition` filename parsing helpers.
- `apps/web/src/app/features/projects/status-reports/project-status-report-detail-page.component.ts`
  - published report detail route and snapshot rendering.
- `apps/web/src/app/app.html`
  - global `.topbar` and `.content-shell`.
- `apps/web/src/app/features/projects/project-shell/project-shell.component.ts`
  - `.project-shell__header`, `.project-shell__nav`, and `.project-shell__content`.

## Data Model

No schema change.

The Markdown export uses existing persisted data:

- `project_status_reports.title`;
- `project_status_reports.status_date`;
- `project_status_reports.summary`;
- `project_status_reports.highlights`;
- `project_status_reports.risks`;
- `project_status_reports.next_steps`;
- `project_status_reports.snapshot`;
- `project_status_reports.published_at`;
- project and author records already loaded for report detail DTOs.

## Contracts

No new shared DTO is required.

The export endpoint returns raw Markdown, not JSON. Existing TypeScript contracts remain sufficient because the renderer consumes `ProjectStatusReportDetailDto`.

Do not add a `ProjectStatusReportMarkdownDto`. A wrapper DTO would add ceremony without improving the API, because the endpoint's primary contract is content type and body text.

## Markdown Rendering

### Location

Add:

```text
apps/api/src/services/status-report-markdown-renderer.ts
```

The renderer should be a pure function or small class. It should not read from repositories or mutate state.

Suggested public API:

```ts
export interface StatusReportMarkdownOptions {
  linkBasePath?: string;
}

export function renderStatusReportMarkdown(
  report: ProjectStatusReportDetailDto,
  options: StatusReportMarkdownOptions = {}
): string;

export function statusReportMarkdownFileName(report: ProjectStatusReportDetailDto): string;
```

`linkBasePath` defaults to `''`. v0.1.9 should use the default.

### Output Shape

Use stable section order:

```md
# {title}

> Published snapshot. Values reflect the report as published. Links open current Worktrail data.

## Metadata

- Project: [{key} - {name}](/projects/{projectId})
- Status date: {date}
- Health: {health}
- Author: {author}
- Published: {date time}
- Snapshot generated: {date time}

## Summary

{summary}

## Highlights

{highlights or "No highlights recorded."}

## Risks

{risks or "No risks recorded."}

## Next Steps

{nextSteps or "No next steps recorded."}

## Snapshot Counts

| Count | Value |
| --- | ---: |
| Open work | {n} |
| Blocked work | {n} |
...

## Health Reasons

- {reason label} ({severity}, {count})

## Milestones

| Milestone | Status | Target | Health | Open | Done | Blocked |
| --- | --- | --- | --- | ---: | ---: | ---: |
| [{name}](/projects/{projectId}/milestones/{milestoneId}) | Active | Jul 18, 2026 | Blocked | 4 | 1 | 1 |

## Risk Sections

### Blocked Work

[Open current work](/projects/{projectId}/work-items?status=blocked&sort=priority_desc)

- [WT-4 - Choose status transition copy](/work-items/{workItemId}) - Blocked, Low

## Recent Work

- [WT-3 - Implement transport-neutral API handler contract](/work-items/{workItemId}) - In progress, Urgent, updated Jul 2, 2026, 8:00 AM
```

Exact copy may be adjusted during implementation, but the renderer should keep:

- stable headings;
- stable table columns;
- deterministic empty states;
- no app navigation text;
- no copy/download/print button text.

### Escaping

Escape text used in Markdown structure:

- headings;
- table cells;
- link labels;
- list labels.

Recommended helpers:

```ts
function escapeMarkdownText(value: string): string
function escapeMarkdownTableCell(value: string): string
function markdownLink(label: string, href: string): string
```

Implementation notes:

- replace `|` in table cells with `\|`;
- normalize CRLF to LF;
- trim trailing whitespace from lines;
- keep narrative line breaks by preserving paragraphs;
- escape square brackets and parentheses in link labels enough to keep links valid;
- encode URL query values with `URLSearchParams`.

The goal is valid, readable Markdown rather than full CommonMark sanitization.

### Formatting

The renderer should use deterministic English labels and UTC date formatting where date-only fields are involved.

Suggested formatting:

- status date: `Jul 3, 2026` with `timeZone: 'UTC'`;
- date-time fields: local default `Intl.DateTimeFormat` is acceptable if existing report UI uses local display, but tests should avoid brittle timezone assertions or inject a formatter if exact output matters;
- tokens: reuse or mirror `formatToken` behavior for values such as `in_progress`, `at_risk`, and `dependency_blocked`.

Because this is server-side code, do not import Angular display helpers. Add API-local token/date helpers if necessary.

### Work Item Query Link Serialization

The API needs a small project-scope query serializer for Markdown links.

Add:

```text
apps/api/src/services/work-item-query-link.ts
```

Suggested API:

```ts
export function projectWorkItemPathFromQuery(
  projectId: string,
  query: WorkItemQuery
): string;
```

Behavior should match project Work URL semantics:

- path: `/projects/${projectId}/work-items`;
- include meaningful project query fields:
  - `search`;
  - `status`;
  - `assigneeId`;
  - `reporterId`;
  - `type`;
  - `labelId`;
  - `milestoneId`;
  - `priority`;
  - `dueDateState`;
  - `dependency`;
  - `workRisk`;
  - `sort` when non-default.
- omit `projectId` and `archivedProjects` for project-scope report links;
- omit default `sort=updated_desc`;
- use `URLSearchParams` for encoding.

This duplicates a narrow subset of the Angular route-query helper. Do not move the Angular helper into contracts in v0.1.9 unless implementation proves the duplication is already risky. The report renderer needs only project-scope link generation.

## API Service

Extend `ProjectStatusReportService` with:

```ts
export interface ProjectStatusReportMarkdownExport {
  fileName: string;
  markdown: string;
}

async exportProjectStatusReportMarkdown(
  projectId: string,
  reportId: string
): Promise<ProjectStatusReportMarkdownExport>
```

Implementation:

1. call or reuse the existing report detail read path;
2. pass the resulting `ProjectStatusReportDetailDto` to `renderStatusReportMarkdown`;
3. return Markdown plus sanitized filename.

Do not create activity events for export.

Do not recompute snapshots.

### Filename

Suggested filename:

```text
worktrail-{projectKeyLower}-{statusDate}-{slugTitle}.md
```

Rules:

- lowercase;
- replace non-alphanumeric runs with `-`;
- trim leading/trailing dashes;
- cap slug length, for example 60 characters;
- fallback to `status-report` if the title slug is empty.

Example:

```text
worktrail-wt-2026-07-03-worktrail-app-weekly-status.md
```

## Endpoint Handler

Extend `apps/api/src/endpoints/status-reports.ts`.

Add handler:

```ts
export function exportProjectStatusReportMarkdownHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<string>
```

Route params use existing `reportParamSchema`.

Response:

```ts
return {
  status: 200,
  headers: markdownExportHeaders(fileName),
  body: markdown
};
```

Headers:

```ts
function markdownExportHeaders(fileName: string): Record<string, string> {
  return {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName}"`
  };
}
```

The existing Express adapter sends string bodies directly after setting headers, so no adapter change is expected.

## Express Routes

Update `apps/api/src/adapters/express/routes/project-routes.ts`.

Add route:

```ts
app.get(
  '/api/projects/:projectId/status-reports/:reportId/export.md',
  adaptEndpoint(
    exportProjectStatusReportMarkdownHandler({
      repositories: context.repositories,
      db: context.db
    }),
    options
  )
);
```

Put it near the other status report routes. It can be before or after `/:reportId` because Express exact path matching should not match the extra `/export.md` segment for the detail route, but placing export before detail is clearer.

## OpenAPI

Update `docs/api/openapi.yaml`.

Add:

```yaml
/api/projects/{projectId}/status-reports/{reportId}/export.md:
  get:
    tags: [Status Reports]
    summary: Export a project status report as Markdown.
    description: Returns a deterministic Markdown rendering of an immutable published status report. Contributors may export reports they can read, including reports for archived projects.
    parameters:
      - $ref: "#/components/parameters/ProjectId"
      - name: reportId
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      "200":
        description: Markdown status report export.
        headers:
          Content-Disposition:
            schema:
              type: string
        content:
          text/markdown:
            schema:
              type: string
      "404":
        $ref: "#/components/responses/NotFound"
```

Also document local actor headers on the operation if the file uses per-operation header references.

No new schema component is required.

## Angular API Client

### Projects API

Extend `apps/web/src/app/core/api/projects-api.ts`:

```ts
exportProjectStatusReportMarkdown(
  projectId: string,
  reportId: string
): Observable<HttpResponse<Blob>> {
  return this.api.getBlob(
    `/projects/${projectId}/status-reports/${reportId}/export.md`
  );
}
```

### Worktrail API Facade

Expose through `WorktrailApiService`:

```ts
exportProjectStatusReportMarkdown(
  projectId: string,
  reportId: string
): Observable<HttpResponse<Blob>> {
  return this.projects.exportProjectStatusReportMarkdown(projectId, reportId);
}
```

No `ApiClient.getText` is required. The report detail page can call `Blob.text()` for copy behavior and reuse the same blob response for download behavior.

## Angular Report Detail UX

Update:

```text
apps/web/src/app/features/projects/status-reports/project-status-report-detail-page.component.ts
```

### State

Add signals:

```ts
readonly isCopyingMarkdown = signal(false);
readonly isDownloadingMarkdown = signal(false);
readonly shareMessage = signal<string | null>(null);
readonly shareError = signal<string | null>(null);
```

### Dependencies

Inject:

- `ClipboardService`;
- `DOCUMENT` or `window` access only through `DOCUMENT.defaultView`;
- use `downloadBlob` and `fileNameFromContentDisposition`.

### Actions

Add methods:

```ts
copyMarkdown(): void
downloadMarkdown(): void
printReport(): void
```

Copy flow:

1. clear feedback;
2. set `isCopyingMarkdown`;
3. call `api.exportProjectStatusReportMarkdown(projectId, reportId)`;
4. read `response.body?.text()`;
5. pass text to `ClipboardService.copyText`;
6. show `Report Markdown copied.`;
7. on error show `Could not copy report Markdown.`;
8. clear loading state in all paths.

Download flow:

1. clear feedback;
2. set `isDownloadingMarkdown`;
3. call export endpoint;
4. use `fileNameFromContentDisposition(response.headers.get('Content-Disposition'), fallback)`;
5. call `downloadBlob`;
6. show `Report Markdown downloaded.`;
7. on error show `Could not download report Markdown.`;
8. clear loading state.

Print flow:

1. clear feedback;
2. call `document.defaultView?.print()`;
3. if unavailable, show `Print is not available in this browser.`

### Template

Add an action row in the page heading:

```html
<div class="status-page__actions print-hidden">
  <a ...>Back to status</a>
  <button type="button" (click)="copyMarkdown()" [disabled]="isCopyingMarkdown()">Copy Markdown</button>
  <button type="button" (click)="downloadMarkdown()" [disabled]="isDownloadingMarkdown()">Download Markdown</button>
  <button type="button" (click)="printReport()">Print</button>
</div>
```

The exact layout can differ, but controls should:

- wrap cleanly;
- remain visible to contributors;
- not appear while loading or error states are the only content;
- be hidden in print output.

Add feedback region:

```html
@if (shareMessage()) {
  <p class="share-feedback" role="status">{{ shareMessage() }}</p>
}
@if (shareError()) {
  <p class="share-feedback share-feedback--error" role="alert">{{ shareError() }}</p>
}
```

## Print Styling

Add print styles primarily in the report detail component. Use global selectors only when required to hide app/project shell chrome.

Because Angular component styles are scoped, hiding `.topbar` and project shell elements from inside the detail component may require `:host-context` or global `app.scss`.

Recommended split:

### Component-Level Print CSS

In report detail component:

```css
@media print {
  :host {
    color: #111827;
  }

  .print-hidden,
  .status-page__actions,
  .status-page__secondary {
    display: none !important;
  }

  .status-page,
  .report-main,
  .report-side,
  .report-grid,
  .narrative-grid {
    display: block;
  }

  .report-card,
  .report-hero,
  .snapshot-notice {
    break-inside: avoid;
    box-shadow: none;
    border-color: #cbd5e1;
    margin-bottom: 12px;
  }

  a {
    color: #111827;
    text-decoration: underline;
  }
}
```

### Global Print CSS

If component-scoped CSS cannot hide shell chrome, add to `apps/web/src/app/app.scss`:

```css
@media print {
  .topbar,
  .project-shell__header,
  .project-shell__nav {
    display: none !important;
  }

  .app-shell,
  .content-shell {
    display: block;
    padding: 0;
    max-width: none;
    background: #ffffff;
  }
}
```

Keep this global print CSS generic and conservative. It should improve report printing without damaging ordinary browser rendering.

## Testing

### API Unit/Service Tests

Add or extend API tests in:

```text
apps/api/tests/status-reports.test.ts
```

Cover:

- renderer includes metadata, narrative, counts, milestones, risks, recent work, and snapshot notice;
- renderer escapes Markdown table/link-sensitive characters;
- export endpoint returns `text/markdown; charset=utf-8`;
- export endpoint returns attachment filename;
- export endpoint body contains seeded-style report sections;
- contributor can export;
- archived project report can export if fixture supports it;
- report cannot be exported through another project route;
- missing report returns 404.

If the renderer grows enough behavior, add a dedicated test file:

```text
apps/api/tests/status-report-markdown-renderer.test.ts
```

Keep renderer tests pure and exact; keep endpoint tests focused on permission, headers, and route behavior.

### Angular Unit Tests

Extend:

```text
apps/web/src/app/features/projects/status-reports/project-status-report-detail-page.component.spec.ts
apps/web/src/app/core/worktrail-api.service.spec.ts
```

Cover:

- detail page renders Copy Markdown, Download Markdown, and Print actions after report load;
- copy action calls export endpoint and `ClipboardService.copyText`;
- copy success and failure feedback;
- download action calls export endpoint and triggers `downloadBlob`;
- filename comes from `Content-Disposition`;
- contributor-authored/read path still sees sharing controls;
- actions do not appear in loading/error-only states if that is the chosen UX;
- API service uses `/api/projects/:projectId/status-reports/:reportId/export.md`.

Testability note:

- If `downloadBlob` is difficult to spy on as a free function, wrap it in a small injectable `DownloadService` only if needed. Otherwise follow existing component test patterns around CSV export.

### Playwright

Extend `e2e/worktrail-smoke.spec.ts`.

Add coverage to the v0.1.8 status report smoke or a new focused test:

- open seeded report detail;
- click `Copy Markdown`;
- verify success status;
- click `Download Markdown`;
- inspect downloaded file text with existing `downloadText`;
- assert downloaded content includes:
  - `# Worktrail App weekly status`;
  - published snapshot note;
  - `## Snapshot Counts`;
  - a milestone link;
  - a risk link;
- switch to contributor;
- open seeded report;
- verify Copy/Download remain visible and Create report remains absent on list;
- set mobile viewport and ensure no horizontal overflow.

Clipboard verification in Playwright can rely on success UI instead of reading OS clipboard.

### Print

Automated print preview is not necessary in v0.1.9. Component/unit tests can assert print CSS classes exist only if useful. Playwright should verify mobile overflow after sharing controls are added.

## Seed Data

No new seed data is required.

The existing seeded report from v0.1.8 is sufficient:

```text
10000000-0000-4000-8000-000000000651
```

If implementation changes seed titles or report content, update Playwright expectations accordingly.

## Documentation And Site

Update:

- `README.md`;
- `site/index.html` if product copy should mention portable status reports;
- `docs/v0.1.9/release-notes.md`;
- `docs/v0.1.9/pattern-extraction-notes.md`.

Pattern notes should be destination-neutral and cover:

- immutable-record text exports;
- server-side rendering for non-JSON responses;
- relative links in portable artifacts;
- copy/download/print as sharing affordances before delivery infrastructure;
- criteria for deferring templates, subscriptions, and PDF generation.

## Verification

Suggested final commands:

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

Run focused tests after each major phase:

```sh
npm test --workspace @worktrail/api -- tests/status-reports.test.ts
npm test --workspace @worktrail/web -- --include src/app/features/projects/status-reports/project-status-report-detail-page.component.spec.ts --include src/app/core/worktrail-api.service.spec.ts
npx playwright test e2e/worktrail-smoke.spec.ts -g "status reports"
```

## Risks And Mitigations

### Markdown Escaping Gaps

Risk: user-entered titles or narrative could break tables or links.

Mitigation: keep tables limited to compact snapshot rows, escape table cells and link labels, and add exact renderer tests with pipes, brackets, and parentheses.

### Server And Client Link Drift

Risk: API Markdown link serialization could drift from Angular project Work query serialization.

Mitigation: implement only the project-scope subset required for report risk links, use the same query field names, and add endpoint/renderer tests for representative risk queries.

### Print CSS Bleed

Risk: global print CSS could affect non-report pages.

Mitigation: keep global print rules limited to app and project shell chrome; put report-specific print behavior in the report detail component.

### Export Endpoint Scope Creep

Risk: Markdown export could become a generic report rendering layer.

Mitigation: renderer accepts only `ProjectStatusReportDetailDto`, has no template registry, no persistence, and no delivery concepts.

### Download Filename Edge Cases

Risk: long or punctuation-heavy report titles create awkward filenames.

Mitigation: slugify, cap length, and use deterministic fallbacks.

## Deferred Work

These are explicitly not part of v0.1.9:

- PDF rendering;
- email, Slack, webhook, or scheduled delivery;
- report recipients or subscriptions;
- report approval/sign-off;
- rich text;
- custom report templates;
- report edit/correction flows;
- report export history;
- workspace rollups;
- public unauthenticated links;
- generic document rendering infrastructure.
