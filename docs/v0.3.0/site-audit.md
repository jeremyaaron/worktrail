# Worktrail v0.3.0 Public Site Audit

Date: October 17, 2026  
Baseline reviewed: v0.2.9, commit `4e508cc`

## Assessment

The public site has a sound foundation: a recognizable product name, real application screenshots, honest local-only positioning, useful source/setup actions, and a simple static implementation. It does not need a new framework, a larger marketing site, or a separate page for every feature.

The accumulated debt is editorial. The product section now contains nine cards and 38 bullets, while the signal band, Baseline, Architecture, Operations, and Scope repeat many of the same capabilities. The latest sprint's Markdown work dominates the baseline announcement even though planning, portfolio review, cycle closeout, hierarchy, files, and discovery are equally important parts of the current product.

The v0.3.0 goal should be to present one coherent project-management reference application, not an expanding inventory of implementation guarantees. A visitor should quickly understand what Worktrail does, why its implementation is worth exploring, and how to try it locally without mistaking it for hosted SaaS.

There is also one concrete first-run documentation defect: the combined development/preview example changes attachment storage roots after seeding. Correct that independently of the visual refresh.

## Audit Basis And Limits

Reviewed material included the [previous site audit](../v0.2.0/site-audit.md), [current HTML](../../site/index.html), [CSS](../../site/styles.css), both PNG screenshots, the [README](../../README.md), attachment configuration/seeding code, the [Pages workflow](../../.github/workflows/pages.yml), and the current feature set considered in the [UX audit](ux-audit.md) and [technical debt audit](tech-debt-audit.md).

An HTML-parser-based check counted the content and resolved every current fragment, local stylesheet/image reference, and GitHub `blob/main` file link against this checkout. All those targets exist locally. This does not establish remote HTTP availability or the state of the deployed Pages site.

| Current Signal | Observation |
| --- | --- |
| Main content | Approximately 1,387 whitespace-delimited words, including setup commands; excludes navigation, footer, metadata, and image alternative text |
| Hero supporting paragraphs | 26 words plus 18 words; length alone is not the main problem |
| Product inventory | Nine cards, 38 bullets |
| Operations inventory | Four additional cards |
| Architecture | Five layers, a substantial improvement over the previous audit's 16 rows |
| Scope | Five detailed non-goal groups |
| Footer | Eight links, including three v0.2.9 release documents |
| Images | Board: 1800 x 980, 206,386 bytes; detail: 1440 x 900, 105,205 bytes |

Both image files were visually inspected directly. A fresh rendered site walkthrough was not possible because the in-app browser connection reported that no browser was available. Layout concerns below are identified from CSS and image content, not presented as observed browser failures. Responsive geometry, keyboard interaction, computed contrast, and deployed share previews still require release verification.

No application suites were rerun for this documentation-only site audit. No database was reset or seeded, and no development server was needed. Only this document was added; the existing v0.3.0 audits and all site/application files were preserved.

## Progress To Preserve

- The main product narrative no longer walks through individual release numbers. Do not reintroduce a sprint timeline into it.
- Architecture is grouped into five useful boundaries. Keep those groups rather than redesigning the section again.
- The detail screenshot adds real product evidence beyond the board background. Keep a full-size inspection path.
- The page explicitly distinguishes the reference application from an internet-safe deployment. Shortening the page must not weaken that distinction.
- Assets and styles are local, and deployment uploads `site/` directly. The current static approach remains appropriate.

## Release Priorities

Here, `P1` means important to the v0.3.0 public presentation or first-run experience, not a security severity rating. `P2` means supporting polish and maintainability.

| Finding | Priority | Main Change |
| --- | --- | --- |
| 1. Separate working setup paths | P1 | Align attachment storage and make first-run instructions complete |
| 2. Replace the feature inventory with workflows | P1 | Consolidate nine cards into four outcome groups |
| 3. Present the whole baseline, not the latest sprint | P1 | Clarify the hero, remove audience duplication, shorten release identity |
| 4. Make screenshots demonstrate the product | P1 | Refresh after UX consolidation and provide legible mobile evidence |
| 5. Turn builder/operator copy into useful destinations | P2 | Preserve boundaries, reduce lists, link resources where mentioned |
| 6. Keep scope candid without cataloguing every omission | P1 | Retain prominent operating/security boundaries; link detailed limitations |
| 7. Verify navigation, reflow, and keyboard access | P2 | Address source-level risks and perform a rendered acceptance pass |
| 8. Make release handoff and content maintenance explicit | P2 | Coordinate docs, share metadata, checks, and future editorial rules |

## Findings And Recommendations

### 1. Separate Working Setup Paths

