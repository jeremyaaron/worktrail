CREATE TABLE "project_cycles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"target_points" integer,
	"archived_at" timestamp with time zone,
	"archived_by_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "project_cycles_status_check" CHECK (status in ('planned', 'active', 'completed', 'canceled')),
	CONSTRAINT "project_cycles_date_range_check" CHECK ("project_cycles"."start_date" <= "project_cycles"."end_date"),
	CONSTRAINT "project_cycles_target_points_check" CHECK ("project_cycles"."target_points" is null or "project_cycles"."target_points" > 0)
);
--> statement-breakpoint
ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_event_type_check";--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "cycle_id" uuid;--> statement-breakpoint
ALTER TABLE "project_cycles" ADD CONSTRAINT "project_cycles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cycles" ADD CONSTRAINT "project_cycles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cycles" ADD CONSTRAINT "project_cycles_archived_by_id_members_id_fk" FOREIGN KEY ("archived_by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_cycles_workspace_id_idx" ON "project_cycles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "project_cycles_project_id_status_idx" ON "project_cycles" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "project_cycles_project_id_start_date_idx" ON "project_cycles" USING btree ("project_id","start_date");--> statement-breakpoint
CREATE INDEX "project_cycles_project_id_archived_at_idx" ON "project_cycles" USING btree ("project_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_cycles_project_id_active_unique" ON "project_cycles" USING btree ("project_id") WHERE "project_cycles"."status" = 'active' and "project_cycles"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "project_cycles_project_id_active_name_unique" ON "project_cycles" USING btree ("project_id",lower("name")) WHERE "project_cycles"."archived_at" is null;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_cycle_id_project_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."project_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_items_project_id_cycle_id_idx" ON "work_items" USING btree ("project_id","cycle_id");--> statement-breakpoint
CREATE INDEX "work_items_workspace_id_cycle_id_idx" ON "work_items" USING btree ("workspace_id","cycle_id");--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_event_type_check" CHECK (event_type in ('project.name_changed', 'project.description_changed', 'project.archived', 'project.reactivated', 'milestone.created', 'milestone.name_changed', 'milestone.description_changed', 'milestone.status_changed', 'milestone.target_date_changed', 'milestone.archived', 'milestone.reactivated', 'label.created', 'label.name_changed', 'label.color_changed', 'label.archived', 'label.reactivated', 'work_item.created', 'work_item.title_changed', 'work_item.description_changed', 'work_item.status_changed', 'work_item.assignee_changed', 'work_item.priority_changed', 'work_item.due_date_changed', 'work_item.milestone_changed', 'work_item.cycle_changed', 'work_item.label_added', 'work_item.label_removed', 'work_item.relationship_added', 'work_item.relationship_removed', 'saved_view.created', 'saved_view.name_changed', 'saved_view.query_changed', 'saved_view.updated', 'saved_view.pinned', 'saved_view.unpinned', 'saved_view.deleted', 'status_report.published', 'comment.added', 'comment.edited', 'comment.deleted'));