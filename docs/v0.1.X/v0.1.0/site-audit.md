# Worktrail v0.1.0 Public Site Audit

## Summary

The static site has a strong foundation: a real product screenshot, restrained visual styling, clear local-run instructions, and honest positioning as a reference app. The main issue is accumulation. The page is starting to read like a release-history inventory rather than a polished public introduction.

For v0.1.0, the site should stop trying to name every feature in the hero and first product section. It should present a sharper story:

> Worktrail is a focused project-management reference app for daily work, dependency-aware planning, and cloud-shaped TypeScript application patterns.

The product has enough scope now that the site needs hierarchy more than detail.

## Audit Basis

This audit reviewed:

- `site/index.html`.
- `site/styles.css`.
- static assets in `site/assets`.
- a rendered desktop and mobile pass of the static page.

Observed content signals:

- Hero description is 64 words.
- The App intro paragraph is 106 words.
- The App section has 17 equal-weight feature cards.
- `site/index.html` is 315 lines and `site/styles.css` is 399 lines.

No site files were modified for this audit.

## Highest-Impact Recommendations

### 1. Replace The Feature Inventory With A Product Story

The current hero and App section try to include nearly every capability: My Work, discovery, saved views, quick capture, governance, permissions, keys, milestones, boards, relationships, dependency signals, delivery health, planning review, comments, CSV, preview, readiness, and cloud deployment.

Recommendation:

- Cut the hero paragraph to 25-35 words.
- Make the hero answer only:
  - what Worktrail is;
  - why it exists;
  - what kind of app it demonstrates.
- Move detailed capabilities into grouped sections below.

Suggested hero direction:

> A local-first project-management reference app for daily work, dependency-aware planning, and production-shaped TypeScript architecture.

Then use the supporting sections to explain the proof.

Why this matters:

- The public site has one chance to orient a reader.
- A long hero list makes the product feel less mature, even though the underlying app has become more mature.

### 2. Collapse 17 Feature Cards Into 4-6 Capability Groups

The App section currently has 17 same-weight cards. This makes small capabilities compete with major product pillars.

Recommendation:

- Replace the flat grid with grouped capability bands.
- Use 4-6 primary groups, each with 2-4 supporting bullets or mini-links.

Suggested groups:

- `Daily execution`: My Work, quick capture, comments, activity.
- `Work discovery`: cross-project filters, saved views, CSV export.
- `Project planning`: milestones, board, delivery health, planning review.
- `Dependency visibility`: relationships, blockers, dependency filters.
- `Workspace governance`: members, roles, archived/read-only behavior.
- `Operational reference`: API docs, readiness, production preview, cloud-shaped boundaries.

This keeps all current features represented without forcing every one into a card.

### 3. Separate Product Value From Technical Reference Value

The page currently blends product features and architecture patterns in the same narrative. That is accurate for Worktrail, but it weakens both messages.

Recommendation:

- Add a clearer two-audience structure:
  - `For product evaluators`: what the app lets a team do.
  - `For developers`: what patterns the codebase demonstrates.
- Keep `Architecture` as a developer section.
- Keep `The App` as a product section.

Suggested site flow:

1. Hero: concise identity and actions.
2. Product screenshot plus 3-4 outcome metrics.
3. Product capabilities grouped by workflow.
4. Technical architecture grouped by codebase pattern.
5. What is intentionally out of scope.
6. Run locally.

Why this matters:

- Worktrail is both a product surface and a reference implementation.
- The site should not make readers infer which claims are user-facing and which are developer-facing.

### 4. Turn Release Additions Into A "v0.1.0 Baseline" Section

The current copy names sprint additions directly, especially v0.0.7, v0.0.8, and v0.0.9. That was useful during sprint-by-sprint growth, but v0.1.0 should feel like a consolidated baseline.

Recommendation:

- Remove release-by-release prose from the main page.
- Add a concise `v0.1.0 baseline` section:
  - daily workflow;
  - planning and delivery health;
  - dependency model;
  - data portability;
  - operations and docs.
- Link to version docs in the footer for detailed history.

Why this matters:

- Public readers generally care about current capability, not the order features arrived.
- Moving release history out of the primary narrative supports the v0.1.0 reset.

### 5. Refresh The Screenshot Strategy

The current hero uses `worktrail-board.png`, which is good because it shows the real app. But v0.1.0 positioning is increasingly about planning, health, and cross-project work, not only board movement.

Recommendation:

- Keep one real app image in the hero.
- Update it to the most representative v0.1.0 experience after UX consolidation:
  - project overview with delivery health;
  - planning review;
  - or a composed but real screenshot showing project navigation plus work list/health.
- Add one secondary image or inset later in the page only if it clarifies the product story.
- Avoid adding many screenshots; the site is already content-heavy.

Why this matters:

- The hero image should show the current product center of gravity.
- Board-only imagery undersells dependency-aware planning and health, which are now differentiating features.

## Section-Level Recommendations

### Hero

Current issue:

- The hero paragraph is a long capability list.
- The meta description and Open Graph description have the same additive pattern.

Recommended changes:

- Shorten hero copy to one clear sentence plus one supporting sentence if needed.
- Use action labels that map to audience:
  - `View source`;
  - `Run locally`;
  - optionally `Read docs`.
- Reduce metadata descriptions to one concise positioning statement.

Suggested meta description:

> Worktrail is a local-first project-management reference app for daily work, delivery health, dependency visibility, and production-shaped TypeScript architecture.

### Signal Band

Current issue:

- `Angular`, `Postgres`, `Health`, and `CSV` are useful but mix stack and feature concepts.

Recommended alternatives:

- Product-oriented:
  - `Daily work`;
  - `Dependencies`;
  - `Delivery health`;
  - `Data portability`.
