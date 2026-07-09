# Worktrail v0.2.0 Public Site Audit

## Summary

The static product site has kept pace with Worktrail's feature growth, but it has done so by adding release detail to the same page structure. The result is honest and comprehensive, but not yet polished enough for a v0.2.0 baseline.

The site is no longer suffering from the exact v0.1.0 problem of 17 equal-weight feature cards. It now has stronger grouping. The new issue is that the page reads like an annotated release digest. The hero, App, Baseline, Architecture, Current Scope, and footer all carry accumulated v0.1.x details.

Recommended v0.2.0 site theme:

> Present Worktrail as a coherent current product and reference implementation, not as the sum of nine more sprints.

The v0.2.0 site should be shorter, sharper, and more editorial. It should tell visitors what Worktrail is, what workflows it demonstrates, why the codebase is useful, and what remains intentionally out of scope.

## Audit Basis

This audit reviewed:

- `site/index.html`.
- `site/styles.css`.
- `site/assets/worktrail-board.png`.
- The previous v0.1.0 site audit in `docs/v0.1.0/site-audit.md`.
- A rendered desktop and mobile pass of the static page.

Observed content signals:

- `site/index.html` is 328 lines.
- `site/styles.css` is 434 lines.
- The hero description is 33 words.
- The App intro is about 101 words.
- The Baseline intro is about 135 words.
- The page has 12 feature cards total across product and operations sections.
- The Architecture panel has 16 equal-weight rows.
- The footer still points to v0.1.9 docs and pattern notes.

No site files were modified for this audit.

## What Improved Since v0.1.0

The site did absorb some previous recommendations.

- The hero uses a real app image and the hero copy is much shorter than it was at v0.1.0.
- The flat 17-card App section has been reduced into broader product groups.
- The page now distinguishes Product, Baseline, Operations, Architecture, Current Scope, and Run locally.
- The Operations section is still focused and useful.
- The page remains visually restrained and does not overpromise hosted SaaS capability.

The problem is now less structural and more editorial. The current page has a good skeleton, but the copy is still carrying sprint history.

## Highest-Impact Recommendations

### 1. Remove Release Chronology From The Main Narrative

The App and Baseline sections both explain the product through v0.1.0, v0.1.1, v0.1.2, and so on. That made sense while documenting incremental progress, but public visitors should meet the current product first.

Recommendation:

- Rewrite the App section without version numbers.
- Rewrite the Baseline section as `v0.2.0 baseline`, not a v0.1.x timeline.
- Move detailed release history into links:
  - `Release docs`;
  - `Pattern notes`;
  - `Audit notes`;
  - or a dedicated `History` link in the footer.

Suggested App intro direction:

> Worktrail gives a small team the core surfaces of project execution: a daily queue, collaboration inbox, shared work views, project planning, milestone review, and status reporting, all backed by deterministic local data.

Why this matters:

- Release chronology makes the product feel assembled rather than consolidated.
- v0.2.0 should read as a coherent baseline.

Suggested acceptance check:

- A visitor can read the first two sections without seeing sprint-by-sprint version references.

### 2. Tighten The Hero Around One Product Promise

The hero is shorter now, but it still lists many features: daily work, reliable filtered views, pinned lenses, batch triage, milestone review, reports, collaboration updates, dependency-aware planning, and architecture.

Recommendation:

- Keep the H1 as `Worktrail`.
- Use one crisp product sentence and one developer-reference sentence.
- Move feature inventory into grouped sections below.
- Shorten meta and Open Graph descriptions the same way.

Suggested hero copy:

> A local-first project-management reference app for daily work, planning review, dependency visibility, and status reporting.
>
> Built with Angular, a TypeScript API, Postgres, and production-shaped boundaries for teams studying full-stack product patterns.

Why this matters:

- The hero should orient, not enumerate.
- The current hero is readable, but it still tries to be a complete feature map.

### 3. Replace The Signal Band With Audience-Specific Signals

The current signal band mixes product and technical claims:

- Reliable views;
- Planning;
- Reference;
- Cloud path.

