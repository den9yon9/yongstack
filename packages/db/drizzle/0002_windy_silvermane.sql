CREATE TYPE "public"."after_sale_status" AS ENUM('pending', 'approved', 'rejected', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."after_sale_type" AS ENUM('refund_only', 'return_refund');--> statement-breakpoint
CREATE TYPE "public"."inventory_biz_type" AS ENUM('order', 'refund', 'manual');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_pay', 'pending_ship', 'shipped', 'received', 'completed', 'canceled', 'refunding', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."pay_method" AS ENUM('wechat', 'alipay');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('offline', 'online');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin');--> statement-breakpoint
ALTER TABLE "after_sale" ALTER COLUMN "type" SET DATA TYPE "public"."after_sale_type" USING "type"::"public"."after_sale_type";--> statement-breakpoint
ALTER TABLE "after_sale" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."after_sale_status";--> statement-breakpoint
ALTER TABLE "after_sale" ALTER COLUMN "status" SET DATA TYPE "public"."after_sale_status" USING "status"::"public"."after_sale_status";--> statement-breakpoint
ALTER TABLE "inventory_log" ALTER COLUMN "biz_type" SET DATA TYPE "public"."inventory_biz_type" USING "biz_type"::"public"."inventory_biz_type";--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "status" SET DEFAULT 'pending_pay'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "pay_method" SET DATA TYPE "public"."pay_method" USING "pay_method"::"public"."pay_method";--> statement-breakpoint
ALTER TABLE "order_log" ALTER COLUMN "from_status" SET DATA TYPE "public"."order_status" USING "from_status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "order_log" ALTER COLUMN "to_status" SET DATA TYPE "public"."order_status" USING "to_status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "status" SET DEFAULT 'offline'::"public"."product_status";--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "status" SET DATA TYPE "public"."product_status" USING "status"::"public"."product_status";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'customer'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";