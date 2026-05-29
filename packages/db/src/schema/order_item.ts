import {
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
} from "drizzle-orm/pg-core";
import { order } from "./order";
import { productSku } from "./product_sku";

export const orderItem = pgTable("order_item", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  skuId: integer("sku_id")
    .notNull()
    .references(() => productSku.id, { onDelete: "cascade" }),
  // SKU 快照（下单时记录的名称、价格、规格、图片等，防止后续变更影响历史订单）
  skuSnapshot: jsonb("sku_snapshot").notNull(),
  // 购买数量
  quantity: integer("quantity").notNull(),
  // 实付单价（单位：分）
  price: integer("price").notNull(),
  // 小计金额（单位：分）= price * quantity
  subTotal: integer("sub_total").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
