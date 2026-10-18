# Compatible Toolchain Disposition

## Scope And Evidence

Phase 3 preserves Angular 20, TypeScript 5.9, Karma/Jasmine, Drizzle ORM/Kit, and the existing
application architecture. Package/release identity stays `0.2.9`. No forced audit fix, dependency
override, framework migration, or npm-suggested downgrade was used.

The October 17, 2026 [structured evidence](dependency-audit-evidence.json) records the baseline
commit, every audit-reported package/path/version, inherited advisory IDs, and separate production/
full totals. The baseline was re-audited in an owned temporary checkout with its original manifests
and lockfile; no working data was touched. Advisory counts are not package counts: npm reports
parents affected through descendants as well as directly vulnerable packages.

| Audit | Baseline | Updated Lockfile |
| --- | --- | --- |
| Production | 0 | 0 |
| Full, including development and optional peers | 34: 8 moderate, 21 high, 5 critical | 13: 5 moderate, 6 high, 2 critical |
| Remaining distinct advisory IDs | See evidence | 5, individually bounded |

## Compatible Changes

| Owner/Package | Resolved Change | Command And Exposure |
| --- | --- | --- |
| Angular CLI/build/devkit/schematics | `20.3.31` -> `20.3.40` | Local serve/build/test and CLI tooling; updated owner pins MCP SDK `1.31.0` and Piscina `5.3.2` |
| API/contracts Vitest | `4.1.9` -> `4.1.12` | Reviewed test code; fixes the redirect-mock advisory without changing the Angular test engine |
| concurrently | `9.2.3` -> `9.2.5` | Local `npm run dev` command execution; owner pins shell-quote `1.12.0` instead of `1.8.4` |
| baseline-browser-mapping | `2.10.41` -> `2.11.29` | Build/browser-target queries from repository configuration |
| brace-expansion | `1.1.15` -> `1.1.21`; nested `5.0.7` -> `5.0.12` | CLI/lint/Karma filesystem patterns, package installation and cache operations |
| browserslist | `4.28.4` -> `4.29.3` | Build browser queries and repository-supplied stats; associated browser data refreshed within owner ranges |
| engine.io / socket.io-parser | `6.6.9` -> `6.6.11` / `4.2.6` -> `4.2.7` | Karma browser-test transport; malformed client packets are a development-server boundary |
| fast-uri | `3.1.3` -> `3.1.8` | CLI/build/lint JSON schema URI parsing; reviewed configuration, not application HTTP handlers |
| Hono / Node adapter | `4.12.27` -> `4.13.13` / `1.19.14` -> `2.1.5` | CLI MCP tooling; adapter major is explicitly selected by updated MCP SDK's supported owner range, not a direct app migration |
| http-cache-semantics / tar / ip-address | `4.2.0` -> `4.3.0` / `7.5.19` -> `7.5.22` / `10.2.0` -> `10.7.4` | CLI package fetching, archive selection, network/proxy handling |
| js-yaml | `4.3.0` -> `4.3.2` | Tooling/configuration parsing; not an application request parser |
| nanoid / postcss / source-map-js | `3.3.15` -> `3.3.20` / `8.5.16` -> `8.5.30` / `1.2.1` -> `1.2.2` | Build/test identifiers, stylesheet processing and source maps from reviewed source |
| undici | `6.27.0` -> `6.29.1` | CLI tooling HTTP/WebSocket/cookie handling; no runtime package adoption |

Exact physical paths and advisory IDs for each row are in the evidence JSON. `npm explain` was
used to confirm the remaining dependency owners. Additional changes such as Zod deduplication,
MCP's jose/rate-limit dependencies, and Vitest's own utilities follow the upgraded owners' ranges.
Angular runtime/compiler/compiler-cli remain `20.3.33`, CDK `20.2.14`, TypeScript `5.9.3`,
Drizzle ORM `0.45.2`, Drizzle Kit `0.31.10`, pg `8.22.0`, and Playwright `1.61.1`.