The [Run locally block](../../site/index.html#L329) starts with development seeding, then exports a different `WORKTRAIL_ATTACHMENT_STORAGE_PATH` for production preview. Without a pre-existing override, seeding writes attachment bytes beneath `.worktrail/attachments`; preview then looks under `/absolute/path/to/worktrail-attachments`. The database still contains the seeded attachment metadata, but the new store does not contain its bytes.

This follows directly from the [default storage configuration](../../apps/api/src/config/runtime-config.ts#L33), [seed initialization](../../apps/api/src/db/seed.ts#L192), and the README's explicit requirement to [use the same path for seeding and runtime](../../README.md#L123). It was established by source inspection, not a fresh execution of the site's commands.

The block also says "Clone" without supplying clone/change-directory commands, omits prerequisites, and does not state where to open the application. `npm run dev` is a long-running command, so the preview lines are an alternative workflow, not the next steps in one uninterrupted sequence.

Recommendations:

- Make the homepage show one complete fresh-checkout development path: repository acquisition, working directory, Node/npm/Docker requirements, install, database startup, migration, seed, and development startup.
- State the development URL, `http://localhost:4200`, and link directly to the README for troubleshooting and full requirements. Browser-test tooling need not be part of the first product trial.
- Link production preview as a separate path. If its commands remain inline, set an actual writable absolute storage path before both seeding and runtime, or deliberately reuse the existing seeded store. State its local URL and the need to stop a conflicting development API first.
- Distinguish disposable demo initialization from upgrades to an existing installation. Do not prescribe reset/reseed as a general storage repair or upgrade procedure; database metadata and attachment bytes form one operational data set.

Acceptance: follow each advertised path independently on a disposable fresh checkout/database, open a deep link, and download a seeded attachment. A successful startup alone does not verify the instructions.

### 2. Replace The Feature Inventory With Four Workflows

The [product grid](../../site/index.html#L109) has reverted toward one card per capability. Quick Find, files, hierarchy, portfolio, and readable content each have their own card, while "Share status" contains planning, cycles, closeout, report drafting, publication, and sharing. That is uneven information architecture: some cards describe one interaction, another describes several major workflows.

Many bullets are specification details rather than reasons to use the product: deterministic search tiers, a 10,000-row synchronous export limit, Angular CDK, empty search issuing no request, and legacy format conversion. Those facts are useful documentation, but they make the public overview harder to scan.

Recommended grouping:

| Workflow | Capabilities To Absorb | Public Emphasis |
| --- | --- | --- |
| Find the next action | My Work, Inbox, Quick Find, filtered lists, saved/pinned views | Get to relevant work and return to useful views |
| Shape and deliver work | Project workspaces, boards, parent/child work, dependencies, attachments | Keep execution and supporting context together |
| Plan and review delivery | Portfolio, milestones, cycles, live reviews, guided closeout | See delivery pressure, choose scope, and close execution windows |
| Explain decisions and share status | Formatted descriptions/comments, explicit mentions, watchers, report drafts, immutable reports, Markdown/print sharing | Keep discussion readable and preserve published evidence |

Use one short outcome sentence and two or three supporting points per group. Mention capabilities where they support the workflow; do not create a second inventory to prove that nothing was removed. CSV portability and workspace governance can be compact supporting links rather than additional equal-weight homepage cards.

Preserve the important distinction between live planning and immutable published reports. Do not imply that child state automatically changes a parent's status or scheduling, that typed `@name` text sends mentions, or that Quick Find searches file contents. Fewer words should mean better selection, not broader claims.

Acceptance: a visitor can identify all four workflows by reading the headings alone. The next feature release should fit into an existing group by default.

### 3. Present The Whole Baseline, Not The Latest Sprint

The [hero](../../site/index.html#L45) already has a sensible length and the correct literal H1. The issue is emphasis: readable discussion leads the promise, and cloud deployment receives valuable first-screen space despite being future work. Both supporting paragraphs receive the same `.hero-copy` styling; `hero-copy-secondary` has no distinct rule.

The [Baseline section](../../site/index.html#L212) then announces v0.2.9 Markdown rather than summarizing the established product. Users/Builders/Operators appear both there and in the [signal band](../../site/index.html#L66), with a fourth "Cloud path" signal mixing future architecture with current audiences.

Recommendations:

- Keep `Worktrail` as the H1 and retain `View source` / `Run locally`. Do not add "Get started" or "Try now" language that implies a hosted application exists.
- Use one durable product sentence and one quieter reference-implementation sentence. For example: "A project-management reference app for finding work, planning delivery, and sharing status." Follow with: "Run it locally and explore an Angular, TypeScript, and Postgres implementation."
- Present version identity as a compact current-release label/link. At release, identify v0.3.0 without turning the entire Baseline section into the newest feature announcement.
- Keep one audience explanation, not two. Three concise Users/Builders/Operators statements are enough; move the future cloud path into the architecture discussion.
- Remove or repurpose the redundant Baseline section. Put detailed changes in release notes, not another homepage summary of every capability.

Acceptance: the first screen answers "What is it?", "Why inspect it?", and "How can I try it?" without requiring the visitor to understand Worktrail's release history.

### 4. Make Screenshots Demonstrate The Product

The real images are an asset, but their presentation is not yet a strong demonstration of the current scope.

The board background shows an earlier shell without the Quick Find action visible in the detail image. CSS crops it with `object-fit: cover` and applies a highly opaque overlay, especially on mobile. It provides atmosphere more readily than inspectable evidence.

The [detail figure](../../site/index.html#L96) clearly demonstrates rendered requirements and acceptance criteria. However, roughly its bottom third is an empty parent-selection form. It does not demonstrate discussion, files, or cycle closeout, and its complete 1440-pixel-wide interface becomes too small to read when scaled into a phone-width page. The existing full-size link helps and should remain.

Recommendations:

- Capture the actual v0.3.0 interface after the UX changes, using intentional demo records. Show meaningful work context rather than an empty administrative control or a page chosen only because it is the newest feature.
- Keep two complementary proof points at most: a delivery overview such as Planning/Portfolio, and a work detail or published report. Choose what best supports the four workflow groups; do not create a screenshot gallery for every sprint.
- Keep the brand prominent over real imagery if retaining the full-bleed hero, but provide an unobscured product figure close to it. Do not rely on the background image alone to explain the application.
- Offer a deliberate mobile crop or separately captured mobile view, with access to the complete original. Preserve enough interface context that the crop remains truthful.
- Use captions to identify what the image actually shows. Retain descriptive alternatives, stable image dimensions, and lazy loading below the first viewport.

Acceptance: at both desktop and phone sizes, the visitor can recognize the relevant product state without reading microscopic interface text. The image must support the promise, not merely prove that a UI exists.

### 5. Turn Builder And Operator Copy Into Useful Destinations

The [five architecture layers](../../site/index.html#L251) are the right structure, but their descriptions have absorbed new feature lists. The Domain row alone names most of the application. That hides the reference value: where responsibilities live and how they connect.

The [Operations cards](../../site/index.html#L272) describe a preview command, health endpoints, OpenAPI, and a runbook, but none links directly to its corresponding resource. The visitor must find the footer after reading about them.

Recommendations:

- Preserve Frontend, API boundary, Domain, Persistence, and Operations. Give each one a concise responsibility statement and, where helpful, one concrete example.
- Explain the attachment boundary accurately: PostgreSQL stores metadata; the current local adapter stores immutable bytes behind an object-store interface. An interface is not a shipped managed-storage deployment.
- Replace the four descriptive operations cards with compact, directly linked resources: local/preview setup, OpenAPI, and the operations runbook. Health endpoint details belong with those instructions.
- Link a current developer/architecture guide once the consolidation produces one. Historical sprint designs can remain available without being presented as the complete current architecture.
- Avoid unqualified guarantees such as "context-safe drafts" if they can be read as protection against navigation loss. Reconcile public claims with the UX/technical audit outcomes before publication.

Acceptance: a builder can reach architecture guidance, and an operator can reach setup/API/runbook guidance, directly from the relevant section without hunting through a feature list.

### 6. Keep Scope Candid Without Cataloguing Every Omission

The [Scope section](../../site/index.html#L296) is honest, but its five groups now include a search roadmap, a Markdown conformance list, file-transfer omissions, scaling qualifications, cloud infrastructure, and authentication. This repeats the additive pattern in negative form.

Keep the boundaries that determine whether someone should run or deploy the app immediately visible:

- **Local reference application:** no hosted service or production identity system; local actor selection is a demonstration mechanism, not production authentication.
- **Local operating model:** production preview is for inspection, not internet-safe hosting; current attachment storage assumes one API instance with persistent local disk.
- **Bounded capabilities:** search, authored content, files, and synchronous data flows have deliberate limits. Attachments are not malware-scanned; signature checks do not establish that files are safe.

Link the complete search/Markdown/file/export limitations from this short section or the associated guides. Do not remove the authentication, hosting, or malware-scanning warnings to achieve a word target. Do not equate "production-shaped" with production-ready, or describe bounded PostgreSQL matching as enterprise/semantic search.

Acceptance: availability and deployment suitability remain clear on a quick scan, while detailed capability exclusions are discoverable without occupying five dense homepage panels.

### 7. Verify Navigation, Reflow, And Keyboard Access

The source identifies several risks to check during implementation; these are not fresh rendered defect reports:

- The desktop header is fixed, but no anchor scroll offset is defined. Section navigation may place headings beneath it, especially when navigation wraps.
- The product grid uses four columns above 1100px. Nine cards produce a final row containing only the oversized "Share status" card. Four balanced workflow groups remove that structural imbalance.
- The signal band remains four columns down to 720px with generous per-cell padding. It needs a tablet check, not just desktop and phone checks.
- On phones the header becomes static while the hero keeps an `82vh` minimum height. Check that header plus hero content do not bury every hint of the next section, particularly on short screens.
- Smooth scrolling has no reduced-motion override, no skip link is provided, and there are no explicit focus-visible styles. Native focus is not globally removed, so this is not evidence that all links lack focus indicators; verify and make the intended focus treatment consistent.
- `body { overflow-x: hidden; }` can conceal overflow rather than solve it. Check element containment and text clipping as well as document width. The code block's own horizontal scrolling is appropriate.

Recommendations: add a reliable fixed-header anchor offset, a keyboard-visible skip link and focus treatment, and reduced-motion handling; keep navigation concise after section consolidation. Retain semantic headings, labeled navigation, and the full-size image link. Do not solve density by shrinking text until the page merely fits.

Acceptance: verify 320px and 390px phones, 768px and 1024px tablets, 1440px and wide desktops, a short landscape viewport, and 200% zoom. Check keyboard traversal, every anchor, readable screenshots, wrapped headings, and the first-viewport transition. Include rendered screenshots and an accessibility pass in release evidence.

### 8. Make Release Handoff And Content Maintenance Explicit

The [metadata](../../site/index.html#L6) repeats feature inventory and lacks an Open Graph image, canonical URL, and Open Graph URL. The footer correctly targets existing v0.2.9 files today; it is not currently a set of broken links. At v0.3.0, however, those labels would still describe the last feature sprint unless intentionally updated.

The [Pages workflow](../../.github/workflows/pages.yml) uploads the static directory without a site-specific validation step. That simplicity is worth preserving, with a small release check rather than a frontend build system.

Recommendations:

- Align page and share descriptions with the durable product/reference positioning. Add a representative share image and its alternative text; use absolute share/canonical URLs only after confirming the deployed Pages address and repository subpath.
- Update the current-release label, release notes, and architecture/product documentation links together when the v0.3.0 artifacts actually exist. At audit time, `docs/v0.3.0` contains audits, not a completed PRD/design/release-notes set; do not publish speculative links.
- Group footer resources by purpose rather than appending every new document. Keep the repository, setup, current release, technical guidance, and API/runbook easy to reach. Older CSV and sprint references can live behind documentation navigation.
- Use release-tag links where a document is intended as fixed release evidence; current README/API guidance may deliberately follow `main`. Make that distinction intentional.
- Add lightweight local checks for missing assets, invalid fragment targets, repository documentation paths, and expected release identity. Remote link checks and deployed share previews remain separate checks.
- Adopt a content rule: a feature joins an existing workflow group unless the product model genuinely changes. Adding a new homepage card should require replacing or consolidating existing material. Never add both a capability card and a matching non-goal card by default.

Acceptance: the deployed page, share preview, screenshots, release label, and linked release documents describe the same shipped baseline. A future sprint can update the site without increasing its section/card count.

## Suggested Page Order

1. **Worktrail:** durable product/reference positioning, actual product imagery, source and local-run actions.
2. **Product workflows:** four outcome groups and one unobscured, captioned product figure close to the introduction.
3. **Reference implementation:** one compact audience explanation, five architecture responsibilities, and direct developer/operator resources.
4. **Current scope:** three concise operating/capability boundaries, with detailed limitations linked.
5. **Run locally:** a complete development path plus a separate preview guide.
6. **Resources:** current release identity and a small, purposeful documentation footer.

This is a consolidation of the current page, not a request for six new standalone sections. Remove the duplicated Baseline narrative and fold Operations into the reference/resource area. Preserve useful existing anchors or redirect their destinations within the page where practical.

## Implementation Sequence

1. Correct setup/storage guidance and agree on the four workflow groups.
2. Rewrite the hero, baseline/audience material, architecture descriptions, and scope together so removed lists do not simply move elsewhere.
3. Complete the application UX consolidation, then capture the final representative screenshots.
4. Adjust responsive layout, navigation, focus, and motion behavior around the shorter content.
5. Publish real v0.3.0 documentation links and share metadata, then verify fresh local setup and the rendered/deployed page.

The release is ready when a visitor can explain Worktrail after a short scan, inspect evidence of the actual product, and follow a working local trial path. More homepage coverage is not the measure of completeness; the repository documentation should carry the depth.
