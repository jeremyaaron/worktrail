CREATE TABLE "project_status_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"author_member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status_date" date NOT NULL,
	"summary" text NOT NULL,
	"highlights" text DEFAULT '' NOT NULL,
	"risks" text DEFAULT '' NOT NULL,
	"next_steps" text DEFAULT '' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_event_type_check";--> statement-breakpoint
ALTER TABLE "project_status_reports" ADD CONSTRAINT "project_status_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_reports" ADD CONSTRAINT "project_status_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_reports" ADD CONSTRAINT "project_status_reports_author_member_id_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_status_reports_project_published_idx" ON "project_status_reports" USING btree ("project_id","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "project_status_reports_workspace_project_idx" ON "project_status_reports" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "project_status_reports_author_idx" ON "project_status_reports" USING btree ("author_member_id");--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_event_type_check" CHECK (event_type in ('project.name_changed', 'project.description_changed', 'project.archived', 'project.reactivated', 'milestone.created', 'milestone.name_changed', 'milestone.description_changed', 'milestone.status_changed', 'milestone.target_date_changed', 'milestone.archived', 'milestone.reactivated', 'label.created', 'label.name_changed', 'label.color_changed', 'label.archived', 'label.reactivated', 'work_item.created', 'work_item.title_changed', 'work_item.description_changed', 'work_item.status_changed', 'work_item.assignee_changed', 'work_item.priority_changed', 'work_item.due_date_changed', 'work_item.milestone_changed', 'work_item.label_added', 'work_item.label_removed', 'work_item.relationship_added', 'work_item.relationship_removed', 'saved_view.created', 'saved_view.name_changed', 'saved_view.query_changed', 'saved_view.updated', 'saved_view.pinned', 'saved_view.unpinned', 'saved_view.deleted', 'status_report.published', 'comment.added', 'comment.edited', 'comment.deleted'));