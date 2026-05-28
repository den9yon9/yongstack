import {
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { inventoryBizType } from "./enums";
import { productSku } from "./product_sku";

export const inventoryLog = pgTable("inventory_log", {
  id: serial("id").primaryKey(),
  skuId: integer("sku_id")
    .notNull()
    .references(() => productSku.id),
  // 变更数量：正数入库，负数出库
  change: integer("change").notNull(),
  // 变更后的库存数量
  afterStock: integer("after_stock").notNull(),
  // 业务类型：order 订单扣减 / refund 退款归还 / manual 人工调整
  bizType: inventoryBizType("biz_type").notNull(),
  // 关联的业务 ID（如订单号）
  bizId: varchar("biz_id", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
