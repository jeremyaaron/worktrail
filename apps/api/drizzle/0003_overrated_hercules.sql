CREATE TABLE "workspace_activity_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"summary" text NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "workspace_activity_events_event_type_check" CHECK (event_type in ('member.created', 'member.name_changed', 'member.email_changed', 'member.role_changed', 'member.deactivated', 'member.reactivated', 'workspace.name_changed', 'project.created'))
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "deactivated_by_id" uuid;--> statement-breakpoint
UPDATE "members"
SET "deactivated_at" = "updated_at"
WHERE "is_active" = false
  AND "deactivated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "workspace_activity_events" ADD CONSTRAINT "workspace_activity_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_activity_events" ADD CONSTRAINT "workspace_activity_events_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_activity_events_workspace_id_created_at_idx" ON "workspace_activity_events" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workspace_activity_events_actor_id_idx" ON "workspace_activity_events" USING btree ("actor_id");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_deactivated_by_id_members_id_fk" FOREIGN KEY ("deactivated_by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
