CREATE TABLE "file_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" varchar(512) NOT NULL,
	"uploader_id" integer NOT NULL,
	"scene" varchar(50) NOT NULL,
	"size" integer NOT NULL,
	"ref_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_record_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"wechat_open_id" varchar(256),
	"phone" varchar(20),
	"nickname" varchar(256),
	"username" varchar(50),
	"avatar_url" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_wechat_open_id_unique" UNIQUE("wechat_open_id"),
	CONSTRAINT "user_phone_unique" UNIQUE("phone"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX "file_ref_count_idx" ON "file_record" USING btree ("ref_count");--> statement-breakpoint
CREATE INDEX "file_created_at_idx" ON "file_record" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wechat_open_id_idx" ON "user" USING btree ("wechat_open_id");--> statement-breakpoint
CREATE INDEX "user_phone_idx" ON "user" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_idx" ON "user" USING btree ("username");