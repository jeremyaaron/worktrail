# Worktrail v0.3.1 Pattern Notes

## Purpose

These maintenance observations complement the [product ownership patterns](../v0.3.0/pattern-notes.md).
They describe proven local boundaries, not a new framework, extracted package or universal upgrade
process. Concrete results and residual limits are in the [verification notes](verification-notes.md).

## Remediate Owners, Not Just Vulnerable Leaves

Trace advisories through actual installed owners and physical peer identities. A compatible-looking
lockfile can still resolve a second framework runtime. Owner-supported upgrades and explicit peer
bindings preserve coherent build/test behavior; blanket overrides or forced installs do not prove
compatibility. Use live full audits as well as frozen regressions for retired advisory ranges.
An empty exception list is a required outcome here, not an excuse to loosen collection failures.

## Preserve Meaning Across Tool Formats

A migration folder conversion is not permission to replace historical SQL or reconstruct ledger
history. Compare original byte hashes, IDs and timestamps, then verify both fresh schema equivalence
and populated prior-version adoption. Preserve authored formats, immutable historical JSON, metadata
and referenced object bytes independently. Unknown historical application times should remain unknown.
Compilation and a fresh empty database cannot prove upgrade safety. Pin a deliberate prerelease
pair and document coordinated recovery rather than implying automatic downgrade support.

## Treat Runner Migration As A Coverage Migration

Keep an explicit, disjoint spec inventory while old and new runners coexist; fail when discovery
omits or duplicates a file. Preserve lifecycle scheduling, actual HTTP/router behavior and native
browser operations rather than merely matching case counts. Remove transitional manifests and
the obsolete runner after the full cutover. Interactive watch is live-source debugging, not an
acceptance pass; private automated snapshots and cleanup have different ownership requirements.

## Test Conditions, Not Elapsed Time

Observe meaningful readiness, controlled response ordering and registered process identity. A
deadline bounds a stalled operation; elapsed sleep is not proof that the next action is valid.
Do not infer a causal repair from a later green rerun. Retain diagnostic failures and distinguish
observations, hypotheses and clean acceptance. Isolation and failure/interruption cleanup are
part of the verification contract, not optional housekeeping.

## Spend Verification At Changed Boundaries

Convert focused groups with affected consumers, accept the completed toolchain with broad coverage,
then reuse unchanged executable evidence for documentation closure. Fresh independent install,
populated upgrade, runtime/browser behavior and peer/audit validity answer different questions.
Record source/lock identity, commands, ownership, cleanup and omissions so reuse is reviewable.
Measure both critical path and total runner cost before redistributing CI work. Deferring an
unmeasured optimization is preferable to claiming savings without comparable evidence.
