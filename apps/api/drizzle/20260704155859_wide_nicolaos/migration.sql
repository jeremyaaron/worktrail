CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"target_date" date,
	"archived_at" timestamp with time zone,
	"archived_by_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "milestones_status_check" CHECK (status in ('planned', 'active', 'completed', 'canceled'))
);
--> statement-breakpoint
ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_event_type_check";--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "milestone_id" uuid;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "board_position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH ordered_items AS (
	SELECT
		"id",
		ROW_NUMBER() OVER (
			PARTITION BY "project_id", "status"
			ORDER BY "updated_at" DESC, "item_number" ASC, "id" ASC
		) AS "position_number"
	FROM "work_items"
)
UPDATE "work_items"
SET "board_position" = ordered_items."position_number" * 1024
FROM ordered_items
WHERE "work_items"."id" = ordered_items."id";--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_archived_by_id_members_id_fk" FOREIGN KEY ("archived_by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestones_project_id_status_idx" ON "milestones" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "milestones_project_id_target_date_idx" ON "milestones" USING btree ("project_id","target_date");--> statement-breakpoint
CREATE INDEX "milestones_project_id_archived_at_idx" ON "milestones" USING btree ("project_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "milestones_project_id_active_name_unique" ON "milestones" USING btree ("project_id",lower("name")) WHERE "milestones"."archived_at" is null;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_items_project_id_milestone_id_idx" ON "work_items" USING btree ("project_id","milestone_id");--> statement-breakpoint
CREATE INDEX "work_items_project_id_status_board_position_idx" ON "work_items" USING btree ("project_id","status","board_position");--> statement-breakpoint
CREATE INDEX "work_items_project_id_due_date_idx" ON "work_items" USING btree ("project_id","due_date");--> statement-breakpoint
CREATE INDEX "work_items_project_id_reporter_id_idx" ON "work_items" USING btree ("project_id","reporter_id");--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_event_type_check" CHECK (event_type in ('project.name_changed', 'project.description_changed', 'project.archived', 'project.reactivated', 'milestone.created', 'milestone.name_changed', 'milestone.description_changed', 'milestone.status_changed', 'milestone.target_date_changed', 'milestone.archived', 'milestone.reactivated', 'label.created', 'label.name_changed', 'label.color_changed', 'label.archived', 'label.reactivated', 'work_item.created', 'work_item.title_changed', 'work_item.description_changed', 'work_item.status_changed', 'work_item.assignee_changed', 'work_item.priority_changed', 'work_item.milestone_changed', 'work_item.label_added', 'work_item.label_removed', 'comment.added', 'comment.edited', 'comment.deleted'));
