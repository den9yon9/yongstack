import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { orderStatus } from "./enums";
import { order } from "./order";

export const orderLog = pgTable("order_log", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => order.id),
  // 变更前状态，null 表示初始创建
  fromStatus: orderStatus("from_status"),
  // 变更后状态
  toStatus: orderStatus("to_status").notNull(),
  // 操作人标识："system" 或用户 ID
  operator: varchar("operator", { length: 50 }),
  // 变更备注
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
