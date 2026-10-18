CREATE TABLE "work_item_relationships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"source_work_item_id" uuid NOT NULL,
	"target_work_item_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "work_item_relationships_type_check" CHECK (relationship_type in ('blocks', 'relates_to')),
	CONSTRAINT "work_item_relationships_no_self_check" CHECK ("work_item_relationships"."source_work_item_id" <> "work_item_relationships"."target_work_item_id")
);
--> statement-breakpoint
ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_event_type_check";--> statement-breakpoint
ALTER TABLE "work_item_relationships" ADD CONSTRAINT "work_item_relationships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_relationships" ADD CONSTRAINT "work_item_relationships_source_work_item_id_work_items_id_fk" FOREIGN KEY ("source_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_relationships" ADD CONSTRAINT "work_item_relationships_target_work_item_id_work_items_id_fk" FOREIGN KEY ("target_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_relationships" ADD CONSTRAINT "work_item_relationships_created_by_id_members_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_item_relationships_workspace_id_idx" ON "work_item_relationships" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "work_item_relationships_source_work_item_id_idx" ON "work_item_relationships" USING btree ("source_work_item_id");--> statement-breakpoint
CREATE INDEX "work_item_relationships_target_work_item_id_idx" ON "work_item_relationships" USING btree ("target_work_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_item_relationships_unique" ON "work_item_relationships" USING btree ("workspace_id","relationship_type","source_work_item_id","target_work_item_id");--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_event_type_check" CHECK (event_type in ('project.name_changed', 'project.description_changed', 'project.archived', 'project.reactivated', 'milestone.created', 'milestone.name_changed', 'milestone.description_changed', 'milestone.status_changed', 'milestone.target_date_changed', 'milestone.archived', 'milestone.reactivated', 'label.created', 'label.name_changed', 'label.color_changed', 'label.archived', 'label.reactivated', 'work_item.created', 'work_item.title_changed', 'work_item.description_changed', 'work_item.status_changed', 'work_item.assignee_changed', 'work_item.priority_changed', 'work_item.milestone_changed', 'work_item.label_added', 'work_item.label_removed', 'work_item.relationship_added', 'work_item.relationship_removed', 'comment.added', 'comment.edited', 'comment.deleted'));