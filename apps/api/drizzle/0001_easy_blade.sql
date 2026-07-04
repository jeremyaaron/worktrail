ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_event_type_check";--> statement-breakpoint
DROP INDEX "labels_project_id_name_unique";--> statement-breakpoint

ALTER TABLE "comments" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "deleted_by_id" uuid;--> statement-breakpoint

ALTER TABLE "labels" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "archived_by_id" uuid;--> statement-breakpoint

ALTER TABLE "projects" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "next_work_item_number" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "item_number" integer;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "display_key" text;--> statement-breakpoint

WITH key_candidates AS (
  SELECT
    "id",
    "workspace_id",
    CASE
      WHEN LENGTH("normalized_key") >= 2 THEN LEFT("normalized_key", 6)
      ELSE 'PR'
    END AS "base_key"
  FROM (
    SELECT
      "id",
      "workspace_id",
      regexp_replace(UPPER("name"), '[^A-Z0-9]', '', 'g') AS "normalized_key"
    FROM "projects"
  ) normalized_projects
),
ranked_keys AS (
  SELECT
    "id",
    "workspace_id",
    "base_key",
    ROW_NUMBER() OVER (PARTITION BY "workspace_id", "base_key" ORDER BY "id") AS "duplicate_number",
    COUNT(*) OVER (PARTITION BY "workspace_id", "base_key") AS "duplicate_count"
  FROM key_candidates
),
project_keys AS (
  SELECT
    "id",
    CASE
      WHEN "duplicate_count" = 1 THEN LEFT("base_key", 8)
      ELSE LEFT("base_key", 8 - LENGTH("duplicate_number"::text)) || "duplicate_number"::text
    END AS "project_key"
  FROM ranked_keys
)
UPDATE "projects"
SET "key" = project_keys."project_key"
FROM project_keys
WHERE "projects"."id" = project_keys."id";--> statement-breakpoint

WITH numbered_items AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "project_id" ORDER BY "created_at", "id") AS "next_item_number"
  FROM "work_items"
)
UPDATE "work_items"
SET "item_number" = numbered_items."next_item_number"
FROM numbered_items
WHERE "work_items"."id" = numbered_items."id";--> statement-breakpoint

UPDATE "work_items"
SET "display_key" = "projects"."key" || '-' || "work_items"."item_number"::text
FROM "projects"
WHERE "work_items"."project_id" = "projects"."id";--> statement-breakpoint

WITH project_counters AS (
  SELECT
    "projects"."id",
    COALESCE(MAX("work_items"."item_number"), 0) + 1 AS "next_number"
  FROM "projects"
  LEFT JOIN "work_items" ON "work_items"."project_id" = "projects"."id"
  GROUP BY "projects"."id"
)
UPDATE "projects"
SET "next_work_item_number" = project_counters."next_number"
FROM project_counters
WHERE "projects"."id" = project_counters."id";--> statement-breakpoint

ALTER TABLE "projects" ALTER COLUMN "key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "next_work_item_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "work_items" ALTER COLUMN "item_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "work_items" ALTER COLUMN "display_key" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "comments" ADD CONSTRAINT "comments_deleted_by_id_members_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_archived_by_id_members_id_fk" FOREIGN KEY ("archived_by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "labels_project_id_archived_at_idx" ON "labels" USING btree ("project_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_project_id_active_name_unique" ON "labels" USING btree ("project_id",lower("name")) WHERE "labels"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_id_key_unique" ON "projects" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "work_items_project_id_item_number_unique" ON "work_items" USING btree ("project_id","item_number");--> statement-breakpoint
CREATE UNIQUE INDEX "work_items_workspace_id_display_key_unique" ON "work_items" USING btree ("workspace_id","display_key");--> statement-breakpoint

ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_event_type_check" CHECK (event_type in ('project.name_changed', 'project.description_changed', 'project.archived', 'project.reactivated', 'label.created', 'label.name_changed', 'label.color_changed', 'label.archived', 'label.reactivated', 'work_item.created', 'work_item.title_changed', 'work_item.description_changed', 'work_item.status_changed', 'work_item.assignee_changed', 'work_item.priority_changed', 'work_item.label_added', 'work_item.label_removed', 'comment.added', 'comment.edited', 'comment.deleted'));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_key_check" CHECK ("projects"."key" ~ '^[A-Z0-9]{2,8}$');--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_next_work_item_number_check" CHECK ("projects"."next_work_item_number" > 0);--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_item_number_check" CHECK ("work_items"."item_number" > 0);
