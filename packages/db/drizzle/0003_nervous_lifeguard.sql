ALTER TABLE "user" DROP CONSTRAINT "user_wechat_open_id_unique";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_username_unique";--> statement-breakpoint
ALTER TABLE "after_sale" DROP CONSTRAINT "after_sale_order_item_id_order_item_id_fk";
--> statement-breakpoint
ALTER TABLE "after_sale" DROP CONSTRAINT "after_sale_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "cart" DROP CONSTRAINT "cart_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "cart" DROP CONSTRAINT "cart_sku_id_product_sku_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_log" DROP CONSTRAINT "inventory_log_sku_id_product_sku_id_fk";
--> statement-breakpoint
ALTER TABLE "order" DROP CONSTRAINT "order_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "order_item" DROP CONSTRAINT "order_item_order_id_order_id_fk";
--> statement-breakpoint
ALTER TABLE "order_item" DROP CONSTRAINT "order_item_sku_id_product_sku_id_fk";
--> statement-breakpoint
ALTER TABLE "order_log" DROP CONSTRAINT "order_log_order_id_order_id_fk";
--> statement-breakpoint
ALTER TABLE "product_sku" DROP CONSTRAINT "product_sku_product_id_product_id_fk";
--> statement-breakpoint
ALTER TABLE "user_address" DROP CONSTRAINT "user_address_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "file_ref_count_idx";--> statement-breakpoint
DROP INDEX "file_created_at_idx";--> statement-breakpoint
DROP INDEX "user_phone_idx";--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "after_sale" ADD CONSTRAINT "after_sale_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "after_sale" ADD CONSTRAINT "after_sale_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_sku_id_product_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."product_sku"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_record" ADD CONSTRAINT "file_record_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_log" ADD CONSTRAINT "inventory_log_sku_id_product_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."product_sku"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_sku_id_product_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."product_sku"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_log" ADD CONSTRAINT "order_log_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parent_id_product_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sku" ADD CONSTRAINT "product_sku_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_address" ADD CONSTRAINT "user_address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_record" DROP COLUMN "ref_count";--> statement-breakpoint
ALTER TABLE "product_sku" DROP COLUMN "attrs_text";