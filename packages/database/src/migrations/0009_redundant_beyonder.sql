CREATE TYPE "public"."file_status" AS ENUM('pending', 'ready');--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "status" "file_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
CREATE INDEX "files_status_created_at_idx" ON "files" USING btree ("status","created_at");