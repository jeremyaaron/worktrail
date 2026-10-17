# Worktrail v0.2.9 Phase 10 Verification

Verified locally on October 17, 2026. This records Phase 10 implementation evidence and Phase 11
final-tree verification, not publication or internet-safe deployment. Release documentation,
public-site source, metadata, and local gates are complete; merge, tag, and deployment are separate.

## Environment And Isolation

- macOS 26.5.1, arm64; Node 20.19.1.
- Playwright Chromium 149.0.7827.55; Karma Chrome Headless 155.0.0.0.
- Disposable PostgreSQL 16 container `worktrail-v029-p10-verify`, database
  `worktrail_v029_verify`, bound only to `127.0.0.1:55965`.
- All attachment roots were beneath the phase-owned temporary directory
  `/tmp/worktrail-v029-p10-storage-dCgAqf`. No working database or attachment directory was used.
- Application browser checks used API port 3000 and Angular port 4315; compiled preview used 4319.
  The standalone editor fixture uses its separate Playwright configuration.

Database-backed commands below were invoked with the disposable `DATABASE_URL` and isolated storage
environment explicitly set. They are destructive and must not be copied against working data.
For the full application suite, both original and test attachment roots were owned temporary paths,
so `WORKTRAIL_E2E_SKIP_DB_RESTORE=false` was safe and intentional: per-file resets and global teardown
restored the deterministic demo between workflows. The editor fixture needs no database.

## Seed And Migration Evidence

The existing demo keeps its active work-item IDs, titles, statuses, and planning relationships.
Authored examples now include:

| Context | Example |
| --- | --- |
| WT-1 | Markdown requirements, acceptance list, emphasis, and HTTPS reference |
| WT-2 | Markdown reproduction steps and a literal/unsupported-source edited comment |
| WT-3 | Legacy plain-text punctuation; formatted code comment with existing explicit mentions; deleted-comment tombstone |
| LEGACY-1 | New archived work item with readable formatted decision and review comment |

The archived project's next item number is 2, preserving allocation safety if reactivated. Comment
upserts restore `bodyFormat` and the supplied deterministic timestamp alongside source. Deleted
source remains stored but never appears in the browser tombstone or an editor.

A fresh reset/migration/seed followed by a second seed produced identical complete rows in
`work_items`, `comments`, `comment_mentions`, `activity_events`, `work_item_attachments`,
`notifications`, and `project_status_reports`. The comparison used PostgreSQL JSON rows and Node
deep equality, not counts alone. The resulting demo has 27 work items (3 Markdown, 24 plain text)
and 5 comments (4 Markdown, 1 plain text, including the deleted row).

The full API suite also passed the additive authored-content migration tests, including preservation
of historical source and format constraints. No additional migration was introduced in Phase 10.

## Verification Results

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, zero warnings |
| `npm run typecheck` | Passed across all workspaces |
| `npm test` | 1,305 passed: 600 API, 651 Angular, 54 contracts |
| `npm run build` | Passed, no budget warnings |
| `npm run test:e2e` | All 34 application browser tests passed, retries disabled |
| `npm run test:editor` | All 5 standalone editor browser tests passed |
| `npx playwright test --config playwright.production.config.ts` | Compiled production preview passed |
| `npm audit --omit=dev --audit-level=low` | Zero production vulnerabilities |
| Development-inclusive `npm audit` | 34 findings: 8 moderate, 21 high, 5 critical |
| `git diff --check` | Passed |

The development-inclusive findings are the existing toolchain backlog, not a clean audit result.
They were also present during Phase 6. No package versions, lockfile entries, or overrides changed
in this phase. Resolving them needs a separately verified toolchain upgrade; production-only audit
success does not erase their risk when using development tools.

The first full browser run exposed two issues, both corrected before the all-pass run:

- A code-bearing seeded comment expanded implicit grid tracks on mobile. The detail panel, comment
  list, and comments now allow shrinking; the list uses `minmax(0, 1fr)`. Long code scrolls inside its
  own focusable region, not the page. New coverage checks this at 640, 390, and 320 CSS pixels.
- The portfolio browser test assumed a July fixture would remain "On track" indefinitely. It now
  checks the displayed health label against the current portfolio API response. Domain health rules
  remain independently tested; fixture dates and production health calculations were not changed.

