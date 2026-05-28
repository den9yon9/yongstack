import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "admin"]);

export const productStatus = pgEnum("product_status", ["offline", "online"]);

export const orderStatus = pgEnum("order_status", [
  "pending_pay",
  "pending_ship",
  "shipped",
  "received",
  "completed",
  "canceled",
  "refunding",
  "refunded",
]);

export const payMethod = pgEnum("pay_method", ["wechat", "alipay"]);

export const afterSaleType = pgEnum("after_sale_type", [
  "refund_only",
  "return_refund",
]);

export const afterSaleStatus = pgEnum("after_sale_status", [
  "pending",
  "approved",
  "rejected",
  "refunded",
]);

export const inventoryBizType = pgEnum("inventory_biz_type", [
  "order",
  "refund",
  "manual",
]);
