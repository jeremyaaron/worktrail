# Worktrail CSV Import And Export

Worktrail v0.0.7 supports project-scoped CSV import and CSV export for project and workspace work item lists.

Import is intentionally a two-step workflow:

1. Preview validates the CSV and returns normalized rows without creating work.
2. Apply revalidates the same CSV and creates all rows transactionally.

If any row is invalid during apply, no work items are created.

## Import Format

CSV import is available from a project work item list through `Import CSV`, or through:

```text
/projects/:projectId/work-items/import
```

The API accepts JSON with a `csv` string:

```http
POST /api/projects/:projectId/work-items/imports/preview
POST /api/projects/:projectId/work-items/imports
Content-Type: application/json
```

```json
{
  "csv": "title,type,priority\nImported task,task,medium\n"
}
```

## Columns

Required columns:

- `title`
- `type`
- `priority`

Optional columns:

- `description`
- `status`
- `assignee_email`
- `reporter_email`
- `label_names`
- `milestone_name`
- `due_date`
- `estimate_points`

Unsupported headers are rejected. Header names must match the column names above.

## Values

`type` must be one of:

- `task`
- `bug`
- `story`
- `chore`

`priority` must be one of:

- `low`
- `medium`
- `high`
- `urgent`

`status` is optional and defaults to `backlog`. When provided, it must be one of:

- `backlog`
- `ready`
- `in_progress`
- `blocked`
- `done`
- `canceled`

`reporter_email` is optional. When omitted, Worktrail uses the active actor as reporter.

`assignee_email` is optional. When provided, it must match exactly one active workspace member by email. Matching is case-insensitive.

`label_names` is optional. Use comma-separated label names inside the CSV field. Label lookup is case-insensitive, duplicate label names in a row are collapsed, and each row can include at most 20 labels.

`milestone_name` is optional. When provided, it must match exactly one non-archived project milestone by name. Matching is case-insensitive.

`due_date` is optional. When provided, it must be a valid `YYYY-MM-DD` date.

`estimate_points` is optional. When provided, it must be a non-negative integer.

## Sample CSV

```csv
title,description,type,status,priority,assignee_email,reporter_email,label_names,milestone_name,due_date,estimate_points
"Draft import checklist","Prepare team onboarding",task,ready,medium,morgan.maintainer@example.com,avery.owner@example.com,"backend,design",v0.0.3 Planning,2026-07-31,3
"Defaulted backlog story","Reporter defaults to the actor",story,,high,,,,,,
```

## Limits

- Maximum CSV payload: 1 MiB.
- Maximum data rows: 250.
- Maximum labels per row: 20.
- Maximum cell length: 10,000 characters.
- Import is blocked for archived projects.

The row count limit excludes the header row.

## Validation Behavior

Preview returns:

- `totalRows`: parsed data rows.
- `validRows`: rows that can be imported.
- `invalidRows`: rows with validation errors.
- `errors`: file-level or row-level errors.
- `warnings`: currently reserved for non-blocking import notes.
- `rows`: normalized valid rows that would be imported.

Preview does not write to the database.

File-level parsing errors return `totalRows` as `0` because Worktrail could not safely normalize the file. Row-level errors identify a row number and field when possible.

## Apply Behavior

Apply performs the same validation again before writing. If validation passes:

- work item display keys are assigned from the project key and next work item number;
- each imported work item uses normal create-work-item behavior;
- board positions are assigned for the requested status columns;
- labels and milestones are attached by resolved IDs;
- creation activity is recorded;
- the response includes `createdCount` and created work item summaries.

If validation fails or a write fails, the transaction rolls back and no partial import remains.

## Export Format

Project export:

```http
GET /api/projects/:projectId/work-items/export
Accept: text/csv
```

Workspace export:

```http
GET /api/work-items/export
Accept: text/csv
```

Both export endpoints use the same applied filters as their corresponding list endpoints. The response is `text/csv` with a `Content-Disposition` attachment filename.

Export columns:

- `project_key`
- `display_key`
- `title`
- `type`
- `status`
- `priority`
- `assignee_name`
- `assignee_email`
- `reporter_name`
- `reporter_email`
- `label_names`
- `milestone_name`
- `cycle_name`
- `due_date`
- `estimate_points`
- `created_at`
- `updated_at`
- `parent_key`
- `parent_title`

`cycle_name`, `parent_key`, and `parent_title` are export context only. CSV import does not assign
cycles or parent relationships. Top-level work exports empty parent values; child work includes its
direct parent key and title.

## Troubleshooting

`CSV import payload cannot exceed 1 MiB.`

Reduce the file size or split the import into smaller batches.

`CSV imports can include at most 250 data rows.`

Split the import into multiple files. The header row does not count toward this limit.

`CSV field "title" is required.`

Every row must include a non-empty title.

`CSV field "type" must be one of task, bug, story, chore.`

Use the lowercase enum values exactly as shown.

`CSV field "priority" must be one of low, medium, high, urgent.`

Use the lowercase enum values exactly as shown.

`Member "..." was not found.`

The email in `assignee_email` or `reporter_email` does not match an active workspace member.

`Label "..." was not found.`

The label name does not match an active label in the target project.

`Milestone "..." was not found.`

The milestone name does not match a non-archived milestone in the target project.

`CSV field "due_date" must be a valid YYYY-MM-DD date.`

Use a real calendar date such as `2026-07-31`.

`CSV field "estimate_points" must be a non-negative integer.`

Use whole numbers like `0`, `1`, `2`, `3`, `5`, or leave the field blank.
