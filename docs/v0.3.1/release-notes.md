# Worktrail v0.3.1 Release Notes

## Summary

This maintenance release retires all five bounded development advisory exceptions while retaining
the v0.3.0 product behavior, authored content, historical evidence and stored files. It modernizes
the Angular test/build and Drizzle toolchains without adding another product feature area.

This is local release preparation. Final verification is recorded in the
[release evidence](verification-notes.md#phase-11-final-release-verification); merge, remote CI,
tag and Pages publication remain separate user-controlled actions. The staged site footer and
intended tag link are not proof of publication. No application deployment or npm publication is included.

## Toolchain Changes

- Angular runtime/compiler `21.2.25`, CLI/build `21.2.27`, CDK `21.2.14` and angular-eslint `21.4.0`.
- TypeScript `5.9.3`, Vitest/browser provider `4.1.12` and Playwright `1.61.1` on Node 24/npm 11.
- One Angular Vitest/real-Chromium test target replaces Karma/Jasmine and temporary migration
  partitions. Focused literal includes, name filters and explicit live-source watch/headed modes
  retain owned startup/shutdown and failure reporting. Interactive sessions are not acceptance passes.
- Exact Drizzle Kit/ORM `1.0.0-rc.4` removes the legacy vulnerable loader. This deliberately adopted
  prerelease pair has generation, upgrade and runtime evidence, not a blanket future compatibility
  or downgrade guarantee.

Production/TestBed retain Zone-based scheduling; routes remain lazy. Bundle/style budgets, browser
retries and test deadlines are not raised. No production identity, cloud storage or new runtime
service is introduced. See the [dependency disposition](dependency-remediation.md) for the
retired chains and point-in-time audit results. Zero findings are not a security certification.

## Upgrade Preserved Data

Stop writes and back up PostgreSQL and the complete marked attachment store together. Retain the
original runtime configuration and prior release/lockfile. With those original database/storage
settings exported, install the new release and run:

```sh
nvm use
npm ci
npm run db:migrate
npm run build
npm run start:prod
```

Do not seed, reset, change attachment roots, reconvert historical folders or edit ledger rows to
upgrade. No new domain DDL is added: all 20 historical SQL files keep their exact bytes and order.
Timestamped folders now hold `migration.sql`/`snapshot.json` instead of the old flat SQL/meta layout.
The owner migrator preserves prior ledger IDs/hashes/millisecond timestamps, adds mapped names and
leaves unknown historical application times null. Fresh ledgers use UTC-second folder timestamps.
Repeated migration is a no-op. Future deliberate schema changes use `npm run db:generate`, SQL/snapshot
review and then ordinary migration; generation does not apply SQL.

There is no supported automatic down-migration or RC-to-stable downgrade. Recovery requires the
coordinated pre-upgrade database/store backup and matching prior code/configuration; post-backup
writes need separate reconciliation. See [operations](../operations.md#v031-toolchain-boundary),
[preservation evidence](phase-7-evidence.json) and [fresh setup acceptance](phase-10-evidence.json).

## Verification And Handoff

Comprehensive CI runs on PRs, not again on main-push. The existing `Verify` aggregate requires all
independent jobs; application shards own separate fixtures with one worker and zero browser retries.
The separate main-push Pages workflow publishes only the static product site. Repository protections
are not configured by local edits. Optional further shard balancing is deferred; no unmeasured
speedup is claimed.

Use [current testing guidance](../development.md#testing-and-verification) for focused checks rather
than repeating every suite after every edit. [Known limits](known-limits.md) records prerelease,
manual accessibility/device and local/demo operating boundaries, plus the publication checklist.
The unexplained Phase 5 Quick Find observation remains disclosed, not relabeled a causal fix.
