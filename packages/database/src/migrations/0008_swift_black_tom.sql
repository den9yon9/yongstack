CREATE TYPE "public"."idempotency_key_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "status_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "response_body" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "response_body" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD COLUMN "status" "idempotency_key_status" DEFAULT 'in_progress' NOT NULL;--> statement-breakpoint
-- 存量行都是已完成的响应, 不回填会在其 TTL 内一直返回 IN_PROGRESS
UPDATE "idempotency_keys" SET "status" = 'completed' WHERE "status_code" IS NOT NULL;