These are all valid, but they combine user outcomes, feature areas, and implementation strategy in one row.

Recommendation:

- Pick one framing for the signal band.
- Product framing:
  - `Daily queue`;
  - `Shared views`;
  - `Planning review`;
  - `Status reports`.
- Developer framing:
  - `Angular SPA`;
  - `TypeScript API`;
  - `Postgres`;
  - `OpenAPI + CI`.
- Better: make the signal band bridge both audiences with paired labels:
  - `Use`: daily work, shared views, planning, reports.
  - `Study`: contracts, endpoint handlers, Postgres, operational preview.

Why this matters:

- The homepage is trying to serve product readers and developer readers.
- The signal band should help them self-orient immediately.

### 4. Consolidate The App Section Into Fewer Workflow Pillars

The App section currently has eight product cards. That is better than 17, but still dense because several cards contain long bullet lists.

Recommendation:

- Reduce to four workflow pillars:
  - `Start the day`: My Work, Inbox, mentions, watchers.
  - `Find and shape work`: filters, saved/pinned views, create, batch triage, CSV.
  - `Operate projects`: project shell, board, planning review, milestones, dependency signals.
  - `Share status`: generated drafts, immutable snapshots, Markdown, print.
- Keep each pillar to three bullets.
- Move details such as tombstones, owner/maintainer permissions, contributor access, and exact risk categories to docs links or a compact capability checklist.

Why this matters:

- The page should communicate workflow shape, not prove every edge case.
- Feature completeness is now credible; the site can afford to summarize.

### 5. Rework `v0.1.9 Baseline` Into A v0.2.0 Positioning Section

The current Baseline section repeats the release-history pattern and overlaps with the App section. It is the densest copy block on the page.

Recommendation:

- Rename it to `v0.2.0 baseline`.
- Make it a short statement of what Worktrail now demonstrates.
- Keep the three audience cards, but shorten each:
  - `For users`: daily work, project operation, reporting.
  - `For builders`: contracts, query state, domain services, endpoint boundaries.
  - `For operators`: migrations, seed data, preview, health checks, CI.
- Remove version-by-version prose from this section.

Why this matters:

- This should be the v0.2.0 reset point.
- The current section duplicates both Product and Architecture.

### 6. Group The Architecture Panel Into Fewer Layers

The Architecture panel has 16 equal-weight rows. It is useful, but it has become another feature inventory.

Recommendation:

- Group architecture into five layers:
  - `Frontend`: Angular SPA, lazy routes, responsive work surfaces.
  - `API boundary`: endpoint handlers, request validation, OpenAPI, actor headers.
  - `Domain`: work item commands, saved views, delivery health, notifications, reports.
  - `Persistence`: Postgres, Drizzle migrations, JSONB snapshots, deterministic seed data.
  - `Operations`: preview build, health checks, CI, Playwright smoke.
- Use examples inside each layer rather than separate rows for every feature.
- Link to `docs/v0.2.0/tech-debt-audit.md` once committed or to the current technical docs when v0.2.0 docs exist.

Why this matters:

- Developer readers need the architecture mental model more than a row-by-row inventory.
- Grouping makes the codebase look more intentional and easier to study.

### 7. Refresh The Screenshot Strategy

The hero image still shows a board. It is real and useful, but Worktrail's center of gravity has moved toward daily queues, saved views, planning review, milestone review, reports, and collaboration.

Recommendation:

- Replace or supplement the hero screenshot with the v0.2.0 primary product surface after UX cleanup.
- Strong candidates:
  - My Work plus Inbox badge for daily operation;
  - project Planning review for health/risk positioning;
  - project Work with pinned views and filters after control consolidation;
  - status report detail if public positioning emphasizes reporting.
- Avoid a screenshot collage unless the composition remains clean.
- Consider one secondary screenshot in the Product section if the hero remains board-focused.

Why this matters:

- A board screenshot undersells the newer operating and reporting workflows.
- The first visual should show what makes Worktrail different from a generic task board.

### 8. Shorten Current Scope Into Three Explicit Non-Goals