Authored-description/comment/security files restore their demo data between files, preventing
newly created test items from leaking into older pagination and count checks.

## Security And Workflow Coverage

New browser security coverage reads and previews hostile Markdown, including raw scripts, styles,
SVG, iframe and image source, event handlers, internal API destinations, obfuscated JavaScript/data
URLs, credentials, protocol-relative destinations, and complete-source fallback. It checks:

- No active/embedded DOM nodes, event-handler attributes, source attributes, or inline styles.
- Only explicit validated HTTP(S) anchors, with defensive link attributes.
- No automatic third-party requests or unexpected browser mutation/import/export/settings calls.
- Literal raw HTML, image alternative text, and rejected link evidence remain readable.
- Preview and saved presentation produce identical markup for the same source/format pair.
- Deleted source is absent, legacy punctuation is literal, and archived formatted content is readable.
- Archived description writes, comment creation, and comment edits return the existing 409 conflict.

The full existing browser suite also passed creation through global/project/child routes, conversion,
cancel/reload, multiline CSV import, explicit mentions, comment edit/failure retention, Quick Find and
Files targeting, attachment lifecycle, lists/saved views, board behavior, dependencies, hierarchy,
planning, report workflows, and closeout snapshots. API regressions additionally cover notification
deduplication, unchanged write pairs, legacy exceptions, locking, exports, and immutable snapshots.

Compiled-preview checks serve built assets through the production Express adapter, not `ng serve`.
They cover work-item and board deep links, reload, Markdown preview, archived reads, hashed main
assets, absence of the Vite client, no page errors, and unknown API routes returning 404 rather than
the application shell. Unknown API routes retain the existing Express 404 response contract.

## Layout And Accessibility Evidence

Browser assertions cover widths 1440, 1024, 640, 390, and 320 CSS pixels, requiring no page overflow
and local scrolling/focusability for long code. Captures are under ignored `test-results`, including
`hostile-*`, `fallback-*`, `code-320.png`, and `production-*`. Desktop, compact fallback, mobile
preview, and focused code captures were visually inspected; the focused code capture confirms
readable source rather than relying only on DOM text assertions.

The 640-pixel viewport is reflow evidence equivalent in available CSS width to a 1280-pixel viewport
at 200 percent zoom. It is not an actual browser-chrome zoom test. Keyboard tests exercise trusted
typing undo/redo, preview transitions, formatting, selection/focus restoration, link entry/cancel,
tooltips, and prevention of accidental form submission. Synthetic composition/input events verify
that formatting and preview remain disabled during composition and the final value is committed.

Real OS IME composition, actual browser zoom, and screen-reader announcements were not manually
tested. These remain explicit manual validation limitations, not inferred passes from automation.

## Local Timing Evidence

The standalone fixture wraps `MarkdownIt.prototype.parse` only while measuring the application's
real parser/projection path, restoring it in `finally`. Each case has 5 warm-ups and 30 measured
samples. The remainder after parser timing includes projection, normalization, and policy overhead;
it is not pure projection time or Angular rendering time. Browser clock precision can report zero
for very small intervals. The following is one recorded Chromium run on the environment above.

| Case | UTF-16 Units | Result | Parser Median / P95 ms | Projection + Policy Median / P95 ms | Total Median / P95 / Max ms |
| --- | ---: | --- | ---: | ---: | ---: |
| Ordinary prose | 10,000 | Markdown | 0.7 / 0.8 | 0 / 0.1 | 0.8 / 0.8 / 0.9 |
| Nested quotations | 204 | Complete fallback | 0 / 0.1 | 0 / 0.1 | 0 / 0.1 / 0.1 |
| Delimiter heavy | 10,000 | Complete fallback | 3 / 3.9 | 0.1 / 0.2 | 3.1 / 4.1 / 4.3 |
| Dense lists | 10,000 | Complete fallback | 4.8 / 5.2 | 0.1 / 0.3 | 4.9 / 5.5 / 5.5 |
| Reference expansion | 2,349 | Complete fallback | 0.1 / 0.2 | 0.1 / 0.2 | 0.3 / 0.3 / 0.3 |

All samples met the local under-50 ms ordinary and under-100 ms adversarial targets. CI records
timing JSON but does not assert elapsed-time thresholds on shared runners. These results are not
production latency guarantees or a claim of bounded CPU time for every possible input.

## Bundle And CI Evidence

