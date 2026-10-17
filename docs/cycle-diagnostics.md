# Cycle Schedule Diagnostics

Project/cycle commands coordinate planned and active schedules before validation. Existing databases
can still contain overlapping cycles from earlier releases or unsupported direct SQL writes. This
operator command reports conflicts without changing schedules, work assignments, or closeout evidence.

## Inspect

Use the supported Node/npm runtime and configure the intended database as for migrations. From the
repository root:

```sh
npm run db:cycle-diagnostics
npm run db:cycle-diagnostics -- --workspace-id=<workspace-uuid>
```

The command uses a repeatable-read, read-only transaction. It emits JSON with `readOnly`,
`conflictCount`, and stable project/cycle ID pairs, plus project keys and `dateOverlap`/`activeConflict`
flags. It prints no credentials, authored content, or work-item details. A nonzero conflict count is
a successful inspection, not a failed repair. Invalid arguments or database failures exit nonzero;
no repair is attempted. This is an operator CLI, not an authenticated tenant API.

Only nonarchived planned/active pairs in the same workspace/project are compared. Date boundaries
are inclusive: a cycle ending on the day another starts overlaps. Two active cycles also conflict
when their dates do not overlap. Completed, canceled, and archived cycles are excluded. Existing
unique indexes normally prevent duplicate active cycles; the diagnostic can report them in a legacy
database that lacks that backstop, but does not remove or disable indexes to manufacture that state.

## Remediate Deliberately

1. Preserve a database backup and inspect each reported pair in the project's cycle management and
   review pages. Confirm intended dates, status, assignments, and any existing closeout evidence.
2. Have an owner or maintainer choose the correct schedule. Through supported application commands,
   adjust dates, cancel an unused planned/active cycle, or archive a record when that matches intent.
   A canceled or completed nonarchived record still reserves its name. Do not complete an active
   cycle casually: use guided closeout when carry-forward and immutable evidence are needed.
3. Resolve one pair at a time and inspect the result. Ordinary validation can reject an edit that
   leaves a planned/active overlap; cancellation or archive may be the appropriate first action.
4. Rerun the diagnostic for the affected workspace and retain the operator's decision outside the
   command output. Zero conflicts means no compared pair currently violates these rules, not that
   every historical cycle or application invariant has been audited.

There is no automatic reschedule, archive, deletion, data migration, or new PostgreSQL extension.
Do not edit stored closeout snapshots to match later work changes or reopen completed cycles by SQL.
Direct SQL bypasses cooperative project gates; unsupported repairs require a separately reviewed
maintenance procedure with application writers stopped. Verification exercises this command only
against disposable owned databases, never the working application database.
