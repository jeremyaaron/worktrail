CREATE TABLE "comment_mentions" (
	"comment_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "comment_mentions_comment_id_member_id_pk" PRIMARY KEY("comment_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recipient_member_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"project_id" uuid,
	"work_item_id" uuid,
	"activity_event_id" uuid,
	"notification_type" text NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_event_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notifications_type_check" CHECK (notification_type in ('assignment', 'mention', 'watched_comment', 'watched_status_change', 'watched_assignee_change', 'watched_relationship_change', 'dependency_blocker_added', 'dependency_blocker_removed'))
);
--> statement-breakpoint
CREATE TABLE "work_item_watchers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"watched_at" timestamp with time zone NOT NULL,
	"unwatched_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_member_id_members_id_fk" FOREIGN KEY ("recipient_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_member_id_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_activity_event_id_activity_events_id_fk" FOREIGN KEY ("activity_event_id") REFERENCES "public"."activity_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_watchers" ADD CONSTRAINT "work_item_watchers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_watchers" ADD CONSTRAINT "work_item_watchers_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_watchers" ADD CONSTRAINT "work_item_watchers_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_mentions_workspace_member_created_idx" ON "comment_mentions" USING btree ("workspace_id","member_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "comment_mentions_work_item_created_idx" ON "comment_mentions" USING btree ("work_item_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_workspace_recipient_read_created_idx" ON "notifications" USING btree ("workspace_id","recipient_member_id","read_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_workspace_recipient_created_idx" ON "notifications" USING btree ("workspace_id","recipient_member_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_work_item_created_idx" ON "notifications" USING btree ("work_item_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_recipient_source_event_unique" ON "notifications" USING btree ("recipient_member_id","source_event_key") WHERE "notifications"."source_event_key" is not null;--> statement-breakpoint
CREATE INDEX "work_item_watchers_workspace_member_unwatched_idx" ON "work_item_watchers" USING btree ("workspace_id","member_id","unwatched_at");--> statement-breakpoint
CREATE INDEX "work_item_watchers_work_item_unwatched_idx" ON "work_item_watchers" USING btree ("work_item_id","unwatched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_item_watchers_active_unique" ON "work_item_watchers" USING btree ("work_item_id","member_id") WHERE "work_item_watchers"."unwatched_at" is null;