- Developer-oriented:
  - `Angular`;
  - `TypeScript API`;
  - `Postgres`;
  - `OpenAPI`.

Pick one framing. Do not mix both in the same four-item band.

### The App

Current issue:

- The intro paragraph repeats sprint history and operational details.
- The card grid is too flat and too long.

Recommended changes:

- Rename to `Product Workflow` or `What The App Does`.
- Replace the release-history paragraph with a workflow summary.
- Convert the 17 cards into grouped capability sections.
- Use fewer, stronger headings:
  - `Start the day`;
  - `Find the work`;
  - `Plan the delivery`;
  - `Understand dependencies`;
  - `Govern the workspace`.

### Capabilities

Current issue:

- The `Capabilities` section overlaps heavily with `The App`.
- It repeats My Work, discovery, saved views, relationships, dependency filters, CSV, and delivery health.

Recommendation:

- Either remove this section or repurpose it as `v0.1.0 baseline`.
- If retained, make it a compact checklist rather than another prose-heavy explanation.

### Operations

Current issue:

- This section is focused and useful.

Recommended changes:

- Keep it, but make the heading less broad:
  - `Production-Shaped Local Preview`;
  - or `Operational Reference`.
- Keep the four cards.
- Link directly to OpenAPI and the operations runbook from this section, not only the footer.

### Architecture

Current issue:

- The architecture panel is useful, but it has grown to nine rows and could become another inventory.

Recommendation:

- Group rows into fewer layers:
  - `Frontend`;
  - `API boundary`;
  - `Domain services`;
  - `Persistence`;
  - `Operations`.
- Keep relationship services, delivery health, CSV flows, and Playwright as examples under the relevant layer instead of top-level rows.

### Current Scope

Current issue:

- The limitation paragraph is honest but long and reads like a non-goals dump.

Recommendation:

- Keep the honesty.
- Convert to three concise groups:
  - `Not a hosted SaaS`;
  - `Not a forecasting suite`;
  - `Not an integration platform`.
- Link to PRDs or README for detailed non-goals.

### Run Locally

Current issue:

- The command block is good.

Recommended changes:

- Add `npx playwright install chromium` only if the site wants a complete local verification path.
- Add a link to README setup.
- Keep commands short; this section should remain practical.

## Recommended v0.1.0 Page Outline

### Option A: Single-Page Public Site

1. `Hero`
   - H1: Worktrail.
   - concise positioning.
   - real app screenshot.
   - `View source`, `Run locally`.

2. `Product Workflow`
   - grouped capabilities around daily execution, discovery, planning, dependencies, governance.

3. `v0.1.0 Baseline`
   - compact checklist of consolidated current scope.

4. `Architecture`
   - grouped technical layers.

5. `Operations`
   - preview, readiness, OpenAPI, runbook.

6. `Scope`
   - what Worktrail intentionally is not.

7. `Run Locally`
   - commands and README link.

### Option B: Two-Audience Page

1. Hero.
2. `For project teams`: product workflow.
3. `For developers`: architecture and operations.
4. `Current scope and limits`.
5. `Run locally`.

This may be the stronger model because Worktrail is explicitly both a product and a reference app.

## Copy Guidelines

Use these rules for v0.1.0 site copy:

- No paragraph should list more than 4 concepts.
- Avoid release numbers in primary marketing copy.
- Use current-tense product language instead of sprint-history language.
- Prefer grouped concepts over feature-by-feature enumeration.
- Keep details in docs links, not the landing page.
- Mention `local-first` and `reference app` early.
- Mention `delivery health` and `dependencies` as differentiators, not just another item in a list.
- Be explicit that production preview is not hosted production auth.

## Visual Recommendations

The existing visual design can stay. Polish should focus on hierarchy:

- Reduce the App grid from 17 cards to 5 grouped panels or 6 feature groups.
- Give the most important product story a wider layout, not equal cards.
- Use the signal band to reinforce the page thesis.
- Keep card radius and restrained styling consistent with the app.
- Avoid adding decorative sections; use real screenshots and concise copy.
- On mobile, make grouped sections shorter so the page does not become a long stack of small cards.

## Maintenance Recommendations

The site should become easier to update without additive copy creep.

Recommendations:

- Add a short comment in `site/index.html` describing the intended section roles.
- Keep release-specific docs in footer links.
- Add a simple "site update checklist" to docs or PR notes:
  - update hero only if positioning changed;
  - update capability groups only if a new feature changes a workflow pillar;
  - update footer docs links each release;
  - refresh screenshot when the primary app experience changes.
- Consider moving repeated feature data into a small JSON or template only if the static page keeps growing. It is not necessary yet.

## Suggested v0.1.0 Rewrite Priorities

1. Shorten hero and metadata.
2. Replace the 17-card App grid with grouped workflow sections.
3. Remove sprint-history prose from primary sections.
4. Repurpose Capabilities into `v0.1.0 Baseline` or remove it.
5. Group Architecture rows.
6. Simplify Current Scope into three clear limitation groups.
7. Refresh the hero screenshot after the app UX consolidation lands.

## Success Criteria

The v0.1.0 public site should be considered polished if:

- A visitor can explain Worktrail in one sentence after the hero.
- The first product section communicates workflows, not release history.
- The site represents all major capabilities without showing 17 equal feature cards.
- Product and developer value are both clear.
- Release-specific detail lives in docs links instead of main copy.
- The page feels like a consolidated v0.1.0 baseline, not v0.0.1 through v0.0.9 appended together.

## Bottom Line

The site does not need a redesign. It needs editorial hierarchy. Keep the current visual language and real app imagery, but move from additive feature inventory to a consolidated v0.1.0 story: daily work, dependency-aware planning, delivery confidence, data portability, governance, and production-shaped TypeScript architecture.