The [Angular compatibility table](https://angular.dev/reference/versions) permits Node 24 and
TypeScript >=5.8 <6 for Angular 20.3. Node 20 is now end-of-life according to the
[Node release schedule](https://nodejs.org/en/about/previous-releases). Node 24 LTS/npm 11 are now
the declared local/CI baseline; `.nvmrc` selects 24. No application runtime API changes were needed.
Earlier Node 20 measurements remain historical evidence, not a supported runtime claim.

### Peer Compatibility And Retained Tooling

npm 10.8.2 and a diagnostic npm 10.9.9 invocation both failed initial peer resolution with an
Arborist `edgesOut` TypeError. npm 11.13.0 on installed Node 24.16.0 resolved the same manifests
without forcing peers. A subsequent npm 11 lockfile reconciliation pruned the optional Vitest 3
subtree and appeared to reduce the total to 10. However, `npm ls --all` exposed an invalid graph:
the web build package could see hoisted Vitest 4, which does not satisfy its optional ^3.1.1 peer.
That lower-count candidate was rejected even though its application tests passed.

The web workspace now explicitly binds `vitest ~3.2.7` to satisfy that peer, while API/contracts
retain patched Vitest 4.1.12. This is a peer-resolution binding, not a web runner migration or an
override. Clean `npm ci` plus `npm ls --all` verifies both graphs without invalid peers. The final
full audit is 13, not 10; compatible removal of this unused graph is deferred to an owner-supported
framework/test-builder change. The audit gate also checks installed graph validity so a future
pruning operation cannot exchange a lower advisory count for incompatible peers.

The web project selects `@angular/build:karma`. Its ordinary package test command still uses
Karma's default Chrome launcher and HTML reporter, so those integrations are retained. Owned
verification uses the Playwright-backed Karma launcher. Drizzle Kit is retained because
`npm run db:generate` actively uses it. Removing only declarations while retaining a vulnerable
consumer would not be remediation.

The unexecuted web Vitest 3 subtree retains [redirect mocking](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)
and two [Tinypool constructor](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) /
[run-options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) advisories. These have individual
exceptions; they are not silently omitted from the full audit. The active API/contracts runner
has the redirect-mock fix and no Tinypool dependency.

## Remaining Development Risk

The [machine-readable exception policy](../security/development-audit-exceptions.json) is the gate's
only allowlist. Each entry includes exact affected package/path/version/severity records (including
npm's inherited parent findings), dependency chains, commands, trust boundary, exploit conditions,
mitigation, follow-up, and owner `jeremyaaron`.

| Advisory | Remaining Path And Exposure | Disposition |
| --- | --- | --- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Web Karma `6.4.4` and its Chokidar `3.6.0` use braces `3.0.3`; deeply nested untrusted glob patterns can exhaust the stack | No patched release in the inspected range. Use reviewed repository globs, loopback-only verification, no untrusted test configuration with credentials. Recheck patches or separately scope a supported test-engine migration |
| [GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99) | Drizzle Kit `0.31.10` -> legacy esm-loader/core-utils -> esbuild `0.18.20`; the vulnerable serve API exposes responses cross-origin | Local schema generation does not start serve. Do not run Studio/serve from this graph or expose schema tooling; await an owner-supported legacy-loader removal. Production migrations use Drizzle ORM |
| [GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9) | Web Vitest/mocker `3.2.7`; reachable redirect-mock registration can read files outside the allowed root | Keep Karma active; do not launch Vitest 3 browser/UI/server or adopt its mocking plugins. Browser RPC requires a token, whereas public plugin HMR registration can be unauthenticated. Await a compatible backport or separately scoped Angular migration |
| [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) | Web Vitest `3.2.7` -> Tinypool `1.1.1`; prototype pollution followed by inherited constructor options can execute attacker-controlled code | Do not execute the unused web Vitest pool; reviewed, least-privilege tests only. Fixed Tinypool `2.1.2` is outside the owner's ^1.1.1 range |
| [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) | Same pool; polluted inherited filename read from caller-supplied run options | Keep the pool disabled and do not accept untrusted worker options. Recheck owner-supported backports or scope the Angular migration before expiry |

Registry metadata was also checked for Drizzle Kit `0.31.11`; it retains the same legacy loader
dependency and is not a remedy for this advisory. Karma's current release remains `6.4.4`, and
braces remains `3.0.3`. These findings were not left unresolved simply because a patch was overlooked.

All five expire at **00:00 UTC November 16, 2026**, or the **v0.3.1** version boundary, whichever is
first, and cannot exceed 30 days after the actual v0.3.0 release date. Phase 21 must set `releaseDate`
in the policy before changing package identity to `0.3.0`; release verification refuses a missing
date. A delayed release does not silently extend the absolute deadline. These are mitigated,
temporary development risks, not a declaration that the full tree is safe or clean.

## Gate Behavior

`npm run audit:dependencies` first validates the installed dependency graph, then runs production-only
and full-workspace audits separately. Full auditing
explicitly includes development/optional/peer dependencies. It validates npm's JSON report version,
counts, severities, exit status, advisory identities and chains, and lockfile paths. Private snapshots
validate npm's actual read-only installation owner and require its lockfile to match the snapshot;
their deliberately symlinked mirror is not treated as a fresh npm installation. Transport errors,
timeouts, non-JSON/error payloads and inconsistent reports cannot become a clean result. Production
findings never consult development exceptions.

Every full finding must match an unexpired advisory/package/path/version/severity record; unknown
or changed findings fail. Stale and duplicate exception records also fail so removed risk cannot
leave an evergreen exemption. Expiry is checked against UTC time and numeric release versions.

The full verification runner/CI invoke this gate and verify Drizzle generation in the run's private
source snapshot with its explicitly provisioned database context. Generation must leave SQL,
snapshots and journal byte-identical; failures cannot
leave migration churn in the working checkout. See [verification notes](verification-notes.md) for
clean-install, migration/preservation, native editor, build/budget, server and cleanup evidence.
