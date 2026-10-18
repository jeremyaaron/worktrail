CREATE TABLE "work_item_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"uploader_member_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum_sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "work_item_attachments_byte_size_check" CHECK ("work_item_attachments"."byte_size" > 0 and "work_item_attachments"."byte_size" <= 4194304),
	CONSTRAINT "work_item_attachments_file_name_check" CHECK (char_length("work_item_attachments"."file_name") between 1 and 180),
	CONSTRAINT "work_item_attachments_checksum_sha256_check" CHECK ("work_item_attachments"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "work_item_attachments_storage_key_check" CHECK ("work_item_attachments"."storage_key" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_event_type_check";--> statement-breakpoint
ALTER TABLE "work_item_attachments" ADD CONSTRAINT "work_item_attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_attachments" ADD CONSTRAINT "work_item_attachments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_attachments" ADD CONSTRAINT "work_item_attachments_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_attachments" ADD CONSTRAINT "work_item_attachments_uploader_member_id_members_id_fk" FOREIGN KEY ("uploader_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_item_attachments_work_item_created_id_idx" ON "work_item_attachments" USING btree ("work_item_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "work_item_attachments_workspace_id_idx" ON "work_item_attachments" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_item_attachments_storage_key_unique" ON "work_item_attachments" USING btree ("storage_key");--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_event_type_check" CHECK (event_type in ('project.name_changed', 'project.description_changed', 'project.archived', 'project.reactivated', 'cycle.closed', 'milestone.created', 'milestone.name_changed', 'milestone.description_changed', 'milestone.status_changed', 'milestone.target_date_changed', 'milestone.archived', 'milestone.reactivated', 'label.created', 'label.name_changed', 'label.color_changed', 'label.archived', 'label.reactivated', 'work_item.created', 'work_item.title_changed', 'work_item.description_changed', 'work_item.status_changed', 'work_item.assignee_changed', 'work_item.priority_changed', 'work_item.due_date_changed', 'work_item.milestone_changed', 'work_item.cycle_changed', 'work_item.parent_changed', 'work_item.label_added', 'work_item.label_removed', 'work_item.relationship_added', 'work_item.relationship_removed', 'work_item.attachment_uploaded', 'work_item.attachment_removed', 'saved_view.created', 'saved_view.name_changed', 'saved_view.query_changed', 'saved_view.updated', 'saved_view.pinned', 'saved_view.unpinned', 'saved_view.deleted', 'status_report.published', 'comment.added', 'comment.edited', 'comment.deleted'));