import {
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { afterSaleStatus, afterSaleType } from "./enums";
import { orderItem } from "./order_item";
import { user } from "./user";

export const afterSale = pgTable("after_sale", {
  id: serial("id").primaryKey(),
  orderItemId: integer("order_item_id")
    .notNull()
    .references(() => orderItem.id),
  userId: integer("user_id")
    .notNull()
    .references(() => user.id),
  // 售后类型：refund_only 仅退款 / return_refund 退货退款
  type: afterSaleType("type").notNull(),
  // 退款/退货原因
  reason: varchar("reason", { length: 500 }).notNull(),
  // 退款金额（单位：分）
  amount: integer("amount").notNull(),
  // 售后状态：pending 待处理 → approved 已通过 / rejected 已拒绝 → refunded 已退款
  status: afterSaleStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});
