CREATE TABLE "after_sale" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_item_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"sku_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku_id" integer NOT NULL,
	"change" integer NOT NULL,
	"after_stock" integer NOT NULL,
	"biz_type" varchar(30) NOT NULL,
	"biz_id" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" varchar(32) NOT NULL,
	"user_id" integer NOT NULL,
	"address_snapshot" jsonb NOT NULL,
	"total_amount" integer NOT NULL,
	"discount_amount" integer DEFAULT 0,
	"pay_amount" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending_pay' NOT NULL,
	"pay_method" varchar(20),
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "order_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"sku_id" integer NOT NULL,
	"sku_snapshot" jsonb NOT NULL,
	"quantity" integer NOT NULL,
	"price" integer NOT NULL,
	"sub_total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"from_status" varchar(20),
	"to_status" varchar(20) NOT NULL,
	"operator" varchar(50),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"category_id" integer,
	"cover_url" varchar(512),
	"status" varchar(20) DEFAULT 'offline' NOT NULL,
	"info" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sku" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"attrs" jsonb NOT NULL,
	"attrs_text" varchar(255) NOT NULL,
	"price" integer NOT NULL,
	"original_price" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"sales" integer DEFAULT 0 NOT NULL,
	"image" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_address" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"receiver_name" varchar(50) NOT NULL,
	"receiver_phone" varchar(20) NOT NULL,
	"province" varchar(50) NOT NULL,
	"city" varchar(50) NOT NULL,
	"district" varchar(50) NOT NULL,
	"detail" varchar(255) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" varchar(20) DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "after_sale" ADD CONSTRAINT "after_sale_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "after_sale" ADD CONSTRAINT "after_sale_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_sku_id_product_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."product_sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_log" ADD CONSTRAINT "inventory_log_sku_id_product_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."product_sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_sku_id_product_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."product_sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_log" ADD CONSTRAINT "order_log_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_product_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sku" ADD CONSTRAINT "product_sku_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_address" ADD CONSTRAINT "user_address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_user_sku_idx" ON "cart" USING btree ("user_id","sku_id");