The Current Scope paragraph is honest, but it is a long comma-separated list of exclusions.

Recommendation:

- Convert it into three non-goal cards:
  - `Not a hosted SaaS`: no production auth, invitations, hosted infrastructure, or internet-safe deployment.
  - `Not an enterprise workflow suite`: no custom roles, custom workflows, approvals, signoff, or automation.
  - `Not a reporting/forecasting platform`: no PDF, scheduled delivery, public links, forecasting, roadmap, critical path, or analytics.
- Follow with one short paragraph:
  - Worktrail's value is a working local product and reference boundary for studying patterns before extraction.

Why this matters:

- The honesty is important, but the current wall of non-goals makes the page feel defensive.
- Grouped non-goals communicate scope with more confidence.

### 9. Update Footer And Navigation For v0.2.0

The footer still points to v0.1.9 docs and pattern notes. The navigation uses `Baseline`, which currently links to v0.1.9 content.

Recommendation:

- Update footer links once v0.2.0 docs exist:
  - `v0.2.0 docs`;
  - `UX audit`;
  - `Tech debt audit`;
  - `Site audit`;
  - `OpenAPI`;
  - `Runbook`.
- Rename nav `Baseline` to `v0.2.0` or `Reference`.
- Consider dropping one nav item on mobile; the current topbar remains readable but crowded.

Why this matters:

- The public site should reinforce the new release baseline.
- Footer links are the clean place for detailed history and audit artifacts.

## Recommended v0.2.0 Page Flow

### 1. Hero

- H1: `Worktrail`.
- One product sentence.
- One reference-app sentence.
- Actions: `View source`, `Run locally`, optionally `Read v0.2.0 notes`.
- Screenshot: current v0.2.0 app center of gravity.

### 2. Product Workflow

Four pillars:

- `Start the day`.
- `Find and shape work`.
- `Operate projects`.
- `Share status`.

Keep bullets short. Link detailed release notes elsewhere.

### 3. v0.2.0 Baseline

Three cards:

- `For users`.
- `For builders`.
- `For operators`.

This should state what is now stable enough to build on.

### 4. Architecture Reference

Five grouped layers:

- Frontend.
- API boundary.
- Domain.
- Persistence.
- Operations.

### 5. Current Scope

Three non-goal cards plus one short caveat paragraph.

### 6. Run Locally

Keep the command block. Add direct links to README, runbook, OpenAPI, and v0.2.0 docs.

## Content Cuts To Make

Recommended removals from primary page copy:

- Sprint-by-sprint version narrative in App and Baseline.
- Long lists of every deferred feature in paragraph form.
- Architecture rows that merely name individual features already described elsewhere.
- Low-level details such as tombstones, exact role paths, exact risk categories, and individual export mechanics unless they support a higher-level claim.

Keep these details in docs instead:

- Full release history.
- Exact permission matrix.
- Full OpenAPI details.
- Markdown export route details.
- CSV import/export specifics.
- Audit documents.

## What To Preserve

The current site has several strengths worth keeping.

- Real app imagery rather than abstract art.
- Straightforward local-run commands.
- Honest local-first and production-preview caveats.
- Restrained visual design with good contrast and spacing.
- Clear GitHub/source orientation.
- Separate Operations and Architecture sections.

Do not turn the site into a marketing landing page. Keep it grounded, but make it more selective.

## Success Criteria For v0.2.0

The public site is ready when:

- The hero explains Worktrail in two short sentences.
- Main page copy no longer depends on sprint chronology.
- Product workflow, technical reference, operations, and scope each have distinct jobs.
- The first screenshot represents the current product center of gravity.
- Architecture is grouped by layers, not listed as 16 equal rows.
- Current Scope is candid but scannable.
- Footer links point to v0.2.0 docs and audit artifacts.

## Bottom Line

The site should now do the same consolidation work as the app and codebase: preserve the evidence, remove the additive chronology, and present v0.2.0 as a coherent baseline.

Worktrail has enough product surface to stop proving every feature on the homepage. The v0.2.0 site should make the product easier to understand in one pass, then let the docs carry the details.
