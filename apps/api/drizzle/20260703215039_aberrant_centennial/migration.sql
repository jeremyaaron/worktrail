CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"work_item_id" uuid,
	"actor_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"summary" text NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "activity_events_event_type_check" CHECK (event_type in ('work_item.created', 'work_item.title_changed', 'work_item.description_changed', 'work_item.status_changed', 'work_item.assignee_changed', 'work_item.priority_changed', 'work_item.label_added', 'work_item.label_removed', 'comment.added'))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "members_role_check" CHECK (role in ('owner', 'maintainer', 'contributor'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "projects_status_check" CHECK (status in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "work_item_labels" (
	"work_item_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "work_item_labels_work_item_id_label_id_pk" PRIMARY KEY("work_item_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"assignee_id" uuid,
	"reporter_id" uuid NOT NULL,
	"due_date" date,
	"estimate_points" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "work_items_type_check" CHECK (type in ('task', 'bug', 'story', 'chore')),
	CONSTRAINT "work_items_status_check" CHECK (status in ('backlog', 'ready', 'in_progress', 'blocked', 'done', 'canceled')),
	CONSTRAINT "work_items_priority_check" CHECK (priority in ('low', 'medium', 'high', 'urgent'))
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_labels" ADD CONSTRAINT "work_item_labels_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_labels" ADD CONSTRAINT "work_item_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assignee_id_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_reporter_id_members_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_work_item_id_created_at_idx" ON "activity_events" USING btree ("work_item_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_events_project_id_created_at_idx" ON "activity_events" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "comments_work_item_id_created_at_idx" ON "comments" USING btree ("work_item_id","created_at");--> statement-breakpoint
CREATE INDEX "labels_workspace_id_name_idx" ON "labels" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_project_id_name_unique" ON "labels" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "members_workspace_id_idx" ON "members" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_workspace_id_email_unique" ON "members" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "projects_workspace_id_status_idx" ON "projects" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "work_item_labels_label_id_idx" ON "work_item_labels" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "work_items_project_id_status_idx" ON "work_items" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "work_items_project_id_assignee_id_idx" ON "work_items" USING btree ("project_id","assignee_id");--> statement-breakpoint
CREATE INDEX "work_items_project_id_type_idx" ON "work_items" USING btree ("project_id","type");--> statement-breakpoint
CREATE INDEX "work_items_project_id_priority_idx" ON "work_items" USING btree ("project_id","priority");--> statement-breakpoint
CREATE INDEX "work_items_project_id_updated_at_idx" ON "work_items" USING btree ("project_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "work_items_project_id_title_idx" ON "work_items" USING btree ("project_id","title");