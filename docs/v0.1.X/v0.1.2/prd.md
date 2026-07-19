# Worktrail v0.1.2 PRD

## Summary

Worktrail v0.1.2 should make filtered work views more reliable, shareable, and trustworthy.

The main product theme is Reliable Views And List State. Worktrail already has a strong `WorkItemQuery` model that powers list filters, route query parameters, saved views, dashboard links, delivery-health links, CSV export, and active filter labels. The next sprint should tighten that lifecycle so users can trust that the URL, visible filters, saved views, exports, and linked dashboards all describe the same applied work item set.

This is not a `jawstack` extraction sprint. The pattern is promising, but it should remain app-local until another reference app creates the same pressure. v0.1.2 should improve Worktrail directly while capturing reusable lessons for later extraction.

## Context

Worktrail has grown from a local MVP into a credible project execution reference app:

- work item list and board workflows;
- project planning and delivery health;
- saved personal work views;
- CSV import and export;
- My Work;
- comments, activity, dependencies, mentions, watchers, and Action Inbox;
- local-first Postgres setup with transport-neutral API handlers;
- static Angular frontend suitable for future S3 hosting;
- public static product site through GitHub Pages.

The app now has enough surfaces that query drift becomes a real product risk. A dashboard reason can link to a filtered list. A saved view can hydrate list controls. A CSV export can reuse current filters. A return URL can carry context back from a detail page. If any one of those paths serializes or normalizes query state differently, the user sees a subtle trust break.

The v0.1.2 opportunity note, `docs/v0.1.2/0006-query-contracts-url-state.md`, identifies this as a likely reusable reference-app pattern: typed query contracts and URL state. The practical v0.1.2 interpretation is to harden the Worktrail implementation before generalizing anything.

## Problem

Worktrail's query behavior is useful but spread across multiple layers and helper functions.

This creates several risks:

- filter form state can diverge from active URL state;
- active filter chips can disagree with the data currently loaded;
- saved views can preserve query shapes that are awkward to rehydrate;
- dashboard and delivery-health links can drift from list-page query semantics;
- CSV exports can accidentally use stale or pending filters instead of applied filters;
- return URLs can preserve incomplete context;
- repeated serialization code makes future filters harder to add safely.

These are not always obvious failures. They show up as moments where users ask, "Why am I seeing this result?" or "Did this export include the filters I thought it did?" That kind of ambiguity is especially damaging in project management software.

## Goals

- Make `WorkItemQuery` the single trusted product contract for work item list state.
- Centralize app-local query serialization, route parameter conversion, and normalization helpers.
- Ensure project work item lists, workspace work item lists, saved views, dashboard links, delivery-health links, CSV exports, and return URLs use consistent query behavior.
- Add round-trip tests that prove query state survives form, URL, API, saved-view, and export paths.
- Improve visible affordances around shareable filtered views.
- Make CSV export behavior clearer and always tied to the applied query.
- Keep the implementation app-local and avoid premature `jawstack` extraction.
- Capture extraction notes after implementation so the pattern can inform future reference apps.

## Non-Goals

- Do not create a standalone query-contract package.
- Do not add a generic `jawstack` query abstraction.
- Do not replace Angular Router or introduce a frontend state-management framework.
- Do not redesign the entire work item list page.
- Do not add team-shared saved views unless the technical design proves it is small and directly supports this sprint's theme.
- Do not add server-side pagination, full-text search infrastructure, or advanced query-builder UI.
- Do not require Playwright E2E in CI.

## Target Users

### Project Contributor

Needs to save, reopen, share, and export filtered work without wondering whether the current view reflects the intended criteria.

### Project Owner

Needs dashboard and health links to land on exactly the work items behind a metric or attention reason.

### Workspace Maintainer

Needs predictable list behavior as filters, saved views, exports, and dashboards continue to grow.

### Reference-App Developer

Needs a concrete example of treating query state as a product contract without over-abstracting too early.

## Product Principles

