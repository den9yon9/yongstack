import {
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { orderStatus, payMethod } from "./enums";
import { user } from "./user";

export const order = pgTable("order", {
  id: serial("id").primaryKey(),
  // 订单号（唯一，业务上按规则生成）
  orderNo: varchar("order_no", { length: 32 }).unique().notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => user.id),
  // 收货地址快照（下单时记录，防止地址后续变更影响订单）
  addressSnapshot: jsonb("address_snapshot").notNull(),
  // 订单总金额（单位：分）
  totalAmount: integer("total_amount").notNull(),
  // 优惠金额（单位：分）
  discountAmount: integer("discount_amount").default(0),
  // 实付金额（单位：分）
  payAmount: integer("pay_amount").notNull(),
  // 订单状态：pending_pay→pending_ship→shipped→received→completed / canceled / refunding→refunded
  status: orderStatus("status").notNull().default("pending_pay"),
  // 支付方式：wechat 微信支付 / alipay 支付宝
  payMethod: payMethod("pay_method"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});
