CREATE INDEX "milestones_workspace_id_idx" ON "milestones" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "milestones_name_trgm_idx" ON "milestones" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "milestones_description_trgm_idx" ON "milestones" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "project_cycles_name_trgm_idx" ON "project_cycles" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "project_status_reports_title_trgm_idx" ON "project_status_reports" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "project_status_reports_summary_trgm_idx" ON "project_status_reports" USING gin ("summary" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "projects_name_trgm_idx" ON "projects" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "projects_description_trgm_idx" ON "projects" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "work_item_attachments_file_name_trgm_idx" ON "work_item_attachments" USING gin ("file_name" gin_trgm_ops);