- **URL state is product state:** if a filtered view is worth seeing, it should be linkable.
- **Applied means applied:** visible chips, exports, saved views, and result counts should reflect applied query state, not pending edits.
- **One query, many surfaces:** lists, saved views, dashboard links, exports, and return URLs should use the same canonical query behavior.
- **Defaults should be quiet:** default sort and default archived-project behavior should not clutter URLs or saved-view summaries.
- **Abstractions stay local first:** generalize inside Worktrail only where it removes real duplication and reduces product risk.
- **Tests should prove trust:** round-trip tests are more valuable than broad snapshots for query-state behavior.

## Scope

### 1. Canonical Work Item Query Helpers

Create or consolidate app-local helpers for work item query behavior.

Requirements:

- Define one frontend module responsible for:
  - converting project filter form values to query state;
  - converting workspace filter form values to query state;
  - converting query state to Angular router query params;
  - converting router query params to filter form values;
  - omitting default values from URLs;
  - preserving intentional non-default values.
- Reuse the helpers from:
  - project work item list;
  - workspace work item list;
  - saved views;
  - dashboard and delivery-health links;
  - CSV export calls;
  - detail-page return URLs.
- Avoid duplicating query serialization in component classes when a shared helper can own it.
- Keep helpers strongly typed against `WorkItemQuery`.

Acceptance criteria:

- Adding or changing a supported work item filter requires changes in one obvious query serialization area, not several component-specific copies.
- Existing list behavior remains compatible with current URLs.
- Default values remain omitted from URLs unless there is a product reason to show them.

### 2. Round-Trip Query Tests

Add focused tests around the query lifecycle.

Requirements:

- Cover project list query round trips:
  - form values to query;
  - query to URL params;
  - URL params back to form values.
- Cover workspace list query round trips, including:
  - project filter;
  - work state versus status;
  - assignee versus unassigned state;
  - blocked boolean;
  - dependency filters;
  - archived-project mode;
  - default sort omission.
- Cover saved-view query hydration.
- Cover dashboard or delivery-health query link conversion.
- Cover CSV export using the applied query, not pending form edits.
- Include tests for empty/default state producing clean URLs.

Acceptance criteria:

- Query round-trip tests fail if a supported filter is dropped, renamed incorrectly, or serialized inconsistently.
- Tests document the expected default-omission behavior.

### 3. Shareable Filtered Views

Make filtered views easier to trust and share.

Requirements:

- Add a lightweight "copy view link" action on the workspace work item list.
- Consider adding the same action to the project work item list if implementation is small and consistent.
- Copy the current applied URL, including only canonical query params.
- Provide a clear success state after copying.
- Avoid copying pending filter edits that have not been applied.
- Keep behavior functional in local development and static-hosted frontend contexts.

Acceptance criteria:

- A user can apply filters, copy the view link, open it in a new tab, and land on the same applied view.
- If the user edits filters but does not apply them, the copied link still reflects the currently applied view.

### 4. Saved View Reliability

Tighten saved-view behavior around canonical query state.

Requirements:

- Ensure saved views store normalized `WorkItemQuery` values.
- Ensure opening a saved view updates the route through canonical query params.
- Ensure saved-view summaries count meaningful applied filters rather than default noise.
- Ensure stale references, such as archived labels or inactive members, remain readable where existing data allows.
- Keep saved views personal for v0.1.2 unless team sharing becomes an obvious small follow-on in technical design.

Acceptance criteria:

- Saving, opening, renaming, updating, and deleting personal saved views continue to work.
- Saved-view query labels match the meaningful filters users expect.
- Saved views do not introduce URL params that default list state would otherwise omit.

### 5. Dashboard, Health, And Planning Links

Make metric-to-list links use canonical query conversion.

Requirements:

- Route project home delivery-health links through the shared query helpers.
- Route planning review and delivery-health links through the shared query helpers.
- Preserve project-scoped versus workspace-scoped semantics.
- Avoid links that produce contradictory query combinations.

Acceptance criteria:

- Clicking a dashboard or planning health reason lands on a work item list whose active filter chips match the reason.
- Links generated from `WorkItemQuery` values remain clean and stable.

### 6. Export Trust

Make CSV export behavior explicit and query-consistent.

Requirements:

- Ensure workspace and project CSV exports use applied query state.
- Keep pending filter edits out of export requests until applied.
- Consider a small UI label near export actions indicating that export uses current applied filters.
- Ensure export URLs/requests use canonical HTTP query params.

