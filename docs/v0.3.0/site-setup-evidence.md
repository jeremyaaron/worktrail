# Public Site And Independent Local Setup

Phase 19 consolidates the public presentation and current local guidance. It does not publish a
release, deploy Pages or establish production/cloud suitability. Package versions remain 0.2.9.
See the [implementation plan](implementation-plan.md#phase-19-public-site-and-working-local-setup)
and [verification notes](verification-notes.md#phase-19-public-site-and-working-local-setup).

## One Product Presentation

The static site now presents four workflows: Find the next action; Shape and deliver work; Plan and
review delivery; Explain decisions and share status. Each has one outcome and three supporting points.
One audience paragraph, five architecture responsibilities with direct resources, and three prominent
operating limits replace duplicated signal/Baseline/Operations inventories. Local actor identity,
single-instance local file storage, no internet-safe hosted service and no malware scanning remain
explicit. Detailed capability limits stay in the README rather than a second negative feature list.

Worktrail remains the H1, with View source and Run locally actions. The hero uses actual product
imagery; two unobscured proof points below show Portfolio and read-first WT-1. Each has an actual
mobile capture and links to full desktop/mobile originals. No screenshot is generated, composited,
blurred or edited. The obsolete board background asset is removed.

GitHub's read-only Pages API confirmed `https://jeremyaaron.github.io/worktrail/` with workflow
publishing and no custom domain on October 18, 2026. Canonical, Open Graph URL and share image use
that exact repository subpath. The published-release label and fixed-tag evidence still target
v0.2.9; Phase 21 must update them with package identity when v0.3.0 artifacts actually exist.
This branch's local screenshots/capabilities are not a claim of remote publication.

## Current Guides And Fixtures

README contains complete, independent development and compiled-preview sequences: clone/cd,
Node/npm/Git/Docker prerequisites, lockfile install, explicit runtime configuration, PostgreSQL,
migration, seed, start and URL. Each exports one writable absolute attachment root before seeding
and keeps it at runtime. Preview explicitly enables compiled static assets instead of inheriting a
development override. Existing-server/port guidance does not stop unrelated PostgreSQL or APIs.

[operations.md](../operations.md) separates fresh demo setup from preserved-data upgrades, coordinated
metadata/byte backup and deliberate destructive reset. Switching an existing installation retains
its original database/storage, not a newly suggested demo root. Seed/reset is not a repair or upgrade.
The [developer guide](../development.md) names adopted owners and invariants for transactions, locks,
queries, snapshots, clients, context, drafts and navigation; archive paths use v0.0.X/v0.1.X correctly.

`demo-ids.ts` centralizes the existing stable seed identity map without changing values.
`demo-attachments.ts` owns the existing deterministic file definitions, bytes and checksums without
database/runtime imports. The explicit seed entry and attachment seed adapter consume these modules;
existing attachment exports remain compatible. Import-only tests use an invalid database URL and
establish that importing IDs/bytes cannot connect, seed or reset anything. Unrelated fixtures and
historical scenario builders were not rewritten.

## Independent Setup Results

Both checks use fresh private source snapshots and independently installed lockfile dependencies,
not linked working `node_modules`. Each receives a separate labeled PostgreSQL 16 container, random
ports and one owned absolute attachment root. Startup wrappers prove server identity before browser
access and call the real source/compiled application startup. Cache settings, random ports and
owned Docker provisioning replace ordinary local defaults; these checks do not clone remote main,
execute the user's working Compose project or literally run the long-lived root `dev` alias.

| Path | Commands And Runtime Evidence | Result |
| --- | --- | --- |
| Development | Fresh `npm ci`, migrate, seed; Angular dev server and source API; reload WT-3 Files; download both seeded files | Passed; Vite requested, exact bytes preserved |
| Compiled preview | Separate fresh `npm ci`, migrate, seed, `npm run build`; compiled API/Angular from one origin; reload WT-3 Files; download both seeded files | Passed; hashed main requested, no Vite request, exact bytes preserved |

Both `attachment-requirements.md` and `verification-evidence.json` are compared as buffers to their
import-safe expected bytes, not merely checked for HTTP success or equal size. Preview could not
fall back to development storage: no working `.env`, bytes, build output or dependency tree was copied.
The compiled production build passed unchanged budgets without warnings, at 401.95 kB initial size
(112.06 kB estimated transfer in this owned checkout). Installation reports existing lockfile
deprecations/advisories; no dependency remediation or clean full-audit claim is part of this phase.
The full dependency gate remains required for release acceptance.

## Product Proof Provenance

The source UI baseline is commit `092e6384c398978fe83864a725d7356addd2aed1` plus the Phase 19
import-safe seed extraction. Captures came from the fresh development setup, using normal seeded
Portfolio and WT-1, on October 18, 2026. Health/freshness use the actual capture clock; seed dates,
rules and current facts were not changed to improve the picture. These are two proof points with
desktop/mobile renditions, not four separate product claims.

| Asset | Dimensions | Bytes |
| --- | --- | --- |
| `worktrail-portfolio.png` | 1600 x 960 | 173744 |
| `worktrail-portfolio-mobile.png` | 390 x 844 | 64684 |
| `worktrail-detail.png` | 1440 x 960 | 122608 |
| `worktrail-detail-mobile.png` | 390 x 844 | 72337 |

The mobile Portfolio capture scrolls to the comparison; the desktop original retains the summary
and surrounding product context. Read-first detail shows requirements/acceptance criteria rather
than an expanded administrative editor. The four tracked files are byte-identical to their owned
capture outputs; full originals remain inspectable.

## Static And Rendered Acceptance

`check:site` uses HTML/Markdown parsers to validate asset and repository-file existence, fragments,
unique IDs, image alternatives/dimensions, Pages/share metadata, four workflows, two proof points and
matching published-release identity/links. Tests reject missing assets/anchors/files, wrong image
dimensions and mismatched release/canonical/share paths. It is read-only and needs no browser or DB.
Pages runs this check after dependency installation and before uploading the unchanged static `site/`
artifact. The main-branch trigger, deploy job and hosting approach remain intact.

`verify --mode=site` adds an owned server at the real `/worktrail/` path and Chromium checks without
PostgreSQL. Passed at 320x700, 390x844, 768x1024, 1024x768, 1440x900, 1920x1080 and short landscape
568x320. Assertions check actual element/document containment without global overflow hiding, image
loading/responsive source selection and a visible next-section transition. Keyboard checks cover
Skip to content, main focus, visible outlines, every main anchor, full original navigation and
reduced-motion scrolling. Desktop/mobile proof, reference, scope and setup screenshots were inspected.
Code blocks intentionally own their horizontal scrolling rather than expanding the page.

The focused acceptance comprises two independently configured setup executions, two site browser
checks, 55 verification-infrastructure cases (including ten nested static-check rejection cases),
three selected API seed cases, backend/test lint/typechecks and document/workflow source checks.
No unrelated Angular suite, whole API suite or remote deployment was run. Actual browser zoom,
screen-reader/device walkthrough, full integration/UAT and final release gates remain Phases 20-21.
