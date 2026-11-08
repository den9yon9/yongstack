CREATE TABLE "phone_login_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(32) NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
-- 旧 phone 为自由文本: 非 E.164 置空, 重复值只保留最早一条, 再收紧类型/加唯一约束
UPDATE "users" SET "phone" = NULL WHERE "phone" IS NOT NULL AND "phone" !~ '^\+[1-9][0-9]{7,14}$';--> statement-breakpoint
UPDATE "users" SET "phone" = NULL WHERE "phone" IS NOT NULL AND "id" NOT IN (
	SELECT DISTINCT ON ("phone") "id" FROM "users" WHERE "phone" IS NOT NULL ORDER BY "phone", "created_at"
);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "phone" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "phone_login_codes_phone_created_idx" ON "phone_login_codes" USING btree ("phone","created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");