Acceptance criteria:

- Export tests prove pending filter edits do not alter exported data until applied.
- Export behavior remains consistent with active filter chips and current URL.

### 7. Backend Query Normalization Review

Review the API-side query parsing and saved-view validation path.

Requirements:

- Keep API parsing centralized through the existing work item query validation layer.
- Ensure saved-view create/update normalizes queries with the same server-side rules used by list endpoints.
- Ensure project-scoped query parsing rejects or strips workspace-only fields predictably.
- Add or adjust API tests for invalid and contradictory combinations if gaps are found.

Acceptance criteria:

- API list, export, dashboard, and saved-view paths agree on query defaults and validation.
- Invalid query combinations fail consistently.

### 8. Documentation And Extraction Notes

Document the product behavior and extraction signal.

Requirements:

- Update README usage notes for shareable filtered views and export behavior.
- Update the static site if v0.1.2 creates user-visible improvements worth highlighting.
- Add v0.1.2 release notes.
- Add v0.1.2 jawstack extraction notes for query contracts and URL state.
- Preserve the opportunity note as source material.

Acceptance criteria:

- Documentation explains how filtered URLs, saved views, and exports relate.
- Extraction notes clearly separate app-local helpers from future framework-worthy abstractions.

## UX Requirements

- Filter controls must distinguish pending edits from applied state.
- Active filter chips must represent applied state only.
- Copy-link success feedback must be visible but not disruptive.
- Empty states should continue to respond to applied filters, not pending edits.
- URL changes should not create surprising reloads or navigation jumps.
- Mobile list pages should remain usable after adding any copy/share controls.

## Technical Requirements

- Preserve Angular lazy-loading and static deployment compatibility.
- Preserve transport-neutral API endpoint handlers.
- Preserve local Express server behavior.
- Preserve Postgres migrations and deterministic seed flow.
- Keep shared query helpers app-local unless a narrower contracts-level helper is clearly justified.
- Keep `WorkItemQuery` as the TypeScript contract shared by frontend, API, saved views, exports, health reasons, and planning links.
- Do not add a new third-party dependency unless the technical design identifies a strong reason.

## Data And API Requirements

- No new database table is required by default.
- Saved-view query JSON may continue to use the existing schema, but create/update paths should normalize and validate consistently.
- Existing OpenAPI work item query parameter docs should remain accurate.
- If route/query behavior changes, API tests and frontend tests must be updated together.

## Success Metrics

Because Worktrail is still a local reference app, success is measured through behavior and test coverage:

- Query helper duplication is reduced.
- Round-trip tests cover all currently supported work item filters.
- Saved views, dashboard links, health links, return URLs, and exports reuse canonical query helpers.
- Manual QA can confirm copied filtered links reopen equivalent views.
- Full verification passes: lint, typecheck, tests, build, and E2E smoke.

## Risks

- A query-helper refactor can create regressions in list filtering if compatibility with existing URLs is not preserved.
- Over-generalizing could consume the sprint without improving the product.
- Copy-link behavior depends on browser clipboard APIs that may require fallback handling in tests or insecure local contexts.
- Saved views may expose stale references that are better handled by display helpers than by query normalization.
- Backend and frontend defaults can drift if tests only cover one side.

## Open Questions

- Should "copy view link" ship on both workspace and project lists, or only the workspace list first?
- Should saved-view query summaries become richer labels, or remain a compact applied-filter count for now?
- Should any query helper live in `packages/contracts`, or should v0.1.2 keep all runtime helpers in app-specific frontend/API modules?
- Should team-shared saved views be deferred, or is a small `visibility: team` addition worth including if the query groundwork makes it easy?
- Should the static site mention this as a user-facing feature, or keep it in release notes because it is mostly reliability polish?

## Release Criteria

- v0.1.2 PRD, technical design, implementation plan, release notes, and extraction notes exist.
- Work item list query behavior is centralized enough that future filters have a clear path.
- Project and workspace list URLs remain backward compatible.
- Saved views, dashboard links, delivery-health links, exports, and return URLs use canonical query behavior.
- Copy filtered view link works for at least the workspace list.
- Focused unit/API tests and full verification pass.
- No `jawstack` package or generic framework abstraction is introduced.
