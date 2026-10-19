ALTER TABLE "comments" ADD COLUMN "body_format" text DEFAULT 'plain_text' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "description_format" text DEFAULT 'plain_text' NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_body_format_check" CHECK (body_format in ('plain_text', 'markdown_v1'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_description_format_check" CHECK (description_format in ('plain_text', 'markdown_v1'));