The production build's initial raw size is 386.62 kB (104.33 kB estimated transfer). Existing budgets
remain 550 kB warning / 1 MB error initially and 8 kB warning / 12 kB error for component styles.
Build-stat graph inspection places the 131.73 kB authored parser/viewer/editor chunk outside the
static initial dependency graph. Viewer/editor styles are approximately 0.94 / 1.94 kB. Fixture
benchmark instrumentation is not included in application production inputs.

CI now includes production dependency audit, the full application browser suite, compiled production
preview, and browser failure artifact upload, in addition to the existing package/editor gates. The
workflow uses its disposable PostgreSQL service and runner-temporary attachment roots. These steps
passed locally; a remote GitHub Actions run was not triggered in this phase.

Local actor selection, local attachment storage, and existing deployment/security limitations remain
unchanged. Phase-owned servers, the disposable container, and temporary storage are removed after
verification; working data and unrelated processes are preserved.

## Phase 11 Final Verification

Finalization ran against the versioned `0.2.9` tree, not just the earlier phase results. It used
PostgreSQL 16 container `worktrail-v029-p11-verify`, database `worktrail_v029_verify`, bound to
`127.0.0.1:62767`, and owned roots under `/tmp/worktrail-v029-p11-storage-f5KXyA`. Migrations and two seed
runs passed. Package tests used the `tests` storage root; browser runs used separate `original` and
`e2e` roots with restoration enabled. Working data was never reset, migrated, or reseeded.

Final commands and results:

| Command or Check | Result |
| --- | --- |
| `npm run lint` | Passed, zero warnings |
| `npm run typecheck` | Passed across all workspaces |
| `npm test` | 1,306 passed: 601 API, 651 Angular, 54 contracts |
| `npm run build` | Passed, no budget warnings; initial 386.62 kB / estimated transfer 104.33 kB |
| `npm run test:e2e -- --retries=0` | All 34 passed |
| `npm run test:editor` | All 5 passed |
| `npx playwright test --config playwright.production.config.ts` | Compiled production-preview check passed on port 4319 |
| `npm audit --omit=dev --audit-level=low` | Zero production vulnerabilities |
| Development-inclusive `npm audit --json` | 34 findings: 8 moderate, 21 high, 5 critical; expected nonzero audit status |
| `npm ls --workspaces --depth=0` | Passed; all workspace versions/contracts resolution are 0.2.9 |
| Parsed package/lockfile/OpenAPI checks | Versions and dependency metadata agree; OpenAPI internal references resolve; historical reads have no new cap |
| Static site and documentation checks | Assets, fragments, local documentation targets, image loading, and horizontal containment pass |
| Pages configuration | Unchanged `main` push trigger, `site` artifact, main-only deployment guard |
| `git diff --check` | Passed |

The additional API test imports `authored-work-items.csv` through the real preview/apply service and
checks stored source and formats. The final editor run again met timing targets; ordinary maximum
total was 2.3 ms and the slowest adversarial maximum was 6.3 ms on this local run. The Phase 10 timing
table remains its own identified run rather than mixing measurements from different executions.

Captured `site/assets/worktrail-detail.png` from the compiled application at 1440 x 900 after the
browser suite restored demo data. The public site now presents Readable Work, faithful preview,
explicit mentions, compatibility, and the bounded Markdown profile without claiming a rich document
platform or hosted application. Typography uses fixed breakpoint sizes; existing branding and Pages
deployment are retained.

Static-file browser checks passed at 1920, 1440, 1024, 640, 390, and 320 CSS pixels, with zero horizontal
overflow, all images loaded, and text/link bounds inside the viewport. Desktop/mobile hero and product
captures plus the actual detail asset were visually inspected. Hero captures leave the following
section visible at the tested 900-pixel viewport height. Site screenshot links open the full asset.
Site evidence is ignored under `test-results/site-*`; only the intentional product asset is tracked.
Repository documentation links were checked against local targets intended to land with the merge,
not claimed to be published on remote `main` already.

No new user UAT, remote CI run, actual browser-chrome zoom, real OS IME, or screen-reader pass is claimed.
The existing development-toolchain vulnerabilities and deployment/security limitations remain in the
release notes. All phase-owned serving processes, the disposable container, and temporary storage
were cleaned up; original listeners and working resources were preserved. No commit, push, tag,
publication, merge, or deployment was performed.
