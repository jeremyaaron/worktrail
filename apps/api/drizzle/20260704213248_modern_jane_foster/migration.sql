CREATE TABLE "saved_work_views" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"visibility" text NOT NULL,
	"query" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "saved_work_views_visibility_check" CHECK (visibility in ('personal'))
);
--> statement-breakpoint
ALTER TABLE "saved_work_views" ADD CONSTRAINT "saved_work_views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_work_views" ADD CONSTRAINT "saved_work_views_owner_member_id_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_work_views_workspace_owner_updated_idx" ON "saved_work_views" USING btree ("workspace_id","owner_member_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "saved_work_views_workspace_owner_name_unique" ON "saved_work_views" USING btree ("workspace_id","owner_member_id",lower("name"));--> statement-breakpoint
CREATE INDEX "work_items_workspace_id_status_idx" ON "work_items" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "work_items_workspace_id_assignee_id_idx" ON "work_items" USING btree ("workspace_id","assignee_id");--> statement-breakpoint
CREATE INDEX "work_items_workspace_id_reporter_id_idx" ON "work_items" USING btree ("workspace_id","reporter_id");--> statement-breakpoint
CREATE INDEX "work_items_workspace_id_priority_idx" ON "work_items" USING btree ("workspace_id","priority");--> statement-breakpoint
CREATE INDEX "work_items_workspace_id_due_date_idx" ON "work_items" USING btree ("workspace_id","due_date");--> statement-breakpoint
CREATE INDEX "work_items_workspace_id_updated_at_idx" ON "work_items" USING btree ("workspace_id","updated_at" DESC NULLS LAST);